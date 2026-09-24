import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, XCircle, AlertTriangle, Shield, User, FileText } from 'lucide-react';
import {
  Button,
  Card,
  StatusBadge,
  Badge,
  PageHeader,
  EmptyState,
  Modal,
  Textarea,
  Toast
} from '../components/ui';
import { getAuthenticatedUrl } from '../api/client';
import { leavesApi } from '../api/leaves';
import { odApi } from '../api/od';
import { StudentDetailModal } from '../components/StudentDetailModal';

export interface PendingItem {
  id: string;
  rawId: number;
  applicantId?: number;
  applicantName: string;
  rollNumber: string;
  type: 'leave' | 'od';
  title: string;
  startDate: string;
  endDate?: string;
  reason: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskScore: number;
  riskReasons: string[];
  hasProof?: boolean;
  proofUrl?: string | null;
}

export const PendingApprovalsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'leaves' | 'ods'>('leaves');
  const [selectedItem, setSelectedItem] = useState<PendingItem | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [pendingLeaves, setPendingLeaves] = useState<PendingItem[]>([]);
  const [pendingOds, setPendingOds] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingStudentId, setViewingStudentId] = useState<number | null>(null);

  const fetchPending = () => {
    setLoading(true);
    leavesApi.getPendingQueue()
      .then((data) => {
        const leavesMapped: PendingItem[] = (data.pending_leaves || []).map((l: any) => ({
          id: `L-${l.id}`,
          rawId: l.id,
          applicantId: l.applicant_id || l.student_id || l.requested_by || l.user_id,
          applicantName: l.applicant_name || l.applicant,
          rollNumber: l.applicant,
          type: 'leave',
          title: l.is_emergency ? 'Emergency Leave Request' : 'Academic Leave Request',
          startDate: l.start_date,
          endDate: l.end_date,
          reason: l.reason,
          riskLevel: l.risk?.level || 'LOW',
          riskScore: l.risk?.score || 0,
          riskReasons: l.risk?.reasons || [],
          hasProof: l.has_proof,
          proofUrl: l.proof_url,
        }));

        const odsMapped: PendingItem[] = (data.pending_ods || []).map((o: any) => ({
          id: `OD-${o.id}`,
          rawId: o.id,
          applicantId: o.applicant_id || o.student_id || o.requested_by || o.user_id,
          applicantName: o.applicant_name || o.applicant,
          rollNumber: o.applicant,
          type: 'od',
          title: 'On Duty Request',
          startDate: o.event_date,
          reason: o.reason,
          riskLevel: o.risk?.level || 'LOW',
          riskScore: o.risk?.score || 0,
          riskReasons: o.risk?.reasons || [],
          hasProof: o.has_proof,
          proofUrl: o.proof_url,
        }));

        setPendingLeaves(leavesMapped);
        setPendingOds(odsMapped);
      })
      .catch((err) => console.error('Failed to load pending queue:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const itemsToDisplay = activeTab === 'leaves' ? pendingLeaves : pendingOds;

  const handleActionSubmit = async () => {
    if (!selectedItem || !reviewAction) return;
    try {
      if (selectedItem.type === 'leave') {
        await leavesApi.reviewLeave(selectedItem.rawId, reviewAction, reviewComment);
      } else {
        await odApi.reviewOd(selectedItem.rawId, reviewAction, reviewComment);
      }
      const actionText = reviewAction === 'APPROVE' ? 'approved' : 'rejected';
      setToastMsg(`Request ${selectedItem.id} has been ${actionText} successfully.`);
      setSelectedItem(null);
      setReviewAction(null);
      setReviewComment('');
      fetchPending();
    } catch (err: any) {
      setToastMsg(`Error: ${err.message || 'Failed to submit review'}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Pending Workflow Approvals"
        subtitle="Review and process student leave and On Duty requests with risk scoring analysis."
        badge={<Badge variant="warning">{pendingLeaves.length + pendingOds.length} Total Pending</Badge>}
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          onClick={() => setActiveTab('leaves')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'leaves' ? 'bg-primary text-[#07151F]' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
          }`}
        >
          <Clock className="w-4 h-4" />
          Pending Leaves ({pendingLeaves.length})
        </button>
        <button
          onClick={() => setActiveTab('ods')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'ods' ? 'bg-info text-[#07151F]' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
          }`}
        >
          <FileText className="w-4 h-4" />
          Pending ODs ({pendingOds.length})
        </button>
      </div>

      {/* Items List */}
      {itemsToDisplay.length === 0 ? (
        <EmptyState
          title="No Pending Approvals"
          description="There are currently no pending requests awaiting your review in this queue."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {itemsToDisplay.map((item) => (
            <Card key={item.id} className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
                <div 
                  className="flex items-center gap-3 cursor-pointer group"
                  onClick={() => item.applicantId && setViewingStudentId(item.applicantId)}
                  title="Click to view detailed student profile & history"
                >
                  <div className="w-9 h-9 rounded-full bg-primary-subtle text-primary font-bold text-xs flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    {item.applicantName[0]}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors flex items-center gap-1.5">
                      {item.applicantName}
                      <span className="text-[10px] text-primary font-normal group-hover:underline">View Profile &rarr;</span>
                    </h4>
                    <span className="text-xs text-text-muted">Roll No: {item.rollNumber} • ID: {item.id}</span>
                  </div>
                </div>

                {/* Risk Level Badge */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">Risk Assessment:</span>
                  <Badge
                    variant={item.riskLevel === 'LOW' ? 'success' : item.riskLevel === 'MEDIUM' ? 'warning' : 'danger'}
                  >
                    {item.riskLevel} RISK ({item.riskScore}%)
                  </Badge>
                </div>
              </div>

              <div>
                <h5 className="text-sm font-semibold text-text-primary">{item.title}</h5>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">{item.reason}</p>
                <div className="mt-2 text-xs text-text-muted">
                  <span className="font-semibold text-text-primary">Dates:</span> {item.startDate} {item.endDate ? `to ${item.endDate}` : ''}
                </div>
              </div>

              {/* Risk Reasons */}
              {item.riskReasons.length > 0 && (
                <div className="p-3 bg-bg-secondary rounded-lg border border-border text-xs space-y-1">
                  <span className="font-semibold text-text-muted text-[11px] block uppercase">System Risk Factors:</span>
                  {item.riskReasons.map((r, idx) => (
                    <div key={idx} className="text-text-secondary flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-warning shrink-0" />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<User className="w-4 h-4 text-primary" />}
                  onClick={() => {
                    if (item.applicantId) {
                      setViewingStudentId(item.applicantId);
                    }
                  }}
                >
                  View Student Profile
                </Button>
                {item.hasProof && item.proofUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<FileText className="w-4 h-4 text-info" />}
                    onClick={() => window.open(getAuthenticatedUrl(item.proofUrl!), '_blank')}
                  >
                    View Proof Document
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  icon={<XCircle className="w-4 h-4" />}
                  onClick={() => {
                    setSelectedItem(item);
                    setReviewAction('REJECT');
                  }}
                >
                  Reject Request
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  onClick={() => {
                    setSelectedItem(item);
                    setReviewAction('APPROVE');
                  }}
                >
                  Approve Request
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {selectedItem && reviewAction && (
        <Modal
          isOpen={Boolean(selectedItem)}
          onClose={() => { setSelectedItem(null); setReviewAction(null); }}
          title={`${reviewAction === 'APPROVE' ? 'Approve' : 'Reject'} Request — ${selectedItem.id}`}
          description={`Applicant: ${selectedItem.applicantName} (${selectedItem.rollNumber})`}
          footer={
            <>
              <Button variant="ghost" onClick={() => { setSelectedItem(null); setReviewAction(null); }}>
                Cancel
              </Button>
              <Button
                variant={reviewAction === 'APPROVE' ? 'primary' : 'danger'}
                onClick={handleActionSubmit}
              >
                Confirm {reviewAction === 'APPROVE' ? 'Approval' : 'Rejection'}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Textarea
              label="Reviewer Remark / Comment"
              placeholder={`Enter explanation for ${reviewAction.toLowerCase()}ing...`}
              rows={3}
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
            />
          </div>
        </Modal>
      )}

      {/* STUDENT DETAIL MODAL */}
      <StudentDetailModal
        studentId={viewingStudentId}
        isOpen={viewingStudentId !== null}
        onClose={() => setViewingStudentId(null)}
      />

      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50">
          <Toast
            type="success"
            title="Action Recorded"
            message={toastMsg}
            onDismiss={() => setToastMsg(null)}
          />
        </div>
      )}
    </div>
  );
};
