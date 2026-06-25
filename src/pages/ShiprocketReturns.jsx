import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as srSvc from '../services/shiprocket.service';
import OrderStatusBoard from '../components/OrderStatusBoard';

const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 bg-white';
const Field = ({ label, children }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const NDR_ATTEMPT_OPTIONS = [
  { value: 'all', label: 'All Attempts' },
  { value: '1', label: '1st Attempt' },
  { value: '2', label: '2nd Attempt' },
  { value: '3', label: '3rd Attempt' },
  { value: '4+', label: '4+ Attempts' },
];

const NDR_DETAIL_PRIORITY = [
  'awb_code',
  'channel_order_id',
  'order_id',
  'shipment_id',
  'customer_name',
  'customer_phone',
  'customer_email',
  'reason',
  'remarks',
  'comment',
  'action',
  'attempts',
  'ndr_raised_at',
  'current_status',
  'status',
  'courier_name',
  'payment_method',
  'pickup_date',
  'edd',
  'delivered_date',
  'address',
  'city',
  'state',
  'pincode',
];

const formatDetailLabel = (key) => String(key || '')
  .replace(/_/g, ' ')
  .replace(/\b\w/g, ch => ch.toUpperCase());

const formatDetailValue = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const TX_STATUSES = ['DELIVERED','RTO_DELIVERED','IN_TRANSIT','CANCELED','NEW','RTO_IN_TRANSIT',
  'OUT_FOR_DELIVERY','REACHED_BACK_AT_SELLER_CITY','UNDELIVERED-1ST ATTEMPT','PICKUP_EXCEPTION',
  'UNDELIVERED-2ND ATTEMPT','UNDELIVERED-3RD ATTEMPT','RTO_INITIATED','REACHED_AT_DESTINATION_HUB',
  'SHIPPED','RTO_OFD','PICKUP_SCHEDULED','MISROUTED','OUT_FOR_PICKUP','UNTRACEABLE'];

function StatusDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div ref={ref} className="relative flex-1 min-w-[150px]">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 bg-white hover:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-400 transition">
        <span>{value ? value.replace(/_/g,' ') : 'All Statuses'}</span>
        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          <div onClick={() => { onChange(''); setOpen(false); }}
            className={`px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-green-50 hover:text-green-700 rounded-t-xl ${!value ? 'bg-green-50 text-green-700' : 'text-gray-600'}`}>
            All Statuses
          </div>
          {TX_STATUSES.map(s => (
            <div key={s} onClick={() => { onChange(s); setOpen(false); }}
              className={`px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-green-50 hover:text-green-700 ${value === s ? 'bg-green-50 text-green-700' : 'text-gray-600'}`}>
              {s.replace(/_/g,' ')}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const detailCardCls = 'rounded-2xl border border-gray-200 bg-white px-4 py-4 sm:px-5';

export default function ShiprocketReturns({ initialTab = 'returns' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  // Returns
  const [returns, setReturns] = useState([]);
  const [returnsTotal, setReturnsTotal] = useState(0);
  const [returnsPage, setReturnsPage] = useState(1);
  const RETURNS_PER_PAGE = 20;
  const [returnForm, setReturnForm] = useState({
    order_id: '', channel_id: '', pickup_customer_name: '', pickup_phone: '',
    pickup_address: '', pickup_city: '', pickup_state: '', pickup_pincode: '',
    pickup_country: 'India', shipping_customer_name: '', shipping_phone: '',
    shipping_address: '', shipping_city: '', shipping_state: '', shipping_pincode: '',
    shipping_country: 'India', payment_method: 'prepaid', sub_total: '',
    order_items: [{ name: '', sku: '', units: 1, selling_price: '' }],
    weight: 0.5, length: 10, breadth: 10, height: 10,
  });

  // Wallet
  const [walletBalance, setWalletBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [txFrom, setTxFrom] = useState('');
  const [txTo, setTxTo] = useState('');
  const [txStatus, setTxStatus] = useState('');
  const [txPage, setTxPage] = useState(1);
  const [txTotal, setTxTotal] = useState(0);
  const TX_PER_PAGE = 20;

  // NDR
  const [ndrs, setNdrs] = useState([]);
  const [ndrAction, setNdrAction] = useState({ awb: '', action: 'reattempt', comment: '' });
  const [ndrFrom, setNdrFrom] = useState(() => new Date().toISOString().split('T')[0]);
  const [ndrTo, setNdrTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [ndrLoading, setNdrLoading] = useState(false);
  const [ndrAttemptFilter, setNdrAttemptFilter] = useState('all');
  const [selectedNdr, setSelectedNdr] = useState(null);
  const [ndrDetailOpen, setNdrDetailOpen] = useState(false);

  // Notes
  const [ndrNotes, setNdrNotes] = useState(() => {
    try {
      const saved = localStorage.getItem('ndr_notes');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [noteForm, setNoteForm] = useState({ name: '', phone: '', reason: '', awb: '', date: new Date().toISOString().split('T')[0] });
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteError, setNoteError] = useState('');
  const [notesFilterDate, setNotesFilterDate] = useState('');

  useEffect(() => {
    localStorage.setItem('ndr_notes', JSON.stringify(ndrNotes));
  }, [ndrNotes]);

  const fetchTransactions = (from = txFrom, to = txTo, status = txStatus, page = txPage) => {
    const params = { per_page: TX_PER_PAGE, page };
    if (from) params.from = from;
    if (to) params.to = to;
    if (status) params.status = status;
    srSvc.getWalletTransactions(params).then(r => {
      const d = r.data?.data;
      setTransactions(Array.isArray(d?.data) ? d.data : (Array.isArray(d) ? d : []));
      setTxTotal(d?.total || 0);
    }).catch(e => setError(e?.response?.data?.message || e.message));
  };

  const fetchReturns = (page = returnsPage) => {
    srSvc.getReturns({ page, per_page: RETURNS_PER_PAGE }).then(r => {
      const d = r.data?.data;
      setReturns(Array.isArray(d?.data) ? d.data : (Array.isArray(d) ? d : []));
      setReturnsTotal(d?.total || 0);
    }).catch(e => { setError(e?.response?.data?.message || e.message); });
  };

  const fetchNDR = (from = ndrFrom, to = ndrTo) => {
    setNdrLoading(true);
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    srSvc.getNDR(params).then(r => {
      const list = r.data?.data?.data || [];
      setNdrs(list);
      setSelectedNdr(current => {
        if (!current) return list[0] || null;
        const match = list.find(item => item.awb_code === current.awb_code && item.channel_order_id === current.channel_order_id);
        return match || list[0] || null;
      });
    }).catch(e => setError(e?.response?.data?.message || e.message))
      .finally(() => setNdrLoading(false));
  };

  // Create Return - orders list
  const [crOrders, setCrOrders] = useState([]);
  const [crLoading, setCrLoading] = useState(false);
  const [crSelected, setCrSelected] = useState(null);

  const loadOrdersForReturn = () => {
    setCrLoading(true);
    srSvc.getOrders().then(r => {
      const all = r.data?.data?.data || [];
      setCrOrders(all);
    }).catch(() => {}).finally(() => setCrLoading(false));
  };

  const call = async (fn) => {
    setLoading(true); setError(''); setResult(null);
    try { const r = await fn(); setResult(r); }
    catch (e) { setError(e?.response?.data?.message || e.message); }
    finally { setLoading(false); }
  };

  const setRF = (k, v) => setReturnForm(p => ({ ...p, [k]: v }));
  const setRI = (k, v) => setReturnForm(p => ({ ...p, order_items: [{ ...p.order_items[0], [k]: v }] }));
  const filteredNdrs = ndrs.filter((item) => {
    if (ndrAttemptFilter === 'all') return true;
    const attempts = Number(item.attempts ?? 1);
    if (ndrAttemptFilter === '4+') return attempts >= 4;
    return attempts === Number(ndrAttemptFilter);
  });
  const selectedNdrDetails = selectedNdr
    ? [
        ...NDR_DETAIL_PRIORITY.filter(key => key in selectedNdr).map(key => [key, selectedNdr[key]]),
        ...Object.entries(selectedNdr).filter(([key]) => !NDR_DETAIL_PRIORITY.includes(key)),
      ]
    : [];

  useEffect(() => {
    setTab(initialTab);
    setResult(null);
    setError('');
    setNdrDetailOpen(false);
  }, [initialTab]);

  useEffect(() => {
    if (!location.state?.prefillAwb) return;
    setNdrAction(p => ({ ...p, awb: location.state.prefillAwb }));
    window.history.replaceState({}, '');
  }, [location.state]);

  useEffect(() => {
    if (!filteredNdrs.length) {
      setSelectedNdr(null);
      return;
    }
    if (!selectedNdr) {
      setSelectedNdr(filteredNdrs[0]);
      return;
    }
    const stillVisible = filteredNdrs.some(item => item.awb_code === selectedNdr.awb_code && item.channel_order_id === selectedNdr.channel_order_id);
    if (!stillVisible) setSelectedNdr(filteredNdrs[0]);
  }, [filteredNdrs, selectedNdr]);

  useEffect(() => {
    if (tab === 'returns') {
      fetchReturns(1);
    }
    if (tab === 'create_return') {
      loadOrdersForReturn();
    }
    if (tab === 'wallet') {
      srSvc.getWalletBalance().then(r => {
        setWalletBalance(r.data?.data?.data);
      }).catch(e => { setError(e?.response?.data?.message || e.message); });
      fetchTransactions();
    }
    if (tab === 'ndr') {
      fetchNDR();
    }
    if (tab !== 'ndr') {
      setNdrDetailOpen(false);
    }
  }, [tab]);

  const TABS = [
    { id: 'returns', label: <><svg className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg> Returns</> },
    { id: 'create_return', label: <><svg className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> Create Return</> },
    { id: 'wallet', label: <><svg className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Wallet</> },
    { id: 'ndr', label: <><svg className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> NDR</> },
    { id: 'ndr_notes', label: <><svg className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Note</> },
  ];

  return (
    <div className="space-y-4">

      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setResult(null); setError(''); }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${tab === t.id ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'returns' && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="h-1 bg-orange-500" />
          <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
            <span className="font-semibold text-gray-700 text-sm">Return Orders {returnsTotal > 0 && <span className="text-xs text-gray-400 font-normal ml-1">({returnsTotal})</span>}</span>
          </div>
          {returns.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">No RTO orders found.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="hidden sm:table w-full text-sm">
                  <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-[0.1em] sticky top-0 z-10">
                    <tr>{['Order ID','AWB','Customer','Staff','Status','Amount','Date'].map(h => <th key={h} className="px-4 py-3 text-left font-bold">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {returns.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-[11px] text-gray-600">{r.order_id}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-blue-600 font-bold">
                          <a href={`https://shiprocket.co/tracking/${r.awb_code}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {r.awb_code || '—'}
                          </a>
                        </td>
                        <td className="px-4 py-3 font-bold text-gray-800 text-[13px]">{r.billing_customer_name || '—'}</td>
                        <td className="px-4 py-3 text-gray-600 text-[11px] font-bold">{r.staff_name || '-'}</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-bold bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full border border-orange-100">{r.status || '—'}</span>
                        </td>
                        <td className="px-4 py-3 font-bold text-gray-900 text-[12px]">{r.sub_total ? `₹${r.sub_total}` : '—'}</td>
                        <td className="px-4 py-3 text-gray-400 text-[11px] font-medium">{r.return_date ? new Date(r.return_date).toLocaleDateString('en-IN') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="sm:hidden divide-y divide-gray-50">
                  {returns.map((r, i) => (
                    <div key={i} className="p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 text-sm truncate">{r.billing_customer_name || 'Unknown'}</p>
                          <p className="text-[10px] font-mono text-gray-400 uppercase mt-0.5">ID: {r.order_id}</p>
                          <p className="text-[10px] font-bold text-gray-500 uppercase mt-1">Staff: {r.staff_name || '-'}</p>
                        </div>
                        <span className="text-[10px] font-bold bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full border border-orange-100">{r.status || '—'}</span>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-2.5 flex items-center justify-between">
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">AWB</p>
                          <p className="text-xs font-mono text-blue-600 font-bold mt-0.5">
                            <a href={`https://shiprocket.co/tracking/${r.awb_code}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              {r.awb_code || '—'}
                            </a>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Amount</p>
                          <p className="text-xs font-bold text-gray-700 mt-0.5">{r.sub_total ? `₹${r.sub_total}` : '—'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {returnsTotal > RETURNS_PER_PAGE && (
                <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between">
                  <span className="text-xs text-gray-400">{((returnsPage-1)*RETURNS_PER_PAGE)+1}–{Math.min(returnsPage*RETURNS_PER_PAGE, returnsTotal)} of {returnsTotal}</span>
                  <div className="flex items-center gap-1">
                    <button disabled={returnsPage===1} onClick={() => { const p=returnsPage-1; setReturnsPage(p); fetchReturns(p); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">← Prev</button>
                    {Array.from({length:Math.ceil(returnsTotal/RETURNS_PER_PAGE)},(_,i)=>i+1)
                      .filter(p=>p===1||p===Math.ceil(returnsTotal/RETURNS_PER_PAGE)||Math.abs(p-returnsPage)<=1)
                      .reduce((acc,p,i,arr)=>{ if(i>0&&p-arr[i-1]>1) acc.push('…'); acc.push(p); return acc; },[])
                      .map((p,i)=> p==='…'
                        ? <span key={`ellipsis-${i}`} className="px-1 text-xs text-gray-400">…</span>
                        : <button key={p} onClick={()=>{ setReturnsPage(p); fetchReturns(p); }}
                            className={`w-8 h-8 rounded-lg text-xs font-bold border transition ${returnsPage===p?'bg-orange-500 text-white border-orange-500':'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{p}</button>
                      )}
                    <button disabled={returnsPage===Math.ceil(returnsTotal/RETURNS_PER_PAGE)} onClick={()=>{ const p=returnsPage+1; setReturnsPage(p); fetchReturns(p); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">Next →</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Create Return */}
      {tab === 'create_return' && (
        <div className="space-y-4">
          {/* Orders list to pick from */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="h-1 bg-orange-500" />
            <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
              <span className="font-semibold text-gray-700 text-sm">Select Order to Return</span>
              <button onClick={loadOrdersForReturn} className="text-xs bg-orange-600 text-white px-3 py-1.5 rounded-xl hover:bg-orange-700 font-semibold">
                {crLoading ? 'Loading...' : '↻ Refresh'}
              </button>
            </div>
            {crOrders.length === 0 ? (
              <div className="px-5 py-6 text-center text-gray-400 text-sm">{crLoading ? 'Loading orders...' : 'No orders found.'}</div>
            ) : (
              <div className="divide-y divide-gray-50 max-h-64 overflow-auto">
                {crOrders.map((o, i) => (
                  <div key={i} onClick={() => {
                    setCrSelected(o);
                    setRF('order_id', String(o.channel_order_id || o.id || ''));
                    setRF('channel_id', String(o.channel_id || ''));
                    setRF('pickup_customer_name', o.customer_name || '');
                    setRF('pickup_phone', o.customer_phone || '');
                    setRF('pickup_address', o.customer_address || '');
                    setRF('pickup_city', o.customer_city || '');
                    setRF('pickup_state', o.customer_state || '');
                    setRF('pickup_pincode', String(o.customer_pincode || ''));
                    setRF('shipping_customer_name', o.customer_name || '');
                    setRF('shipping_phone', o.customer_phone || '');
                    setRF('shipping_address', o.customer_address || '');
                    setRF('shipping_city', o.customer_city || '');
                    setRF('shipping_state', o.customer_state || '');
                    setRF('shipping_pincode', String(o.customer_pincode || ''));
                    setRF('sub_total', o.total || '');
                    if (o.products?.[0]) {
                      setRI('name', o.products[0].name || '');
                      setRI('sku', o.products[0].channel_sku || '');
                      setRI('units', o.products[0].quantity || 1);
                      setRI('selling_price', o.products[0].selling_price || '');
                    }
                  }}
                    className={`px-5 py-3 flex items-center gap-3 cursor-pointer hover:bg-orange-50/50 transition-colors ${crSelected?.id === o.id ? 'bg-orange-50' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm">{o.customer_name} <span className="font-mono text-xs text-gray-400 ml-1">{o.channel_order_id}</span></p>
                      <p className="text-xs text-gray-400 mt-0.5">{o.customer_city}, {o.customer_state} · ₹{o.total} · <span className={`font-semibold ${o.status === 'DELIVERED' ? 'text-green-600' : 'text-gray-500'}`}>{o.status}</span></p>
                    </div>
                    {crSelected?.id === o.id && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-semibold">✓ Selected</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="h-1 bg-orange-500" />
            <div className="px-5 py-3 border-b border-gray-50"><span className="font-semibold text-gray-700 text-sm">Return Details</span></div>
            <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[['order_id','Order ID'],['channel_id','Channel ID'],['payment_method','Payment Method']].map(([k,l]) => (
                <Field key={k} label={l}>
                  {k === 'payment_method'
                    ? <select className={inp} value={returnForm[k]} onChange={e => setRF(k, e.target.value)}><option value="prepaid">Prepaid</option><option value="COD">COD</option></select>
                    : <input className={inp} value={returnForm[k]} onChange={e => setRF(k, e.target.value)} />}
                </Field>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="h-1 bg-blue-500" />
            <div className="px-5 py-3 border-b border-gray-50"><span className="font-semibold text-gray-700 text-sm">Pickup Address</span></div>
            <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[['pickup_customer_name','Name'],['pickup_phone','Phone'],['pickup_address','Address'],
                ['pickup_city','City'],['pickup_state','State'],['pickup_pincode','Pincode']].map(([k,l]) => (
                <Field key={k} label={l}><input className={inp} value={returnForm[k]} onChange={e => setRF(k, e.target.value)} /></Field>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="h-1 bg-purple-500" />
            <div className="px-5 py-3 border-b border-gray-50"><span className="font-semibold text-gray-700 text-sm">Product</span></div>
            <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Field label="Name"><input className={inp} value={returnForm.order_items[0].name} onChange={e => setRI('name', e.target.value)} /></Field>
              <Field label="SKU"><input className={inp} value={returnForm.order_items[0].sku} onChange={e => setRI('sku', e.target.value)} /></Field>
              <Field label="Units"><input className={inp} type="number" value={returnForm.order_items[0].units} onChange={e => setRI('units', Number(e.target.value))} /></Field>
              <Field label="Price"><input className={inp} type="number" value={returnForm.order_items[0].selling_price} onChange={e => setRI('selling_price', e.target.value)} /></Field>
            </div>
            <div className="px-5 pb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[['weight','Weight (kg)'],['length','L (cm)'],['breadth','B (cm)'],['height','H (cm)'],['sub_total','Sub Total']].map(([k,l]) => (
                <Field key={k} label={l}><input className={inp} type="number" value={returnForm[k]} onChange={e => setRF(k, Number(e.target.value))} /></Field>
              ))}
            </div>
          </div>

          <button onClick={() => call(async () => {
            const res = await srSvc.createReturn(returnForm);
            return res.data;
          })} className="btn-primary">Create Return Order</button>
        </div>
      )}

      {/* Wallet */}
      {tab === 'wallet' && (
        <div className="space-y-4">
          {walletBalance && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
              <div className="h-1 bg-green-500" />
              <div className="px-5 py-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Wallet Balance</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">₹{walletBalance.balance_amount ?? walletBalance.wallet_balance ?? '—'}</p>
              </div>
            </div>
          )}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="h-1 bg-green-500" />
            <div className="px-5 py-3 border-b border-gray-50">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-gray-700 text-sm">Transactions {txTotal > 0 && <span className="text-xs text-gray-400 font-normal ml-1">({txTotal})</span>}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusDropdown value={txStatus} onChange={v => { setTxStatus(v); setTxPage(1); fetchTransactions(txFrom, txTo, v, 1); }} />
                <input type="date" value={txFrom} onChange={e => { setTxFrom(e.target.value); setTxPage(1); fetchTransactions(e.target.value, txTo, txStatus, 1); }}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-green-400 bg-white" />
                <input type="date" value={txTo} onChange={e => { setTxTo(e.target.value); setTxPage(1); fetchTransactions(txFrom, e.target.value, txStatus, 1); }}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-green-400 bg-white" />
              </div>
            </div>
            {transactions.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">No transactions found.</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="hidden sm:table w-full text-sm">
                    <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-[0.1em] sticky top-0 z-10">
                      <tr>{['Date','Type','Amount','Status','Note'].map(h => <th key={h} className="px-4 py-3 text-left font-bold">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {transactions.map((t, i) => (
                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 text-[11px] text-gray-400 font-medium">{(t.transaction_date || t.created_at)?.split('T')[0]}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${t.type === 'prepaid' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                              {t.type?.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-gray-900 text-[13px]">₹{t.amount}</td>
                          <td className="px-4 py-3 text-[11px] font-semibold text-gray-600">{t.status || '—'}</td>
                          <td className="px-4 py-3 text-gray-400 text-[11px] max-w-[250px] truncate" title={t.note}>{t.note || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="sm:hidden divide-y divide-gray-50">
                    {transactions.map((t, i) => (
                      <div key={i} className="p-4 flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${t.type === 'prepaid' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>{t.type?.toUpperCase()}</span>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">{(t.transaction_date || t.created_at)?.split('T')[0]}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900 text-base">₹{t.amount}</p>
                            <p className="text-[10px] font-bold text-gray-400 mt-1">{t.status}</p>
                          </div>
                        </div>
                        {t.note && <div className="bg-gray-50 rounded-xl p-2.5"><p className="text-[11px] text-gray-600 font-medium leading-relaxed">{t.note}</p></div>}
                      </div>
                    ))}
                  </div>
                </div>
                {txTotal > TX_PER_PAGE && (
                  <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between">
                    <span className="text-xs text-gray-400">{((txPage-1)*TX_PER_PAGE)+1}–{Math.min(txPage*TX_PER_PAGE, txTotal)} of {txTotal}</span>
                    <div className="flex items-center gap-1">
                      <button disabled={txPage===1} onClick={() => { const p=txPage-1; setTxPage(p); fetchTransactions(txFrom,txTo,txStatus,p); }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">← Prev</button>
                      {Array.from({length: Math.ceil(txTotal/TX_PER_PAGE)},(_,i)=>i+1)
                        .filter(p=>p===1||p===Math.ceil(txTotal/TX_PER_PAGE)||Math.abs(p-txPage)<=1)
                        .reduce((acc,p,i,arr)=>{ if(i>0&&p-arr[i-1]>1) acc.push('…'); acc.push(p); return acc; },[])
                        .map((p,i)=> p==='…'
                          ? <span key={`ellipsis-${i}`} className="px-1 text-xs text-gray-400">…</span>
                          : <button key={p} onClick={()=>{ setTxPage(p); fetchTransactions(txFrom,txTo,txStatus,p); }}
                              className={`w-8 h-8 rounded-lg text-xs font-bold border transition ${txPage===p?'bg-green-600 text-white border-green-600':'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{p}</button>
                        )}
                      <button disabled={txPage===Math.ceil(txTotal/TX_PER_PAGE)} onClick={()=>{ const p=txPage+1; setTxPage(p); fetchTransactions(txFrom,txTo,txStatus,p); }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">Next →</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* NDR */}
      {tab === 'ndr' && (
        <div className="space-y-4">
          <OrderStatusBoard title="Order Status" defaultStatus="UNDELIVERED-1ST_ATTEMPT" />

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="h-1 bg-red-500" />
            <div className="px-5 py-3 border-b border-gray-50"><span className="font-semibold text-gray-700 text-sm">NDR Action</span></div>
            <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Field label="AWB Code">
                <input className={inp} placeholder="AWB number" value={ndrAction.awb}
                  onChange={e => setNdrAction(p => ({ ...p, awb: e.target.value }))} />
              </Field>
              <Field label="Action">
                <select className={inp} value={ndrAction.action}
                  onChange={e => setNdrAction(p => ({ ...p, action: e.target.value }))}>
                  <option value="reattempt">Re-attempt Delivery</option>
                  <option value="return">Return to Origin</option>
                </select>
              </Field>
              <Field label="Comment">
                <input className={inp} placeholder="Optional comment" value={ndrAction.comment}
                  onChange={e => setNdrAction(p => ({ ...p, comment: e.target.value }))} />
              </Field>
            </div>
            <div className="px-5 pb-4">
              <button onClick={() => call(async () => {
                if (!ndrAction.awb) throw new Error('Enter AWB code');
                const res = await srSvc.ndrAction(ndrAction);
                return res.data;
              })} className="btn-primary">Submit NDR Action</button>
            </div>
          </div>

          {ndrDetailOpen && selectedNdr && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
              <div className="h-1 bg-red-500" />
              <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-gray-100 flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <button
                    onClick={() => setNdrDetailOpen(false)}
                    className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                    Back to NDR List
                  </button>
                  <h3 className="text-2xl font-bold text-gray-800 tracking-tight">Full Details</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    {selectedNdr.customer_name?.trim() || 'Unknown Customer'} - {selectedNdr.awb_code || '-'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setNdrAction(p => ({ ...p, awb: selectedNdr.awb_code || p.awb }));
                    setNdrDetailOpen(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-sm bg-white text-red-600 px-4 py-2 rounded-xl hover:bg-red-50 font-semibold border border-red-100"
                >
                  Use AWB in Action
                </button>
              </div>
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {selectedNdrDetails.map(([key, value]) => (
                    <div key={key} className={detailCardCls}>
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{formatDetailLabel(key)}</p>
                      <p className="text-lg sm:text-[1.05rem] font-bold text-slate-800 mt-2 break-words">{formatDetailValue(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!ndrDetailOpen && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="h-1 bg-red-500" />
            <div className="px-5 py-3 border-b border-gray-50 flex flex-col gap-4 bg-gray-50/30">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-700 text-sm uppercase tracking-widest">NDR List</span>
                <span className="text-[10px] font-bold text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-100">{filteredNdrs.length} Records</span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <select
                  value={ndrAttemptFilter}
                  onChange={e => setNdrAttemptFilter(e.target.value)}
                  className="flex-1 min-w-[120px] border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-400/20 bg-white font-semibold"
                >
                  {NDR_ATTEMPT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2 flex-1">
                  <input type="date" value={ndrFrom} onChange={e => setNdrFrom(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-400/20 bg-white" />
                  <input type="date" value={ndrTo} onChange={e => setNdrTo(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-400/20 bg-white" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => fetchNDR(ndrFrom, ndrTo)}
                    className="flex-1 sm:px-6 py-2.5 rounded-xl bg-red-600 text-white text-[11px] font-bold shadow-md hover:bg-red-700 transition active:scale-95">
                    {ndrLoading ? '...' : 'SEARCH'}
                  </button>
                  {(ndrFrom || ndrTo) && (
                    <button onClick={() => { setNdrFrom(''); setNdrTo(''); fetchNDR('', ''); }}
                      className="px-4 py-2.5 rounded-xl bg-gray-200 text-gray-600 text-[11px] font-bold hover:bg-gray-300 transition active:scale-95">RESET</button>
                  )}
                </div>
              </div>
            </div>
            {false && selectedNdr && (
              <div className="px-5 py-4 border-b border-gray-50 bg-gray-50/70">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Full Details</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {selectedNdr.customer_name?.trim() || 'Unknown Customer'} · {selectedNdr.awb_code || 'No AWB'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setNdrAction(p => ({ ...p, awb: selectedNdr.awb_code || p.awb }));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="text-xs bg-white text-red-600 px-3 py-1.5 rounded-xl hover:bg-red-50 font-semibold border border-red-100"
                  >
                    Use AWB in Action
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {selectedNdrDetails.map(([key, value]) => (
                    <div key={key} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{formatDetailLabel(key)}</p>
                      <p className="text-sm font-semibold text-gray-700 break-words mt-1">{formatDetailValue(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {filteredNdrs.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">No NDR records found.</div>
            ) : (
              <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0 custom-scrollbar">
                {/* Desktop Table View */}
                <table className="hidden sm:table w-full text-sm">
                  <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-[0.1em] sticky top-0 z-10">
                    <tr>{['AWB', 'Order ID', 'Customer', 'Reason', 'Attempts', 'Date', 'Action'].map(h => <th key={h} className="px-4 py-3 text-left font-bold">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredNdrs.map((n, i) => (
                      <tr key={i} className={`hover:bg-gray-50/50 transition-colors ${selectedNdr?.awb_code === n.awb_code ? 'bg-red-50/40' : ''}`}>
                        <td className="px-4 py-3 font-mono text-[11px] text-blue-600 font-bold cursor-pointer hover:underline"
                          onClick={() => {
                            setNdrAction(p => ({ ...p, awb: n.awb_code }));
                            setSelectedNdr(n);
                          }}>
                          <a href={`https://shiprocket.co/tracking/${n.awb_code}`} target="_blank" rel="noopener noreferrer" className="hover:underline" onClick={e => e.stopPropagation()}>
                            {n.awb_code}
                          </a>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-gray-600">{n.channel_order_id}</td>
                        <td className="px-4 py-3 font-bold text-gray-800 text-[13px]">{n.customer_name?.trim() || '—'}</td>
                        <td className="px-4 py-3 text-[11px] text-gray-500 max-w-[200px] truncate" title={n.reason}>{n.reason || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-block w-6 h-6 rounded-lg bg-gray-100 text-gray-700 font-bold text-[11px] flex items-center justify-center border border-gray-200">{n.attempts ?? 1}</span>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-gray-400">{n.ndr_raised_at?.split(' ')[0]}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedNdr(n);
                                navigate('/shiprocket/ndr/detail', { state: { ndr: n } });
                              }}
                              className="text-[10px] font-bold px-3 py-1.5 rounded-xl bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 shadow-sm transition active:scale-95"
                            >
                              VIEW
                            </button>
                            <button onClick={() => {
                              setSelectedNdr(n);
                              setNdrAction({ awb: n.awb_code, action: 'return', comment: 'Return to Origin' });
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }} className="text-[10px] font-bold px-3 py-1.5 rounded-xl bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white border border-orange-100 shadow-sm transition active:scale-95">
                              RTO
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile Card View */}
                <div className="sm:hidden divide-y divide-gray-50">
                  {filteredNdrs.map((n, i) => (
                    <div key={i} className={`p-4 flex flex-col gap-3 ${selectedNdr?.awb_code === n.awb_code ? 'bg-red-50/20' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 text-sm truncate">{n.customer_name?.trim() || 'Unknown'}</p>
                          <p className="text-[10px] font-mono text-blue-600 font-bold uppercase mt-0.5">
                            AWB: <a href={`https://shiprocket.co/tracking/${n.awb_code}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{n.awb_code}</a>
                          </p>
                        </div>
                        <div className="shrink-0 flex flex-col items-end">
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Attempt</span>
                          <span className="w-6 h-6 rounded-lg bg-gray-100 text-gray-700 font-bold text-[11px] flex items-center justify-center border border-gray-200">
                            {n.attempts ?? 1}
                          </span>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">NDR Reason</p>
                        <p className="text-xs text-gray-700 mt-1 leading-relaxed">{n.reason || 'No reason provided'}</p>
                        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-200/50 text-[10px] text-gray-400 font-bold">
                          <span>ORDER: {n.channel_order_id}</span>
                          <span className="w-1 h-1 rounded-full bg-gray-300" />
                          <span>RAISED: {n.ndr_raised_at?.split(' ')[0]}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedNdr(n);
                            navigate('/shiprocket/ndr/detail', { state: { ndr: n } });
                          }}
                          className="flex-1 text-[11px] font-bold py-2 rounded-xl bg-white text-gray-600 border border-gray-200 shadow-sm active:scale-95 transition-all"
                        >
                          VIEW DETAILS
                        </button>
                        <button onClick={() => {
                          setSelectedNdr(n);
                          setNdrAction({ awb: n.awb_code, action: 'return', comment: 'Return to Origin' });
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }} className="flex-1 text-[11px] font-bold py-2 rounded-xl bg-orange-600 text-white shadow-md active:scale-95 transition-all">
                          RTO
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      )}

      {tab === 'ndr_notes' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="h-1 bg-yellow-500" />
            <div className="px-5 py-3 border-b border-gray-50"><span className="font-semibold text-gray-700 text-sm">Add New Note</span></div>
            <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <Field label="Date"><input type="date" className={inp} value={noteForm.date} onChange={e => setNoteForm(p => ({ ...p, date: e.target.value }))} /></Field>
              <Field label="Name"><input className={inp} value={noteForm.name} onChange={e => setNoteForm(p => ({ ...p, name: e.target.value }))} placeholder="Customer Name" /></Field>
              <Field label="Phone Number"><input className={inp} value={noteForm.phone} onChange={e => setNoteForm(p => ({ ...p, phone: e.target.value }))} placeholder="Phone Number" /></Field>
              <Field label="AWB Number"><input className={inp} value={noteForm.awb} onChange={e => setNoteForm(p => ({ ...p, awb: e.target.value }))} placeholder="AWB Number" /></Field>
              <Field label="Reason"><input className={inp} value={noteForm.reason} onChange={e => setNoteForm(p => ({ ...p, reason: e.target.value }))} placeholder="Reason for note" /></Field>
            </div>
            <div className="px-5 pb-4 flex justify-end items-center">
              {noteError && <span className="text-red-500 text-xs font-semibold mr-4">{noteError}</span>}
              <button 
                onClick={() => {
                  if (!noteForm.date || !noteForm.name || !noteForm.phone || !noteForm.reason || !noteForm.awb) {
                    setNoteError('Please fill all fields to add a note.');
                    return;
                  }
                  if (editingNoteId) {
                    setNdrNotes(prev => prev.map(n => n.id === editingNoteId ? { ...n, ...noteForm } : n));
                    setEditingNoteId(null);
                  } else {
                    setNdrNotes(prev => [{ ...noteForm, id: Date.now(), createdAt: new Date().toISOString() }, ...prev]);
                  }
                  setNoteForm({ name: '', phone: '', reason: '', awb: '', date: new Date().toISOString().split('T')[0] });
                  setNoteError('');
                }} 
                className="px-6 py-2 bg-yellow-500 text-white font-bold rounded-xl shadow hover:bg-yellow-600 transition active:scale-95 text-sm"
              >
                {editingNoteId ? 'Update Note' : '+ Add Note'}
              </button>
              {editingNoteId && (
                <button
                  onClick={() => {
                    setEditingNoteId(null);
                    setNoteForm({ name: '', phone: '', reason: '', awb: '', date: new Date().toISOString().split('T')[0] });
                    setNoteError('');
                  }}
                  className="ml-3 px-6 py-2 bg-gray-200 text-gray-700 font-bold rounded-xl shadow hover:bg-gray-300 transition active:scale-95 text-sm"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="h-1 bg-yellow-500" />
            <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <span className="font-semibold text-gray-700 text-sm">Notes List {ndrNotes.length > 0 && <span className="text-xs text-gray-400 font-normal ml-1">({ndrNotes.length})</span>}</span>
                {ndrNotes.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Filter:</span>
                    <input 
                      type="date" 
                      className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 bg-white" 
                      value={notesFilterDate} 
                      onChange={(e) => setNotesFilterDate(e.target.value)} 
                    />
                    {notesFilterDate && (
                      <button onClick={() => setNotesFilterDate('')} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
                    )}
                  </div>
                )}
              </div>
              {ndrNotes.length > 0 && (
                <button onClick={() => { if(window.confirm('Clear all notes?')) setNdrNotes([]); }} className="text-[10px] text-red-500 hover:text-red-600 font-bold uppercase tracking-wider">
                  Clear All
                </button>
              )}
            </div>
            {ndrNotes.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">No notes added yet.</div>
            ) : (notesFilterDate ? ndrNotes.filter(n => n.date === notesFilterDate) : ndrNotes).length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">No notes found for this date.</div>
            ) : (
              <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto custom-scrollbar">
                {(notesFilterDate ? ndrNotes.filter(n => n.date === notesFilterDate) : ndrNotes).map((note) => (
                  <div key={note.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-yellow-50/30 transition">
                    <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 w-full">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Date</p>
                        <p className="font-semibold text-gray-800 text-sm truncate">{note.date || new Date(note.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Name</p>
                        <p className="font-semibold text-gray-800 text-sm truncate">{note.name}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Phone</p>
                        <p className="font-mono text-gray-600 text-sm">{note.phone}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">AWB Number</p>
                        <p className="font-mono text-blue-600 font-bold text-sm">
                          <a href={`https://shiprocket.co/tracking/${note.awb}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{note.awb}</a>
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Reason / Note</p>
                        <p className="text-sm text-gray-700 font-medium break-words">{note.reason}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between w-full sm:w-auto mt-2 sm:mt-0 gap-3">
                      <span className="text-[10px] font-medium text-gray-400 sm:hidden">{new Date(note.createdAt).toLocaleString()}</span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            setEditingNoteId(note.id);
                            setNoteForm({ name: note.name, phone: note.phone, reason: note.reason, awb: note.awb, date: note.date });
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="w-8 h-8 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center hover:bg-blue-500 hover:text-white transition shadow-sm border border-blue-100"
                          title="Edit Note"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button 
                          onClick={() => setNdrNotes(prev => prev.filter(n => n.id !== note.id))}
                          className="w-8 h-8 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition shadow-sm border border-red-100"
                          title="Delete Note"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <span className="text-red-600 text-sm font-medium">{error}</span>
        </div>
      )}
      {result && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
          <span className="text-green-700 text-sm font-semibold">Success</span>
        </div>
      )}
    </div>
  );
}
