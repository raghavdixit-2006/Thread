// components/common/RequireAuth.jsx - route guard; bounces to /auth carrying the deep link.
import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useSessionSync.js';
import Spinner from './Spinner.jsx';

export default function RequireAuth({ children }) {
  const { isAuthed, hydrated } = useAuth();
  const location = useLocation();

  if (!hydrated) return <Spinner label="Checking your session" />;
  if (!isAuthed) {
    return <Navigate to={`/auth?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  return children;
}


