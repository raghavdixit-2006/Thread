// components/common/RequireCustomer.jsx - storefront guard: staff accounts never browse
// the retail site. A signed-in admin landing anywhere in the shop is bounced to /admin;
// guests and customers pass through untouched (guest shopping still works everywhere).
// RBAC stays server-side (adminRequired on /api/admin); this is UX separation only.
import { Navigate } from 'react-router-dom';
import useAuth from '../../hooks/useSessionSync.js';
import Spinner from './Spinner.jsx';

export default function RequireCustomer({ children }) {
  const { user, isAuthed, hydrated } = useAuth();
  if (!hydrated) return <Spinner label="Checking your session" />;
  if (isAuthed && user?.role === 'admin') return <Navigate to="/admin" replace />;
  return children;
}


