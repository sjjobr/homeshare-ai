import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAppStore from './store/appStore';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OnboardingPage from './pages/OnboardingPage';
import DashboardPage from './pages/DashboardPage';
import ListingsPage from './pages/ListingsPage';
import MatchesPage from './pages/MatchesPage';
import MessagesPage from './pages/MessagesPage';
import AppointmentsPage from './pages/AppointmentsPage';

// Auth guard
function PrivateRoute({ children }) {
  const { isAuthenticated } = useAppStore();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// Public route guard (redirect authenticated users)
function PublicRoute({ children }) {
  const { isAuthenticated, user } = useAppStore();
  if (!isAuthenticated) return children;
  if (!user?.onboardingComplete) return <Navigate to="/onboarding" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

          {/* Auth required routes */}
          <Route path="/onboarding" element={<PrivateRoute><OnboardingPage /></PrivateRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
          <Route path="/listings" element={<PrivateRoute><ListingsPage /></PrivateRoute>} />
          <Route path="/matches" element={<PrivateRoute><MatchesPage /></PrivateRoute>} />
          <Route path="/messages" element={<PrivateRoute><MessagesPage /></PrivateRoute>} />
          <Route path="/messages/:matchId" element={<PrivateRoute><MessagesPage /></PrivateRoute>} />
          <Route path="/appointments" element={<PrivateRoute><AppointmentsPage /></PrivateRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
