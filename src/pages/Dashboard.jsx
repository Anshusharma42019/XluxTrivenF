import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  fetchStats,
  fetchStaffTodayLists,
  fetchStaffStats,
  fetchStaffMonthlyChart,
  fetchStaffCommission,
  fetchAllStaffCommissions,
  fetchAllStaffStats,
  fetchEmployeePerformanceMatrix,
  fetchStaffDetailKPIs,
  fetchTaskDrilldown,
  clearDashboardCache
} from '../services/dashboard.service';
import * as attendanceSvc from '../services/attendance.service';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { getLeads, exportLeads } from '../services/lead.service';
import ShipmentAnalyticsPanel from '../components/ShipmentAnalyticsPanel';
import { fetchStaffBreakdown, clearOpsDashboardCache } from '../services/opsDashboard.service';

/* ─── CONFIG & Constants ─────────────────────────────────────────────────── */
const CONFIG = {
  API_URL: '/api/v1',
  STATUS_MAP: {
    pending: ['pending', 'new', 'old', 'scheduled', 'task'],
    cnp: ['cnp'],
    call_again: ['call_again', 'follow_up', 'overdue'],
    verified: ['verified', 'completed', 'verification', 'ready_to_shipment', 'dispatch', 'dispatched'],
    not_interested: ['not_interested', 'cancel_call', 'closed_lost', 'cancelled']
  }
};
const DATE_FILTERS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 Days' },
  { id: 'month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'all', label: 'All Time' },
  { id: 'custom', label: 'Custom' },
];

const DEPARTMENTS = ['migraine', 'piles'];

const formatDateInput = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getDateParams = (preset, customFrom, customTo) => {
  if (preset === 'all') return { filterType: 'all', from: 'all', to: 'all' };
  const today = new Date();
  const to = formatDateInput(today);
  if (preset === 'today') return { filterType: 'range', from: to, to };
  if (preset === 'yesterday') {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    const day = formatDateInput(d);
    return { filterType: 'range', from: day, to: day };
  }
  if (preset === 'last7') {
    const d = new Date(today);
    d.setDate(d.getDate() - 6);
    return { filterType: 'range', from: formatDateInput(d), to };
  }
  if (preset === 'month') {
    const d = new Date(today.getFullYear(), today.getMonth(), 1);
    return { filterType: 'range', from: formatDateInput(d), to };
  }
  if (preset === 'last_month') {
    const dStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const dEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    return { filterType: 'range', from: formatDateInput(dStart), to: formatDateInput(dEnd) };
  }
  if (preset === 'custom' && customFrom && customTo) {
    return { filterType: 'range', from: customFrom, to: customTo };
  }
  return {};
};

/* ─── Comprehensive SVG Icon Library ─────────────────────────────────────── */
const icons = {
  cnp: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M16.5 1.5a4.5 4.5 0 0 1 4.5 4.5v12a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 18V6a4.5 4.5 0 0 1 4.5-4.5h9z" /><line x1="4" y1="4" x2="20" y2="20" /></svg>,
  callAgain: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.61 19a19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 3.09 4.18 2 2 0 0 1 5.07 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L9.91 9.91a16 16 0 0 0 6.18 6.18l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>,
  interested: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" /></svg>,
  notInterested: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-2" /></svg>,
  user: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  users: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  phone: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.61 19a19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 3.09 4.18 2 2 0 0 1 5.07 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L9.91 9.91a16 16 0 0 0 6.18 6.18l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>,
  leadAdd: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>,
  verify: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
  onHold: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="10" y1="15" x2="10" y2="9" /><line x1="14" y1="15" x2="14" y2="9" /></svg>,
  info: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>,
  building: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M16 10h.01M8 10h.01M8 14h.01M12 14h.01M16 14h.01" /></svg>,
  dashboard: <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>,
  target: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>,
  box: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>,
  truck: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="2" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>,
  clipboard: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /><path d="M9 14h6M9 10h6M9 18h3" /></svg>,
  chart: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>,
  lightning: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
  activity: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
  barChart: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  globe: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>,
  megaphone: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>,
  tasks: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
  sparkles: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path d="M12 2L14.4 7.6L20 10L14.4 12.4L12 18L9.6 12.4L4 10L9.6 7.6L12 2Z" /></svg>,
  clock: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  logout: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>,
  checkCircle: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
  arrowRight: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>,
  download: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
  dollar: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  chevronDown: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" /></svg>,
  chevronUp: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15" /></svg>,
  star: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
  search: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  chat: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  share: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>,
  tag: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>,
  shield: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  inbox: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>,
  packageCheck: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M16 16l2 2 4-4" /><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
};

const stageNames = {
  new: { label: 'New Lead Acquisition', color: '#3b82f6', icon: icons.star },
  contacted: { label: 'Contacted / Called', color: '#8b5cf6', icon: icons.phone },
  interested: { label: 'Interested Prospect', color: '#10b981', icon: icons.interested },
  follow_up: { label: 'Follow Up Scheduled', color: '#f59e0b', icon: icons.clock },
  closed_won: { label: 'Closed Won / Verified', color: '#059669', icon: icons.checkCircle },
  closed_lost: { label: 'Closed Lost / Cancelled', color: '#ef4444', icon: icons.notInterested },
};

const getSourceStyle = (src) => {
  const s = String(src).toLowerCase();
  if (s.includes('facebook') || s.includes('meta') || s.includes('fb')) return { icon: icons.globe, color: '#1877F2', label: 'Meta / Facebook Ads' };
  if (s.includes('google') || s.includes('ga') || s.includes('search')) return { icon: icons.search, color: '#EA4335', label: 'Google Search / Ads' };
  if (s.includes('whatsapp') || s.includes('wa') || s.includes('interakt')) return { icon: icons.chat, color: '#25D366', label: 'WhatsApp / Interakt' };
  if (s.includes('website') || s.includes('web') || s.includes('direct')) return { icon: icons.globe, color: '#0EA5E9', label: 'Website / Portal' };
  if (s.includes('referral') || s.includes('word')) return { icon: icons.share, color: '#8B5CF6', label: 'Referral & Organic' };
  return { icon: icons.tag, color: '#64748b', label: src || 'Other / Unspecified' };
};


/* ─── Ops-Styled KPI Card ────────────────────────────────────────────────── */
function OpsKpiCard({ label, value, color = '#3b82f6', icon, subtext, unit = '', progress, progressLabel, onClick }) {
  return (
    <div
      onClick={onClick}
      className="group relative overflow-hidden transition-all duration-300 ease-out active:scale-[0.98] flex flex-col justify-between"
      style={{
        background: `linear-gradient(135deg, ${color}0A, ${color}14)`,
        border: `1px solid ${color}25`,
        borderRadius: 16,
        padding: '18px 20px',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: `0 4px 12px -2px ${color}15`,
        minHeight: 120,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = `0 8px 24px -4px ${color}40`;
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.borderColor = `${color}40`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = `0 4px 12px -2px ${color}15`;
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.borderColor = `${color}25`;
      }}
    >
      {/* Ambient glow in corner */}
      <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700 pointer-events-none" style={{ background: color, opacity: 0.12 }}></div>
      {/* Glass reflection */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative', zIndex: 10, width: '100%', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}>{label}</div>
          {subtext && (
            <div title={subtext} style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(4px)', color: '#64748b', padding: '2px', borderRadius: '50%', cursor: 'help' }}>
              {icons.info}
            </div>
          )}
        </div>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }} className="group-hover:scale-110 transition-transform">
          {icon ? <span style={{ color }}>{icon}</span> : <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }}></div>}
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 10, marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: color, lineHeight: 1, letterSpacing: '-0.02em', textShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            {value !== undefined && value !== null ? value : <span style={{ opacity: 0.4, fontSize: 20 }}>—</span>}
          </div>
          {unit && <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1, color }}>{unit}</span>}
        </div>

        {(progress !== undefined || progressLabel) && (
          <div style={{ marginTop: 12 }}>
            {progress !== undefined && (
              <div style={{ width: '100%', background: 'rgba(0,0,0,0.06)', borderRadius: 4, height: 5, overflow: 'hidden', marginBottom: 5 }}>
                <div style={{ width: `${Math.min(100, Math.max(0, progress))}%`, background: color, height: '100%', borderRadius: 4, transition: 'width 0.6s ease-out' }}></div>
              </div>
            )}
            {progressLabel && <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>{progressLabel}</div>}
          </div>
        )}
      </div>

      {/* Accent line at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 transition-opacity pointer-events-none group-hover:opacity-30" style={{ background: color, opacity: 0.18 }}></div>
    </div>
  );
}


/* ─── Section Card Wrapper with Optional SVG Icon ─────────────────────────── */
function SectionCard({ title, subtitle, icon, children, action }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '22px 24px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {icon && (
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', flexShrink: 0 }}>
              {icon}
            </div>
          )}
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.01em' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: 500 }}>{subtitle}</div>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}


