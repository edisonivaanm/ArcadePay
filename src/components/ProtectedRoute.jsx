import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_ROUTES = {
  root: '/root',
  admin: '/admin',
  general: '/dashboard',
};

export default function ProtectedRoute({ children, allowedRole }) {
  const { currentUser, userProfile } = useAuth();

  if (!currentUser) return <Navigate to="/login" replace />;
  if (!userProfile) return null;

  const userRole = userProfile.rol;

  // If user has wrong role, redirect to their correct dashboard
  if (userRole !== allowedRole) {
    return <Navigate to={ROLE_ROUTES[userRole] || '/login'} replace />;
  }

  return children;
}
