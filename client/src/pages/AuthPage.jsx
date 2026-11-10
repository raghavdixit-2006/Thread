// pages/AuthPage.jsx - sign in / register / email OTP verify / password reset / Google.
// Flows mirror the server contract (unchanged); markup uses the legacy .auth-card language.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  useRegisterMutation,
  useLoginMutation,
  useSendOtpMutation,
  useVerifyOtpMutation,
  useCompleteResetMutation,
  useLazyGoogleUrlQuery,
} from '../services/authApi.js';
import { setSession } from '../services/session.js';
import { useGetConfigQuery } from '../services/configApi.js';
import { validateRegister, validateLogin, mapValidationDetails, hasUnmappedFields } from '../utils/validators.js';
import ErrorNote from '../components/common/ErrorNote.jsx';
import { OTP_RESEND_COOLDOWN_SECONDS, TERMS_VERSION } from '../utils/constants.js';

const REGISTER_FIELDS = ['name', 'email', 'password', 'accepted'];
const LOGIN_FIELDS = ['email', 'password'];

/** counts OTP_RESEND_COOLDOWN_SECONDS down, restarting whenever `resetKey` bumps */
function useCountdown(active, resetKey = 0) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!active) return undefined;
    const startedAt = Date.now();
    setSecondsLeft(OTP_RESEND_COOLDOWN_SECONDS);
    const timer = setInterval(() => {
      setSecondsLeft(Math.max(0, OTP_RESEND_COOLDOWN_SECONDS - Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [active, resetKey]);

  return secondsLeft;
}

/** password visibility toggle - positioned inside .input-wrap, Bootstrap Icons only */
function PasswordReveal({ show, onToggle }) {
  return (
    <button
      type="button"
      className="reveal-password"
      onClick={onToggle}
      aria-label={show ? 'Hide password' : 'Show password'}
      aria-pressed={show}
    >
      <i className={`bi ${show ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true" />
    </button>
  );
}

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const nextUrl = searchParams.get('next') || '/';
  // console delivery means no mail transport is configured; only then is the dev tip true
  const config = useGetConfigQuery();
  const consoleMail = config.data?.email?.delivery === 'console';
  // oauth failures carried over from the Google callback landing
  const oauthHandoff = typeof window !== 'undefined' ? sessionStorage.getItem('thread.oauthError') : null;
  const [googleError, setGoogleError] = useState(oauthHandoff ? { message: oauthHandoff } : null);

  useEffect(() => {
    if (oauthHandoff) sessionStorage.removeItem('thread.oauthError');
    if (sessionEnded) sessionStorage.removeItem('thread.sessionEnded');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [otp, setOtp] = useState('');
  const [purpose, setPurpose] = useState('verify');
  const [resetToken, setResetToken] = useState('');
  const [retype, setRetype] = useState('');
  const [formError, setFormError] = useState(null);
  const [otpHint, setOtpHint] = useState(null);
  const [resendTick, setResendTick] = useState(0);
  // inline field feedback (validated on blur + submit; the server contract mirrored in utils/validators.js)
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  // gentle notice when a saved session was interrupted (refresh cookie rejected at boot)
  const [sessionEnded, setSessionEnded] = useState(
    typeof window !== 'undefined' && sessionStorage.getItem('thread.sessionEnded') === '1',
  );

  const [register, { isLoading: registering }] = useRegisterMutation();
  const [login, { isLoading: loggingIn }] = useLoginMutation();
  const [sendOtp, { isLoading: sendingOtp }] = useSendOtpMutation();
  const [verifyOtp, { isLoading: verifying }] = useVerifyOtpMutation();
  const [completeReset, { isLoading: resetting }] = useCompleteResetMutation();
  const [fetchGoogleUrl, { isLoading: startingGoogle }] = useLazyGoogleUrlQuery();

  const submitLock = loggingIn || registering || verifying || resetting || startingGoogle;
  const resendIn = useCountdown(mode === 'otp' && resendTick > 0, resendTick);

  /** re-validate one field on blur and surface only its message */
  function checkField(form, key) {
    if (key === 'accepted') return; // checkbox gives instant feedback on its own action
    const values = { name: name.trim(), email: email.trim(), password, accepted };
    const errors = form === 'register' ? validateRegister(values) : validateLogin(values);
    setFieldErrors((prev) => ({ ...prev, [key]: errors[key] || null }));
  }

  /** typing invalidates the field's old error until the next blur/submit */
  function clearFieldError(key) {
    setFieldErrors((prev) => ({ ...prev, [key]: null }));
  }

  function focusFirstError(form, fields, errors) {
    const first = fields.find((key) => errors[key]);
    if (!first) return;
    const id = first === 'accepted' ? 'reg-accept' : `${form === 'register' ? 'reg' : 'login'}-${first}`;
    document.getElementById(id)?.focus();
  }

  function resetFieldFeedback() {
    setFieldErrors({});
    setFormError(null);
  }

  function goNext(user) {
    // deep-link guard: only app-relative, never /auth itself
    const safe = nextUrl.startsWith('/') && !nextUrl.startsWith('/auth') ? nextUrl : '/';
    navigate(safe, { replace: true });
    return user;
  }

  async function onLogin(event) {
    event.preventDefault();
    setFormError(null);
    const values = { email: email.trim(), password };
    const errors = validateLogin(values);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      focusFirstError('login', LOGIN_FIELDS, errors);
      return;
    }
    setFieldErrors({});
    try {
      const result = await login(values).unwrap();
      if (result.requiresOtp) {
        setPurpose('verify');
        await armOtp(`We sent a 6-digit code to ${result.email || email}. It expires in 10 minutes.`);
        return;
      }
      setSession(result.accessToken, result.user);
      goNext(result.user);
    } catch (error) {
      setFormError(error);
    }
  }

  async function onRegister(event) {
    event.preventDefault();
    setFormError(null);
    const values = { name: name.trim(), email: email.trim(), password, accepted };
    const errors = validateRegister(values);
    if (Object.keys(errors).length > 0) {
      // never send a body we already know fails: field-level feedback, no dead 422
      setFieldErrors(errors);
      focusFirstError('register', REGISTER_FIELDS, errors);
      return;
    }
    setFieldErrors({});
    try {
      const result = await register({
        name: values.name,
        email: values.email,
        password,
        accepted,
        termsVersion: TERMS_VERSION,
      }).unwrap();
      if (result.requiresOtp) {
        setPurpose('verify');
        await armOtp(
          `Account created for ${result.email || email}. Enter the verification code we just sent to finish signing in.`,
        );
      }
    } catch (error) {
      if (error?.code === 'VALIDATION_ERROR') {
        // server is authority for anything the local mirror missed; map details onto fields
        const mapped = mapValidationDetails(error);
        const known = REGISTER_FIELDS.filter((key) => mapped[key]);
        if (known.length > 0 && !hasUnmappedFields(mapped, REGISTER_FIELDS)) {
          setFieldErrors(mapped);
          focusFirstError('register', REGISTER_FIELDS, mapped);
          return;
        }
      }
      setFormError(error);
    }
  }

  async function onVerify(event) {
    event.preventDefault();
    setFormError(null);
    try {
      const result = await verifyOtp({ email: email.trim(), purpose, code: otp }).unwrap();
      if (purpose === 'verify' && result.status === 'authenticated') {
        setSession(result.accessToken, result.user);
        goNext(result.user);
        return;
      }
      if (purpose === 'reset' && result.resetToken) {
        setResetToken(result.resetToken);
        setMode('finalReset');
        return;
      }
      setFormError({ message: 'Unexpected server response. Please try again.' });
    } catch (error) {
      setFormError(error);
    }
  }

  async function onResend() {
    setFormError(null);
    try {
      await sendOtp({ email: email.trim(), purpose }).unwrap();
      setOtpHint(
        consoleMail
          ? `Code re-sent to ${email}. No mail transport is configured, so it prints in the API console.`
          : `Code re-sent to ${email}. It expires in 10 minutes.`,
      );
      setResendTick((value) => value + 1);
    } catch (error) {
      setFormError(error);
    }
  }

  async function onFinalReset(event) {
    event.preventDefault();
    setFormError(null);
    try {
      const result = await completeReset({ resetToken, password }).unwrap();
      setSession(result.accessToken, result.user);
      goNext(result.user);
    } catch (error) {
      setFormError(error);
    }
  }

  async function onStartGoogle() {
    setGoogleError(null);
    try {
      const url = await fetchGoogleUrl(nextUrl.startsWith('/') ? nextUrl : '/').unwrap();
      if (url?.url) window.location.assign(url.url);
      else setGoogleError({ message: 'Google sign-in is not configured on this server yet.' });
    } catch (error) {
      setGoogleError(error);
    }
  }

  // first otp-sent grants the countdown key too (resendTick starts at 0)
  async function armOtp(hint) {
    setOtpHint(hint);
    setMode('otp');
    setResendTick((value) => value + 1);
  }

  return (
    <div className="container auth-page">
      <p className="eyebrow auth-eyebrow">THREAD account</p>

      <div className="auth-card">
        <h1 className="sr-only">Sign in or create your THREAD account</h1>
        {sessionEnded && (
          <p className="alert session-note" role="status">
            <i className="bi bi-info-circle" aria-hidden="true" /> Your session ended. Sign in again to continue.
          </p>
        )}
        {(mode === 'login' || mode === 'register') && (
          <>
            <div className="auth-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
                onClick={() => { setMode('login'); resetFieldFeedback(); }}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
                onClick={() => { setMode('register'); resetFieldFeedback(); }}
              >
                Create account
              </button>
            </div>

            {mode === 'login' ? (
              <form className="form-grid" onSubmit={onLogin} noValidate>
                <div className="field">
                  <label htmlFor="login-email">Email</label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => { setEmail(event.target.value); clearFieldError('email'); }}
                    onBlur={() => checkField('login', 'email')}
                    className={fieldErrors.email ? 'is-invalid' : ''}
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                  />
                  {fieldErrors.email && (
                    <p className="field-error" id="login-email-error" role="alert">
                      <i className="bi bi-exclamation-circle" aria-hidden="true" /> {fieldErrors.email}
                    </p>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="login-password">Password</label>
                  <div className="input-wrap">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => { setPassword(event.target.value); clearFieldError('password'); }}
                      onBlur={() => checkField('login', 'password')}
                      className={fieldErrors.password ? 'is-invalid' : ''}
                      aria-invalid={Boolean(fieldErrors.password)}
                      aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                      required
                    />
                    <PasswordReveal show={showPassword} onToggle={() => setShowPassword((value) => !value)} />
                  </div>
                  {fieldErrors.password && (
                    <p className="field-error" id="login-password-error" role="alert">
                      <i className="bi bi-exclamation-circle" aria-hidden="true" /> {fieldErrors.password}
                    </p>
                  )}
                </div>
                {formError && <ErrorNote error={formError} compact />}
                {formError?.code === 'ADMIN_PORTAL_ONLY' && (
                  <p className="alert session-note" role="status">
                    <i className="bi bi-shield-lock" aria-hidden="true" /> Administrator?{' '}
                    <Link to="/admin/login" className="text-link">Open the staff portal</Link>
                  </p>
                )}
                <button type="submit" className="btn auth-submit" disabled={submitLock}>
                  {loggingIn ? 'Checking credentials' : 'Sign in'}
                </button>
                <button type="button" className="link" onClick={() => { setMode('reset'); setPurpose('reset'); resetFieldFeedback(); }} style={{ alignSelf: 'flex-start' }}>
                  Forgot your password?
                </button>

                <div className="divider">or</div>
                <button type="button" className="btn ghost auth-submit" onClick={onStartGoogle} disabled={startingGoogle}>
                  <i className="bi bi-google" aria-hidden="true" /> Continue with Google
                </button>
                {googleError && <ErrorNote error={googleError} compact />}

                <p className="auth-switch">
                  New here?{' '}
                  <button type="button" className="link" onClick={() => { setMode('register'); resetFieldFeedback(); }}>Create an account</button>
                </p>
              </form>
            ) : (
              <form className="form-grid" onSubmit={onRegister} noValidate>
                <div className="field">
                  <label htmlFor="reg-name">Full name</label>
                  <input
                    id="reg-name"
                    autoComplete="name"
                    value={name}
                    onChange={(event) => { setName(event.target.value); clearFieldError('name'); }}
                    onBlur={() => checkField('register', 'name')}
                    className={fieldErrors.name ? 'is-invalid' : ''}
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={fieldErrors.name ? 'reg-name-error' : undefined}
                  />
                  {fieldErrors.name && (
                    <p className="field-error" id="reg-name-error" role="alert">
                      <i className="bi bi-exclamation-circle" aria-hidden="true" /> {fieldErrors.name}
                    </p>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="reg-email">Email</label>
                  <input
                    id="reg-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => { setEmail(event.target.value); clearFieldError('email'); }}
                    onBlur={() => checkField('register', 'email')}
                    className={fieldErrors.email ? 'is-invalid' : ''}
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? 'reg-email-error' : undefined}
                  />
                  {fieldErrors.email && (
                    <p className="field-error" id="reg-email-error" role="alert">
                      <i className="bi bi-exclamation-circle" aria-hidden="true" /> {fieldErrors.email}
                    </p>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="reg-password">Password</label>
                  <div className="input-wrap">
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => { setPassword(event.target.value); clearFieldError('password'); }}
                      onBlur={() => checkField('register', 'password')}
                      className={fieldErrors.password ? 'is-invalid' : ''}
                      aria-invalid={Boolean(fieldErrors.password)}
                      aria-describedby={fieldErrors.password ? 'reg-password-error reg-password-hint' : 'reg-password-hint'}
                    />
                    <PasswordReveal show={showPassword} onToggle={() => setShowPassword((value) => !value)} />
                  </div>
                  {fieldErrors.password ? (
                    <p className="field-error" id="reg-password-error" role="alert">
                      <i className="bi bi-exclamation-circle" aria-hidden="true" /> {fieldErrors.password}
                    </p>
                  ) : (
                    <span className="hint" id="reg-password-hint">At least 8 characters, with a letter and a digit.</span>
                  )}
                </div>
                <div className="field">
                  <span className="checkbox-line">
                    <input
                      id="reg-accept"
                      type="checkbox"
                      checked={accepted}
                      onChange={(event) => { setAccepted(event.target.checked); clearFieldError('accepted'); }}
                      className={fieldErrors.accepted ? 'is-invalid' : ''}
                      aria-invalid={Boolean(fieldErrors.accepted)}
                      aria-describedby={fieldErrors.accepted ? 'reg-accept-error' : undefined}
                    />
                    <label htmlFor="reg-accept">
                      I accept the <Link to="/policies/terms-of-service" className="link">Terms</Link> and the{' '}
                      <Link to="/policies/privacy-policy" className="link">Privacy Policy</Link>
                    </label>
                  </span>
                  {fieldErrors.accepted && (
                    <p className="field-error" id="reg-accept-error" role="alert">
                      <i className="bi bi-exclamation-circle" aria-hidden="true" /> {fieldErrors.accepted}
                    </p>
                  )}
                </div>
                {formError && <ErrorNote error={formError} compact />}
                <button type="submit" className="btn auth-submit" disabled={submitLock}>
                  {registering ? 'Creating account' : 'Create account'}
                </button>
                <p className="auth-switch">
                  Already with us?{' '}
                  <button type="button" className="link" onClick={() => { setMode('login'); resetFieldFeedback(); }}>Sign in</button>
                </p>
              </form>
            )}
          </>
        )}

        {mode === 'otp' && (
          <form className="form-grid" onSubmit={onVerify} noValidate>
            <div className="auth-tabs" style={{ justifyContent: 'flex-start' }}>
              <span className="eyebrow" style={{ margin: 0 }}>Email check</span>
            </div>
            <p className="hint">{otpHint || `Enter the 6-digit code sent to ${email}.`}</p>
            <div className="field">
              <label htmlFor="otp-code">Verification code</label>
              <input
                id="otp-code"
                className="otp-input"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                required
              />
            </div>
            {formError && <ErrorNote error={formError} compact />}
            {otpHint && consoleMail && (
              <p className="dev-email-hint">
                No mail transport is configured on this server, so the code prints in the API log as a{' '}
                <code>[DEV EMAIL]</code> line - use that code here.
              </p>
            )}
            <button type="submit" className="btn auth-submit" disabled={submitLock || otp.length !== 6}>
              {verifying ? 'Verifying code' : 'Verify and continue'}
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <button type="button" className="text-link" onClick={onResend} disabled={submitLock || sendingOtp || resendIn > 0}>
                {sendingOtp ? 'Sending' : resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
              </button>
              <button type="button" className="text-link" onClick={() => setMode('login')}>Back to sign in</button>
            </div>
          </form>
        )}

        {mode === 'reset' && (
          <form className="form-grid" onSubmit={(event) => event.preventDefault()} noValidate>
            <div className="auth-tabs" style={{ justifyContent: 'flex-start' }}>
              <span className="eyebrow" style={{ margin: 0 }}>Reset</span>
            </div>
            <p className="hint">Enter your account email and we will send a reset code.</p>
            <div className="field">
              <label htmlFor="reset-email">Email</label>
              <input id="reset-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            {formError && <ErrorNote error={formError} compact />}
            <button
              type="button"
              className="btn auth-submit"
              disabled={submitLock || !email.trim()}
              onClick={async () => {
                setFormError(null);
                try {
                  await sendOtp({ email: email.trim(), purpose: 'reset' }).unwrap();
                  setPurpose('reset');
                  await armOtp(`Reset code sent to ${email}. It stays valid for 10 minutes.`);
                } catch (error) {
                  setFormError(error);
                }
              }}
            >
              {sendingOtp ? 'Sending code' : 'Send reset code'}
            </button>
            <button type="button" className="text-link" onClick={() => setMode('login')} style={{ alignSelf: 'flex-start' }}>
              Back to sign in
            </button>
          </form>
        )}

        {mode === 'finalReset' && (
          <form className="form-grid" onSubmit={onFinalReset} noValidate>
            <div className="auth-tabs" style={{ justifyContent: 'flex-start' }}>
              <span className="eyebrow" style={{ margin: 0 }}>New password</span>
            </div>
            <p className="hint">Identity verified for {email}. Set the replacement password now.</p>
            <div className="field">
              <label htmlFor="final-password">New password</label>
              <input id="final-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
            </div>
            <div className="field">
              <label htmlFor="final-retype">Type it again</label>
              <input id="final-retype" type="password" value={retype} onChange={(event) => setRetype(event.target.value)} required minLength={8} />
              {retype && password !== retype && <p className="field-error">The two passwords do not match yet.</p>}
            </div>
            {formError && <ErrorNote error={formError} compact />}
            <button
              type="submit"
              className="btn auth-submit"
              disabled={submitLock || password !== retype}
            >
              {resetting ? 'Saving password' : 'Set password and sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

