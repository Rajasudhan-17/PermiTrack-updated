import React, { useState, useEffect } from 'react';
import { 
  User, 
  Calendar, 
  Briefcase, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertCircle, 
  BookOpen, 
  Building, 
  ShieldCheck, 
  TrendingUp, 
  AlertTriangle 
} from 'lucide-react';
import { Modal, Badge, LoadingState } from './ui';
import { studentsApi, StudentDetailPayload } from '../api/students';

export interface StudentDetailModalProps {
  studentId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  studentId,
  isOpen,
  onClose,
}) => {
  const [detailData, setDetailData] = useState<StudentDetailPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'leaves' | 'ods'>('overview');

  useEffect(() => {
    if (isOpen && studentId) {
      setLoading(true);
      setErrorMsg(null);
      setActiveTab('overview');
      studentsApi
        .getStudentDetail(studentId)
        .then((data) => {
          setDetailData(data);
        })
        .catch((err) => {
          console.error('Failed to load student profile detail:', err);
          setErrorMsg(err.message || 'Failed to load student details.');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setDetailData(null);
    }
  }, [isOpen, studentId]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={detailData ? `${detailData.student.full_name} — Profile & History` : 'Student Profile & Record'}
      size="lg"
    >
      {loading || !detailData ? (
        <div className="p-12">
          {errorMsg ? (
            <div className="p-8 text-center text-sm text-danger space-y-2">
              <AlertCircle className="w-8 h-8 text-danger mx-auto" />
              <p className="font-semibold">{errorMsg}</p>
            </div>
          ) : (
            <LoadingState message="Fetching student attendance, leaves, and OD logs..." />
          )}
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
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                  {detailData.student.full_name}
                  <Badge variant="primary" size="sm">
                    {detailData.student.register_number}
                  </Badge>
                </h3>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted mt-1">
                  <span className="flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-text-secondary" />
                    {detailData.student.department}
                  </span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-text-secondary" />
                    {detailData.student.class_group}
                  </span>
                </div>
              </div>
            </div>

            {/* Attendance Percentage Badge */}
            <div className="text-right border-t sm:border-t-0 sm:border-l border-border pt-3 sm:pt-0 sm:pl-4 w-full sm:w-auto flex sm:flex-col items-center sm:items-end justify-between">
              <span className="text-[11px] font-semibold text-text-muted uppercase">Overall Attendance</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <TrendingUp className={`w-4 h-4 ${
                  detailData.attendance.percentage >= 75 ? 'text-success' : detailData.attendance.percentage >= 70 ? 'text-warning' : 'text-danger'
                }`} />
                <span className={`text-xl font-bold font-display ${
                  detailData.attendance.percentage >= 75 ? 'text-success' : detailData.attendance.percentage >= 70 ? 'text-warning' : 'text-danger'
                }`}>
                  {detailData.attendance.percentage}%
                </span>
              </div>
            </div>
          </div>

          {/* Modal Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
                activeTab === 'overview'
                  ? 'bg-primary text-[#07151F]'
                  : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Attendance Overview
            </button>
            <button
              onClick={() => setActiveTab('leaves')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
                activeTab === 'leaves'
                  ? 'bg-primary text-[#07151F]'
                  : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Leaves History ({detailData.leaves.length})
            </button>
            <button
              onClick={() => setActiveTab('ods')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
                activeTab === 'ods'
                  ? 'bg-primary text-[#07151F]'
                  : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              ODs History ({detailData.ods.length})
            </button>
          </div>

          {/* Tab 1: Attendance Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-surface-elevated/50 border border-border rounded-xl">
                  <span className="text-[11px] font-semibold text-text-muted uppercase block">Total Working Days</span>
                  <span className="text-lg font-bold text-text-primary font-display mt-1 block">
                    {detailData.attendance.total_working_days} Days
                  </span>
                </div>
                <div className="p-3.5 bg-success-subtle/30 border border-success/20 rounded-xl">
                  <span className="text-[11px] font-semibold text-success uppercase block">Present Days</span>
                  <span className="text-lg font-bold text-success font-display mt-1 block">
                    {detailData.attendance.present_days} Days
                  </span>
                </div>
                <div className="p-3.5 bg-info-subtle/30 border border-info/20 rounded-xl">
                  <span className="text-[11px] font-semibold text-info uppercase block">OD Days</span>
                  <span className="text-lg font-bold text-info font-display mt-1 block">
                    {detailData.attendance.od_days} Days
                  </span>
                </div>
                <div className="p-3.5 bg-danger-subtle/30 border border-danger/20 rounded-xl">
                  <span className="text-[11px] font-semibold text-danger uppercase block">Absent / Leave Days</span>
                  <span className="text-lg font-bold text-danger font-display mt-1 block">
                    {detailData.attendance.absent_days + detailData.attendance.leave_days} Days
                  </span>
                </div>
              </div>

              {/* Attendance Progress Bar */}
              <div className="p-4 bg-surface-elevated/40 border border-border rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-text-primary">Required Threshold: 75%</span>
                  <span className="font-bold text-text-primary">{detailData.attendance.percentage}% Current</span>
                </div>
                <div className="w-full bg-surface-elevated h-3 rounded-full overflow-hidden p-0.5 border border-border">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      detailData.attendance.percentage >= 75 ? 'bg-success' : detailData.attendance.percentage >= 70 ? 'bg-warning' : 'bg-danger'
                    }`}
                    style={{ width: `${Math.min(100, detailData.attendance.percentage)}%` }}
                  />
                </div>
              </div>

              {/* Academic Officers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-surface-elevated/40 border border-border rounded-xl text-xs flex items-center justify-between">
                  <span className="text-text-muted font-medium">Assigned Mentor:</span>
                  <span className="font-bold text-text-primary">{detailData.student.mentor_name}</span>
                </div>
                <div className="p-3 bg-surface-elevated/40 border border-border rounded-xl text-xs flex items-center justify-between">
                  <span className="text-text-muted font-medium">Class Advisor / Faculty:</span>
                  <span className="font-bold text-text-primary">{detailData.student.faculty_name}</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Leaves History */}
          {activeTab === 'leaves' && (
            <div className="space-y-3 animate-fadeIn">
              {detailData.leaves.length === 0 ? (
                <div className="p-8 text-center text-xs text-text-muted">
                  No leave applications recorded for this student.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {detailData.leaves.map((l) => (
                    <div key={l.id} className="p-3.5 bg-surface-elevated/40 border border-border rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-text-primary">
                            {l.start_date} to {l.end_date}
                          </span>
                          {l.is_emergency && (
                            <Badge variant="danger" size="sm">Emergency</Badge>
                          )}
                        </div>
                        <Badge
                          variant={l.status.includes('APPROVED') ? 'success' : l.status.includes('REJECTED') ? 'danger' : 'warning'}
                          size="sm"
                        >
                          {l.status}
                        </Badge>
                      </div>
                      <p className="text-text-secondary text-xs leading-relaxed">{l.reason}</p>
                      <div className="flex items-center justify-between text-[11px] text-text-muted pt-1 border-t border-border/40">
                        <span>Applied on: {l.applied_on}</span>
                        {l.review_comment && (
                          <span className="italic truncate max-w-[200px]">Comment: {l.review_comment}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: ODs History */}
          {activeTab === 'ods' && (
            <div className="space-y-3 animate-fadeIn">
              {detailData.ods.length === 0 ? (
                <div className="p-8 text-center text-xs text-text-muted">
                  No On Duty (OD) applications or OD attendance records found for this student.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {detailData.ods.map((o) => (
                    <div key={o.id} className="p-3.5 bg-surface-elevated/40 border border-border rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-text-primary">
                            Event Date: {o.event_date}
                          </span>
                        </div>
                        <Badge
                          variant={o.status.includes('APPROVED') ? 'success' : o.status.includes('REJECTED') ? 'danger' : 'info'}
                          size="sm"
                        >
                          {o.status}
                        </Badge>
                      </div>
                      <p className="text-text-secondary text-xs leading-relaxed">{o.reason}</p>
                      <div className="flex items-center justify-between text-[11px] text-text-muted pt-1 border-t border-border/40">
                        <span>Recorded: {o.applied_on}</span>
                        {o.review_comment && (
                          <span className="italic truncate max-w-[220px]">Comment: {o.review_comment}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
