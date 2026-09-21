import pytest
from datetime import date
from leave_app import create_app
from leave_app.extensions import db
from leave_app.models import User, Department, ClassGroup, Role


@pytest.fixture
def app():
    # Set up in-memory SQLite database configuration
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "CSRF_ENABLED": False,
        "WTF_CSRF_ENABLED": False,
        "LOGIN_RATE_LIMIT_ENABLED": False,
    })

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def seed_data(app):
    # Create a department
    dept = Department(name="Engineering")
    db.session.add(dept)
    db.session.flush()

    # Create HOD user
    hod = User(
        username="dept_hod",
        email="hod@example.com",
        role=Role.HOD.value,
        full_name="Department HOD",
    )
    hod.set_password("password")
    db.session.add(hod)
    db.session.flush()
    dept.hod_id = hod.id

    # Create Faculty Advisor user
    faculty = User(
        username="class_faculty",
        email="faculty@example.com",
        role=Role.FACULTY.value,
        full_name="Class Faculty",
    )
    faculty.set_password("password")
    db.session.add(faculty)
    db.session.flush()

    # Create Class Group
    class_group = ClassGroup(
        department_id=dept.id,
        year=3,
        section="A",
        faculty_id=faculty.id,
    )
    db.session.add(class_group)
    db.session.flush()

    # Create Mentor user
    mentor = User(
        username="student_mentor",
        email="mentor@example.com",
        role=Role.MENTOR.value,
        full_name="Student Mentor",
    )
    mentor.set_password("password")
    db.session.add(mentor)
    db.session.flush()

    # Create Student user
    student = User(
        username="test_student",
        email="student@example.com",
        role=Role.STUDENT.value,
        full_name="Test Student",
        mentor_id=mentor.id,
        department_id=dept.id,
        class_group_id=class_group.id,
    )
    student.set_password("password")
    db.session.add(student)
    db.session.commit()

    return {
        "dept": dept,
        "hod": hod,
        "faculty": faculty,
        "class_group": class_group,
        "mentor": mentor,
        "student": student,
    }
