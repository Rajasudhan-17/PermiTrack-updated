import { client } from './client';

export interface StudentRosterItem {
  id: number;
  username: string;
  full_name: string;
  register_number: string;
  email: string;
  department: string;
  class_group: string;
  attendance: {
    total_working_days: number;
    present_days: number;
    absent_days: number;
    leave_days: number;
    od_days: number;
    percentage: number;
  };
  leaves_count: number;
  ods_count: number;
}

export interface StudentDetailPayload {
  student: {
    id: number;
    full_name: string;
    username: string;
    register_number: string;
    email: string;
    department: string;
    class_group: string;
    mentor_name: string;
    faculty_name: string;
    father_name?: string | null;
  };
  attendance: {
    total_working_days: number;
    present_days: number;
    absent_days: number;
    leave_days: number;
    od_days: number;
    percentage: number;
  };
  leaves: Array<{
    id: number;
    start_date: string;
    end_date: string;
    is_emergency: boolean;
    status: string;
    reason: string;
    applied_on: string;
    review_comment?: string | null;
  }>;
  ods: Array<{
    id: number | string;
    event_date: string;
    status: string;
    reason: string;
    applied_on: string;
    review_comment?: string | null;
  }>;
}

export const studentsApi = {
  getStudents: () => client.get<StudentRosterItem[]>('/students'),
  getStudentDetail: (studentId: number) => client.get<StudentDetailPayload>(`/students/${studentId}/detail`),
};
