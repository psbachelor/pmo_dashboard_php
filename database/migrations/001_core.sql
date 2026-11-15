-- VCX PMO v0.1: core tables. Legacy IDs preserved as strings.
-- Run against a dedicated empty MySQL 8 database. Do not run on production GAS.
CREATE TABLE IF NOT EXISTS users (
 User_ID VARCHAR(80) PRIMARY KEY, Email VARCHAR(255), Full_Name VARCHAR(255) NOT NULL,
 Department VARCHAR(255), System_Role ENUM('PMO_ADMIN','EXECUTIVE','PM','PIC') NOT NULL,
 Weekly_Capacity_Days DECIMAL(6,2), Active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS auth_users (
 User_ID VARCHAR(80) PRIMARY KEY, Username VARCHAR(120) NOT NULL UNIQUE,
 Password_Hash VARCHAR(255) NOT NULL, Active TINYINT(1) NOT NULL DEFAULT 1,
 Must_Change_Password TINYINT(1) NOT NULL DEFAULT 1,
 Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (User_ID) REFERENCES users(User_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS projects (
 Project_ID VARCHAR(80) PRIMARY KEY, Project_Name VARCHAR(255) NOT NULL,
 Project_Type VARCHAR(120), Department VARCHAR(255), Sponsor VARCHAR(255),
 PM_ID VARCHAR(80), Objective TEXT, Start_Date DATE, End_Date DATE,
 Status VARCHAR(50), RAG VARCHAR(20), Health_Summary TEXT,
 Last_Updated DATETIME NULL, Group_ID VARCHAR(80),
 INDEX idx_project_pm(PM_ID), INDEX idx_project_status(Status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS project_members (
 Member_ID VARCHAR(80) PRIMARY KEY, Project_ID VARCHAR(80) NOT NULL,
 User_ID VARCHAR(80) NOT NULL, Project_Role VARCHAR(100),
 FOREIGN KEY(Project_ID) REFERENCES projects(Project_ID),
 FOREIGN KEY(User_ID) REFERENCES users(User_ID),
 UNIQUE KEY uq_project_user(Project_ID,User_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS tasks (
 Task_ID VARCHAR(80) PRIMARY KEY, Project_ID VARCHAR(80) NOT NULL,
 Parent_Task_ID VARCHAR(80), Task_Name VARCHAR(500) NOT NULL,
 Task_Type VARCHAR(40), PIC_ID VARCHAR(80), Start_Date DATE, End_Date DATE,
 Progress DECIMAL(5,2) DEFAULT 0, Status VARCHAR(50), RAG VARCHAR(20),
 Dependency_ID VARCHAR(80), Description TEXT, Phase_ID VARCHAR(80),
 Member_Update TEXT, Member_Updated_At DATETIME NULL,
 FOREIGN KEY(Project_ID) REFERENCES projects(Project_ID),
 FOREIGN KEY(Parent_Task_ID) REFERENCES tasks(Task_ID),
 INDEX idx_task_project(Project_ID), INDEX idx_task_pic(PIC_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS audit_log (
 Audit_ID VARCHAR(80) PRIMARY KEY, Timestamp DATETIME NOT NULL,
 Actor_Email VARCHAR(255), Entity VARCHAR(100), Entity_ID VARCHAR(80),
 Action VARCHAR(100), Before_JSON JSON, After_JSON JSON
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