/* ─── Ops-Styled Filter Bar ───────────────────────────────────────────────── */
function DashboardFilterBar({ datePreset, onSelectPreset, filterFrom, setFilterFrom, filterTo, setFilterTo, department, setDepartment, canManage, lastUpdated, onRefresh, autoRefresh, onToggleAutoRefresh, onDownloadCSV, csvLoading, t }) {
  return (
    <div className="no-print" style={{
      background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)',
      padding: '14px 18px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: 22,
    }}>
      {/* Date preset pills */}
      <div style={{ display: 'flex', gap: 4, background: '#f8fafc', borderRadius: 10, padding: 4, border: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
        {DATE_FILTERS.map(f => (
          <button key={f.id} onClick={() => onSelectPreset(f.id)}
            style={{
              padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: datePreset === f.id ? '#16a34a' : 'transparent',
              color: datePreset === f.id ? '#fff' : '#64748b',
              transition: 'all .15s',
              boxShadow: datePreset === f.id ? '0 1px 3px rgba(22,163,74,0.3)' : 'none',
            }}>
            {t(f.label)}
          </button>
        ))}
      </div>

      {/* Custom range input */}
      {datePreset === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, background: '#fff', fontWeight: 600, color: '#334155' }} />
          <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>to</span>
          <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, background: '#fff', fontWeight: 600, color: '#334155' }} />
        </div>
      )}

      {/* Department Filter (Admin/Manager Only) */}
      {canManage && (
        <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 10, padding: '0 10px' }}>
          <span style={{ color: '#64748b' }}>{icons.building}</span>
          <select
            value={department}
            onChange={e => setDepartment(e.target.value)}
            style={{ padding: '7px 8px', border: 'none', fontSize: 12, background: 'transparent', fontWeight: 700, color: '#0f172a', outline: 'none', cursor: 'pointer' }}
          >
            <option value="">All Depts</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d.toUpperCase()}</option>)}
          </select>
        </div>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {lastUpdated && (
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
            Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <button onClick={onRefresh} title="Refresh Dashboard" style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', transition: 'background 0.15s' }} className="hover:bg-slate-200">
          <svg width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
          <div onClick={onToggleAutoRefresh} style={{
            width: 34, height: 20, borderRadius: 10, background: autoRefresh ? '#16a34a' : '#cbd5e1',
            position: 'relative', transition: 'background .2s', cursor: 'pointer', flexShrink: 0,
          }}>
            <div style={{ position: 'absolute', top: 2, left: autoRefresh ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
          </div>
          Auto-refresh
        </label>
        <button
          onClick={() => onDownloadCSV(false)}
          disabled={!!csvLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 10,
            background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontSize: 12, fontWeight: 700,
            border: 'none', cursor: csvLoading ? 'wait' : 'pointer', boxShadow: '0 2px 6px rgba(16,185,129,0.25)',
            transition: 'all 0.15s', opacity: csvLoading ? 0.7 : 1,
          }}
          className="hover:shadow-lg active:scale-95"
        >
          {icons.download}
          {csvLoading === 'filtered' ? `Downloading... ` : `Leads CSV`}
        </button>
      </div>
    </div>
  );
}

/* ─── Employee Performance Upgraded Section Component ─────────────────────── */
function EmployeePerformanceSection({ allStaffData, staffBreakdownData, datePreset, filterFrom, filterTo, department, getPeriodLabel, icons }) {
  const [taskScopeMode, setTaskScopeMode] = useState('period'); // 'period' | 'all_open'
  const [matrixViewMode, setMatrixViewMode] = useState('daily'); // 'daily' | 'weekly' | 'monthly'
  const [matrixGroupMode, setMatrixGroupMode] = useState('assigned'); // 'assigned' | 'activity'
  const [matrixMonth, setMatrixMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [matrixData, setMatrixData] = useState({ columns: [], staffMatrix: [] });
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [cellPopover, setCellPopover] = useState(null); // cell popover split details

  const [drilldownModal, setDrilldownModal] = useState({ open: false, staffId: null, staffName: '', status: null, date: null });
  const [drilldownList, setDrilldownList] = useState([]);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  const [staffDrawer, setStaffDrawer] = useState({ open: false, staffId: null, staffName: '' });
  const [staffKPIs, setStaffKPIs] = useState(null);
  const [staffKPIsLoading, setStaffKPIsLoading] = useState(false);

  // Load Matrix Heatmap Data
  const loadMatrix = useCallback(async () => {
    setMatrixLoading(true);
    try {
      const [y, m] = matrixMonth.split('-');
      const res = await fetchEmployeePerformanceMatrix({
        viewMode: matrixViewMode,
        month: Number(m) - 1,
        year: Number(y),
        mode: matrixGroupMode,
        department,
        from: filterFrom,
        to: filterTo
      });
      setMatrixData(res || { columns: [], staffMatrix: [] });
    } catch (err) {
      console.error('Matrix fetch error:', err);
    } finally {
      setMatrixLoading(false);
    }
  }, [matrixViewMode, matrixGroupMode, matrixMonth, department, filterFrom, filterTo]);

  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  // Load Drilldown list when modal opens
  const openDrilldown = async (staffId, staffName, status = null, date = null) => {
    setDrilldownModal({ open: true, staffId, staffName, status, date });
    setDrilldownLoading(true);
    try {
      const list = await fetchTaskDrilldown({
        staffId,
        status,
        date,
        department,
        from: filterFrom,
        to: filterTo
      });
      setDrilldownList(list || []);
    } catch (e) {
      console.error('Drilldown error:', e);
      setDrilldownList([]);
    } finally {
      setDrilldownLoading(false);
    }
  };

  // Load Staff Drawer KPIs
  const openStaffDrawer = async (staffId, staffName) => {
    setStaffDrawer({ open: true, staffId, staffName });
    setStaffKPIsLoading(true);
    try {
      const res = await fetchStaffDetailKPIs({
        staffId,
        department,
        from: filterFrom,
        to: filterTo
      });
      setStaffKPIs(res);
    } catch (e) {
      console.error('Staff detail error:', e);
    } finally {
      setStaffKPIsLoading(false);
    }
  };

  // Section A Processed Rows (Sales Staff Only)
  const allPerformanceStaffList = useMemo(() => {
    let list = [];
    if (allStaffData && allStaffData.length > 0) {
      list = allStaffData
        .filter(item => item.user && item.user.role === 'sales')
        .map(item => {
          const isSales = item.user.role === 'sales';
          const bdMatch = (isSales ? staffBreakdownData.sales || [] : staffBreakdownData.support || []).find(b => String(b.id) === String(item.user._id));
          const cnp = item.todayCnp !== undefined ? item.todayCnp : (bdMatch?.cnp || 0);
          const callAgain = item.todayCallAgain !== undefined ? item.todayCallAgain : (bdMatch?.callAgain || 0);
          const verified = Math.max(item.todayVerifications || 0, item.verifiedCount || 0, bdMatch?.verified || 0);
          const notInterested = item.todayNotInterested !== undefined ? item.todayNotInterested : (bdMatch?.notInterested || 0);

          const leads = item.leadsAdded !== undefined ? item.leadsAdded : (bdMatch?.leads || 0);
          const rawTasks = item.tasksAssigned !== undefined ? item.tasksAssigned : (bdMatch?.tasks || 0);
          const allTimePending = item.pendingTasks !== undefined ? item.pendingTasks : (bdMatch?.pendingTasks !== undefined ? bdMatch.pendingTasks : 0);

          const periodPending = Math.max(0, rawTasks - (cnp + callAgain + verified + notInterested));
          const displayPending = taskScopeMode === 'all_open' ? (allTimePending || periodPending) : periodPending;

          // Total Tasks equals exact sum of CNP + Call Again + Verified + Not Interested
          const displayTasks = cnp + callAgain + verified + notInterested;

          const actionPercent = displayTasks > 0 ? Math.round(((displayTasks - displayPending) / displayTasks) * 100) : 0;
          const verifyPercent = displayTasks > 0 ? Math.round((verified / displayTasks) * 100) : 0;
          const isHighPending = displayTasks > 0 && (displayPending / displayTasks) > 0.3;

          return {
            id: String(item.user._id),
            name: item.user.name,
            role: item.user.role,
            leads,
            tasks: displayTasks,
            newTodayTasks: item.todayTasks || Math.min(rawTasks, leads),
            carryForwardTasks: Math.max(0, rawTasks - (item.todayTasks || Math.min(rawTasks, leads))),
            pending: displayPending,
            cnp,
            callAgain,
            verified,
            notInterested,
            afterCheckoutLeads: item.afterCheckoutLeads !== undefined ? item.afterCheckoutLeads : (bdMatch?.afterCheckoutLeads || 0),
            afterCheckoutTasks: item.afterCheckoutTasks !== undefined ? item.afterCheckoutTasks : (bdMatch?.afterCheckoutTasks || 0),
            actionPercent: Math.min(100, Math.max(0, actionPercent)),
            verifyPercent: Math.min(100, Math.max(0, verifyPercent)),
            isHighPending
          };
        });
    } else {
      const combined = [...(staffBreakdownData.sales || []), ...(staffBreakdownData.support || [])];
      list = combined.map(s => ({
        id: String(s.id),
        name: s.name,
        role: s.role,
        leads: s.leads || 0,
        tasks: s.tasks || 0,
        newTodayTasks: s.leads || 0,
        carryForwardTasks: Math.max(0, (s.tasks || 0) - (s.leads || 0)),
        pending: Math.max(0, (s.tasks || 0) - ((s.cnp || 0) + (s.callAgain || 0) + (s.verified || 0) + (s.notInterested || 0))),
        cnp: s.cnp || 0,
        callAgain: s.callAgain || 0,
        verified: Math.max(s.todayVerifications || 0, s.verified || 0),
        notInterested: s.notInterested || 0,
        afterCheckoutLeads: s.afterCheckoutLeads || 0,
        afterCheckoutTasks: s.afterCheckoutTasks || 0,
        actionPercent: 0,
        verifyPercent: 0,
        isHighPending: false
      }));
    }

    return list.sort((a, b) => b.tasks - a.tasks);
  }, [allStaffData, staffBreakdownData, taskScopeMode]);

  // Section A Totals
  const totalsA = useMemo(() => {
    return allPerformanceStaffList.reduce((acc, curr) => ({
      leads: acc.leads + curr.leads,
      tasks: acc.tasks + curr.tasks,
      pending: acc.pending + curr.pending,
      cnp: acc.cnp + curr.cnp,
      callAgain: acc.callAgain + curr.callAgain,
      verified: acc.verified + curr.verified,
      notInterested: acc.notInterested + curr.notInterested,
      afterLeads: acc.afterLeads + curr.afterCheckoutLeads,
      afterTasks: acc.afterTasks + curr.afterCheckoutTasks,
    }), { leads: 0, tasks: 0, pending: 0, cnp: 0, callAgain: 0, verified: 0, notInterested: 0, afterLeads: 0, afterTasks: 0 });
  }, [allPerformanceStaffList]);

  // High Pending Staff Alerts
  const highPendingStaff = useMemo(() => {
    return allPerformanceStaffList.filter(s => s.isHighPending || s.pending >= 50);
  }, [allPerformanceStaffList]);

  // Tab CSV Export
  const exportPerformanceCSV = () => {
    const headers = ['#', 'Staff Name', 'Role', 'Total Tasks Assigned', 'Pending (No Action)', 'CNP', 'Call Again', 'Verified', 'Not Interested'];
    const rows = allPerformanceStaffList.map((s, i) => [
      i + 1, s.name, s.role, s.tasks, s.pending, s.cnp, s.callAgain, s.verified, s.notInterested
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Employee_Performance_${datePreset}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title={`Employee Performance Breakdown (${getPeriodLabel()})`}
        subtitle="Live CRM activity breakdown, tasks accounting & status heatmap matrix"
        icon={icons.users}
        action={
          <button
            onClick={exportPerformanceCSV}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            {icons.download} Export Performance CSV
          </button>
        }
      >
        <div className="flex flex-col gap-8">

          {/* 🚨 HIGH PENDING ALERT LINE */}
          {highPendingStaff.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex items-center justify-between flex-wrap gap-2 text-xs text-amber-900 font-bold shadow-sm animate-pulse">
              <div className="flex items-center gap-2">
                <span className="text-base">⚠️</span>
                <span>
                  <strong className="font-black">Attention Required:</strong> High Pending Tasks detected for:{' '}
                  {highPendingStaff.map(s => `${s.name} (${s.pending} Pending)`).join(', ')}
                </span>
              </div>
              <span className="bg-amber-200 text-amber-950 px-2.5 py-0.5 rounded-full font-black text-[11px]">
                {highPendingStaff.length} Staff Affected
              </span>
            </div>
          )}

          {/* ═══ SECTION A: CRM ACTIVITY & CALL BREAKDOWN ═══ */}
          <div>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 p-3.5 rounded-xl shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xl">📊</span>
                <h3 className="text-sm font-black text-purple-950 uppercase tracking-wide">
                  A. CRM ACTIVITY & CALL BREAKDOWN ({getPeriodLabel()})
                </h3>
              </div>

              {/* Controls & Summary Badges */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Task View Mode Switch */}
                <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5 text-[11px] font-bold">
                  <button
                    onClick={() => setTaskScopeMode('period')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${taskScopeMode === 'period' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Assigned in Period
                  </button>
                  <button
                    onClick={() => setTaskScopeMode('all_open')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${taskScopeMode === 'all_open' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    All Open Tasks
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="bg-purple-700 text-white font-black text-xs px-3 py-1 rounded-lg shadow-xs">
                    Total Tasks: {totalsA.tasks}
                  </span>
                  <span className="bg-amber-600 text-white font-black text-xs px-3 py-1 rounded-lg shadow-xs">
                    Pending: {totalsA.pending}
                  </span>
                </div>
              </div>
            </div>

            {/* Table A matching user image format */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-900 text-slate-200 font-extrabold uppercase tracking-wider">
                  <tr>
                    <th className="p-3 w-10 text-center border-r border-slate-800">#</th>
                    <th className="p-3 min-w-[140px] border-r border-slate-800">Staff Name</th>
                    <th className="p-3 text-center w-20 border-r border-slate-800">Role</th>
                    <th className="p-3 text-center text-purple-300 bg-slate-800 border-r border-slate-800 font-black">Total Tasks Assigned</th>
                    <th className="p-3 text-center text-amber-400 border-r border-slate-800 font-black">CNP</th>
                    <th className="p-3 text-center text-purple-300 border-r border-slate-800 font-black">Call Again</th>
                    <th className="p-3 text-center text-emerald-400 border-r border-slate-800 font-black">Verified</th>
                    <th className="p-3 text-center text-rose-400 font-black">Not Interested</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {allPerformanceStaffList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 font-semibold">
                        No staff performance records available for this filter.
                      </td>
                    </tr>
                  ) : (
                    allPerformanceStaffList.map((s, idx) => (
                      <tr
                        key={s.id || idx}
                        className={`transition-colors hover:bg-slate-50 ${s.isHighPending ? 'bg-amber-50/50 border-l-4 border-l-amber-500' : ''}`}
                      >
                        <td className="p-3 text-center font-bold text-slate-500 border-r border-slate-100">{idx + 1}</td>
                        <td className="p-3 font-extrabold text-slate-900 border-r border-slate-100">
                          <button
                            onClick={() => openStaffDrawer(s.id, s.name)}
                            className="text-indigo-600 hover:text-indigo-900 hover:underline text-left cursor-pointer font-black"
                          >
                            {s.name}
                          </button>
                        </td>
                        <td className="p-3 text-center border-r border-slate-100">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold capitalize ${
                            s.role === 'sales' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}>
                            {s.role}
                          </span>
                        </td>

                        {/* Total Tasks Assigned */}
                        <td className="p-3 text-center font-black text-slate-900 bg-slate-50/70 border-r border-slate-100">
                          <button
                            onClick={() => openDrilldown(s.id, s.name, null)}
                            className="font-black text-purple-900 hover:underline cursor-pointer text-sm"
                          >
                            {s.tasks}
                          </button>
                        </td>

                        {/* CNP */}
                        <td className="p-3 text-center font-extrabold text-amber-700 border-r border-slate-100">
                          <button onClick={() => openDrilldown(s.id, s.name, 'cnp')} className="hover:underline cursor-pointer">
                            {s.cnp}
                          </button>
                        </td>

                        {/* Call Again */}
                        <td className="p-3 text-center font-extrabold text-purple-700 border-r border-slate-100">
                          <button onClick={() => openDrilldown(s.id, s.name, 'call_again')} className="hover:underline cursor-pointer">
                            {s.callAgain}
                          </button>
                        </td>

                        {/* Verified */}
                        <td className="p-3 text-center font-black text-emerald-700 border-r border-slate-100">
                          <button onClick={() => openDrilldown(s.id, s.name, 'verified')} className="hover:underline cursor-pointer">
                            {s.verified}
                          </button>
                        </td>

                        {/* Not Interested */}
                        <td className="p-3 text-center font-extrabold text-rose-700">
                          <button onClick={() => openDrilldown(s.id, s.name, 'not_interested')} className="hover:underline cursor-pointer">
                            {s.notInterested}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>

                {/* ══ Σ GRAND TOTAL ROW ══ */}
                {allPerformanceStaffList.length > 0 && (
                  <tfoot className="bg-slate-900 text-white font-black uppercase text-xs">
                    <tr>
                      <td className="p-3 text-center text-slate-400 font-extrabold">Σ</td>
                      <td className="p-3 text-slate-100 font-black">GRAND TOTAL</td>
                      <td className="p-3 text-center text-slate-400 font-bold">—</td>
                      <td className="p-3 text-center text-purple-300 font-black text-sm">{totalsA.tasks}</td>
                      <td className="p-3 text-center text-amber-400 font-black">{totalsA.cnp}</td>
                      <td className="p-3 text-center text-purple-300 font-black">{totalsA.callAgain}</td>
                      <td className="p-3 text-center text-emerald-400 font-black">{totalsA.verified}</td>
                      <td className="p-3 text-center text-rose-400 font-black">{totalsA.notInterested}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>



          {/* ═══ SECTION B: SHIPMENT & LOGISTICS BREAKDOWN (PRESERVED) ═══ */}
          <div className="flex flex-col gap-6">
            {/* 1. SALES TEAM MEMBERS */}
            <div>
              <div className="flex items-center gap-2 mb-3 bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                <span className="text-lg">💼</span>
                <h3 className="text-sm font-black text-emerald-950 uppercase tracking-wide">
                  B.1 SALES TEAM MEMBERS (Shipment Breakdown)
                </h3>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase tracking-wider">
                    <tr>
                      <th className="p-3 w-12 text-center">#</th>
                      <th className="p-3">Staff Name</th>
                      <th className="p-3 text-center">Role</th>
                      <th className="p-3 text-center text-slate-900 bg-slate-200/50">Total Shipments</th>
                      <th className="p-3 text-center text-blue-600 font-bold bg-blue-50/50">Verified</th>
                      <th className="p-3 text-center text-emerald-600 bg-emerald-50">Delivered</th>
                      <th className="p-3 text-center text-indigo-600">In Transit</th>
                      <th className="p-3 text-center text-amber-600">OFD</th>
                      <th className="p-3 text-center text-rose-600">RTO / NDR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {staffBreakdownData.sales && staffBreakdownData.sales.length > 0 ? (
                      staffBreakdownData.sales.map((s, idx) => (
                        <tr key={s.id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 text-center font-bold text-slate-500">{idx + 1}</td>
                          <td className="p-3 font-extrabold text-slate-900">{s.name}</td>
                          <td className="p-3 text-center font-bold text-emerald-700 capitalize">
                            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px]">
                              {s.role}
                            </span>
                          </td>
                          <td className="p-3 text-center font-black text-slate-900 bg-slate-50">{s.totalShipments}</td>
                          <td className="p-3 text-center font-extrabold text-blue-700 bg-blue-50/30">{s.verified || 0}</td>
                          <td className="p-3 text-center font-black text-emerald-700 bg-emerald-50/60">{s.delivered}</td>
                          <td className="p-3 text-center font-extrabold text-indigo-700">{s.inTransit}</td>
                          <td className="p-3 text-center font-extrabold text-amber-700">{s.ofd}</td>
                          <td className="p-3 text-center font-extrabold text-rose-700">{s.rtoNdr}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="p-6 text-center text-slate-400 font-semibold">
                          No Sales staff records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. SUPPORT TEAM MEMBERS */}
            <div>
              <div className="flex items-center gap-2 mb-3 bg-blue-50 border border-blue-200 p-3 rounded-xl">
                <span className="text-lg">🎧</span>
                <h3 className="text-sm font-black text-blue-950 uppercase tracking-wide">
                  B.2 SUPPORT TEAM MEMBERS (Shipment Breakdown)
                </h3>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase tracking-wider">
                    <tr>
                      <th className="p-3 w-12 text-center">#</th>
                      <th className="p-3">Staff Name</th>
                      <th className="p-3 text-center">Role</th>
                      <th className="p-3 text-center text-slate-900 bg-slate-200/50">Total Shipments</th>
                      <th className="p-3 text-center text-blue-600 font-bold bg-blue-50/50">Verified</th>
                      <th className="p-3 text-center text-emerald-600 bg-emerald-50">Delivered</th>
                      <th className="p-3 text-center text-indigo-600">In Transit</th>
                      <th className="p-3 text-center text-amber-600">OFD</th>
                      <th className="p-3 text-center text-rose-600">RTO / NDR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {staffBreakdownData.support && staffBreakdownData.support.length > 0 ? (
                      staffBreakdownData.support.map((s, idx) => (
                        <tr key={s.id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 text-center font-bold text-slate-500">{idx + 1}</td>
                          <td className="p-3 font-extrabold text-slate-900">{s.name}</td>
                          <td className="p-3 text-center font-bold text-blue-700 capitalize">
                            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[10px]">
                              {s.role}
                            </span>
                          </td>
                          <td className="p-3 text-center font-black text-slate-900 bg-slate-50">{s.totalShipments}</td>
                          <td className="p-3 text-center font-extrabold text-blue-700 bg-blue-50/30">{s.verified || 0}</td>
                          <td className="p-3 text-center font-black text-emerald-700 bg-emerald-50/60">{s.delivered}</td>
                          <td className="p-3 text-center font-extrabold text-indigo-700">{s.inTransit}</td>
                          <td className="p-3 text-center font-extrabold text-amber-700">{s.ofd}</td>
                          <td className="p-3 text-center font-extrabold text-rose-700">{s.rtoNdr}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="p-6 text-center text-slate-400 font-semibold">
                          No Support staff records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </SectionCard>

      {/* ═══ TASK DRILLDOWN MODAL ═══ */}
      {drilldownModal.open && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wide">
                  Task Drilldown: {drilldownModal.staffName}
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  {drilldownModal.status ? `Filtering by status: ${drilldownModal.status.toUpperCase()}` : 'All Assigned Tasks'}
                </p>
              </div>
              <button
                onClick={() => setDrilldownModal({ open: false, staffId: null, staffName: '', status: null, date: null })}
                className="text-slate-400 hover:text-white text-xl font-bold px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
              {drilldownLoading ? (
                <div className="py-12 text-center text-slate-400 font-bold animate-pulse text-xs">
                  Fetching exact task records...
                </div>
              ) : drilldownList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-semibold text-xs">
                  No task records found for this status.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">Lead Name</th>
                      <th className="p-2.5">Phone</th>
                      <th className="p-2.5 text-center">Status</th>
                      <th className="p-2.5 text-center">Assigned Date</th>
                      <th className="p-2.5 text-center">Last Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {drilldownList.map((t, i) => (
                      <tr key={t._id || i} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-500">{i + 1}</td>
                        <td className="p-2.5 font-black text-slate-900">{t.leadName}</td>
                        <td className="p-2.5 font-bold text-blue-700">{t.phone}</td>
                        <td className="p-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black capitalize ${
                            t.status === 'verified' ? 'bg-emerald-100 text-emerald-800' :
                            t.status === 'pending' ? 'bg-amber-100 text-amber-900' :
                            t.status === 'cnp' ? 'bg-amber-100 text-amber-800' :
                            t.status === 'call_again' ? 'bg-purple-100 text-purple-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-center text-slate-600 font-medium">
                          {new Date(t.assignedDate).toLocaleDateString('en-IN')}
                        </td>
                        <td className="p-2.5 text-center text-slate-600 font-medium">
                          {t.lastActionAt ? new Date(t.lastActionAt).toLocaleDateString('en-IN') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ CELL POPOVER MODAL ═══ */}
      {cellPopover && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 w-full max-w-sm flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h4 className="font-extrabold text-sm text-slate-900">{cellPopover.staffName}</h4>
                <p className="text-[11px] text-slate-500 font-bold">{cellPopover.colLabel} Status Split</p>
              </div>
              <button onClick={() => setCellPopover(null)} className="text-slate-400 hover:text-slate-900 font-bold">✕</button>
            </div>
            <div className="flex flex-col gap-2 text-xs font-bold pt-1">
              <div className="flex justify-between p-2 rounded bg-amber-50 text-amber-900">
                <span>Pending (No Action):</span>
                <span>{cellPopover.cell.pending}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-amber-100/70 text-amber-800">
                <span>CNP:</span>
                <span>{cellPopover.cell.cnp}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-purple-50 text-purple-900">
                <span>Call Again:</span>
                <span>{cellPopover.cell.call_again}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-emerald-50 text-emerald-900">
                <span>Verified:</span>
                <span>{cellPopover.cell.verified}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-rose-50 text-rose-900">
                <span>Not Interested:</span>
                <span>{cellPopover.cell.not_interested}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ STAFF DETAIL DRAWER ═══ */}
      {staffDrawer.open && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex justify-end z-50 animate-fade-in">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col overflow-hidden border-l border-slate-200">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base">{staffDrawer.staffName}</h3>
                <p className="text-xs text-slate-400 font-medium">Performance Metrics & Action Aging Breakdown</p>
              </div>
              <button
                onClick={() => setStaffDrawer({ open: false, staffId: null, staffName: '' })}
                className="text-slate-400 hover:text-white text-xl font-bold px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6">
              {staffKPIsLoading ? (
                <div className="py-20 text-center text-slate-400 font-bold animate-pulse text-xs">
                  Loading Staff Detailed Performance KPIs...
                </div>
              ) : staffKPIs ? (
                <>
                  {/* Aging & Alerts */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-center">
                      <div className="text-[10px] font-extrabold text-emerald-700 uppercase">0-1 Day Pending</div>
                      <div className="text-xl font-black text-emerald-950 mt-1">{staffKPIs.aging?.pending0to1 || 0}</div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-center">
                      <div className="text-[10px] font-extrabold text-amber-700 uppercase">2-3 Days Pending</div>
                      <div className="text-xl font-black text-amber-950 mt-1">{staffKPIs.aging?.pending2to3 || 0}</div>
                    </div>
                    <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-center">
                      <div className="text-[10px] font-extrabold text-rose-700 uppercase">3+ Days Pending</div>
                      <div className="text-xl font-black text-rose-950 mt-1">{staffKPIs.aging?.pending3plus || 0}</div>
                    </div>
                  </div>

                  {/* Overdue & Review Alerts */}
                  <div className="flex flex-col gap-2">
                    {staffKPIs.overdueCount > 0 && (
                      <div className="bg-rose-50 border border-rose-300 p-3 rounded-xl flex items-center justify-between text-xs font-bold text-rose-900">
                        <span>⚠️ Call Again Overdue:</span>
                        <span className="bg-rose-600 text-white px-2 py-0.5 rounded-full font-black text-[10px]">
                          {staffKPIs.overdueCount} Overdue
                        </span>
                      </div>
                    )}
                    {staffKPIs.cnpReviewCount > 0 && (
                      <div className="bg-amber-50 border border-amber-300 p-3 rounded-xl flex items-center justify-between text-xs font-bold text-amber-900">
                        <span>🔍 Flagged CNP Retry (&ge;3 attempts):</span>
                        <span className="bg-amber-600 text-white px-2 py-0.5 rounded-full font-black text-[10px]">
                          {staffKPIs.cnpReviewCount} Flagged
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Attendance & Work Summary */}
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex justify-between items-center text-xs font-bold text-slate-800">
                    <div>
                      <span className="text-slate-500">Days Active Worked:</span>{' '}
                      <strong className="text-emerald-700 font-black">{staffKPIs.daysWorked} Days</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Zero-Action Days:</span>{' '}
                      <strong className="text-rose-700 font-black">{staffKPIs.zeroActionDays} Days</strong>
                    </div>
                  </div>

                  {/* Daily Trend List */}
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase mb-3">Daily Task Activity Trend</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar border border-slate-100 p-2 rounded-xl">
                      {staffKPIs.dailyTrend?.length > 0 ? staffKPIs.dailyTrend.map((d, i) => (
                        <div key={i} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-lg">
                          <span className="font-bold text-slate-700">{d.date}</span>
                          <div className="flex gap-3">
                            <span className="text-indigo-600 font-extrabold">Assigned: {d.assigned}</span>
                            <span className="text-emerald-600 font-extrabold">Completed: {d.completed}</span>
                          </div>
                        </div>
                      )) : <p className="text-xs text-slate-400 text-center py-4">No daily activity trend logged.</p>}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ─── Main Dashboard Component ───────────────────────────────────────────── */
export default function Dashboard() {
  const { user } = useAuth();
  const { success, error, info: toastInfo } = useToast();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [todayLists, setTodayLists] = useState({ cnpList: [], callAgainList: [], interestedList: [], notInterestedList: [], onHoldList: [] });
  const [staffStats, setStaffStats] = useState(null);
  const [monthlyChart, setMonthlyChart] = useState([]);
  const [attStatus, setAttStatus] = useState(null);
  const [attLoading, setAttLoading] = useState(false);
  const [commission, setCommission] = useState(null);
  const [commMonth, setCommMonth] = useState(() => { const n = new Date(); return { month: n.getMonth(), year: n.getFullYear() }; });
  const [commLoading, setCommLoading] = useState(false);
  const [openSection, setOpenSection] = useState('cnp');
  
  // Navigation & Refresh state (inspired by Ops Dashboard)
  const [activeTab, setActiveTab] = useState('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // All Staff Performance state
  const [allStaffData, setAllStaffData] = useState([]);
  const [staffBreakdownData, setStaffBreakdownData] = useState({ sales: [], support: [] });
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState('all');

  const [datePreset, setDatePreset] = useState('today');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [department, setDepartment] = useState('');
  const canManage = user?.role === 'admin' || user?.role === 'manager';

  const loadIdRef = useRef(0);

  const load = useCallback(async (silent = false, refreshBypass = false) => {
    const currentLoadId = ++loadIdRef.current;
    // Only show full-screen loader on initial cold start before any data exists
    if (!silent && !stats) setLoading(true);
    const params = getDateParams(datePreset, filterFrom, filterTo);
    const { from, to } = params;
    const selectedDate = (datePreset === 'today' || datePreset === 'all' || !from) ? new Date().toISOString().split('T')[0] : from;

    try {
      // Primary batch: Overview metrics, personal counters & attendance
      const primaryPromises = [
        fetchStats(selectedDate, from, to, department, refreshBypass),
        fetchStaffStats(selectedDate, null, from, to, department, refreshBypass),
        attendanceSvc.getTodayStatus(),
      ];

      // If manager is currently looking at employee performance, fetch staff data in primary batch
      if (canManage && activeTab === 'staff_performance') {
        primaryPromises.push(fetchAllStaffStats(selectedDate, from, to, datePreset, refreshBypass));
        primaryPromises.push(fetchStaffBreakdown({ preset: datePreset, from, to }, refreshBypass));
      }

      const results = await Promise.allSettled(primaryPromises);
      if (currentLoadId !== loadIdRef.current) return;

      const [s, personal, att, allStaffRes, breakdownRes] = results;

      if (s?.status === 'fulfilled') {
        setStats(s.value);
      }
      if (personal?.status === 'fulfilled') {
        setStaffStats(personal.value || null);
      }
      if (att?.status === 'fulfilled') setAttStatus(att.value);

      if (allStaffRes?.status === 'fulfilled' && allStaffRes.value) {
        const raw = allStaffRes.value?.staffStats || (Array.isArray(allStaffRes.value) ? allStaffRes.value : []);
        setAllStaffData(raw.filter(item => item.user && ['sales', 'support', 'logistics', 'manager'].includes(item.user.role)));
      }

      if (breakdownRes?.status === 'fulfilled' && breakdownRes.value) {
        const bdData = breakdownRes.value?.data || breakdownRes.value;
        if (bdData && (bdData.sales || bdData.support)) {
          setStaffBreakdownData(bdData);
        }
      }

      setLastUpdated(new Date());
      // Instant render
      if (!silent) setLoading(false);

      // Pre-fetch staff data in background if not already on staff_performance tab
      if (canManage && activeTab !== 'staff_performance') {
        Promise.allSettled([
          fetchAllStaffStats(selectedDate, from, to, datePreset, refreshBypass),
          fetchStaffBreakdown({ preset: datePreset, from, to }, refreshBypass),
        ]).then(([staffRes, bdRes]) => {
          if (currentLoadId !== loadIdRef.current) return;
          if (staffRes.status === 'fulfilled' && staffRes.value) {
            const raw = staffRes.value?.staffStats || (Array.isArray(staffRes.value) ? staffRes.value : []);
            setAllStaffData(raw.filter(item => item.user && ['sales', 'support', 'logistics', 'manager'].includes(item.user.role)));
          }
          if (bdRes.status === 'fulfilled' && bdRes.value) {
            const bdData = bdRes.value?.data || bdRes.value;
            if (bdData && (bdData.sales || bdData.support)) {
              setStaffBreakdownData(bdData);
            }
          }
        }).catch(e => console.error('Staff background pre-fetch error:', e));
      }

      if (silent) return;

      Promise.allSettled([
        user?.role === 'sales'
          ? fetchStaffTodayLists(selectedDate, null, from, to, department, refreshBypass)
          : Promise.resolve(null),
        fetchStaffMonthlyChart(refreshBypass),
      ]).then(([lists, chart]) => {
        if (currentLoadId !== loadIdRef.current) return;
        if (lists.status === 'fulfilled' && lists.value) {
          const val = lists.value || { cnpList: [], callAgainList: [], interestedList: [], notInterestedList: [], onHoldList: [] };
          setTodayLists(val);
        }
        if (chart.status === 'fulfilled') {
          const val = Array.isArray(chart.value) ? chart.value : [];
          setMonthlyChart(val);
        }
      }).catch((e) => console.error('Dashboard secondary load error:', e));
    } catch (e) {
      console.error('Dashboard load error:', e);
      if (!silent) setLoading(false);
    }
  }, [datePreset, filterFrom, filterTo, department, user?.role, canManage, activeTab]);

  // Auto-refresh interval with toggle (15 seconds live update)
  useEffect(() => {
    let timer;
    if (autoRefresh) {
      timer = setInterval(() => {
        load(true);
      }, 15000); // 15s live update
    }
    return () => { if (timer) clearInterval(timer); };
  }, [autoRefresh, load]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datePreset, filterFrom, filterTo, department, user?.role, activeTab]);

  // Pre-warm common date & department filters into SWR memory in background (enables true 0.1ms filter switching)
  useEffect(() => {
    const timer = setTimeout(() => {
      const presetsToWarm = ['yesterday', 'last7', 'month', 'all'];
      presetsToWarm.forEach(preset => {
        if (preset === datePreset) return;
        const p = getDateParams(preset, '', '');
        const selDate = (preset === 'today' || preset === 'all' || !p.from) ? new Date().toISOString().split('T')[0] : p.from;
        fetchStats(selDate, p.from, p.to, department).catch(() => {});
        fetchStaffStats(selDate, null, p.from, p.to, department).catch(() => {});
      });

      if (canManage && !department) {
        DEPARTMENTS.forEach(dept => {
          fetchStats(new Date().toISOString().split('T')[0], '', '', dept).catch(() => {});
          fetchStaffStats(new Date().toISOString().split('T')[0], null, '', '', dept).catch(() => {});
        });
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [department, canManage, datePreset]);

  useEffect(() => {
    let cancelled = false;
    setCommLoading(true);

    const isPrivileged = user?.role === 'admin' || user?.role === 'manager';
    const fetchFunc = isPrivileged ? fetchAllStaffCommissions : fetchStaffCommission;

    fetchFunc(commMonth.month, commMonth.year)
      .then(d => {
        if (!cancelled) {
          if (isPrivileged) {
            setCommission({
              totalPay: d.grandTotalPay,
              basePay: (d.grandTotalPay || 0) - (d.grandTotalCommission || 0),
              totalCommission: d.grandTotalCommission,
              revenue: d.grandTotalRevenue
            });
          } else {
            setCommission(d);
          }
        }
      })
      .catch(e => { if (!cancelled) console.error(e); })
      .finally(() => { if (!cancelled) setCommLoading(false); });

    return () => { cancelled = true; };
  }, [commMonth, user?.role]);

  const [csvLoading, setCsvLoading] = useState(false);

  const downloadLeadsCSV = async (allLeads = false) => {
    setCsvLoading(allLeads ? 'all' : 'filtered');
    try {
      let allLeadsList = [];

      if (allLeads) {
        allLeadsList = await exportLeads();
      } else {
        const fp = getDateParams(datePreset, filterFrom, filterTo);
        const baseParams = { limit: 500 };
        if (fp.from) baseParams.dateFrom = fp.from;
        if (fp.to) baseParams.dateTo = fp.to;
        if (department) baseParams.department = department;
        let page = 1, totalPages = 1;
        do {
          const data = await getLeads({ ...baseParams, page });
          allLeadsList = [...allLeadsList, ...(data?.leads || [])];
          totalPages = data?.totalPages || 1;
          page++;
        } while (page <= totalPages);
      }

      const headers = ['Name', 'Phone', 'Status', 'Problem', 'Age', 'Weight', 'Height', 'Price', 'City/Village', 'District', 'Pincode', 'State', 'Assigned To', 'Created At'];
      const rows = allLeadsList.map(l => [
        l.name || '', l.phone || '', l.status || '', l.problem || '',
        l.age || '', l.weight || '', l.height || '', l.price || l.revenue || '',
        l.cityVillage || '', l.district || '', l.pincode || '', l.state || '',
        l.assignedTo?.name || '',
        l.createdAt ? new Date(l.createdAt).toLocaleString() : '',
      ]);
      const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = allLeads ? `all_leads_${new Date().toISOString().slice(0, 10)}.csv` : `leads_${datePreset}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } catch (e) { error('Failed to download CSV'); }
    finally { setCsvLoading(false); }
  };

  const checkedIn = !!attStatus?.checkIn;
  const checkedOut = !!attStatus?.checkOut;
  const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : null;

  const handleCheckIn = async () => {
    setAttLoading(true);
    try {
      const res = await attendanceSvc.checkIn();
      setAttStatus(res);
      success('Good morning! You have checked in successfully.', 'Clock In');
    }
    catch (e) { error(e.response?.data?.message || 'Check-in failed'); }
    setAttLoading(false);
  };
  const handleCheckOut = async () => {
    setAttLoading(true);
    try {
      const res = await attendanceSvc.checkOut();
      setAttStatus(res);
      toastInfo('Work day finished. Take care!', 'Clock Out');
    }
    catch (e) { error(e.response?.data?.message || 'Check-out failed'); }
    setAttLoading(false);
  };

  const selectDatePreset = (preset) => {
    setDatePreset(preset);
    if (preset === 'custom') {
      const today = new Date();
      const from = formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1));
      const to = formatDateInput(today);
      setFilterFrom(from);
      setFilterTo(to);
    } else {
      setFilterFrom('');
      setFilterTo('');
    }
  };

  // Calculate dynamic metrics from backend stats
  const getPeriodLabel = () => {
    if (datePreset === 'today') return t('Today');
    if (datePreset === 'yesterday') return t('Yesterday');
    if (datePreset === 'last7') return t('Last 7 Days');
    if (datePreset === 'month') return t('This Month');
    if (datePreset === 'last_month') return t('Last Month');
    if (datePreset === 'all') return t('All Time');
    return `${filterFrom} to ${filterTo}`;
  };

  const migraineLeadCount = stats?.departmentLeads?.migraine || 0;
  const pilesLeadCount = stats?.departmentLeads?.piles || 0;
  const newLeadsTotal = stats?.newLeadsToday || 0;
  const migraineLeadPercent = newLeadsTotal > 0 ? Math.round((migraineLeadCount / newLeadsTotal) * 100) : 0;
  const pilesLeadPercent = newLeadsTotal > 0 ? Math.round((pilesLeadCount / newLeadsTotal) * 100) : 0;
  const overallConversionRate = stats?.conversionRate || 0;
  const migraineConversionRate = stats?.migraineConversionRate || 0;
  const pilesConversionRate = stats?.pilesConversionRate || 0;
  const migraineConverted = stats?.migraineConverted || 0;
  const pilesConverted = stats?.pilesConverted || 0;

  // Funnel calculation
  const maxFunnelCount = Math.max(...(stats?.salesFunnel || []).map(f => f.count), 1);
  const maxSourceCount = Math.max(...(stats?.sourcePerformance || []).map(s => s.count), 1);

  // Navigation tabs definition
  const tabsList = [
    { id: 'overview', label: t('Overview & Pipeline'), icon: icons.target },
    ...(canManage ? [
      { id: 'fulfillment', label: t('Fulfillment & Conversion'), icon: icons.box },
      { id: 'analytics', label: t('Shipment Analytics'), icon: icons.truck },
      { id: 'trends', label: t('Earnings & Trend'), icon: icons.chart },
      { id: 'staff_performance', label: t('Employee Performance'), icon: icons.users },
    ] : [
      ...(user?.role === 'sales' ? [
        { id: 'my_lists', label: `${t('My Activity Detail')} (${getPeriodLabel()})`, icon: icons.clipboard },
      ] : []),
      { id: 'trends', label: t('Earnings & Trend'), icon: icons.chart },
    ]),
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f0', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 20px' }}>
        
        {/* ═══ Header ═══ */}
        <div className="no-print" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(22,163,74,0.25)' }}>
                {icons.dashboard}
              </div>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif", letterSpacing: -0.5 }}>
                {canManage ? t('Sales & Leads Dashboard') : t('My Sales Dashboard')}
              </h1>
              {!canManage && (
                <span style={{
                  background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d',
                  borderRadius: 8, fontSize: 11, fontWeight: 700, padding: '4px 10px',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {icons.user} My Data Only
                </span>
              )}
              {canManage && department && (
                <span style={{
                  background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd',
                  borderRadius: 8, fontSize: 11, fontWeight: 700, padding: '4px 10px',
                  display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase'
                }}>
                  {icons.building} {department} Dept
                </span>
              )}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b', fontWeight: 500 }}>
              {canManage
                ? `${t('Company-wide dynamic analytics of lead intake, conversions, and operational volume')} (${getPeriodLabel()})`
                : `${t('Showing your real-time active leads, phone calls, and conversion targets')} (${getPeriodLabel()})`}
            </p>
          </div>

          {/* Top Right Highlight Badges (Ops Dashboard Style) */}
          {stats && !loading && (
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              {canManage && (
                <div style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1px solid #86efac', padding: '9px 18px', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', boxShadow: '0 2px 6px rgba(22,163,74,0.08)' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('Overall VR Rate')}</span>
                  <span style={{ fontSize: 22, fontWeight: 900, color: '#15803d', lineHeight: 1.1, marginTop: 2 }}>
                    {overallConversionRate}%
                  </span>
                </div>
              )}
              <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', border: '1px solid #93c5fd', padding: '9px 18px', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', boxShadow: '0 2px 6px rgba(59,130,246,0.08)' }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('New Leads')} ({getPeriodLabel()})</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#1e40af', lineHeight: 1.1, marginTop: 2 }}>
                  {newLeadsTotal}
                </span>
              </div>
              {canManage && (
                <div style={{ background: 'linear-gradient(135deg, #fdf4ff, #fae8ff)', border: '1px solid #f0abfc', padding: '9px 18px', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', boxShadow: '0 2px 6px rgba(192,38,211,0.08)' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#c026d3', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('Delivered Revenue')}</span>
                  <span style={{ fontSize: 22, fontWeight: 900, color: '#86198f', lineHeight: 1.1, marginTop: 2 }}>
                    ₹{(stats?.deliveredRevenue || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══ Filter Bar ═══ */}
        <DashboardFilterBar
          datePreset={datePreset}
          onSelectPreset={selectDatePreset}
          filterFrom={filterFrom}
          setFilterFrom={setFilterFrom}
          filterTo={filterTo}
          setFilterTo={setFilterTo}
          department={department}
          setDepartment={setDepartment}
          canManage={canManage}
          lastUpdated={lastUpdated}
          onRefresh={() => {
            clearDashboardCache();
            clearOpsDashboardCache();
            load(false, true);
          }}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={() => setAutoRefresh(v => !v)}
          onDownloadCSV={downloadLeadsCSV}
          csvLoading={csvLoading}
          t={t}
        />

        {/* ═══ Navigation Tabs (Ops Dashboard Style) ═══ */}
        <div className="no-print" style={{ display: 'flex', gap: 6, marginBottom: 24, background: '#fff', borderRadius: 14, padding: 6, border: '1px solid rgba(0,0,0,0.06)', width: 'fit-content', flexWrap: 'wrap', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          {tabsList.map(tab => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '9px 20px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  background: isSelected ? '#16a34a' : 'transparent',
                  color: isSelected ? '#fff' : '#64748b',
                  transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 8,
                  boxShadow: isSelected ? '0 2px 8px rgba(22,163,74,0.3)' : 'none',
                }}
              >
                <span>{tab.icon}</span> {tab.label}
              </button>
            );
          })}
        </div>

        {/* ═══ Tab 1: Overview & Pipeline ═══ */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Attendance Quick Card (Managers Only) */}
            {user?.role === 'manager' && (
              <div style={{ background: 'linear-gradient(135deg, #0d1f0d, #1a3a1a)', borderRadius: 16, padding: '20px 24px', boxShadow: '0 4px 16px rgba(13,31,13,0.3)', border: '1px solid #22c55e30' }}>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-green-500/20 flex items-center justify-center border border-green-500/30 text-green-400">
                      {icons.user}
                    </div>
                    <div>
                      <p className="text-white font-bold text-base tracking-tight">Personal Attendance</p>
                      <p className="text-green-300/70 text-xs mt-0.5 font-medium">
                        {checkedIn && checkedOut ? `In: ${fmtTime(attStatus.checkIn)} · Out: ${fmtTime(attStatus.checkOut)}`
                          : checkedIn ? `Checked in at ${fmtTime(attStatus.checkIn)}`
                            : 'Not checked in yet today'}
                      </p>
                    </div>
                  </div>
                  <div>
                    {!checkedIn ? (
                      <button onClick={handleCheckIn} disabled={attLoading}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-60 active:scale-95 flex items-center gap-2"
                        style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
                        {attLoading ? 'Processing...' : <>{icons.clock} Clock In</>}
                      </button>
                    ) : !checkedOut ? (
                      <button onClick={handleCheckOut} disabled={attLoading}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-60 active:scale-95 flex items-center gap-2"
                        style={{ background: 'linear-gradient(135deg, #ea580c, #c2410c)' }}>
                        {attLoading ? 'Processing...' : <>{icons.logout} Clock Out</>}
                      </button>
                    ) : (
                      <button onClick={handleCheckIn} disabled={attLoading}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-60 active:scale-95 flex items-center gap-2"
                        style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
                        {attLoading ? 'Processing...' : <>{icons.clock} Clock In Again</>}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Admin/Manager Quick Actions */}
            {canManage && (
              <SectionCard title="Quick Action Shortcuts" subtitle="Fast navigation to primary team management modules" icon={icons.lightning}>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {[
                    { label: t('Leads Hub'), icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>, path: '/leads', color: '#2563eb', bg: 'rgba(37,99,235,0.08)', border: '#2563eb30', badge: stats?.newLeadsToday },
                    { label: t('Verification'), icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, path: '/verification', color: '#16a34a', bg: 'rgba(22,163,74,0.08)', border: '#16a34a30', badge: stats?.taskToVerificationCount },
                    { label: t('Ready to Ship'), icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="1" /><path d="M16 8h4l3 5v3h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>, path: '/ready-to-shipment', color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', border: '#8b5cf630', badge: stats?.readyToShipCreatedCount },
                    { label: t('Logistics Desk'), icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="2" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>, path: '/logistics-dashboard', color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)', border: '#0ea5e930' },
                    { label: t('Notifications'), icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>, path: '/notifications', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: '#f59e0b30' },
                  ].map(action => (
                    <button
                      key={action.path}
                      onClick={() => navigate(action.path)}
                      style={{
                        background: '#fff', border: `1px solid ${action.border}`, borderRadius: 14,
                        padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14,
                        cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                      }}
                      className="hover:shadow-lg hover:-translate-y-0.5 active:scale-95 group relative overflow-hidden"
                    >
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: action.bg, color: action.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} className="group-hover:scale-110 transition-transform">
                        {action.icon}
                      </div>
                      <div style={{ textAlign: 'left', flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{action.label}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>Click to manage {icons.arrowRight}</div>
                      </div>
                      {action.badge !== undefined && (
                        <div style={{ background: action.bg, color: action.color, border: `1px solid ${action.color}`, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
                          {action.badge}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* My Activity Counts (Staff Only) */}
            {user?.role === 'sales' && (
              <SectionCard title="My Personal Activity Metrics" subtitle={`Your real-time dynamic performance tallies for ${getPeriodLabel()}`} icon={icons.activity}>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
                  {[
                    { key: 'cnp', label: "CNP", value: staffStats?.todayCnp ?? 0, icon: icons.cnp, color: '#ef4444', unit: 'CALLS' },
                    { key: 'callAgain', label: "Call Again", value: staffStats?.todayCallAgain ?? 0, icon: icons.callAgain, color: '#f59e0b', unit: 'CALLS' },
                    { key: 'leadAdd', label: "Lead Add", value: staffStats?.leadsAdded ?? 0, icon: icons.leadAdd, color: '#3b82f6', unit: 'LEADS' },
                    { key: 'verified', label: "Verified", value: staffStats?.verifiedCount ?? 0, icon: icons.verify, color: '#10b981', unit: 'ORDERS' },
                    { key: 'onHold', label: "On Hold", value: staffStats?.onHoldCount ?? 0, icon: icons.onHold, color: '#d97706', unit: 'LEADS' },
                    { key: 'interested', label: "Interested", value: staffStats?.todayInterested ?? 0, icon: icons.interested, color: '#16a34a', unit: 'LEADS' },
                    { key: 'notInterested', label: "Not Interested", value: staffStats?.todayNotInterested ?? 0, icon: icons.notInterested, color: '#64748b', unit: 'LEADS' },
                  ].map(stat => (
                    <OpsKpiCard
                      key={stat.key}
                      label={stat.label}
                      value={stat.value}
                      color={stat.color}
                      icon={stat.icon}
                      unit={stat.unit}
                      onClick={['cnp', 'callAgain', 'interested', 'onHold', 'notInterested'].includes(stat.key) ? () => {
                        setActiveTab('my_lists');
                        setOpenSection(stat.key);
                      } : undefined}
                    />
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Lead Pipeline KPIs */}
            <SectionCard title="Dynamic Lead Pipeline & Generation" subtitle={`Real-time distribution of leads across departmental categories (${getPeriodLabel()})`} icon={icons.target}>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                <OpsKpiCard
                  label={t('Total Leads')}
                  value={stats?.totalLeads ?? 0}
                  color="#10b981"
                  unit="ALL TIME"
                  subtext="Click to download the complete leads archive in CSV format"
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
                  progressLabel={csvLoading === 'all' ? <>{icons.clock} {t('Downloading...')}</> : <>{icons.download} {t('Click for full CSV archive')}</>}
                  onClick={() => downloadLeadsCSV(true)}
                />
                 <OpsKpiCard
                  label={t('Ready to Shipment')}
                  value={stats?.readyToShipmentCount ?? 0}
                  color="#8b5cf6"
                  unit="PENDING"
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="1" /><path d="M16 8h4l3 5v3h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>}
                  progressLabel={`Backlog orders awaiting dispatch`}
                  onClick={canManage ? () => navigate('/ready-to-shipment') : undefined}
                />
                <OpsKpiCard
                  label={datePreset === 'all' ? t('New Leads (Total)') : `${t('New Leads')}`}
                  value={stats?.newLeadsToday ?? 0}
                  color="#3b82f6"
                  unit={getPeriodLabel().toUpperCase()}
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}
                  progressLabel={`${stats?.newLeadsToday || 0} leads generated (${getPeriodLabel()})`}
                />
                <OpsKpiCard
                  label={`${t('Migraine')} ${t('Leads')}`}
                  value={migraineLeadCount}
                  color="#ec4899"
                  unit="MIGRAINE"
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 4.5c-2.5 0-4.5 2-4.5 4.5v1.25A3.25 3.25 0 0 0 5 13.4c0 1.8 1.45 3.25 3.25 3.25h.25V19h7v-2.35h.25A3.25 3.25 0 0 0 19 13.4a3.25 3.25 0 0 0-2.5-3.15V9c0-2.5-2-4.5-4.5-4.5z" /><path d="M10 9.25h4M9.5 12h5M10 14.75h4" /></svg>}
                  progress={migraineLeadPercent}
                  progressLabel={`${migraineLeadPercent}% of new leads · VR: ${migraineConversionRate}%`}
                />
                <OpsKpiCard
                  label={`${t('Piles')} ${t('Leads')}`}
                  value={pilesLeadCount}
                  color="#f59e0b"
                  unit="PILES"
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11z" /><circle cx="12" cy="10" r="2.5" /></svg>}
                  progress={pilesLeadPercent}
                  progressLabel={`${pilesLeadPercent}% of new leads · VR: ${pilesConversionRate}%`}
                />
               
              </div>
            </SectionCard>

            {/* ═══ Live Verification & Shipment Workflow Pipeline ═══ */}
            <SectionCard title="Live Verification & Shipment Pipeline" subtitle={`Real-time conversion tracking from sales tasks to QA verifications and logistics dispatch (${getPeriodLabel()})`} icon={icons.activity}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
                <OpsKpiCard
                  label="Pending Verifications"
                  value={stats?.pendingVerificationsCount ?? 0}
                  color="#f59e0b"
                  unit="LIVE QUEUE"
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
                  progressLabel={`Verifications currently awaiting QA decision`}
                  onClick={canManage ? () => navigate('/verification') : undefined}
                />
                <OpsKpiCard
                  label="Verification to Ready to Ship"
                  value={stats?.readyToShipCreatedCount ?? 0}
                  color="#10b981"
                  unit={getPeriodLabel().toUpperCase()}
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
                  progressLabel={`Verified leads moved to ready to ship (${getPeriodLabel()})`}
                  onClick={canManage ? () => navigate('/ready-to-shipment') : undefined}
                />
                <OpsKpiCard
                  label="Migraine Verifications"
                  value={stats?.migraineConverted ?? 0}
                  color="#8b5cf6"
                  unit="MIGRAINE"
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>}
                  progressLabel={`${stats?.migrainePendingVerifications ?? 0} pending in QA · ${stats?.migraineTaskToVerification ?? 0} added (${getPeriodLabel()})`}
                  onClick={canManage ? () => navigate('/verification') : undefined}
                />
                <OpsKpiCard
                  label="Piles Verifications"
                  value={stats?.pilesConverted ?? 0}
                  color="#f59e0b"
                  unit="PILES"
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11z" /><circle cx="12" cy="10" r="2.5" /></svg>}
                  progressLabel={`${stats?.pilesPendingVerifications ?? 0} pending in QA · ${stats?.pilesTaskToVerification ?? 0} added (${getPeriodLabel()})`}
                  onClick={canManage ? () => navigate('/verification') : undefined}
                />
                <OpsKpiCard
                  label="Task to Verification"
                  value={stats?.taskToVerificationCount ?? 0}
                  color="#6366f1"
                  unit={getPeriodLabel().toUpperCase()}
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>}
                  progressLabel={`Tasks converted into verifications (${getPeriodLabel()})`}
                  onClick={canManage ? () => navigate('/verification') : undefined}
                />
              </div>
            </SectionCard>

            {/* ═══ Dynamic Sales Funnel & Acquisition Sources ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard title="Dynamic Sales Stage Funnel" subtitle={`Conversion status breakdown across all sales pipeline phases (${getPeriodLabel()})`} icon={icons.barChart}>
                <div className="space-y-3.5 mt-2">
                  {(stats?.salesFunnel && stats.salesFunnel.length > 0) ? (
                    stats.salesFunnel.map((item, idx) => {
                      const info = stageNames[item.stage] || { label: item.stage || 'Other', color: '#64748b', icon: icons.tag };
                      const percentOfMax = maxFunnelCount > 0 ? Math.round((item.count / maxFunnelCount) * 100) : 0;
                      const percentOfTotal = newLeadsTotal > 0 ? Math.round((item.count / newLeadsTotal) * 100) : 0;
                      return (
                        <div key={item.stage || idx} className="flex items-center gap-3 py-1.5 px-2 rounded-xl hover:bg-slate-50 transition-colors">
                          <div style={{ width: 160 }} className="flex items-center gap-2.5 font-extrabold text-slate-700 text-xs truncate shrink-0">
                            <span style={{ color: info.color }}>{info.icon}</span>
                            <span className="truncate" title={info.label}>{info.label}</span>
                          </div>
                          <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200/60 shadow-inner">
                            <div
                              style={{ width: `${item.count > 0 ? Math.max(percentOfMax, 6) : 0}%`, background: info.color }}
                              className="h-full rounded-full transition-all duration-700 ease-out shadow-sm"
                            />
                          </div>
                          <div style={{ width: 85 }} className="text-right shrink-0">
                            <span className="font-black text-slate-900 text-sm">{item.count.toLocaleString('en-IN')}</span>
                            <span className="text-[10px] text-slate-400 font-extrabold ml-1">({percentOfTotal}%)</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-12 text-center text-slate-400 text-xs font-semibold">No pipeline stage records in selected timeframe</div>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Live Acquisition Channel Sources" subtitle={`Dynamic volume attribution by marketing channel (${getPeriodLabel()})`} icon={icons.globe}>
                <div className="space-y-3.5 mt-2">
                  {(stats?.sourcePerformance && stats.sourcePerformance.length > 0) ? (
                    stats.sourcePerformance.map((item, idx) => {
                      const style = getSourceStyle(item.source);
                      const barW = maxSourceCount > 0 ? Math.round((item.count / maxSourceCount) * 100) : 0;
                      return (
                        <div key={item.source || idx} className="flex items-center gap-3 py-1.5 px-2 rounded-xl hover:bg-slate-50 transition-colors">
                          <div style={{ width: 160 }} className="flex items-center gap-2.5 font-extrabold text-slate-700 text-xs truncate shrink-0">
                            <span style={{ color: style.color }}>{style.icon}</span>
                            <span className="truncate" title={style.label}>{style.label}</span>
                          </div>
                          <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200/60 shadow-inner">
                            <div
                              style={{ width: `${item.count > 0 ? Math.max(barW, 6) : 0}%`, background: style.color }}
                              className="h-full rounded-full transition-all duration-700 ease-out shadow-sm"
                            />
                          </div>
                          <div style={{ width: 85 }} className="text-right shrink-0">
                            <span className="font-black text-slate-900 text-sm">{item.count.toLocaleString('en-IN')}</span>
                            <span className="text-[10px] text-slate-400 font-extrabold ml-1">({item.percentage || 0}%)</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-12 text-center text-slate-400 text-xs font-semibold">No attribution source data recorded in selected timeframe</div>
                  )}
                </div>
              </SectionCard>
            </div>

            {/* ═══ Company Call & Activity Pulse (Admin/Manager Only) ═══ */}
            {canManage && stats?.activity && (
              <SectionCard title="Company-Wide Operational & Call Pulse" subtitle={`Live aggregated staff call and lead engagement outcomes (${getPeriodLabel()})`} icon={icons.megaphone}>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
                  <OpsKpiCard
                    label="CNP (Not Picked)"
                    value={stats?.activity?.todayCnp ?? 0}
                    color="#ef4444"
                    unit="CALLS"
                    icon={icons.cnp}
                    progressLabel={`Could not pick calls recorded (${getPeriodLabel()})`}
                  />
                  <OpsKpiCard
                    label="Call Again Scheduled"
                    value={stats?.activity?.todayCallAgain ?? 0}
                    color="#f59e0b"
                    unit="CALLS"
                    icon={icons.callAgain}
                    progressLabel={`Callbacks scheduled (${getPeriodLabel()})`}
                  />
                  <OpsKpiCard
                    label="Interested Prospects"
                    value={stats?.activity?.todayInterested ?? 0}
                    color="#16a34a"
                    unit="LEADS"
                    icon={icons.interested}
                    progressLabel={`Positive leads identified (${getPeriodLabel()})`}
                  />
                  <OpsKpiCard
                    label="Not Interested"
                    value={stats?.activity?.todayNotInterested ?? 0}
                    color="#64748b"
                    unit="LEADS"
                    icon={icons.notInterested}
                    progressLabel={`Leads marked not interested (${getPeriodLabel()})`}
                  />
                  <OpsKpiCard
                    label="Closed Lost"
                    value={stats?.activity?.todayClosedLost ?? 0}
                    color="#dc2626"
                    unit="CLOSED"
                    icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>}
                    progressLabel={`Discontinued or cancelled leads`}
                  />
                </div>
              </SectionCard>
            )}

            {/* ═══ Team Workforce & Task Fulfillment (Admin/Manager Only) ═══ */}
            {canManage && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SectionCard title="Live Workforce & Staff Attendance" subtitle="Real-time check-in status of active company sales & support agents" icon={icons.users}>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <OpsKpiCard
                      label="Present & Active"
                      value={stats?.attendance?.present ?? 0}
                      color="#10b981"
                      unit="ONLINE"
                      progress={stats?.attendance?.totalStaff ? Math.round(((stats.attendance.present || 0) / stats.attendance.totalStaff) * 100) : 0}
                      progressLabel={`Checked in out of ${stats?.attendance?.totalStaff || 0} staff`}
                    />
                    <OpsKpiCard
                      label="Checked Out"
                      value={stats?.attendance?.checkedOut ?? 0}
                      color="#3b82f6"
                      unit="DONE"
                      progress={stats?.attendance?.totalStaff ? Math.round(((stats.attendance.checkedOut || 0) / stats.attendance.totalStaff) * 100) : 0}
                      progressLabel={`Finished shift today`}
                    />
                    <OpsKpiCard
                      label="Absent / Pending"
                      value={stats?.attendance?.absent ?? 0}
                      color="#f59e0b"
                      unit="ABSENT"
                      progress={stats?.attendance?.totalStaff ? Math.round(((stats.attendance.absent || 0) / stats.attendance.totalStaff) * 100) : 0}
                      progressLabel={`Awaiting clock-in`}
                    />
                  </div>
                </SectionCard>

                <SectionCard title="Active Staff Task Queue" subtitle={`Pending and overdue follow-up task volume requiring staff attention (${getPeriodLabel()})`} icon={icons.tasks}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <OpsKpiCard
                      label="Pending Tasks"
                      value={stats?.tasks?.pending ?? 0}
                      color="#6366f1"
                      unit="QUEUE"
                      icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
                      progressLabel={`Active reminders across team`}
                    />
                    <OpsKpiCard
                      label="Overdue Tasks"
                      value={stats?.tasks?.overdue ?? 0}
                      color="#dc2626"
                      unit="URGENT"
                      icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>}
                      progressLabel={`Past scheduled callback timestamp`}
                    />
                  </div>
                </SectionCard>
              </div>
            )}

            {/* ═══ Monthly Shipment Performance & RTO Analytics ═══ */}
            <SectionCard title="Monthly Shipment Performance & RTO Analytics" subtitle="Real-time delivery rates, RTO tracking, and active in-transit fulfillment pulse across all logistics partners (Current Month)" icon={icons.packageCheck}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <OpsKpiCard
                  label="Total Dispatched (Month)"
                  value={stats?.monthlyShipments?.dispatched ?? 0}
                  color="#3b82f6"
                  unit="THIS MONTH"
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>}
                  progressLabel={`Total orders processed & shipped this month`}
                  onClick={canManage ? () => navigate('/shiprocket/orders') : undefined}
                />
                <OpsKpiCard
                  label="Monthly Delivery Rate"
                  value={`${stats?.monthlyShipments?.deliveryRate ?? 0}%`}
                  color="#10b981"
                  unit="DELIVERED"
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
                  progressLabel={`${stats?.monthlyShipments?.delivered ?? 0} successfully delivered out of ${stats?.monthlyShipments?.dispatched ?? 0} dispatched`}
                  onClick={canManage ? () => navigate('/shiprocket/orders') : undefined}
                />
                <OpsKpiCard
                  label="Monthly RTO Rate"
                  value={`${stats?.monthlyShipments?.rtoRate ?? 0}%`}
                  color="#ef4444"
                  unit="RTO RATE"
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>}
                  progressLabel={`${stats?.monthlyShipments?.rto ?? 0} returned to origin out of ${stats?.monthlyShipments?.dispatched ?? 0} dispatched`}
                  onClick={canManage ? () => navigate('/shiprocket/returns') : undefined}
                />
                <OpsKpiCard
                  label="Active In Transit"
                  value={stats?.monthlyShipments?.inTransit ?? 0}
                  color="#f59e0b"
                  unit="IN TRANSIT"
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
                  progressLabel={`${stats?.monthlyShipments?.inTransitCount ?? 0} in transit · ${stats?.monthlyShipments?.ofdCount ?? 0} out for delivery (ShipMaxx)`}
                  onClick={canManage ? () => navigate('/shiprocket/orders') : undefined}
                />
              </div>
            </SectionCard>

          </div>
        )}

        {/* ═══ Tab 2: Fulfillment & Conversion (Admin/Manager Only) ═══ */}
        {activeTab === 'fulfillment' && canManage && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* ═══ Live Verification & Shipment Workflow Pipeline ═══ */}
            <SectionCard title="Live Verification & Shipment Pipeline" subtitle={`Real-time conversion tracking from sales tasks to QA verifications and logistics dispatch (${getPeriodLabel()})`} icon={icons.activity}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
                <OpsKpiCard
                  label="Task to Verification"
                  value={stats?.taskToVerificationCount ?? 0}
                  color="#6366f1"
                  unit={getPeriodLabel().toUpperCase()}
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>}
                  progressLabel={`Tasks converted into verifications (${getPeriodLabel()})`}
                  onClick={canManage ? () => navigate('/verification') : undefined}
                />
                <OpsKpiCard
                  label="Pending Verifications"
                  value={stats?.pendingVerificationsCount ?? 0}
                  color="#f59e0b"
                  unit="LIVE QUEUE"
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
                  progressLabel={`Verifications currently awaiting QA decision`}
                  onClick={canManage ? () => navigate('/verification') : undefined}
                />
                <OpsKpiCard
                  label="Verification to Ready to Ship"
                  value={stats?.readyToShipCreatedCount ?? 0}
                  color="#10b981"
                  unit={getPeriodLabel().toUpperCase()}
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
                  progressLabel={`Verified leads moved to ready to ship (${getPeriodLabel()})`}
                  onClick={canManage ? () => navigate('/ready-to-shipment') : undefined}
                />
                <OpsKpiCard
                  label="Migraine Verifications"
                  value={stats?.migraineConverted ?? 0}
                  color="#8b5cf6"
                  unit="MIGRAINE"
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>}
                  progressLabel={`${stats?.migrainePendingVerifications ?? 0} pending in QA · ${stats?.migraineTaskToVerification ?? 0} added (${getPeriodLabel()})`}
                  onClick={canManage ? () => navigate('/verification') : undefined}
                />
                <OpsKpiCard
                  label="Piles Verifications"
                  value={stats?.pilesConverted ?? 0}
                  color="#f59e0b"
                  unit="PILES"
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11z" /><circle cx="12" cy="10" r="2.5" /></svg>}
                  progressLabel={`${stats?.pilesPendingVerifications ?? 0} pending in QA · ${stats?.pilesTaskToVerification ?? 0} added (${getPeriodLabel()})`}
                  onClick={canManage ? () => navigate('/verification') : undefined}
                />
              </div>
            </SectionCard>

            {/* Delivered Orders Overview */}
            <SectionCard title="Delivered Orders Overview" subtitle={`Delivered shipments categorization between new acquisition and repeat reorders (${getPeriodLabel()})`} icon={icons.packageCheck}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <OpsKpiCard
                  label="Delivered Orders"
                  value={stats?.deliveredCount ?? 0}
                  color="#10b981"
                  unit="DELIVERIES"
                  icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
                  progressLabel={`Total completed order deliveries (${getPeriodLabel()})`}
                />
                <OpsKpiCard
                  label="New Order Deliveries"
                  value={stats?.newDeliveredCount ?? 0}
                  color="#3b82f6"
                  unit="1ST KIT"
                  icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>}
                  progress={stats?.deliveredCount ? Math.round(((stats?.newDeliveredCount || 0) / stats?.deliveredCount) * 100) : 0}
                  progressLabel={`Share of total deliveries (First Acquisition)`}
                />
                <OpsKpiCard
                  label="Old Order Deliveries"
                  value={stats?.oldDeliveredCount ?? 0}
                  color="#8b5cf6"
                  unit="2ND+ KIT"
                  icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.61 19a19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 3.09 4.18 2 2 0 0 1 5.07 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L9.91 9.91a16 16 0 0 0 6.18 6.18l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>}
                  progress={stats?.deliveredCount ? Math.round(((stats?.oldDeliveredCount || 0) / stats?.deliveredCount) * 100) : 0}
                  progressLabel={`Share of total deliveries (Repeat Reorders)`}
                />
              </div>
            </SectionCard>

            {/* Lead Verification Rate */}
            <SectionCard title="Lead Verification & Conversion Rate" subtitle={`Conversion efficiency ratios from initial lead acquisition to verified order (${getPeriodLabel()})`} icon={icons.lightning}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <OpsKpiCard
                  label={`${t('Overall Conversion')}`}
                  value={`${overallConversionRate}%`}
                  color="#10b981"
                  unit="VR RATE"
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
                  progress={overallConversionRate}
                  progressLabel={`${stats?.convertedLeads || 0} verified / ${stats?.newLeadsToday || 0} total new leads`}
                />
                <OpsKpiCard
                  label={`${t('Migraine Conversion')}`}
                  value={`${migraineConversionRate}%`}
                  color="#ec4899"
                  unit="VR RATE"
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 4.5c-2.5 0-4.5 2-4.5 4.5v1.25A3.25 3.25 0 0 0 5 13.4c0 1.8 1.45 3.25 3.25 3.25h.25V19h7v-2.35h.25A3.25 3.25 0 0 0 19 13.4a3.25 3.25 0 0 0-2.5-3.15V9c0-2.5-2-4.5-4.5-4.5z" /><path d="M10 9.25h4M9.5 12h5M10 14.75h4" /></svg>}
                  progress={migraineConversionRate}
                  progressLabel={`${migraineConverted} verified / ${migraineLeadCount} migraine leads`}
                />
                <OpsKpiCard
                  label={`${t('Piles Conversion')}`}
                  value={`${pilesConversionRate}%`}
                  color="#f59e0b"
                  unit="VR RATE"
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11z" /><circle cx="12" cy="10" r="2.5" /></svg>}
                  progress={pilesConversionRate}
                  progressLabel={`${pilesConverted} verified / ${pilesLeadCount} piles leads`}
                />
              </div>
            </SectionCard>

            {/* Shipping Preparation & Order Intake */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard title="Shipping Preparation" subtitle={`Pending backlog composition by kit sequence (${getPeriodLabel()})`} icon={icons.box}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <OpsKpiCard
                    label={t('New Ready to Ship')}
                    value={stats?.newReadyToShipCount ?? 0}
                    color="#6366f1"
                    unit="ORDERS"
                    progress={stats?.readyToShipmentCount ? Math.round(((stats?.newReadyToShipCount || 0) / stats?.readyToShipmentCount) * 100) : 0}
                    progressLabel={t('Share of Pending Backlog')}
                  />
                  <OpsKpiCard
                    label={t('Old Ready to Ship')}
                    value={stats?.oldReadyToShipCount ?? 0}
                    color="#ec4899"
                    unit="ORDERS"
                    progress={stats?.readyToShipmentCount ? Math.round(((stats?.oldReadyToShipCount || 0) / stats?.readyToShipmentCount) * 100) : 0}
                    progressLabel={t('Share of Pending Backlog')}
                  />
                </div>
              </SectionCard>

              <SectionCard title="Orders Intake" subtitle={`New customer orders vs repeat reorders ratio (${getPeriodLabel()})`} icon={icons.inbox}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <OpsKpiCard
                    label={t('New Orders Intake')}
                    value={stats?.newOrdersCount ?? 0}
                    color="#06b6d4"
                    unit="ORDERS"
                    progress={((stats?.newOrdersCount || 0) + (stats?.oldOrdersCount || 0)) ? Math.round(((stats?.newOrdersCount || 0) / ((stats?.newOrdersCount || 0) + (stats?.oldOrdersCount || 0))) * 100) : 0}
                    progressLabel={t('Share of Total Intake')}
                  />
                  <OpsKpiCard
                    label={t('Old Orders Intake')}
                    value={stats?.oldOrdersCount ?? 0}
                    color="#f59e0b"
                    unit="ORDERS"
                    progress={((stats?.newOrdersCount || 0) + (stats?.oldOrdersCount || 0)) ? Math.round(((stats?.oldOrdersCount || 0) / ((stats?.newOrdersCount || 0) + (stats?.oldOrdersCount || 0))) * 100) : 0}
                    progressLabel={t('Share of Total Intake')}
                  />
                </div>
              </SectionCard>
            </div>

            {/* Fulfillment Revenue Summary */}
            <SectionCard title="Fulfillment Revenue Breakdown" subtitle={`Delivered orders count and financial realization (${getPeriodLabel()})`} icon={icons.dollar}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <OpsKpiCard
                  label={`Total Delivered Count`}
                  value={stats?.deliveredCount ?? 0}
                  color="#10b981"
                  unit="DELIVERIES"
                  icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>}
                  progressLabel={`Completed shipments in selected timeframe`}
                />
                <OpsKpiCard
                  label={`Total Realized Revenue`}
                  value={`₹${(stats?.deliveredRevenue || 0).toLocaleString('en-IN')}`}
                  color="#0d9488"
                  unit="REVENUE"
                  icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>}
                  progressLabel={`Actual revenue collected from delivered orders`}
                />
              </div>
            </SectionCard>

            {/* ═══ Monthly Shipment Performance & RTO Analytics ═══ */}
            <SectionCard title="Monthly Shipment Performance & RTO Analytics" subtitle="Real-time delivery rates, RTO tracking, and active in-transit fulfillment pulse across all logistics partners (Current Month)" icon={icons.packageCheck}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <OpsKpiCard
                  label="Total Dispatched (Month)"
                  value={stats?.monthlyShipments?.dispatched ?? 0}
                  color="#3b82f6"
                  unit="THIS MONTH"
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>}
                  progressLabel={`Total orders processed & shipped this month`}
                  onClick={canManage ? () => navigate('/shiprocket/orders') : undefined}
                />
                <OpsKpiCard
                  label="Monthly Delivery Rate"
                  value={`${stats?.monthlyShipments?.deliveryRate ?? 0}%`}
                  color="#10b981"
                  unit="DELIVERED"
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
                  progressLabel={`${stats?.monthlyShipments?.delivered ?? 0} successfully delivered out of ${stats?.monthlyShipments?.dispatched ?? 0} dispatched`}
                  onClick={canManage ? () => navigate('/shiprocket/orders') : undefined}
                />
                <OpsKpiCard
                  label="Monthly RTO Rate"
                  value={`${stats?.monthlyShipments?.rtoRate ?? 0}%`}
                  color="#ef4444"
                  unit="RTO RATE"
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>}
                  progressLabel={`${stats?.monthlyShipments?.rto ?? 0} returned to origin out of ${stats?.monthlyShipments?.dispatched ?? 0} dispatched`}
                  onClick={canManage ? () => navigate('/shiprocket-returns') : undefined}
                />
                <OpsKpiCard
                  label="Active In Transit"
                  value={stats?.monthlyShipments?.inTransit ?? 0}
                  color="#f59e0b"
                  unit="IN TRANSIT"
                  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
                  progressLabel={`${stats?.monthlyShipments?.inTransitCount ?? 0} in transit · ${stats?.monthlyShipments?.ofdCount ?? 0} out for delivery (ShipMaxx)`}
                  onClick={canManage ? () => navigate('/shiprocket/orders') : undefined}
                />
              </div>
            </SectionCard>

          </div>
        )}

        {/* ═══ Tab 3: Earnings & Trend ═══ */}
        {activeTab === 'trends' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <SectionCard
                title="Company Earnings"
                subtitle="Monthly dynamic financial remuneration overview"
                icon={icons.dollar}
                action={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button onClick={() => setCommMonth(p => {
                      const m = p.month - 1;
                      return m < 0 ? { month: 11, year: p.year - 1 } : { month: m, year: p.year };
                    })} style={{ width: 28, height: 28, borderRadius: 8, background: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg></button>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', minWidth: 74, textAlign: 'center', textTransform: 'uppercase' }}>
                      {new Date(commMonth.year, commMonth.month).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                    </span>
                    <button onClick={() => setCommMonth(p => {
                      const m = p.month + 1;
                      return m > 11 ? { month: 0, year: p.year + 1 } : { month: m, year: p.year };
                    })} style={{ width: 28, height: 28, borderRadius: 8, background: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg></button>
                  </div>
                }
              >
                {commLoading ? (
                  <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : commission ? (
                  <div className="space-y-4">
                    {canManage && (
                      <div className="bg-emerald-600 rounded-2xl p-5 text-center shadow-lg border border-emerald-500/50" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                        <p className="text-2xl font-black text-white">₹{(commission.revenue || 0).toLocaleString('en-IN')}</p>
                        <p className="text-[10px] text-emerald-100 font-extrabold uppercase tracking-widest mt-1">Total Generated Revenue</p>
                      </div>
                    )}
                    <div className="bg-slate-900 rounded-2xl p-5 text-center shadow-lg border border-slate-800">
                      <p className="text-2xl font-black text-white">₹{(commission.totalPay || 0).toLocaleString('en-IN')}</p>
                      <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mt-1">Total Payouts Remittance</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-100">
                        <p className="text-lg font-black text-emerald-600">₹{(commission.basePay || 0).toLocaleString('en-IN')}</p>
                        <p className="text-[10px] text-emerald-700 font-bold uppercase mt-0.5">Base Pay</p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-100">
                        <p className="text-lg font-black text-amber-600">₹{(commission.totalCommission || 0).toLocaleString('en-IN')}</p>
                        <p className="text-[10px] text-amber-700 font-bold uppercase mt-0.5">Commission</p>
                      </div>
                    </div>
                  </div>
                ) : <p className="text-xs text-gray-400 text-center py-8">No earnings record found</p>}
              </SectionCard>
            </div>

            <div className="lg:col-span-2">
              <SectionCard
                title="Company Activity Trend"
                subtitle="Daily verification velocity throughout the ongoing month"
                icon={icons.chart}
                action={
                  monthlyChart.length > 0 && (
                    <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200 flex items-center gap-1.5">
                      {icons.lightning} {monthlyChart.reduce((s, d) => s + d.count, 0)} Total Verifications
                    </span>
                  )
                }
              >
                {monthlyChart.length > 0 ? (
                  <div className="h-64 relative group px-4 py-2 mt-4">
                    {(() => {
                      const max = Math.max(...monthlyChart.map(d => d.count), 5);
                      const todayDay = new Date().getDate();
                      const points = monthlyChart.map((d, i) => {
                        const x = (i / (monthlyChart.length - 1)) * 100;
                        const y = 92 - (d.count / max) * 84;
                        return `${x},${y}`;
                      }).join(' L ');

                      return (
                        <>
                          {/* Y-axis labels */}
                          <div className="absolute left-0 top-0 bottom-8 w-8 flex flex-col justify-between py-1 pointer-events-none z-10 text-right pr-2">
                            <span className="text-[10px] font-bold text-slate-400">{max}</span>
                            <span className="text-[10px] font-bold text-slate-400">{Math.round(max / 2)}</span>
                            <span className="text-[10px] font-bold text-slate-400">0</span>
                          </div>
                          
                          <svg className="w-full h-52 overflow-visible pl-6" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="trendChartGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#16a34a" stopOpacity="0.25" />
                                <stop offset="100%" stopColor="#16a34a" stopOpacity="0" />
                              </linearGradient>
                            </defs>
                            {[0, 25, 50, 75, 100].map(v => (
                              <line key={v} x1="0" y1={v} x2="100" y2={v} stroke="#f1f5f9" strokeWidth="0.6" />
                            ))}
                            <path d={`M 0 100 L ${points} L 100 100 Z`} fill="url(#trendChartGrad)" />
                            <path d={`M ${points}`} fill="none" stroke="#16a34a" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>

                          <div className="absolute inset-0 pl-6 flex pb-8">
                            {monthlyChart.map((d, i) => (
                              <div key={i} className="flex-1 group/dot relative h-full">
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2.5 py-1.5 rounded-lg opacity-0 group-hover/dot:opacity-100 transition-opacity z-20 whitespace-nowrap pointer-events-none shadow-xl border border-slate-700">
                                  <span className="text-slate-400">{new Date(new Date().getFullYear(), new Date().getMonth(), d.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>{' '}
                                  <span className="font-extrabold text-white">{d.count} {d.count === 1 ? 'verif' : 'verif'}</span>
                                </div>
                                <div
                                  className={`absolute w-3 h-3 rounded-full border-2 border-white shadow-md transition-all ${d.day === todayDay
                                    ? 'bg-emerald-500 opacity-100 scale-110 ring-4 ring-emerald-500/20'
                                    : 'bg-emerald-500 opacity-0 group-hover/dot:opacity-100 scale-0 group-hover/dot:scale-125'
                                    }`}
                                  style={{
                                    left: '50%',
                                    bottom: `${8 + (d.count / max) * 84}%`,
                                    transform: 'translate(-50%, 50%)'
                                  }}
                                />
                              </div>
                            ))}
                          </div>

                          {/* X-axis week marker labels */}
                          <div className="mt-4 flex items-center justify-between pl-6 border-t border-slate-100 pt-3">
                            {[1, 7, 14, 21, 28].filter(d => d <= monthlyChart.length).map(d => (
                              <span key={d} className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                                {d} {new Date().toLocaleString('default', { month: 'short' })}
                              </span>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-slate-400 text-xs font-semibold">No monthly trend data available</div>
                )}
              </SectionCard>
            </div>
          </div>
        )}

        {/* ═══ Tab 4: Shipment Analytics Panel (Admin/Manager Only) ═══ */}
        {activeTab === 'analytics' && canManage && (
          <SectionCard title="Live Shipment Analytics & Logistics" subtitle="Deep dive logistics tracking, courier performance, and NDR status monitoring" icon={icons.truck}>
            <div className="mt-2">
              <ShipmentAnalyticsPanel department={department} />
            </div>
          </SectionCard>
        )}

        {/* ═══ Tab 6: Employee Performance Breakdown (Admin/Manager Only) ═══ */}
        {activeTab === 'staff_performance' && canManage && (
          <EmployeePerformanceSection
            allStaffData={allStaffData}
            staffBreakdownData={staffBreakdownData}
            datePreset={datePreset}
            filterFrom={filterFrom}
            filterTo={filterTo}
            department={department}
            getPeriodLabel={getPeriodLabel}
            icons={icons}
          />
        )}

        {/* ═══ Tab 5: My Activity Detail Lists (Sales Staff Only) ═══ */}
        {activeTab === 'my_lists' && user?.role === 'sales' && (
          <SectionCard title="Staff Activity Detail Archive" subtitle={`Detailed breakdowns and contact logs for ${getPeriodLabel()}`} icon={icons.clipboard}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-2">
              {[
                { key: 'cnp', label: `CNP List (${getPeriodLabel()})`, icon: icons.cnp, color: '#ef4444', bg: '#fef2f2', border: '#fecaca', list: todayLists.cnpList },
                { key: 'callAgain', label: `Call Again List (${getPeriodLabel()})`, icon: icons.callAgain, color: '#d97706', bg: '#fffbeb', border: '#fde68a', list: todayLists.callAgainList },
                { key: 'interested', label: `Interested List (${getPeriodLabel()})`, icon: icons.interested, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', list: todayLists.interestedList },
                { key: 'onHold', label: `On Hold List (${getPeriodLabel()})`, icon: icons.onHold, color: '#b45309', bg: '#fef3c7', border: '#fcd34d', list: todayLists.onHoldList },
                { key: 'notInterested', label: `Not Interested List (${getPeriodLabel()})`, icon: icons.notInterested, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', list: todayLists.notInterestedList },
              ].map(({ key, label, icon, color, bg, border, list }) => (
                <div
                  key={key}
                  style={{ background: '#fff', borderRadius: 14, border: `1px solid ${border}`, padding: '16px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
                >
                  <button className="w-full flex items-center justify-between cursor-pointer"
                    onClick={() => setOpenSection(openSection === key ? null : key)}>
                    <div className="flex items-center gap-3">
                      <span style={{ width: 36, height: 36, borderRadius: 10, background: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {icon}
                      </span>
                      <span className="text-sm font-extrabold text-slate-800">{label}</span>
                      <span style={{ background: bg, color: color, border: `1px solid ${border}`, fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 20 }}>
                        {list.length}
                      </span>
                    </div>
                    <span className="text-slate-400">{openSection === key ? icons.chevronUp : icons.chevronDown}</span>
                  </button>
                  {openSection === key && (
                    <div className="mt-4 divide-y divide-slate-100 max-h-80 overflow-y-auto pr-2 custom-scrollbar border-t border-slate-100 pt-3">
                      {list.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-8 font-semibold">No records found for {getPeriodLabel()}</p>
                      ) : list.map((item, i) => (
                        <div key={item._id} className="py-3 flex items-center gap-3 hover:bg-slate-50/70 rounded-lg px-2 transition-colors">
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-extrabold text-slate-800 truncate">{item.title || item.lead?.name || '—'}</p>
                            <div className="flex gap-3 mt-1">
                              {item.assignedTo?.name && <span className="text-[10px] text-blue-600 font-bold flex items-center gap-1">{icons.user} {item.assignedTo.name}</span>}
                              {item.lead?.phone && <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">{icons.phone} {item.lead.phone}</span>}
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold shrink-0">
                            {new Date(item.createdAt || item.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        )}

      </div>
    </div>
  );
}
