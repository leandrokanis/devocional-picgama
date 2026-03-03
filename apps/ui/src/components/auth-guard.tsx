import { Navigate, useLocation } from 'react-router-dom';
import { useApi } from '../services/api-provider';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useApi();
  const location = useLocation();

  if (isAuthenticated) return <>{children}</>;
  return <Navigate to="/login" replace state={{ from: location }} />;
}
