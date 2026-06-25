import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import trivenLogo from '../assets/Triven_logo.png';

const FEATURES = [
  { icon: <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1.41-3.53C8.73 18.16 10.86 18 13 18c3 0 5.5-2.5 5.5-5.5a5.5 5.5 0 0 0-1.5-3.8"/><path d="M14.5 2c-3.2 0-5.8 2.2-6.4 5.2"/></svg>, title: 'Leads', sub: 'Track & convert' },
  { icon: <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>, title: 'Pipeline', sub: 'Manage deals' },
  { icon: <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>, title: 'Shipments', sub: 'Ready to ship' },
];

export default function Login() {
  const [form, setForm] = useState({ role: 'admin', email: '', phone: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await login(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">

      {/* ── Left / Top Panel ── */}
      <div className="relative flex flex-col justify-between overflow-hidden
          md:w-[55%] md:min-h-screen
          w-full px-6 py-8 md:p-10"
        style={{ background: 'linear-gradient(145deg, #14532d 0%, #166534 40%, #15803d 100%)' }}>

        {/* decorative circles */}
        <div className="absolute top-[-80px] left-[-80px] w-[300px] h-[300px] rounded-full opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #4ade80, transparent)' }} />
        <div className="absolute bottom-[-60px] right-[-60px] w-[380px] h-[380px] rounded-full opacity-15 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #86efac, transparent)' }} />
        <div className="absolute top-[40%] right-[10%] w-[200px] h-[200px] rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #bbf7d0, transparent)' }} />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
            <img src={trivenLogo} alt="Triven" className="w-6 h-6 object-contain" />
          </div>
          <span className="text-white font-bold text-base tracking-tight">Triven Ayurveda CRM</span>
        </div>

        {/* Headline — hidden on mobile to keep panel compact */}
        <div className="relative hidden md:block">
          <h1 className="text-white font-extrabold text-4xl leading-tight mb-4">
            Manage your<br />business smarter
          </h1>
          <p className="text-green-200/80 text-base max-w-xs leading-relaxed">
            Track leads, manage pipeline, handle shipments and tasks — all from one powerful dashboard.
          </p>
        </div>

        {/* Feature cards */}
        <div className="relative grid grid-cols-3 gap-2 md:gap-3 mt-6 md:mt-0">
          {FEATURES.map(({ icon, title, sub }) => (
            <div key={title} className="rounded-2xl p-3 md:p-4 backdrop-blur-sm"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <div className="text-white mb-1 md:mb-2">{icon}</div>
              <div className="text-white font-semibold text-xs md:text-sm">{title}</div>
              <div className="text-green-200/70 text-[10px] md:text-xs mt-0.5">{sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right / Bottom Panel ── */}
      <div className="flex-1 flex items-center justify-center bg-white px-6 py-10 md:px-12">
        <div className="w-full max-w-sm">

          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-1">Welcome back</h2>
          <p className="text-gray-400 text-sm mb-7">Sign in with your CRM credentials</p>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-3 rounded-xl mb-5 flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Login As</label>
              <select required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50 transition"
                value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="sales">Staff</option>
                <option value="doctor">Doctor</option>
                <option value="logistics">Logistics</option>
                <option value="support">Support</option>
              </select>
            </div>

            {form.role === 'admin' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input type="email" required placeholder="you@example.com"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50 transition"
                  value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                <input type="tel" required placeholder="Enter your phone number"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50 transition"
                  value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} required placeholder="••••••••"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50 transition"
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 font-medium">
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
              style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
