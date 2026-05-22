/**
 * frontend/src/App.jsx
 * Root React component. Configures React Router with all pages.
 * Protected routes redirect to /login if user is not authenticated.
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store/appStore';

// Pages
import LandingPage       from './pages/LandingPage';
import LoginPage         from './pages/LoginPage';
import RegisterPage      from './pages/RegisterPage';
import OnboardingPage    from './pages/OnboardingPage';
import ListingsPage      from './pages/ListingsPage';
import ListingDetailPage from './pages/ListingDetailPage';
import MatchesPage       from './pages/MatchesPage';
import MessagesPage      from './pages/MessagesPage';
import AppointmentsPage  from './pages/AppointmentsPage';
import Dashboard         from './pages/Dashboard';

// Components
import Navbar from './components/Navbar';

function ProtectedRoute({ children }) {
  const { user } = useAppStore();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function OnboardingGuard({ children }) {
  const { user } = useAppStore();
  if (!user) return <Navigate to="/login" replace />;
  if (user.onboardingCompleted) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <Routes>
          {/* Public routes */}
          <Route path="/"          element={<LandingPage />} />
          <Route path="/login"     element={<LoginPage />} />
          <Route path="/register"  element={<RegisterPage />} />
          <Route path="/listings"  element={<ListingsPage />} />
          <Route path="/listings/:id" element={<ListingDetailPage />} />

          {/* Onboarding — requires auth but NOT completed onboarding */}
          <Route path="/onboarding" element={
            <OnboardingGuard>
              <OnboardingPage />
            </OnboardingGuard>
          } />

          {/* Protected routes — require auth + completed onboarding */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/matches" element={
            <ProtectedRoute>
              <MatchesPage />
            </ProtectedRoute>
          } />
          <Route path="/messages" element={
            <ProtectedRoute>
              <MessagesPage />
            </ProtectedRoute>
          } />
          <Route path="/messages/:matchId" element={
            <ProtectedRoute>
              <MessagesPage />
            </ProtectedRoute>
          } />
          <Route path="/appointments" element={
            <ProtectedRoute>
              <AppointmentsPage />
            </ProtectedRoute>
          } />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}
