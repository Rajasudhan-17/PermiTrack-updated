import { client } from './client';

export interface LeaveApiItem {
  id: number;
  start_date: string;
  end_date: string;
  is_emergency: boolean;
  status: string;
  reason: string;
  applied_on: string;
  review_comment?: string;
  has_proof?: boolean;
  proof_url?: string | null;
}

export interface DashboardMetrics {
  role: string;
  pending_leave_reviews?: number;
  pending_od_reviews?: number;
  applied_leaves_count?: number;
  applied_ods_count?: number;
  admin_user_count?: number;
  admin_leave_count?: number;
  admin_od_count?: number;
  attendance?: {
    present_days: number;
    absent_days: number;
    leave_days: number;
    od_days: number;
    total_working_days: number;
    percentage: number;
    min_required_percentage: number;
  };
}

export const leavesApi = {
  getDashboard: () => client.get<DashboardMetrics>('/dashboard'),

  getLeaves: () => client.get<LeaveApiItem[]>('/leaves'),

  createLeave: (payload: { start_date: string; end_date: string; reason: string; is_emergency?: boolean; proof?: File | null }) => {
    if (payload.proof) {
      const formData = new FormData();
      formData.append('start_date', payload.start_date);
      formData.append('end_date', payload.end_date);
      formData.append('reason', payload.reason);
      if (payload.is_emergency) formData.append('is_emergency', 'true');
      formData.append('proof', payload.proof);
      return client.post<{ message: string; leave_id: number }>('/leaves', formData);
    }
    return client.post<{ message: string; leave_id: number }>('/leaves', payload);
  },

  uploadProof: (leaveId: number, proofFile: File) => {
    const formData = new FormData();
    formData.append('proof', proofFile);
    return client.post<{ message: string; proof_url: string }>(`/leaves/${leaveId}/proof`, formData);
  },

  getPendingQueue: () => client.get<{ pending_leaves: any[]; pending_ods: any[] }>('/pending'),

  reviewLeave: (leaveId: number, action: 'APPROVE' | 'REJECT', comment?: string) =>
    client.post<{ message: string }>(`/leaves/${leaveId}/review`, { action, comment }),
};
