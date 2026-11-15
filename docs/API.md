# API inventory

29 browser RPC operations giữ tên GAS. Endpoint `POST index.php?rpc=1`, JSON `{method,args}`, headers `X-CSRF-Token` và `X-PMO-Token`, cookie PHP session. Mỗi tab gửi opaque token của chính tab như sessionStorage GAS; server kiểm tra token đã được phát hành trong PHP session này và còn active trong MySQL. Client không cấp actor/role; token tự đưa từ PHP session khác không được chấp nhận. Các write nghiệp vụ vẫn có `clientSchema` là argument cuối cùng như AppJS gốc. `ControlTower::call` có whitelist tường minh; helper và CLI không gọi được qua HTTP.

| Operation | GAS arguments | Permission / guard | GAS source | PHP target | Test suites |
|---|---|---|---|---|---|
| `login` | `username,password` | Anonymous; throttle 5 failures/15 minutes | `src/AuthService.gs` | `app/Parity/Auth.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `getBootstrap` | `token` | Active account; temporary password allowed | `src/AuthService.gs` | `app/Parity/ControlTower.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `getInitialData` | `token` | Active account; temporary gets bootstrap only | `src/DashboardService.gs` | `app/Parity/ControlTower.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `getProjects` | `token` | Active account; project visibility scope checked at backend | `src/ProjectService.gs` | `app/Parity/ControlTower.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `getProjectDetail` | `token,projectId` | Active account; project visibility scope checked at backend | `src/ProjectService.gs` | `app/Parity/ControlTower.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `getPortfolioData` | `token` | Active account; project visibility scope checked at backend | `src/DashboardService.gs` | `app/Parity/ControlTower.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `getDashboard` | `token` | Active account; project visibility scope checked at backend | `src/DashboardService.gs` | `app/Parity/ControlTower.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `getProjectAttributes` | `token,projectId` | Active account; project visibility scope checked at backend | `src/ProjectAttributes.gs` | `app/Parity/ControlTower.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `getProjectMemberSettings` | `token,projectId` | Project planner | `src/ProjectMemberService.gs` | `app/Parity/ControlTower.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `getWorkload` | `token,startDate,weekCount` | Active account; project visibility scope checked at backend | `src/ResourceService.gs` | `app/Parity/ControlTower.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `getDailyWorkload` | `token,startDate,dayCount` | Active account; project visibility scope checked at backend | `src/ResourceService.gs` | `app/Parity/ControlTower.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `getWorkspaceCompatibilityReport` | `token,projectId` | Project planner; read-only | `src/TaskBatchService.gs` | `app/Parity/ControlTower.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `logout` | `token` | Own valid session; temporary password allowed | `src/AuthService.gs` | `app/Parity/Auth.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `changePassword` | `token,oldPassword,newPassword` | Own account; old password required; temporary allowed | `src/AuthService.gs` | `app/Parity/Auth.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `adminProvisionUser` | `token,userId,username,newPassword` | PMO_ADMIN; active existing USERS row | `src/AuthService.gs` | `app/Parity/Auth.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `saveProject` | `token,payload,clientSchema` | PMO_ADMIN creates; project planner updates | `src/ProjectService.gs` | `app/Parity/ControlTower.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `setProjectArchived` | `token,projectId,archived,clientSchema` | PMO_ADMIN | `src/ProjectService.gs` | `app/Parity/ControlTower.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `purgeArchivedProject` | `token,projectId,confirmation,clientSchema` | PMO_ADMIN; Archived and PURGE:<id> | `src/ProjectService.gs` | `app/Parity/ControlTower.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `saveTask` | `token,payload,clientSchema` | Project planner | `src/TaskService.gs` | `app/Parity/ControlTower.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `updateMyTask` | `token,taskId,progress,status,note,clientSchema` | Project planner or assigned PM/PIC; execution fields only | `src/TaskService.gs` | `app/Parity/ControlTower.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `saveTaskBatch` | `token,projectId,operations,clientSchema` | Project planner or assigned PM/PIC; field whitelist | `src/TaskBatchService.gs` | `app/Parity/ControlTower.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `changeTaskStructure` | `token,projectId,command,clientSchema` | Project planner; UNIFIED_TASKS_V2 | `src/TaskStructureService.gs` | `app/Parity/Structure.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `recoverTaskStructure` | `token,projectId,opId,decision,clientSchema` | Project planner; actor of journal or PMO_ADMIN | `src/TaskStructureService.gs` | `app/Parity/Structure.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `applyProcedureTemplate` | `token,projectId,templateId,phaseName,startDate,clientSchema` | Project planner | `src/ProcedureService.gs` | `app/Parity/ControlTower.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `saveChecklistItem` | `token,payload,clientSchema` | Project planner or authorized checklist/task member | `src/ProcedureService.gs` | `app/Parity/ControlTower.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `saveIssue` | `token,payload,clientSchema` | Project planner; scoped member creates self-owned and updates own execution fields | `src/IssueService.gs` | `app/Parity/ControlTower.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `saveAssignment` | `token,payload,clientSchema` | Project planner; execution task only | `src/ResourceService.gs` | `app/Parity/ControlTower.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `saveProjectAttribute` | `token,projectId,key,value,clientSchema` | Project planner | `src/ProjectAttributes.gs` | `app/Parity/ControlTower.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |
| `saveProjectMembers` | `token,projectId,payload,clientSchema` | Project planner; guarded membership delta | `src/ProjectMemberService.gs` | `app/Parity/ControlTower.php` | `tests/parity.php`, `tests/oracle.php`, `tests/api.cjs`, `tests/browser.cjs` |

Đọc/ghi task trả task + version; batch trả kết quả từng op, cùng stable ID và version; conflict giữ bản nháp. Structure/recovery giữ structured `{ok:false,code,error}` cho lỗi validation/recovery, các lỗi auth/transport đi qua failure handler. Không dùng role/ownership từ request để cấp quyền.

Các entry point quản trị không còn phụ thuộc Google:

| GAS operation | PHP equivalent | Tests |
|---|---|---|
| doGet/include | public/index.php + static assets | tests/api.cjs, tests/browser.cjs |
| validateSetup | scripts/validate.php | tests/run.sh schema checks |
| bootstrapAdmin_ | scripts/create_admin.php | tests/run.sh + tests/api.cjs temporary flow |
| createCleanUnifiedPilotDatabase | scripts/clean_pilot.php, creates new offline copy | tests/run.sh export/clean + tests/migration.php |
| seedStageBDemoData | scripts/seed.php, Seeder::seed | tests/migration.php + fresh seed/browser |
| getUnifiedMigrationDryRun | scripts/import.php (default dry-run, optional --unify) | tests/migration.php + CLI dry-run |
| applyUnifiedMigration / applyPilotUnifiedMigration | scripts/import.php --apply --expect (fresh MySQL target, atomic journal) | tests/migration.php rollback/retry/reference/ID checks |

Spreadsheet/backup IDs, Drive cloning và budget GAS được thay bằng file export, target database riêng và transaction CLI. Không có endpoint HTTP ghi Google hoặc endpoint bảo trì không xác thực. Xem MIGRATION.md để đối chiếu các ranh giới adapter.
