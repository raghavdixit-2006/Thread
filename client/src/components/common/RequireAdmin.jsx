// components/common/RequireAdmin.jsx - staff-area guard: session + admin role.
// Guests land on the staff portal; authed non-admins go back to the storefront.
// RBAC stays server-side (adminRequired on every /api/admin route) - UX only.
import { Navigate } from 'react-router-dom';
import useAuth from '../../hooks/useSessionSync.js';
import Spinner from './Spinner.jsx';

export default function RequireAdmin({ children }) {
  const { user, isAuthed, hydrated } = useAuth();
  if (!hydrated) return <Spinner label="Checking your session" />;
  if (!isAuthed) return <Navigate to="/admin/login" replace />;
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

