import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Briefcase, 
  CheckCircle2, 
  Clock, 
  PlusCircle, 
  FileText, 
  AlertCircle, 
  ArrowUpRight, 
  CheckCircle, 
  XCircle, 
  ChevronRight, 
  RefreshCw,
  Sparkles,
  TrendingUp,
  User,
  GraduationCap
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  StatusBadge,
  Badge,
  Alert,
  StatCard,
  ProgressRing,
  ProgressBar,
  EmptyState,
  Modal,
  Toast,
  Input,
  Select,
  Textarea,
  FileUpload
} from '../components/ui';

export interface RequestItem {
  id: string | number;
  type: 'leave' | 'od';
  title: string;
  startDate: string;
  endDate?: string;
  appliedOn: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'UNDER_REVIEW' | 'SUBMITTED';
  currentStage: string;
  reason: string;
}

export interface ActivityFeedItem {
  id: string | number;
  title: string;
  timestamp: string;
  type: 'leave_approved' | 'od_approved' | 'leave_submitted' | 'od_submitted' | 'attendance_updated';
}

export interface StudentDashboardProps {
  user?: {
    name: string;
    email: string;
    rollNumber?: string;
    department?: string;
    semester?: string;
    leaveBalance?: number;
  };
  attendanceData?: {
    presentDays: number;
    absentDays: number;
    totalWorkingDays: number;
    minRequiredPercentage: number;
  };
  leaveSummaryData?: {
    totalAllowed: number;
    used: number;
    casualUsed: number;
    medicalUsed: number;
  };
  odSummaryData?: {
    approved: number;
    pending: number;
    rejected: number;
  };
  requestsData?: RequestItem[];
  activityData?: ActivityFeedItem[];
  onApplyLeave?: () => void;
  onApplyOd?: () => void;
}

import { profileApi } from '../api/profile';
import { leavesApi } from '../api/leaves';
import { odApi } from '../api/od';
import { notificationsApi } from '../api/profile';

