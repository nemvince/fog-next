package models

import (
	"time"

	"github.com/google/uuid"
)

// Inventory stores hardware information collected from a managed host.
type Inventory struct {
	ID           uuid.UUID `db:"id"            json:"id"`
	HostID       uuid.UUID `db:"host_id"       json:"hostId"`
	CPUModel     string    `db:"cpu_model"     json:"cpuModel"`
	CPUCores     int       `db:"cpu_cores"     json:"cpuCores"`
	CPUFreqMHz   int       `db:"cpu_freq_mhz"  json:"cpuFreqMhz"`
	RAMMiB       int       `db:"ram_mib"       json:"ramMib"`
	HDModel      string    `db:"hd_model"      json:"hdModel"`
	HDSizeGB     int       `db:"hd_size_gb"    json:"hdSizeGb"`
	Manufacturer string    `db:"manufacturer"  json:"manufacturer"`
	Product      string    `db:"product"       json:"product"`
	Serial       string    `db:"serial"        json:"serial"`
	UUID         string    `db:"uuid"          json:"uuid"`
	BIOSVersion  string    `db:"bios_version"  json:"biosVersion"`
	PrimaryMAC   string    `db:"primary_mac"   json:"primaryMac"`
	OSName       string    `db:"os_name"       json:"osName"`
	OSVersion    string    `db:"os_version"    json:"osVersion"`
	CreatedAt    time.Time `db:"created_at"    json:"createdAt"`
	UpdatedAt    time.Time `db:"updated_at"    json:"updatedAt"`
}

// Printer represents a printer that can be deployed to hosts.
type Printer struct {
	ID          uuid.UUID `db:"id"          json:"id"`
	Name        string    `db:"name"        json:"name"`
	Description string    `db:"description" json:"description"`
	// Type is "local", "network", or "ppd".
	Type        string    `db:"type"        json:"type"`
	Port        string    `db:"port"        json:"port"`
	IP          string    `db:"ip"          json:"ip"`
	Model       string    `db:"model"       json:"model"`
	Driver      string    `db:"driver"      json:"driver"`
	IsDefault   bool      `db:"is_default"  json:"isDefault"`
	CreatedAt   time.Time `db:"created_at"  json:"createdAt"`
	UpdatedAt   time.Time `db:"updated_at"  json:"updatedAt"`
}

// PrinterAssoc links a printer to a host.
type PrinterAssoc struct {
	ID        uuid.UUID `db:"id"         json:"id"`
	PrinterID uuid.UUID `db:"printer_id" json:"printerId"`
	HostID    uuid.UUID `db:"host_id"    json:"hostId"`
	IsDefault bool      `db:"is_default" json:"isDefault"`
}

// GlobalSetting is a system-wide key-value configuration entry.
type GlobalSetting struct {
	ID          uuid.UUID `db:"id"          json:"id"`
	Key         string    `db:"key"         json:"key"`
	Value       string    `db:"value"       json:"value"`
	Description string    `db:"description" json:"description"`
	Category    string    `db:"category"    json:"category"`
	UpdatedAt   time.Time `db:"updated_at"  json:"updatedAt"`
}

// Module represents a client-side FOG module (e.g. autologout, syskey).
type Module struct {
	ID          uuid.UUID `db:"id"          json:"id"`
	Name        string    `db:"name"        json:"name"`
	ShortName   string    `db:"short_name"  json:"shortName"`
	IsDefault   bool      `db:"is_default"  json:"isDefault"`
	IsEnabled   bool      `db:"is_enabled"  json:"isEnabled"`
}

// ModuleStatus tracks whether a module is enabled on a specific host.
type ModuleStatus struct {
	ID       uuid.UUID `db:"id"        json:"id"`
	HostID   uuid.UUID `db:"host_id"   json:"hostId"`
	ModuleID uuid.UUID `db:"module_id" json:"moduleId"`
	IsOn     bool      `db:"is_on"     json:"isOn"`
}
