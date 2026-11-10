// pages/AdminLoginPage.jsx - staff portal entry on the dedicated endpoint (/api/admin/login).
// Minimal chrome by design: no register tabs, no Google, no storefront links; the two
// credential fields and a submit. Errors are server-shaped: 401 for bad credentials,
// 403 when the credentials belong to a customer (staff only). Field validation mirrors
// the server contract via utils/validators.js, like AuthPage.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminLoginMutation } from '../services/authApi.js';
import { setSession } from '../services/session.js';
import { validateLogin } from '../utils/validators.js';
import ErrorNote from '../components/common/ErrorNote.jsx';

const FIELD_ORDER = ['email', 'password'];

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [adminLogin, { isLoading }] = useAdminLoginMutation();

  function clearFieldError(key) {
    setFieldErrors((prev) => ({ ...prev, [key]: null }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setFormError(null);
    const values = { email: email.trim(), password };
    const errors = validateLogin(values);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const first = FIELD_ORDER.find((key) => errors[key]);
      document.getElementById(`admin-${first}`)?.focus();
      return;
    }
    setFieldErrors({});
    try {
      const result = await adminLogin(values).unwrap();
      setSession(result.accessToken, result.user);
      navigate('/admin', { replace: true });
    } catch (error) {
      setFormError(error);
    }
  }

  return (
    <div className="container admin-portal-page">
      <p className="eyebrow auth-eyebrow">THREAD staff</p>

      <div className="auth-card admin-card">
        <h1 className="sr-only">THREAD staff sign in</h1>
        <p className="hint">Administrator access only. Storefront customers sign in on the regular page.</p>
        <form className="form-grid" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="admin-email">Work email</label>
            <input
              id="admin-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => { setEmail(event.target.value); clearFieldError('email'); }}
              className={fieldErrors.email ? 'is-invalid' : ''}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'admin-email-error' : undefined}
            />
            {fieldErrors.email && (
              <p className="field-error" id="admin-email-error" role="alert">
                <i className="bi bi-exclamation-circle" aria-hidden="true" /> {fieldErrors.email}
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => { setPassword(event.target.value); clearFieldError('password'); }}
              className={fieldErrors.password ? 'is-invalid' : ''}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'admin-password-error' : undefined}
            />
            {fieldErrors.password && (
              <p className="field-error" id="admin-password-error" role="alert">
                <i className="bi bi-exclamation-circle" aria-hidden="true" /> {fieldErrors.password}
              </p>
            )}
          </div>
          {formError && <ErrorNote error={formError} compact />}
          <button type="submit" className="btn auth-submit" disabled={isLoading}>
            {isLoading ? 'Checking credentials' : 'Enter the console'}
          </button>
        </form>
      </div>
    </div>
  );
}

