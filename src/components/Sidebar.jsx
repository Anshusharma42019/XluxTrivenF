import { NavLink } from 'react-router-dom';
import trivenLogo from '../assets/Triven_logo.png';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useEffect, useState } from 'react';

const SIDEBAR_THEMES = {
  light: { bg: 'linear-gradient(180deg, #071407 0%, #0d1f0d 40%, #0a1a0a 100%)', accent: '#4ade80' },
  dark: { bg: 'linear-gradient(180deg, #071407 0%, #0d1f0d 40%, #0a1a0a 100%)', accent: '#4ade80' },
  ocean: { bg: 'linear-gradient(180deg, #040e1e 0%, #071628 40%, #050f1e 100%)', accent: '#38bdf8' },
  rose: { bg: 'linear-gradient(180deg, #12060a 0%, #1a0a0f 40%, #120608 100%)', accent: '#fb7185' },
  violet: { bg: 'linear-gradient(180deg, #090712 0%, #0d0a1a 40%, #09070f 100%)', accent: '#a78bfa' },
  amber: { bg: 'linear-gradient(180deg, #120c00 0%, #1a1200 40%, #100a00 100%)', accent: '#fbbf24' },
  slate: { bg: 'linear-gradient(180deg, #080e1c 0%, #0f172a 40%, #080e1c 100%)', accent: '#94a3b8' },
  teal: { bg: 'linear-gradient(180deg, #011210 0%, #021a18 40%, #011210 100%)', accent: '#2dd4bf' },
  crimson: { bg: 'linear-gradient(180deg, #100303 0%, #1a0505 40%, #100303 100%)', accent: '#f87171' },
  indigo: { bg: 'linear-gradient(180deg, #040412 0%, #06061a 40%, #040412 100%)', accent: '#818cf8' },
  mint: { bg: 'linear-gradient(180deg, #022c1a 0%, #064e2e 40%, #022c1a 100%)', accent: '#34d399' },
  midnight: { bg: 'linear-gradient(180deg, #010310 0%, #020617 40%, #010310 100%)', accent: '#6366f1' },
  sunset: { bg: 'linear-gradient(180deg, #120600 0%, #1a0a00 40%, #120600 100%)', accent: '#f97316' },
  aurora: { bg: 'linear-gradient(180deg, #020a0f 0%, #030d12 40%, #020a0f 100%)', accent: '#06b6d4' },
  sakura: { bg: 'linear-gradient(180deg, #12040e 0%, #1a0812 40%, #12040e 100%)', accent: '#f472b6' },
  gold: { bg: 'linear-gradient(180deg, #0e0a00 0%, #120e00 40%, #0e0a00 100%)', accent: '#eab308' },
  nordic: { bg: 'linear-gradient(180deg, #090d12 0%, #0d1117 40%, #090d12 100%)', accent: '#58a6ff' },
  lava: { bg: 'linear-gradient(180deg, #0f0300 0%, #150500 40%, #0f0300 100%)', accent: '#ef4444' },
  lime: { bg: 'linear-gradient(180deg, #070e00 0%, #0a1200 40%, #070e00 100%)', accent: '#84cc16' },
  dusk: { bg: 'linear-gradient(180deg, #0e0610 0%, #12080f 40%, #0e0610 100%)', accent: '#c084fc' },
};

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      {
        to: '/dashboard', label: 'Dashboard', roles: ['admin', 'manager', 'sales', 'support', 'logistics'],
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
      },
      {
        to: '/doctor-dashboard', label: 'Dashboard', roles: ['doctor'],
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
      },
      {
        to: '/leads', label: 'Leads', roles: ['admin', 'manager', 'sales', 'support'],
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
      },
      {
        to: '/pipeline', label: 'Action Required', roles: ['admin', 'manager', 'sales', 'support'],
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
      },
    ]
  },
  {
    label: 'Sales',
    items: [
      {
        to: '/cnp', label: 'CNP', roles: ['admin', 'manager', 'sales', 'support'],
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.18 6.18l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
      },
      {
        to: '/whatsapp', label: 'WhatsApp', roles: ['admin', 'manager', 'sales', 'support'],
        icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.558 4.12 1.532 5.845L.057 23.941l6.26-1.643A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.034-1.383l-.36-.214-3.732.979.998-3.642-.235-.374A9.818 9.818 0 1 1 12 21.818z" /></svg>
      },
      {
        to: '/tasks', label: 'Tasks', roles: ['admin', 'manager', 'sales', 'support'],
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
      },
      {
        to: '/follow-up', label: 'Follow Up', roles: ['admin', 'manager', 'sales', 'support'],
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
      },
      {
        to: '/verification', label: 'Verification', roles: ['admin', 'manager', 'sales', 'support'],
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
      },
    ]
  },
  {
    label: 'Logistics',
    items: [
      {
        to: '/ops-dashboard', label: 'Ops Dashboard', roles: ['admin', 'manager', 'sales', 'support', 'logistics', 'staff'],
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
      },
      {
        to: '/ready-to-shipment', label: 'Ready to Ship', roles: ['admin', 'manager', 'sales', 'logistics'],
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="1" /><path d="M16 8h4l3 5v3h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
      },
      {
        to: '/shiprocket', label: 'Shiprocket', roles: ['admin', 'manager', 'sales', 'logistics'], end: true,
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
      },
      {
        to: '/shiprocket/ndr', label: 'NDR', roles: ['admin', 'manager', 'sales', 'logistics'],
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg>
      },
      {
        to: '/shipmaxx', label: 'ShipMaxx', roles: ['admin', 'manager', 'sales', 'logistics'], end: true,
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="1" /><path d="M16 8h4l3 5v3h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
      },
      {
        to: '/shipmaxx/ndr', label: 'ShipMaxx NDR', roles: ['admin', 'manager', 'sales', 'logistics', 'support'], end: true,
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg>
      },
      {
        to: '/shipmaxx/followup', label: 'ShipMaxx Follow Up', roles: ['admin', 'manager', 'sales', 'logistics', 'support'], end: true,
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
      },
    ]
  },
  {
    label: 'Team',
    items: [
      {
        to: '/appointments', label: 'Appointments', roles: ['admin', 'manager', 'sales', 'doctor', 'support'],
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
      },
      {
        to: '/attendance', label: 'Attendance', roles: ['admin', 'manager', 'sales', 'support', 'logistics'],
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
      },
      {
        to: '/reorder-commission', label: 'Re-Order Commission', roles: ['admin'],
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
      },
      {
        to: '/users', label: 'Staff', roles: ['admin', 'manager'],
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
      },

    ]
  },
];

