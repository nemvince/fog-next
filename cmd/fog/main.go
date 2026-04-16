// Package main is the CLI entry point for the fog-next server.
// Usage:
//
//	fog serve              -- start the HTTP server + all background services
//	fog migrate up         -- apply pending migrations
//	fog migrate down       -- roll back the last migration
//	fog migrate status     -- print migration version
//	fog install            -- interactive first-run setup
//	fog migrate-legacy     -- migrate data from a legacy FOG 1.x MySQL database
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/nemvince/fog-next/internal/api"
	"github.com/nemvince/fog-next/internal/auth"
	"github.com/nemvince/fog-next/internal/config"
	"github.com/nemvince/fog-next/internal/database"
	"github.com/nemvince/fog-next/internal/legacymigrate"
	"github.com/nemvince/fog-next/internal/models"
	"github.com/nemvince/fog-next/internal/services"
	"github.com/nemvince/fog-next/internal/store/postgres"
	"github.com/nemvince/fog-next/internal/tftp"
	"golang.org/x/term"
)

var cfgFile string

func main() {
	if err := rootCmd().Execute(); err != nil {
		os.Exit(1)
	}
}

// ------------------------------------------------------------------ root ---

func rootCmd() *cobra.Command {
	root := &cobra.Command{
		Use:   "fog",
		Short: "FOG Next — network boot and imaging server",
		PersistentPreRunE: func(cmd *cobra.Command, _ []string) error {
			return initConfig()
		},
	}
	root.PersistentFlags().StringVarP(&cfgFile, "config", "c", "", "config file (default: /etc/fog/config.yaml)")
	root.AddCommand(serveCmd(), migrateCmd(), installCmd(), migrateLegacyCmd(), versionCmd())
	return root
}

// ----------------------------------------------------------------- serve ---

func serveCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "serve",
		Short: "Start the FOG server",
		RunE:  runServe,
	}
}

func runServe(_ *cobra.Command, _ []string) error {
	cfg := mustConfig()

	setupLogger(cfg)

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	// Database
	db, err := database.Connect(ctx, cfg.Database)
	if err != nil {
		return fmt.Errorf("database connect: %w", err)
	}
	defer db.Close()

	// Auto-migrate on startup
	if err := db.MigrateUp(); err != nil {
		return fmt.Errorf("migrations: %w", err)
	}

	st := postgres.New(db)

	// TFTP server
	tftpSrv := tftp.New(cfg)
	go func() {
		if err := tftpSrv.ListenAndServe(); err != nil {
			slog.Error("tftp server error", "error", err)
		}
	}()

	// Background services
	mgr := services.New(
		services.NewTaskScheduler(cfg, st),
		services.NewImageReplicator(cfg, st),
		services.NewSnapinReplicator(cfg, st),
		services.NewMulticastManager(cfg, st),
		services.NewPingHosts(cfg, st),
		services.NewImageSize(cfg, st),
		services.NewSnapinHash(cfg, st),
	)
	go mgr.Run(ctx)

	// HTTP API server
	srv := api.New(cfg, st)
	errCh := make(chan error, 1)
	go func() {
		slog.Info("fog server starting",
			"http", cfg.Server.HTTP,
			"https_enabled", cfg.Server.TLSCert != "")
		errCh <- srv.Start(ctx)
	}()

	select {
	case <-ctx.Done():
		slog.Info("shutting down")
		return nil
	case err := <-errCh:
		return err
	}
}

// --------------------------------------------------------------- migrate ---

func migrateCmd() *cobra.Command {
	mc := &cobra.Command{
		Use:   "migrate",
		Short: "Manage database schema migrations",
	}
	mc.AddCommand(
		&cobra.Command{
			Use:   "up",
			Short: "Apply all pending migrations",
			RunE:  runMigrateUp,
		},
		&cobra.Command{
			Use:   "down",
			Short: "Roll back the most recent migration",
			RunE:  runMigrateDown,
		},
		&cobra.Command{
			Use:   "status",
			Short: "Print current migration version",
			RunE:  runMigrateStatus,
		},
	)
	return mc
}

