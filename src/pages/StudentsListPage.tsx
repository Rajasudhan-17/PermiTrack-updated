import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Calendar, 
  Briefcase, 
  CheckSquare, 
  FileText, 
  User, 
  GraduationCap, 
  Eye, 
  Clock, 
  AlertCircle,
  X
} from 'lucide-react';
import {
  Card,
  PageHeader,
  Input,
  Badge,
  Button,
  StatusBadge,
  Modal,
  ProgressRing,
  StatCard,
  EmptyState,
  LoadingState
} from '../components/ui';
import { studentsApi, StudentRosterItem, StudentDetailPayload } from '../api/students';
import { StudentDetailModal } from '../components/StudentDetailModal';

export const StudentsListPage: React.FC = () => {
  const [students, setStudents] = useState<StudentRosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected student for modal detail view
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<StudentDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'attendance' | 'leaves' | 'ods'>('attendance');

  const loadStudents = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await studentsApi.getStudents();
      setStudents(data || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch students list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const openStudentDetail = async (studentId: number) => {
    setSelectedStudentId(studentId);
    setDetailLoading(true);
    setActiveTab('attendance');
    try {
      const detail = await studentsApi.getStudentDetail(studentId);
      setDetailData(detail);
    } catch (err: any) {
      alert(err.message || 'Failed to load student details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetailModal = () => {
    setSelectedStudentId(null);
    setDetailData(null);
  };

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      s.full_name.toLowerCase().includes(q) ||
      s.register_number.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.department.toLowerCase().includes(q) ||
      s.class_group.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Student Roster & Attendance Directory"
        subtitle="View assigned students, monitor attendance percentages, and review complete leave & OD histories."
        badge={<Badge variant="primary">{`${students.length} Total Students`}</Badge>}
      />

      {/* Filter / Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by student name, register number, email, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-surface-elevated/50 border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors"
            />
          </div>
          <div className="text-xs text-text-muted shrink-0 font-medium">
            Showing {filteredStudents.length} of {students.length} students
          </div>
        </div>
      </Card>

      {/* Students Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12">
            <LoadingState message="Loading students roster and attendance standing..." />
          </div>
        ) : errorMsg ? (
          <div className="p-8 text-center text-sm text-danger space-y-2">
            <AlertCircle className="w-8 h-8 text-danger mx-auto" />
            <p className="font-semibold">{errorMsg}</p>
            <Button variant="outline" size="sm" onClick={loadStudents}>Retry</Button>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12">
            <EmptyState
              title="No Students Found"
              description={searchQuery ? "No student matching your search query was found." : "There are no students assigned to your view."}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-elevated/40 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  <th className="py-3 px-4">Student Info</th>
                  <th className="py-3 px-4">Dept & Class</th>
                  <th className="py-3 px-4">Attendance Standing</th>
                  <th className="py-3 px-4 text-center">Leaves Taken</th>
                  <th className="py-3 px-4 text-center">ODs Taken</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-xs">
                {filteredStudents.map((s) => {
                  const pct = s.attendance.percentage;
                  const isGood = pct >= 80;
                  return (
                    <tr 
                      key={s.id} 
                      className="hover:bg-surface-elevated/60 transition-colors group cursor-pointer"
                      onClick={() => openStudentDetail(s.id)}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0 border border-primary/20">
                            {s.full_name[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-text-primary text-sm group-hover:text-primary transition-colors flex items-center gap-1.5">
                              <span>{s.full_name}</span>
                            </div>
                            <div className="text-[11px] text-text-muted font-mono">Reg: {s.register_number}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-text-primary">{s.department}</div>
                        <div className="text-[11px] text-text-muted">{s.class_group}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <Badge variant={isGood ? 'success' : 'danger'} size="md">
                            {pct}% Attendance
                          </Badge>
                          <span className="text-[11px] text-text-muted">
                            ({s.attendance.present_days + s.attendance.od_days}/{s.attendance.total_working_days} Days)
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 font-semibold text-primary bg-primary-subtle px-2.5 py-1 rounded-full text-xs">
                          <Calendar className="w-3.5 h-3.5" />
                          {s.leaves_count}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 font-semibold text-info bg-info-subtle px-2.5 py-1 rounded-full text-xs">
                          <Briefcase className="w-3.5 h-3.5" />
                          {s.ods_count}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Button 
                          variant="secondary" 
                          size="sm"
                          icon={<Eye className="w-3.5 h-3.5 text-primary" />}
                          onClick={(e) => {
                            e.stopPropagation();
                            openStudentDetail(s.id);
                          }}
                        >
                          View Details
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* STUDENT DETAIL MODAL */}
      <StudentDetailModal
        studentId={selectedStudentId}
        isOpen={selectedStudentId !== null}
        onClose={closeDetailModal}
      />
    </div>
  );
};
