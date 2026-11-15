# Import Google Sheets export vào MySQL

Source baseline `c0e3db58a7d0522408c633dbb22403522e4ff8d3`; schema và hành vi được đối chiếu mã GAS. Công cụ chỉ đọc export trên đĩa; không kết nối Google Sheets đang chạy.

## Định dạng

Chọn JSON `{"schemaVersion":"LEGACY_V1|UNIFIED_TASKS_V2","tables":{"USERS":[...],...}}` hoặc thư mục chứa đủ 17 file `PROJECTS.csv`, `TASKS.csv`, ... đúng tên sheet/header trong `app/Parity/schema.json`. TASKS unified thêm Sort_Order cuối cùng. CSV UTF-8 hỗ trợ BOM, dấu phẩy, dấu ngoặc kép và newline. JSON dùng chuỗi cho mọi giá trị như `getDisplayValues()` của GAS; ID/date/boolean không được ép kiểu. Không có export thật vẫn chạy UAT bằng `scripts/seed.php`.

Giữ nguyên IDs, relationships, thứ tự dòng. Cần đủ bảng kể cả bảng rỗng; metadata `_row` được bỏ khi import. Không nhập công thức hoặc credentials vào log/report. Report lỗi chỉ có code/table/row/field, không lộ giá trị nhạy cảm.

```sh
php scripts/import.php --input=/private/export-directory --report=/private/dry-run.json
php scripts/import.php --input=/private/export-directory --apply --expect=TARGET_FINGERPRINT
```

Dry-run là mặc định và không kết nối DB. Copy chính xác `targetFingerprint` vào `--expect`; công cụ đọc/validate lại export khi apply. Apply chỉ nhận database có schema mới và bảng nghiệp vụ rỗng. Có transaction cho cả import; lỗi giữa chừng rollback tất cả. Một journal `import_runs` được commit cùng import; retry cùng fingerprint đã hoàn tất trả kết quả terminal và `writes:0`, không áp dữ liệu cũ đè các thay đổi sau UAT. Fingerprint khác vào DB có dữ liệu bị từ chối. Không ghi đè hoặc xóa dữ liệu tự động.

Các kiểm tra: bảng/cột, ID duy nhất, template multi-step, attribute key, schema marker, ngày, flags, System_Role, loại task/progress/allocation, parent/depth/cycle, references project/task/phase/user/template, Sort_Order và HTTPS evidence. Các PIC/owner lịch sử có thể không còn trong USERS, giống GAS; không tự thêm membership hay sửa ID. Field rỗng giữ `''` qua API, quan hệ tùy chọn dùng NULL nội bộ SQL.

## Legacy → unified

Để giữ legacy, không truyền `--unify`. Frontend và backend hỗ trợ cả hai schema. Để chuyển rõ ràng:

```sh
php scripts/import.php --input=/private/legacy-export.json --unify --report=/private/unified-plan.json
php scripts/import.php --input=/private/legacy-export.json --unify --apply --expect=TARGET_FINGERPRINT
```

Plan có phaseMapping, source/target/plan fingerprints, lỗi và cảnh báo. PHASES vẫn giữ nguyên; thêm task `TSK-PHASE-<Phase_ID>` ở root; gắn root task legacy theo phase; giữ task con hiện có; Summary → TASK, Milestone → MILESTONE; Sort_Order theo thứ tự sibling nguồn với khoảng 1024. Không tự sửa vòng cây, cross-project reference, conflicting phase ancestry hoặc unsafe legacy task cells để import chạy qua. Summary rỗng, phase status/RAG lạ và phase order lạ được báo cáo để review, không tự thay dữ liệu gốc.

Sheets checkpoint/epoch/header fences được thay bằng InnoDB atomic import + fingerprint/journal; không có trạng thái SQL nửa schema được publish. Nếu bị ngắt trước commit, chạy lại nguyên export sau khi DB transaction rollback; nếu commit rồi nhưng mất phản hồi, cùng fingerprint sẽ nhận journal hoàn tất. Không cần budget theo số operation vì MySQL không chịu thời gian thực thi GAS.

## Accounts và pilot sạch

GAS PBKDF2-HMAC-SHA256 được giữ; cần AUTH_PEPPER gốc để xác thực hash import. PHP foundation `password_hash` cũng được nhận diện khi đã chuẩn hóa snapshot. Không chuyển secrets sang frontend hoặc audit. Session rows có thể giữ trong export để bảo toàn IDs nhưng browser PHP cần cookie login mới, không chấp nhận bearer token tùy ý từ client.

`php scripts/clean_pilot.php --input=/private/export.json --output=/private/clean-copy.json` tạo **file mới**, giữ USERS/AUTH_USERS/CALENDAR/PROCEDURE_TEMPLATES, xóa dữ liệu dự án/session/attempt/audit trong bản sao, bỏ maintenance journals và đặt schema unified. Cần active admin account. File đầu ra 0600; source không đổi. Import file vào DB mới, sau đó `php scripts/seed.php` tạo sample, giữ nguyên directory/accounts/calendar/templates. Nếu seed đã chạy hoặc có project data, script từ chối chạy lại.

## Rollback và đối chiếu

`php scripts/export.php /private/mysql-backup.json` xuất snapshot nhất quán để backup; `php scripts/validate.php` kiểm tra schema và toàn vẹn sau import. Migration tests đối chiếu toàn bộ cells/IDs/relationships/thứ tự qua fingerprint, inject lỗi insert để xác minh rollback/retry.

Rollback sau import: giữ DB cũ và backup trước cutover, đổi cấu hình trở lại hoặc restore export đã validate vào DB mới. Không ghi đè DB đang có. Xem [thiết kế database](DATABASE_DESIGN.md) và [deployment](DEPLOYMENT.md).
