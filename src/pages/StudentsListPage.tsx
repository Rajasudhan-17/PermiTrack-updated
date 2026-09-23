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
      <Modal
        isOpen={selectedStudentId !== null}
        onClose={closeDetailModal}
        title={detailData ? `${detailData.student.full_name} — Detailed Profile & Record` : 'Loading Student Profile...'}
        size="lg"
      >
        {detailLoading || !detailData ? (
          <div className="p-12">
            <LoadingState message="Fetching student attendance, leaves, and OD logs..." />
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Top Student Banner Info */}
            <div className="bg-surface-elevated/40 border border-border rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary text-[#07151F] font-bold text-lg flex items-center justify-center shrink-0 shadow-sm">
                  {detailData.student.full_name[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-base text-text-primary">{detailData.student.full_name}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted mt-0.5 font-mono">
                    <span>Reg: {detailData.student.register_number}</span>
                    <span>•</span>
                    <span>{detailData.student.email}</span>
                  </div>
                </div>
              </div>

              <div className="text-xs space-y-1 text-text-secondary sm:text-right">
                <div><span className="font-semibold text-text-primary">Department:</span> {detailData.student.department}</div>
                <div><span className="font-semibold text-text-primary">Class Group:</span> {detailData.student.class_group}</div>
                <div><span className="font-semibold text-text-primary">Mentor:</span> {detailData.student.mentor_name}</div>
              </div>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <button
                onClick={() => setActiveTab('attendance')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  activeTab === 'attendance'
                    ? 'bg-primary text-[#07151F]'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Attendance Analytics ({detailData.attendance.percentage}%)</span>
              </button>
              <button
                onClick={() => setActiveTab('leaves')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  activeTab === 'leaves'
                    ? 'bg-primary text-[#07151F]'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Leaves Taken ({detailData.leaves.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('ods')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  activeTab === 'ods'
                    ? 'bg-primary text-[#07151F]'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>ODs Taken ({detailData.ods.length})</span>
              </button>
            </div>

            {/* TAB 1: ATTENDANCE OVERVIEW */}
            {activeTab === 'attendance' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center p-4 bg-surface border border-border rounded-xl">
                  <div className="flex flex-col items-center justify-center p-2 text-center">
                    <ProgressRing 
                      value={detailData.attendance.percentage} 
                      variant={detailData.attendance.percentage >= 80 ? 'success' : 'danger'} 
                      size={110} 
                      strokeWidth={10}
                    >
                      <span className="text-xl font-bold text-text-primary font-display">{detailData.attendance.percentage}%</span>
                      <span className="text-[10px] text-text-muted font-medium">Standing</span>
                    </ProgressRing>
                  </div>

                  <div className="sm:col-span-2 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="p-2.5 bg-bg-secondary rounded-lg border border-border/60">
                        <div className="text-base font-bold text-success font-display">{detailData.attendance.present_days}</div>
                        <div className="text-[10px] text-text-muted font-medium">Present</div>
                      </div>
                      <div className="p-2.5 bg-bg-secondary rounded-lg border border-border/60">
                        <div className="text-base font-bold text-info font-display">{detailData.attendance.od_days}</div>
                        <div className="text-[10px] text-text-muted font-medium">OD Days</div>
                      </div>
                      <div className="p-2.5 bg-bg-secondary rounded-lg border border-border/60">
                        <div className="text-base font-bold text-danger font-display">{detailData.attendance.absent_days}</div>
                        <div className="text-[10px] text-text-muted font-medium">Absent</div>
                      </div>
                      <div className="p-2.5 bg-bg-secondary rounded-lg border border-border/60">
                        <div className="text-base font-bold text-text-primary font-display">{detailData.attendance.total_working_days}</div>
                        <div className="text-[10px] text-text-muted font-medium">Total Days</div>
                      </div>
                    </div>

                    <div className="p-3 bg-bg-secondary/60 border border-border rounded-lg text-xs text-text-secondary leading-relaxed">
                      Effective present days (Present + OD) count: <span className="font-bold text-text-primary">{detailData.attendance.present_days + detailData.attendance.od_days}</span> of <span className="font-bold text-text-primary">{detailData.attendance.total_working_days}</span> working days logged.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: LEAVES TAKEN */}
            {activeTab === 'leaves' && (
              <div className="space-y-3">
                {detailData.leaves.length === 0 ? (
                  <div className="py-8 text-center text-xs text-text-muted">
                    No leave requests found for this student.
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto border border-border rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-surface-elevated/40 border-b border-border sticky top-0 font-semibold text-text-muted uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3">Dates</th>
                          <th className="py-2.5 px-3">Reason / Category</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Applied On</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {detailData.leaves.map((l) => (
                          <tr key={l.id} className="hover:bg-surface-elevated/40">
                            <td className="py-2.5 px-3 font-medium text-text-primary whitespace-nowrap">
                              {l.start_date} {l.end_date !== l.start_date ? `to ${l.end_date}` : ''}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-medium text-text-primary flex items-center gap-1.5">
                                {l.is_emergency && <Badge variant="danger" size="sm">Emergency</Badge>}
                                <span>{l.reason}</span>
                              </div>
                              {l.review_comment && (
                                <div className="text-[10px] text-text-muted mt-0.5">Remark: {l.review_comment}</div>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <StatusBadge status={l.status as any} size="sm" />
                            </td>
                            <td className="py-2.5 px-3 text-text-muted whitespace-nowrap">
                              {l.applied_on}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: ODS TAKEN */}
            {activeTab === 'ods' && (
              <div className="space-y-3">
                {detailData.ods.length === 0 ? (
                  <div className="py-8 text-center text-xs text-text-muted">
                    No On Duty (OD) requests found for this student.
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto border border-border rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-surface-elevated/40 border-b border-border sticky top-0 font-semibold text-text-muted uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3">Event Date</th>
                          <th className="py-2.5 px-3">Purpose / Event Reason</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Applied On</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {detailData.ods.map((o) => (
                          <tr key={o.id} className="hover:bg-surface-elevated/40">
                            <td className="py-2.5 px-3 font-medium text-text-primary whitespace-nowrap">
                              {o.event_date}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-medium text-text-primary">{o.reason}</div>
                              {o.review_comment && (
                                <div className="text-[10px] text-text-muted mt-0.5">Remark: {o.review_comment}</div>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <StatusBadge status={o.status as any} size="sm" />
                            </td>
                            <td className="py-2.5 px-3 text-text-muted whitespace-nowrap">
                              {o.applied_on}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-border">
              <Button variant="ghost" onClick={closeDetailModal}>Close Profile</Button>
            </div>

          </div>
        )}
      </Modal>
    </div>
  );
};
