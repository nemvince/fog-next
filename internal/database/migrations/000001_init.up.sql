-- ============================================================
-- FOG Next  –  initial schema
-- ============================================================

-- --------------------------------------------------------
-- Extensions
-- --------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive text

-- --------------------------------------------------------
-- Enums / domain types
-- --------------------------------------------------------
CREATE TYPE user_role AS ENUM ('admin', 'readonly');
CREATE TYPE task_type AS ENUM (
    'deploy', 'capture', 'multicast',
    'debug', 'memtest', 'wipe', 'virus_scan', 'snapin'
);
CREATE TYPE task_state AS ENUM (
    'queued', 'active', 'complete',
    'cancelled', 'failed', 'noqueue'
);

-- --------------------------------------------------------
-- OS types
-- --------------------------------------------------------
CREATE TABLE os_types (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO os_types (name) VALUES
    ('Windows XP'),
    ('Windows Vista'),
    ('Windows 7'),
    ('Windows 8'),
    ('Windows 8.1'),
    ('Windows 10'),
    ('Windows 11'),
    ('Windows Server 2003'),
    ('Windows Server 2008'),
    ('Windows Server 2012'),
    ('Windows Server 2016'),
    ('Windows Server 2019'),
    ('Windows Server 2022'),
    ('Linux'),
    ('macOS'),
    ('Other');

-- --------------------------------------------------------
-- Image types
-- --------------------------------------------------------
CREATE TABLE image_types (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO image_types (name) VALUES
    ('Single Disk - Resizable'),
    ('Single Disk - Fixed Size'),
    ('Multiple Partition - Single Disk'),
    ('Multiple Disk - Fixed Size'),
    ('Raw Image');

-- --------------------------------------------------------
-- Storage groups
-- --------------------------------------------------------
CREATE TABLE storage_groups (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL UNIQUE,
    max_clients INT         NOT NULL DEFAULT 10,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- Storage nodes
-- --------------------------------------------------------
CREATE TABLE storage_nodes (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name             TEXT        NOT NULL,
    hostname         TEXT        NOT NULL,
    root_path        TEXT        NOT NULL DEFAULT '/images',
    web_root         TEXT        NOT NULL DEFAULT '/images',
    storage_group_id UUID        NOT NULL REFERENCES storage_groups(id) ON DELETE CASCADE,
    is_enabled       BOOLEAN     NOT NULL DEFAULT TRUE,
    is_master        BOOLEAN     NOT NULL DEFAULT FALSE,
    max_clients      INT         NOT NULL DEFAULT 10,
    ssh_user         TEXT        NOT NULL DEFAULT 'fog',
    bandwidth_limit  INT         NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_storage_nodes_group ON storage_nodes(storage_group_id);

-- --------------------------------------------------------
-- Images
-- --------------------------------------------------------
CREATE TABLE images (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name             TEXT        NOT NULL UNIQUE,
    description      TEXT        NOT NULL DEFAULT '',
    file_path        TEXT        NOT NULL DEFAULT '',
    os_type_id       UUID        REFERENCES os_types(id) ON DELETE SET NULL,
    image_type_id    UUID        REFERENCES image_types(id) ON DELETE SET NULL,
    storage_group_id UUID        REFERENCES storage_groups(id) ON DELETE SET NULL,
    size_bytes       BIGINT      NOT NULL DEFAULT 0,
    is_enabled       BOOLEAN     NOT NULL DEFAULT TRUE,
    compress_ratio   INT         NOT NULL DEFAULT 6,
    partition_scheme TEXT        NOT NULL DEFAULT 'auto',   -- auto | mbr | gpt
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_images_storage_group ON images(storage_group_id);

-- --------------------------------------------------------
-- Hosts
-- --------------------------------------------------------
CREATE TABLE hosts (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name             TEXT        NOT NULL UNIQUE,
    description      TEXT        NOT NULL DEFAULT '',
    ip               TEXT        NOT NULL DEFAULT '',
    image_id         UUID        REFERENCES images(id) ON DELETE SET NULL,
    kernel           TEXT        NOT NULL DEFAULT '',
    init             TEXT        NOT NULL DEFAULT '',
    kernel_args      TEXT        NOT NULL DEFAULT '',
    is_enabled       BOOLEAN     NOT NULL DEFAULT TRUE,
    use_aad          BOOLEAN     NOT NULL DEFAULT FALSE,  -- Azure AD join
    use_wol          BOOLEAN     NOT NULL DEFAULT TRUE,
    last_contact     TIMESTAMPTZ,
    deployed_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hosts_image ON hosts(image_id);

-- --------------------------------------------------------
-- Host MACs
-- --------------------------------------------------------
CREATE TABLE host_macs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id     UUID        NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
    mac         CITEXT      NOT NULL,
    is_primary  BOOLEAN     NOT NULL DEFAULT FALSE,
    seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_host_macs_mac UNIQUE (mac)
);

CREATE INDEX idx_host_macs_host ON host_macs(host_id);
CREATE INDEX idx_host_macs_mac ON host_macs(mac);

-- --------------------------------------------------------
-- Pending MACs (unregistered hosts)
-- --------------------------------------------------------
CREATE TABLE pending_macs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    mac         CITEXT      NOT NULL UNIQUE,
    seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- Groups
-- --------------------------------------------------------
CREATE TABLE groups (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL UNIQUE,
    description TEXT        NOT NULL DEFAULT '',
    image_id    UUID        REFERENCES images(id) ON DELETE SET NULL,
    kernel      TEXT        NOT NULL DEFAULT '',
    kernel_args TEXT        NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- Group members
-- --------------------------------------------------------
CREATE TABLE group_members (
    group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    host_id     UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, host_id)
);

CREATE INDEX idx_group_members_host ON group_members(host_id);

-- --------------------------------------------------------
-- Tasks
-- --------------------------------------------------------
CREATE TABLE tasks (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name             TEXT        NOT NULL DEFAULT '',
    type             task_type   NOT NULL,
    state            task_state  NOT NULL DEFAULT 'queued',
    host_id          UUID        REFERENCES hosts(id) ON DELETE SET NULL,
    is_group         BOOLEAN     NOT NULL DEFAULT FALSE,
    image_id         UUID        REFERENCES images(id) ON DELETE SET NULL,
    storage_group_id UUID        REFERENCES storage_groups(id) ON DELETE SET NULL,
    storage_node_id  UUID        REFERENCES storage_nodes(id) ON DELETE SET NULL,
    percent          INT         NOT NULL DEFAULT 0,
    elapsed_seconds  INT         NOT NULL DEFAULT 0,
    eta_seconds      INT         NOT NULL DEFAULT 0,
    is_force         BOOLEAN     NOT NULL DEFAULT FALSE,
    is_shutdown      BOOLEAN     NOT NULL DEFAULT FALSE,
    is_wipe          BOOLEAN     NOT NULL DEFAULT FALSE,
    created_by       TEXT        NOT NULL DEFAULT '',
    log              TEXT        NOT NULL DEFAULT '',
    started_at       TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_host ON tasks(host_id);
CREATE INDEX idx_tasks_state ON tasks(state);
CREATE INDEX idx_tasks_created ON tasks(created_at);

-- --------------------------------------------------------
-- Scheduled tasks
-- --------------------------------------------------------
CREATE TABLE scheduled_tasks (
    id           UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT      NOT NULL,
    task_type    task_type NOT NULL,
    target_id    UUID      NOT NULL,   -- host or group UUID
    is_group     BOOLEAN   NOT NULL DEFAULT FALSE,
    is_enabled   BOOLEAN   NOT NULL DEFAULT TRUE,
    is_shutdown  BOOLEAN   NOT NULL DEFAULT FALSE,
    minute       TEXT      NOT NULL DEFAULT '0',
    hour         TEXT      NOT NULL DEFAULT '*',
    day_of_month TEXT      NOT NULL DEFAULT '*',
    month        TEXT      NOT NULL DEFAULT '*',
    day_of_week  TEXT      NOT NULL DEFAULT '*',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- Imaging logs
-- --------------------------------------------------------
CREATE TABLE imaging_logs (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id      UUID        REFERENCES hosts(id) ON DELETE SET NULL,
    host_name    TEXT        NOT NULL DEFAULT '',
    image_name   TEXT        NOT NULL DEFAULT '',
    task_type    task_type   NOT NULL,
    success      BOOLEAN     NOT NULL DEFAULT FALSE,
    elapsed_sec  INT         NOT NULL DEFAULT 0,
    started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_imaging_logs_host ON imaging_logs(host_id);

-- --------------------------------------------------------
-- Snapins
-- --------------------------------------------------------
CREATE TABLE snapins (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL UNIQUE,
    description TEXT        NOT NULL DEFAULT '',
    file_path   TEXT        NOT NULL DEFAULT '',
    file_name   TEXT        NOT NULL DEFAULT '',
    args        TEXT        NOT NULL DEFAULT '',
    run_with    TEXT        NOT NULL DEFAULT '',
    run_with_args TEXT      NOT NULL DEFAULT '',
    hash        TEXT        NOT NULL DEFAULT '',
    size_bytes  BIGINT      NOT NULL DEFAULT 0,
    is_enabled  BOOLEAN     NOT NULL DEFAULT TRUE,
    reboot_after BOOLEAN    NOT NULL DEFAULT FALSE,
    hide_from_menu BOOLEAN  NOT NULL DEFAULT FALSE,
    timeout_sec INT         NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- Snapin associations (host ↔ snapin)
-- --------------------------------------------------------
CREATE TABLE snapin_assocs (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id     UUID    NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
    snapin_id   UUID    NOT NULL REFERENCES snapins(id) ON DELETE CASCADE,
    CONSTRAINT uq_snapin_assocs UNIQUE (host_id, snapin_id)
);

CREATE INDEX idx_snapin_assocs_host ON snapin_assocs(host_id);
CREATE INDEX idx_snapin_assocs_snapin ON snapin_assocs(snapin_id);

-- --------------------------------------------------------
-- Snapin jobs (per-task snapin queue)
-- --------------------------------------------------------
CREATE TABLE snapin_jobs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    host_id     UUID        NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
    state       TEXT        NOT NULL DEFAULT 'queued',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_snapin_jobs_task ON snapin_jobs(task_id);

-- --------------------------------------------------------
-- Snapin tasks (individual snapin within a snapin job)
-- --------------------------------------------------------
CREATE TABLE snapin_tasks (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    snapin_job_id UUID        NOT NULL REFERENCES snapin_jobs(id) ON DELETE CASCADE,
    snapin_id     UUID        NOT NULL REFERENCES snapins(id) ON DELETE CASCADE,
    state         TEXT        NOT NULL DEFAULT 'queued',
    return_code   INT,
    log           TEXT        NOT NULL DEFAULT '',
    started_at    TIMESTAMPTZ,
    completed_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- Users
-- --------------------------------------------------------
CREATE TABLE users (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    username     CITEXT      NOT NULL UNIQUE,
    password     TEXT        NOT NULL,            -- bcrypt hash
    email        TEXT        NOT NULL DEFAULT '',
    first_name   TEXT        NOT NULL DEFAULT '',
    last_name    TEXT        NOT NULL DEFAULT '',
    role         user_role   NOT NULL DEFAULT 'admin',
    api_token    TEXT        NOT NULL DEFAULT '',
    is_enabled   BOOLEAN     NOT NULL DEFAULT TRUE,
    last_login   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_users_api_token ON users(api_token) WHERE api_token <> '';

-- --------------------------------------------------------
-- Refresh tokens
-- --------------------------------------------------------
CREATE TABLE refresh_tokens (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT        NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- --------------------------------------------------------
-- Audit log
-- --------------------------------------------------------
CREATE TABLE audit_logs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
    username    TEXT        NOT NULL DEFAULT '',
    action      TEXT        NOT NULL,
    entity_type TEXT        NOT NULL DEFAULT '',
    entity_id   TEXT        NOT NULL DEFAULT '',
    detail      TEXT        NOT NULL DEFAULT '',
    ip          TEXT        NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- --------------------------------------------------------
-- Inventory
-- --------------------------------------------------------
CREATE TABLE inventory (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id       UUID        NOT NULL UNIQUE REFERENCES hosts(id) ON DELETE CASCADE,
    cpu_model     TEXT        NOT NULL DEFAULT '',
    cpu_cores     INT         NOT NULL DEFAULT 0,
    ram_mb        INT         NOT NULL DEFAULT 0,
    disk_model    TEXT        NOT NULL DEFAULT '',
    disk_size_gb  INT         NOT NULL DEFAULT 0,
    gpu_model     TEXT        NOT NULL DEFAULT '',
    bios_version  TEXT        NOT NULL DEFAULT '',
    serial_number TEXT        NOT NULL DEFAULT '',
    asset_tag     TEXT        NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- Printers
-- --------------------------------------------------------
CREATE TABLE printers (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL UNIQUE,
    description TEXT        NOT NULL DEFAULT '',
    type        TEXT        NOT NULL DEFAULT 'network',  -- network | local | cups
    port        TEXT        NOT NULL DEFAULT '',
    ip          TEXT        NOT NULL DEFAULT '',
    model       TEXT        NOT NULL DEFAULT '',
    is_default  BOOLEAN     NOT NULL DEFAULT FALSE,
    alias       TEXT        NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- Printer associations (host ↔ printer)
-- --------------------------------------------------------
CREATE TABLE printer_assocs (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id     UUID    NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
    printer_id  UUID    NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
    CONSTRAINT uq_printer_assocs UNIQUE (host_id, printer_id)
);

-- --------------------------------------------------------
-- Global settings
-- --------------------------------------------------------
CREATE TABLE global_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO global_settings (key, value, description) VALUES
    ('fog_server_address',  '',      'Hostname or IP of the FOG server'),
    ('fog_tftp_address',    '',      'TFTP server address for PXE boot menu'),
    ('fog_storage_root',    '/opt/fog/images', 'Default image storage root'),
    ('fog_nfs_export',      '',      'NFS export path for legacy client support'),
    ('fog_https_enabled',   'false', 'Serve HTTPS on port 443'),
    ('fog_shutdown_enabled','false', 'Allow tasks to shut down clients'),
    ('fog_domain_name',     '',      'Active Directory domain name'),
    ('fog_domain_user',     '',      'AD join account username'),
    ('fog_domain_password', '',      'AD join account password (encrypted)'),
    ('fog_max_receivers',   '10',    'Max simultaneous multicast receivers'),
    ('fog_log_level',       'info',  'Log level: debug, info, warn, error');

-- --------------------------------------------------------
-- Modules (feature toggles)
-- --------------------------------------------------------
CREATE TABLE modules (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL UNIQUE,
    description TEXT        NOT NULL DEFAULT '',
    is_enabled  BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO modules (name, description, is_enabled) VALUES
    ('AutoLogOut',      'Auto log out idle sessions',               TRUE),
    ('DisplayManager',  'Manage display settings',                  TRUE),
    ('GreenFog',        'Power management (green settings)',        FALSE),
    ('HostnameChanger', 'Rename hosts after deployment',            TRUE),
    ('PrinterManager',  'Deploy and manage printers',               TRUE),
    ('SnapinClient',    'Deploy snapins to clients',                TRUE),
    ('TaskReboot',      'Reboot after task completion',             TRUE),
    ('UserCleanup',     'Remove stale local user profiles',         FALSE),
    ('UserTracker',     'Track logged-in users',                    TRUE);

-- --------------------------------------------------------
-- Module status per host
-- --------------------------------------------------------
CREATE TABLE module_statuses (
    host_id     UUID    NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
    module_id   UUID    NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    is_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (host_id, module_id)
);

-- --------------------------------------------------------
-- Multicast sessions
-- --------------------------------------------------------
CREATE TABLE multicast_sessions (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name             TEXT        NOT NULL DEFAULT '',
    image_id         UUID        NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    storage_node_id  UUID        REFERENCES storage_nodes(id) ON DELETE SET NULL,
    port             INT         NOT NULL DEFAULT 9000,
    interface        TEXT        NOT NULL DEFAULT '',
    client_count     INT         NOT NULL DEFAULT 0,
    state            TEXT        NOT NULL DEFAULT 'pending',
    started_at       TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- Multicast session members (per-host join tracking)
-- --------------------------------------------------------
CREATE TABLE multicast_session_members (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID        NOT NULL REFERENCES multicast_sessions(id) ON DELETE CASCADE,
    host_id         UUID        NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    CONSTRAINT uq_mc_session_members UNIQUE (session_id, host_id)
);

-- --------------------------------------------------------
-- Storage node failures (audit trail)
-- --------------------------------------------------------
CREATE TABLE storage_node_failures (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_node_id UUID        NOT NULL REFERENCES storage_nodes(id) ON DELETE CASCADE,
    error_message   TEXT        NOT NULL DEFAULT '',
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- Default data: admin user (password: password — MUST CHANGE)
-- bcrypt cost 12 hash of "password":
-- $2a$12$YhfhpV1DTLN1wJp/5Eol9OlrHZ4gBmZ0qRgFJp3b2y5D6T8L7QBOG
-- --------------------------------------------------------
INSERT INTO storage_groups (id, name, max_clients)
VALUES ('00000000-0000-0000-0000-000000000001', 'default', 10);

INSERT INTO storage_nodes (id, name, hostname, root_path, web_root, storage_group_id, is_master, ssh_user)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'master',
    'localhost',
    '/opt/fog/images',
    '/images',
    '00000000-0000-0000-0000-000000000001',
    TRUE,
    'fog'
);

INSERT INTO users (id, username, password, role, email, first_name, last_name)
VALUES (
    '00000000-0000-0000-0000-000000000010',
    'fog',
    '$2a$12$YhfhpV1DTLN1wJp/5Eol9OlrHZ4gBmZ0qRgFJp3b2y5D6T8L7QBOG',
    'admin',
    'fog@localhost',
    'FOG',
    'Admin'
);
