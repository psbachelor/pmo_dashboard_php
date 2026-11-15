# GAS to PHP/MySQL migration

## Baseline

Source repository: `psbachelor/pmo_dashboard_gg_sheet` (`main`). Freeze the source commit SHA before translating behavior.

## Mapping (pending code-level verification)

| GAS | PHP target |
| --- | --- |
| Config.gs | config/, database/migrations/, routes/ |
| AuthService.gs | app/Services/AuthService.php, app/Middleware/ |
| DataService.gs | app/Core/Database.php, repositories |
| ProjectService.gs | app/Services/ProjectService.php |
| TaskService.gs | app/Services/TaskService.php |
| ProcedureService.gs | app/Services/ProcedureService.php |
| IssueService.gs | app/Services/IssueService.php |
| ResourceService.gs | app/Services/ResourceService.php |
| DashboardService.gs | app/Services/DashboardService.php |
| ProjectAttributes.gs | app/Services/ProjectAttributesService.php |
| Index.html, AppJS.html, Styles.html | resources/views/, public/assets/ |

## Gate before data migration

1. Inventory `SCHEMA`, IDs, date and boolean conventions, role matrix, audit fields.
2. Approve SQL schema and relationships.
3. Implement import with dry-run, validation, and rollback plan.
4. Test against sanitized sample data; never write to production Sheets.

Current status: repository foundation only, not a working application.
