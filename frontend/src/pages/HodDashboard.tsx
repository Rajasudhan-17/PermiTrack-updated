import React, { useState, useEffect } from 'react';
import { 
  Building, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  ArrowRight,
  TrendingUp,
  FileCheck
} from 'lucide-react';
import { Card, PageHeader, Badge, Button, StatCard, LoadingState } from '../components/ui';
import { studentsApi, StudentRosterItem } from '../api/students';
import { leavesApi } from '../api/leaves';
import { StudentDetailModal } from '../components/StudentDetailModal';

export interface HodDashboardProps {
  onNavigate: (path: string) => void;
}

export const HodDashboard: React.FC<HodDashboardProps> = ({ onNavigate }) => {
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
  const deptName = students.length > 0 ? students[0].department : 'Department';

  if (loading) {
    return (
      <div className="p-12">
        <LoadingState message="Loading HOD Executive Dashboard & Department Analytics..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={`${deptName} — HOD Executive Dashboard`}
        subtitle="Department-wide academic oversight, final approval sign-offs, and attendance metrics."
        badge={<Badge variant="primary">{totalStudents} Department Enrolled Students</Badge>}
        actions={
          <Button
            variant="primary"
            icon={<Clock className="w-4 h-4" />}
            onClick={() => onNavigate('/pending-leaves')}
          >
            HOD Executive Approvals ({pendingCount})
          </Button>
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Department Students"
          value={totalStudents}
          subtitle="Enrolled in department"
          icon={<Building className="w-5 h-5 text-primary" />}
        />
        <StatCard
          label="Good Standing (>=75%)"
          value={goodStandingCount}
          subtitle={`${totalStudents > 0 ? Math.round((goodStandingCount / totalStudents) * 100) : 0}% compliant`}
          icon={<CheckCircle2 className="w-5 h-5 text-success" />}
        />
        <StatCard
          label="Shortage Risk (<70%)"
          value={shortageCount}
          subtitle="Department shortage alerts"
          icon={<AlertTriangle className="w-5 h-5 text-danger" />}
        />
        <StatCard
          label="Executive Queue"
          value={pendingCount}
          subtitle="Faculty-approved requests"
          icon={<Clock className="w-5 h-5 text-warning" />}
        />
      </div>

      {/* Action Shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className="p-5 border-l-4 border-l-primary hover:bg-surface-elevated/40 transition-colors cursor-pointer group"
          onClick={() => onNavigate('/students')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary-subtle text-primary group-hover:scale-105 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-text-primary group-hover:text-primary transition-colors">Department Student Directory</h4>
                <p className="text-xs text-text-muted mt-0.5">Full student roster with attendance history</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-text-muted group-hover:text-primary transition-colors" />
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
                <h4 className="font-bold text-sm text-text-primary group-hover:text-warning transition-colors">Executive Approval Queue</h4>
                <p className="text-xs text-text-muted mt-0.5">{pendingCount} requests awaiting HOD sign-off</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-text-muted group-hover:text-warning transition-colors" />
          </div>
        </Card>
      </div>

      {/* Department Roster Summary */}
      <Card className="overflow-hidden p-0">
        <div className="p-4 bg-surface-elevated/40 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm text-text-primary">Department Student Attendance Roster</h3>
          </div>
          <Badge variant="primary">{students.length} Enrolled</Badge>
        </div>

        {students.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-muted">
            No students found for this department.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-surface-elevated/20 border-b border-border text-[11px] font-semibold text-text-muted uppercase">
                <tr>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Register No</th>
                  <th className="py-3 px-4">Class Section</th>
                  <th className="py-3 px-4">Attendance Standing</th>
                  <th className="py-3 px-4">Leaves / ODs</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-elevated/30 transition-colors">
                    <td className="py-3 px-4 font-semibold text-text-primary">{s.full_name || s.username}</td>
                    <td className="py-3 px-4 text-text-muted font-mono">{s.register_number}</td>
                    <td className="py-3 px-4 text-text-secondary">{s.class_group}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${
                          s.attendance.percentage >= 75 ? 'text-success' : s.attendance.percentage >= 70 ? 'text-warning' : 'text-danger'
                        }`}>
                          {s.attendance.percentage}%
                        </span>
                        <Badge
                          variant={s.attendance.percentage >= 75 ? 'success' : s.attendance.percentage >= 70 ? 'warning' : 'danger'}
                          size="sm"
                        >
                          {s.attendance.percentage >= 75 ? 'Good Standing' : s.attendance.percentage >= 70 ? 'Borderline' : 'Shortage Alert'}
                        </Badge>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-text-muted">
                      {s.leaves_count} Leaves • {s.ods_count} ODs
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
