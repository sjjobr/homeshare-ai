import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function ListingsPage() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ city: '', minRent: '', maxRent: '' });

  const loadListings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.city) params.set('city', filters.city);
      if (filters.minRent) params.set('minRent', filters.minRent);
      if (filters.maxRent) params.set('maxRent', filters.maxRent);
      const res = await api.get(`/listings?${params}`);
      setListings(res.data.listings || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { loadListings(); }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Available Rooms</h1>
          <Link to="/dashboard" className="text-teal-600 hover:text-teal-700 font-medium text-sm">← Dashboard</Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Filters */}
        <div className="card p-4 mb-6">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">City</label>
              <input type="text" className="input-field py-2" placeholder="Boston, MA..."
                value={filters.city} onChange={e => setFilters({...filters, city: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Min rent/mo</label>
              <input type="number" className="input-field py-2 w-32" placeholder="$500"
                value={filters.minRent} onChange={e => setFilters({...filters, minRent: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Max rent/mo</label>
              <input type="number" className="input-field py-2 w-32" placeholder="$2000"
                value={filters.maxRent} onChange={e => setFilters({...filters, maxRent: e.target.value})} />
            </div>
            <button onClick={loadListings} className="btn-primary py-2 px-6">Search</button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading listings...</div>
        ) : listings.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-5xl mb-4">🏡</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No listings found</h3>
            <p className="text-gray-500">Try adjusting your search filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {listings.map(listing => (
              <div key={listing.id} className="card overflow-hidden hover:shadow-md transition-shadow">
                {/* Photo placeholder */}
                <div className="h-40 bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center">
                  <span className="text-4xl">🏠</span>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight">{listing.title}</h3>
                    <div className="text-teal-600 font-bold text-sm ml-2 flex-shrink-0">
                      ${((listing.monthly_rent_cents || 0) / 100).toLocaleString()}/mo
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{listing.city}, {listing.state}</p>
                  <div className="flex gap-2 flex-wrap">
                    {listing.is_furnished && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Furnished</span>}
                    {listing.utilities_included && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Utilities incl.</span>}
                    {listing.helper_exchange_available && <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">Helper exchange</span>}
                    {listing.pets_allowed && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Pet friendly</span>}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="w-6 h-6 bg-teal-100 rounded-full flex items-center justify-center text-teal-700 text-xs font-bold">
                      {listing.first_name?.[0]}
                    </div>
                    <span className="text-xs text-gray-500">{listing.first_name} {listing.last_name}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
