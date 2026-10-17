import React, { FormEvent, useState } from 'react';
import { LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { useTraffic } from '../context/TrafficContext';
import { api } from '../lib/apiClient';

export const Account: React.FC = () => {
  const { backendConnected, currentUser, createAccount, signIn, signOut } = useTraffic();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'reset'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneVerificationCode, setPhoneVerificationCode] = useState('');
  const [phoneVerificationSent, setPhoneVerificationSent] = useState(false);
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (mode === 'signup') {
        await createAccount({ fullName, email, phone, city, password, phoneVerificationCode });
        setNotice('Your account is ready. Accident reports you submit will appear as pending until an admin reviews them.');
      } else if (mode === 'signin') {
        await signIn(email, password);
        setNotice('You are signed in.');
      } else if (mode === 'forgot') {
        const result = await api.requestPasswordReset(email);
        setMode('reset');
        setNotice(result.message);
      } else {
        if (password !== passwordConfirmation) {
          throw new Error('The new passwords do not match.');
        }
        const result = await api.confirmPasswordReset(email, otp, password);
        setMode('signin');
        setNotice(result.message);
      }
      setPassword('');
      setPasswordConfirmation('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Account request failed.');
    } finally {
      setBusy(false);
    }
  };

  const sendPhoneVerification = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api.requestSignupPhoneVerification(phone);
      setPhoneVerificationSent(true);
      setPhoneVerificationCode('');
      setNotice(result.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not send a mobile verification code.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    setError('');
    try {
      await signOut();
      setNotice('You are signed out.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not sign out.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 p-5">
      <section className="mx-auto max-w-xl rounded-xl border border-border bg-bg-panel p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan/30 bg-cyan/10 text-cyan">
            {currentUser?.role === 'admin' ? <ShieldCheck className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
          </span>
          <div>
            <h1 className="text-lg font-bold text-text-primary">Account</h1>
            <p className="text-xs text-text-secondary">Sign in to submit community traffic reports.</p>
          </div>
        </div>

        {!backendConnected && (
          <p role="alert" className="mt-5 rounded-lg border border-danger/30 bg-danger-dark/40 px-3 py-2 text-sm text-danger">
            The Python API is unavailable. Account access needs the backend connection.
          </p>
        )}
        {error && <p role="alert" className="mt-4 rounded-lg border border-danger/30 bg-danger-dark/40 px-3 py-2 text-sm text-danger">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-lg border border-success/30 bg-success-dark/40 px-3 py-2 text-sm text-success">{notice}</p>}

        {currentUser ? (
          <div className="mt-5 rounded-lg border border-border bg-[#0E1726] p-4">
            <p className="text-xs text-text-muted">Signed in as</p>
            <p className="mt-1 font-medium text-text-primary">{currentUser.fullName}</p>
            <p className="mt-1 font-medium text-text-primary">{currentUser.email}</p>
            {currentUser.phone && <p className="mt-1 text-xs text-text-secondary">{currentUser.phone}</p>}
            {currentUser.city && <p className="mt-1 text-xs text-text-secondary">{currentUser.city}</p>}
            <span className="mt-3 inline-flex rounded-full border border-cyan/30 bg-cyan/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan">
              {currentUser.role}
            </span>
            <button
              onClick={handleSignOut}
              disabled={busy || !backendConnected}
              className="mt-5 flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        ) : (
          <>
            <div className="mt-5 flex gap-2">
              {(['signin', 'signup'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setMode(item);
                    setPhoneVerificationSent(false);
                    setPhoneVerificationCode('');
                    setError('');
                    setNotice('');
                  }}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold capitalize ${
                    mode === item ? 'border-cyan bg-cyan/10 text-cyan' : 'border-border text-text-secondary'
                  }`}
                >
                  {item === 'signin' ? 'Sign in' : 'Create user account'}
                </button>
              ))}
            </div>
            <form onSubmit={submit} className="mt-4 space-y-3">
              {mode === 'signup' && (
                <label className="block text-xs font-medium text-text-secondary">
                  Full name
                  <input
                    type="text"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={100}
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-[#0E1726] px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan"
                  />
                </label>
              )}
              <label className="block text-xs font-medium text-text-secondary">
                Email
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-[#0E1726] px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan"
                />
              </label>
              {mode === 'signup' && (
                <>
                  <label className="block text-xs font-medium text-text-secondary">
                    Phone number
                    <input
                      type="tel"
                      autoComplete="tel"
                      required
                      value={phone}
                      onChange={(event) => {
                        setPhone(event.target.value);
                        setPhoneVerificationSent(false);
                        setPhoneVerificationCode('');
                      }}
                      placeholder="+91 98765 43210"
                      className="mt-1 w-full rounded-lg border border-border bg-[#0E1726] px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan"
                    />
                    <span className="mt-1 block text-[10px] text-text-muted">Use international format, for example +919876543210.</span>
                    <button
                      type="button"
                      onClick={sendPhoneVerification}
                      disabled={busy || !backendConnected || !phone.trim()}
                      className="mt-2 rounded-lg border border-cyan/40 px-3 py-2 text-xs font-semibold text-cyan hover:bg-cyan/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? 'Sending code…' : phoneVerificationSent ? 'Resend mobile code' : 'Send mobile code'}
                    </button>
                  </label>
                  {phoneVerificationSent && (
                    <label className="block text-xs font-medium text-text-secondary">
                      SMS verification code
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        required
                        value={phoneVerificationCode}
                        onChange={(event) => setPhoneVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="mt-1 w-full rounded-lg border border-border bg-[#0E1726] px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan"
                      />
                      <span className="mt-1 block text-[10px] text-text-muted">Your account is created only after the code is verified.</span>
                    </label>
                  )}
                  <label className="block text-xs font-medium text-text-secondary">
                    City
                    <input
                      type="text"
                      autoComplete="address-level2"
                      required
                      minLength={2}
                      maxLength={100}
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-[#0E1726] px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan"
                    />
                  </label>
                </>
              )}
              {(mode === 'forgot' || mode === 'reset') && (
                <p className="text-xs text-text-secondary">
                  {mode === 'forgot'
                    ? 'We will email a one-time reset code if this account exists.'
                    : 'Enter the six-digit code sent to your email and choose a new password.'}
                </p>
              )}
              {mode === 'reset' && (
                <label className="block text-xs font-medium text-text-secondary">
                  Email verification code
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    required
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="mt-1 w-full rounded-lg border border-border bg-[#0E1726] px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan"
                  />
                </label>
              )}
              {mode !== 'forgot' && (
                <label className="block text-xs font-medium text-text-secondary">
                  Password
                  <input
                    type="password"
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    required
                    minLength={12}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-[#0E1726] px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan"
                  />
                  {mode !== 'signin' && <span className="mt-1 block text-[10px] text-text-muted">Use at least 12 characters.</span>}
                </label>
              )}
              {mode === 'reset' && (
                <label className="block text-xs font-medium text-text-secondary">
                  Confirm new password
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    value={passwordConfirmation}
                    onChange={(event) => setPasswordConfirmation(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-[#0E1726] px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan"
                  />
                </label>
              )}
              <button
                type="submit"
                disabled={busy || !backendConnected || (mode === 'signup' && !phoneVerificationSent)}
                className="w-full rounded-lg bg-cyan px-4 py-2.5 text-sm font-semibold text-[#080F1B] hover:bg-cyan-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy
                  ? 'Please wait…'
                  : mode === 'signin'
                    ? 'Sign in'
                    : mode === 'signup'
                      ? phoneVerificationSent
                        ? 'Verify code & create account'
                        : 'Send a mobile code first'
                      : mode === 'forgot'
                        ? 'Send reset code'
                        : 'Reset password'}
              </button>
            </form>
            {mode === 'signin' && (
              <button
                type="button"
                onClick={() => {
                  setMode('forgot');
                  setError('');
                  setNotice('');
                }}
                className="mt-3 text-xs font-medium text-cyan hover:underline"
              >
                Forgot password?
              </button>
            )}
            {(mode === 'forgot' || mode === 'reset') && (
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setOtp('');
                  setError('');
                  setNotice('');
                }}
                className="mt-3 text-xs font-medium text-cyan hover:underline"
              >
                Back to sign in
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
};
