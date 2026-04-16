-- Reverse of 000001_init.up.sql

DROP TABLE IF EXISTS storage_node_failures;
DROP TABLE IF EXISTS multicast_session_members;
DROP TABLE IF EXISTS multicast_sessions;
DROP TABLE IF EXISTS module_statuses;
DROP TABLE IF EXISTS modules;
DROP TABLE IF EXISTS global_settings;
DROP TABLE IF EXISTS printer_assocs;
DROP TABLE IF EXISTS printers;
DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS snapin_tasks;
DROP TABLE IF EXISTS snapin_jobs;
DROP TABLE IF EXISTS snapin_assocs;
DROP TABLE IF EXISTS snapins;
DROP TABLE IF EXISTS imaging_logs;
DROP TABLE IF EXISTS scheduled_tasks;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS group_members;
DROP TABLE IF EXISTS groups;
DROP TABLE IF EXISTS pending_macs;
DROP TABLE IF EXISTS host_macs;
DROP TABLE IF EXISTS hosts;
DROP TABLE IF EXISTS images;
DROP TABLE IF EXISTS storage_nodes;
DROP TABLE IF EXISTS storage_groups;
DROP TABLE IF EXISTS image_types;
DROP TABLE IF EXISTS os_types;

DROP TYPE IF EXISTS task_state;
DROP TYPE IF EXISTS task_type;
DROP TYPE IF EXISTS user_role;

DROP EXTENSION IF EXISTS "citext";
DROP EXTENSION IF EXISTS "pgcrypto";
