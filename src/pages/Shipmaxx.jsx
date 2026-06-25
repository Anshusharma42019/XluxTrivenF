import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as smxSvc from '../services/shipmaxx.service';
import api from '../api';

const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white placeholder-gray-400';
const Field = ({ label, children }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const STATUS_COLORS = {
  NEW: 'bg-blue-50 text-blue-700 border-blue-200',
  SHIPPED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
  CANCELED: 'bg-red-50 text-red-700 border-red-200',
  RTO: 'bg-orange-50 text-orange-700 border-orange-200',
  RTO_INITIATED: 'bg-orange-50 text-orange-700 border-orange-200',
  RTO_DELIVERED: 'bg-orange-100 text-orange-800 border-orange-300',
  IN_TRANSIT: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'PICKUP SCHEDULED': 'bg-purple-50 text-purple-700 border-purple-200',
};

const SECTIONS = [
  { id: 'actions', label: 'Actions', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> },
  { id: 'orders', label: 'Orders', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg> },
  { id: 'track', label: 'Track & Label', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  { id: 'import', label: 'Import Orders', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> },
];

const TOKEN_KEY = 'smx_token';
const TOKEN_EXP_KEY = 'smx_token_exp';
const TOKEN_TTL = 24 * 60 * 60 * 1000;

const getSavedToken = () => {
  const exp = localStorage.getItem(TOKEN_EXP_KEY);
  if (exp && Date.now() < Number(exp)) return localStorage.getItem(TOKEN_KEY) || '';
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXP_KEY);
  return '';
};

const saveToken = (t) => {
  localStorage.setItem(TOKEN_KEY, t);
  localStorage.setItem(TOKEN_EXP_KEY, String(Date.now() + TOKEN_TTL));
};

const STEPS = ['Login', 'Create Order', 'Create Shipment (AWB)', 'Generate Label', 'Track Shipment', 'Get Invoice'];

// ── Shared label/manifest/invoice handlers ────────────────────────────────────
const openLabel = async (awb, setActionId) => {
  setActionId(`label-${awb}`);
  try {
    const res = await smxSvc.generateLabel(awb);
    const url = res.data?.data?.label_url || res.data?.label_url;
    if (url) window.open(url, '_blank');
    else window.open('https://appapi.losung360.com', '_blank');
  } catch {
    window.open('https://appapi.losung360.com', '_blank');
  } finally { setActionId(null); }
};

const openManifest = async (awb, setActionId) => {
  setActionId(`manifest-${awb}`);
  try {
    const res = await smxSvc.getManifest(awb);
    const url = res.data?.data?.manifest_url || res.data?.manifest_url;
    if (url) window.open(url, '_blank');
    else window.open('https://appapi.losung360.com', '_blank');
  } catch {
    window.open('https://appapi.losung360.com', '_blank');
  } finally { setActionId(null); }
};

const openInvoice = async (order_id, setActionId) => {
  setActionId(`invoice-${order_id}`);
  try {
    const res = await smxSvc.getInvoice(order_id);
    const url = res.data?.data?.invoice_url || res.data?.invoice_url;
    if (url) window.open(url, '_blank');
    else window.open('https://appapi.losung360.com', '_blank');
  } catch {
    window.open('https://appapi.losung360.com', '_blank');
  } finally { setActionId(null); }
};

// ── Order Detail Modal ────────────────────────────────────────────────────────
function OrderDetailModal({ order, tracking, trackingLoading, fetchLiveTracking, onClose, actionId, setActionId }) {
  if (!order) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-gray-800 text-lg">Order Detail</h3>
            <p className="text-xs text-gray-400 mt-0.5">ID: {order.order_id}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>{order.status}</span>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-2xl p-4 space-y-2 text-xs text-gray-600">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Customer</h4>
              <p><span className="font-bold text-gray-400">Name: </span>{order.billing_customer_name || '—'}</p>
              <p><span className="font-bold text-gray-400">Phone: </span>{order.billing_phone || '—'}</p>
              <p><span className="font-bold text-gray-400">Address: </span>{order.billing_address}, {order.billing_city}, {order.billing_state} - {order.billing_pincode}</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4 space-y-2 text-xs text-gray-600">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Shipment</h4>
              <p><span className="font-bold text-gray-400">AWB: </span><span className="font-mono text-blue-600 font-bold">{order.awb_code || '—'}</span></p>
              <p><span className="font-bold text-gray-400">Courier: </span>{order.courier_name || '—'}</p>
              <p><span className="font-bold text-gray-400">Payment: </span>{order.payment_method || '—'}</p>
              <p><span className="font-bold text-gray-400">Amount: </span><span className="font-black text-gray-900">₹{order.sub_total || 0}</span></p>
            </div>
          </div>
          {order.awb_code && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Live Tracking</h4>
                <button onClick={fetchLiveTracking} disabled={trackingLoading} className="text-xs font-bold text-blue-600 hover:text-blue-700 disabled:opacity-50">
                  {trackingLoading ? 'Loading…' : '↻ Fetch'}
                </button>
              </div>
              {tracking ? (
                <div className="bg-blue-50/30 border border-blue-100/50 rounded-2xl p-4">
                  <p className="text-xs font-bold text-blue-700 uppercase mb-2">Status: {tracking.current_status || tracking.status || 'UNKNOWN'}</p>
                  {tracking.history?.length > 0 ? (
                    <div className="space-y-2">
                      {tracking.history.map((h, i) => (
                        <div key={i} className="flex gap-2 text-xs">
                          <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${i === 0 ? 'bg-blue-600' : 'bg-gray-300'}`} />
                          <div><p className="font-bold text-gray-700">{h.status || h.activity}</p><p className="text-gray-400">{h.location} · {h.date || h.timestamp}</p></div>
                        </div>
                      ))}
                    </div>
                  ) : <pre className="text-[10px] text-gray-600 bg-gray-100/60 rounded-xl p-3 overflow-auto max-h-40">{JSON.stringify(tracking, null, 2)}</pre>}
                </div>
              ) : <p className="text-xs text-gray-400 italic">Click Fetch to load live tracking.</p>}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50/40 shrink-0">
          {order.awb_code && (
            <>
              <button onClick={() => openLabel(order.awb_code, setActionId)} disabled={actionId === `label-${order.awb_code}`}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition disabled:opacity-50">
                {actionId === `label-${order.awb_code}` ? 'Label…' : 'Generate Label'}
              </button>
              <button onClick={() => openManifest(order.awb_code, setActionId)} disabled={actionId === `manifest-${order.awb_code}`}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-700 hover:bg-gray-800 text-white transition disabled:opacity-50">
                {actionId === `manifest-${order.awb_code}` ? 'Manifest…' : 'Get Manifest'}
              </button>
            </>
          )}
          <button onClick={() => openInvoice(order.order_id, setActionId)} disabled={actionId === `invoice-${order.order_id}`}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white transition disabled:opacity-50">
            {actionId === `invoice-${order.order_id}` ? 'Invoice…' : 'Invoice'}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-200 hover:bg-gray-300 text-gray-700 transition">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Orders Section ────────────────────────────────────────────────────────────
function OrdersSection() {
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [actionId, setActionId] = useState(null);
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailTracking, setDetailTracking] = useState(null);
  const [detailTrackLoading, setDetailTrackLoading] = useState(false);

  const fetchOrders = async () => {
    setLoading(true); setError('');
    try {
      const res = await smxSvc.getOrders({ page, limit, status: status === 'all' ? undefined : status, from: fromDate || undefined, to: toDate || undefined, search: search.trim() || undefined });
      setOrders(res.data?.data?.data || res.data?.data || []);
      setTotal(res.data?.data?.total || 0);
    } catch (e) { setError(e?.response?.data?.message || e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchOrders(); }, [page, status]);

  const handleViewDetails = async (order) => {
    setDetailOrder(order);
    if (order.awb_code) {
      setDetailTrackLoading(true);
      try { const res = await smxSvc.trackShipment(order.awb_code); setDetailTracking(res.data?.data || res.data); } catch { }
      finally { setDetailTrackLoading(false); }
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="h-1 bg-blue-600" />
        <form onSubmit={e => { e.preventDefault(); setPage(1); fetchOrders(); }} className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Search"><input className={inp} placeholder="ID, Name, Phone, AWB" value={search} onChange={e => setSearch(e.target.value)} /></Field>
            <Field label="Status">
              <select className={inp} value={status} onChange={e => setStatus(e.target.value)}>
                <option value="all">All</option>
                <option value="NEW">New</option>
                <option value="SHIPPED">Shipped</option>
                <option value="DELIVERED">Delivered</option>
                <option value="IN_TRANSIT">In Transit</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="RTO_INITIATED">RTO Initiated</option>
              </select>
            </Field>
            <Field label="From"><input type="date" className={inp} value={fromDate} onChange={e => setFromDate(e.target.value)} /></Field>
            <Field label="To"><input type="date" className={inp} value={toDate} onChange={e => setToDate(e.target.value)} /></Field>
          </div>
          <div className="flex gap-2 pt-2 border-t border-gray-50">
            <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition">Search</button>
            <button type="button" onClick={() => { setSearch(''); setStatus('all'); setFromDate(''); setToDate(''); setPage(1); }} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition">Reset</button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
          <span className="font-bold text-gray-700 text-sm uppercase tracking-wider">ShipMaxx Orders</span>
          <button onClick={fetchOrders} className="text-xs text-blue-600 font-semibold hover:text-blue-700">↻ Refresh</button>
        </div>
        {error && <div className="p-4 mx-5 my-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs">{error}</div>}
        {loading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-gray-400 text-sm"><div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /> Loading...</div>
        ) : orders.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm italic">No orders found.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">Order ID</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">AWB</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Amount</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map(o => (
                    <tr key={o.order_id} className="hover:bg-gray-50/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-600">{o.order_id}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN') : '—'}</td>
                      <td className="px-4 py-3"><p className="font-bold text-gray-800 text-xs">{o.billing_customer_name}</p><p className="text-gray-400 text-[10px]">{o.billing_phone}</p></td>
                      <td className="px-4 py-3 font-mono text-xs text-blue-600 font-bold">{o.awb_code || '—'}</td>
                      <td className="px-4 py-3"><span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>{o.status}</span></td>
                      <td className="px-4 py-3 font-bold text-gray-800 text-xs">₹{o.sub_total || 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => handleViewDetails(o)} className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-[11px] font-semibold transition">View</button>
                          {o.awb_code && <button onClick={() => openLabel(o.awb_code, setActionId)} disabled={actionId === `label-${o.awb_code}`} className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 text-[11px] font-semibold transition disabled:opacity-50">{actionId === `label-${o.awb_code}` ? '…' : 'Label'}</button>}
                          <button onClick={() => openInvoice(o.order_id, setActionId)} disabled={actionId === `invoice-${o.order_id}`} className="px-2.5 py-1 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 text-[11px] font-semibold transition disabled:opacity-50">{actionId === `invoice-${o.order_id}` ? '…' : 'Invoice'}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="px-5 py-4 border-t border-gray-50 flex items-center justify-between text-xs">
                <span className="text-gray-500">Page {page} of {totalPages}</span>
                <div className="flex gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-40 transition font-semibold">Prev</button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-40 transition font-semibold">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <OrderDetailModal
        order={detailOrder} tracking={detailTracking} trackingLoading={detailTrackLoading}
        fetchLiveTracking={async () => { if (!detailOrder?.awb_code) return; setDetailTrackLoading(true); try { const r = await smxSvc.trackShipment(detailOrder.awb_code); setDetailTracking(r.data?.data || r.data); } catch { } finally { setDetailTrackLoading(false); } }}
        onClose={() => { setDetailOrder(null); setDetailTracking(null); }}
        actionId={actionId} setActionId={setActionId}
      />
    </div>
  );
}

// ── Track & Label Section ─────────────────────────────────────────────────────
function TrackSection() {
  const [manualAwb, setManualAwb] = useState('');
  const [manualOrderId, setManualOrderId] = useState('');
  const [tracking, setTracking] = useState(null);
  const [labelUrl, setLabelUrl] = useState('');
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');

  const run = async (key, fn) => {
    setLoading(key); setError('');
    try { await fn(); }
    catch (e) { setError(e?.response?.data?.message || e.message); }
    finally { setLoading(''); }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl animate-in fade-in duration-200">
      {/* Track */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="h-1 bg-blue-600" />
        <div className="px-5 py-4 space-y-3">
          <h3 className="font-semibold text-gray-700 text-sm">Track Shipment</h3>
          <Field label="AWB Number">
            <div className="flex gap-2">
              <input className={inp} placeholder="Enter AWB" value={manualAwb} onChange={e => setManualAwb(e.target.value)} />
              <button onClick={() => run('track', async () => { const r = await smxSvc.trackShipment(manualAwb.trim()); setTracking(r.data?.data || r.data); })}
                disabled={loading === 'track' || !manualAwb.trim()} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50">
                {loading === 'track' ? '…' : 'Track'}
              </button>
            </div>
          </Field>
        </div>
      </div>

      {/* Label */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="h-1 bg-purple-600" />
        <div className="px-5 py-4 space-y-3">
          <h3 className="font-semibold text-gray-700 text-sm">Generate Label & Manifest</h3>
          <p className="text-xs text-gray-400">Uses AWB from the field above.</p>
          <div className="flex gap-2">
            <button onClick={() => run('label', async () => {
              const r = await smxSvc.generateLabel(manualAwb.trim());
              const url = r.data?.data?.label_url || r.data?.label_url;
              if (url) { setLabelUrl(url); window.open(url, '_blank'); }
              else window.open('https://appapi.losung360.com', '_blank');
            })} disabled={loading === 'label' || !manualAwb.trim()} className="flex-1 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition disabled:opacity-50">
              {loading === 'label' ? '…' : 'Get Label'}
            </button>
            <button onClick={() => run('manifest', async () => {
              const r = await smxSvc.getManifest(manualAwb.trim());
              const url = r.data?.data?.manifest_url || r.data?.manifest_url;
              if (url) window.open(url, '_blank');
              else window.open('https://appapi.losung360.com', '_blank');
            })} disabled={loading === 'manifest' || !manualAwb.trim()} className="flex-1 px-4 py-2 rounded-xl bg-gray-700 text-white text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50">
              {loading === 'manifest' ? '…' : 'Manifest'}
            </button>
          </div>
          <a href="https://appapi.losung360.com" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            Open ShipMaxx Dashboard
          </a>
        </div>
      </div>

      {/* Invoice */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="h-1 bg-orange-500" />
        <div className="px-5 py-4 space-y-3">
          <h3 className="font-semibold text-gray-700 text-sm">Download Invoice</h3>
          <Field label="Order ID">
            <div className="flex gap-2">
              <input className={inp} placeholder="Enter Order ID" value={manualOrderId} onChange={e => setManualOrderId(e.target.value)} />
              <button onClick={() => run('invoice', async () => {
                const r = await smxSvc.getInvoice(manualOrderId.trim());
                const url = r.data?.data?.invoice_url || r.data?.invoice_url;
                if (url) window.open(url, '_blank');
                else window.open('https://appapi.losung360.com', '_blank');
              })} disabled={loading === 'invoice' || !manualOrderId.trim()} className="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-50">
                {loading === 'invoice' ? '…' : 'Invoice'}
              </button>
            </div>
          </Field>
        </div>
      </div>

      {error && <div className="col-span-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-red-600 text-xs font-semibold">{error}</div>}

      {tracking && (
        <div className="col-span-1 md:col-span-2 bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="h-1 bg-blue-600" />
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700 text-sm">Tracking Info</h3>
              {tracking.current_status && <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-700">{tracking.current_status}</span>}
            </div>
            {tracking.history?.length > 0 ? (
              <div className="space-y-2">
                {tracking.history.map((h, i) => (
                  <div key={i} className="flex gap-3 text-xs">
                    <div className="mt-1 w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                    <div><p className="font-semibold text-gray-700">{h.status || h.activity}</p><p className="text-gray-400">{h.location} · {h.date || h.timestamp}</p></div>
                  </div>
                ))}
              </div>
            ) : <pre className="text-xs text-gray-600 bg-gray-50 rounded-xl p-3 overflow-auto max-h-48">{JSON.stringify(tracking, null, 2)}</pre>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Import Section ────────────────────────────────────────────────────────────
function ImportSection() {
  const [idText, setIdText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleImport = async () => {
    setError(''); setResult(null);
    const ids = idText.split(/[\n,\s]+/).map(s => s.trim()).filter(Boolean);
    if (!ids.length) { setError('Please enter at least one order ID'); return; }
    if (ids.length > 500) { setError('Maximum 500 IDs'); return; }
    setLoading(true);
    try { const res = await smxSvc.importByIds(ids); setResult(res.data?.data); }
    catch (e) { setError(e?.response?.data?.message || e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4 max-w-2xl animate-in fade-in duration-200">
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
        <strong>How to import:</strong> Go to your ShipMaxx dashboard → copy Order IDs → paste below (one per line or comma-separated).
      </div>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="h-1 bg-blue-600" />
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-700 text-sm">Paste ShipMaxx Order IDs</h3>
            <span className="text-[10px] text-gray-400 font-semibold">{idText.split(/[\n,\s]+/).filter(s => s.trim()).length} IDs</span>
          </div>
          <textarea rows={8} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-50 resize-none"
            placeholder={"12345\n12346\n12347"} value={idText} onChange={e => setIdText(e.target.value)} />
          <button onClick={handleImport} disabled={loading || !idText.trim()}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Importing…</> : 'Import & Sync to DB'}
          </button>
        </div>
      </div>
      {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-red-600 text-sm font-semibold">{error}</div>}
      {result && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="h-1 bg-emerald-500" />
          <div className="px-5 py-4">
            <h3 className="font-semibold text-gray-700 text-sm mb-3">Import Complete</h3>
            <div className="grid grid-cols-4 gap-3">
              {[['Total', result.total, 'text-gray-700', 'bg-gray-50'], ['New', result.imported, 'text-emerald-700', 'bg-emerald-50'], ['Updated', result.updated, 'text-blue-700', 'bg-blue-50'], ['Failed', result.failed, 'text-red-700', 'bg-red-50']].map(([l, v, c, bg]) => (
                <div key={l} className={`${bg} rounded-xl p-3 text-center`}><p className="text-[10px] font-bold text-gray-500 uppercase">{l}</p><p className={`text-2xl font-black mt-1 ${c}`}>{v ?? 0}</p></div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Shipmaxx() {
  const [section, setSection] = useState('actions');
  const [step, setStep] = useState(0);
  const [token, setToken] = useState(() => getSavedToken());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const location = useLocation();
  const [rtsId, setRtsId] = useState('');

  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authApiKey, setAuthApiKey] = useState('');
  const [authBaseUrl, setAuthBaseUrl] = useState('https://appapi.losung360.com/external/v1');

  const [order, setOrder] = useState({
    order_number: '',
    pickup_address_id: localStorage.getItem('smx_pickup') || '370',
    channel_id: localStorage.getItem('smx_channel') || '595',
    payment_method: 'cod',
    customer: { name: '', phone: '', address: '', pincode: '', city: '', state: '', email: '', landmark: '' },
    products: [{ sku: '', name: '', price: '', quantity: 1 }],
    package: { weight: 0.5, length: 15, width: 10, height: 6 },
    other_charges: 0,
    total_discount: 0,
  });

  const [smxOrderId, setSmxOrderId] = useState('');
  const [awbCode, setAwbCode] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [carrierVariantId, setCarrierVariantId] = useState('');

  const setC = (k, v) => setOrder(p => ({ ...p, customer: { ...p.customer, [k]: v } }));
  const setPkg = (k, v) => setOrder(p => ({ ...p, package: { ...p.package, [k]: v } }));
  const setProduct = (k, v) => setOrder(p => ({ ...p, products: [{ ...p.products[0], [k]: v }] }));

  const call = async (fn) => {
    setLoading(true); setError(''); setResult(null);
    try { setResult(await fn()); }
    catch (e) {
      let msg = e?.response?.data?.detail || e?.response?.data?.message || e.message;
      if (typeof msg === 'object') msg = JSON.stringify(msg);
      setError(msg);
    }
    finally { setLoading(false); }
  };

  const goStep = (i) => { setStep(i); setResult(null); setError(''); };

  useEffect(() => {
    api.get('/shiprocket/next-order-id').then(res => {
      setOrder(p => ({ ...p, order_number: res.data.data.order_id }));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const state = location.state;
    if (!state?.rts) return;
    const r = state.rts;
    const fullName = (r.lead?.name || '').trim();
    const address = [r.houseNo, r.postOffice].filter(Boolean).join(', ');
    let productName = r.title || 'Migraine Medicines';
    if (productName.toLowerCase().startsWith('call ') || productName.trim() === fullName) productName = 'Migraine Medicines';
    setOrder(p => ({
      ...p,
      customer: { ...p.customer, name: fullName, phone: r.lead?.phone || '', email: r.lead?.email || '', address: address || r.lead?.address || '', landmark: r.landmark || '', city: r.cityVillage || r.district || '', pincode: r.pincode || '', state: r.state || '' },
      products: [{ ...p.products[0], name: productName, sku: productName, price: r.price || '' }],
    }));
    if (r._id) setRtsId(r._id);
    setSection('actions'); setStep(1);
    window.history.replaceState({}, '');
  }, [location.state]);

  const renderStep = () => {
    // Step 0: Login
    if (step === 0) return (
      <div className="space-y-4 max-w-md animate-in fade-in duration-200">
        <p className="text-sm text-gray-500">Provide your ShipMaxx API credentials.</p>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="h-1 bg-blue-500" />
          <div className="px-5 py-4 space-y-3">
            <h3 className="font-semibold text-gray-800 text-sm">Option 1: Email & Password</h3>
            <Field label="Base URL"><input className={inp} value={authBaseUrl} onChange={e => setAuthBaseUrl(e.target.value)} /></Field>
            <Field label="Email"><input className={inp} placeholder="admin@example.com" value={authEmail} onChange={e => setAuthEmail(e.target.value)} /></Field>
            <Field label="Password"><input className={inp} type="password" placeholder="••••••••" value={authPassword} onChange={e => setAuthPassword(e.target.value)} /></Field>
          </div>
          <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 space-y-3">
            <h3 className="font-semibold text-gray-800 text-sm">Option 2: Bearer Token</h3>
            <Field label="API Key (Bearer Token)"><input className={inp} type="password" placeholder="Paste Token starting with eyJ..." value={authApiKey} onChange={e => setAuthApiKey(e.target.value)} /></Field>
          </div>
        </div>
        <button onClick={() => call(async () => {
          if (!authApiKey && (!authEmail || !authPassword)) throw new Error('Provide a Bearer Token OR Email & Password');
          const res = await smxSvc.login(authEmail, authPassword, authApiKey, authBaseUrl);
          const t = res.data?.data?.token || res.data?.token || authApiKey || 'active';
          if (t) { saveToken(t); setToken(t); }
          return res.data;
        })} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition w-full">
          Save Credentials & Login
        </button>
        {token && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
            <span className="text-green-700 text-sm font-semibold">Token active — valid 24 hours</span>
          </div>
        )}
      </div>
    );

    // Step 1: Create Order
    if (step === 1) return (
      <div className="space-y-5 animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="h-1 bg-blue-500" />
          <div className="px-5 py-3 border-b border-gray-50"><h3 className="font-semibold text-gray-700 text-sm">Order Info</h3></div>
          <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Field label="Order Number *"><input className={inp} value={order.order_number} onChange={e => setOrder(p => ({ ...p, order_number: e.target.value }))} /></Field>
            <Field label="Pickup Address ID *"><input className={inp} type="number" value={order.pickup_address_id} onChange={e => { const v = e.target.value; localStorage.setItem('smx_pickup', v); setOrder(p => ({ ...p, pickup_address_id: v })); }} /></Field>
            <Field label="Channel ID *"><input className={inp} type="number" value={order.channel_id} onChange={e => { const v = e.target.value; localStorage.setItem('smx_channel', v); setOrder(p => ({ ...p, channel_id: v })); }} /></Field>
            <Field label="Payment Method *">
              <select className={inp} value={order.payment_method} onChange={e => setOrder(p => ({ ...p, payment_method: e.target.value }))}>
                <option value="prepaid">Prepaid</option>
                <option value="cod">COD</option>
              </select>
            </Field>
            <Field label="Other Charges"><input className={inp} type="number" value={order.other_charges} onChange={e => setOrder(p => ({ ...p, other_charges: e.target.value }))} /></Field>
            <Field label="Total Discount"><input className={inp} type="number" value={order.total_discount} onChange={e => setOrder(p => ({ ...p, total_discount: e.target.value }))} /></Field>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="h-1 bg-green-500" />
          <div className="px-5 py-3 border-b border-gray-50"><h3 className="font-semibold text-gray-700 text-sm">Customer Details</h3></div>
          <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[['name','Full Name *'],['phone','Phone *'],['address','Address *'],['pincode','Pincode *'],['city','City *'],['state','State *'],['email','Email'],['landmark','Landmark']].map(([k, label]) => (
              <Field key={k} label={label}><input className={inp} value={order.customer[k]} onChange={e => setC(k, e.target.value)} /></Field>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="h-1 bg-purple-500" />
          <div className="px-5 py-3 border-b border-gray-50"><h3 className="font-semibold text-gray-700 text-sm">Product & Package</h3></div>
          <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="SKU *"><input className={inp} value={order.products[0].sku} onChange={e => setProduct('sku', e.target.value)} /></Field>
            <Field label="Name *"><input className={inp} value={order.products[0].name} onChange={e => setProduct('name', e.target.value)} /></Field>
            <Field label="Price (₹) *"><input className={inp} type="number" value={order.products[0].price} onChange={e => setProduct('price', e.target.value)} /></Field>
            <Field label="Qty *"><input className={inp} type="number" min="1" value={order.products[0].quantity} onChange={e => setProduct('quantity', Number(e.target.value))} /></Field>
            {[['weight','Weight (kg)'],['length','Length (cm)'],['width','Width (cm)'],['height','Height (cm)']].map(([k, label]) => (
              <Field key={k} label={label}><input className={inp} type="number" value={order.package[k]} onChange={e => setPkg(k, Number(e.target.value))} /></Field>
            ))}
          </div>
        </div>
        <button onClick={() => call(async () => {
          const c = order.customer;
          const missing = ['order_number','pickup_address_id','channel_id'].filter(k => !order[k])
            .concat(['name','phone','address','pincode','city','state'].filter(k => !c[k]))
            .concat(['name','sku','price'].filter(k => !order.products[0][k]));
          if (missing.length) throw new Error(`Please fill: ${missing.join(', ')}`);
          const payload = { pickup_address_id: Number(order.pickup_address_id), channel_id: Number(order.channel_id), payment_method: order.payment_method, order_number: order.order_number, customer: { ...c }, products: [{ ...order.products[0], price: Number(order.products[0].price), quantity: Number(order.products[0].quantity) }], package: { ...order.package }, other_charges: Number(order.other_charges) || 0, total_discount: Number(order.total_discount) || 0 };
          const res = await smxSvc.createOrder(payload);
          const d = res.data?.data || res.data;
          const extracted = res.data?.data?.extracted_order_id || d?.extracted_order_id || d?.order_id || d?.id;
          if (extracted) { setSmxOrderId(String(extracted)); setTimeout(() => goStep(2), 1200); }
          if (rtsId) { api.patch(`/ready-to-shipment/${rtsId}/sent`).catch(() => {}); }
          return res.data;
        })} className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition w-full sm:w-auto active:scale-95 shadow-md">
          Create Order → Proceed to Create Shipment
        </button>
      </div>
    );

    // Step 2: Create Shipment
    if (step === 2) return (
      <div className="space-y-4 max-w-md animate-in fade-in duration-200">
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
          KYC must be approved & wallet must have balance. Carrier auto-selected if no variant ID.
        </div>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="h-1 bg-blue-500" />
          <div className="px-5 py-4 space-y-3">
            <Field label="ShipMaxx Order ID"><input className={inp} value={smxOrderId} onChange={e => setSmxOrderId(e.target.value)} placeholder="From Step 1" /></Field>
            <Field label="Warehouse ID (optional)"><input className={inp} type="number" value={warehouseId} onChange={e => setWarehouseId(e.target.value)} /></Field>
            <Field label="Carrier Variant ID (optional)"><input className={inp} type="number" value={carrierVariantId} onChange={e => setCarrierVariantId(e.target.value)} /></Field>
          </div>
        </div>
        <button onClick={() => call(async () => {
          if (!smxOrderId) throw new Error('order_id is required');
          const payload = { order_id: smxOrderId };
          if (warehouseId) payload.warehouse_id = Number(warehouseId);
          if (carrierVariantId) payload.carrier_variant_id = Number(carrierVariantId);
          const res = await smxSvc.createShipment(payload);
          const d = res.data?.data || res.data;
          const awb = d?.awb || d?.awb_number;
          if (awb) { setAwbCode(String(awb)); setTimeout(() => goStep(3), 1200); }
          return res.data;
        })} className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition w-full sm:w-auto active:scale-95 shadow-md">
          Create Shipment → Get AWB
        </button>
      </div>
    );

    // Step 3: Generate Label
    if (step === 3) return (
      <div className="space-y-4 max-w-md animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="h-1 bg-purple-500" />
          <div className="px-5 py-4 space-y-3">
            <Field label="AWB Number (auto-filled)">
              <input className={inp} value={awbCode} onChange={e => setAwbCode(e.target.value)} placeholder="AWB from Step 2" />
            </Field>
          </div>
        </div>
        <button onClick={() => call(async () => {
          if (!awbCode) throw new Error('AWB is required');
          const res = await smxSvc.generateLabel(awbCode.trim());
          return res.data;
        })} className="px-6 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 transition w-full sm:w-auto active:scale-95 shadow-md">
          Generate Label
        </button>
        {result && (result.data?.label_url || result.label_url) && (
          <a href={result.data?.label_url || result.label_url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 text-white text-sm font-semibold px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 transition shadow-md">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Open Label PDF
          </a>
        )}
        {result && !result.data?.label_url && !result.label_url && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-2">
            <p className="text-amber-800 text-sm font-semibold">Label not available via API</p>
            <p className="text-amber-700 text-xs">ShipMaxx does not support label generation via API for this shipment. Please download directly from your ShipMaxx dashboard.</p>
            <a href="https://appapi.losung360.com" target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-amber-600 text-white hover:bg-amber-700 transition">
              Open ShipMaxx Dashboard
            </a>
          </div>
        )}
        <a href="https://appapi.losung360.com" target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600 transition">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Open ShipMaxx Dashboard
        </a>
      </div>
    );

    // Step 4: Track
    if (step === 4) return (
      <div className="space-y-4 max-w-md animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="h-1 bg-blue-500" />
          <div className="px-5 py-4 space-y-3">
            <Field label="AWB Number (auto-filled)">
              <input className={inp} value={awbCode} onChange={e => setAwbCode(e.target.value)} placeholder="AWB from Step 2" />
            </Field>
          </div>
        </div>
        <button onClick={() => call(async () => {
          if (!awbCode) throw new Error('AWB is required');
          const res = await smxSvc.trackShipment(awbCode.trim());
          return res.data;
        })} className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition w-full sm:w-auto active:scale-95 shadow-md">
          Track Shipment
        </button>
        {result && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="h-1 bg-blue-500" />
            <div className="px-5 py-4">
              {(result.data?.current_status || result.current_status) && (
                <div className="mb-3"><span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-700">{result.data?.current_status || result.current_status}</span></div>
              )}
              <pre className="text-xs text-gray-600 bg-gray-50 rounded-xl p-3 overflow-auto max-h-48">{JSON.stringify(result.data || result, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
    );

    // Step 5: Invoice
    if (step === 5) return (
      <div className="space-y-4 max-w-md animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="h-1 bg-orange-500" />
          <div className="px-5 py-4 space-y-3">
            <Field label="ShipMaxx Order ID (auto-filled)">
              <input className={inp} value={smxOrderId} onChange={e => setSmxOrderId(e.target.value)} placeholder="Order ID from Step 1" />
            </Field>
          </div>
        </div>
        <button onClick={() => call(async () => {
          if (!smxOrderId) throw new Error('order_id is required');
          const res = await smxSvc.getInvoice(smxOrderId.trim());
          const url = res.data?.data?.invoice_url || res.data?.invoice_url;
          if (url) window.open(url, '_blank');
          return res.data;
        })} className="px-6 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition w-full sm:w-auto active:scale-95 shadow-md">
          Download Invoice
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4 p-1 sm:p-2">
      {/* Section Tabs */}
      <div className="flex justify-start sm:justify-end overflow-x-auto pb-1 scrollbar-hide shrink-0">
        <div className="inline-flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm whitespace-nowrap">
          {SECTIONS.map(item => {
            const active = section === item.id;
            return (
              <button key={item.id} onClick={() => { setSection(item.id); setResult(null); setError(''); }}
                className={`h-9 rounded-lg px-3.5 text-xs font-semibold transition-all inline-flex items-center gap-2 ${active ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
                <span className={`grid h-5 w-5 place-items-center rounded-md ${active ? 'bg-white/15 text-white' : 'bg-blue-50 text-blue-600'}`}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {section === 'orders' && <OrdersSection />}
      {section === 'track' && <TrackSection />}
      {section === 'import' && <ImportSection />}

      {section === 'actions' && (
        <>
          {/* Step Tabs */}
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {STEPS.map((s, i) => {
                const active = step === i;
                const completed = i < step;
                return (
                  <button key={i} onClick={() => goStep(i)}
                    className={`group relative flex min-w-[140px] items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-all ${active ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-sm' : completed ? 'border-gray-200 bg-white text-gray-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'}`}>
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${active ? 'bg-blue-600 text-white' : completed ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {completed ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.6} viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[10px] font-semibold uppercase text-gray-400">Step {i + 1}</span>
                      <span className="block truncate text-xs font-semibold">{s}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <span className="w-6 h-6 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center">{step + 1}</span>
            <h3 className="font-bold text-gray-800 text-sm">{STEPS[step]}</h3>
          </div>

          {renderStep()}

          {loading && (
            <div className="flex items-center gap-3 text-gray-400 text-sm py-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Processing…
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mt-2">
              <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span className="text-red-600 text-sm font-medium">{error}</span>
            </div>
          )}

          {result && !error && !(result.data?.label_url === null) && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mt-2">
              <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
              <span className="text-green-700 text-sm font-semibold">Success</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
