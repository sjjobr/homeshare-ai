import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useAppStore from '../store/appStore';
import api from '../api/client';

export default function MatchesPage() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAppStore();

  useEffect(() => {
    api.get('/matches').then(res => {
      setMatches(res.data.matches || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const generateMatches = async () => {
    setLoading(true);
    try {
      const res = await api.post('/matches/generate');
      setMatches(res.data.matches || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Your Matches</h1>
          <div className="flex gap-3">
            <button onClick={generateMatches} className="btn-primary py-2 px-4 text-sm">
              Find New Matches
            </button>
            <Link to="/dashboard" className="btn-secondary py-2 px-4 text-sm">← Dashboard</Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Finding your matches...</div>
        ) : matches.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-5xl mb-4">🤝</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No matches yet</h3>
            <p className="text-gray-500 mb-6">Complete your onboarding with Haven to get personalized matches.</p>
            <div className="flex gap-3 justify-center">
              <Link to="/onboarding" className="btn-primary">Talk to Haven</Link>
              <button onClick={generateMatches} className="btn-secondary">Generate Matches</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map((match) => (
              <div key={match.id} className="card p-6 flex items-center gap-4 hover:shadow-md transition-shadow">
                <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center text-teal-700 font-bold text-lg flex-shrink-0">
                  {match.first_name?.[0]}{match.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 text-lg">{match.first_name} {match.last_name}</div>
                  {match.listing_title && (
                    <div className="text-gray-500 text-sm truncate">{match.listing_title} · {match.city}, {match.state}</div>
                  )}
                  {match.monthly_rent_cents && (
                    <div className="text-teal-600 text-sm font-medium mt-1">
                      ${(match.monthly_rent_cents / 100).toLocaleString()}/month
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-2xl font-bold text-teal-600">{match.compatibility_score}%</div>
                  <div className="text-xs text-gray-400 mb-2">compatibility</div>
                  <Link to={`/messages/${match.match_id || match.id}`}
                    className="text-teal-600 hover:text-teal-700 text-sm font-medium border border-teal-200 px-3 py-1 rounded-lg">
                    Message
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