func runMigrateUp(_ *cobra.Command, _ []string) error {
	cfg := mustConfig()
	db, err := database.Connect(context.Background(), cfg.Database)
	if err != nil {
		return err
	}
	defer db.Close()
	if err := db.MigrateUp(); err != nil {
		return err
	}
	fmt.Println("migrations applied")
	return nil
}

func runMigrateDown(_ *cobra.Command, _ []string) error {
	cfg := mustConfig()
	db, err := database.Connect(context.Background(), cfg.Database)
	if err != nil {
		return err
	}
	defer db.Close()
	if err := db.MigrateDown(); err != nil {
		return err
	}
	fmt.Println("last migration rolled back")
	return nil
}

func runMigrateStatus(_ *cobra.Command, _ []string) error {
	cfg := mustConfig()
	db, err := database.Connect(context.Background(), cfg.Database)
	if err != nil {
		return err
	}
	defer db.Close()
	v, dirty, err := db.MigrateVersion()
	if err != nil {
		return err
	}
	if dirty {
		fmt.Printf("version %d (dirty)\n", v)
	} else {
		fmt.Printf("version %d\n", v)
	}
	return nil
}

// --------------------------------------------------------------- install ---

func installCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "install",
		Short: "Interactive first-run setup wizard",
		RunE:  runInstall,
	}
}

func runInstall(_ *cobra.Command, _ []string) error {
	fmt.Println("FOG Next Installation Wizard")
	fmt.Println("============================")
	fmt.Println()

	cfg := config.Defaults()
	cfg.Database.Host = prompt("PostgreSQL host", "localhost")
	cfg.Database.Port = promptInt("PostgreSQL port", 5432)
	cfg.Database.Name = prompt("Database name", "fog")
	cfg.Database.User = prompt("Database user", "fog")
	cfg.Database.Password = promptPassword("Database password")
	cfg.Server.HTTP = prompt("HTTP listen address", ":80")
	cfg.Storage.BasePath = prompt("Image storage root", "/opt/fog/images")
	cfg.Storage.SnapinPath = prompt("Snapin storage root", "/opt/fog/snapins")

	adminUser := prompt("Admin username", "fog")
	adminPass := promptPassword("Admin password")
	if adminPass == "" {
		return fmt.Errorf("admin password must not be empty")
	}

	// Generate a random JWT secret
	secret, _ := auth.GenerateAPIToken()
	cfg.Auth.JWTSecret = secret

	if err := config.WriteDefault(cfg, "/etc/fog/config.yaml"); err != nil {
		return fmt.Errorf("write config: %w", err)
	}
	fmt.Println("\nConfig written to /etc/fog/config.yaml")

	// Run migrations
	ctx := context.Background()
	db, err := database.Connect(ctx, cfg.Database)
	if err != nil {
		return fmt.Errorf("database connect: %w", err)
	}
	defer db.Close()

	if err := db.MigrateUp(); err != nil {
		return fmt.Errorf("migrations: %w", err)
	}
	fmt.Println("Schema created successfully.")

	// Seed the admin user
	hash, err := auth.HashPassword(adminPass)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}
	st := postgres.New(db)
	adminModel := &models.User{
		Username:     adminUser,
		PasswordHash: hash,
		Role:         models.RoleAdmin,
		IsActive:     true,
	}
	if err := st.Users().CreateUser(ctx, adminModel); err != nil {
		return fmt.Errorf("create admin user: %w", err)
	}
	fmt.Printf("Admin user %q created.\n", adminUser)

	fmt.Println("\nInstallation complete!")
	fmt.Println("Start the server with: fog serve")
	return nil
}

// -------------------------------------------------------- migrate-legacy ---

