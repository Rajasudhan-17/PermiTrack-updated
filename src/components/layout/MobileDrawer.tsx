import React, { useEffect } from 'react';
import { 
  X, 
  LayoutDashboard, 
  Calendar, 
  PlusCircle, 
  Briefcase, 
  CheckSquare, 
  Clock, 
  FileCheck, 
  Users, 
  UserPlus,
  Shield, 
  User, 
  LogOut, 
  RefreshCw 
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
  userName?: string;
  userEmail?: string;
  onLogout?: () => void;
  onSwitchRole?: () => void;
  onNavigate?: (path: string) => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  userRole = 'student',
  userName = 'Rajasudhan R',
  userEmail,
  onLogout,
  onSwitchRole,
  onNavigate,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleNavigate = (path: string, e: React.MouseEvent) => {
    e.preventDefault();
    onClose();
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new Event('popstate'));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Dark Frosted Backdrop */}
      <div
        className="fixed inset-0 bg-bg/80 backdrop-blur-sm transition-opacity animate-fadeIn"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Panel */}
      <div className="relative w-full max-w-xs sm:max-w-sm bg-surface border-l border-border h-full flex flex-col z-10 shadow-xl overflow-y-auto animate-slideInRight">
        {/* Mobile Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <img src="/static/logo.png" alt="Logo" className="w-7 h-7 object-contain" />
            <span className="font-bold text-base text-text-primary font-display">Permitrack</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-primary hover:bg-surface-elevated rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <a
          href="/profile"
          onClick={(e) => handleNavigate('/profile', e)}
          className="p-4 border-b border-border bg-surface-elevated/40 flex items-center gap-3 hover:bg-surface-elevated transition-colors group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-primary text-[#07151F] font-bold text-sm flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
            {userName ? userName[0].toUpperCase() : 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-text-primary truncate group-hover:text-primary transition-colors">{userName}</h4>
              <span className="text-[11px] font-medium text-primary">View Profile &rrArr;</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="primary" size="sm">
                {(userRole || '').toUpperCase()}
              </Badge>
            </div>
          </div>
        </a>

        {/* Links Navigation List */}
        <div className="flex-1 p-4 space-y-6">
          {/* Main Group */}
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider px-3 mb-1">
              General
            </div>
            <a
              href="/"
              onClick={(e) => handleNavigate('/', e)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-primary hover:bg-surface-elevated transition-colors min-h-[44px]"
            >
              <LayoutDashboard className="w-4 h-4 text-primary" />
              <span>Dashboard</span>
            </a>
            <a
              href="/profile"
              onClick={(e) => handleNavigate('/profile', e)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors min-h-[44px]"
            >
              <User className="w-4 h-4 text-primary" />
              <span>My Profile</span>
            </a>
          </div>

          {/* Leave Section */}
          {(userRole === 'student' || userRole === 'faculty') && (
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider px-3 mb-1">
                Leave Management
              </div>
              <a
                href="/my-leaves"
                onClick={(e) => handleNavigate('/my-leaves', e)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors min-h-[44px]"
              >
                <Calendar className="w-4 h-4 text-primary" />
                <span>My Leaves</span>
              </a>
              <a
                href="/apply-leave"
                onClick={(e) => handleNavigate('/apply-leave', e)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors min-h-[44px]"
              >
                <PlusCircle className="w-4 h-4 text-success" />
                <span>Apply Leave</span>
              </a>
            </div>
          )}

          {/* OD Section */}
          {userRole === 'student' && (
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider px-3 mb-1">
                On Duty (OD)
              </div>
              <a
                href="/my-ods"
                onClick={(e) => handleNavigate('/my-ods', e)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors min-h-[44px]"
              >
                <Briefcase className="w-4 h-4 text-primary" />
                <span>My ODs</span>
              </a>
              <a
                href="/apply-od"
                onClick={(e) => handleNavigate('/apply-od', e)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors min-h-[44px]"
              >
                <PlusCircle className="w-4 h-4 text-info" />
                <span>Apply OD</span>
              </a>
            </div>
          )}

          {/* Approvals */}
          {(userRole === 'faculty' || userRole === 'mentor' || userRole === 'hod' || userRole === 'event_coordinator') && (
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider px-3 mb-1">
                Approvals Workflow
              </div>
              <a
                href="/pending-leaves"
                onClick={(e) => handleNavigate('/pending-leaves', e)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors min-h-[44px]"
              >
                <Clock className="w-4 h-4 text-warning" />
                <span>Pending Leaves</span>
              </a>
              <a
                href="/pending-ods"
                onClick={(e) => handleNavigate('/pending-ods', e)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors min-h-[44px]"
              >
                <FileCheck className="w-4 h-4 text-info" />
                <span>Pending ODs</span>
              </a>
            </div>
          )}

          {/* Attendance (Class Faculty Only) */}
          {userRole === 'faculty' && (
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider px-3 mb-1">
                Attendance
              </div>
              <a
                href="/attendance"
                onClick={(e) => handleNavigate('/attendance', e)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors min-h-[44px]"
              >
                <CheckSquare className="w-4 h-4 text-success" />
                <span>Mark Class Attendance</span>
              </a>
            </div>
          )}

          {/* Students Directory (Faculty / Mentor / HOD / Admin) */}
          {(userRole === 'faculty' || userRole === 'mentor' || userRole === 'hod' || userRole === 'admin') && (
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider px-3 mb-1">
                Student Directory
              </div>
              <a
                href="/students"
                onClick={(e) => handleNavigate('/students', e)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors min-h-[44px]"
              >
                <Users className="w-4 h-4 text-primary" />
                <span>My Students</span>
              </a>
            </div>
          )}

          {/* Admin (Admin Only) */}
          {userRole === 'admin' && (
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider px-3 mb-1">
                Administration
              </div>
              <a
                href="/admin"
                onClick={(e) => handleNavigate('/admin', e)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors min-h-[44px]"
              >
                <Shield className="w-4 h-4 text-warning" />
                <span>Admin Control Center</span>
              </a>
              <a
                href="/admin/assign-mentor"
                onClick={(e) => handleNavigate('/admin/assign-mentor', e)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors min-h-[44px]"
              >
                <Users className="w-4 h-4 text-primary" />
                <span>Assign Mentor</span>
              </a>
              <a
                href="/admin/create-user"
                onClick={(e) => handleNavigate('/admin/create-user', e)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors min-h-[44px]"
              >
                <UserPlus className="w-4 h-4 text-success" />
                <span>Create User</span>
              </a>
            </div>
          )}
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-4 border-t border-border bg-surface-elevated/40 space-y-2">
          {(userRole === 'faculty' || userRole === 'mentor') && (
            <Button
              variant="outline"
              fullWidth
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={() => {
                onClose();
                if (onSwitchRole) onSwitchRole();
              }}
            >
              Switch to {userRole === 'faculty' ? 'MENTOR' : 'FACULTY'}
            </Button>
          )}

          <Button
            variant="danger"
            fullWidth
            icon={<LogOut className="w-4 h-4" />}
            onClick={() => {
              onClose();
              if (onLogout) onLogout();
            }}
          >
            Log Out
          </Button>
        </div>
      </div>
    </div>
  );
};
