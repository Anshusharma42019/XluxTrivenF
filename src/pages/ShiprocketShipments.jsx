import { useState, useEffect } from 'react';
import * as srSvc from '../services/shiprocket.service';

const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 bg-white';
const Field = ({ label, children }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const STATUS_COLORS = {
  'DELIVERED':      'bg-emerald-50 text-emerald-700 border-emerald-200',
  'RTO DELIVERED':  'bg-orange-50 text-orange-700 border-orange-200',
  'IN TRANSIT':     'bg-blue-50 text-blue-700 border-blue-200',
  'OUT FOR DELIVERY': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'PICKUP SCHEDULED': 'bg-purple-50 text-purple-700 border-purple-200',
  'CANCELED':       'bg-red-50 text-red-700 border-red-200',
  'CANCELLED':      'bg-red-50 text-red-700 border-red-200',
  'NEW':            'bg-gray-50 text-gray-600 border-gray-200',
};

export default function ShiprocketShipments() {
  const [tab, setTab] = useState('list');
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [awbInput, setAwbInput] = useState('');
  const [shipmentIdInput, setShipmentIdInput] = useState('');
  const [trackData, setTrackData] = useState(null);
  const [cancelAwbs, setCancelAwbs] = useState('');

  const call = async (fn) => {
    setLoading(true); setError(''); setResult(null); setTrackData(null);
    try { const r = await fn(); setResult(r); }
    catch (e) { setError(e?.response?.data?.message || e.message); }
    finally { setLoading(false); }
  };

  const fetchShipments = async () => {
    setLoading(true); setError('');
    try {
      // /shipments endpoint returns: id, order_id, awb, status, created_at, charges
      // No courier/city/pincode — those come from /orders
      const res = await srSvc.getShipments();
      setShipments(res.data?.data?.data || []);
    } catch (e) { setError(e?.response?.data?.message || e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (tab === 'list') fetchShipments(); }, [tab]);

  const TABS = [
    { id: 'list', label: <><svg className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> Shipments</> },
    { id: 'track', label: <><svg className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Track</> },
    { id: 'cancel', label: <><svg className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> Cancel Shipment</> },
  ];

  const trackActivities = trackData?.tracking_data?.shipment_track_activities || [];
  const currentStatus = trackData?.tracking_data?.current_status;

  return (
    <div className="space-y-4">

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide shrink-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setResult(null); setError(''); setTrackData(null); }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all whitespace-nowrap ${tab === t.id ? 'bg-gray-800 text-white border-gray-800 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Shipments List */}
      {tab === 'list' && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="h-1 bg-green-500" />
          <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
            <span className="font-semibold text-gray-700 text-sm">All Shipments</span>
            <button onClick={fetchShipments} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-xl hover:bg-green-700 font-semibold">
              {loading ? 'Loading...' : '↻ Refresh'}
            </button>
          </div>

          {loading && (
            <div className="px-5 py-8 flex items-center justify-center gap-2 text-gray-400 text-sm">
              <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              Loading shipments...
            </div>
          )}
          {!loading && shipments.length === 0 && (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">No shipments found.</div>
          )}
          {!loading && shipments.length > 0 && (
          <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0 custom-scrollbar">
            {/* Desktop Table View */}
            <table className="hidden sm:table w-full text-sm">
              <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-[0.1em] sticky top-0 z-10">
                <tr>
                  {['Shipment ID', 'Order ID', 'AWB', 'Courier', 'Status', 'City', 'Date'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {shipments.map((s) => {
                  const ship = Array.isArray(s.shipments) ? s.shipments[0] : null;
                  const awb = ship?.awb || '';
                  const courier = ship?.courier || ship?.sr_courier_name || '';
                  const shipmentId = ship?.id || '—';
                  const city = s.customer_city || '';
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-[11px] text-gray-600">{shipmentId}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-gray-600 cursor-pointer hover:text-red-500"
                        onClick={() => { setCancelAwbs(String(s.id)); setTab('cancel'); }}>
                        {s.id}
                      </td>
                      <td
                        className={`px-4 py-3 font-mono text-[11px] ${awb ? 'text-blue-600 cursor-pointer hover:underline font-bold' : 'text-gray-400'}`}
                        onClick={() => { if (awb) { setAwbInput(awb); setTab('track'); } }}>
                        {awb || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-[11px] font-medium">{courier || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {s.status || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-[11px] font-medium">{city || '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-[11px] font-medium">{s.created_at?.split(',')[0] || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile Card View */}
            <div className="sm:hidden divide-y divide-gray-50">
              {shipments.map((s) => {
                const ship = Array.isArray(s.shipments) ? s.shipments[0] : null;
                const awb = ship?.awb || '';
                const courier = ship?.courier || ship?.sr_courier_name || '';
                const shipmentId = ship?.id || '—';
                const city = s.customer_city || '';
                return (
                  <div key={s.id} className="p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Shipment ID: {shipmentId}</p>
                        <p className="font-bold text-gray-900 text-sm mt-0.5">Order: {s.id}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {s.status || '—'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 bg-gray-50 rounded-xl p-2.5">
                      <div onClick={() => { if (awb) { setAwbInput(awb); setTab('track'); } }} className={awb ? 'cursor-pointer' : ''}>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">AWB Code</p>
                        <p className={`text-xs font-mono font-bold mt-0.5 ${awb ? 'text-blue-600 underline' : 'text-gray-400'}`}>{awb || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Courier</p>
                        <p className="text-xs font-bold text-gray-700 mt-0.5 truncate">{courier || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Location</p>
                        <p className="text-xs font-bold text-gray-700 mt-0.5 truncate">{city || '—'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Date</p>
                        <p className="text-[11px] font-bold text-gray-500 mt-0.5">{s.created_at?.split(',')[0] || '—'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button onClick={() => { setCancelAwbs(String(s.id)); setTab('cancel'); }}
                        className="flex-1 text-[11px] font-bold py-2 rounded-xl bg-red-50 text-red-600 border border-red-100 active:scale-95 transition-all">
                        CANCEL
                      </button>
                      <button onClick={() => { if (awb) { setAwbInput(awb); setTab('track'); } }}
                        className="flex-1 text-[11px] font-bold py-2 rounded-xl bg-blue-600 text-white shadow-md active:scale-95 transition-all disabled:opacity-50"
                        disabled={!awb}>
                        TRACK
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}
        </div>
      )}

      {/* Track */}
      {tab === 'track' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="h-1 bg-blue-500" />
            <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Field label="Track by AWB Code">
                  <input className={inp} placeholder="e.g. 1234567890" value={awbInput}
                    onChange={e => setAwbInput(e.target.value)} />
                </Field>
                <button onClick={() => call(async () => {
                  if (!awbInput) throw new Error('Enter AWB code');
                  const res = await srSvc.trackByAWB(awbInput);
                  setTrackData(res.data?.data);
                  return res.data;
                })} className="btn-primary w-full shadow-md active:scale-95 transition-all">Track by AWB</button>
              </div>
              <div className="space-y-3">
                <Field label="Track by Shipment ID">
                  <input className={inp} placeholder="e.g. 123456" value={shipmentIdInput}
                    onChange={e => setShipmentIdInput(e.target.value)} />
                </Field>
                <button onClick={() => call(async () => {
                  if (!shipmentIdInput) throw new Error('Enter Shipment ID');
                  const res = await srSvc.trackByShipment(shipmentIdInput);
                  setTrackData(res.data?.data);
                  return res.data;
                })} className="btn-primary w-full shadow-md active:scale-95 transition-all">Track by Shipment ID</button>
              </div>
            </div>
          </div>

          {trackData && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
              <div className="h-1 bg-blue-500" />
              <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
                <span className="font-semibold text-gray-700 text-sm">Tracking Timeline</span>
                {currentStatus && (
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${STATUS_COLORS[currentStatus] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {currentStatus}
                  </span>
                )}
              </div>
              {trackActivities.length > 0 ? (
                <div className="px-5 py-4 space-y-3">
                  {trackActivities.map((a, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full mt-0.5 shrink-0 ${i === 0 ? 'bg-green-500' : 'bg-gray-300'}`} />
                        {i < trackActivities.length - 1 && <div className="w-0.5 flex-1 bg-gray-100 mt-1" />}
                      </div>
                      <div className="pb-3">
                        <p className="text-sm font-semibold text-gray-800">{a.activity}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{a.date} · {a.location}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-4 text-sm text-gray-400">No tracking activities yet.</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cancel Shipment */}
      {tab === 'cancel' && (
        <div className="space-y-4 max-w-md">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="h-1 bg-red-500" />
            <div className="px-5 py-4 space-y-3">
              <Field label="Order IDs (comma separated)">
                <input className={inp} placeholder="e.g. 1202689352, 1202741886" value={cancelAwbs}
                  onChange={e => setCancelAwbs(e.target.value)} />
              </Field>
              <p className="text-xs text-gray-400">Enter Shiprocket Order IDs to cancel shipments. AWB-based cancellation is not supported by Shiprocket.</p>
            </div>
          </div>
          <button onClick={() => call(async () => {
            const ids = cancelAwbs.split(',').map(s => s.trim()).filter(Boolean).map(Number);
            if (!ids.length) throw new Error('Enter at least one Order ID');
            const res = await srSvc.cancelShipment(ids);
            return res.data;
          })} className="btn-primary bg-red-600 hover:bg-red-700">Cancel Shipment</button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <span className="text-red-600 text-sm font-medium">{error}</span>
        </div>
      )}
      {result && !trackData && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
          <span className="text-green-700 text-sm font-semibold">Success</span>
        </div>
      )}
    </div>
  );
}
