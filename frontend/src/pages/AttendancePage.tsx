import React, { useState, useEffect } from 'react';
import { CheckSquare, Calendar, TrendingUp, AlertTriangle } from 'lucide-react';
import {
  Card,
  PageHeader,
  StatCard,
  ProgressRing,
  ProgressBar,
  Badge,
  Alert
} from '../components/ui';
import { leavesApi } from '../api/leaves';

export const AttendancePage: React.FC = () => {
  const [attendanceData, setAttendanceData] = useState({
    presentDays: 0,
    odDays: 0,
    absentDays: 0,
    leaveDays: 0,
    totalWorkingDays: 0,
    minRequiredPercentage: 80,
    overallPercentage: 100,
  });

  useEffect(() => {
    leavesApi.getDashboard()
      .then(res => {
        if (res?.attendance) {
          setAttendanceData({
            presentDays: res.attendance.present_days,
            odDays: res.attendance.od_days || 0,
            absentDays: res.attendance.absent_days,
            leaveDays: res.attendance.leave_days || 0,
            totalWorkingDays: res.attendance.total_working_days,
            minRequiredPercentage: res.attendance.min_required_percentage ?? 80,
            overallPercentage: res.attendance.percentage,
          });
        }
      })
      .catch(err => console.error('Failed to load attendance metrics', err));
  }, []);

  const subjectBreakdown = [
    { code: 'CS-601', name: 'Web Engineering Lab', present: attendanceData.presentDays + attendanceData.odDays, total: attendanceData.totalWorkingDays, percentage: attendanceData.overallPercentage },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Attendance Analytics & History"
        subtitle="Detailed log of your working day attendance, subject breakdowns, and exam eligibility."
        badge={<Badge variant={attendanceData.overallPercentage >= 80 ? "success" : "warning"}>{`${attendanceData.overallPercentage}% Overall Standing`}</Badge>}
      />

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Overall Percentage"
          value={`${attendanceData.overallPercentage}%`}
          icon={<CheckSquare className="w-5 h-5" />}
          variant="success"
          subtitle="Includes Present + OD"
        />
        <StatCard
          label="Days Present"
          value={attendanceData.presentDays}
          icon={<Calendar className="w-5 h-5" />}
          variant="primary"
          subtitle={`Out of ${attendanceData.totalWorkingDays} days`}
        />
        <StatCard
          label="On Duty (OD) Days"
          value={attendanceData.odDays}
          variant="info"
          subtitle="Counted as Present"
        />
        <StatCard
          label="Days Absent"
          value={attendanceData.absentDays}
          variant="danger"
          subtitle={`${attendanceData.leaveDays} Approved Leaves`}
        />
      </div>

      {/* Analytics Main Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visual Progress Ring Card */}
        <Card className="p-6 flex flex-col items-center justify-center text-center space-y-4">
          <ProgressRing value={attendanceData.overallPercentage} variant="success" size={140} strokeWidth={12}>
            <span className="text-3xl font-bold text-text-primary font-display">{attendanceData.overallPercentage}%</span>
            <span className="text-xs text-text-muted font-medium">Eligible</span>
          </ProgressRing>
          <div>
            <h3 className="text-base font-semibold text-text-primary">Hall Ticket Eligibility Status</h3>
            <p className="text-xs text-text-muted mt-1">
              You are <span className="font-semibold text-success">12% above</span> the minimum required threshold.
            </p>
          </div>
        </Card>

        {/* Subject Breakdown Table */}
        <Card className="lg:col-span-2 p-6">
          <h3 className="text-base font-semibold text-text-primary mb-4">Subject-wise Attendance Breakdown</h3>
          <div className="space-y-4">
            {subjectBreakdown.map((sub) => (
              <div key={sub.code} className="space-y-1.5 p-3 bg-bg-secondary rounded-lg border border-border">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold font-mono text-primary mr-2">{sub.code}</span>
                    <span className="font-semibold text-text-primary">{sub.name}</span>
                  </div>
                  <span className="font-bold text-text-primary">{sub.present} / {sub.total} ({sub.percentage}%)</span>
                </div>
                <ProgressBar value={sub.percentage} variant={sub.percentage >= 80 ? 'primary' : 'warning'} size="sm" showPercentage={false} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
