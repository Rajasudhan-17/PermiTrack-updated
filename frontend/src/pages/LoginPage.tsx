import React, { useState } from 'react';
import { Card, Button, Input, Alert, Toast } from '../components/ui';
import { Shield, Lock, User, KeyRound, ArrowRight, ArrowLeft, Eye, EyeOff, Mail, CheckCircle2, RefreshCw } from 'lucide-react';
import { authApi } from '../api/auth';

interface LoginPageProps {
  onLoginSuccess: (user: {
    id: number;
    username: string;
    full_name: string;
    role: string;
    email?: string;
  }) => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  // Mode: 'login' | 'forgot' | 'verify'
  const [mode, setMode] = useState<'login' | 'forgot' | 'verify'>('login');

  // Sign in state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Forgot / OTP reset state
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Common UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMsg('Please enter both username and password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await authApi.login(username, password);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid username or password. Please verify your credentials and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Request OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetIdentifier.trim()) {
      setErrorMsg('Please enter your email, username, or roll number.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await authApi.forgotPassword(resetIdentifier.trim());
      setMaskedEmail(res.masked_email || res.email || resetIdentifier);
      setSuccessMsg(res.message || 'OTP code sent to your registered email address.');
      setMode('verify');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send OTP code. Please verify your username or email.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Verify OTP & Password Reset
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || !newPassword || !confirmPassword) {
      setErrorMsg('Please fill in all OTP and password fields.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirmation password do not match.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await authApi.verifyOtp({
        email_or_username: resetIdentifier.trim(),
        otp: otp.trim(),
        new_password: newPassword,
      });
      setSuccessMsg(res.message || 'Password reset successfully! Please sign in with your new password.');
      setMode('login');
      setUsername(resetIdentifier.trim());
      setPassword('');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid or expired OTP code. Please check and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07151F] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden select-none">
      {/* Ambient Radial Background Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-info/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Header Container */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10 text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-surface-elevated/80 border border-border/80 rounded-2xl shadow-xl shadow-primary/10 backdrop-blur-md">
          <img src="/static/logo.png" alt="Permitrack Logo" className="w-10 h-10 object-contain" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight font-display">
            Permitrack
          </h1>
          <p className="mt-1 text-xs text-text-muted font-medium">
            Academic Leave & Off-Duty Portal
          </p>
        </div>
      </div>

      {/* Main Card Container */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0">
        <Card className="p-6 sm:p-8 bg-surface/90 border border-border/80 shadow-2xl backdrop-blur-xl rounded-2xl">
          {errorMsg && (
            <div className="mb-5 animate-fadeIn">
              <Alert type="danger" title={mode === 'login' ? 'Sign In Failed' : 'Action Failed'}>
                {errorMsg}
              </Alert>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 animate-fadeIn">
              <Alert type="success" title="Success">
                {successMsg}
              </Alert>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODE 1: SIGN IN */}
          {/* ========================================================================= */}
          {mode === 'login' && (
            <form className="space-y-5" onSubmit={handleLoginSubmit}>
              <div>
                <Input
                  label="Register Number / Email / Username"
                  placeholder="e.g. 310624205188, student@gmail.com, or username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  leftIcon={<User className="w-4 h-4 text-text-muted" />}
                  autoComplete="username"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-text-secondary select-none">Password</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                      setResetIdentifier(username);
                    }}
                    className="text-xs font-medium text-primary hover:text-primary-hover hover:underline transition-colors focus:outline-none"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    leftIcon={<Lock className="w-4 h-4 text-text-muted" />}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                fullWidth
                isLoading={isLoading}
                className="py-3 text-sm font-semibold rounded-xl shadow-md shadow-primary/20 transition-all hover:shadow-primary/30"
              >
                Sign In to Permitrack
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>
          )}

          {/* ========================================================================= */}
          {/* MODE 2: FORGOT PASSWORD (REQUEST OTP) */}
          {/* ========================================================================= */}
          {mode === 'forgot' && (
            <form className="space-y-5" onSubmit={handleRequestOtp}>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-text-primary font-display">Reset Password</h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  Enter your registered email address, username, or roll number to receive a 6-digit OTP code.
                </p>
              </div>

              <Input
                label="Email / Username / Roll Number"
                placeholder="Enter email or username..."
                value={resetIdentifier}
                onChange={(e) => setResetIdentifier(e.target.value)}
                leftIcon={<Mail className="w-4 h-4 text-text-muted" />}
                required
              />

              <Button
                type="submit"
                variant="primary"
                fullWidth
                isLoading={isLoading}
                className="py-3 text-sm font-semibold rounded-xl"
              >
                Send Verification OTP
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* MODE 3: VERIFY OTP & RESET PASSWORD */}
          {/* ========================================================================= */}
          {mode === 'verify' && (
            <form className="space-y-5" onSubmit={handleVerifyOtp}>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-text-primary font-display">Enter OTP & New Password</h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  Check your inbox ({maskedEmail}) for the 6-digit OTP verification code.
                </p>
              </div>

              <Input
                label="6-Digit OTP Code"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                leftIcon={<KeyRound className="w-4 h-4 text-text-muted" />}
                maxLength={6}
                className="font-mono text-center tracking-widest font-bold"
                required
              />

              <div className="space-y-4">
                <div className="relative">
                  <Input
                    label="New Password"
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Minimum 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    leftIcon={<Lock className="w-4 h-4 text-text-muted" />}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-[34px] text-text-muted hover:text-text-primary transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <Input
                  label="Confirm New Password"
                  type="password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4 text-text-muted" />}
                  required
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                fullWidth
                isLoading={isLoading}
                className="py-3 text-sm font-semibold rounded-xl"
              >
                Reset Password
                <CheckCircle2 className="w-4 h-4 ml-2" />
              </Button>

              <div className="flex items-center justify-between pt-2 text-xs text-text-muted">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="inline-flex items-center gap-1 hover:text-text-primary transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </button>

                <button
                  type="button"
                  onClick={handleRequestOtp}
                  className="inline-flex items-center gap-1 text-primary hover:underline transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Resend OTP</span>
                </button>
              </div>
            </form>
          )}
        </Card>

        {/* Footer info */}
        <p className="mt-6 text-center text-[11px] text-text-muted">
          Permitrack Security System • Encrypted End-to-End • RBAC Protected
        </p>
      </div>
    </div>
  );
}