export const StudentDashboard: React.FC<StudentDashboardProps> = (props) => {
  const [userState, setUserState] = useState({
    name: props.user?.name || '',
    email: props.user?.email || '',
    rollNumber: props.user?.rollNumber || '',
    department: props.user?.department || '',
    semester: props.user?.semester || 'Semester 6',
  });

  const [fetchedAttendance, setFetchedAttendance] = useState<{
    presentDays: number;
    absentDays: number;
    totalWorkingDays: number;
    minRequiredPercentage: number;
  } | null>(props.attendanceData || null);

  const [requests, setRequests] = useState<RequestItem[]>(props.requestsData || []);
  const [activity, setActivity] = useState<ActivityFeedItem[]>(props.activityData || []);
  const [odSummary, setOdSummary] = useState({ approved: 0, pending: 0, rejected: 0 });

  const [applyLeaveModal, setApplyLeaveModal] = useState(false);
  const [applyOdModal, setApplyOdModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form fields
  const [leaveStartDate, setLeaveStartDate] = useState('');
  const [leaveEndDate, setLeaveEndDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveCategory, setLeaveCategory] = useState('casual');
  
  const [odTitle, setOdTitle] = useState('');
  const [odDate, setOdDate] = useState('');
  const [odPurpose, setOdPurpose] = useState('');

  const loadDashboardData = async () => {
    try {
      const [profileData, leavesData, odsData, notifData, dashboardData] = await Promise.all([
        profileApi.getProfile().catch(() => null),
        leavesApi.getLeaves().catch(() => []),
        odApi.getOds().catch(() => []),
        notificationsApi.getNotifications().catch(() => []),
        leavesApi.getDashboard().catch(() => null),
      ]);

      if (dashboardData?.attendance) {
        setFetchedAttendance({
          presentDays: dashboardData.attendance.present_days,
          absentDays: dashboardData.attendance.absent_days,
          totalWorkingDays: dashboardData.attendance.total_working_days,
          minRequiredPercentage: dashboardData.attendance.min_required_percentage ?? 80,
        });
      }

      if (profileData) {
        setUserState({
          name: profileData.full_name || profileData.username,
          email: profileData.email,
          rollNumber: profileData.roll_number || profileData.username,
          department: profileData.department || 'Academic Department',
          semester: 'Semester 6',
        });
      }

      let odApp = 0, odPen = 0, odRej = 0;
      const combinedRequests: RequestItem[] = [];

      (leavesData || []).forEach((l: any) => {
        combinedRequests.push({
          id: `L-${l.id}`,
          type: 'leave',
          title: l.is_emergency ? 'Emergency Leave' : 'Academic Leave',
          startDate: l.start_date,
          endDate: l.end_date,
          appliedOn: l.applied_on || 'N/A',
          status: l.status as any,
          currentStage: `Status: ${l.status}`,
          reason: l.reason,
        });
      });

      (odsData || []).forEach((o: any) => {
        if (o.status === 'APPROVED') odApp++;
        else if (o.status === 'REJECTED') odRej++;
        else odPen++;

        combinedRequests.push({
          id: `OD-${o.id}`,
          type: 'od',
          title: o.reason.includes(':') ? o.reason.split(':')[0] : 'Academic On Duty',
          startDate: o.event_date,
          appliedOn: o.applied_on || 'N/A',
          status: o.status as any,
          currentStage: `Status: ${o.status}`,
          reason: o.reason.includes(':') ? o.reason.split(':').slice(1).join(':').trim() : o.reason,
        });
      });

      setRequests(combinedRequests);
      setOdSummary({ approved: odApp, pending: odPen, rejected: odRej });

      if (notifData) {
        setActivity(
          notifData.map((n: any, idx: number) => ({
            id: n.id || idx,
            title: n.title,
            timestamp: n.time,
            type: n.type === 'leave' ? 'leave_approved' : 'od_submitted',
          }))
        );
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const user = userState;
  const attendanceData = fetchedAttendance || props.attendanceData || {
    presentDays: 0,
    absentDays: 0,
    totalWorkingDays: 0,
    minRequiredPercentage: 80,
  };
  const odSummaryData = odSummary;
  const requestsData = requests;
  const activityData = activity;

  // Time Greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Calculated Attendance Metrics
  const { presentDays, absentDays, totalWorkingDays, minRequiredPercentage } = attendanceData;
  const attendancePercentage = totalWorkingDays > 0 ? Math.round((presentDays / totalWorkingDays) * 100) : 100;
  const percentageDifference = attendancePercentage - minRequiredPercentage;
  const isGoodStanding = attendancePercentage >= minRequiredPercentage;

  // Calculated OD Total
  const totalOd = odSummaryData.approved + odSummaryData.pending + odSummaryData.rejected;

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveStartDate || !leaveEndDate || !leaveReason) return;
    try {
      await leavesApi.createLeave({
        start_date: leaveStartDate,
        end_date: leaveEndDate,
        reason: leaveReason,
        is_emergency: leaveCategory === 'emergency',
      });
      setApplyLeaveModal(false);
      setToastMessage('Your leave application has been submitted successfully.');
      setLeaveStartDate('');
      setLeaveEndDate('');
      setLeaveReason('');
      loadDashboardData();
      if (props.onApplyLeave) props.onApplyLeave();
    } catch (err: any) {
      alert(err.message || 'Failed to submit leave');
    }
  };

  const handleOdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!odDate || !odPurpose) return;
    try {
      await odApi.createOd({
        event_date: odDate,
        reason: odTitle ? `${odTitle}: ${odPurpose}` : odPurpose,
      });
      setApplyOdModal(false);
      setToastMessage('Your OD request has been submitted successfully.');
      setOdTitle('');
      setOdDate('');
      setOdPurpose('');
      loadDashboardData();
      if (props.onApplyOd) props.onApplyOd();
    } catch (err: any) {
      alert(err.message || 'Failed to submit OD');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. HERO / COMPACT GREETING HEADER */}
      <div className="bg-surface border border-border rounded-xl p-5 sm:p-6 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
              <GraduationCap className="w-4 h-4" />
              <span>{user.department} • {user.semester}</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-text-primary font-display tracking-tight">
              {getGreeting()}, {user.name} 👋
            </h1>
            <p className="text-xs sm:text-sm text-text-secondary">
              Here is your attendance and OD request overview.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-3 shrink-0 pt-2 md:pt-0">
            <Button
              variant="primary"
              size="md"
              icon={<PlusCircle className="w-4 h-4" />}
              onClick={() => setApplyLeaveModal(true)}
            >
              Apply Leave
            </Button>
            <Button
              variant="secondary"
              size="md"
              icon={<Briefcase className="w-4 h-4 text-info" />}
              onClick={() => setApplyOdModal(true)}
            >
              Apply OD
            </Button>
          </div>
        </div>

        {/* Status Pills Row */}
        <div className="mt-4 pt-4 border-t border-border/60 flex flex-wrap items-center gap-3 text-xs text-text-muted">
          <div className="flex items-center gap-1.5 bg-bg-secondary px-3 py-1 rounded-pill border border-border">
            <User className="w-3.5 h-3.5 text-text-secondary" />
            <span className="text-text-primary font-medium">Roll No:</span> {user.rollNumber}
          </div>
          <div className="flex items-center gap-1.5 bg-bg-secondary px-3 py-1 rounded-pill border border-border">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span>Updated: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-bg-secondary px-3 py-1 rounded-pill border border-border">
            <Sparkles className="w-3.5 h-3.5 text-warning" />
            <span>Academic Year 2025–2026</span>
          </div>
        </div>
      </div>

      {/* DASHBOARD GRID: 2 COLUMNS ON DESKTOP */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN (Span 2): Attendance Overview + OD Summary */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 2. ATTENDANCE OVERVIEW CARD */}
          <Card className="p-6">
            <div className="flex items-center justify-between pb-4 border-b border-border/60 mb-5">
              <div>
                <h3 className="text-base font-semibold text-text-primary">Attendance Overview</h3>
                <p className="text-xs text-text-muted">Live working day logging & eligibility status</p>
              </div>
              <Badge variant={isGoodStanding ? 'success' : 'warning'}>
                {isGoodStanding ? 'Good Standing' : 'Below Minimum Threshold'}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
              {/* Progress Ring */}
              <div className="flex flex-col items-center justify-center p-2 text-center">
                <ProgressRing 
                  value={attendancePercentage} 
                  variant={isGoodStanding ? 'success' : 'danger'} 
                  size={120} 
                  strokeWidth={10}
                >
                  <span className="text-2xl font-bold text-text-primary font-display">{attendancePercentage}%</span>
                  <span className="text-[10px] text-text-muted font-medium">Overall</span>
                </ProgressRing>
              </div>

              {/* Stats Breakdown */}
              <div className="sm:col-span-2 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 bg-bg-secondary rounded-lg border border-border/60">
                    <div className="text-lg font-bold text-success font-display">{presentDays}</div>
                    <div className="text-[11px] text-text-muted font-medium">Present Days</div>
                  </div>
                  <div className="p-3 bg-bg-secondary rounded-lg border border-border/60">
                    <div className="text-lg font-bold text-danger font-display">{absentDays}</div>
                    <div className="text-[11px] text-text-muted font-medium">Absent Days</div>
                  </div>
                  <div className="p-3 bg-bg-secondary rounded-lg border border-border/60">
                    <div className="text-lg font-bold text-text-primary font-display">{totalWorkingDays}</div>
                    <div className="text-[11px] text-text-muted font-medium">Total Days</div>
                  </div>
                </div>

                {/* 3. ATTENDANCE INSIGHT */}
                <div className="p-3.5 bg-success-subtle/40 border border-success/20 rounded-lg flex items-start gap-2.5">
                  <TrendingUp className="w-4 h-4 text-success shrink-0 mt-0.5" />
                  <p className="text-xs text-text-primary leading-relaxed">
                    <span className="font-semibold text-success">Attendance Insight: </span>
                    {percentageDifference >= 0 ? (
                      <>You are currently <span className="font-semibold">{percentageDifference}% above</span> the minimum required {minRequiredPercentage}% attendance threshold for semester exams.</>
                    ) : (
                      <>You are currently <span className="font-semibold">{Math.abs(percentageDifference)}% below</span> the minimum required {minRequiredPercentage}% attendance threshold.</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* 5. OD SUMMARY CARD */}
          <Card className="p-5">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">On Duty (OD) Summary</span>
                <div className="w-8 h-8 rounded-lg bg-info-subtle text-info flex items-center justify-center">
                  <Briefcase className="w-4 h-4" />
                </div>
              </div>

              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-3xl font-bold text-text-primary font-display">{odSummaryData.approved}</span>
                <span className="text-xs text-text-muted">Approved ODs ({totalOd} Total Applied)</span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-center">
                <div className="p-2 bg-bg-secondary rounded">
                  <span className="text-xs font-bold text-success block">{odSummaryData.approved}</span>
                  <span className="text-[10px] text-text-muted">Approved</span>
                </div>
                <div className="p-2 bg-bg-secondary rounded">
                  <span className="text-xs font-bold text-warning block">{odSummaryData.pending}</span>
                  <span className="text-[10px] text-text-muted">Pending</span>
                </div>
                <div className="p-2 bg-bg-secondary rounded">
                  <span className="text-xs font-bold text-danger block">{odSummaryData.rejected}</span>
                  <span className="text-[10px] text-text-muted">Rejected</span>
                </div>
              </div>
            </div>
          </Card>

          {/* 6. RECENT REQUESTS SECTION */}
          <Card className="p-6">
            <div className="flex items-center justify-between pb-4 border-b border-border/60 mb-4">
              <div>
                <h3 className="text-base font-semibold text-text-primary">Recent Applications & Workflow Status</h3>
                <p className="text-xs text-text-muted">Track mentor, faculty, and HOD approval stages</p>
              </div>
              <a href="/my-leaves" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                View All <ChevronRight className="w-3.5 h-3.5" />
              </a>
            </div>

            {requestsData.length === 0 ? (
              <EmptyState
                title="No Active Requests"
                description="You don't have any leave or OD requests currently waiting for approval."
                action={{
                  label: "Apply for Leave",
                  onClick: () => setApplyLeaveModal(true),
                  icon: <PlusCircle className="w-4 h-4" />
                }}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Subject / Reason</th>
                      <th className="py-2.5 px-3">Dates</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Approval Stage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 text-xs">
                    {requestsData.map((req) => (
                      <tr key={req.id} className="hover:bg-surface-elevated/40 transition-colors">
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1.5 font-semibold ${
                            req.type === 'leave' ? 'text-primary' : 'text-info'
                          }`}>
                            {req.type === 'leave' ? <Calendar className="w-3.5 h-3.5" /> : <Briefcase className="w-3.5 h-3.5" />}
                            {req.type.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-text-primary">{req.title}</div>
                          <div className="text-[11px] text-text-muted truncate max-w-[200px]">{req.reason}</div>
                        </td>
                        <td className="py-3 px-3 text-text-secondary whitespace-nowrap">
                          {req.startDate} {req.endDate && req.endDate !== req.startDate ? `to ${req.endDate}` : ''}
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge status={req.status} size="sm" />
                        </td>
                        <td className="py-3 px-3 text-text-muted text-[11px]">
                          {req.currentStage}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

        </div>

        {/* RIGHT COLUMN (Span 1): Recent Activity Feed & Academic Info */}
        <div className="space-y-6">
          
          {/* 8. RECENT ACTIVITY TIMELINE */}
          <Card className="p-5">
            <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-4">
              <h3 className="text-sm font-semibold text-text-primary">Recent Activity Feed</h3>
              <Clock className="w-4 h-4 text-text-muted" />
            </div>

            {activityData.length === 0 ? (
              <div className="text-xs text-text-muted text-center py-6">
                No recent activity recorded.
              </div>
            ) : (
              <div className="relative pl-4 space-y-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                {activityData.map((act) => (
                  <div key={act.id} className="relative flex items-start gap-3 text-xs">
                    <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-surface" />
                    <div>
                      <p className="text-text-primary font-medium leading-normal">{act.title}</p>
                      <span className="text-[10px] text-text-muted">{act.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Quick Helper Box */}
          <Card className="p-5 bg-surface-elevated/40 space-y-3 border border-border">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <AlertCircle className="w-4 h-4 text-primary" />
              <span>Leave & OD Policy Rules</span>
            </div>
            <ul className="text-xs text-text-muted space-y-2 list-disc pl-4 leading-relaxed">
              <li>Medical leaves require supporting certificates for 2+ days duration.</li>
              <li>OD requests must be submitted at least 24 hours prior to event.</li>
              <li>Attendance below 80% flags an automated alert to your mentor.</li>
            </ul>
          </Card>

        </div>

      </div>

      {/* APPLY LEAVE MODAL */}
      <Modal
        isOpen={applyLeaveModal}
        onClose={() => setApplyLeaveModal(false)}
        title="Apply for Academic Leave"
        description="Submit your leave application for mentor and faculty review."
      >
        <form onSubmit={handleLeaveSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={leaveStartDate}
              onChange={(e) => setLeaveStartDate(e.target.value)}
              required
            />
            <Input
              label="End Date"
              type="date"
              value={leaveEndDate}
              onChange={(e) => setLeaveEndDate(e.target.value)}
              required
            />
          </div>
          <Select
            label="Leave Category"
            value={leaveCategory}
            onChange={(e) => setLeaveCategory(e.target.value)}
            options={[
              { value: 'casual', label: 'Casual Leave' },
              { value: 'medical', label: 'Medical Leave' },
              { value: 'emergency', label: 'Emergency Leave' },
            ]}
          />
          <Textarea
            label="Detailed Reason"
            placeholder="Describe explanation for mentor approval..."
            rows={3}
            value={leaveReason}
            onChange={(e) => setLeaveReason(e.target.value)}
            required
          />
          <FileUpload label="Upload Proof / Medical Certificate (Optional)" />
          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <Button variant="ghost" type="button" onClick={() => setApplyLeaveModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit">Submit Leave Request</Button>
          </div>
        </form>
      </Modal>

      {/* APPLY OD MODAL */}
      <Modal
        isOpen={applyOdModal}
        onClose={() => setApplyOdModal(false)}
        title="Apply for On Duty (OD)"
        description="Submit OD application for event coordinator and mentor verification."
      >
        <form onSubmit={handleOdSubmit} className="space-y-4">
          <Input
            label="Event Name / Title"
            placeholder="e.g. State Level Hackathon 2026"
            value={odTitle}
            onChange={(e) => setOdTitle(e.target.value)}
            required
          />
          <Input
            label="Event Date"
            type="date"
            value={odDate}
            onChange={(e) => setOdDate(e.target.value)}
            required
          />
          <Textarea
            label="Event Description & Role"
            placeholder="Detail participation details..."
            rows={3}
            value={odPurpose}
            onChange={(e) => setOdPurpose(e.target.value)}
            required
          />
          <FileUpload label="Upload Event Pass / Invitation Letter (Proof)" />
          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <Button variant="ghost" type="button" onClick={() => setApplyOdModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit">Submit OD Request</Button>
          </div>
        </form>
      </Modal>

      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50">
          <Toast
            type="success"
            title="Request Submitted"
            message={toastMessage}
            onDismiss={() => setToastMessage(null)}
          />
        </div>
      )}

    </div>
  );
};
