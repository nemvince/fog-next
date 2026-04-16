# Upgrading

---

## Upgrading FOG Next (within fog-next versions)

For any patch or minor release:

```bash
git pull
make build
sudo install -m 0755 build/fog /usr/local/bin/fog
sudo systemctl restart fog
```

Database migrations run automatically on startup. To apply them manually before restarting:

```bash
sudo fog migrate up
sudo fog migrate status   # confirm the new version
```

To roll back one migration step:

```bash
sudo fog migrate down
```

> **Never** roll back a migration that has already been used in production without first backing up the database.

---

## Migrating from FOG 1.x

FOG Next is a clean rewrite and does **not** share the FOG 1.x database schema. A direct in-place upgrade is not supported. Use the migration path below to import your existing FOG 1.x data.

### Overview

1. Export data from FOG 1.x (hosts, images, groups, snapins, storage nodes)
2. Install FOG Next alongside or on a fresh server
3. Import data into FOG Next via the REST API or import scripts
4. Migrate or re-capture images to the new storage layout
5. Update DHCP to point clients at the new server
6. Decommission the old FOG server

### Step 1 — Back up FOG 1.x

```bash
# On the old FOG server
mysqldump -u root fog > fog1x_backup_$(date +%Y%m%d).sql
tar czf fog1x_images_$(date +%Y%m%d).tar.gz /images
```

Keep these backups until you have fully validated the new system.

### Step 2 — Install FOG Next

Follow [docs/install.md](install.md) to set up FOG Next on a new server (or a new Docker container alongside the old one).

> **Tip:** Run both servers in parallel until you have verified all hosts are imaging correctly. Use separate IPs; point DHCP at the new server only when ready.

### Step 3 — Export from FOG 1.x

FOG 1.x does not have a built-in export tool. You can query its MySQL database directly:

```sql
-- List hosts
SELECT hostName, hostIP, hostImage, hostDesc FROM hosts;

-- List images
SELECT imageName, imagePath, imageType, imageOS FROM images;

-- List groups
SELECT groupName, groupDesc FROM groups;
```

Or use FOG 1.x's web API if available in your version.

### Step 4 — Import hosts and images into FOG Next

Use the FOG Next REST API to create resources. A simple shell example:

```bash
TOKEN=$(curl -s -X POST http://fog-next/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"fog","password":"yourpassword"}' | jq -r .accessToken)

# Create an image
curl -s -X POST http://fog-next/api/v1/images \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Windows 11 Base","path":"/opt/fog/images/win11","imageType":"single","osType":"windows"}'

# Create a host
curl -s -X POST http://fog-next/api/v1/hosts \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"WORKSTATION-01","ip":"192.168.1.101","isEnabled":true}'
```

### Step 5 — Copy image files

FOG Next uses the same raw partition/image file format as FOG 1.x for single-disk images. Copy the image directories from the old server:

```bash
rsync -av --progress old-fog-server:/images/ /opt/fog/images/
```

> **Note:** Verify the image paths configured in FOG Next match the directory names on disk.

### Step 6 — Registering existing hosts

If your hosts still have the FOG 1.x client (`fogclient`) installed, they will automatically register with FOG Next via the `/fog/service/register.php` compatibility endpoint the next time they boot. The host record will appear in the web UI under _Pending MACs_ and can be approved from there.

For hosts you want to pre-register without booting them, use `POST /api/v1/hosts` (see Step 4).

### Step 7 — Update DHCP

Change DHCP options 66 (TFTP server address) and 67 (boot filename) to point at the new FOG Next server. After this point, PXE-booting clients will be served by FOG Next.

### Step 8 — Decommission FOG 1.x

Once all hosts are imaging successfully with FOG Next, you can decommission the old server.

---

## Known differences from FOG 1.x

| Feature | FOG 1.x | FOG Next |
|---------|---------|----------|
| Language/stack | PHP + Apache + MySQL | Go + PostgreSQL |
| Web UI | jQuery / Bootstrap | React + Tailwind |
| Database | MySQL 5.x / MariaDB | PostgreSQL 14+ |
| Snapin storage | `/opt/fog/snapins/` | `/opt/fog/snapins/<id>/` (per-snapin dir) |
| Auth | Session-based | JWT (stateless) |
| Real-time updates | Polling | WebSocket |
| Install | Bash mega-script | `fog install` wizard |
| API | Undocumented PHP | Versioned REST API at `/api/v1/` |

The FOG 1.x **client-side** protocol (`fogclient`) is fully supported via the `/fog/service/*` compatibility endpoints. No changes to managed PCs are required.
