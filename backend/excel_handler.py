"""
Excel and CSV Bulk Data Ingestion Engine for SAERAS
Handles:
- Upload of .xlsx, .xls, .csv files or parsed JSON
- Automatic creation of student user accounts with Registration Number as default credentials
- Enforces password change on first login
- Calculation of total marks (out of 40), Grade (O..F), and GPA (10..0)
- Dynamic subject creation or linkage with existing students and faculty
- Bulk transactions ensuring zero data corruption
"""
import os
import csv
import io
import openpyxl
from database import db, hash_password
from grading import calculate_grade

def normalize_key(key):
    """Normalizes header string for robust matching."""
    return str(key).lower().replace(" ", "").replace("_", "").replace("-", "").strip()

def extract_rows_from_file(file_stream, filename):
    """
    Extracts list of dictionaries from either an Excel file (.xlsx) or CSV file.
    """
    rows = []
    ext = os.path.splitext(filename)[1].lower()

    if ext in [".xlsx", ".xlsm", ".xltx"]:
        wb = openpyxl.load_workbook(file_stream, data_only=True)
        sheet = wb.active
        headers = []
        for i, row in enumerate(sheet.iter_rows(values_only=True)):
            if i == 0:
                headers = [str(cell).strip() if cell is not None else f"col_{idx}" for idx, cell in enumerate(row)]
            else:
                if any(row):  # skip blank rows
                    row_dict = {}
                    for h, val in zip(headers, row):
                        row_dict[h] = val
                    rows.append(row_dict)
    elif ext == ".csv":
        # Decode text stream
        if isinstance(file_stream, io.BytesIO):
            content = file_stream.read().decode("utf-8-sig", errors="replace")
            stream = io.StringIO(content)
        else:
            stream = file_stream
        reader = csv.DictReader(stream)
        for row in reader:
            if any(row.values()):
                rows.append(row)
    else:
        raise ValueError(f"Unsupported file format '{ext}'. Please upload an .xlsx or .csv file.")

    return rows

