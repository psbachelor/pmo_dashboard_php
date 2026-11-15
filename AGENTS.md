# Development guidelines — VCX PMO PHP

- Discuss and report in Vietnamese; use English for technical identifiers.
- Source of truth for existing behavior: `psbachelor/pmo_dashboard_gg_sheet` branch `main`; inspect code, not documentation alone.
- Never modify the GAS repository or live Google Sheets during migration.
- Preserve roles, permissions, audit trails, data semantics, and spreadsheet-like inline task editing.
- Never commit credentials or real user/project data.
- PHP 8.3 and MySQL 8; use prepared statements, output escaping, CSRF protection, and secure session handling.
- Keep production (`main`) and UAT (`develop`) configurations and databases separate.
- Use `feature/*` branches and PR reviews; do not merge automatically.
- Migration scripts must be repeatable, validated, and non-destructive by default.
- Do not declare a module complete without corresponding tests and comparison with GAS behavior.
