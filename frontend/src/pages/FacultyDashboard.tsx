import React, { useState, useEffect } from 'react';
import { 
  Users, 
  CheckSquare, 
  Clock, 
  FileCheck, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  BookOpen, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { Card, PageHeader, Badge, Button, StatCard, LoadingState } from '../components/ui';
import { studentsApi, StudentRosterItem } from '../api/students';
import { leavesApi } from '../api/leaves';
import { StudentDetailModal } from '../components/StudentDetailModal';

export interface FacultyDashboardProps {
  onNavigate: (path: string) => void;
}

export const FacultyDashboard: React.FC<FacultyDashboardProps> = ({ onNavigate }) => {
  const [students, setStudents] = useState<StudentRosterItem[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewingStudentId, setViewingStudentId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      studentsApi.getStudents().catch(() => []),
      leavesApi.getPendingQueue().catch(() => ({ pending_leaves: [], pending_ods: [] })),
    ])
      .then(([rosterData, pendingData]) => {
        setStudents(rosterData);
        const totalPending = (pendingData.pending_leaves?.length || 0) + (pendingData.pending_ods?.length || 0);
        setPendingCount(totalPending);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalStudents = students.length;
  const goodStandingCount = students.filter((s) => s.attendance.percentage >= 75).length;
  const shortageCount = students.filter((s) => s.attendance.percentage < 70).length;
  const shortageStudents = students.filter((s) => s.attendance.percentage < 75);

  if (loading) {
    return (
      <div className="p-12">
        <LoadingState message="Loading Class Advisor Dashboard & Attendance Analytics..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Class Advisor Dashboard"
        subtitle="Manage assigned class section attendance, monitor attendance standing, and process leave requests."
        badge={<Badge variant="primary">{totalStudents} Class Cohort Students</Badge>}
        actions={
          <Button
            variant="primary"
            icon={<CheckSquare className="w-4 h-4" />}
            onClick={() => onNavigate('/attendance')}
          >
            Mark Attendance Today
          </Button>
        }
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Assigned Students"
          value={totalStudents}
          subtitle="Total enrolled in cohort"
          icon={<Users className="w-5 h-5 text-primary" />}
        />
        <StatCard
          label="Good Standing (>=75%)"
          value={goodStandingCount}
          subtitle={`${totalStudents > 0 ? Math.round((goodStandingCount / totalStudents) * 100) : 0}% of cohort compliant`}
          icon={<CheckCircle2 className="w-5 h-5 text-success" />}
        />
        <StatCard
          label="Shortage Risk (<70%)"
          value={shortageCount}
          subtitle="Students below threshold"
          icon={<AlertTriangle className="w-5 h-5 text-danger" />}
        />
        <StatCard
          label="Pending Queue"
          value={pendingCount}
          subtitle="Approvals awaiting review"
          icon={<Clock className="w-5 h-5 text-warning" />}
        />
      </div>

      {/* Quick Action Shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className="p-5 border-l-4 border-l-primary hover:bg-surface-elevated/40 transition-colors cursor-pointer group"
          onClick={() => onNavigate('/attendance')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary-subtle text-primary group-hover:scale-105 transition-transform">
                <CheckSquare className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-text-primary group-hover:text-primary transition-colors">Mark Attendance</h4>
                <p className="text-xs text-text-muted mt-0.5">Record daily class attendance</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-text-muted group-hover:text-primary transition-colors" />
          </div>
        </Card>

        <Card
          className="p-5 border-l-4 border-l-info hover:bg-surface-elevated/40 transition-colors cursor-pointer group"
          onClick={() => onNavigate('/students')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-info-subtle text-info group-hover:scale-105 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-text-primary group-hover:text-info transition-colors">My Students Roster</h4>
                <p className="text-xs text-text-muted mt-0.5">View profiles & records</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-text-muted group-hover:text-info transition-colors" />
          </div>
        </Card>

        <Card
          className="p-5 border-l-4 border-l-warning hover:bg-surface-elevated/40 transition-colors cursor-pointer group"
          onClick={() => onNavigate('/pending-leaves')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-warning-subtle text-warning group-hover:scale-105 transition-transform">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-text-primary group-hover:text-warning transition-colors">Pending Queue</h4>
                <p className="text-xs text-text-muted mt-0.5">{pendingCount} requests waiting</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-text-muted group-hover:text-warning transition-colors" />
          </div>
        </Card>
      </div>

      {/* Attendance Shortage Warning Section */}
      <Card className="overflow-hidden p-0">
        <div className="p-4 bg-surface-elevated/40 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <h3 className="font-bold text-sm text-text-primary">Attendance Shortage & Borderline Watchlist (&lt;75%)</h3>
          </div>
          <Badge variant="warning">{shortageStudents.length} Students</Badge>
        </div>

        {shortageStudents.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-muted">
            <ShieldCheck className="w-8 h-8 text-success mx-auto mb-2" />
            Great job! All students in your assigned class cohort are maintaining $\ge$ 75% attendance.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-surface-elevated/20 border-b border-border text-[11px] font-semibold text-text-muted uppercase">
                <tr>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Roll Number</th>
                  <th className="py-3 px-4">Class Section</th>
                  <th className="py-3 px-4">Attendance Standing</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {shortageStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-elevated/30 transition-colors">
                    <td className="py-3 px-4 font-semibold text-text-primary">{s.full_name || s.username}</td>
                    <td className="py-3 px-4 text-text-muted font-mono">{s.register_number}</td>
                    <td className="py-3 px-4 text-text-secondary">{s.class_group}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${s.attendance.percentage >= 70 ? 'text-warning' : 'text-danger'}`}>
                          {s.attendance.percentage}%
                        </span>
                        <Badge variant={s.attendance.percentage >= 70 ? 'warning' : 'danger'} size="sm">
                          {s.attendance.percentage >= 70 ? 'Borderline' : 'Shortage Alert'}
                        </Badge>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewingStudentId(s.id)}
                      >
                        View Profile
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Student Detail Modal */}
      <StudentDetailModal
        studentId={viewingStudentId}
        isOpen={viewingStudentId !== null}
        onClose={() => setViewingStudentId(null)}
      />
    </div>
  );
};
