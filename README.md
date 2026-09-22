# OUTR Academic ERP & Online Results Portal
### Odisha University of Technology and Research (OUTR, Bhubaneswar)

An institutional academic management, continuous assessment, and online examination results portal engineered for **Odisha University of Technology and Research (OUTR)**.

---

## 🌟 Key Capabilities

### 1. Official OUTR Online Results Sheet & Transcript Generation
- **Authentic Layout:** Exact replica of the official OUTR Online Results Sheet featuring:
  - Bilingual university header with official Odia script (*ଓଡ଼ିଶା ବୈଷୟିକ ଓ ଗବେଷଣା ବିଶ୍ବବିଦ୍ୟାଳୟ*) and English lettering with the circular OUTR emblem.
  - Institutional navy banner (`ONLINE RESULTS SHEET`).
  - Student metadata table (Examination, Course, Branch, Registration No, Student Name).
  - Subjects table with course code, title, credits, and grade point evaluation.
  - Total Credits and Semester Grade Point Average (SGPA).
  - Official 4-point provisional result regulations.
  - Controller of Examinations authorized signature seal.
- **Instant Export:** 
  - **In-Browser Print:** Optimized `@media print` layout for saving clean, high-resolution PDFs directly from the browser print dialog.
  - **Direct PDF Download:** Client-side vector PDF generation using `jsPDF` and `jsPDF-autotable` with embedded base64 imagery.

### 2. Automated Continuous Assessment Engine
- Standard assessment component breakdown (Total: 40 marks):
  - **Mid-Semester Examination:** 20 Marks
  - **Assignments:** 10 Marks
  - **Quizzes:** 5 Marks
  - **Attendance:** 5 Marks
- Real-time grade and Grade Point Average (GPA) computation upon score entry:

| Marks Range (/40) | Grade | GPA | Status | Performance |
| :---: | :---: | :---: | :---: | :---: |
| **36 – 40** | **O** | **10.0** | Pass | Outstanding |
| **32 – 35.9** | **A+** | **9.0** | Pass | Excellent |
| **28 – 31.9** | **A** | **8.0** | Pass | Very Good |
| **24 – 27.9** | **B+** | **7.0** | Pass | Good |
| **20 – 23.9** | **B** | **6.0** | Pass | Above Average |
| **16 – 19.9** | **C** | **5.0** | Pass | Average |
| **< 16** | **F** | **0.0** | Fail | Remedial Needed |

- Credit-weighted Semester Grade Point Average (SGPA) and Cumulative Grade Point Average (CGPA) calculated automatically:
  $$\text{SGPA} = \frac{\sum (\text{Course Credits} \times \text{Grade Point})}{\sum \text{Course Credits}}$$

### 3. Bulk Excel / CSV Data Ingestion
- Instructors can upload class rosters and assessment sheets in `.xlsx`, `.xls`, or `.csv` format.
- Automatic column detection (`Registration Number`, `Mid-Sem`, `Assignment`, `Quiz`, `Attendance`, question breakdowns `Q1..Qn`).
- Automatically provisions student user accounts:
  - **Username:** Registration Number
  - **Default Password:** Registration Number
  - **Security:** Forced first-time password reset.

### 4. Role-Based Access Portals
- **Student Portal:**
  - View individual CGPA/SGPA, course breakdown, pass/fail status, and official results sheets.
  - Download official PDF transcripts.
- **Faculty / HOD Portal:**
  - Enter marks via interactive spreadsheet grid or file upload.
  - View subject-wise performance analytics, grade distributions, and pass percentages.
  - Publish results to notify students.
- **Administrator Portal:**
  - Institution-wide performance overview and department metrics.
  - Manage student and faculty accounts (enable, disable, reset).
  - Outcome-Based Education (OBE) CO-PO Attainment Matrix (Scale: 0=None, 1=Low, 2=Medium, 3=High).
  - Search portal for instant student verification by registration number.

### 5. Dual-Driver Database Architecture
- **Primary:** **MySQL** (`saeras_db` via `backend/schema.sql`).
- **Resilient Fallback:** **SQLite** (`backend/saeras.db`), enabling zero-configuration offline execution without requiring a running MySQL server.

---

## 🛠️ Tech Stack

- **Backend:** Python 3 (Flask, PyMySQL, OpenPyXL)
- **Frontend:** Vanilla HTML5, CSS3 (OUTR Institutional White & Blue Design System), JavaScript (ES6+)
- **Data Visualization:** Chart.js
- **Document Generation:** jsPDF, jsPDF-AutoTable
- **Database:** MySQL / SQLite

---

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.9+ installed on your system.

### 1. Clone the Repository
```bash
git clone https://github.com/<your-username>/<repo-name>.git
cd <repo-name>
```

### 2. Install Dependencies
```bash
pip install flask flask-cors pymysql openpyxl cryptography
```

### 3. Run the Application
#### Windows (1-Click):
Double-click **`RUN_OUTR_PORTAL.bat`** on your desktop or in the project folder.

#### Terminal / Command Line:
```bash
python backend/app.py
```

### 4. Access the Web Application
Open your browser and navigate to:
```text
http://localhost:5000
```

---

## 🔑 Default Login Credentials

| Role | Tab | Login ID / Reg No | Default Password | Features Accessible |
| :--- | :--- | :--- | :--- | :--- |
| **Student** | **STUDENT** | `23110278` | `23110278` | Official 6th-Sem Results Sheet (SGPA 8.07, 9 courses) & PDF download |
| **Student** | **STUDENT** | `21CS001` | `21CS001` | 3rd-Sem Results & GPA card |
| **Faculty** | **HOD/ADV/FACULTY** | `sanjukta@outr.com` | `faculty123` | Marks entry, Excel upload, analytics |
| **Admin** | **ADMIN** | `admin` | `admin123` | Full administrative control, CO-PO mapping, audits |

---

## 📄 License
This project is licensed under the MIT License.
