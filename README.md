# VCX PMO Control Tower — PHP 8.3 / MySQL 8

Migration từ `psbachelor/pmo_dashboard_gg_sheet/main`, baseline **`c0e3db58a7d0522408c633dbb22403522e4ff8d3`** (HEAD remote đã kiểm tra ngày 2026-11-15).

Backend PHP, 17 bảng nghiệp vụ MySQL, phiên đăng nhập, phân quyền, dự án, task spreadsheet/batch/hierarchy, Gantt/timeline, thủ tục/checklist, issue/escalation, assignment/workload, dashboard, attributes, membership và công cụ migration offline. UI giữ thao tác spreadsheet từ AppJS/Index/Styles của GAS. Không cần Node hoặc Docker trên hosting.

## Bắt đầu UAT với dữ liệu mẫu

Yêu cầu PHP 8.3 CLI/web với PDO MySQL, MySQL 8.0.17+/InnoDB, HTTPS, database mới riêng cho UAT.

1. Copy `.env.example` thành `.env` bên ngoài document root và cấu hình database, `AUTH_PEPPER` ngẫu nhiên, thông tin bootstrap admin.
2. Chạy `php scripts/migrate.php`.
3. Chạy `php scripts/seed.php` để tạo 10 dự án/210 task mẫu.
4. Chạy `php scripts/create_admin.php`; gỡ biến mật khẩu bootstrap sau khi tạo.
5. Trỏ document root vào `public/`, mở ứng dụng, đăng nhập và đổi mật khẩu tạm.

Nếu dùng dữ liệu export, thay bước seed bằng dry-run/import theo [hướng dẫn migration](docs/MIGRATION.md). Không chạy seed trên database đã có dự án. Có thể seed sau clean-pilot trên database đã có USERS: giữ nguyên users/accounts/calendar/templates.

## Tài liệu và bằng chứng

- [Feature Parity Matrix](docs/FEATURE_PARITY_MATRIX.md): module và 266 hàm source, target, tables, tests, trạng thái.
- [Automated Test Report](docs/AUTOMATED_TEST_REPORT.md): phạm vi đã/chưa kiểm thử, lệnh tái lập.
- [Deployment Guide](docs/DEPLOYMENT.md): shared hosting, bootstrap, UAT và rollback.
- [Database Design](docs/DATABASE_DESIGN.md): schema, transaction, dữ liệu, constraints.
- [Release Notes](docs/RELEASE_NOTES.md): hành vi giữ nguyên và khác biệt nền tảng.

## Kiểm thử

`npm ci`, cài Chromium bằng Playwright hoặc dùng Chromium có sẵn, sau đó `bash tests/run.sh`. Cần Docker socket, Node 22+, PHP/MySQL chạy trong containers test. `CHROMIUM_PATH` chọn executable; `DOCKER_SOCKET` chọn socket. Runner tự tạo database/container riêng và dọn chúng khi kết thúc. Không gọi Google hoặc hosting. Log/screenshot nằm trong `tests/artifacts/`; bằng chứng bản đã kiểm tra nằm trong `docs/evidence/`.

Tất cả fixture chỉ là dữ liệu tổng hợp, email `example.invalid`; mật khẩu/token/pepper trong fixture chỉ dùng cho test, không dùng cho UAT/production.

`main`, `develop` và hosting dùng cấu hình/database riêng. Phát triển trên `feature/full-gas-parity`; PR về `develop`, sau đó PR về `main` khi đáp ứng release gates. Không có workflow deploy hosting.
