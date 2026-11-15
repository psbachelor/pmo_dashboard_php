# Automated Test Report

Ngày chạy: **2026-11-15**. Baseline GAS **`c0e3db58a7d0522408c633dbb22403522e4ff8d3`**, HEAD remote xác nhận trước khi coding. Code kiểm thử pin bằng `docs/evidence/CODE_SHA256SUMS`; SHA commit phát hành được cung cấp cùng PR và kết quả cuối.

**Kết quả thực chạy: 250 ca/nhóm kiểm tra đạt, 0 fail; backend có 174 assertions.** PHP **8.3.36**, MySQL **8.0.46**, Chromium headless desktop 1440×1000 và mobile 390×844. Không có nhóm kiểm thử bắt buộc nào bị bỏ do thiếu PHP/MySQL.

| Nhóm | Kết quả | Bằng chứng |
|---|---:|---|
| PHP syntax | 22 file PASS | evidence/syntax.log |
| JavaScript syntax | PASS `node --check public/assets/app.js` | tests/run.sh |
| Unit/integration/auth/permissions/CRUD/task/scheduling/security/trace | 31 nhóm, 174 assertions, 0 fail | evidence/parity.log |
| Differential GAS unified | 71/71 | evidence/oracle.log |
| Differential GAS legacy | 68/68 | evidence/legacy-oracle.log |
| Database migration/import/rollback/CSV/seed | 39/39 | evidence/migration.log |
| Concurrency, retry sau lock, read snapshot, bảo toàn ghi chú khi di chuyển cây | 4/4 | evidence/concurrency.log |
| HTTP API/session/CSRF/schema/validation | 16/16 | evidence/api.log |
| Browser thao tác nghiệp vụ | 18/18 | evidence/browser.log |
| Browser XSS: stored HTML, hostile inline ID, handler execution | 3/3 | evidence/security.log |
| Schema từ DB trắng, chạy migration lại, seed/bootstrap, export/clean-pilot, validate sau browser | PASS | evidence/migrate.log, schema.log, bootstrap.log, export.log, clean-pilot.log, post-browser-schema.log |

Kết quả máy đọc được: [RESULTS.json](evidence/RESULTS.json). Screenshot đã đọc lại: [workspace](evidence/workspace.png), [mobile](evidence/mobile.png).

## Phạm vi xác minh

Bộ differential thực thi code GAS tại baseline bằng mock Sheets/Utilities/LockService cục bộ trên dữ liệu tổng hợp, sau đó chạy các request tương ứng trên PHP và **MySQL thật** trong container cô lập. Clock và bộ sinh ID được inject riêng trong test để so sánh toàn bộ payload/version/relationships, không che khác biệt business. Có dữ liệu ID và giá trị chuỗi `"0"`, parent `"0"`, ID `"0 "` khác biệt và inactive PIC, template/document `"0"` để xác minh không bị PHP coi thành rỗng. Fixture và generator có trong tests/fixtures (gzip lossless) và tools/generate-gas-oracle.cjs. Đây không phải kiểm thử trên dịch vụ Google thật.

Unit/integration kiểm tra Admin/Executive/PM/PIC/outsider, active/temporary password/expiry/revoke/throttle, provision/reset, whitelist trường, archived visibility/edit guards, project/attribute/member CRUD, batch partial outcomes/stable IDs/conflict/replay/tmp IDs, hierarchy depth/cycle/phase/milestone/dependency, tất cả lệnh cấu trúc, recovery PREPARED/read-view/fence/resume/rollback/structured errors, working days/makeup days và workload ngày/tuần. Có kiểm tra không tự đồng bộ RAG/status, thành viên với PIC/assignment và capacity với công thức workload.

Migration test tạo DB mới, đối chiếu fingerprint mọi cell/ID/reference/thứ tự sau import/export, template có ID/Step_No lặp, legacy conversion/warnings, malformed CSV/BOM/quoted multiline, broken reference, constraint violation, lỗi insert giữa chừng và rollback cả 17 bảng. Retry journal hoàn tất không áp lại dữ liệu cũ. Hai PDO connections kiểm tra write fence/lock timeout/retry và snapshot đọc nhất quán. Một PDO statement interceptor tạo cập nhật ghi chú từ kết nối khác ngay giữa read/structural write: ghi chú phải được giữ, và structural operation phải báo integrity conflict/rollback. Writer chỉ UPDATE Parent_Task_ID/Sort_Order, không ghi lại các trường nghiệp vụ khác. Clean-pilot → seed được kiểm tra bảo toàn directory/accounts/calendar/templates và chặn seed lần hai.

Browser kiểm tra login, search/routing, thêm task bằng Enter/autosave, inline edit/Escape, +25/custom progress, timeline click/Shift-click/milestone, PIC/parent search, outdent, membership delta, checklist/issue forms, Gantt/workload day/week, project create/edit/template/import/assignment, My Tasks update, Issue Register, archive/restore/purge dialogs, account provisioning, mobile/forced-password, hai tab đăng nhập hai actor riêng/logout độc lập và không có uncaught frontend error. Security kiểm tra prepared SQL, CSRF, HttpOnly/SameSite, cookie đơn lẻ không chọn actor và token từ PHP session khác bị từ chối, server-side authorization, schema gate, helper API whitelist và XSS trong browser.

## Tái lập

```sh
npm ci
# Dùng Chromium hệ thống hoặc cài với npx playwright install --with-deps chromium
CHROMIUM_PATH=/usr/bin/chromium bash tests/run.sh
```

Có Docker và Node 22+. Runner tạo private network/container/DB riêng, dùng tài khoản và dữ liệu tổng hợp, chỉ mở web test trên localhost; trap dọn containers/volumes/network của chính suite. Có thể chọn DOCKER_SOCKET và PMO_TEST_PORT. Log/screenshot mới ở tests/artifacts, không commit credentials hoặc export thật. GitHub Actions chạy cùng runner, không có bước deploy.

## Chưa kiểm thử / giới hạn

- Chưa deploy hoặc UAT trên shared hosting/cPanel thực tế, chưa kiểm tra TLS/cookie Secure trên hostname hosting thật.
- Chưa dùng export dự án thật, không truy cập Google Sheets hoặc runtime GAS thật. Người dùng không cần dữ liệu thật để chạy UAT mẫu.
- Chưa load-test tải production lớn hoặc kiểm tra mọi nhánh/input tổ hợp. 266 hàm đã inventory/mapping không đồng nghĩa 100% line/branch coverage.
- Foundation schema v0.1 không nâng cấp tại chỗ; cần DB mới và export/import có validation. DDL MySQL tự commit, không được ghi là rollback DDL PASS.

Các giới hạn trên được ghi rõ, không chuyển thành kết quả PASS. Toàn bộ nhóm test bắt buộc đã chạy trên PHP/MySQL đúng phiên bản; không có tính năng GAS nào bị loại khỏi inventory để làm test đạt.
