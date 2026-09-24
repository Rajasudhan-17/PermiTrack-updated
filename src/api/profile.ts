import { client } from './client';

export interface ProfileData {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: string;
  db_role?: string;
  department?: string;
  roll_number?: string;
  mentor_name?: string;
  faculty_advisor?: string;
  father_name?: string;
  date_of_birth?: string;
  class_group_name?: string;
  assigned_students_count?: number;
}

export const profileApi = {
  getProfile: () => client.get<ProfileData>('/profile'),
  changePassword: (data: { old_password?: string; new_password?: string; confirm_password?: string }) =>
    client.post<{ message: string }>('/auth/change-password', data),
};

export interface ClassGroupOption {
  id: number;
  year: number;
  section: string;
  department: string;
}

export interface AttendanceSheetItem {
  student_id: number;
  name: string;
  roll_number: string;
  status: 'PRESENT' | 'ABSENT' | 'LEAVE' | 'OD';
  reason: string;
  leave_id: number | null;
  od_id: number | null;
  is_auto: boolean;
}

export const attendanceApi = {
  getClassGroups: () => client.get<{ class_groups: ClassGroupOption[] }>('/attendance'),

  getAttendanceSheet: (classId: number, dateStr: string) =>
    client.get<{ class_id: number; date: string; sheet: AttendanceSheetItem[] }>(
      `/attendance/sheet?class_id=${classId}&date=${dateStr}`
    ),

  saveAttendance: (
    classId: number,
    dateStr: string,
    records: Array<{ student_id: number; status: string; reason?: string; leave_id?: number | null; od_id?: number | null }>
  ) => client.post<{ message: string }>('/attendance/mark', { class_id: classId, date: dateStr, records }),
};

export const notificationsApi = {
  getNotifications: () =>
    client.get<
      Array<{
        id: string | number;
        title: string;
        message: string;
        time: string;
        type: string;
        unread: boolean;
      }>
    >('/notifications'),

  markAllAsRead: () => client.post<{ message: string }>('/notifications/mark_read'),
};
