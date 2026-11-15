# VCX PMO Control Tower — PHP/MySQL

Version **0.1 (read-only foundation)**, based on GAS repository `psbachelor/pmo_dashboard_gg_sheet` (`main`).

## Implemented

- PHP 8.3 front controller with session authentication, CSRF token, logout.
- MySQL 8 core schema for users, credentials, projects, members, tasks, audit.
- Role-scoped read-only project list and task detail for PMO_ADMIN, EXECUTIVE, PM, PIC.
- Minimal responsive portfolio UI.

## Not yet implemented

Full GAS feature parity, task editing, issue/RAID, procedures/checklists, assignments/workload, dashboards, audit writes, full schema migration, GAS data import, login throttling, automated tests and deployment hardening. **Do not expose to the public internet or migrate real data yet.** The legacy GAS repository remains untouched.

## Local preparation (not production deployment)

1. Use PHP 8.3, MySQL 8 and Apache with `mod_rewrite`.
2. Copy `.env.example` to `.env`, set database credentials, and ensure `public/` is the web document root.
3. Create an empty MySQL database and run `database/migrations/001_core.sql`.
4. Create an admin from CLI with `VCX_ADMIN_PASSWORD` (12+ characters): `php scripts/create_admin.php ADMIN001 pmo.admin "PMO Admin" admin@example.invalid`.
5. Open the application; login to view projects once data has been imported separately.

**No import tool is included yet.** Do not directly copy GAS password hashes: PHP uses `password_hash` and requires credential reset/migration planning.

## Git workflow

- `main`: stable integration baseline, intended production branch once deployment-ready.
- `develop`: UAT/integration.
- `feature/*`: development via PR.
- Production and UAT must have separate databases and configuration.

See `docs/MIGRATION.md` for the migration map.