export default function Sidebar({ open, onClose, unreadCount = 0 }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(localStorage.getItem('theme') || 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const { bg, accent } = SIDEBAR_THEMES[theme] || SIDEBAR_THEMES.light;

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden" onClick={onClose} />}
      <aside className={`fixed top-0 left-0 h-full w-64 z-30 flex flex-col transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
        style={{ background: bg, transition: 'background 0.4s ease' }}>

        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden" style={{ boxShadow: `0 4px 16px ${accent}40`, outline: `2px solid ${accent}30` }}>
              <img src={trivenLogo} alt="Triven" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="text-white font-bold text-base tracking-tight">Triven</div>
              <div className="text-green-400/50 text-[11px] font-medium">Ayurveda CRM</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
          {NAV_GROUPS.map(group => {
            const visibleItems = group.items.filter(item => item.roles.includes(user?.role));
            if (!visibleItems.length) return null;
            return (
              <div key={group.label}>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] px-3 mb-1.5" style={{ color: `${accent}99` }}>{t(group.label)}</p>
                <div className="space-y-0.5">
                  {visibleItems.map(({ to, icon, label, end }) => (
                    <NavLink key={to} to={to} end={!!end} onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-3.5 px-4 py-3.5 md:py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative
                        ${isActive
                          ? 'active-nav text-white'
                          : 'text-white/80 hover:text-white hover:bg-white/10'}`}
                      style={({ isActive }) => isActive ? { background: `${accent}25` } : {}}>
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full opacity-0 group-[.active-nav]:opacity-100 transition-opacity" style={{ background: accent }} />
                      <span className="transition-all duration-150 text-white/60 group-hover:text-white group-[.active-nav]:text-white">{icon}</span>
                      <span className="flex-1 truncate">{t(label)}</span>
                      {label === 'Notifications' && unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center font-bold">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accent }} />
            <span className="text-[10px] font-medium" style={{ color: `${accent}cc` }}>{t('System Online')}</span>
          </div>
        </div>
      </aside>
    </>
  );
}
