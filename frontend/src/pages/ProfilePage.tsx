import React, { useState, useEffect } from 'react';
import { User, Mail, Shield, KeyRound, CheckCircle2, AlertCircle, Loader2, Award, Calendar, UserCheck } from 'lucide-react';
import { Card, PageHeader, Badge, Button, Input, Alert, Toast } from '../components/ui';
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
        <p className="text-xs text-text-muted font-medium">Fetching profile details...</p>
      </div>
    );
  }

  const profileDisplay = {
    fullName: profile?.full_name || profile?.username || 'User Account',
    username: profile?.username || 'user',
    email: profile?.email || 'N/A',
    rollNumber: profile?.roll_number || profile?.username || 'N/A',
    role: (profile?.role || 'user').toUpperCase(),
    department: profile?.department || 'General Department',
    mentorName: profile?.mentor_name || 'Not assigned',
    facultyAdvisor: profile?.faculty_advisor || 'Not assigned',
    fatherName: profile?.father_name || 'Not specified',
    dob: profile?.date_of_birth || 'Not specified',
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
        title="User Profile & Account Security"
        subtitle="Manage your personal profile details, academic assignments, and security credentials."
        badge={<Badge variant="primary">{profileDisplay.role}</Badge>}
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
            <p className="text-xs text-text-muted mt-0.5">@{profileDisplay.username} • Roll/Reg No: {profileDisplay.rollNumber}</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="primary" size="sm">{profileDisplay.department}</Badge>
            </div>
          </div>
        </div>

        {/* Academic Details Section */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider text-primary">
            Academic Registry Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-bg-secondary rounded-lg border border-border">
              <span className="text-text-muted block text-[11px]">Department / Specialization:</span>
              <span className="font-semibold text-text-primary text-sm">{profileDisplay.department}</span>
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

        {/* Identity & Personal Info */}
        <div className="space-y-3 pt-4 border-t border-border">
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider text-primary">
            Personal Information
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
                <span className="text-text-muted block text-[11px]">Registered Email:</span>
                <span className="font-semibold text-text-primary">{profileDisplay.email}</span>
              </div>
            </div>
          </div>
        </div>
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
