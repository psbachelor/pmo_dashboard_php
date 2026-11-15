# Migration acceptance checklist

Baseline `c0e3db58a7d0522408c633dbb22403522e4ff8d3`; không sửa repository GAS hoặc Google Sheets đang chạy.

- [x] Đọc 24 source files; inventory 266 named functions, API, screen, rules và permissions.
- [x] Feature Parity Matrix với target, tables, tests; không còn row Missing.
- [x] PHP backend, frontend spreadsheet, legacy/unified tasks và chức năng quản trị tương ứng.
- [x] 17 bảng GAS, MySQL migration/constraints/indexes, seed, bootstrap admin.
- [x] Import CSV/JSON, dry-run/validation/report/fingerprints, atomic rollback/retry strategy.
- [x] PHP syntax, unit, integration, API, authentication/authorization, database migration, CRUD, hierarchy/scheduling, import validation, security checks đã chạy đạt.
- [x] Tạo database từ đầu, chạy migration lại và bootstrap/password-change đã được kiểm thử.
- [x] Shared-hosting deployment guide, test report và release notes.
- Git workflow: PR/CI và promotion develop → main được xác nhận bằng trạng thái GitHub; xem các PR liên kết cùng bản bàn giao.

Chi tiết: FEATURE_PARITY_MATRIX.md, API.md, AUTOMATED_TEST_REPORT.md, DATABASE_DESIGN.md, DEPLOYMENT.md, MIGRATION.md và RELEASE_NOTES.md. Hosting UAT cuối cùng thuộc bước triển khai của người dùng; chưa deploy hosting.
