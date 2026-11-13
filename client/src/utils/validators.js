// utils/validators.js - client mirror of the server's zod contracts for the auth forms.
// The server stays authoritative: these rules only decide when NOT to send a request
// (inline field feedback) and how to map a 422's details back onto fields.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** register form rules (mirror of server/src/modules/auth/schemas.js) */
export function validateRegister(values) {
  const errors = {};
  const name = (values.name || '').trim();
  if (name.length < 2) errors.name = name.length === 0 ? 'Please enter your full name.' : 'Name is too short (2+ characters).';

  const email = (values.email || '').trim();
  if (!email) errors.email = 'Please enter your email address.';
  else if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address, like name@example.com.';

  const password = values.password || '';
  if (password.length < 8) errors.password = password.length === 0 ? 'Create a password (8+ characters).' : 'Password needs at least 8 characters.';
  else if (!/[a-zA-Z]/.test(password)) errors.password = 'Include at least one letter.';
  else if (!/\d/.test(password)) errors.password = 'Include at least one digit.';

  if (!values.accepted) errors.accepted = 'Please accept the Terms and Privacy Policy to continue.';

  return errors;
}

/** login form rules */
export function validateLogin(values) {
  const errors = {};
  const email = (values.email || '').trim();
  if (!email) errors.email = 'Please enter your email address.';
  else if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address, like name@example.com.';
  if (!values.password) errors.password = 'Please enter your password.';
  return errors;
}

/** flattens a 422 VALIDATION_ERROR envelope onto { field: friendlyMessage } */
export function mapValidationDetails(error) {
  const details = error?.details || error?.error?.details;
  if (!Array.isArray(details) || details.length === 0) return {};
  const mapped = {};
  for (const detail of details) {
    if (!detail?.field) continue;
    const raw = typeof detail.issue === 'string' ? detail.issue : detail.issue?.message;
    if (raw) mapped[detail.field] = raw;
  }
  return mapped;
}

/** server 422 whose fields were all mapped back into the form -> skip the global note */
export function hasUnmappedFields(mapped, formFields) {
  return Object.keys(mapped).some((field) => !formFields.includes(field));
}
