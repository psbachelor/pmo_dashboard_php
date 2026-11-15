-- Additional GAS schema tables. Staging migration: preserve textual dates/flags until validated conversion.
-- Schema inventory derived from Config.gs; apply after 001_core.sql.
CREATE TABLE IF NOT EXISTS `project_groups` (
  `Group_ID` VARCHAR(255) NOT NULL,
  `Group_Name` VARCHAR(255),
  `Region` VARCHAR(255),
  `Owner_ID` VARCHAR(255),
  `Description` TEXT,
  PRIMARY KEY (`Group_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `phases` (
  `Phase_ID` VARCHAR(255) NOT NULL,
  `Project_ID` VARCHAR(255),
  `Phase_Name` VARCHAR(255),
  `Phase_Order` VARCHAR(255),
  `Start_Date` VARCHAR(40),
  `End_Date` VARCHAR(40),
  `Status` VARCHAR(255),
  `RAG` VARCHAR(255),
  `Template_ID` VARCHAR(255),
  PRIMARY KEY (`Phase_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `procedure_templates` (
  `Template_ID` VARCHAR(255) NOT NULL,
  `Template_Name` VARCHAR(255),
  `Step_No` DECIMAL(12,2),
  `Task_Name` VARCHAR(255),
  `Duration_Days` DECIMAL(12,2),
  `Required_Document` VARCHAR(255),
  `Responsible_Role` VARCHAR(255),
  PRIMARY KEY (`Template_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `checklist_items` (
  `Item_ID` VARCHAR(255) NOT NULL,
  `Project_ID` VARCHAR(255),
  `Phase_ID` VARCHAR(255),
  `Task_ID` VARCHAR(255),
  `Item_Name` VARCHAR(255),
  `Required` VARCHAR(255),
  `Status` VARCHAR(255),
  `Due_Date` VARCHAR(40),
  `Owner_ID` VARCHAR(255),
  `Evidence_URL` VARCHAR(255),
  `Notes` TEXT,
  `Last_Updated` VARCHAR(255),
  PRIMARY KEY (`Item_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `assignments` (
  `Assignment_ID` VARCHAR(255) NOT NULL,
  `Task_ID` VARCHAR(255),
  `User_ID` VARCHAR(255),
  `Start_Date` VARCHAR(40),
  `End_Date` VARCHAR(40),
  `Allocation_Pct` DECIMAL(12,2),
  `Planned_Effort_Days` DECIMAL(12,2),
  `Role` VARCHAR(255),
  PRIMARY KEY (`Assignment_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `issues` (
  `Issue_ID` VARCHAR(255) NOT NULL,
  `Project_ID` VARCHAR(255),
  `Task_ID` VARCHAR(255),
  `Title` VARCHAR(255),
  `Description` TEXT,
  `Severity` VARCHAR(255),
  `Impact` TEXT,
  `Owner_ID` VARCHAR(255),
  `Open_Date` VARCHAR(40),
  `Due_Date` VARCHAR(40),
  `Status` VARCHAR(255),
  `Resolution_Plan` TEXT,
  `Escalation_Level` VARCHAR(255),
  `Decision_Required` TEXT,
  `Last_Updated` VARCHAR(255),
  `Created_By` VARCHAR(255),
  PRIMARY KEY (`Issue_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `calendar` (
  `Date` VARCHAR(40) NOT NULL,
  `Is_Working_Day` VARCHAR(255),
  `Note` VARCHAR(255),
  PRIMARY KEY (`Date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `config` (
  `Key` VARCHAR(255) NOT NULL,
  `Value` VARCHAR(255),
  `Description` TEXT,
  PRIMARY KEY (`Key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `auth_sessions` (
  `Session_ID` VARCHAR(255) NOT NULL,
  `User_ID` VARCHAR(255),
  `Token_Hash` VARCHAR(255),
  `Created_At` VARCHAR(40),
  `Expires_At` VARCHAR(40),
  `Revoked` VARCHAR(255),
  PRIMARY KEY (`Session_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `login_attempts` (
  `Attempt_ID` VARCHAR(255) NOT NULL,
  `Username` VARCHAR(255),
  `Timestamp` VARCHAR(40),
  `Success` VARCHAR(255),
  PRIMARY KEY (`Attempt_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `project_attributes` (
  `Attribute_ID` VARCHAR(255) NOT NULL,
  `Project_ID` VARCHAR(255),
  `Field_Key` VARCHAR(255),
  `Field_Value` TEXT,
  `Updated_At` VARCHAR(40),
  PRIMARY KEY (`Attribute_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

