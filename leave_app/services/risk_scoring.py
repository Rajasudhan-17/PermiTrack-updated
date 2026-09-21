from datetime import datetime, timezone, timedelta
from ..models import Leave, OD, RequestStatus, utcnow

def calculate_leave_risk(leave):
    """
    Evaluates risk score (0-100) and returns (score, level, reasons) for a leave request.
    
    Threshold Rationale:
    - "Low" (<20): Minor or no anomalies. Normal requests with safe balance margins. 
      These represent standard leave patterns and can be reviewed quickly.
    - "Medium" (20-49): Anomaly metrics that warrant faculty advisor investigation but do 
      not represent severe violations. Examples include a single request with a long duration 
      (>5 days) or a low leave balance.
    - "High" (>=50): Critical anomalies or multiple cumulative risk factors that indicate 
      high absenteeism risk, emergency pattern abuse, or potential attendance threshold 
      violations (<80% attendance). These require strict verification by the HOD.
    """
    user = leave.requester
    if not user:
        return 0, "Low", ["No requester found"]

    score = 0
    reasons = []

    # 1. Frequency of emergency leaves this month (past 30 days)
    thirty_days_ago = utcnow() - timedelta(days=30)
    emergency_count = Leave.query.filter(
        Leave.requested_by == user.id,
        Leave.is_emergency == True,
        Leave.applied_on >= thirty_days_ago
    ).count()

    if emergency_count >= 3:
        score += 35
        reasons.append(f"High frequency of emergency leaves ({emergency_count} in last 30 days)")
    elif emergency_count == 2:
        score += 15
        reasons.append("Frequent emergency leaves (2 in last 30 days)")

    # 3. Cumulative absence risk (attendance impact over past 90 days)
    ninety_days_ago = utcnow() - timedelta(days=90)
    
    # Approved leaves duration sum
    approved_leaves = Leave.query.filter(
        Leave.requested_by == user.id,
        Leave.status == RequestStatus.APPROVED.value,
        Leave.start_date >= ninety_days_ago.date()
    ).all()
    approved_leave_days = sum((l.end_date - l.start_date).days + 1 for l in approved_leaves)

    # Approved OD count (each event is 1 day)
    approved_od_count = OD.query.filter(
        OD.requested_by == user.id,
        OD.status == RequestStatus.APPROVED.value,
        OD.event_date >= ninety_days_ago.date()
    ).count()

    # Current request duration
    req_days = (leave.end_date - leave.start_date).days + 1
    total_absence = approved_leave_days + approved_od_count + req_days

    if total_absence > 15:
        score += 30
        reasons.append(f"Cumulative absences ({total_absence} days in 90 days) risk dropping attendance below 80%")
    elif total_absence > 8:
        score += 15
        reasons.append(f"Cumulative absences ({total_absence} days in 90 days) risk dropping attendance below 90%")

    # 4. Long request duration
    if req_days > 5:
        score += 15
        reasons.append(f"Long duration request ({req_days} days)")

    # Cap score at 100
    score = min(score, 100)

    # Determine risk level
    if score >= 50:
        level = "High"
    elif score >= 20:
        level = "Medium"
    else:
        level = "Low"

    return score, level, reasons


def calculate_od_risk(od):
    """
    Evaluates risk score (0-100) and returns (score, level, reasons) for an OD request.

    Threshold Rationale:
    - "Low" (<20): Minor or no anomalies. Normal requests with safe cumulative absences.
    - "Medium" (20-49): Moderate OD request volume (3-4 requests per month) or mild cumulative absence thresholds.
    - "High" (>=50): Critical anomalies or excessive event-based absences. Highlights high academic-loss risks 
      due to excessive monthly OD submissions or cumulative absences threatening attendance thresholds.
    """
    user = od.requester
    if not user:
        return 0, "Low", ["No requester found"]

    score = 0
    reasons = []

    # 1. Attendance Drop / Absence Threshold (over past 90 days)
    ninety_days_ago = utcnow() - timedelta(days=90)
    
    approved_leaves = Leave.query.filter(
        Leave.requested_by == user.id,
        Leave.status == RequestStatus.APPROVED.value,
        Leave.start_date >= ninety_days_ago.date()
    ).all()
    approved_leave_days = sum((l.end_date - l.start_date).days + 1 for l in approved_leaves)

    approved_od_count = OD.query.filter(
        OD.requested_by == user.id,
        OD.status == RequestStatus.APPROVED.value,
        OD.event_date >= ninety_days_ago.date()
    ).count()

    total_absence = approved_leave_days + approved_od_count + 1  # current OD is 1 day

    if total_absence > 15:
        score += 30
        reasons.append(f"Cumulative absences ({total_absence} days in 90 days) risk dropping attendance below 80%")
    elif total_absence > 8:
        score += 15
        reasons.append(f"Cumulative absences ({total_absence} days in 90 days) risk dropping attendance below 90%")

    # 2. Frequency of OD requests this month
    thirty_days_ago = utcnow() - timedelta(days=30)
    od_count_this_month = OD.query.filter(
        OD.requested_by == user.id,
        OD.event_date >= thirty_days_ago.date()
    ).count()

    if od_count_this_month >= 5:
        score += 40
        reasons.append(f"Excessive monthly OD requests ({od_count_this_month} requests in last 30 days)")
    elif od_count_this_month >= 3:
        score += 20
        reasons.append(f"High monthly OD requests ({od_count_this_month} requests in last 30 days)")

    # Cap score at 100
    score = min(score, 100)

    # Determine risk level
    if score >= 50:
        level = "High"
    elif score >= 20:
        level = "Medium"
    else:
        level = "Low"

    return score, level, reasons
