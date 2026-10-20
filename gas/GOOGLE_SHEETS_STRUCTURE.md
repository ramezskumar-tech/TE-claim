# Google Sheets Database Architecture
## Samagra Shiksha, Vellore District — School Education Department
### Scheme: Transport & Escort Facility Monthly Claim System

This document outlines the spreadsheet tables, column definitions, data types, and security guidelines for using Google Sheets as a primary or mirror database.

---

### Sheet 1: `Users`
Stores authorized administrative and school accounts.

| Column Index | Field Name | Type | Description |
| :--- | :--- | :--- | :--- |
| A | `User_ID` | String | e.g., `SCH_33040100101`, `BLK_USR_URBAN`, `DIS_VEL_01` |
| B | `Full_Name` | String | Name and designation of the user (e.g. K. Rajendran, HM) |
| C | `Role` | Enum | `SCHOOL`, `BLOCK`, `DISTRICT` |
| D | `Block_ID` | String | Block reference (e.g. `BLK_VELLORE_URBAN`) |
| E | `Block_Name` | String | Block name (e.g. `Vellore Urban`) |
| F | `UDISE_Code` | String | 11-digit school UDISE code (for School role) |
| G | `School_Name` | String | Government school name |
| H | `Email` | String | Official TN Schools email address |
| I | `Phone` | String | Mobile number |
| J | `Status` | String | `ACTIVE`, `INACTIVE` |

---

### Sheet 2: `Blocks`
Master list of educational blocks in Vellore District.

| Column Index | Field Name | Type | Description |
| :--- | :--- | :--- | :--- |
| A | `Block_ID` | String | Unique primary key (e.g., `BLK_VELLORE_URBAN`) |
| B | `Block_Code` | String | Educational district code (e.g., `330401`) |
| C | `Block_Name` | String | Name of the block (e.g. `Vellore Urban`) |
| D | `BEO_Officer_Name` | String | Block Educational Officer name |
| E | `Email` | String | BEO office email |
| F | `Total_Schools` | Integer | Total count of eligible government schools |

---

### Sheet 3: `Schools`
Master list of government schools under Samagra Shiksha Vellore.

| Column Index | Field Name | Type | Description |
| :--- | :--- | :--- | :--- |
| A | `UDISE_Code` | String | 11-digit UDISE code (Primary Key) |
| B | `School_Name` | String | Full government school name |
| C | `Block_ID` | String | Foreign key to `Blocks` |
| D | `Block_Name` | String | Block Name |
| E | `Category` | String | `GHS`, `GHSS`, `PUMS`, `ADW`, `GTRMS` |
| F | `Headmaster_Name` | String | Name of Headmaster / Principal |
| G | `Phone` | String | Contact phone |
| H | `Eligible_Students` | Integer | Approved beneficiary ceiling |

---

### Sheet 4: `Claims_Active`
Active cycle claims submitted by schools and processed by blocks/district.

| Column Index | Field Name | Type | Description |
| :--- | :--- | :--- | :--- |
| A | `Claim_ID` | String | `CLM_SCH_{UDISE}_{YYYY-MM}` |
| B | `UDISE_Code` | String | School UDISE code |
| C | `School_Name` | String | School name |
| D | `Claim_Month_Key` | String | e.g., `2026-09` |
| E | `Claim_Month_Name`| String | e.g., `September 2026` |
| F | `Block_ID` | String | Block identifier |
| G | `Block_Name` | String | Block name |
| H | `Total_Students` | Integer | Total number of claimed beneficiaries |
| I | `Total_Amount` | Decimal | Total calculated stipend/reimbursement (INR) |
| J | `Status` | Enum | Current workflow status |
| K | `Submitted_By` | String | User name who submitted |
| L | `Submitted_At` | DateTime | Timestamp of submission |
| M | `Block_Remarks` | String | Verification notes from Block user |
| N | `District_Remarks`| String | Verification notes from District user |

---

### Sheet 5: `Students_Active`
Student-level breakdown for the active monthly cycle.

| Column Index | Field Name | Type | Description |
| :--- | :--- | :--- | :--- |
| A | `Claim_ID` | String | Reference to `Claims_Active` |
| B | `UDISE_Code` | String | School UDISE |
| C | `EMIS_Number` | String | Student 14-digit EMIS ID |
| D | `Student_Name` | String | Beneficiary student name |
| E | `Grade` | String | Class (Class 1 to 8) |
| F | `Category` | Enum | `Transport` or `Escort` |
| G | `Working_Days` | Integer | School working days in claim month |
| H | `Days_Attended` | Integer | Student attendance verified days |
| I | `Rate_Per_Day` | Decimal | Government sanctioned rate per day (INR) |
| J | `Total_Amount` | Decimal | Days Attended $\times$ Rate Per Day |
| K | `Service_Provider`| String | Escort Helper or Transport Driver/Vehicle |
| L | `Bank_Account` | String | Beneficiary or Helper bank account details |

---

### Sheet 6: `Audit_Logs`
Immutable, permanent action history. Records are never deleted.

| Column Index | Field Name | Type | Description |
| :--- | :--- | :--- | :--- |
| A | `Log_ID` | String | Unique log identifier |
| B | `Timestamp` | DateTime | Precise system timestamp |
| C | `User_ID` | String | Acting user identifier |
| D | `User_Name` | String | Acting user name |
| E | `Role` | Enum | `SCHOOL`, `BLOCK`, `DISTRICT` |
| F | `Entity_Name` | String | School or Block name |
| G | `Claim_Month` | String | Target claim month |
| H | `Action` | String | `SCHOOL_SUBMIT`, `BLOCK_VERIFY`, `DISTRICT_APPROVE`, etc. |
| I | `Previous_Status`| String | Prior status before mutation |
| J | `New_Status` | String | Updated status |
| K | `Remarks` | String | Reason or observation notes |

---

### Sheet 7: `Claims_Archive`
Identical schema to `Claims_Active`. At the close of each cycle, active records are appended here and the active workspace is reset for the next month.