func migrateLegacyCmd() *cobra.Command {
	var legacyDSN string

	cmd := &cobra.Command{
		Use:   "migrate-legacy",
		Short: "Migrate data from a FOG 1.x MySQL database into the new schema",
		Long: `Reads hosts, images, groups, snapins, and users from a legacy FOG 1.x
MySQL database and inserts them into the configured PostgreSQL database.

The new PostgreSQL database must already be initialised (fog migrate up).

Example:
  fog migrate-legacy --legacy-dsn "fog:secret@tcp(localhost:3306)/fog?parseTime=true"

Note: Legacy user passwords are MD5 hashes and cannot be converted.
Migrated users will need to reset their passwords via the web UI.`,
		RunE: func(_ *cobra.Command, _ []string) error {
			return runMigrateLegacy(legacyDSN)
		},
	}
	cmd.Flags().StringVar(&legacyDSN, "legacy-dsn", "",
		"MySQL DSN for the FOG 1.x database (required)")
	_ = cmd.MarkFlagRequired("legacy-dsn")
	return cmd
}

func runMigrateLegacy(legacyDSN string) error {
	cfg := mustConfig()
	ctx := context.Background()

	// Connect to new PostgreSQL store
	db, err := database.Connect(ctx, cfg.Database)
	if err != nil {
		return fmt.Errorf("connect to postgres: %w", err)
	}
	defer db.Close()
	st := postgres.New(db)

	// Connect to legacy MySQL
	runner, err := legacymigrate.New(legacymigrate.Config{DSN: legacyDSN}, st)
	if err != nil {
		return fmt.Errorf("connect to legacy database: %w", err)
	}
	defer runner.Close()

	fmt.Println("Starting legacy migration…")
	report, err := runner.Run(ctx)
	if err != nil {
		return fmt.Errorf("migration failed: %w", err)
	}

	fmt.Println(report)
	if len(report.Errors) > 0 {
		fmt.Println("\nErrors encountered:")
		for _, e := range report.Errors {
			fmt.Printf("  - %s\n", e)
		}
	}
	return nil
}

// -------------------------------------------------------------- version ---

func versionCmd() *cobra.Command {	return &cobra.Command{
		Use:   "version",
		Short: "Print the fog version",
		Run: func(_ *cobra.Command, _ []string) {
			fmt.Println("fog-next version 0.1.0-dev")
		},
	}
}

// ---------------------------------------------------------------- helpers ---

func initConfig() error {
	if cfgFile != "" {
		viper.SetConfigFile(cfgFile)
	} else {
		viper.AddConfigPath("/etc/fog")
		viper.AddConfigPath("$HOME/.fog")
		viper.AddConfigPath(".")
		viper.SetConfigName("config")
	}
	viper.AutomaticEnv()
	_ = viper.ReadInConfig() // ignore "not found" — defaults cover it
	return nil
}

func mustConfig() *config.Config {
	cfg, err := config.Load(cfgFile)
	if err != nil {
		slog.Error("config error", "error", err)
		os.Exit(1)
	}
	return cfg
}

func setupLogger(cfg *config.Config) {
	level := slog.LevelInfo
	switch cfg.Log.Level {
	case "debug":
		level = slog.LevelDebug
	case "warn", "warning":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	}
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})))
}

func prompt(label, defaultVal string) string {
	fmt.Printf("  %s [%s]: ", label, defaultVal)
	var v string
	_, _ = fmt.Scanln(&v)
	if v == "" {
		return defaultVal
	}
	return v
}

func promptInt(label string, defaultVal int) int {
	fmt.Printf("  %s [%d]: ", label, defaultVal)
	var v int
	if _, err := fmt.Scan(&v); err != nil || v == 0 {
		return defaultVal
	}
	return v
}

func promptPassword(label string) string {
	fmt.Printf("  %s: ", label)
	b, err := term.ReadPassword(int(os.Stdin.Fd()))
	fmt.Println() // newline after hidden input
	if err != nil {
		// Fall back to plain Scanln if stdin is not a terminal (e.g. piped input).
		var v string
		_, _ = fmt.Scanln(&v)
		return v
	}
	return string(b)
}
