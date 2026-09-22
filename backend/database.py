"""
Database Abstraction Layer for SAERAS
Supports MySQL (Primary) with automatic fallback to SQLite (for zero-setup instant local running).
"""
import os
import sqlite3
import hashlib
import json
from datetime import datetime

# Check if pymysql is available
try:
    import pymysql
    import pymysql.cursors
    PYMYSQL_AVAILABLE = True
except ImportError:
    PYMYSQL_AVAILABLE = False

DB_CONFIG = {
    "host": os.environ.get("MYSQL_HOST", "localhost"),
    "port": int(os.environ.get("MYSQL_PORT", 3306)),
    "user": os.environ.get("MYSQL_USER", "root"),
    "password": os.environ.get("MYSQL_PASSWORD", ""),
    "database": os.environ.get("MYSQL_DB", "saeras_db"),
    "charset": "utf8mb4"
}

def hash_password(password: str) -> str:
    """Standard SHA-256 password hash."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

class Database:
    def __init__(self):
        self.driver = None
        self.db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "saeras.db")
        self._init_connection()
        self._create_tables()
        self._seed_data()

    def _init_connection(self):
        """Attempts MySQL connection; falls back gracefully to SQLite."""
        if PYMYSQL_AVAILABLE and os.environ.get("FORCE_SQLITE") != "1":
            try:
                # Try connecting to MySQL server directly
                conn = pymysql.connect(
                    host=DB_CONFIG["host"],
                    port=DB_CONFIG["port"],
                    user=DB_CONFIG["user"],
                    password=DB_CONFIG["password"],
                    charset=DB_CONFIG["charset"],
                    cursorclass=pymysql.cursors.DictCursor,
                    connect_timeout=3
                )
                with conn.cursor() as cursor:
                    cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_CONFIG['database']}` CHARACTER SET utf8mb4;")
                conn.commit()
                conn.close()

                # Test connection to the target database
                test_conn = pymysql.connect(
                    host=DB_CONFIG["host"],
                    port=DB_CONFIG["port"],
                    user=DB_CONFIG["user"],
                    password=DB_CONFIG["password"],
                    database=DB_CONFIG["database"],
                    charset=DB_CONFIG["charset"],
                    cursorclass=pymysql.cursors.DictCursor
                )
                test_conn.close()
                self.driver = "mysql"
                print(f"[DB] Connected to MySQL Database `{DB_CONFIG['database']}` on {DB_CONFIG['host']}:{DB_CONFIG['port']}")
                return
            except Exception as e:
                print(f"[DB Notice] MySQL connection could not be established ({e}).")
                print(f"[DB Notice] Seamlessly running on SQLite database at: {self.db_path}")
        else:
            print(f"[DB Notice] Running on SQLite database at: {self.db_path}")

        self.driver = "sqlite"

    def get_connection(self):
        """Returns active database connection."""
        if self.driver == "mysql":
            return pymysql.connect(
                host=DB_CONFIG["host"],
                port=DB_CONFIG["port"],
                user=DB_CONFIG["user"],
                password=DB_CONFIG["password"],
                database=DB_CONFIG["database"],
                charset=DB_CONFIG["charset"],
                cursorclass=pymysql.cursors.DictCursor
            )
        else:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            return conn

    def _convert_sql(self, sql):
        """Converts MySQL parameter syntax %s to SQLite ? if needed."""
        if self.driver == "sqlite":
            return sql.replace("%s", "?")
        return sql

    def execute(self, sql, params=None):
        """Executes INSERT/UPDATE/DELETE and commits."""
        conn = self.get_connection()
        try:
            cur = conn.cursor()
            query = self._convert_sql(sql)
            cur.execute(query, params or ())
            conn.commit()
            last_id = getattr(cur, "lastrowid", None)
            return last_id
        finally:
            conn.close()

    def query_all(self, sql, params=None):
        """Executes SELECT and returns list of dictionaries."""
        conn = self.get_connection()
        try:
            cur = conn.cursor()
            query = self._convert_sql(sql)
            cur.execute(query, params or ())
            rows = cur.fetchall()
            if self.driver == "sqlite":
                return [dict(r) for r in rows]
            return rows
        finally:
            conn.close()

    def query_one(self, sql, params=None):
        """Executes SELECT and returns first row as dictionary or None."""
        conn = self.get_connection()
        try:
            cur = conn.cursor()
            query = self._convert_sql(sql)
            cur.execute(query, params or ())
            row = cur.fetchone()
            if row is None:
                return None
            if self.driver == "sqlite":
                return dict(row)
            return row
        finally:
            conn.close()

    def _create_tables(self):
        """Creates table schema matching MySQL design."""
        if self.driver == "mysql":
            schema_sql = """
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(64) PRIMARY KEY,
                username VARCHAR(100) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                role ENUM('admin', 'faculty', 'student') NOT NULL,
                name VARCHAR(150) NOT NULL,
                email VARCHAR(150),
                enabled BOOLEAN DEFAULT TRUE,
                must_change_password BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS students (
                id VARCHAR(64) PRIMARY KEY,
                user_id VARCHAR(64) NOT NULL,
                registration_number VARCHAR(50) NOT NULL UNIQUE,
                name VARCHAR(150) NOT NULL,
                branch VARCHAR(50) DEFAULT 'CS',
                semester INT DEFAULT 3,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS subjects (
                id VARCHAR(64) PRIMARY KEY,
                code VARCHAR(30) NOT NULL UNIQUE,
                name VARCHAR(150) NOT NULL,
                branch VARCHAR(50) DEFAULT 'CS',
                semester INT DEFAULT 3,
                credits INT DEFAULT 4,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS faculty_subjects (
                id VARCHAR(64) PRIMARY KEY,
                faculty_id VARCHAR(64) NOT NULL,
                subject_id VARCHAR(64) NOT NULL,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
                UNIQUE KEY uq_faculty_subject (faculty_id, subject_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS marks (
                id VARCHAR(64) PRIMARY KEY,
                student_id VARCHAR(64) NOT NULL,
                subject_id VARCHAR(64) NOT NULL,
                mid_sem DECIMAL(5,2) DEFAULT 0.00,
                assignment DECIMAL(5,2) DEFAULT 0.00,
                quiz DECIMAL(5,2) DEFAULT 0.00,
                attendance DECIMAL(5,2) DEFAULT 0.00,
                total DECIMAL(5,2) DEFAULT 0.00,
                grade VARCHAR(5) NOT NULL,
                gpa DECIMAL(4,2) NOT NULL,
                status ENUM('draft', 'published') DEFAULT 'draft',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
                UNIQUE KEY uq_student_subject (student_id, subject_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS copo_mappings (
                id VARCHAR(64) PRIMARY KEY,
                subject_id VARCHAR(64) NOT NULL,
                co_code VARCHAR(30) NOT NULL,
                co_description VARCHAR(255) NOT NULL,
                po1 INT DEFAULT 0,
                po2 INT DEFAULT 0,
                po3 INT DEFAULT 0,
                po4 INT DEFAULT 0,
                po5 INT DEFAULT 0,
                po6 INT DEFAULT 0,
                FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS notifications (
                id VARCHAR(64) PRIMARY KEY,
                title VARCHAR(200) NOT NULL,
                message TEXT NOT NULL,
                for_role VARCHAR(20) DEFAULT 'all',
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """
            conn = self.get_connection()
            try:
                cur = conn.cursor()
                for statement in schema_sql.split(";"):
                    stmt = statement.strip()
                    if stmt:
                        cur.execute(stmt)
                conn.commit()
            finally:
                conn.close()
        else:
            # SQLite DDL
            tables = [
                """CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL,
                    name TEXT NOT NULL,
                    email TEXT,
                    enabled INTEGER DEFAULT 1,
                    must_change_password INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )""",
                """CREATE TABLE IF NOT EXISTS students (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    registration_number TEXT NOT NULL UNIQUE,
                    name TEXT NOT NULL,
                    branch TEXT DEFAULT 'CS',
                    semester INTEGER DEFAULT 3,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )""",
                """CREATE TABLE IF NOT EXISTS subjects (
                    id TEXT PRIMARY KEY,
                    code TEXT NOT NULL UNIQUE,
                    name TEXT NOT NULL,
                    branch TEXT DEFAULT 'CS',
                    semester INTEGER DEFAULT 3,
                    credits INTEGER DEFAULT 4,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )""",
                """CREATE TABLE IF NOT EXISTS faculty_subjects (
                    id TEXT PRIMARY KEY,
                    faculty_id TEXT NOT NULL,
                    subject_id TEXT NOT NULL,
                    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
                    UNIQUE (faculty_id, subject_id)
                )""",
                """CREATE TABLE IF NOT EXISTS marks (
                    id TEXT PRIMARY KEY,
                    student_id TEXT NOT NULL,
                    subject_id TEXT NOT NULL,
                    mid_sem REAL DEFAULT 0.0,
                    assignment REAL DEFAULT 0.0,
                    quiz REAL DEFAULT 0.0,
                    attendance REAL DEFAULT 0.0,
                    total REAL DEFAULT 0.0,
                    grade TEXT NOT NULL,
                    gpa REAL NOT NULL,
                    status TEXT DEFAULT 'draft',
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
                    UNIQUE (student_id, subject_id)
                )""",
                """CREATE TABLE IF NOT EXISTS copo_mappings (
                    id TEXT PRIMARY KEY,
                    subject_id TEXT NOT NULL,
                    co_code TEXT NOT NULL,
                    co_description TEXT NOT NULL,
                    po1 INTEGER DEFAULT 0,
                    po2 INTEGER DEFAULT 0,
                    po3 INTEGER DEFAULT 0,
                    po4 INTEGER DEFAULT 0,
                    po5 INTEGER DEFAULT 0,
                    po6 INTEGER DEFAULT 0,
                    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
                )""",
                """CREATE TABLE IF NOT EXISTS notifications (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    message TEXT NOT NULL,
                    for_role TEXT DEFAULT 'all',
                    is_read INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )"""
            ]
            conn = self.get_connection()
            try:
                cur = conn.cursor()
                for tbl in tables:
                    cur.execute(tbl)
                conn.commit()
            finally:
                conn.close()

    def _seed_data(self):
        """Populates initial seed users, subjects, and marks if database is empty."""
        try:
            from grading import calculate_grade
        except ImportError:
            from backend.grading import calculate_grade

        existing_admin = self.query_one("SELECT id FROM users WHERE username = %s", ("admin",))
        if existing_admin:
            return  # Already seeded

        print("[DB] Seeding database with initial users, subjects, and sample assessment data...")

        # 1. Admin & Faculty
        users_to_add = [
            ("u_admin", "admin", hash_password("admin123"), "admin", "Dr. System Administrator", "admin@saeras.edu", 1, 0),
            ("u_fac1", "meena@saeras.edu", hash_password("faculty123"), "faculty", "Dr. Meena Sharma", "meena@saeras.edu", 1, 0),
            ("u_fac2", "raj@saeras.edu", hash_password("faculty123"), "faculty", "Prof. Raj Kumar", "raj@saeras.edu", 1, 0),
        ]
        for u in users_to_add:
            self.execute(
                "INSERT INTO users (id, username, password_hash, role, name, email, enabled, must_change_password) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                u
            )

        # 2. Subjects
        subjects_to_add = [
            ("sub_cs301", "CS301", "Data Structures & Algorithms", "CS", 3, 4),
            ("sub_cs302", "CS302", "Operating Systems", "CS", 3, 4),
            ("sub_cs303", "CS303", "Database Management Systems", "CS", 3, 3),
            ("sub_ec301", "EC301", "Signals & Systems", "ECE", 3, 4),
            ("sub_me201", "ME201", "Thermodynamics", "MECH", 2, 4),
            ("sub_cv201", "CV201", "Surveying & Geomatics", "CIVIL", 2, 3),
        ]
        for s in subjects_to_add:
            self.execute(
                "INSERT INTO subjects (id, code, name, branch, semester, credits) VALUES (%s, %s, %s, %s, %s, %s)",
                s
            )

        # 3. Faculty Subjects
        fac_subs = [
            ("fs_1", "u_fac1", "sub_cs301"),
            ("fs_2", "u_fac1", "sub_cs302"),
            ("fs_3", "u_fac2", "sub_cs303"),
            ("fs_4", "u_fac2", "sub_ec301")
        ]
        for fs in fac_subs:
            self.execute("INSERT INTO faculty_subjects (id, faculty_id, subject_id) VALUES (%s, %s, %s)", fs)

        # 4. Students
        students_raw = [
            ("21CS001", "Ananya Sharma", "CS", 3),
            ("21CS004", "Rohan Mehta", "CS", 3),
            ("21CS009", "Priya Kapoor", "CS", 3),
            ("21CS015", "Arjun Thakur", "CS", 3),
            ("21CS020", "Kiran Das", "CS", 3),
            ("21CS025", "Meena Hegde", "CS", 3),
            ("21EC002", "Divya Reddy", "ECE", 3),
            ("21EC007", "Karan Bhatt", "ECE", 3),
            ("21ME011", "Vishal Gupta", "MECH", 2),
            ("21CV005", "Nisha Patel", "CIVIL", 2),
        ]

        for roll, name, branch, sem in students_raw:
            user_id = f"u_{roll}"
            stu_id = f"stu_{roll}"
            # Default password is roll number, must change password on first login
            self.execute(
                "INSERT INTO users (id, username, password_hash, role, name, email, enabled, must_change_password) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                (user_id, roll, hash_password(roll), "student", name, f"{roll}@saeras.edu", 1, 1)
            )
            self.execute(
                "INSERT INTO students (id, user_id, registration_number, name, branch, semester) VALUES (%s, %s, %s, %s, %s, %s)",
                (stu_id, user_id, roll, name, branch, sem)
            )

        # 5. Pre-fill Marks for CS students in CS301, CS302, CS303
        cs_students = [s for s in students_raw if s[2] == "CS"]
        sample_scores = [
            # (roll, sub_id, mid, assign, quiz, attend)
            ("21CS001", "sub_cs301", 19.5, 9.5, 4.8, 5.0), # 38.8 -> O, 10
            ("21CS001", "sub_cs302", 18.0, 9.0, 4.5, 4.5), # 36.0 -> O, 10
            ("21CS001", "sub_cs303", 17.5, 9.0, 4.0, 4.5), # 35.0 -> A+, 9
            ("21CS004", "sub_cs301", 17.0, 8.5, 4.0, 4.5), # 34.0 -> A+, 9
            ("21CS004", "sub_cs302", 16.5, 8.0, 4.0, 4.5), # 33.0 -> A+, 9
            ("21CS004", "sub_cs303", 18.0, 9.0, 4.5, 5.0), # 36.5 -> O, 10
            ("21CS009", "sub_cs301", 15.0, 8.0, 3.5, 4.0), # 30.5 -> A, 8
            ("21CS009", "sub_cs302", 14.5, 7.5, 3.5, 4.0), # 29.5 -> A, 8
            ("21CS015", "sub_cs301", 13.0, 7.0, 3.0, 3.5), # 26.5 -> B+, 7
            ("21CS015", "sub_cs302", 12.0, 6.5, 3.0, 3.5), # 25.0 -> B+, 7
            ("21CS020", "sub_cs301", 10.0, 5.5, 2.5, 3.0), # 21.0 -> B, 6
            ("21CS020", "sub_cs302", 9.0, 5.0, 2.0, 2.5),  # 18.5 -> C, 5
            ("21CS025", "sub_cs301", 7.0, 4.0, 1.5, 2.0),  # 14.5 -> F, 0 (Weak student identification)
        ]

        for roll, sub_id, mid, assign, quiz, attend in sample_scores:
            user_id = f"u_{roll}"
            total = round(mid + assign + quiz + attend, 2)
            g_info = calculate_grade(total)
            mark_id = f"mk_{roll}_{sub_id}"
            self.execute(
                """INSERT INTO marks (id, student_id, subject_id, mid_sem, assignment, quiz, attendance, total, grade, gpa, status)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (mark_id, user_id, sub_id, mid, assign, quiz, attend, total, g_info["grade"], g_info["gpa"], "published")
            )

        # 6. CO-PO Attainment Matrix
        copo_samples = [
            ("copo_1", "sub_cs301", "CO1", "Apply fundamental data structure algorithms", 3, 2, 2, 1, 2, 1),
            ("copo_2", "sub_cs301", "CO2", "Analyse algorithmic complexity and efficiency", 2, 3, 2, 2, 1, 1),
            ("copo_3", "sub_cs301", "CO3", "Design optimal tree and graph representations", 1, 2, 3, 2, 1, 2),
            ("copo_4", "sub_cs301", "CO4", "Implement practical hash tables and dynamic structures", 2, 2, 2, 3, 2, 1),
            ("copo_5", "sub_cs302", "CO1", "Understand process scheduling and concurrency", 3, 2, 1, 1, 2, 0),
            ("copo_6", "sub_cs302", "CO2", "Apply memory management and virtual paging", 2, 3, 2, 1, 1, 1),
            ("copo_7", "sub_cs302", "CO3", "Analyse deadlock prevention and recovery", 1, 2, 3, 2, 0, 1),
            ("copo_8", "sub_cs303", "CO1", "Design relational database schemas and ER diagrams", 2, 3, 2, 1, 1, 1),
            ("copo_9", "sub_cs303", "CO2", "Execute advanced SQL queries and transaction control", 3, 2, 2, 1, 2, 0),
        ]
        for c in copo_samples:
            self.execute(
                "INSERT INTO copo_mappings (id, subject_id, co_code, co_description, po1, po2, po3, po4, po5, po6) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                c
            )

        # 7. Notifications
        notifs = [
            ("notif_1", "Welcome to SAERAS", "System initialized with complete Result Analytics & GPA Grading module.", "all", 0),
            ("notif_2", "CS301 Results Published", "Internal Assessment marks for CS301 (Data Structures) are now published.", "student", 0),
            ("notif_3", "Marks Verification Requested", "IQAC audit requires verification of CO-PO mappings for Semester 3.", "faculty", 0),
        ]
        for n in notifs:
            self.execute("INSERT INTO notifications (id, title, message, for_role, is_read) VALUES (%s, %s, %s, %s, %s)", n)

        print("[DB] Initial seeding completed successfully.")

# Global Singleton Instance
db = Database()
