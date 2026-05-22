import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

const statusColors = {
  scheduled: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
};

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/appointments').then(res => {
      setAppointments(res.data.appointments || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'TBD';
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
          <Link to="/dashboard" className="text-teal-600 hover:text-teal-700 font-medium text-sm">← Dashboard</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading appointments...</div>
        ) : appointments.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-5xl mb-4">📅</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No appointments yet</h3>
            <p className="text-gray-500 mb-6">Haven can help you schedule a viewing with your matches.</p>
            <Link to="/onboarding" className="btn-primary inline-block">Talk to Haven</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {appointments.map(appt => (
              <div key={appt.id} className="card p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center text-teal-700 font-bold">
                      {appt.other_first_name?.[0]}{appt.other_last_name?.[0]}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {appt.other_first_name} {appt.other_last_name}
                      </div>
                      {appt.listing_title && (
                        <div className="text-sm text-gray-500">{appt.listing_title}</div>
                      )}
                      {appt.listing_address && (
                        <div className="text-sm text-gray-400">{appt.listing_address}, {appt.city}, {appt.state}</div>
                      )}
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[appt.status] || 'bg-gray-100 text-gray-600'}`}>
                    {appt.status}
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-6 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <span>📅</span>
                    <span>{formatDate(appt.scheduled_at)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>⏱</span>
                    <span>{appt.duration_minutes || 60} minutes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{appt.meeting_type === 'video' ? '💻' : '🏠'}</span>
                    <span className="capitalize">{appt.meeting_type || 'video'}</span>
                  </div>
                </div>
                {appt.notes && (
                  <div className="mt-3 text-sm text-gray-500 bg-gray-50 rounded-lg p-3">{appt.notes}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
