import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Shield, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Award, 
  Calendar, 
  UserCheck,
  Building,
  GraduationCap,
  Users,
  Briefcase,
  FileSpreadsheet,
  CheckSquare,
  ShieldCheck,
  BookOpen,
  Clock,
  TrendingUp,
  FileCheck
} from 'lucide-react';
import { Card, PageHeader, Badge, Button, Input, Alert, Toast, StatCard } from '../components/ui';
import { profileApi, ProfileData } from '../api/profile';

export const ProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Change Password state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [passwordToast, setPasswordToast] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await profileApi.getProfile();
      setProfile(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load user profile information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordToast(null);

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError('All password fields are required.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation password do not match.');
      return;
    }

    setIsSubmittingPassword(true);
    try {
      const res = await profileApi.changePassword({
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setPasswordToast(res.message || 'Password changed successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center space-y-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
        <p className="text-xs text-text-muted font-medium">Fetching real profile details & live counts...</p>
      </div>
    );
  }

  const roleNormalized = (profile?.role || 'student').toLowerCase();

  const profileDisplay = {
    fullName: profile?.full_name || profile?.username || 'User Account',
    username: profile?.username || 'user',
    email: profile?.email || `${profile?.username || 'user'}@permitrack.edu`,
    rollNumber: profile?.roll_number || profile?.username || 'N/A',
    role: (profile?.role || 'student').toUpperCase(),
    department: profile?.department || 'General Department',
    mentorName: profile?.mentor_name || 'Not assigned',
    facultyAdvisor: profile?.faculty_advisor || 'Not assigned',
    fatherName: profile?.father_name || 'Not specified',
    dob: profile?.date_of_birth || 'Not specified',
    classGroup: profile?.class_group_name || 'N/A',
    assignedCount: profile?.assigned_students_count || 0,
    totalLeaves: profile?.total_leaves || 0,
    approvedLeaves: profile?.approved_leaves || 0,
    totalOds: profile?.total_ods || 0,
    approvedOds: profile?.approved_ods || 0,
    attendance: profile?.attendance || { percentage: 100, total_days: 0, present_days: 0, absent_days: 0, od_days: 0, leave_days: 0 },
    pendingQueueCount: profile?.pending_queue_count || 0,
  };

  const getRoleTitle = () => {
    switch (roleNormalized) {
      case 'faculty':
        return 'Class Advisor & Faculty Profile';
      case 'mentor':
        return 'Student Mentor Profile';
      case 'hod':
        return 'Head of Department Profile';
      case 'admin':
        return 'System Administrator Profile';
      default:
        return 'Student Profile & Academic Record';
    }
  };

  const getRoleBadgeText = () => {
    switch (roleNormalized) {
      case 'faculty':
        return 'Faculty Advisor';
      case 'mentor':
        return 'Student Mentor';
      case 'hod':
        return 'Head of Department (HOD)';
      case 'admin':
        return 'Super Admin';
      default:
        return 'Enrolled Student';
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Toast Notification */}
      {passwordToast && (
        <Toast
          type="success"
          title="Success"
          message={passwordToast}
          onDismiss={() => setPasswordToast(null)}
        />
      )}

      {/* Page Header */}
      <PageHeader
        title={getRoleTitle()}
        subtitle="Manage your role-specific profile details, institutional affiliations, and live application metrics."
        badge={<Badge variant="primary">{getRoleBadgeText()}</Badge>}
      />

      {error && (
        <div className="space-y-3">
          <Alert type="danger" title="Profile Load Error">
            {error}
          </Alert>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={fetchProfile}>
              Retry Loading Profile
            </Button>
          </div>
        </div>
      )}

      {/* Main Profile Info Card */}
      <Card className="p-6 sm:p-8 space-y-6">
        {/* User Top Row */}
        <div className="flex items-center gap-4 pb-6 border-b border-border">
          <div className="w-16 h-16 rounded-full bg-primary text-[#07151F] font-bold text-2xl flex items-center justify-center shrink-0 shadow-sm">
            {(profileDisplay.fullName && profileDisplay.fullName.length > 0) ? profileDisplay.fullName[0].toUpperCase() : 'U'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary font-display">{profileDisplay.fullName}</h2>
            <p className="text-xs text-text-muted mt-0.5">
              @{profileDisplay.username} • {roleNormalized === 'student' ? `Roll No: ${profileDisplay.rollNumber}` : `Staff ID: ${profileDisplay.rollNumber}`}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="primary" size="sm">{profileDisplay.department}</Badge>
              <Badge variant="secondary" size="sm">{getRoleBadgeText()}</Badge>
            </div>
          </div>
        </div>

        {/* LIVE METRICS COUNTERS ROW */}
        {roleNormalized === 'student' ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Attendance"
              value={`${profileDisplay.attendance.percentage}%`}
              subtitle={`${profileDisplay.attendance.present_days}/${profileDisplay.attendance.total_days} Days Present`}
              icon={<CheckCircle2 className={`w-4 h-4 ${profileDisplay.attendance.percentage >= 75 ? 'text-success' : 'text-danger'}`} />}
            />
            <StatCard
              label="Leave Requests"
              value={profileDisplay.totalLeaves}
              subtitle={`${profileDisplay.approvedLeaves} Approved`}
              icon={<FileSpreadsheet className="w-4 h-4 text-primary" />}
            />
            <StatCard
              label="OD Requests"
              value={profileDisplay.totalOds}
              subtitle={`${profileDisplay.approvedOds} Approved`}
              icon={<FileCheck className="w-4 h-4 text-info" />}
            />
            <StatCard
              label="OD Credit Days"
              value={profileDisplay.attendance.od_days}
              subtitle="Attendance Credited"
              icon={<Award className="w-4 h-4 text-warning" />}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard
              label={roleNormalized === 'hod' ? 'Department Students' : roleNormalized === 'mentor' ? 'Assigned Mentees' : roleNormalized === 'admin' ? 'Total Students' : 'Class Cohort Size'}
              value={profileDisplay.assignedCount}
              subtitle="Active enrolled students"
              icon={<Users className="w-5 h-5 text-primary" />}
            />
            <StatCard
              label="Pending Approvals Queue"
              value={profileDisplay.pendingQueueCount}
              subtitle="Requests awaiting your review"
              icon={<Clock className="w-5 h-5 text-warning" />}
            />
          </div>
        )}

        {/* ROLE-SPECIFIC PROFILES */}

        {/* 1. STUDENT ROLE PROFILE */}
        {roleNormalized === 'student' && (
          <>
            <div className="space-y-3 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider text-primary flex items-center gap-2">
                <GraduationCap className="w-4 h-4" /> Academic Registry Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-bg-secondary rounded-lg border border-border">
                  <span className="text-text-muted block text-[11px]">Department / Specialization:</span>
                  <span className="font-semibold text-text-primary text-sm">{profileDisplay.department}</span>
                </div>
                <div className="p-3 bg-bg-secondary rounded-lg border border-border">
                  <span className="text-text-muted block text-[11px]">Class Section Cohort:</span>
                  <span className="font-semibold text-text-primary text-sm">{profileDisplay.classGroup}</span>
                </div>
                <div className="p-3 bg-bg-secondary rounded-lg border border-border">
                  <span className="text-text-muted block text-[11px]">Assigned Student Mentor:</span>
                  <span className="font-semibold text-text-primary text-sm">{profileDisplay.mentorName}</span>
                </div>
                <div className="p-3 bg-bg-secondary rounded-lg border border-border">
                  <span className="text-text-muted block text-[11px]">Class Faculty Advisor:</span>
                  <span className="font-semibold text-text-primary text-sm">{profileDisplay.facultyAdvisor}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider text-primary flex items-center gap-2">
                <User className="w-4 h-4" /> Personal Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="flex items-center gap-3 p-3 bg-bg-secondary rounded-lg border border-border">
                  <User className="w-4 h-4 text-text-muted shrink-0" />
                  <div>
                    <span className="text-text-muted block text-[11px]">Father's Name:</span>
                    <span className="font-semibold text-text-primary">{profileDisplay.fatherName}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-bg-secondary rounded-lg border border-border">
                  <Calendar className="w-4 h-4 text-text-muted shrink-0" />
                  <div>
                    <span className="text-text-muted block text-[11px]">Date of Birth:</span>
                    <span className="font-semibold text-text-primary">{profileDisplay.dob}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-bg-secondary rounded-lg border border-border sm:col-span-2">
                  <Mail className="w-4 h-4 text-text-muted shrink-0" />
                  <div>
                    <span className="text-text-muted block text-[11px]">Registered Student Email:</span>
                    <span className="font-semibold text-text-primary">{profileDisplay.email}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 2. FACULTY / CLASS ADVISOR ROLE PROFILE */}
        {roleNormalized === 'faculty' && (
          <>
            <div className="space-y-3 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider text-primary flex items-center gap-2">
                <Briefcase className="w-4 h-4" /> Faculty & Class Advisor Registry
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-bg-secondary rounded-lg border border-border">
                  <span className="text-text-muted block text-[11px]">Official Designation:</span>
                  <span className="font-semibold text-text-primary text-sm">Class Advisor & Course Faculty</span>
                </div>
                <div className="p-3 bg-bg-secondary rounded-lg border border-border">
                  <span className="text-text-muted block text-[11px]">Academic Department:</span>
                  <span className="font-semibold text-text-primary text-sm">{profileDisplay.department}</span>
                </div>
                <div className="p-3 bg-bg-secondary rounded-lg border border-border">
                  <span className="text-text-muted block text-[11px]">Assigned Class Cohort:</span>
                  <span className="font-semibold text-text-primary text-sm">{profileDisplay.classGroup}</span>
                </div>
                <div className="p-3 bg-bg-secondary rounded-lg border border-border">
                  <span className="text-text-muted block text-[11px]">Class Cohort Student Strength:</span>
                  <span className="font-semibold text-primary text-sm">{profileDisplay.assignedCount} Active Students</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider text-primary flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> Institutional Credentials & Permissions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="flex items-center gap-3 p-3 bg-bg-secondary rounded-lg border border-border sm:col-span-2">
                  <Mail className="w-4 h-4 text-text-muted shrink-0" />
                  <div>
                    <span className="text-text-muted block text-[11px]">Official Institutional Email:</span>
                    <span className="font-semibold text-text-primary">{profileDisplay.email}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-surface-elevated/40 rounded-lg border border-border space-y-2">
                <span className="text-xs font-bold text-text-primary block">Faculty Access & System Capabilities:</span>
                <ul className="text-xs text-text-muted space-y-1 list-disc list-inside">
                  <li>Mark daily attendance for assigned class cohort.</li>
                  <li>Review and approve/reject student leave & OD requests.</li>
                  <li>Monitor class attendance shortage risk (&lt;75%).</li>
                  <li>View complete student academic roster and profile histories.</li>
                </ul>
              </div>
            </div>
          </>
        )}

        {/* 3. MENTOR ROLE PROFILE */}
        {roleNormalized === 'mentor' && (
          <>
            <div className="space-y-3 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider text-primary flex items-center gap-2">
                <Users className="w-4 h-4" /> Academic Mentor Registry
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-bg-secondary rounded-lg border border-border">
                  <span className="text-text-muted block text-[11px]">Role Title:</span>
                  <span className="font-semibold text-text-primary text-sm">Student Academic Mentor</span>
                </div>
                <div className="p-3 bg-bg-secondary rounded-lg border border-border">
                  <span className="text-text-muted block text-[11px]">Department:</span>
                  <span className="font-semibold text-text-primary text-sm">{profileDisplay.department}</span>
                </div>
                <div className="p-3 bg-bg-secondary rounded-lg border border-border sm:col-span-2">
                  <span className="text-text-muted block text-[11px]">Assigned Student Mentees:</span>
                  <span className="font-semibold text-primary text-sm">{profileDisplay.assignedCount} Mentees</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider text-primary flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> Mentorship Credentials & Authority
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="flex items-center gap-3 p-3 bg-bg-secondary rounded-lg border border-border sm:col-span-2">
                  <Mail className="w-4 h-4 text-text-muted shrink-0" />
                  <div>
                    <span className="text-text-muted block text-[11px]">Official Mentor Email:</span>
                    <span className="font-semibold text-text-primary">{profileDisplay.email}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-surface-elevated/40 rounded-lg border border-border space-y-2">
                <span className="text-xs font-bold text-text-primary block">Mentor System Capabilities:</span>
                <ul className="text-xs text-text-muted space-y-1 list-disc list-inside">
                  <li>First-stage approval review for assigned mentees' leave and OD applications.</li>
                  <li>Monitor mentee attendance standing and shortage alerts.</li>
                  <li>Inspect assigned mentee profiles and historical request logs.</li>
                </ul>
              </div>
            </div>
          </>
        )}

        {/* 4. HOD ROLE PROFILE */}
        {roleNormalized === 'hod' && (
          <>
            <div className="space-y-3 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider text-primary flex items-center gap-2">
                <Building className="w-4 h-4" /> Head of Department Executive Registry
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-bg-secondary rounded-lg border border-border">
                  <span className="text-text-muted block text-[11px]">Executive Role:</span>
                  <span className="font-semibold text-text-primary text-sm">Head of Department (HOD)</span>
                </div>
                <div className="p-3 bg-bg-secondary rounded-lg border border-border">
                  <span className="text-text-muted block text-[11px]">Department Jurisdiction:</span>
                  <span className="font-semibold text-text-primary text-sm">{profileDisplay.department}</span>
                </div>
                <div className="p-3 bg-bg-secondary rounded-lg border border-border sm:col-span-2">
                  <span className="text-text-muted block text-[11px]">Department Total Enrolled Students:</span>
                  <span className="font-semibold text-primary text-sm">{profileDisplay.assignedCount} Department Students</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider text-primary flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> Executive Credentials & Authorities
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="flex items-center gap-3 p-3 bg-bg-secondary rounded-lg border border-border sm:col-span-2">
                  <Mail className="w-4 h-4 text-text-muted shrink-0" />
                  <div>
                    <span className="text-text-muted block text-[11px]">Official HOD Email:</span>
                    <span className="font-semibold text-text-primary">{profileDisplay.email}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-surface-elevated/40 rounded-lg border border-border space-y-2">
                <span className="text-xs font-bold text-text-primary block">HOD Executive Capabilities:</span>
                <ul className="text-xs text-text-muted space-y-1 list-disc list-inside">
                  <li>Final approval sign-off on faculty-approved leave and OD applications.</li>
                  <li>Department-wide student attendance analytics and shortage monitoring.</li>
                  <li>Full oversight of department faculty, mentors, and student rosters.</li>
                </ul>
              </div>
            </div>
          </>
        )}

        {/* 5. ADMIN ROLE PROFILE */}
        {roleNormalized === 'admin' && (
          <>
            <div className="space-y-3 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider text-primary flex items-center gap-2">
                <Shield className="w-4 h-4" /> System Administrator Registry
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-bg-secondary rounded-lg border border-border">
                  <span className="text-text-muted block text-[11px]">System Administrative Tier:</span>
                  <span className="font-semibold text-text-primary text-sm">Super System Administrator</span>
                </div>
                <div className="p-3 bg-bg-secondary rounded-lg border border-border">
                  <span className="text-text-muted block text-[11px]">Platform Scope:</span>
                  <span className="font-semibold text-text-primary text-sm">Global System Configuration</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider text-primary flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> Administrative Credentials
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="flex items-center gap-3 p-3 bg-bg-secondary rounded-lg border border-border sm:col-span-2">
                  <Mail className="w-4 h-4 text-text-muted shrink-0" />
                  <div>
                    <span className="text-text-muted block text-[11px]">Administrator Email:</span>
                    <span className="font-semibold text-text-primary">{profileDisplay.email}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-surface-elevated/40 rounded-lg border border-border space-y-2">
                <span className="text-xs font-bold text-text-primary block">Admin Capabilities:</span>
                <ul className="text-xs text-text-muted space-y-1 list-disc list-inside">
                  <li>User account creation, role updates, and password resets.</li>
                  <li>Mentor to student assignment management.</li>
                  <li>Class group and department registry configuration.</li>
                  <li>System audit log inspection.</li>
                </ul>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Security & Password Management Card */}
      <Card className="p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-5 h-5 text-primary" />
            <div>
              <h3 className="text-base font-bold text-text-primary">Account Security & Password</h3>
              <p className="text-xs text-text-muted">Update your login password securely</p>
            </div>
          </div>
          <Button
            variant={showPasswordForm ? 'outline' : 'primary'}
            size="sm"
            onClick={() => {
              setShowPasswordForm(!showPasswordForm);
              setPasswordError(null);
            }}
          >
            {showPasswordForm ? 'Cancel' : 'Change Password'}
          </Button>
        </div>

        {passwordError && (
          <Alert type="danger" title="Password Change Failed">
            {passwordError}
          </Alert>
        )}

        {showPasswordForm && (
          <form onSubmit={handleChangePassword} className="pt-4 border-t border-border space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Current Password"
                type="password"
                placeholder="Enter current password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
              />
              <Input
                label="New Password"
                type="password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <Input
                label="Confirm New Password"
                type="password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowPasswordForm(false);
                  setPasswordError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmittingPassword}
              >
                Update Password
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
};
