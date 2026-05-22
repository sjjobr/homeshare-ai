import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAppStore from '../store/appStore';
import api from '../api/client';

export default function RegisterPage() {
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '',
    role: '', city: '', state: '', zipCode: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAppStore();
  const navigate = useNavigate();

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.role) { setError('Please select if you are a Host or Guest'); return; }
    setLoading(true);

    try {
      const res = await api.post('/auth/register', form);
      login(res.data.user, res.data.token);
      navigate('/onboarding');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-600 rounded-2xl mb-4">
            <span className="text-white text-2xl font-bold">H</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Join HomeShare</h1>
          <p className="text-gray-500 mt-2">Create your account to get started</p>
        </div>

        <div className="card p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">
              {error}
            </div>
          )}

          {/* Role selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">I want to...</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'host', label: 'Share my home', icon: '🏡', desc: 'I have a room to rent' },
                { value: 'guest', label: 'Find a home', icon: '🔍', desc: 'I am looking for a room' },
              ].map(({ value, label, icon, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm({ ...form, role: value })}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    form.role === value
                      ? 'border-teal-600 bg-teal-50'
                      : 'border-gray-200 hover:border-teal-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{icon}</div>
                  <div className="font-medium text-gray-900">{label}</div>
                  <div className="text-xs text-gray-500">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                <input type="text" className="input-field" placeholder="Jane" value={form.firstName} onChange={update('firstName')} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                <input type="text" className="input-field" placeholder="Smith" value={form.lastName} onChange={update('lastName')} required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
              <input type="email" className="input-field" placeholder="jane@example.com" value={form.email} onChange={update('email')} required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" className="input-field" placeholder="At least 8 characters" value={form.password} onChange={update('password')} required minLength={8} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input type="text" className="input-field" placeholder="Boston" value={form.city} onChange={update('city')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input type="text" className="input-field" placeholder="MA" maxLength={2} value={form.state} onChange={update('state')} />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-teal-600 hover:text-teal-700 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
