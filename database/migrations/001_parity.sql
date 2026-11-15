-- Fresh PHP/MySQL 8 schema. String flags, blank values and source IDs retain GAS semantics.

CREATE TABLE IF NOT EXISTS `project_groups` (
 `_seq` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
 `Group_ID` VARCHAR(128) NOT NULL,
 `Group_Name` LONGTEXT NULL,
 `Region` LONGTEXT NULL,
 `Owner_ID` LONGTEXT NULL,
 `Description` LONGTEXT NULL,
 PRIMARY KEY (`Group_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE IF NOT EXISTS `phases` (
 `_seq` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
 `Phase_ID` VARCHAR(128) NOT NULL,
 `Project_ID` VARCHAR(128) NULL,
 `Phase_Name` LONGTEXT NULL,
 `Phase_Order` LONGTEXT NULL,
 `Start_Date` LONGTEXT NULL,
 `End_Date` LONGTEXT NULL,
 `Status` VARCHAR(128) NULL,
 `RAG` VARCHAR(128) NULL,
 `Template_ID` LONGTEXT NULL,
 PRIMARY KEY (`Phase_ID`),
 INDEX `idx_project_id` (`Project_ID`),
 INDEX `idx_status` (`Status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE IF NOT EXISTS `procedure_templates` (
 `_seq` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
 `Template_ID` VARCHAR(128) NOT NULL,
 `Template_Name` LONGTEXT NULL,
 `Step_No` VARCHAR(128) NULL,
 `Task_Name` LONGTEXT NULL,
 `Duration_Days` LONGTEXT NULL,
 `Required_Document` LONGTEXT NULL,
 `Responsible_Role` LONGTEXT NULL,
 PRIMARY KEY (`_seq`),
 INDEX idx_template_step (`Template_ID`,`Step_No`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE IF NOT EXISTS `checklist_items` (
 `_seq` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
 `Item_ID` VARCHAR(128) NOT NULL,
 `Project_ID` VARCHAR(128) NULL,
 `Phase_ID` VARCHAR(128) NULL,
 `Task_ID` VARCHAR(128) NULL,
 `Item_Name` LONGTEXT NULL,
 `Required` LONGTEXT NULL,
 `Status` VARCHAR(128) NULL,
 `Due_Date` LONGTEXT NULL,
 `Owner_ID` LONGTEXT NULL,
 `Evidence_URL` LONGTEXT NULL,
 `Notes` LONGTEXT NULL,
 `Last_Updated` LONGTEXT NULL,
 PRIMARY KEY (`Item_ID`),
 INDEX `idx_project_id` (`Project_ID`),
 INDEX `idx_task_id` (`Task_ID`),
 INDEX `idx_status` (`Status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE IF NOT EXISTS `projects` (
 `_seq` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
 `Project_ID` VARCHAR(128) NOT NULL,
 `Project_Name` LONGTEXT NULL,
 `Project_Type` LONGTEXT NULL,
 `Department` LONGTEXT NULL,
 `Sponsor` LONGTEXT NULL,
 `PM_ID` LONGTEXT NULL,
 `Objective` LONGTEXT NULL,
 `Start_Date` LONGTEXT NULL,
 `End_Date` LONGTEXT NULL,
 `Status` VARCHAR(128) NULL,
 `RAG` VARCHAR(128) NULL,
 `Health_Summary` LONGTEXT NULL,
 `Last_Updated` LONGTEXT NULL,
 `Group_ID` LONGTEXT NULL,
 PRIMARY KEY (`Project_ID`),
 INDEX `idx_status` (`Status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE IF NOT EXISTS `tasks` (
 `_seq` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
 `Task_ID` VARCHAR(128) NOT NULL,
 `Project_ID` VARCHAR(128) NULL,
 `Parent_Task_ID` VARCHAR(128) NULL,
 `Task_Name` LONGTEXT NULL,
 `Task_Type` LONGTEXT NULL,
 `PIC_ID` VARCHAR(128) NULL,
 `Start_Date` LONGTEXT NULL,
 `End_Date` LONGTEXT NULL,
 `Progress` LONGTEXT NULL,
 `Status` VARCHAR(128) NULL,
 `RAG` VARCHAR(128) NULL,
 `Dependency_ID` VARCHAR(128) NULL,
 `Description` LONGTEXT NULL,
 `Phase_ID` VARCHAR(128) NULL,
 `Member_Update` LONGTEXT NULL,
 `Member_Updated_At` LONGTEXT NULL,
 `Sort_Order` LONGTEXT NULL,
 PRIMARY KEY (`Task_ID`),
 INDEX `idx_project_id` (`Project_ID`),
 INDEX `idx_pic_id` (`PIC_ID`),
 INDEX `idx_status` (`Status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE IF NOT EXISTS `assignments` (
 `_seq` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
 `Assignment_ID` VARCHAR(128) NOT NULL,
 `Task_ID` VARCHAR(128) NULL,
 `User_ID` VARCHAR(128) NULL,
 `Start_Date` LONGTEXT NULL,
 `End_Date` LONGTEXT NULL,
 `Allocation_Pct` LONGTEXT NULL,
 `Planned_Effort_Days` LONGTEXT NULL,
 `Role` LONGTEXT NULL,
 PRIMARY KEY (`Assignment_ID`),
 INDEX `idx_task_id` (`Task_ID`),
 INDEX `idx_user_id` (`User_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE IF NOT EXISTS `issues` (
 `_seq` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
 `Issue_ID` VARCHAR(128) NOT NULL,
 `Project_ID` VARCHAR(128) NULL,
 `Task_ID` VARCHAR(128) NULL,
 `Title` LONGTEXT NULL,
 `Description` LONGTEXT NULL,
 `Severity` LONGTEXT NULL,
 `Impact` LONGTEXT NULL,
 `Owner_ID` LONGTEXT NULL,
 `Open_Date` LONGTEXT NULL,
 `Due_Date` LONGTEXT NULL,
 `Status` VARCHAR(128) NULL,
 `Resolution_Plan` LONGTEXT NULL,
 `Escalation_Level` LONGTEXT NULL,
 `Decision_Required` LONGTEXT NULL,
 `Last_Updated` LONGTEXT NULL,
 `Created_By` LONGTEXT NULL,
 PRIMARY KEY (`Issue_ID`),
 INDEX `idx_project_id` (`Project_ID`),
 INDEX `idx_task_id` (`Task_ID`),
 INDEX `idx_status` (`Status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE IF NOT EXISTS `users` (
 `_seq` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
 `User_ID` VARCHAR(128) NOT NULL,
 `Email` LONGTEXT NULL,
 `Full_Name` LONGTEXT NULL,
 `Department` LONGTEXT NULL,
 `System_Role` LONGTEXT NULL,
 `Weekly_Capacity_Days` LONGTEXT NULL,
 `Active` LONGTEXT NULL,
 PRIMARY KEY (`User_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE IF NOT EXISTS `project_members` (
 `_seq` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
 `Member_ID` VARCHAR(128) NOT NULL,
 `Project_ID` VARCHAR(128) NULL,
 `User_ID` VARCHAR(128) NULL,
 `Project_Role` LONGTEXT NULL,
 PRIMARY KEY (`Member_ID`),
 INDEX `idx_project_id` (`Project_ID`),
 INDEX `idx_user_id` (`User_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE IF NOT EXISTS `calendar` (
 `_seq` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
 `Date` VARCHAR(128) NOT NULL,
 `Is_Working_Day` LONGTEXT NULL,
 `Note` LONGTEXT NULL,
 PRIMARY KEY (`Date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE IF NOT EXISTS `config` (
 `_seq` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
 `Key` VARCHAR(128) NOT NULL,
 `Value` LONGTEXT NULL,
 `Description` LONGTEXT NULL,
 PRIMARY KEY (`Key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE IF NOT EXISTS `auth_users` (
 `_seq` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
 `User_ID` VARCHAR(128) NOT NULL,
 `Username` VARCHAR(128) NULL,
 `Password_Salt` LONGTEXT NULL,
 `Password_Hash` LONGTEXT NULL,
 `Iterations` LONGTEXT NULL,
 `Active` LONGTEXT NULL,
 `Must_Change_Password` LONGTEXT NULL,
 `Created_At` LONGTEXT NULL,
 PRIMARY KEY (`User_ID`),
 UNIQUE KEY `uq_username` (`Username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE IF NOT EXISTS `auth_sessions` (
 `_seq` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
 `Session_ID` VARCHAR(128) NOT NULL,
 `User_ID` VARCHAR(128) NULL,
 `Token_Hash` VARCHAR(64) NULL,
 `Created_At` LONGTEXT NULL,
 `Expires_At` LONGTEXT NULL,
 `Revoked` LONGTEXT NULL,
 PRIMARY KEY (`Session_ID`),
 UNIQUE KEY `uq_token` (`Token_Hash`),
 INDEX `idx_user_id` (`User_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE IF NOT EXISTS `login_attempts` (
 `_seq` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
 `Attempt_ID` VARCHAR(128) NOT NULL,
 `Username` VARCHAR(128) NULL,
 `Timestamp` LONGTEXT NULL,
 `Success` LONGTEXT NULL,
 PRIMARY KEY (`Attempt_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE IF NOT EXISTS `project_attributes` (
 `_seq` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
 `Attribute_ID` VARCHAR(128) NOT NULL,
 `Project_ID` VARCHAR(128) NULL,
 `Field_Key` VARCHAR(128) NULL,
 `Field_Value` LONGTEXT NULL,
 `Updated_At` LONGTEXT NULL,
 PRIMARY KEY (`Attribute_ID`),
 UNIQUE KEY `uq_attribute` (`Project_ID`,`Field_Key`),
 INDEX `idx_project_id` (`Project_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE IF NOT EXISTS `audit_log` (
 `_seq` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
 `Audit_ID` VARCHAR(128) NOT NULL,
 `Timestamp` LONGTEXT NULL,
 `Actor_Email` LONGTEXT NULL,
 `Entity` LONGTEXT NULL,
 `Entity_ID` LONGTEXT NULL,
 `Action` LONGTEXT NULL,
 `Before_JSON` LONGTEXT NULL,
 `After_JSON` LONGTEXT NULL,
 PRIMARY KEY (`Audit_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

ALTER TABLE `project_members` ADD CONSTRAINT `fk_project_members_project_id` FOREIGN KEY (`Project_ID`) REFERENCES `projects` (`Project_ID`);

ALTER TABLE `project_members` ADD CONSTRAINT `fk_project_members_user_id` FOREIGN KEY (`User_ID`) REFERENCES `users` (`User_ID`);

ALTER TABLE `tasks` ADD CONSTRAINT `fk_tasks_project_id` FOREIGN KEY (`Project_ID`) REFERENCES `projects` (`Project_ID`);

ALTER TABLE `tasks` ADD CONSTRAINT `fk_tasks_parent_task_id` FOREIGN KEY (`Parent_Task_ID`) REFERENCES `tasks` (`Task_ID`);

ALTER TABLE `tasks` ADD CONSTRAINT `fk_tasks_dependency_id` FOREIGN KEY (`Dependency_ID`) REFERENCES `tasks` (`Task_ID`);

ALTER TABLE `phases` ADD CONSTRAINT `fk_phases_project_id` FOREIGN KEY (`Project_ID`) REFERENCES `projects` (`Project_ID`);

ALTER TABLE `assignments` ADD CONSTRAINT `fk_assignments_task_id` FOREIGN KEY (`Task_ID`) REFERENCES `tasks` (`Task_ID`);

ALTER TABLE `assignments` ADD CONSTRAINT `fk_assignments_user_id` FOREIGN KEY (`User_ID`) REFERENCES `users` (`User_ID`);

ALTER TABLE `checklist_items` ADD CONSTRAINT `fk_checklist_items_project_id` FOREIGN KEY (`Project_ID`) REFERENCES `projects` (`Project_ID`);

ALTER TABLE `checklist_items` ADD CONSTRAINT `fk_checklist_items_task_id` FOREIGN KEY (`Task_ID`) REFERENCES `tasks` (`Task_ID`);

ALTER TABLE `checklist_items` ADD CONSTRAINT `fk_checklist_items_phase_id` FOREIGN KEY (`Phase_ID`) REFERENCES `phases` (`Phase_ID`);

ALTER TABLE `issues` ADD CONSTRAINT `fk_issues_project_id` FOREIGN KEY (`Project_ID`) REFERENCES `projects` (`Project_ID`);

ALTER TABLE `issues` ADD CONSTRAINT `fk_issues_task_id` FOREIGN KEY (`Task_ID`) REFERENCES `tasks` (`Task_ID`);

ALTER TABLE `auth_users` ADD CONSTRAINT `fk_auth_users_user_id` FOREIGN KEY (`User_ID`) REFERENCES `users` (`User_ID`);

ALTER TABLE `auth_sessions` ADD CONSTRAINT `fk_auth_sessions_user_id` FOREIGN KEY (`User_ID`) REFERENCES `users` (`User_ID`);

ALTER TABLE `project_attributes` ADD CONSTRAINT `fk_project_attributes_project_id` FOREIGN KEY (`Project_ID`) REFERENCES `projects` (`Project_ID`);

CREATE TABLE IF NOT EXISTS pmo_lock (id INT PRIMARY KEY);
INSERT IGNORE INTO pmo_lock VALUES (1);

-- Query indexes for session lookups, throttling and audit history.
CREATE INDEX idx_login_window ON login_attempts (Username, Timestamp(24));
CREATE INDEX idx_session_expiry ON auth_sessions (Expires_At(24));
CREATE INDEX idx_audit_entity ON audit_log (Entity(80), Entity_ID(80));
ALTER TABLE users ADD CONSTRAINT chk_system_role CHECK (System_Role IN ('PMO_ADMIN','EXECUTIVE','PM','PIC'));
ALTER TABLE tasks ADD CONSTRAINT chk_task_type CHECK (Task_Type IN ('Task','Summary','Milestone','PHASE','TASK','MILESTONE'));

CREATE TABLE IF NOT EXISTS import_runs (
 fingerprint CHAR(64) PRIMARY KEY,
 result_json JSON NOT NULL,
 completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

ALTER TABLE tasks ADD CONSTRAINT fk_tasks_phase_id FOREIGN KEY (Phase_ID) REFERENCES phases (Phase_ID);
