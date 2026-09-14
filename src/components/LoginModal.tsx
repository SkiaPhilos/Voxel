import React, { useState, useEffect } from 'react';
import {
  PhoneCall,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  ArrowLeft,
  RefreshCw,
  Shield,
  User,
} from 'lucide-react';
import { api } from '../lib/api';
import type { User as UserType } from '../types';

interface LoginModalProps {
  onSuccess: (user: UserType) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onSuccess }) => {
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const [isSetupNeeded, setIsSetupNeeded] = useState(false);

  // Login & Password Reset states: 'email' | 'password' | 'forgot-request' | 'forgot-verify'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'email' | 'password' | 'forgot-request' | 'forgot-verify'>('email');
  const [userName, setUserName] = useState<string | null>(null);

  // OTP Reset states
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  // First-run Setup state (when 0 users exist in DB)
  const [setupName, setSetupName] = useState('');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function checkSetup() {
      try {
        const res = await api.getSetupStatus();
        if (isMounted) {
          setIsSetupNeeded(!res.isSetupComplete);
        }
      } catch (err: any) {
        console.warn('Failed to query setup status:', err);
        if (isMounted && err.message) {
          setErrorMessage(err.message);
        }
      } finally {
        if (isMounted) {
          setIsCheckingSetup(false);
        }
      }
    }
    checkSetup();
    return () => {
      isMounted = false;
    };
  }, []);

  // Handler for First-Run Admin Setup
  const handleFirstAdminSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!setupEmail.trim() || !setupEmail.includes('@')) {
      setErrorMessage('Please enter a valid work email address.');
      return;
    }
    if (!setupPassword || setupPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }
    if (setupPassword !== setupConfirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.setupFirstAdmin({
        name: setupName.trim(),
        email: setupEmail.trim().toLowerCase(),
        password: setupPassword,
      });
      onSuccess(res.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initialize master admin account.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for Step 1: Email check
  const handleCheckEmail = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please enter your work email.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.checkEmail(email.trim());
      if (res.exists) {
        setUserName(res.name || null);
        setStep('password');
      } else {
        setErrorMessage(res.message || "You don't have access.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error verifying account access.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for Step 2: Password check
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.login(email.trim(), password);
      onSuccess(res.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Incorrect password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for requesting Password Reset OTP
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please provide a valid email address.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessNotice(null);

    try {
      const res = await api.forgotPassword(email.trim().toLowerCase());
      setSuccessNotice(`A 6-digit verification code was sent to ${res.email}.`);
      if (res.devOtpHint) {
        setDevOtpHint(res.devOtpHint);
      }
      setStep('forgot-verify');
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not send password reset code. Please verify your email.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for verifying OTP and resetting password
  const handleVerifyResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      setErrorMessage('Please enter the 6-digit code sent to your email.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.verifyResetOtp({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        newPassword,
      });
      onSuccess(res.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid or expired verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSetup) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
        <div className="w-full max-w-md bg-[#FAF8F5] border border-stone-200 rounded-2xl shadow-xl p-8 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 border-3 border-amber-700 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-stone-500 font-medium">Connecting to workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#FAF8F5] border border-stone-200 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-stone-200/80 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-700 text-amber-50 flex items-center justify-center shadow-xs">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-900 font-sans tracking-tight">ColdCall CRM</h2>
              <p className="text-xs text-stone-500">Internal Sales Calling &amp; Follow-up Hub</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* ========================================================= */}
          {/* FIRST-RUN SETUP: Create Master Admin Account (if 0 users) */}
          {/* ========================================================= */}
          {isSetupNeeded ? (
            <form onSubmit={handleFirstAdminSetup} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/90 text-stone-800 text-xs flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-amber-950">Initial Workspace Setup</div>
                  <p className="text-amber-900/80 mt-0.5 leading-relaxed">
                    No users exist in the database yet. Create your Master Administrator account to initialize this CRM.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5 uppercase tracking-wider">
                  Admin Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="setup-admin-name-input"
                    type="text"
                    required
                    autoFocus
                    value={setupName}
                    onChange={(e) => {
                      setSetupName(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="e.g. Abdullah Saeed"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-700 focus:border-amber-700 transition-all shadow-2xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5 uppercase tracking-wider">
                  Admin Work Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="setup-admin-email-input"
                    type="email"
                    required
                    value={setupEmail}
                    onChange={(e) => {
                      setSetupEmail(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="admin@yourcompany.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-700 focus:border-amber-700 transition-all shadow-2xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5 uppercase tracking-wider">
                  Master Password (min. 6 characters)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="setup-admin-password-input"
                    type="password"
                    required
                    minLength={6}
                    value={setupPassword}
                    onChange={(e) => {
                      setSetupPassword(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-700 focus:border-amber-700 transition-all shadow-2xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5 uppercase tracking-wider">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="setup-admin-confirm-password-input"
                    type="password"
                    required
                    minLength={6}
                    value={setupConfirmPassword}
                    onChange={(e) => {
                      setSetupConfirmPassword(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-700 focus:border-amber-700 transition-all shadow-2xs"
                  />
                </div>
              </div>

              {errorMessage && (
                <div
                  id="setup-error-banner"
                  className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                id="setup-create-admin-btn"
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-sm font-semibold shadow-xs transition-all cursor-pointer mt-2"
              >
                {isLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Create Master Admin &amp; Launch</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* ========================================================= */
            /* STANDARD PRODUCTION LOGIN (No demo shortcuts or presets)   */
            /* ========================================================= */
            <>
              {step === 'email' ? (
                <form onSubmit={handleCheckEmail} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5 uppercase tracking-wider">
                      Work Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="login-email-input"
                        type="email"
                        required
                        autoFocus
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        placeholder="you@yourcompany.com"
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-700 focus:border-amber-700 transition-all shadow-2xs"
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-stone-500">
                      Access is invite-only. Your administrator grants login credentials.
                    </p>
                  </div>

                  {errorMessage && (
                    <div
                      id="login-error-banner"
                      className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-in fade-in duration-200"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                      <div>
                        <span className="font-semibold">{errorMessage}</span>
                        {errorMessage.includes("don't have access") && (
                          <p className="mt-0.5 text-rose-700/90 text-[11px]">
                            Only an Admin can grant access via the settings panel. Contact your team admin.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    id="login-check-email-btn"
                    type="submit"
                    disabled={isLoading || !email.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-sm font-semibold shadow-xs transition-all cursor-pointer"
                  >
                    {isLoading ? (
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Continue</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="pt-2 text-center border-t border-stone-200/60">
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMessage(null);
                        setStep('forgot-request');
                      }}
                      className="text-xs text-stone-500 hover:text-amber-800 font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Forgot password? Reset via email code</span>
                    </button>
                  </div>
                </form>
              ) : step === 'password' ? (
                /* Step 2: Password Prompt */
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                      <span className="truncate">
                        Account verified: <strong>{userName || email}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStep('email');
                        setPassword('');
                        setErrorMessage(null);
                      }}
                      className="text-amber-800 underline hover:text-amber-900 text-xs font-semibold cursor-pointer shrink-0 ml-2"
                    >
                      Change
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider">
                        Enter Password
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRequestOtp()}
                        className="text-[11px] text-amber-700 hover:text-amber-900 font-semibold cursor-pointer underline"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="login-password-input"
                        type="password"
                        required
                        autoFocus
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-700 focus:border-amber-700 transition-all shadow-2xs"
                      />
                    </div>
                  </div>

                  {errorMessage && (
                    <div
                      id="login-password-error-banner"
                      className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <button
                    id="login-submit-btn"
                    type="submit"
                    disabled={isLoading || !password}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-sm font-semibold shadow-xs transition-all cursor-pointer"
                  >
                    {isLoading ? (
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span>Log In to Workspace</span>
                    )}
                  </button>

                  <div className="pt-2 text-center border-t border-stone-200/60">
                    <button
                      type="button"
                      onClick={() => handleRequestOtp()}
                      className="text-xs text-stone-500 hover:text-amber-800 font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Request Password Reset OTP on Email</span>
                    </button>
                  </div>
                </form>
              ) : step === 'forgot-request' ? (
                /* Forgot Step 1: Request Code */
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMessage(null);
                        setStep('email');
                      }}
                      className="p-1 -ml-1 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
                      title="Back to login"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <h3 className="text-sm font-bold text-stone-900">Reset Account Password</h3>
                      <p className="text-[11px] text-stone-500">We will email a 6-digit verification code</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5 uppercase tracking-wider">
                      Work Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reset-request-email-input"
                        type="email"
                        required
                        autoFocus
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        placeholder="you@yourcompany.com"
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-700 focus:border-amber-700 transition-all shadow-2xs"
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-stone-500">
                      The OTP will be sent to this email address if it has an active account.
                    </p>
                  </div>

                  {errorMessage && (
                    <div
                      id="reset-request-error-banner"
                      className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <button
                    id="send-otp-btn"
                    type="submit"
                    disabled={isLoading || !email.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-sm font-semibold shadow-xs transition-all cursor-pointer"
                  >
                    {isLoading ? (
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Send 6-Digit OTP Code</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="text-center pt-2 border-t border-stone-200/60">
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMessage(null);
                        setStep('email');
                      }}
                      className="text-xs text-stone-500 hover:text-stone-800 font-medium cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </form>
              ) : (
                /* Forgot Step 2: Verify Code & Set New Password */
                <form onSubmit={handleVerifyResetOtp} className="space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMessage(null);
                        setStep('forgot-request');
                      }}
                      className="p-1 -ml-1 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
                      title="Change email"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <h3 className="text-sm font-bold text-stone-900">Enter Verification Code</h3>
                      <p className="text-[11px] text-stone-500">Sent to {email}</p>
                    </div>
                  </div>

                  {successNotice && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span>{successNotice}</span>
                    </div>
                  )}

                  {devOtpHint && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
                      <span>Dev fallback code: <strong className="font-mono">{devOtpHint}</strong></span>
                      <button
                        type="button"
                        onClick={() => setOtp(devOtpHint)}
                        className="text-amber-800 font-bold underline text-[11px] cursor-pointer ml-2"
                      >
                        Autofill
                      </button>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5 uppercase tracking-wider">
                      6-Digit Reset Code
                    </label>
                    <input
                      id="reset-otp-input"
                      type="text"
                      maxLength={6}
                      required
                      autoFocus
                      value={otp}
                      onChange={(e) => {
                        setOtp(e.target.value.replace(/\D/g, ''));
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="123456"
                      className="w-full py-3 px-4 text-center tracking-[0.5em] font-mono text-xl font-bold bg-white border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-300 placeholder:tracking-normal focus:outline-hidden focus:ring-2 focus:ring-amber-700 focus:border-amber-700 transition-all shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5 uppercase tracking-wider">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reset-new-password-input"
                        type="password"
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        placeholder="At least 6 characters"
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-700 focus:border-amber-700 transition-all shadow-2xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5 uppercase tracking-wider">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="reset-confirm-password-input"
                        type="password"
                        required
                        minLength={6}
                        value={confirmNewPassword}
                        onChange={(e) => {
                          setConfirmNewPassword(e.target.value);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        placeholder="Repeat new password"
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-700 focus:border-amber-700 transition-all shadow-2xs"
                      />
                    </div>
                  </div>

                  {errorMessage && (
                    <div
                      id="reset-verify-error-banner"
                      className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <button
                    id="reset-verify-submit-btn"
                    type="submit"
                    disabled={isLoading || otp.length < 6 || !newPassword}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-sm font-semibold shadow-xs transition-all cursor-pointer"
                  >
                    {isLoading ? (
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Reset Password &amp; Log In</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between pt-2 border-t border-stone-200/60 text-xs">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleRequestOtp()}
                      className="text-stone-500 hover:text-amber-800 font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Resend Code</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMessage(null);
                        setStep('email');
                      }}
                      className="text-stone-500 hover:text-stone-800 font-medium cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