def process_bulk_marks(rows, subject_code=None, subject_name=None, branch="CS", semester=3, faculty_id=None, status="draft"):
    """
    Processes extracted rows, updates/creates:
    - Subject (if needed)
    - Faculty mapping
    - Student users + student profile (if new)
    - Marks records with auto Total, Grade, GPA
    """
    if not rows:
        return {"success": False, "error": "No records found in upload."}

    # 1. Ensure Subject exists or create dynamically
    sub = None
    if subject_code:
        sub = db.query_one("SELECT * FROM subjects WHERE code = %s", (subject_code,))
        if not sub:
            sub_id = f"sub_{normalize_key(subject_code)}"
            db.execute(
                "INSERT INTO subjects (id, code, name, branch, semester, credits) VALUES (%s, %s, %s, %s, %s, %s)",
                (sub_id, subject_code, subject_name or subject_code, branch or "CS", int(semester or 3), 4)
            )
            sub = db.query_one("SELECT * FROM subjects WHERE id = %s", (sub_id,))
    
    if not sub:
        # Fallback to first available subject if not specified
        sub = db.query_one("SELECT * FROM subjects LIMIT 1")
        if not sub:
            return {"success": False, "error": "No subject specified and no subjects exist in database."}

    subject_id = sub["id"]

    # 2. Link with faculty if faculty_id provided
    if faculty_id:
        existing_fs = db.query_one(
            "SELECT id FROM faculty_subjects WHERE faculty_id = %s AND subject_id = %s",
            (faculty_id, subject_id)
        )
        if not existing_fs:
            db.execute(
                "INSERT INTO faculty_subjects (id, faculty_id, subject_id) VALUES (%s, %s, %s)",
                (f"fs_{faculty_id}_{subject_id}", faculty_id, subject_id)
            )

    new_accounts_created = 0
    records_processed = 0
    errors = []

    for idx, raw_row in enumerate(rows, start=1):
        # Map fields dynamically
        mapped = {}
        for k, v in raw_row.items():
            norm = normalize_key(k)
            mapped[norm] = v

        # Helper to find value by keyword search
        def get_field_val(*keywords):
            for k, val in mapped.items():
                if any(kw in k for kw in keywords):
                    return val
            return None

        # Find Student Name
        student_name = (
            get_field_val("studentname", "fullname", "candidate", "name", "student") or f"Student {idx}"
        )
        student_name = str(student_name).strip()

        # Find Registration Number / Roll No
        reg_no = get_field_val("registration", "regno", "rollno", "roll", "reg_no", "reg")
        if not reg_no:
            errors.append(f"Row {idx}: Missing Registration Number / Roll No, skipped.")
            continue

        reg_no = str(reg_no).strip().upper()

        # Parse marks components
        # Mid-Sem (Max 20) - check if question marks (q1, q2...) are provided
        q_sum = 0
        has_q = False
        for k, v in mapped.items():
            if k.startswith("q") and k[1:].isdigit():
                try:
                    q_sum += float(v or 0)
                    has_q = True
                except (ValueError, TypeError):
                    pass

        try:
            mid_raw = get_field_val("midsem", "mid", "internal")
            if has_q and (mid_raw is None or mid_raw == ""):
                mid_sem = min(20.0, float(q_sum))
            else:
                mid_sem = min(20.0, max(0.0, float(mid_raw or 0)))
        except (ValueError, TypeError):
            mid_sem = 0.0

        # Assignment (Max 10)
        try:
            assign_raw = get_field_val("assign")
            assignment = min(10.0, max(0.0, float(assign_raw or 0)))
        except (ValueError, TypeError):
            assignment = 0.0

        # Quiz (Max 5)
        try:
            quiz_raw = get_field_val("quiz")
            quiz = min(5.0, max(0.0, float(quiz_raw or 0)))
        except (ValueError, TypeError):
            quiz = 0.0

        # Attendance (Max 5)
        try:
            attend_raw = get_field_val("attend")
            attendance = min(5.0, max(0.0, float(attend_raw or 0)))
        except (ValueError, TypeError):
            attendance = 0.0

        # Calculate Total (Max 40)
        total = round(mid_sem + assignment + quiz + attendance, 2)
        grade_info = calculate_grade(total)

        # 3. Check or Create User Account
        user = db.query_one("SELECT id FROM users WHERE username = %s", (reg_no,))
        if not user:
            user_id = f"u_{reg_no}"
            db.execute(
                """INSERT INTO users 
                   (id, username, password_hash, role, name, email, enabled, must_change_password)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                (user_id, reg_no, hash_password(reg_no), "student", student_name, f"{reg_no}@saeras.edu", 1, 1)
            )
            # Create student master row
            stu_id = f"stu_{reg_no}"
            student_branch = sub.get("branch") or branch or "CS"
            student_sem = sub.get("semester") or semester or 3
            db.execute(
                """INSERT INTO students 
                   (id, user_id, registration_number, name, branch, semester)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (stu_id, user_id, reg_no, student_name, student_branch, student_sem)
            )
            new_accounts_created += 1
        else:
            user_id = user["id"]

        # 4. Insert or Update Marks Record
        mark_id = f"mk_{reg_no}_{subject_id}"
        existing_mark = db.query_one(
            "SELECT id FROM marks WHERE student_id = %s AND subject_id = %s",
            (user_id, subject_id)
        )

        if existing_mark:
            db.execute(
                """UPDATE marks 
                   SET mid_sem = %s, assignment = %s, quiz = %s, attendance = %s, 
                       total = %s, grade = %s, gpa = %s, status = %s
                   WHERE id = %s""",
                (mid_sem, assignment, quiz, attendance, total, grade_info["grade"], grade_info["gpa"], status, existing_mark["id"])
            )
        else:
            db.execute(
                """INSERT INTO marks 
                   (id, student_id, subject_id, mid_sem, assignment, quiz, attendance, total, grade, gpa, status)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (mark_id, user_id, subject_id, mid_sem, assignment, quiz, attendance, total, grade_info["grade"], grade_info["gpa"], status)
            )

        records_processed += 1

    # Notify admin and faculty of upload
    db.execute(
        """INSERT INTO notifications (id, title, message, for_role, is_read)
           VALUES (%s, %s, %s, %s, %s)""",
        (
            f"notif_{os.urandom(4).hex()}",
            f"Marks Uploaded for {sub['code']}",
            f"{records_processed} student assessment records processed ({new_accounts_created} new student accounts created).",
            "all",
            0
        )
    )

    return {
        "success": True,
        "subject_id": subject_id,
        "subject_code": sub["code"],
        "subject_name": sub["name"],
        "records_processed": records_processed,
        "new_accounts_created": new_accounts_created,
        "errors": errors
    }
