# Release notes — GAS → PHP/MySQL migration

Baseline GAS: `c0e3db58a7d0522408c633dbb22403522e4ff8d3`. Không tự nâng số phiên bản sản phẩm. Source GAS, workbook và Google Sheets đang chạy không bị sửa/truy cập.

Backend PHP 8.3/MySQL 8 thay phần Apps Script/Sheets, giữ contract dữ liệu, roles và business rules theo inventory. Hỗ trợ legacy và unified task, batch independent outcomes, stable create IDs, optimistic conflict, cấu trúc cây có journal/recovery, thủ tục/checklist, issue/escalation, phân bổ/workload, dashboard, portfolio, metadata và membership. Mọi bảng GAS đều có SQL mapping; IDs/relationships/blank values/string flags và thứ tự nguồn được giữ khi import. Template có thể có nhiều dòng cùng Template_ID, kể cả Step_No trùng.

Frontend giữ cấu trúc Index, Styles và các hàm AppJS; thao tác task vẫn là spreadsheet: thêm liên tục bằng Enter, inline edit/autosave, trạng thái từng dòng, retry/compare, PIC/parent search, tiến độ nhanh, Gantt/timeline, thao tác cấu trúc và keyboard shortcuts. Gọi `google.script.run` được thay bằng POST RPC PHP với cookie session/CSRF. Quoting argument JavaScript nội tuyến được sửa để ID chứa dấu nháy vẫn chỉ là dữ liệu. Sửa điều hướng sau lưu Project và archive/restore/purge để workspace không bị giữ ở màn hình loading; không thay đổi trạng thái hay quyền nghiệp vụ.

Giữ các quy tắc thực tế dễ nhầm: restore → On Hold; Executive chỉ xem active portfolio; scope PM/PIC gồm membership/PIC/assignment/checklist; không tự đồng bộ PIC với assignment, progress với status/RAG; PHASE không có tiến độ thực thi; weekly workload luôn bỏ cuối tuần trong khi daily/template có dùng ngày làm bù; capacity được lưu nhưng không đưa vào công thức phần trăm; dependency được lưu/kiểm tra cùng dự án, không tự dịch lịch.

Các thay đổi theo nền tảng: native PHP PBKDF2 vẫn tương thích GAS pepper/salt/hash; phiên PHP dùng HttpOnly cookie, không nhận bearer token do client tự đưa; InnoDB snapshot/row lock/savepoint thay Sheets epoch/LockService. Structure/procedure/import atomic, journal hỗ trợ retry terminal mà không đè dữ liệu sau commit. Công cụ editor/Drive copy/Sheets migration chuyển thành CLI export/import/clean-pilot, chỉ làm việc với file export và MySQL; không có kết nối Google thật. Helpers được gộp hoặc thay bằng primitive PHP, không giữ tên hàm giả.

Kèm migration/seed/bootstrap, import dry-run/validation/error report/fingerprint/rollback strategy, trace aggregate không chứa payload, CI và suite test tái lập. Xem AUTOMATED_TEST_REPORT.md cho kết quả thực chạy và hạn chế.

Giới hạn triển khai: chưa deploy hoặc UAT trên hosting thật; chưa kiểm thử với export dự án thật, Google runtime thật hoặc tải production lớn. Schema foundation v0.1 cần export/chuẩn hóa rồi nhập vào DB mới, không nâng cấp tại chỗ. DDL MySQL không rollback tự động; runner chỉ ghi marker khi hoàn tất. Các giới hạn này không được ghi thành PASS.
