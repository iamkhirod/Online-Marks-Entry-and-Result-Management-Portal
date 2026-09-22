-- ============================================================
-- Smart Academic Evaluation & Result Analytics System (SAERAS)
-- MySQL Database Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS saeras_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE saeras_db;

-- 1. Users Table (Admin, Faculty, Student)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'faculty', 'student') NOT NULL,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    enabled BOOLEAN DEFAULT TRUE,
    must_change_password BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_role (role),
    INDEX idx_user_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Students Master Table
CREATE TABLE IF NOT EXISTS students (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    registration_number VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    branch VARCHAR(50) DEFAULT 'CS',
    semester INT DEFAULT 3,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_student_reg (registration_number),
    INDEX idx_student_branch (branch),
    INDEX idx_student_sem (semester)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Subjects Master Table
CREATE TABLE IF NOT EXISTS subjects (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    branch VARCHAR(50) DEFAULT 'CS',
    semester INT DEFAULT 3,
    credits INT DEFAULT 4,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_subject_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Faculty - Subject Mapping
CREATE TABLE IF NOT EXISTS faculty_subjects (
    id VARCHAR(64) PRIMARY KEY,
    faculty_id VARCHAR(64) NOT NULL,
    subject_id VARCHAR(64) NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    UNIQUE KEY uq_faculty_subject (faculty_id, subject_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Marks Table
-- Grading standard: Total 40 marks
-- MidSem: 20 | Assignment: 10 | Quiz: 5 | Attendance: 5
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

-- 6. CO-PO Attainment Matrix Table
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

-- 7. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    for_role VARCHAR(20) DEFAULT 'all',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Seed Default Admin, Faculty, and Sample Subjects
-- Default admin password: admin123 (SHA-256: 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9)
INSERT IGNORE INTO users (id, username, password_hash, role, name, email, enabled, must_change_password)
VALUES 
('u_admin', 'admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'admin', 'Dr. System Administrator', 'admin@saeras.edu', TRUE, FALSE),
('u_fac1', 'meena@saeras.edu', '85136d62791771489069d32d0c26683fbe25adfb5434543d3b76cf61b5849fd0', 'faculty', 'Dr. Meena Sharma', 'meena@saeras.edu', TRUE, FALSE),
('u_fac2', 'raj@saeras.edu', '85136d62791771489069d32d0c26683fbe25adfb5434543d3b76cf61b5849fd0', 'faculty', 'Prof. Raj Kumar', 'raj@saeras.edu', TRUE, FALSE);

-- Default faculty password is 'faculty123'
INSERT IGNORE INTO subjects (id, code, name, branch, semester, credits)
VALUES 
('sub_cs301', 'CS301', 'Data Structures & Algorithms', 'CS', 3, 4),
('sub_cs302', 'CS302', 'Operating Systems', 'CS', 3, 4),
('sub_cs303', 'CS303', 'Database Management Systems', 'CS', 3, 3),
('sub_ec301', 'EC301', 'Signals & Systems', 'ECE', 3, 4),
('sub_me201', 'ME201', 'Thermodynamics', 'MECH', 2, 4),
('sub_cv201', 'CV201', 'Surveying & Geomatics', 'CIVIL', 2, 3);

INSERT IGNORE INTO faculty_subjects (id, faculty_id, subject_id)
VALUES
('fs_1', 'u_fac1', 'sub_cs301'),
('fs_2', 'u_fac1', 'sub_cs302'),
('fs_3', 'u_fac2', 'sub_cs303'),
('fs_4', 'u_fac2', 'sub_ec301');

INSERT IGNORE INTO notifications (id, title, message, for_role, is_read)
VALUES
('notif_1', 'System Initialized', 'Welcome to the Smart Academic Evaluation & Result Analytics System.', 'all', FALSE),
('notif_2', 'Semester 3 Results Pending', 'Please finalize and publish internal assessment marks for CS301.', 'faculty', FALSE);
