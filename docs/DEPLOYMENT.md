# Deploy shared hosting PHP 8.3 / MySQL 8

Hướng dẫn này để người triển khai thực hiện sau khi nhận source. Công việc migration không deploy hosting.

## Chuẩn bị

- Chọn PHP **8.3**, bật PDO và `pdo_mysql`; MySQL **8.0.17+** (có collation `utf8mb4_0900_bin`, NO PAD), InnoDB, UTF-8 (`utf8mb4`). PHP cần các hàm crypto/hash/random_bytes, JSON, session; không cần Composer, Node, daemon hay cron.
- Tạo database/user riêng cho UAT; user migration cần CREATE/ALTER/INDEX, user chạy app cần SELECT/INSERT/UPDATE/DELETE. Sau migration, có thể thu hồi quyền DDL của tài khoản web.
- Bật HTTPS bằng cấu hình hosting. Không tin `X-Forwarded-Proto` từ client; nếu dùng proxy, hosting phải cấu hình HTTPS ở PHP đúng.
- Upload `app/`, `database/`, `resources/`, `scripts/`, `public/`; bỏ `.git`, `.env.example`, tests, Dockerfile/node_modules khỏi thư mục public. Document root của domain/subdomain phải trỏ **chỉ vào `public/`**. Trong cPanel, dùng subdomain document root hoặc chỉnh đường dẫn domain; không chuyển `.env`/app vào thư mục công khai.
- Nếu domain có sẵn `public_html`, đặt code ở thư mục cha, và dùng document root `.../pmo/public`. Không để root repository làm document root. Các URL RPC là `index.php?rpc=1`, nên không cần rewrite hay URL routing đặc biệt; subdirectory cũng dùng được.

## Cấu hình và khởi tạo

Đặt `.env` ở root repository, cùng cấp `app/`, không trong `public/`. Quyền file 0600/0640 theo tài khoản hosting; không commit. Các biến: DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD, AUTH_PEPPER. Tạo pepper một lần với `php -r 'echo bin2hex(random_bytes(32));'` và giữ bản backup bảo mật. Khi import GAS credentials cần pepper GAS tương ứng, nhập qua cơ chế bí mật của hosting, không gửi qua chat.

Từ terminal hosting, chọn binary PHP 8.3 đúng bản web (cPanel có thể là `/opt/cpanel/ea-php83/root/usr/bin/php`):

```sh
php scripts/migrate.php
php scripts/seed.php
php scripts/create_admin.php
php scripts/validate.php
```

Trước `create_admin.php`, cấu hình BOOTSTRAP_ADMIN_USER_ID, BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_PASSWORD và tùy chọn BOOTSTRAP_ADMIN_EMAIL. Seed có user ADMIN mẫu; dùng ID ADMIN hoặc một user PMO_ADMIN active phù hợp. Mật khẩu 8–128 ký tự theo quy tắc GAS. Script từ chối bootstrap nếu AUTH_USERS đã có tài khoản. Đăng nhập lần đầu bắt buộc đổi mật khẩu; đổi xong cần đăng nhập lại, mọi phiên cũ đã bị thu hồi. Gỡ biến mật khẩu bootstrap ngay sau tạo.

Nếu không cần dữ liệu mẫu, bỏ seed; bootstrap tạo user admin đầu tiên và marker unified. Nếu import export, chạy import **trước** bootstrap/seed; giữ tài khoản import nếu có, không bootstrap trùng. Provision/reset người dùng hiện có trong USERS qua màn hình Accounts. Không có mật khẩu admin cố định đi kèm source.

Nếu hosting không có SSH/CLI, chạy initialization bằng PHP 8.3 CLI từ máy quản trị kết nối database qua kênh được hosting cho phép hoặc nhờ công cụ terminal của nhà cung cấp. Không tạo endpoint HTTP để chạy migration/seed/bootstrap; scripts từ chối chạy ngoài CLI. Chưa kiểm thử cPanel cụ thể; không thể xác nhận quyền/quota của từng hosting thay người triển khai.

## UAT và cấu hình vận hành

Mở domain qua HTTPS, đăng nhập, đổi mật khẩu, mở một dự án mẫu để kiểm tra thao tác cuối cùng trên hosting. Test tự động đã chạy toàn bộ tại môi trường cô lập; UAT này xác nhận môi trường triển khai và dữ liệu cuối cùng, không thay cho test từng module.

PHP session storage phải riêng và writable cho tài khoản web; dùng cookie HttpOnly, SameSite=Strict, Secure khi HTTPS. Phiên có hạn tối đa 8 giờ và được kiểm tra trong MySQL mỗi request. Không chia sẻ session directory giữa UAT và production; dùng hostname riêng. Tắt display_errors, giữ error_log ở ngoài public, không bật trace trừ khi cần số liệu vận hành. Trace chỉ ghi tên operation/count/time, không ghi payload/token.

Không mở CORS hoặc thêm auth theo email. App đọc quyền từ USERS/PROJECT_MEMBERS/TASKS/ASSIGNMENTS/CHECKLIST_ITEMS ở backend mỗi request. Archived chỉ Admin đọc, mọi vai trò bị chặn ghi; restore về On Hold; purge cần xác nhận `PURGE:<Project_ID>` và giữ AUDIT_LOG.

## Backup, nâng cấp và rollback

Trước chuyển database/config, dùng `php scripts/export.php /private/path/pmo-backup.json` và backup MySQL bằng công cụ hosting; file chứa hashes/session records, giữ ngoài web và hạn chế quyền. Export đọc snapshot nhất quán. Kiểm tra backup bằng dry-run import.

UAT và production dùng database khác nhau. Migration hiện tại yêu cầu DB mới, không ALTER tự động schema foundation v0.1. Giữ database/config cũ; tạo schema mới, dry-run/import, kiểm tra IDs/counts/schema, rồi đổi cấu hình ứng dụng trong cửa sổ bảo trì. Nếu cần rollback, đổi cấu hình về DB cũ hoặc restore backup vào một DB mới khác. Không xóa DB cũ cho đến khi chấp nhận UAT; nếu đã phát sinh cập nhật sau cutover, export giữ bản đó trước rollback. DDL MySQL tự commit: lỗi khi khởi tạo phải được kiểm tra, không được giả định DDL tự rollback.

Không có bước deploy GAS hoặc ghi Google Sheets.
