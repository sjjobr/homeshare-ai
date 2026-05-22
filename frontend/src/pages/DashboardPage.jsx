import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useAppStore from '../store/appStore';
import api from '../api/client';

export default function DashboardPage() {
  const { user } = useAppStore();
  const [stats, setStats] = useState({ matches: 0, messages: 0, appointments: 0 });
  const [recentMatches, setRecentMatches] = useState([]);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [matchesRes, apptRes] = await Promise.all([
          api.get('/matches'),
          api.get('/appointments'),
        ]);
        setStats({
          matches: matchesRes.data.matches?.length || 0,
          appointments: apptRes.data.appointments?.length || 0,
          messages: 0,
        });
        setRecentMatches((matchesRes.data.matches || []).slice(0, 3));
      } catch (err) {
        console.error('Dashboard load error:', err);
      }
    };
    loadDashboard();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold">H</span>
            </div>
            <span className="font-bold text-xl text-gray-900">HomeShare</span>
          </div>
          <nav className="flex gap-6">
            <Link to="/listings" className="text-gray-600 hover:text-teal-600 font-medium">Listings</Link>
            <Link to="/matches" className="text-gray-600 hover:text-teal-600 font-medium">Matches</Link>
            <Link to="/messages" className="text-gray-600 hover:text-teal-600 font-medium">Messages</Link>
            <Link to="/appointments" className="text-gray-600 hover:text-teal-600 font-medium">Appointments</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user?.firstName}! 👋
          </h1>
          <p className="text-gray-500 mt-1">
            {user?.role === 'host' ? "Here's what's happening with your listings." : "Here are your latest home matches."}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Matches', value: stats.matches, icon: '🤝', link: '/matches', color: 'teal' },
            { label: 'Messages', value: stats.messages, icon: '💬', link: '/messages', color: 'blue' },
            { label: 'Appointments', value: stats.appointments, icon: '📅', link: '/appointments', color: 'purple' },
          ].map(({ label, value, icon, link }) => (
            <Link key={label} to={link} className="card p-6 hover:shadow-md transition-shadow">
              <div className="text-3xl mb-2">{icon}</div>
              <div className="text-2xl font-bold text-gray-900">{value}</div>
              <div className="text-gray-500 text-sm">{label}</div>
            </Link>
          ))}
        </div>

        {/* Haven CTA */}
        <div className="card p-6 bg-gradient-to-r from-teal-600 to-teal-700 text-white mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">Talk to Haven, your AI assistant</h3>
              <p className="text-teal-100 mt-1">Haven can help you update your profile, find matches, or schedule a viewing.</p>
            </div>
            <Link to="/onboarding" className="bg-white text-teal-700 font-semibold px-6 py-3 rounded-xl hover:bg-teal-50 transition-colors whitespace-nowrap">
              Start conversation
            </Link>
          </div>
        </div>

        {/* Recent matches */}
        {recentMatches.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Recent Matches</h2>
              <Link to="/matches" className="text-teal-600 hover:text-teal-700 text-sm font-medium">View all →</Link>
            </div>
            <div className="space-y-3">
              {recentMatches.map((match) => (
                <div key={match.id} className="card p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
                  <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 font-bold">
                    {match.first_name?.[0]}{match.last_name?.[0]}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{match.first_name} {match.last_name}</div>
                    {match.listing_title && <div className="text-sm text-gray-500">{match.listing_title} · {match.city}, {match.state}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-teal-600 font-semibold">{match.compatibility_score}%</div>
                    <div className="text-xs text-gray-400">match</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
