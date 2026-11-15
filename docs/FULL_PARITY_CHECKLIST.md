# Full GAS parity — migration acceptance criteria

Source: `psbachelor/pmo_dashboard_gg_sheet`, branch `main`. The source contains 10 backend modules plus `AppJS.html` (~118 KB), `Styles.html`, and `Index.html`. Every feature must be verified against implementation, not merely documentation.

## Scope checklist

- [ ] Schema parity: all 17 GAS tables, including dynamic columns and original IDs.
- [ ] Secure password migration/reset strategy (GAS PBKDF2+pepper differs from PHP password_hash).
- [ ] Session management, role checks, membership visibility, PM/PIC write rules.
- [ ] Project CRUD, archive/restore/purge and attribute metadata.
- [ ] Task CRUD, hierarchy, task type, dependency, scheduling and member updates.
- [ ] Procedure templates, checklist import and calendar/workdays.
- [ ] Issues, assignments, workload and resource capacity.
- [ ] Portfolio dashboard, RAG, summaries and Gantt behavior.
- [ ] Audit log and validation of all writes.
- [ ] Existing frontend screens and spreadsheet-like inline task editing.
- [ ] Dry-run and validated import of exported Google Sheets data.
- [ ] Automated tests: permissions, date calculations, CRUD, hierarchy, imports, rollback.
- [ ] Security review: CSRF, XSS, SQL injection, rate limiting, sessions and secrets.
- [ ] UAT deployment configuration; production deployment remains separate.

## Release gates

1. Match API inputs/outputs and edge cases to GAS.
2. Run automated tests with representative anonymized fixtures.
3. Verify counts, IDs, relationships and sample records after import.
4. Merge only after evidence of parity. A code-only review does not constitute end-to-end testing.
5. No changes to GAS source or live Google Sheets.

## Known v0.1 gaps

Current `main` contains only a read-only PHP foundation and six core tables. It is **not** feature-complete. Real spreadsheet data is not available through GitHub source; obtain a controlled export before any actual import.
