import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import API from '../api';
import { 
  fetchStats, 
  fetchStaffStats,
  saveStaffTarget, 
  fetchStaffTodayLists, 
  fetchStaffMonthlyChart, 
  fetchStaffCommission,
  fetchTargetHistory,
  fetchMyDeliveryStats
} from '../services/dashboard.service';
import { markCNP } from '../services/lead.service';
import { useToast } from '../context/ToastContext';
import * as attendanceSvc from '../services/attendance.service';

/* ─── Live Working Timer Hook ──────────────────────────────────── */
function useLiveTimer(checkInTime) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!checkInTime) return;
    const update = () => {
      const diff = Math.floor((Date.now() - new Date(checkInTime)) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(`${h}h ${m}m ${String(s).padStart(2,'0')}s`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [checkInTime]);
  return elapsed;
}

const cardCls = "bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow";
const cardStyle = { border: '1px solid rgba(0,0,0,0.06)' };

/* ─── RTO Reason Badge Helper ──────────────────────────────────── */
function RtoReasonBadge({ reason }) {
  if (!reason) return null;
  const r = reason.toLowerCase();
  let badgeCls = 'bg-rose-50 text-rose-700 border-rose-200';

  if (r.includes('unreachable') || r.includes('phone') || r.includes('switch') || r.includes('answer')) {
    badgeCls = 'bg-amber-50 text-amber-800 border-amber-200';
  } else if (r.includes('address') || r.includes('location')) {
    badgeCls = 'bg-orange-50 text-orange-800 border-orange-200';
  } else if (r.includes('cash') || r.includes('cod') || r.includes('money')) {
    badgeCls = 'bg-purple-50 text-purple-800 border-purple-200';
  } else if (r.includes('reschedule') || r.includes('tomorrow') || r.includes('later')) {
    badgeCls = 'bg-blue-50 text-blue-800 border-blue-200';
  } else if (r.includes('courier') || r.includes('issue') || r.includes('fake') || r.includes('attempt')) {
    badgeCls = 'bg-slate-50 text-slate-800 border-slate-200';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border shadow-2xs ${badgeCls}`}>
      {reason}
    </span>
  );
}

function MyDeliveryScoreCard({ user, myDelivery, deliveryMonth, setDeliveryMonth, selectedStaffFilter, setSelectedStaffFilter, deliveryLoading, cardCls, cardStyle, onRefresh }) {
  const [openList, setOpenList] = useState(null);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const [expandedRemarks, setExpandedRemarks] = useState({});

  const toggleRemarks = (orderId) => {
    setExpandedRemarks(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const list = openList === 'ready_to_ship' ? (myDelivery?.readyToShipOrders || []) :
               openList === 'new_delivered' ? (myDelivery?.newDeliveredOrders || myDelivery?.deliveredOrders || []) :
               openList === 'old_delivered' ? (myDelivery?.oldDeliveredOrders || []) :
               openList === 'delivered' ? (myDelivery?.deliveredOrders || []) : 
               (myDelivery?.rtoOrders || []);

  const filtered = list.filter(o =>
    o.name?.toLowerCase().includes(search.toLowerCase()) ||
    o.phone?.includes(search) ||
    o.awb?.toLowerCase().includes(search.toLowerCase()) ||
    o.city?.toLowerCase().includes(search.toLowerCase()) ||
    o.status?.toLowerCase().includes(search.toLowerCase()) ||
    o.delivery_boy_reason?.toLowerCase().includes(search.toLowerCase()) ||
    o.logistics_remark?.toLowerCase().includes(search.toLowerCase()) ||
    o.admin_remark?.toLowerCase().includes(search.toLowerCase()) ||
    o.rto_reason?.toLowerCase().includes(search.toLowerCase()) ||
    o.rto_added_by?.toLowerCase().includes(search.toLowerCase()) ||
    o.staff_name?.toLowerCase().includes(search.toLowerCase())
  );

  const isAdminOrManager = ['admin', 'manager'].includes(user?.role);
  const isSales = user?.role === 'sales' || isAdminOrManager;

  const currentStaffObj = (myDelivery?.staff || []).find(s => String(s.user._id) === String(selectedStaffFilter));

  const sendWaRecovery = (phone, name) => {
    const clean = String(phone || '').replace(/\D/g, '').slice(-10);
    if (!clean) return;
    const text = encodeURIComponent(`Namaste ${name || 'ji'}, Triven Ayurveda se aapka parcel deliver karne delivery boy aaya tha lekin return ho raha hai. Kya hum parcel ka re-attempt karwayen? Kripya bataiye.`);
    window.open(`https://wa.me/91${clean}?text=${text}`, '_blank');
  };

  return (
    <div className={cardCls} style={cardStyle}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100/60 shadow-xs">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div>
            <h3 className="text-sm font-black text-gray-800 tracking-tight flex items-center gap-2 flex-wrap">
              <span>Delivery Score & Attribution</span>
              {myDelivery?.totalCommission !== undefined && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono">
                  Delivered Comm: ₹{(myDelivery?.totalCommission ?? 0).toLocaleString('en-IN')}
                </span>
              )}
              {isAdminOrManager && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200">
                  {selectedStaffFilter === 'all' ? 'All Staff View' : `${currentStaffObj?.user?.name || 'Staff'}`}
                </span>
              )}
            </h3>
            <p className="text-[11px] text-gray-400">
              {isAdminOrManager
                ? 'Company-wide delivery performance, RTO analytics & individual staff attribution'
                : (isSales ? 'Track your 1st kit sales vs repeat customer deliveries & RTO reasons' : 'Re-order verifications delivered by you with RTO analytics')}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          {/* Staff Filter Dropdown for Admin & Manager */}
          {isAdminOrManager && myDelivery?.staff && myDelivery.staff.length > 0 && (
            <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-xl border border-gray-200 shadow-2xs">
              <span className="text-[10px] font-black text-gray-500 uppercase px-1.5">Staff:</span>
              <select
                value={selectedStaffFilter || 'all'}
                onChange={e => setSelectedStaffFilter(e.target.value)}
                className="text-xs font-bold border-none rounded-lg px-2 py-1 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-xs cursor-pointer"
              >
                <option value="all">All Staff ({myDelivery?.totalRto ?? myDelivery?.rto ?? 0} RTOs / {myDelivery?.totalDelivered ?? myDelivery?.delivered ?? 0} Del)</option>
                {myDelivery.staff.map(s => (
                  <option key={String(s.user._id)} value={String(s.user._id)}>
                    {s.user.name} ({s.rto} RTOs / {s.delivered} Del)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Month Navigator */}
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-100">
            <button onClick={() => setDeliveryMonth(p => { const m = p.month - 1; return m < 0 ? { month: 11, year: p.year - 1 } : { month: m, year: p.year }; })}
              className="w-7 h-7 rounded-lg bg-white shadow-xs flex items-center justify-center text-gray-600 hover:bg-gray-100 transition">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span className="text-[11px] font-black min-w-[85px] text-center text-gray-700 uppercase tracking-tight">
              {new Date(deliveryMonth.year, deliveryMonth.month).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
            </span>
            <button onClick={() => setDeliveryMonth(p => { const m = p.month + 1; return m > 11 ? { month: 0, year: p.year + 1 } : { month: m, year: p.year }; })}
              className="w-7 h-7 rounded-lg bg-white shadow-xs flex items-center justify-center text-gray-600 hover:bg-gray-100 transition">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          {/* Quick Refresh Button */}
          <button
            onClick={() => onRefresh?.()}
            title="Refresh delivery stats"
            className={`w-8 h-8 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600 transition shadow-2xs cursor-pointer ${
              deliveryLoading ? 'opacity-60 pointer-events-none' : ''
            }`}
          >
            <svg className={`w-3.5 h-3.5 ${deliveryLoading ? 'animate-spin text-emerald-600' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {deliveryLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {/* READY TO SHIP */}
          <button onClick={() => { setOpenList(openList === 'ready_to_ship' ? null : 'ready_to_ship'); setSearch(''); }}
            className={`rounded-2xl border p-4 text-center transition-all hover:shadow-md active:scale-95 text-left cursor-pointer flex flex-col justify-between ${
              openList === 'ready_to_ship' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-blue-50/70 border-blue-200/60 hover:border-blue-300'
            }`}>
            <div>
              <p className={`text-3xl font-black leading-none ${openList === 'ready_to_ship' ? 'text-white' : 'text-blue-700'}`}>
                {myDelivery?.readyToShip ?? 0}
              </p>
              <p className={`text-[10px] font-black uppercase tracking-widest mt-1.5 ${openList === 'ready_to_ship' ? 'text-blue-100' : 'text-blue-700'}`}>
                Ready to Ship
              </p>
            </div>
            <div className={`mt-3 pt-2 border-t flex items-center justify-between text-[11px] font-black ${
              openList === 'ready_to_ship' ? 'border-blue-500/60 text-white' : 'border-blue-200/70 text-blue-700'
            }`}>
              <span className="text-[9px] uppercase tracking-wider font-bold opacity-80">Pending Dispatch</span>
              <span className="text-[10px] font-black">View</span>
            </div>
          </button>

          {isSales ? (
            <>
              {/* NEW DELIVERED */}
              <button onClick={() => { setOpenList(openList === 'new_delivered' ? null : 'new_delivered'); setSearch(''); }}
                className={`rounded-2xl border p-4 text-center transition-all hover:shadow-md active:scale-95 text-left cursor-pointer flex flex-col justify-between ${
                  openList === 'new_delivered' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-emerald-50/70 border-emerald-200/60 hover:border-emerald-300'
                }`}>
                <div>
                  <p className={`text-3xl font-black leading-none ${openList === 'new_delivered' ? 'text-white' : 'text-emerald-700'}`}>
                    {myDelivery?.newDelivered ?? myDelivery?.delivered ?? 0}
                  </p>
                  <p className={`text-[10px] font-black uppercase tracking-widest mt-1.5 ${openList === 'new_delivered' ? 'text-emerald-100' : 'text-emerald-700'}`}>
                    New Delivered
                  </p>
                </div>
                <div className={`mt-3 pt-2 border-t flex items-center justify-between text-[11px] font-black ${
                  openList === 'new_delivered' ? 'border-emerald-500/60 text-white' : 'border-emerald-200/70 text-emerald-800'
                }`}>
                  <span className="text-[9px] uppercase tracking-wider font-bold opacity-80">Salary / Comm:</span>
                  <span className="font-mono font-black text-xs">₹{(myDelivery?.newCommissionTotal ?? 0).toLocaleString('en-IN')}</span>
                </div>
              </button>
              
              {/* OLD DELIVERED */}
              <button onClick={() => { setOpenList(openList === 'old_delivered' ? null : 'old_delivered'); setSearch(''); }}
                className={`rounded-2xl border p-4 text-center transition-all hover:shadow-md active:scale-95 text-left cursor-pointer flex flex-col justify-between ${
                  openList === 'old_delivered' ? 'bg-purple-600 border-purple-600 text-white' : 'bg-purple-50/70 border-purple-200/60 hover:border-purple-300'
                }`}>
                <div>
                  <p className={`text-3xl font-black leading-none ${openList === 'old_delivered' ? 'text-white' : 'text-purple-700'}`}>
                    {myDelivery?.oldDelivered ?? 0}
                  </p>
                  <p className={`text-[10px] font-black uppercase tracking-widest mt-1.5 ${openList === 'old_delivered' ? 'text-purple-100' : 'text-purple-700'}`}>
                    Old Delivered
                  </p>
                </div>
                <div className={`mt-3 pt-2 border-t flex items-center justify-between text-[11px] font-black ${
                  openList === 'old_delivered' ? 'border-purple-500/60 text-white' : 'border-purple-200/70 text-purple-800'
                }`}>
                  <span className="text-[9px] uppercase tracking-wider font-bold opacity-80">Salary / Comm:</span>
                  <span className="font-mono font-black text-xs">₹{(myDelivery?.oldCommissionTotal ?? 0).toLocaleString('en-IN')}</span>
                </div>
              </button>
            </>
          ) : (
            <button onClick={() => { setOpenList(openList === 'old_delivered' ? null : 'old_delivered'); setSearch(''); }}
              className={`rounded-2xl border p-4 text-center transition-all hover:shadow-md active:scale-95 text-left cursor-pointer flex flex-col justify-between ${
                openList === 'old_delivered' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-indigo-50/70 border-indigo-200/60 hover:border-indigo-300'
              }`}>
              <div>
                <p className={`text-3xl font-black leading-none ${openList === 'old_delivered' ? 'text-white' : 'text-indigo-700'}`}>
                  {myDelivery?.oldDelivered ?? myDelivery?.delivered ?? 0}
                </p>
                <p className={`text-[10px] font-black uppercase tracking-widest mt-1.5 ${openList === 'old_delivered' ? 'text-indigo-100' : 'text-indigo-700'}`}>
                  Re-Verifications
                </p>
              </div>
              <div className={`mt-3 pt-2 border-t flex items-center justify-between text-[11px] font-black ${
                openList === 'old_delivered' ? 'border-indigo-500/60 text-white' : 'border-indigo-200/70 text-indigo-800'
              }`}>
                <span className="text-[9px] uppercase tracking-wider font-bold opacity-80">Salary / Comm:</span>
                <span className="font-mono font-black text-xs">₹{(myDelivery?.oldCommissionTotal ?? 0).toLocaleString('en-IN')}</span>
              </div>
            </button>
          )}

          {/* RTO CARD WITH REASON PROMPT */}
          <button onClick={() => { setOpenList(openList === 'rto' ? null : 'rto'); setSearch(''); }}
            className={`rounded-2xl border p-4 text-center transition-all hover:shadow-md active:scale-95 text-left cursor-pointer relative overflow-hidden flex flex-col justify-between ${
              openList === 'rto'
                ? 'bg-rose-600 border-rose-600 text-white'
                : (myDelivery?.rto ?? 0) > 0 ? 'bg-rose-50/70 border-rose-200 hover:border-rose-300' : 'bg-gray-50 border-gray-100'
            }`}>
            <div>
              <p className={`text-3xl font-black leading-none ${
                openList === 'rto' ? 'text-white' : (myDelivery?.rto ?? 0) > 0 ? 'text-rose-700' : 'text-gray-300'
              }`}>{myDelivery?.rto ?? 0}</p>
              <p className={`text-[10px] font-black uppercase tracking-widest mt-1.5 ${
                openList === 'rto' ? 'text-rose-100' : (myDelivery?.rto ?? 0) > 0 ? 'text-rose-700' : 'text-gray-400'
              }`}>
                RTO (Returns)
              </p>
            </div>
            <div className={`mt-3 pt-2 border-t flex items-center justify-between text-[11px] font-black ${
              openList === 'rto' ? 'border-rose-500/60 text-white' : (myDelivery?.rto ?? 0) > 0 ? 'border-rose-200/70 text-rose-700' : 'border-gray-200 text-gray-400'
            }`}>
              <span className="text-[9px] uppercase tracking-wider font-bold opacity-80">Lost Returns</span>
              {(myDelivery?.rto ?? 0) > 0 && <span className="text-[10px] font-black underline">View Reasons</span>}
            </div>
          </button>

          {/* TOTAL */}
          <div className="rounded-2xl bg-gray-900 p-4 text-center flex flex-col justify-between text-left shadow-sm">
            <div>
              <p className="text-3xl font-black text-white leading-none">
                {(myDelivery?.readyToShip ?? 0) + (myDelivery?.delivered ?? 0) + (myDelivery?.rto ?? 0)}
              </p>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1.5">Total Activity</p>
            </div>
            <div className="mt-3 pt-2 border-t border-gray-800 flex items-center justify-between text-[11px] font-black text-emerald-400">
              <span className="text-[9px] uppercase tracking-wider font-bold text-gray-400">Total Comm:</span>
              <span className="font-mono font-black text-xs">₹{(myDelivery?.totalCommission ?? 0).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Expandable order drilldown with RTO Reasons */}
      {openList && (
        <div className="mt-5 border-t border-gray-100 pt-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search patient, phone, AWB, or reason..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 bg-gray-50 focus:bg-white transition"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black px-2.5 py-1.5 rounded-xl border ${
                openList === 'rto' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                openList === 'ready_to_ship' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>{filtered.length} orders shown</span>
              <button onClick={() => setOpenList(null)} className="text-[11px] font-bold text-gray-400 hover:text-gray-600 px-2 cursor-pointer">
                Close
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-2.5">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">No orders found in this category</p>
            ) : filtered.map((o) => (
              <div key={String(o._id)} className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5 hover:bg-white hover:border-gray-200 transition shadow-2xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-black text-gray-900 truncate">{o.name}</p>
                      {o.staff_name && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-2xs">
                          <span className="text-gray-500 font-medium">Staff: </span>
                          <span className="font-black text-indigo-900">{o.staff_name}</span>
                        </span>
                      )}
                      {o.courier && o.courier !== '—' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-200/70 text-gray-700 uppercase">{o.courier}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[11px] font-medium text-gray-600">{o.phone}</span>
                      {o.awb !== '—' && (
                        <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 font-bold">
                          AWB: {o.awb}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-gray-900">₹{o.amount.toLocaleString('en-IN')}</p>
                    {o.commission !== undefined && o.commission !== null && Number(o.commission) > 0 && (
                      <p className="text-[10px] font-black font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-0.5">
                        +₹{Number(o.commission).toLocaleString('en-IN')} Comm
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-0.5 font-medium">
                      {o.date ? new Date(o.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                    </p>
                  </div>
                </div>

                {/* READY TO SHIP DETAIL & ACTIONS */}
                {openList === 'ready_to_ship' && (
                  <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                        {o.status || 'Ready to Ship'}
                      </span>
                      {o.city && (
                        <span className="text-[10px] text-gray-500 font-medium">
                          Location: {o.city}{o.state ? `, ${o.state}` : ''}
                        </span>
                      )}
                    </div>
                    {o.phone && o.phone !== '—' && (
                      <div className="flex items-center gap-1.5 ml-auto">
                        <a href={`tel:${o.phone}`} className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[10px] font-black transition shadow-2xs">
                          Call
                        </a>
                        <button onClick={() => {
                          const clean = String(o.phone).replace(/\D/g, '').slice(-10);
                          window.open(`https://wa.me/91${clean}?text=${encodeURIComponent(`Namaste ${o.name} ji, Triven Ayurveda se aapke order ke regarding sampark kiya ja raha hai.`)}`, '_blank');
                        }} className="px-2.5 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700 text-[10px] font-black transition cursor-pointer shadow-2xs">
                          WhatsApp
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* RTO REASON & REMARKS DISPLAY */}
                {openList === 'rto' && (
                  <div className="mt-3 pt-2.5 border-t border-gray-100 space-y-2.5">
                    
                    {/* Header line: RTO Reason Badge, Verified by, and Quick Actions */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">RTO Reason:</span>
                        <RtoReasonBadge reason={o.rto_reason || 'Return to Origin'} />
                        {o.verified_by_name && (
                          <span className="text-[10px] text-gray-500 font-bold bg-gray-100 px-2 py-0.5 rounded-md">
                            Verified by: <span className="text-gray-800">{o.verified_by_name}</span>
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1.5 ml-auto">
                        {o.phone && o.phone !== '—' && (
                          <>
                            <a href={`tel:${o.phone}`} className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[10px] font-black transition shadow-2xs">
                              Call
                            </a>
                            <button onClick={() => sendWaRecovery(o.phone, o.name)} className="px-2.5 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700 text-[10px] font-black transition cursor-pointer shadow-2xs">
                              WhatsApp
                            </button>
                          </>
                        )}
                        <button onClick={() => navigate('/verification')} className="px-2.5 py-1 rounded-lg bg-gray-900 text-white hover:bg-gray-800 text-[10px] font-black transition cursor-pointer shadow-2xs">
                          Re-Attempt
                        </button>
                      </div>
                    </div>

                    {/* Unified Clean Intelligence Feed (One single elegant container) */}
                    <div className="rounded-xl border border-gray-200/80 bg-white overflow-hidden shadow-2xs divide-y divide-gray-100">
                      
                      {/* 1. Delivery Boy Reason */}
                      {o.delivery_boy_reason && (() => {
                        const raw = o.delivery_boy_reason;
                        const match = raw.match(/^(.*?)\s*\((.*)\)\s*$/);
                        const reasonText = match ? match[1].trim() : raw;
                        const locText = match ? match[2].replace(/_/g, ' ') : null;
                        return (
                          <div className="p-2.5 hover:bg-amber-50/20 transition">
                            <div className="flex items-center justify-between gap-2 flex-wrap mb-0.5">
                              <span className="text-[10px] font-black uppercase tracking-wider text-amber-900">
                                Delivery Boy Reason
                              </span>
                              {o.courier && o.courier !== '—' && (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 uppercase">
                                  {o.courier}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-black text-gray-900 leading-snug">
                              {reasonText}
                            </p>
                            {locText && (
                              <p className="text-[10px] text-gray-500 font-medium mt-0.5">
                                Location: {locText}
                              </p>
                            )}
                          </div>
                        );
                      })()}

                      {/* 2. Logistics Team Note */}
                      {o.logistics_remark && (
                        <div className="p-2.5 hover:bg-blue-50/20 transition">
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-black uppercase tracking-wider text-blue-900">
                                Logistics Team Note
                              </span>
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                                {o.logistics_added_by || 'Logistics'}
                              </span>
                            </div>
                            {o.logistics_added_at && (
                              <span className="text-[10px] text-gray-400 font-medium">
                                {new Date(o.logistics_added_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-gray-800 leading-snug mt-0.5">
                            "{o.logistics_remark}"
                          </p>
                        </div>
                      )}

                      {/* 3. Admin / Verification Note */}
                      {o.admin_remark && (
                        <div className="p-2.5 hover:bg-purple-50/20 transition">
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-black uppercase tracking-wider text-purple-900">
                                Admin / Verification Note
                              </span>
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-100">
                                {o.admin_added_by || 'Admin'}
                              </span>
                            </div>
                            {o.admin_added_at && (
                              <span className="text-[10px] text-gray-400 font-medium">
                                {new Date(o.admin_added_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-gray-800 leading-snug mt-0.5">
                            "{o.admin_remark}"
                          </p>
                        </div>
                      )}

                      {/* Fallback legacy remark if neither exists */}
                      {!o.logistics_remark && !o.admin_remark && o.rto_remark && o.rto_remark !== o.delivery_boy_reason && (
                        <div className="p-2.5 hover:bg-slate-50 transition">
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-0.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                              ShipMaxx Note · {o.rto_added_by || 'Staff'}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-gray-800">
                            "{o.rto_remark}"
                          </p>
                        </div>
                      )}

                      {/* Timeline Footer with counter and expand toggle */}
                      {o.rto_remarks_history?.length > 1 && (
                        <div className="p-2 bg-gray-50/70 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-gray-500 font-medium pl-1">
                            {o.rto_remarks_history.length} follow-up remarks recorded
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleRemarks(String(o._id))}
                            className="text-[10px] font-black text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2.5 py-0.5 rounded-md border border-blue-200 transition cursor-pointer"
                          >
                            {expandedRemarks[String(o._id)] ? 'Hide Timeline' : `View All (${o.rto_remarks_history.length})`}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Expandable remarks timeline history */}
                    {expandedRemarks[String(o._id)] && o.rto_remarks_history?.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 mt-1.5 shadow-2xs">
                        <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest flex items-center justify-between">
                          <span>Full ShipMaxx Follow-up Timeline ({o.rto_remarks_history.length} Entries)</span>
                          <span className="text-[9px] font-semibold text-slate-500 normal-case">Chronological order</span>
                        </p>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                          {o.rto_remarks_history.map((rh, rIdx) => (
                            <div key={rIdx} className="bg-white p-2 rounded-lg border border-slate-200 text-xs shadow-2xs">
                              <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-slate-500 mb-0.5">
                                <span className="text-blue-700 font-black">
                                  {rh.addedBy}
                                </span>
                                <span className="text-slate-400 font-medium">
                                  {rh.date ? new Date(rh.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                              </div>
                              <p className="text-slate-900 font-bold pl-1">"{rh.text}"</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Smart Next Lead (Priority Caller Station) ─────────────────── */
/* ─── Patient Name Cleaner Helper ───────────────────────────────── */
function getCleanPatientName(rawName, phone) {
  const n = (rawName || '').trim();
  const lower = n.toLowerCase();
  if (!n || lower === 'call' || lower === 'task' || lower === 'lead' || lower === 'customer' || lower === 'unknown') {
    return phone ? `Patient (${phone})` : 'Patient';
  }
  return n;
}

/* ─── Smart Next Lead (Priority Caller Station + 10/Page List View) ── */
function SmartNextLeadCard({ queueItems = [], onOpenItem, onMarkCnpSuccess }) {
  const [index, setIndex] = useState(0);
  const [viewMode, setViewMode] = useState('card'); // 'card' | 'list'
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [cnpLoadingId, setCnpLoadingId] = useState(null);
  const { success, error } = useToast();

  const PAGE_SIZE = 10;
  const total = queueItems.length;
  const current = total > 0 ? queueItems[index % total] : null;

  const next = () => setIndex(i => (i + 1) % Math.max(total, 1));
  const prev = () => setIndex(i => (i - 1 + total) % Math.max(total, 1));

  // Filtered items for list view
  const filteredList = useMemo(() => {
    let list = queueItems;
    if (filterType !== 'all') {
      list = list.filter(item => (item._queueType || '').toLowerCase() === filterType.toLowerCase());
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(item => {
        const name = (item.lead?.name || item.name || item.title || item.patientName || '').toLowerCase();
        const phone = (item.lead?.phone || item.phone || '');
        const prob = (item.problem || item.lead?.problem || '').toLowerCase();
        return name.includes(q) || phone.includes(q) || prob.includes(q);
      });
    }
    return list;
  }, [queueItems, filterType, searchTerm]);

  const totalPages = Math.ceil(filteredList.length / PAGE_SIZE) || 1;
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const paginatedList = filteredList.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (!current) {
    return (
      <div className="rounded-2xl p-5 bg-gradient-to-r from-emerald-950 via-teal-950 to-emerald-900 text-white shadow-lg flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-white">All Caught Up!</h3>
          <p className="text-xs text-emerald-200/70">No pending leads or callbacks waiting right now. Outstanding job!</p>
        </div>
      </div>
    );
  }

  const phone = current.lead?.phone || current.phone || '';
  const rawName = current.lead?.name || current.name || current.title || current.patientName || '';
  const displayName = getCleanPatientName(rawName, phone);
  const problem = current.problem || current.lead?.problem || '';
  const department = current.department || current.lead?.department || 'General';
  const location = current.cityVillage || current.lead?.cityVillage || current.state || current.lead?.state || '';
  const note = current.notes?.[current.notes.length - 1]?.text || current.description || current.lead?.note || '';

  const handleCnp = async (targetItem = current) => {
    const leadId = targetItem.lead?._id || targetItem.lead || targetItem._id;
    if (!leadId) return;
    setCnpLoadingId(String(leadId));
    const targetName = getCleanPatientName(targetItem.lead?.name || targetItem.name || targetItem.title || targetItem.patientName, targetItem.lead?.phone || targetItem.phone);
    try {
      await markCNP(leadId);
      success(`Marked ${targetName} as CNP (Not Picking)`, 'CNP Recorded');
      onMarkCnpSuccess?.();
      if (viewMode === 'card') next();
    } catch (err) {
      error(err.response?.data?.message || 'Failed to mark CNP');
    } finally {
      setCnpLoadingId(null);
    }
  };

  const handleWhatsApp = (targetItem = current) => {
    const targetPhone = targetItem.lead?.phone || targetItem.phone || '';
    const clean = String(targetPhone).replace(/\D/g, '').slice(-10);
    if (!clean) return;
    const targetName = getCleanPatientName(targetItem.lead?.name || targetItem.name || targetItem.title || targetItem.patientName, targetPhone);
    const text = encodeURIComponent(`Namaste ${targetName} ji, main Triven Ayurveda se baat kar raha hoon aapki health enquiry ke baare mein. Kya hum aapse abhi baat kar sakte hain?`);
    window.open(`https://wa.me/91${clean}?text=${text}`, '_blank');
  };

  return (
    <div className="rounded-2xl overflow-hidden bg-gradient-to-r from-gray-900 via-slate-900 to-gray-950 text-white border border-gray-800 shadow-xl relative transition-all duration-300">
      {/* ═══ Header Bar (Click to toggle list or card) ═══ */}
      <div className="px-6 py-4 bg-white/5 border-b border-white/5 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-black uppercase tracking-widest text-emerald-400">Smart Priority Lead</span>
          <button
            onClick={() => setViewMode(v => v === 'list' ? 'card' : 'list')}
            className="text-[10px] text-gray-300 hover:text-white font-bold bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-full border border-white/10 transition cursor-pointer flex items-center gap-1.5"
            title="Click to view all leads in list format"
          >
            <span>Lead {(index % total) + 1} of {total}</span>
            <span className="text-[9px] text-emerald-300 underline font-black">
              {viewMode === 'list' ? 'Hide List' : 'Open List'}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Button for List vs Card */}
          <button
            onClick={() => setViewMode(v => v === 'list' ? 'card' : 'list')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
              viewMode === 'list'
                ? 'bg-emerald-500 text-gray-950 hover:bg-emerald-400'
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              {viewMode === 'list' ? (
                <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              ) : (
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              )}
            </svg>
            <span>{viewMode === 'list' ? 'Single Card View' : `List View (10 / Page)`}</span>
          </button>

          {viewMode === 'card' && (
            <div className="flex items-center gap-1">
              <button onClick={prev} className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold transition cursor-pointer">Prev</button>
              <button onClick={next} className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-xs cursor-pointer">Next</button>
            </div>
          )}
        </div>
      </div>

      {/* ═══ VIEW MODE 1: SINGLE CARD VIEW ═══ */}
      {viewMode === 'card' && (
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-black text-white tracking-tight">{displayName}</h2>
                {current._queueType && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 uppercase">
                    {current._queueType}
                  </span>
                )}
                {department && (
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                    department.toLowerCase().includes('piles') ? 'bg-amber-500/20 text-amber-300 border-amber-400/30' : 'bg-purple-500/20 text-purple-300 border-purple-400/30'
                  }`}>{department}</span>
                )}
                {location && (
                  <span className="text-xs text-gray-400 font-medium">
                    {location}
                  </span>
                )}
              </div>

              <p className="text-emerald-400 font-mono text-sm font-bold tracking-wide">
                {phone || 'No phone attached'}
              </p>

              {problem && (
                <p className="text-xs text-gray-300 line-clamp-1">
                  <span className="font-semibold text-gray-200">Condition:</span> {problem}
                </p>
              )}

              {note && (
                <p className="text-xs text-amber-300/90 italic bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 line-clamp-2">
                  Last Note: "{note}"
                </p>
              )}
            </div>

            {/* Quick Execution Buttons */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {phone && (
                <a href={`tel:${phone}`} className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-black text-xs transition shadow-lg">
                  Call Now
                </a>
              )}
              <button onClick={() => handleWhatsApp(current)} className="px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-black text-xs transition shadow-lg cursor-pointer">
                WhatsApp
              </button>
              <button onClick={() => onOpenItem?.(current)} className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs transition shadow-lg cursor-pointer">
                Verify / Open
              </button>
              <button onClick={() => handleCnp(current)} disabled={cnpLoadingId === String(current.lead?._id || current._id)} className="px-3.5 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-black text-xs transition disabled:opacity-50 cursor-pointer">
                {cnpLoadingId === String(current.lead?._id || current._id) ? 'Saving...' : 'CNP'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ VIEW MODE 2: 10 ITEMS PER PAGE LIST VIEW ═══ */}
      {viewMode === 'list' && (
        <div className="p-5 space-y-4 animate-in fade-in duration-200">
          {/* Controls: Search & Queue Filter */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
                placeholder="Search priority leads by name, phone, or condition..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-700 rounded-xl focus:outline-none focus:border-emerald-500 bg-gray-800/80 text-white placeholder-gray-400 transition"
              />
            </div>

            {/* Filter by Queue Source */}
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10 flex-wrap">
              {[
                { id: 'all', label: `All (${queueItems.length})` },
                { id: 'call again', label: 'Call Again' },
                { id: 'verification', label: 'Verifications' },
                { id: 'cnp', label: 'CNP' },
                { id: 'interested', label: 'Interested' },
                { id: 'on hold', label: 'On Hold' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setFilterType(tab.id); setPage(1); }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition cursor-pointer ${
                    filterType === tab.id
                      ? 'bg-emerald-500 text-gray-950 shadow-xs'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 10 Leads Table */}
          <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-950/60 shadow-inner">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/5 border-b border-gray-800 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                  <th className="py-2.5 px-3.5 text-center w-12">#</th>
                  <th className="py-2.5 px-3.5">Patient Name</th>
                  <th className="py-2.5 px-3.5">Phone Number</th>
                  <th className="py-2.5 px-3.5">Department</th>
                  <th className="py-2.5 px-3.5">Queue Source</th>
                  <th className="py-2.5 px-3.5">Condition / Note</th>
                  <th className="py-2.5 px-3.5 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 text-xs">
                {paginatedList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400 font-bold">
                      No priority leads matching your search
                    </td>
                  </tr>
                ) : (
                  paginatedList.map((item, idx) => {
                    const rowNumber = (safePage - 1) * PAGE_SIZE + idx + 1;
                    const itemPhone = item.lead?.phone || item.phone || '';
                    const itemRawName = item.lead?.name || item.name || item.title || item.patientName || '';
                    const itemDisplayName = getCleanPatientName(itemRawName, itemPhone);
                    const itemProb = item.problem || item.lead?.problem || item.notes?.[item.notes.length - 1]?.text || item.description || '';
                    const itemDept = item.department || item.lead?.department || 'General';
                    const leadId = item.lead?._id || item.lead || item._id;
                    const isCnpBusy = cnpLoadingId === String(leadId);

                    return (
                      <tr key={item._id || idx} className="hover:bg-white/5 transition group">
                        <td className="py-3 px-3.5 text-center font-bold text-gray-400 text-[11px]">
                          {rowNumber}
                        </td>
                        <td className="py-3 px-3.5 font-black text-white">
                          <button
                            onClick={() => {
                              const foundIdx = queueItems.findIndex(q => (q._id || q.lead?._id) === (item._id || item.lead?._id));
                              if (foundIdx >= 0) setIndex(foundIdx);
                              setViewMode('card');
                            }}
                            className="text-left hover:text-emerald-300 transition cursor-pointer flex items-center gap-1.5"
                            title="Click to open this lead in single card view"
                          >
                            <span>{itemDisplayName}</span>
                            <span className="text-[9px] text-gray-400 opacity-0 group-hover:opacity-100 transition">↗</span>
                          </button>
                        </td>
                        <td className="py-3 px-3.5 font-mono font-bold text-emerald-400 text-[11px]">
                          {itemPhone || '—'}
                        </td>
                        <td className="py-3 px-3.5">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            itemDept.toLowerCase().includes('piles')
                              ? 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                              : 'bg-purple-500/20 text-purple-300 border-purple-400/30'
                          }`}>
                            {itemDept}
                          </span>
                        </td>
                        <td className="py-3 px-3.5">
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                            {item._queueType || 'Priority'}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-gray-300 max-w-xs truncate text-[11px]" title={itemProb}>
                          {itemProb || '—'}
                        </td>
                        <td className="py-3 px-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {itemPhone && (
                              <>
                                <a
                                  href={`tel:${itemPhone}`}
                                  className="px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-gray-950 text-[10px] font-black transition"
                                  title="Direct Phone Call"
                                >
                                  Call
                                </a>
                                <button
                                  onClick={() => handleWhatsApp(item)}
                                  className="px-2 py-1 rounded-lg bg-green-600 hover:bg-green-500 text-white text-[10px] font-black transition cursor-pointer"
                                  title="WhatsApp Message"
                                >
                                  WA
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => onOpenItem?.(item)}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black transition cursor-pointer"
                              title="Open Verification / Lead details"
                            >
                              Open
                            </button>
                            <button
                              onClick={() => handleCnp(item)}
                              disabled={isCnpBusy}
                              className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[10px] font-black transition disabled:opacity-50 cursor-pointer"
                              title="Mark as Customer Not Picking"
                            >
                              {isCnpBusy ? '...' : 'CNP'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls (Strict 10 items per page) */}
          <div className="flex items-center justify-between pt-2 flex-wrap gap-2 text-xs">
            <span className="text-[11px] text-gray-400 font-bold">
              Showing <span className="text-white font-black">{filteredList.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}</span> to <span className="text-white font-black">{Math.min(safePage * PAGE_SIZE, filteredList.length)}</span> of <span className="text-emerald-400 font-black">{filteredList.length}</span> leads
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={safePage <= 1}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                Previous
              </button>

              <span className="text-[11px] font-black text-gray-300 px-2">
                Page {safePage} of {totalPages}
              </span>

              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={safePage >= totalPages}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Staff Dashboard Page ─────────────────────────────────── */
export default function StaffDashboard() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const { success, error, info } = useToast();

  const [stats, setStats] = useState(null);
  const [todayLists, setTodayLists] = useState({ cnpList: [], callAgainList: [], interestedList: [], notInterestedList: [], onHoldList: [], verificationList: [] });
  const [monthlyChart, setMonthlyChart] = useState([]);
  
  // Target States
  const [targetInput, setTargetInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [streak, setStreak] = useState(0);

  // Attendance States
  const [attStatus, setAttStatus] = useState(null);
  const [attLoading, setAttLoading] = useState(false);

  // Commission States
  const [commission, setCommission] = useState(null);
  const [commMonth, setCommMonth] = useState(() => { const n = new Date(); return { month: n.getMonth(), year: n.getFullYear() }; });
  const [commLoading, setCommLoading] = useState(false);


  // Delivery & RTO States
  const [myDelivery, setMyDelivery] = useState(null);
  const [deliveryMonth, setDeliveryMonth] = useState(() => { const n = new Date(); return { month: n.getMonth(), year: n.getFullYear() }; });
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [selectedStaffFilter, setSelectedStaffFilter] = useState('all');

  // Work Queue & Top Filter States
  const [activeQueueTab, setActiveQueueTab] = useState('callAgain');
  const [queueSearch, setQueueSearch] = useState('');
  const [workFilter, setWorkFilter] = useState('today');
  const [customFrom, setCustomFrom] = useState(() => new Date().toISOString().split('T')[0]);
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [appliedCustom, setAppliedCustom] = useState(() => {
    const today = new Date().toISOString().split('T')[0];
    return { from: today, to: today };
  });
  const [workLists, setWorkLists] = useState({ cnpList: [], callAgainList: [], interestedList: [], notInterestedList: [], onHoldList: [], verificationList: [] });
  const [workLoading, setWorkLoading] = useState(false);

  // Chart Filters
  const [chartFilter, setChartFilter] = useState('month');
  const [chartCustomFrom, setChartCustomFrom] = useState('');
  const [chartCustomTo, setChartCustomTo] = useState('');

  const [loading, setLoading] = useState(true);

  const workingTime = useLiveTimer(attStatus?.checkIn && !attStatus?.checkOut ? attStatus.checkIn : null);

  // Fetch Delivery & RTO stats
  const fetchDelivery = useCallback((refresh = true) => {
    if (!['admin', 'manager', 'sales', 'support'].includes(user?.role)) return;
    setDeliveryLoading(true);
    const targetUserId = ['admin', 'manager'].includes(user?.role) && selectedStaffFilter !== 'all' ? selectedStaffFilter : null;
    fetchMyDeliveryStats(deliveryMonth.month, deliveryMonth.year, targetUserId, refresh)
      .then(d => { if (d) setMyDelivery(d); })
      .catch(() => {})
      .finally(() => { setDeliveryLoading(false); });
  }, [deliveryMonth, selectedStaffFilter, user?.role]);

  useEffect(() => {
    fetchDelivery(true);
  }, [fetchDelivery]);

  // Filter Parameters Calculation
  const filterParams = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const sevenDaysStr = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];

    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const thisMonthStartStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;

    const lastMonthDate = new Date(y, m - 1, 1);
    const lastMonthY = lastMonthDate.getFullYear();
    const lastMonthM = lastMonthDate.getMonth();
    const lastMonthStartStr = `${lastMonthY}-${String(lastMonthM + 1).padStart(2, '0')}-01`;
    const lastMonthDays = new Date(lastMonthY, lastMonthM + 1, 0).getDate();
    const lastMonthEndStr = `${lastMonthY}-${String(lastMonthM + 1).padStart(2, '0')}-${String(lastMonthDays).padStart(2, '0')}`;

    let date = todayStr, from = todayStr, to = todayStr, preset = 'today', label = 'Today';
    if (workFilter === 'today') {
      date = todayStr; from = todayStr; to = todayStr; preset = 'today'; label = `Today (${todayStr})`;
    } else if (workFilter === 'yesterday') {
      date = yesterdayStr; from = yesterdayStr; to = yesterdayStr; preset = 'yesterday'; label = `Yesterday (${yesterdayStr})`;
    } else if (workFilter === '7d') {
      from = sevenDaysStr; to = todayStr; preset = '7d'; label = `Last 7 Days (${sevenDaysStr} to ${todayStr})`;
    } else if (workFilter === 'this_month') {
      from = thisMonthStartStr; to = todayStr; preset = 'this_month'; label = `This Month (${thisMonthStartStr} to ${todayStr})`;
    } else if (workFilter === 'last_month') {
      from = lastMonthStartStr; to = lastMonthEndStr; preset = 'last_month'; label = `Last Month (${lastMonthStartStr} to ${lastMonthEndStr})`;
    } else if (workFilter === 'custom') {
      from = appliedCustom.from || todayStr;
      to = appliedCustom.to || todayStr;
      date = to;
      preset = 'custom';
      label = `Custom (${from} to ${to})`;
    }
    return { date, from, to, preset, label };
  }, [workFilter, appliedCustom]);

  const handleSelectFilter = (presetId) => {
    setWorkFilter(presetId);
  };

  const handleApplyCustom = () => {
    if (!customFrom || !customTo) return;
    setAppliedCustom({ from: customFrom, to: customTo });
    setWorkFilter('custom');
  };

  // Load Main Stats & Queues
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setWorkLoading(true);
    try {
      fetchDelivery(true);
      API.get('/users/me').then(res => {
        if (res.data?.data) updateUser(res.data.data);
      }).catch(() => {});

      const { date, from, to, preset } = filterParams;

      const [s, staffS, lists, chart, att] = await Promise.allSettled([
        fetchStats(), 
        fetchStaffStats(date, null, from, to, null, true, preset),
        fetchStaffTodayLists(date, null, from, to, null, true, preset),
        fetchStaffMonthlyChart(), 
        attendanceSvc.getTodayStatus()
      ]);
      
      if (s.status === 'fulfilled' || staffS.status === 'fulfilled') {
        setStats({
          ...(s.status === 'fulfilled' ? s.value : {}),
          ...(staffS.status === 'fulfilled' ? staffS.value : {})
        });
      }
      if (lists?.status === 'fulfilled') {
        setWorkLists(lists.value || { cnpList: [], callAgainList: [], interestedList: [], notInterestedList: [], onHoldList: [], verificationList: [] });
      }
      if (chart.status === 'fulfilled') {
        setMonthlyChart(Array.isArray(chart.value) ? chart.value : []);
      }
      if (att.status === 'fulfilled') setAttStatus(att.value);
    } catch { /* ignore */ }
    finally { 
      if (!silent) setLoading(false);
      setWorkLoading(false);
    }
  }, [updateUser, filterParams, fetchDelivery]);

  useAutoRefresh(() => load(true), 60000);

  useEffect(() => {
    load();
  }, [load]);

  // Calculate Streak
  useEffect(() => {
    fetchTargetHistory(null, null, 30)
      .then(history => {
        if (!Array.isArray(history)) return;
        const sorted = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
        let s = 0;
        for (const row of sorted) {
          if (row.target > 0 && row.achieved) s++;
          else if (row.target > 0) break;
        }
        setStreak(s);
      }).catch(() => {});
  }, [stats?.todayVerifications]);

  // Sync commMonth when deliveryMonth changes
  useEffect(() => {
    if (deliveryMonth.month !== commMonth.month || deliveryMonth.year !== commMonth.year) {
      setCommMonth(deliveryMonth);
    }
  }, [deliveryMonth.month, deliveryMonth.year]);

  // Load Commissions
  useEffect(() => {
    let cancelled = false;
    setCommLoading(true);
    fetchStaffCommission(commMonth.month, commMonth.year, true)
      .then(d => { if (!cancelled) setCommission(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCommLoading(false); });
    return () => { cancelled = true; };
  }, [commMonth]);


  // Attendance Handlers
  const handleCheckIn = async () => {
    setAttLoading(true);
    try { 
      const res = await attendanceSvc.checkIn(); 
      setAttStatus(res);
      const isReCheckIn = !!attStatus?.checkOut;
      success(isReCheckIn ? 'Welcome back! Session resumed.' : 'Checked in successfully. Have a great day!', 'Clock In');
    } catch (e) { 
      error(e.response?.data?.message || 'Check-in failed'); 
    }
    setAttLoading(false);
  };

  const handleCheckOut = async () => {
    setAttLoading(true);
    try { 
      const res = await attendanceSvc.checkOut(); 
      setAttStatus(res); 
      info('Shift completed. Rest well!', 'Clock Out');
    } catch (e) { 
      error(e.response?.data?.message || 'Check-out failed'); 
    }
    setAttLoading(false);
  };

  // Target Save Handler
  const handleSaveTarget = async (e) => {
    e.preventDefault();
    if (!targetInput || Number(targetInput) < 1) return;
    setSaving(true);
    try {
      const data = await saveStaffTarget(Number(targetInput));
      setStats(prev => ({ ...prev, todayTarget: data.todayTarget }));
      setEditing(false);
      setTargetInput('');
      success(`Today's verification target set to ${data.todayTarget}.`, 'Target Updated');
      load();
    } catch (err) {
      error(err.response?.data?.message || 'Failed to update target');
    } finally { 
      setSaving(false); 
    }
  };

  const done = stats?.todayVerifications ?? stats?.verifiedCount ?? 0;
  const target = stats?.todayTarget || 0;
  const remaining = target > 0 ? Math.max(target - done, 0) : 0;
  const achieved = target > 0 && done >= target;
  const progressPct = target > 0 ? Math.min(Math.round((done / target) * 100), 100) : 0;

  const checkedIn = !!attStatus?.checkIn;
  const checkedOut = !!attStatus?.checkOut;
  const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : null;

  // Compile active priority leads for Smart Next Lead card
  const priorityQueue = useMemo(() => {
    const list = [];
    if (workLists.callAgainList?.length) list.push(...workLists.callAgainList.map(i => ({ ...i, _queueType: 'Call Again' })));
    if (workLists.verificationList?.length) list.push(...workLists.verificationList.filter(v => ['pending', 'on_hold'].includes(v.status)).map(i => ({ ...i, _queueType: 'Verification' })));
    if (workLists.cnpList?.length) list.push(...workLists.cnpList.map(i => ({ ...i, _queueType: 'CNP' })));
    if (workLists.interestedList?.length) list.push(...workLists.interestedList.map(i => ({ ...i, _queueType: 'Interested' })));
    if (workLists.onHoldList?.length) list.push(...workLists.onHoldList.map(i => ({ ...i, _queueType: 'On Hold' })));
    return list;
  }, [workLists]);

  // Open item routing
  const openWorkItem = (item) => {
    const phone = item?.lead?.phone || item?.phone || '';
    if (activeQueueTab === 'callAgain') navigate(phone ? `/call-again?phone=${encodeURIComponent(phone)}` : '/call-again');
    else if (activeQueueTab === 'cnp') navigate(phone ? `/cnp?phone=${encodeURIComponent(phone)}` : '/cnp');
    else if (activeQueueTab === 'interested') {
      const leadId = item?.lead?._id || item?._id;
      navigate(phone ? `/leads?phone=${encodeURIComponent(phone)}` : `/leads?openId=${leadId}`);
    } else if (activeQueueTab === 'onHold') {
      if (item?.lead || item?.order_id) {
        navigate(`/verification?openId=${item._id}`);
      } else {
        navigate(phone ? `/leads?phone=${encodeURIComponent(phone)}` : `/leads?openId=${item._id}`);
      }
    } else {
      navigate(`/verification?openId=${item._id}`);
    }
  };

  // Filtered Chart Data
  const filteredChartData = useMemo(() => {
    if (!monthlyChart.length) return [];
    const todayDay = new Date().getDate();
    const yesterdayDay = new Date(Date.now() - 86400000).getDate();
    if (chartFilter === 'today') return monthlyChart.filter(d => d.day === todayDay);
    if (chartFilter === 'yesterday') return monthlyChart.filter(d => d.day === yesterdayDay);
    if (chartFilter === '7d') {
      const minDay = Math.max(1, todayDay - 6);
      return monthlyChart.filter(d => d.day >= minDay && d.day <= todayDay);
    }
    if (chartFilter === 'custom' && chartCustomFrom && chartCustomTo) {
      const from = new Date(chartCustomFrom).getDate();
      const to = new Date(chartCustomTo).getDate();
      return monthlyChart.filter(d => d.day >= from && d.day <= to);
    }
    return monthlyChart.filter(d => d.day <= todayDay);
  }, [monthlyChart, chartFilter, chartCustomFrom, chartCustomTo]);

  // Active queue list
  const currentQueueList = useMemo(() => {
    let raw = [];
    if (activeQueueTab === 'callAgain') raw = workLists.callAgainList || [];
    else if (activeQueueTab === 'verifications') raw = workLists.verificationList || [];
    else if (activeQueueTab === 'cnp') raw = workLists.cnpList || [];
    else if (activeQueueTab === 'interested') raw = workLists.interestedList || [];
    else if (activeQueueTab === 'onHold') raw = workLists.onHoldList || [];

    if (!queueSearch.trim()) return raw;
    const q = queueSearch.toLowerCase();
    return raw.filter(item => {
      const name = (item.lead?.name || item.name || item.title || item.patientName || '').toLowerCase();
      const phone = (item.lead?.phone || item.phone || '');
      const prob = (item.problem || item.lead?.problem || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || prob.includes(q);
    });
  }, [activeQueueTab, workLists, queueSearch]);

  return (
    <div className="space-y-6 pb-12">
      {/* ═══ 1. HEADER & LIVE ATTENDANCE PULSE BAR ═══ */}
      <div className="rounded-3xl p-6 text-white relative overflow-hidden shadow-2xl"
        style={{ background: 'linear-gradient(135deg, #062413 0%, #0d381e 50%, #124d2a 100%)' }}>
        
        {/* Glow ambient effects */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-emerald-400/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="flex h-3 w-3 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${checkedIn && !checkedOut ? 'bg-emerald-400 opacity-75' : 'bg-gray-400 opacity-40'}`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${checkedIn && !checkedOut ? 'bg-emerald-400' : 'bg-gray-400'}`}></span>
              </span>
              <h1 className="text-2xl font-black text-white tracking-tight">Welcome, {user?.name}!</h1>
              {user?.departments?.map(d => (
                <span key={d} className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-white/10 text-emerald-300 border border-emerald-400/20">
                  {d}
                </span>
              ))}
            </div>

            <p className="text-xs text-emerald-200/80 font-medium">
              {checkedIn && checkedOut ? 'Shift Completed' : checkedIn ? `Clocked in at ${fmtTime(attStatus?.checkIn)}` : 'You are not clocked in yet.'}
              {workingTime && !checkedOut && <span className="ml-2 font-mono text-emerald-300 font-bold bg-white/10 px-2 py-0.5 rounded-lg">{workingTime}</span>}
            </p>
          </div>

          {/* Quick Metrics & Clock Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            {checkedIn && (
              <div className="hidden sm:flex items-center gap-2 bg-white/10 p-1.5 rounded-2xl border border-white/10">
                <div className="px-3.5 py-1.5 text-center">
                  <p className="text-base font-black text-white leading-none">{done}</p>
                  <p className="text-[9px] font-bold text-emerald-300/70 uppercase tracking-widest mt-0.5">Done</p>
                </div>
                <div className="w-px h-6 bg-white/10" />
                <div className="px-3.5 py-1.5 text-center">
                  <p className="text-base font-black text-white leading-none">{target || '—'}</p>
                  <p className="text-[9px] font-bold text-emerald-300/70 uppercase tracking-widest mt-0.5">Target</p>
                </div>
                <div className="w-px h-6 bg-white/10" />
                <div className="px-3.5 py-1.5 text-center">
                  <p className={`text-base font-black leading-none ${achieved ? 'text-emerald-300' : 'text-amber-300'}`}>{progressPct}%</p>
                  <p className="text-[9px] font-bold text-emerald-300/70 uppercase tracking-widest mt-0.5">Progress</p>
                </div>
              </div>
            )}

            {!checkedIn ? (
              <button onClick={handleCheckIn} disabled={attLoading}
                className="px-6 py-3 rounded-2xl text-xs font-black text-emerald-950 bg-gradient-to-r from-emerald-400 to-green-400 hover:from-emerald-300 hover:to-green-300 shadow-lg shadow-emerald-500/20 active:scale-95 transition flex items-center gap-2 disabled:opacity-50 cursor-pointer">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                {attLoading ? 'Clocking in...' : 'Clock In Now'}
              </button>
            ) : !checkedOut ? (
              <button onClick={handleCheckOut} disabled={attLoading}
                className="px-6 py-3 rounded-2xl text-xs font-black text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-lg shadow-orange-500/20 active:scale-95 transition flex items-center gap-2 disabled:opacity-50 cursor-pointer">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                {attLoading ? 'Clocking out...' : 'Clock Out Shift'}
              </button>
            ) : (
              <button onClick={handleCheckIn} disabled={attLoading}
                className="px-6 py-3 rounded-2xl text-xs font-black text-emerald-950 bg-gradient-to-r from-emerald-400 to-green-400 hover:from-emerald-300 shadow-lg active:scale-95 transition flex items-center gap-2 disabled:opacity-50 cursor-pointer">
                Clock In Again
              </button>
            )}
          </div>
        </div>

        {/* Target Progress Bar inside Top Banner */}
        {checkedIn && target > 0 && (
          <div className="mt-5 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between text-[11px] font-bold mb-1.5">
              <span className="text-emerald-300/80">Daily Verification Goal ({done}/{target})</span>
              <span className={achieved ? 'text-emerald-300 font-black' : 'text-amber-300 font-black'}>
                {achieved ? 'Target Smashed!' : `${remaining} more verifications to reach target`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${achieved ? 'bg-emerald-400 shadow-[0_0_12px_#34d399]' : 'bg-gradient-to-r from-amber-400 to-emerald-400'}`}
                style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* ═══ TOP DATE FILTER BAR ═══ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-black text-gray-700 mr-1">
            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span className="uppercase tracking-wider text-[11px] text-gray-500 font-bold">Filter:</span>
          </div>

          <div className="flex items-center bg-gray-100/90 rounded-xl p-1 gap-1 flex-wrap">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7d', label: '7 Days' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'custom', label: 'Custom' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => handleSelectFilter(f.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                  workFilter === f.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {workFilter === 'custom' && (
            <div className="flex items-center gap-2 bg-emerald-50/70 border border-emerald-200 p-1.5 rounded-xl flex-wrap">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase">From:</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="px-2 py-1 text-xs font-bold border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-emerald-500 text-gray-800"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase">To:</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  className="px-2 py-1 text-xs font-bold border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-emerald-500 text-gray-800"
                />
              </div>
              <button
                onClick={handleApplyCustom}
                className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black shadow-xs transition cursor-pointer active:scale-95"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0 border-gray-100">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200/70 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {filterParams.label}
          </span>

          <button
            onClick={() => load(true)}
            disabled={workLoading}
            title="Refresh Data"
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition cursor-pointer disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${workLoading ? 'animate-spin text-emerald-600' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ═══ 2. STREAK CELEBRATION BANNER ═══ */}
      {streak >= 3 && (
        <div className="rounded-2xl px-5 py-3.5 flex items-center justify-between gap-3 bg-gradient-to-r from-amber-900 via-orange-950 to-amber-900 text-white border border-amber-600/40 shadow-md">
          <div>
            <p className="text-sm font-black text-white">{streak} Days Unstoppable Streak!</p>
            <p className="text-xs text-amber-200/80">You have hit 100% of your daily verification target for {streak} straight days!</p>
          </div>
          <span className="text-xs font-black bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full border border-amber-400/30">Top Performer</span>
        </div>
      )}

      {/* ═══ 3. SMART NEXT LEAD (HERO CALLER STATION) ═══ */}
      <SmartNextLeadCard
        queueItems={priorityQueue}
        onOpenItem={openWorkItem}
        onMarkCnpSuccess={() => load(true)}
      />

      {/* ═══ 4. COMMAND CENTER: TARGET & WORK QUEUES ═══ */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column: Target Setter & Progress */}
        <div className={`${cardCls} xl:col-span-1 space-y-5`} style={cardStyle}>
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-gray-800">Daily Target</h3>
              <p className="text-[10px] text-gray-400">Verifications Goal</p>
            </div>
            {target > 0 && !editing && (
              <button onClick={() => { setEditing(true); setTargetInput(String(target)); }}
                className="text-[11px] font-black text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded-xl transition border border-emerald-100 cursor-pointer">
                Change
              </button>
            )}
          </div>

          {(!target || editing) ? (
            <form onSubmit={handleSaveTarget} className="space-y-4">
              <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Quick Target Preset</p>
              <div className="flex items-center gap-2 flex-wrap">
                {[5, 10, 15, 20, 25].map(q => (
                  <button key={q} type="button" onClick={() => setTargetInput(String(q))}
                    className={`w-11 h-11 rounded-xl text-xs font-black border-2 transition cursor-pointer ${
                      targetInput === String(q)
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-gray-50 text-gray-700 border-gray-100 hover:border-emerald-300'
                    }`}>
                    {q}
                  </button>
                ))}
                <input type="number" min="1" max="500" value={targetInput} onChange={e => setTargetInput(e.target.value)}
                  placeholder="Custom"
                  className="w-20 h-11 border-2 border-gray-100 rounded-xl px-2 text-center text-xs font-black focus:outline-none focus:border-emerald-500 bg-gray-50" />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button type="submit" disabled={saving || !targetInput}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition shadow-sm disabled:opacity-50 cursor-pointer">
                  {saving ? 'Saving...' : 'Confirm Target'}
                </button>
                {editing && target > 0 && (
                  <button type="button" onClick={() => setEditing(false)}
                    className="px-4 py-3 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 cursor-pointer">
                    Cancel
                  </button>
                )}
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-5">
                {/* Circular Progress Ring */}
                <div className="relative shrink-0 w-20 h-20">
                  <svg width="80" height="80" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="32" fill="none" stroke="#f1f5f9" strokeWidth="8"/>
                    <circle cx="40" cy="40" r="32" fill="none"
                      stroke={achieved ? '#10b981' : progressPct >= 60 ? '#f59e0b' : '#f43f5e'}
                      strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 32}`}
                      strokeDashoffset={`${2 * Math.PI * 32 * (1 - progressPct / 100)}`}
                      transform="rotate(-90 40 40)"
                      style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-base font-black leading-none ${achieved ? 'text-emerald-600' : 'text-gray-900'}`}>{progressPct}%</span>
                  </div>
                </div>

                {/* Score Stats */}
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                    <p className="text-xl font-black text-emerald-800 leading-none">{done}</p>
                    <p className="text-[9px] font-black uppercase text-emerald-600 mt-1">Done</p>
                  </div>
                  <div className={`p-3 rounded-xl border text-center ${achieved ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                    <p className={`text-xl font-black leading-none ${achieved ? 'text-emerald-800' : 'text-amber-800'}`}>
                      {achieved ? 'Done' : remaining}
                    </p>
                    <p className={`text-[9px] font-black uppercase mt-1 ${achieved ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {achieved ? 'Complete' : 'Left'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Summary Counts */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                <div className="rounded-xl bg-blue-50 text-blue-800 p-2.5 text-center border border-blue-100">
                  <p className="text-base font-black">{stats?.monthVerifications ?? 0}</p>
                  <p className="text-[8px] font-bold uppercase tracking-wider text-blue-600 mt-0.5">Month</p>
                </div>
                <div className="rounded-xl bg-purple-50 text-purple-800 p-2.5 text-center border border-purple-100">
                  <p className="text-base font-black">{stats?.pendingTasks ?? stats?.tasks?.pending ?? 0}</p>
                  <p className="text-[8px] font-bold uppercase tracking-wider text-purple-600 mt-0.5">Tasks</p>
                </div>
                <div className="rounded-xl bg-amber-50 text-amber-800 p-2.5 text-center border border-amber-100">
                  <p className="text-base font-black">{stats?.leadsAdded ?? 0}</p>
                  <p className="text-[8px] font-bold uppercase tracking-wider text-amber-600 mt-0.5">Leads</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Interactive Work Queues */}
        <div className={`${cardCls} xl:col-span-2 space-y-4`} style={cardStyle}>
          <div className="flex items-center justify-between gap-3 flex-wrap border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-gray-800">Active Work Queues</h3>
              <p className="text-xs text-gray-400">Select a queue to work through your daily patient follow-ups</p>
            </div>

            {/* Time Filter Sync Pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-gray-100 rounded-xl p-0.5 flex-wrap gap-0.5">
                {[
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: '7d', label: '7 Days' },
                  { id: 'this_month', label: 'This Month' },
                  { id: 'last_month', label: 'Last Month' },
                  { id: 'custom', label: 'Custom' }
                ].map(f => (
                  <button key={f.id} onClick={() => handleSelectFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${
                      workFilter === f.id ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-500 hover:text-gray-800'
                    }`}>{f.label}</button>
                ))}
              </div>
              {workLoading && (
                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </div>

          {/* Queue Tab Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
            {[
              { id: 'callAgain', label: 'Call Again', count: workLists.callAgainList?.length || 0, color: 'text-amber-700 bg-amber-50 border-amber-200' },
              { id: 'verifications', label: 'Verifications', count: workLists.verificationList?.length || 0, color: 'text-blue-700 bg-blue-50 border-blue-200' },
              { id: 'cnp', label: 'CNP Queue', count: workLists.cnpList?.length || 0, color: 'text-rose-700 bg-rose-50 border-rose-200' },
              { id: 'interested', label: 'Interested', count: workLists.interestedList?.length || 0, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
              { id: 'onHold', label: 'On Hold', count: workLists.onHoldList?.length || 0, color: 'text-gray-700 bg-gray-50 border-gray-200' },
            ].map(tab => (
              <button key={tab.id} onClick={() => { setActiveQueueTab(tab.id); setQueueSearch(''); }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition whitespace-nowrap cursor-pointer border ${
                  activeQueueTab === tab.id
                    ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}>
                <span>{tab.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                  activeQueueTab === tab.id ? 'bg-white/20 text-white' : tab.color
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search bar inside queue */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              value={queueSearch}
              onChange={e => setQueueSearch(e.target.value)}
              placeholder="Search patients in this queue by name, phone, or condition..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 bg-gray-50 focus:bg-white transition"
            />
          </div>

          {/* Patient Cards in Selected Queue */}
          <div className="max-h-96 overflow-y-auto custom-scrollbar space-y-2.5">
            {currentQueueList.length === 0 ? (
              <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <p className="text-xs font-bold text-gray-400">No patients waiting in this queue</p>
              </div>
            ) : currentQueueList.map((item, idx) => {
              const phone = item.lead?.phone || item.phone || '';
              const name = item.lead?.name || item.name || item.title || item.patientName || 'Customer';
              const problem = item.problem || item.lead?.problem || '';
              const department = item.department || item.lead?.department;
              const location = item.cityVillage || item.lead?.cityVillage || item.state || item.lead?.state || '';

              return (
                <div key={item._id || idx} className="rounded-xl border border-gray-100 bg-white p-3.5 hover:border-gray-300 hover:shadow-xs transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-black text-gray-900">{name}</p>
                        {department && (
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            department.toLowerCase().includes('piles') ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                          }`}>{department}</span>
                        )}
                        {location && <span className="text-[10px] text-gray-400 font-medium">{location}</span>}
                      </div>

                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-[11px] font-bold text-gray-600">{phone || '—'}</span>
                        {problem && <span className="text-[10px] text-gray-400 truncate max-w-xs">{problem}</span>}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {phone && (
                        <>
                          <a href={`tel:${phone}`} className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[10px] font-bold transition" title="Direct Phone Call">
                            Call
                          </a>
                          <button onClick={() => {
                            const clean = String(phone).replace(/\D/g, '').slice(-10);
                            const text = encodeURIComponent(`Namaste ${name} ji, Triven Ayurveda se aapke health case ke regarding message kar rahe hain.`);
                            window.open(`https://wa.me/91${clean}?text=${text}`, '_blank');
                          }} className="px-2 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 text-[10px] font-bold transition" title="WhatsApp Message">
                            WhatsApp
                          </button>
                        </>
                      )}
                      <button onClick={() => openWorkItem(item)} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-[10px] font-black hover:bg-gray-800 transition cursor-pointer">
                        Open
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ 5. DELIVERY SCORE & RTO DEFENSE (WITH RTO REASONS) ═══ */}
      {['admin', 'manager', 'sales', 'support'].includes(user?.role) && (
        <MyDeliveryScoreCard
          user={user}
          myDelivery={myDelivery}
          deliveryMonth={deliveryMonth}
          setDeliveryMonth={setDeliveryMonth}
          selectedStaffFilter={selectedStaffFilter}
          setSelectedStaffFilter={setSelectedStaffFilter}
          deliveryLoading={deliveryLoading}
          cardCls={cardCls}
          cardStyle={cardStyle}
          onRefresh={() => {
            fetchDelivery(true);
            fetchStaffCommission(commMonth.month, commMonth.year, true).then(d => { if (d) setCommission(d); }).catch(() => {});
          }}
        />
      )}

      {/* ═══ 6. EARNINGS & ACTIVITY TREND CHARTS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Earnings Card */}
        <div className={`lg:col-span-1 ${cardCls} space-y-4`} style={cardStyle}>
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="text-sm font-black text-gray-800">Monthly Earnings</h3>
            <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-100">
              <button onClick={() => {
                const m = commMonth.month - 1;
                const nextMonth = m < 0 ? { month: 11, year: commMonth.year - 1 } : { month: m, year: commMonth.year };
                setCommMonth(nextMonth);
                setDeliveryMonth(nextMonth);
              }} className="w-6 h-6 rounded-lg bg-white shadow-xs flex items-center justify-center text-gray-500 hover:bg-gray-100 transition">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span className="text-[10px] font-bold text-gray-700 min-w-[70px] text-center uppercase tracking-tight">
                {new Date(commMonth.year, commMonth.month).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
              </span>
              <button onClick={() => {
                const m = commMonth.month + 1;
                const nextMonth = m > 11 ? { month: 0, year: commMonth.year + 1 } : { month: m, year: commMonth.year };
                setCommMonth(nextMonth);
                setDeliveryMonth(nextMonth);
              }} className="w-6 h-6 rounded-lg bg-white shadow-xs flex items-center justify-center text-gray-500 hover:bg-gray-100 transition">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>

          {commLoading && !commission && !myDelivery ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (commission || myDelivery) ? (() => {
            const isSameMonth = deliveryMonth.month === commMonth.month && deliveryMonth.year === commMonth.year;
            const fallbackDelStats = isSameMonth ? myDelivery : null;

            const basePay = commission?.basePay || 0;
            const newComm = (commission?.revenueCommission !== undefined && commission?.revenueCommission !== null)
              ? commission.revenueCommission
              : (fallbackDelStats?.newCommissionTotal ?? 0);
            const oldComm = (commission?.reorderCommission !== undefined && commission?.reorderCommission !== null)
              ? commission.reorderCommission
              : (fallbackDelStats?.oldCommissionTotal ?? 0);
            const totalCommission = commission?.totalCommission ?? (fallbackDelStats?.totalCommission ?? (newComm + oldComm));
            const totalPay = commission?.totalPay ?? (basePay + totalCommission);
            const totalDeliveries = (commission?.totalDeliveries !== undefined && commission?.totalDeliveries !== null)
              ? commission.totalDeliveries
              : (fallbackDelStats?.delivered ?? 0);
            const commRate = commission?.commissionRate || user?.commissionRate || 10;

            return (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-gray-900 to-slate-900 rounded-2xl p-5 text-center shadow-lg relative text-white border border-gray-800">
                  <p className="text-3xl font-black">₹{totalPay.toLocaleString('en-IN')}</p>
                  <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mt-1">Total Estimated Pay</p>
                  {totalDeliveries > 0 && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-400/30">
                      <span>{totalDeliveries} Delivered</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
                    <p className="text-base font-black text-emerald-800 leading-none">₹{basePay.toLocaleString('en-IN')}</p>
                    <p className="text-[8px] font-black uppercase text-emerald-600 tracking-wider mt-1.5">Base Pay</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-blue-50 border border-blue-100 text-center">
                    <p className="text-base font-black text-blue-800 leading-none">₹{newComm.toLocaleString('en-IN')}</p>
                    <p className="text-[8px] font-black uppercase text-blue-600 tracking-wider mt-1.5">New Comm ({commRate}%)</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-purple-50 border border-purple-100 text-center">
                    <p className="text-base font-black text-purple-800 leading-none">₹{oldComm.toLocaleString('en-IN')}</p>
                    <p className="text-[8px] font-black uppercase text-purple-600 tracking-wider mt-1.5">Old / Re-Order</p>
                  </div>
                </div>
              </div>
            );
          })() : (
            <p className="text-xs text-gray-400 text-center py-6">No earnings data for this month</p>
          )}
        </div>

        {/* Activity Trend Chart */}
        <div className={`lg:col-span-2 ${cardCls} space-y-4`} style={cardStyle}>
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-black text-gray-800">Verification & Ready to Ship Trend vs Target</h3>
              <p className="text-[10px] text-gray-400">Track daily verified leads, ready to ship orders, and target progress</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-gray-100 rounded-xl p-0.5">
                {[
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yest.' },
                  { id: '7d', label: '7D' },
                  { id: 'month', label: 'Month' }
                ].map(f => (
                  <button key={f.id} onClick={() => setChartFilter(f.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition cursor-pointer ${
                      chartFilter === f.id ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-500 hover:text-gray-800'
                    }`}>{f.label}</button>
                ))}
              </div>
              <div className="flex items-center gap-3 text-[10px] font-bold text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Verified</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Ready to Ship</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300" /> Target</span>
              </div>
            </div>
          </div>

          {filteredChartData.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-end gap-1 px-1" style={{ height: 140 }}>
                {filteredChartData.map((d, i) => {
                  const maxVal = Math.max(...filteredChartData.map(x => Math.max(x.count, x.readyToShip || 0, x.target || 0)), 1);
                  const doneH = Math.max((d.count / maxVal) * 100, d.count > 0 ? 6 : 0);
                  const rtsH = Math.max(((d.readyToShip || 0) / maxVal) * 100, (d.readyToShip || 0) > 0 ? 6 : 0);
                  const targetH = Math.max(((d.target || 0) / maxVal) * 100, (d.target || 0) > 0 ? 6 : 0);
                  const isToday = d.day === new Date().getDate();
                  const targetAchieved = d.target > 0 && d.count >= d.target;

                  return (
                    <div key={i} className="flex-1 flex flex-col items-center group relative h-full">
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] px-2.5 py-2 rounded-xl opacity-0 group-hover:opacity-100 z-20 whitespace-nowrap pointer-events-none shadow-xl border border-gray-700">
                        <p className="font-bold text-gray-200 border-b border-gray-800 pb-1 mb-1">{d.day} {new Date().toLocaleString('default', { month: 'short' })}</p>
                        <p className="text-emerald-300 font-bold">Verified: {d.count}</p>
                        <p className="text-blue-300 font-bold">Ready to Ship: {d.readyToShip || 0}</p>
                        {d.target > 0 && <p className="text-gray-400 font-medium">Target: {d.target}</p>}
                      </div>
                      <div className="w-full flex items-end gap-0.5 h-full">
                        {/* Target Bar */}
                        {d.target > 0 && (
                          <div className="flex-1 rounded-t-sm transition-all duration-500"
                            style={{ height: `${targetH}%`, background: isToday ? '#cbd5e1' : '#e2e8f0' }} />
                        )}
                        {/* Ready to Ship Bar */}
                        <div className="flex-1 rounded-t-sm transition-all duration-500"
                          style={{
                            height: `${rtsH}%`,
                            background: (d.readyToShip || 0) > 0 ? (isToday ? '#2563eb' : '#3b82f6') : '#f8fafc',
                            boxShadow: isToday && (d.readyToShip || 0) > 0 ? '0 0 6px #3b82f6' : 'none'
                          }} />
                        {/* Verified Bar */}
                        <div className="flex-1 rounded-t-sm transition-all duration-500"
                          style={{
                            height: `${doneH}%`,
                            background: targetAchieved ? '#10b981' : isToday ? '#34d399' : d.count > 0 ? '#6ee7b7' : '#f1f5f9',
                            boxShadow: isToday && d.count > 0 ? '0 0 6px #10b981' : 'none'
                          }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 px-1 pt-1 border-t border-gray-100">
                <span>{filteredChartData[0]?.day} {new Date().toLocaleString('default', { month: 'short' })}</span>
                <span className="font-black bg-gray-50 px-2.5 py-0.5 rounded-lg border border-gray-200 flex items-center gap-2 shadow-2xs">
                  <span className="text-emerald-700">{filteredChartData.reduce((s, d) => s + d.count, 0)} Verified</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-blue-700">{filteredChartData.reduce((s, d) => s + (d.readyToShip || 0), 0)} Ready to Ship</span>
                </span>
                <span>{filteredChartData.at(-1)?.day} {new Date().toLocaleString('default', { month: 'short' })}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-36 text-xs text-gray-300 font-bold">No activity recorded for this period</div>
          )}
        </div>
      </div>

    </div>
  );
}
