import React, { useState, useEffect } from 'react';
import { AppShell } from './components/layout';
import { Alert, Button, Card } from './components/ui';
import { ShieldAlert, LogOut, Loader2 } from 'lucide-react';
import { authApi } from './api/auth';
import { getApiToken, clearApiToken } from './api/client';
import { profileApi, ProfileData } from './api/profile';
import {
  LoginPage,
  StudentDashboard,
  MyLeavesPage,
  ApplyLeavePage,
  MyOdsPage,
  ApplyOdPage,
  AttendancePage,
  FacultyAttendancePage,
  ProfilePage,
  NotificationsPage,
  PendingApprovalsPage,
  AdminPage,
  StudentsListPage
} from './pages';

type RoleType = 'student' | 'faculty' | 'mentor' | 'hod' | 'admin';

export function App() {
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname || '/');
  const [userRole, setUserRole] = useState<RoleType>('student');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<ProfileData | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);

  // Restore user session on startup
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);

    const initAuth = async () => {
      const token = getApiToken();
      if (!token) {
        setIsAuthenticated(false);
        setIsInitialLoading(false);
        return;
      }

      try {
        const profile = await profileApi.getProfile();
        setUserProfile(profile);
        const normalizedRole = (profile.role || 'student').toLowerCase() as RoleType;
        setUserRole(normalizedRole);
        setIsAuthenticated(true);
      } catch (err) {
        clearApiToken();
        setIsAuthenticated(false);
      } finally {
        setIsInitialLoading(false);
      }
    };

    initAuth();

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  const handleLoginSuccess = async (loginUser: { id: number; username: string; full_name: string; role: string }) => {
    try {
      const profile = await profileApi.getProfile();
      setUserProfile(profile);
      const normalizedRole = (profile.role || loginUser.role || 'student').toLowerCase() as RoleType;
      setUserRole(normalizedRole);
    } catch {
      setUserProfile({
        id: loginUser.id,
        username: loginUser.username,
        full_name: loginUser.full_name,
        email: `${loginUser.username}@permitrack.edu`,
        role: loginUser.role
      });
      setUserRole((loginUser.role || 'student').toLowerCase() as RoleType);
    } finally {
      setIsAuthenticated(true);
      navigate('/');
    }
  };

  const handleRoleSwitch = async () => {
    const targetRole = userRole === 'faculty' ? 'mentor' : 'faculty';
    try {
      await authApi.switchRole(targetRole);
    } catch (err) {
      console.error('Role switch error', err);
    }
    setUserRole(targetRole as RoleType);
    if (userProfile) {
      setUserProfile({ ...userProfile, role: targetRole });
    }
    navigate('/');
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Fallback
    } finally {
      clearApiToken();
      setUserProfile(null);
      setIsAuthenticated(false);
      navigate('/login');
    }
  };

  const renderContent = () => {
    switch (currentPath) {
      case '/my-leaves':
        return <MyLeavesPage onApplyLeaveClick={() => navigate('/apply-leave')} />;
      case '/apply-leave':
        return <ApplyLeavePage onBack={() => navigate('/my-leaves')} onSuccess={() => navigate('/my-leaves')} />;
      case '/my-ods':
        return <MyOdsPage onApplyOdClick={() => navigate('/apply-od')} />;
      case '/apply-od':
        return <ApplyOdPage onBack={() => navigate('/my-ods')} onSuccess={() => navigate('/my-ods')} />;
      case '/attendance':
        if (userRole !== 'faculty' && userRole !== 'hod') {
          return (
            <div className="max-w-2xl mx-auto py-12 space-y-4">
              <Alert type="danger" title="403 Forbidden: Access Restricted">
                Attendance marking functionality is restricted exclusively to Class Faculty members for their assigned class cohort.
              </Alert>
              <Card className="p-8 text-center space-y-4">
                <ShieldAlert className="w-12 h-12 text-danger mx-auto" />
                <h3 className="text-lg font-bold text-text-primary">Unauthorized Page Access</h3>
                <p className="text-xs text-text-muted leading-relaxed max-w-md mx-auto">
                  Administrator and Student accounts do not have permission to mark class attendance.
                </p>
                <Button variant="primary" onClick={() => navigate('/')}>
                  Return to Main Dashboard
                </Button>
              </Card>
            </div>
          );
        }
        return <FacultyAttendancePage />;
      case '/students':
        if (userRole !== 'faculty' && userRole !== 'mentor' && userRole !== 'hod' && userRole !== 'admin') {
          return (
            <div className="max-w-2xl mx-auto py-12 space-y-4">
              <Alert type="danger" title="403 Forbidden: Access Restricted">
                Student directory access is restricted to Faculty, Mentor, HOD, and Administrator accounts.
              </Alert>
              <Card className="p-8 text-center space-y-4">
                <ShieldAlert className="w-12 h-12 text-danger mx-auto" />
                <h3 className="text-lg font-bold text-text-primary">Unauthorized Page Access</h3>
                <Button variant="primary" onClick={() => navigate('/')}>
                  Return to Main Dashboard
                </Button>
              </Card>
            </div>
          );
        }
        return <StudentsListPage />;
      case '/profile':
        return <ProfilePage />;
      case '/notifications':
        return <NotificationsPage />;
      case '/pending-leaves':
      case '/pending-ods':
        return <PendingApprovalsPage />;
      case '/admin':
      case '/admin/assign-mentor':
      case '/admin/create-user':
        if (userRole !== 'admin') {
          return (
            <div className="max-w-2xl mx-auto py-12 space-y-4">
              <Alert type="danger" title="403 Forbidden: Access Restricted">
                Administrative tools and system registry access are restricted exclusively to System Administrators.
              </Alert>
              <Card className="p-8 text-center space-y-4">
                <ShieldAlert className="w-12 h-12 text-danger mx-auto" />
                <h3 className="text-lg font-bold text-text-primary">Unauthorized Admin Page Access</h3>
                <p className="text-xs text-text-muted leading-relaxed max-w-md mx-auto">
                  Your current account role ({userRole.toUpperCase()}) does not have permission to view or use System Administrative Tools.
                </p>
                <Button variant="primary" onClick={() => navigate('/')}>
                  Return to Main Dashboard
                </Button>
              </Card>
            </div>
          );
        }
        return <AdminPage />;
      default:
        if (userRole === 'admin') {
          return <AdminPage />;
        }
        if (userRole === 'faculty' || userRole === 'mentor' || userRole === 'hod') {
          return <PendingApprovalsPage />;
        }
        return (
          <StudentDashboard
            onApplyLeave={() => navigate('/my-leaves')}
            onApplyOd={() => navigate('/my-ods')}
          />
        );
    }
  };

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
          <p className="text-xs text-text-muted font-medium">Loading Permitrack Workspace...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <AppShell
      userRole={userRole}
      userName={userProfile?.full_name || userProfile?.username || 'User'}
      userEmail={userProfile?.email || `${userProfile?.username || 'user'}@permitrack.edu`}
      currentPath={currentPath}
      onSwitchRole={handleRoleSwitch}
      onLogout={handleLogout}
      onNavigate={navigate}
    >
      {renderContent()}
    </AppShell>
  );
}

export default App;
