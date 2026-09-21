import os

from ..extensions import db
from ..models import ClassGroup, Department, Role, User


def ensure_seed_data():
    admin_password = os.environ.get("INIT_ADMIN_PASSWORD")
    if not admin_password:
        return "INIT_ADMIN_PASSWORD must be set before creating seed users.", 400

    db.create_all()

    cs_department = Department.query.filter_by(name="Computer Science").first()
    if not cs_department:
        cs_department = Department(name="Computer Science")
        db.session.add(cs_department)
        db.session.commit()

    class_group = ClassGroup.query.filter_by(year=1, section="A", department_id=cs_department.id).first()
    if not class_group:
        class_group = ClassGroup(year=1, section="A", department_id=cs_department.id)
        db.session.add(class_group)
        db.session.commit()

    if not User.query.filter_by(username="admin").first():
        admin = User(
            username="admin",
            email="admin@example.com",
            full_name="Administrator",
            role=Role.ADMIN.value,
        )
        admin.set_password(admin_password)
        db.session.add(admin)
        db.session.commit()

    if not User.query.filter_by(username="hod").first():
        hod = User(
            username="hod",
            email="hod@example.com",
            full_name="Head of Department",
            role=Role.HOD.value,
            department_id=cs_department.id,
        )
        hod.set_password(os.environ.get("INIT_HOD_PASSWORD", "change-me-hod"))
        db.session.add(hod)
        db.session.commit()
        cs_department.hod_id = hod.id
        db.session.commit()

    if not User.query.filter_by(username="faculty").first():
        faculty = User(
            username="faculty",
            email="faculty@example.com",
            full_name="Faculty Member",
            role=Role.FACULTY.value,
            department_id=cs_department.id,
        )
        faculty.set_password(os.environ.get("INIT_FACULTY_PASSWORD", "change-me-faculty"))
        db.session.add(faculty)
        db.session.commit()
        class_group.faculty_id = faculty.id
        db.session.commit()

    if not User.query.filter_by(username="mentor").first():
        mentor = User(
            username="mentor",
            email="mentor@example.com",
            full_name="Mentor One",
            role=Role.MENTOR.value,
            department_id=cs_department.id,
        )
        mentor.set_password(os.environ.get("INIT_MENTOR_PASSWORD", "password123"))
        db.session.add(mentor)
        db.session.commit()

    if not User.query.filter_by(username="coordinator").first():
        coordinator = User(
            username="coordinator",
            email="coordinator@example.com",
            full_name="Event Coordinator",
            role=Role.EVENT_COORDINATOR.value,
            department_id=cs_department.id,
        )
        coordinator.set_password(os.environ.get("INIT_COORDINATOR_PASSWORD", "password123"))
        db.session.add(coordinator)
        db.session.commit()

    if not User.query.filter_by(username="student").first():
        mentor_user = User.query.filter_by(username="mentor").first()
        student = User(
            username="student",
            email="student@example.com",
            full_name="Student One",
            role=Role.STUDENT.value,
            class_group_id=class_group.id,
            department_id=cs_department.id,
            mentor_id=mentor_user.id if mentor_user else None,
        )
        student.set_password(os.environ.get("INIT_STUDENT_PASSWORD", "change-me-student"))
        db.session.add(student)
        db.session.commit()

    return "Database initialized with guarded sample users.", 200
