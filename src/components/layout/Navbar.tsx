import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Calendar, 
  PlusCircle, 
  Briefcase, 
  FileCheck, 
  CheckSquare, 
  Clock, 
  Users, 
  Shield, 
  ChevronDown, 
  Menu, 
  X 
} from 'lucide-react';
import { NotificationMenu } from './NotificationMenu';
import { UserMenu } from './UserMenu';
import { MobileDrawer } from './MobileDrawer';

export interface NavbarProps {
  userRole?: 'student' | 'faculty' | 'mentor' | 'hod' | 'admin' | 'event_coordinator' | string;
  userName?: string;
  userEmail?: string;
  currentPath?: string;
  onLogout?: () => void;
  onSwitchRole?: () => void;
  onNavigate?: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  userRole = 'student',
  userName = 'Rajasudhan R',
  userEmail = 'rajasudhan@college.edu',
  currentPath = '/',
  onLogout,
  onSwitchRole,
  onNavigate,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [odOpen, setOdOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const leaveRef = useRef<HTMLDivElement>(null);
  const odRef = useRef<HTMLDivElement>(null);
  const adminRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (leaveRef.current && !leaveRef.current.contains(e.target as Node)) setLeaveOpen(false);
      if (odRef.current && !odRef.current.contains(e.target as Node)) setOdOpen(false);
      if (adminRef.current && !adminRef.current.contains(e.target as Node)) setAdminOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (path: string) => currentPath === path;

  const handleNavigate = (path: string, e: React.MouseEvent) => {
    e.preventDefault();
    setLeaveOpen(false);
    setOdOpen(false);
    setAdminOpen(false);
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new Event('popstate'));
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border bg-bg/85 backdrop-blur-md transition-colors">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Brand Logo & Title */}
          <a href="/" onClick={(e) => handleNavigate('/', e)} className="flex items-center gap-3 group shrink-0">
            <img 
              src="/static/logo.png" 
              alt="Permitrack Logo" 
              className="w-8 h-8 object-contain transition-transform group-hover:scale-105" 
            />
            <div className="flex flex-col">
              <span className="font-bold text-base text-text-primary tracking-tight font-display group-hover:text-primary transition-colors">
                Permitrack
              </span>
              <span className="text-[10px] text-text-muted font-medium">Leave & OD System</span>
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {/* Dashboard */}
            <a
              href="/"
              onClick={(e) => handleNavigate('/', e)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                isActive('/') || isActive('/dashboard')
                  ? 'text-primary bg-primary-subtle'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </a>

            {/* Leave Dropdown */}
            {(userRole === 'student' || userRole === 'faculty') && (
              <div ref={leaveRef} className="relative">
                <button
                  onClick={() => setLeaveOpen(!leaveOpen)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    currentPath.includes('/leave')
                      ? 'text-primary bg-primary-subtle'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  <span>Leave</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {leaveOpen && (
                  <div className="absolute left-0 mt-2 w-48 bg-surface border border-border rounded-xl shadow-lg py-1.5 z-50 animate-fadeIn">
                    <a
                      href="/my-leaves"
                      onClick={(e) => handleNavigate('/my-leaves', e)}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
                    >
                      <Calendar className="w-4 h-4 text-primary" />
                      <span>My Leaves</span>
                    </a>
                    <a
                      href="/apply-leave"
                      onClick={(e) => handleNavigate('/apply-leave', e)}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
                    >
                      <PlusCircle className="w-4 h-4 text-success" />
                      <span>Apply Leave</span>
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* OD Dropdown */}
            {userRole === 'student' && (
              <div ref={odRef} className="relative">
                <button
                  onClick={() => setOdOpen(!odOpen)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    currentPath.includes('/od')
                      ? 'text-primary bg-primary-subtle'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                  }`}
                >
                  <Briefcase className="w-4 h-4" />
                  <span>OD</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {odOpen && (
                  <div className="absolute left-0 mt-2 w-48 bg-surface border border-border rounded-xl shadow-lg py-1.5 z-50 animate-fadeIn">
                    <a
                      href="/my-ods"
                      onClick={(e) => handleNavigate('/my-ods', e)}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
                    >
                      <Briefcase className="w-4 h-4 text-primary" />
                      <span>My ODs</span>
                    </a>
                    <a
                      href="/apply-od"
                      onClick={(e) => handleNavigate('/apply-od', e)}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
                    >
                      <PlusCircle className="w-4 h-4 text-info" />
                      <span>Apply OD</span>
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Approvals (Faculty / Mentor / HOD / Event Coordinator) */}
            {(userRole === 'faculty' || userRole === 'mentor' || userRole === 'hod' || userRole === 'event_coordinator') && (
              <>
                <a
                  href="/pending-leaves"
                  onClick={(e) => handleNavigate('/pending-leaves', e)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                    isActive('/pending-leaves')
                      ? 'text-primary bg-primary-subtle'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>Pending Leaves</span>
                </a>
                <a
                  href="/pending-ods"
                  onClick={(e) => handleNavigate('/pending-ods', e)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                    isActive('/pending-ods')
                      ? 'text-primary bg-primary-subtle'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                  }`}
                >
                  <FileCheck className="w-4 h-4" />
                  <span>Pending ODs</span>
                </a>
              </>
            )}

            {/* Attendance (Class Faculty Only) */}
            {userRole === 'faculty' && (
              <a
                href="/attendance"
                onClick={(e) => handleNavigate('/attendance', e)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  isActive('/attendance')
                    ? 'text-primary bg-primary-subtle'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                <span>Attendance</span>
              </a>
            )}

            {/* Admin Tools Dropdown (Admin Only) */}
            {userRole === 'admin' && (
              <div ref={adminRef} className="relative">
                <button
                  onClick={() => setAdminOpen(!adminOpen)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    currentPath.includes('/admin')
                      ? 'text-primary bg-primary-subtle'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                  }`}
                >
                  <Shield className="w-4 h-4 text-warning" />
                  <span>Admin Tools</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {adminOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-surface border border-border rounded-xl shadow-lg py-1.5 z-50 animate-fadeIn">
                    <a
                      href="/admin"
                      onClick={(e) => handleNavigate('/admin', e)}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
                    >
                      <Shield className="w-4 h-4 text-warning" />
                      <span>Admin Control Center</span>
                    </a>
                    <a
                      href="/admin/assign-mentor"
                      onClick={(e) => handleNavigate('/admin/assign-mentor', e)}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
                    >
                      <Users className="w-4 h-4 text-primary" />
                      <span>Assign Mentor</span>
                    </a>
                    <a
                      href="/admin/create-user"
                      onClick={(e) => handleNavigate('/admin/create-user', e)}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
                    >
                      <PlusCircle className="w-4 h-4 text-success" />
                      <span>Create User</span>
                    </a>
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* Right Section: Notifications & User Area */}
          <div className="hidden lg:flex items-center gap-2">
            <NotificationMenu />
            <UserMenu
              userName={userName}
              userRole={userRole}
              userEmail={userEmail}
              onLogout={onLogout}
              onSwitchRole={onSwitchRole}
              onNavigate={onNavigate}
            />
          </div>

          {/* Mobile Right Bar Toggler */}
          <div className="flex items-center gap-2 lg:hidden">
            <NotificationMenu />
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Open Mobile Menu"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>

        </div>
      </header>

      {/* Mobile Drawer */}
      <MobileDrawer
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        userRole={userRole}
        userName={userName}
        userEmail={userEmail}
        onLogout={onLogout}
        onSwitchRole={onSwitchRole}
        onNavigate={onNavigate}
      />
    </>
  );
};
