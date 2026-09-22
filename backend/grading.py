"""
Grading & Assessment Calculation Engine for SAERAS
Standard:
Total internal assessment marks: 40
- Mid-Sem: 20
- Assignment: 10
- Quiz: 5
- Attendance: 5

Grading Scale (Modified GPA-based):
36 - 40 : O   (10 GPA)
32 - 35 : A+  (9 GPA)
28 - 31 : A   (8 GPA)
24 - 27 : B+  (7 GPA)
20 - 23 : B   (6 GPA)
16 - 19 : C   (5 GPA)
 < 16   : F   (0 GPA)
"""

GRADE_MAP = [
    {"min": 36, "max": 40, "grade": "O", "gpa": 10.0, "status": "Pass", "label": "Outstanding"},
    {"min": 32, "max": 35.999, "grade": "A+", "gpa": 9.0, "status": "Pass", "label": "Excellent"},
    {"min": 28, "max": 31.999, "grade": "A", "gpa": 8.0, "status": "Pass", "label": "Very Good"},
    {"min": 24, "max": 27.999, "grade": "B+", "gpa": 7.0, "status": "Pass", "label": "Good"},
    {"min": 20, "max": 23.999, "grade": "B", "gpa": 6.0, "status": "Pass", "label": "Above Average"},
    {"min": 16, "max": 19.999, "grade": "C", "gpa": 5.0, "status": "Pass", "label": "Average"},
    {"min": 0, "max": 15.999, "grade": "F", "gpa": 0.0, "status": "Fail", "label": "Fail"}
]

def calculate_grade(total_marks):
    """
    Computes Grade and Grade Point Average (GPA) for a given total score out of 40.
    """
    try:
        val = float(total_marks)
    except (TypeError, ValueError):
        val = 0.0

    if val < 0:
        val = 0.0
    if val > 40:
        val = 40.0

    for rule in GRADE_MAP:
        if val >= rule["min"]:
            return {
                "grade": rule["grade"],
                "gpa": rule["gpa"],
                "status": rule["status"],
                "label": rule["label"]
            }

    return {"grade": "F", "gpa": 0.0, "status": "Fail", "label": "Fail"}


def calculate_sgpa(subject_marks_list):
    """
    Calculates Semester Grade Point Average (SGPA):
    SGPA = Sum(Course Credit * Course Grade Point) / Sum(Course Credits)
    subject_marks_list: list of dicts with 'gpa' and 'credits'
    """
    total_credit_points = 0.0
    total_credits = 0.0

    for item in subject_marks_list:
        credits = float(item.get("credits") or 4.0)
        gpa = float(item.get("gpa") or 0.0)
        total_credit_points += (credits * gpa)
        total_credits += credits

    if total_credits == 0:
        return 0.0
    return round(total_credit_points / total_credits, 2)


def calculate_cgpa(semester_sgpa_list):
    """
    Calculates Cumulative Grade Point Average (CGPA):
    semester_sgpa_list: list of dicts with 'sgpa' and 'credits' OR list of all subject marks across semesters
    """
    return calculate_sgpa(semester_sgpa_list)
