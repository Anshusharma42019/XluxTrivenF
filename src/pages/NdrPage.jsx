import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as srSvc from '../services/shiprocket.service';
import OrderStatusBoard from '../components/OrderStatusBoard';

const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 bg-white';
const Field = ({ label, children }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const ATTEMPT_OPTIONS = [
  { value: 'all', label: 'All Attempts' },
  { value: '1',   label: '1st Attempt' },
  { value: '2',   label: '2nd Attempt' },
  { value: '3',   label: '3rd Attempt' },
  { value: '4+',  label: '4+ Attempts' },
];

const statusBadge = (s) => {
  const v = String(s || '').toUpperCase();
  if (v.includes('UNDELIVERED') || v.includes('NDR')) return 'bg-red-50 text-red-700 border-red-200';
  if (v.includes('DELIVERED'))                         return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (v.includes('TRANSIT') || v.includes('PICKUP'))   return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
};

const fmt = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

// ── NDR Detail Panel ──────────────────────────────────────────────────────────
function NdrDetailPanel({ ndr, onClose, onUseAwb }) {
  const [phone, setPhone] = useState(ndr?.customer_phone || '');

  useEffect(() => {
    if (!ndr) return;
    const masked = String(ndr.customer_phone || '');
    const isHidden = !masked || /^x+$/i.test(masked) || masked.replace(/\D/g, '').length < 10;
    if (!isHidden) { setPhone(masked); return; }
    setPhone('');
    srSvc.getLocalOrderLookup({
      awb: ndr.awb_code || '',
      channel_order_id: ndr.channel_order_id || '',
      order_id: ndr.order_id || '',
    }).then(r => {
      const p = r.data?.data?.billing_phone || '';
      if (p) setPhone(p);
    }).catch(() => {});
  }, [ndr]);

  if (!ndr) return null;

  const FIELDS = [
    ['AWB Code',       ndr.awb_code],
    ['Channel Order',  ndr.channel_order_id],
    ['Shipment ID',    ndr.shipment_id],
    ['Customer',       ndr.customer_name],
    ['Phone',          phone || ndr.customer_phone],
    ['Email',          ndr.customer_email],
    ['Courier',        ndr.courier_name],
    ['Status',         ndr.status || ndr.current_status],
    ['Reason',         ndr.reason],
    ['Remarks',        ndr.remarks],
    ['Comment',        ndr.comment],
    ['Attempts',       ndr.attempts],
    ['NDR Raised',     ndr.ndr_raised_at],
    ['Payment',        ndr.payment_method],
    ['EDD',            ndr.edd],
    ['Address',        ndr.address],
    ['City',           ndr.city],
    ['State',          ndr.state],
    ['Pincode',        ndr.pincode],
  ].filter(([, v]) => v !== null && v !== undefined && v !== '');

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
      <div className="h-1 bg-red-500" />
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <button onClick={onClose} className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
            Back to list
          </button>
          <h3 className="font-bold text-gray-800 text-base">{ndr.customer_name?.trim() || 'NDR Detail'}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{ndr.awb_code}</p>
        </div>
        <div className="flex gap-2">
          <span className={`text-xs font-bold px-3 py-1 rounded-full border ${statusBadge(ndr.status || ndr.current_status)}`}>
            {fmt(ndr.status || ndr.current_status)}
          </span>
          <button onClick={() => onUseAwb(ndr.awb_code)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-red-600 text-white hover:bg-red-700 transition">
            Use AWB in Action
          </button>
        </div>
      </div>
      <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {FIELDS.map(([label, value]) => (
          <div key={label} className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
            <p className="text-sm font-semibold text-gray-800 break-words">{fmt(value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── NDR List ──────────────────────────────────────────────────────────────────
function NdrList({ onSelectNdr, onUseAwb }) {
  const [ndrs, setNdrs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState(() => new Date().toISOString().split('T')[0]);
  const [to, setTo]     = useState(() => new Date().toISOString().split('T')[0]);
  const [attempt, setAttempt] = useState('all');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);

  const fetchNDR = useCallback((f = from, t = to) => {
    setLoading(true);
    const params = {};
    if (f) params.from = f;
    if (t) params.to = t;
    srSvc.getNDR(params)
      .then(r => setNdrs(r.data?.data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => { fetchNDR(); }, []);

  const filtered = ndrs.filter(n => {
    if (attempt !== 'all') {
      const a = Number(n.attempts ?? 1);
      if (attempt === '4+' ? a < 4 : a !== Number(attempt)) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return (
        (n.awb_code || '').toLowerCase().includes(q) ||
        (n.customer_name || '').toLowerCase().includes(q) ||
        (n.channel_order_id || '').toLowerCase().includes(q) ||
        (n.reason || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (detail) {
    return (
      <NdrDetailPanel
        ndr={detail}
        onClose={() => setDetail(null)}
        onUseAwb={(awb) => { onUseAwb(awb); setDetail(null); }}
      />
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
      <div className="h-1 bg-red-500" />
      {/* Filters */}
      <div className="px-5 py-3 border-b border-gray-100 space-y-3 bg-gray-50/30">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="font-bold text-gray-700 text-sm">NDR List</span>
          <span className="text-[10px] font-bold text-gray-400 bg-white px-2 py-0.5 rounded-full border">{filtered.length} records</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <input placeholder="Search AWB / name / order…" value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[180px] border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-400 bg-white" />
          <select value={attempt} onChange={e => setAttempt(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white font-semibold focus:outline-none focus:ring-1 focus:ring-red-400">
            {ATTEMPT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-red-400" />
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-red-400" />
          <button onClick={() => fetchNDR(from, to)} disabled={loading}
            className="px-5 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition disabled:opacity-50">
            {loading ? '…' : 'Search'}
          </button>
          <button onClick={() => { setFrom(''); setTo(''); setSearch(''); fetchNDR('', ''); }}
            className="px-4 py-2 rounded-xl bg-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-300 transition">
            Reset
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-5 py-10 text-center text-gray-400 text-sm">
          {loading ? 'Loading NDR records…' : 'No NDR records found.'}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="overflow-x-auto">
            <table className="hidden sm:table w-full text-sm">
              <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-[0.1em] sticky top-0">
                <tr>
                  {['AWB', 'Order ID', 'Customer', 'Reason', 'Attempts', 'Raised', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((n, i) => (
                  <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <a href={`https://shiprocket.co/tracking/${n.awb_code}`} target="_blank" rel="noreferrer"
                        className="font-mono text-[11px] text-blue-600 font-bold hover:underline">
                        {n.awb_code}
                      </a>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-gray-600">{n.channel_order_id}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800 text-[13px]">{n.customer_name?.trim() || '—'}</td>
                    <td className="px-4 py-3 text-[11px] text-gray-500 max-w-[200px] truncate" title={n.reason}>{n.reason || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex w-6 h-6 items-center justify-center rounded-lg bg-red-50 text-red-700 font-bold text-[11px] border border-red-100">
                        {n.attempts ?? 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-gray-400">{String(n.ndr_raised_at || '').split(' ')[0]}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => setDetail(n)}
                          className="text-[10px] font-bold px-3 py-1.5 rounded-xl bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 transition">
                          VIEW
                        </button>
                        <button onClick={() => onUseAwb(n.awb_code, 'reattempt')}
                          className="text-[10px] font-bold px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-600 hover:text-white transition">
                          RE-TRY
                        </button>
                        <button onClick={() => onUseAwb(n.awb_code, 'return')}
                          className="text-[10px] font-bold px-3 py-1.5 rounded-xl bg-orange-50 text-orange-600 border border-orange-100 hover:bg-orange-600 hover:text-white transition">
                          RTO
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-50">
              {filtered.map((n, i) => (
                <div key={i} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate">{n.customer_name?.trim() || 'Unknown'}</p>
                      <a href={`https://shiprocket.co/tracking/${n.awb_code}`} target="_blank" rel="noreferrer"
                        className="text-[10px] font-mono text-blue-600 font-bold hover:underline">
                        {n.awb_code}
                      </a>
                    </div>
                    <span className="inline-flex w-7 h-7 items-center justify-center rounded-lg bg-red-50 text-red-700 font-bold text-xs border border-red-100 shrink-0">
                      {n.attempts ?? 1}
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Reason</p>
                    <p className="text-xs text-gray-700 mt-1">{n.reason || '—'}</p>
                    <p className="text-[10px] text-gray-400 font-bold mt-2">ORDER: {n.channel_order_id} · RAISED: {String(n.ndr_raised_at || '').split(' ')[0]}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setDetail(n)} className="flex-1 text-[11px] font-bold py-2 rounded-xl bg-white text-gray-600 border border-gray-200">VIEW</button>
                    <button onClick={() => onUseAwb(n.awb_code, 'reattempt')} className="flex-1 text-[11px] font-bold py-2 rounded-xl bg-blue-600 text-white">RE-TRY</button>
                    <button onClick={() => onUseAwb(n.awb_code, 'return')} className="flex-1 text-[11px] font-bold py-2 rounded-xl bg-orange-600 text-white">RTO</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── NDR Action Panel ──────────────────────────────────────────────────────────
function NdrActionPanel({ prefillAwb, prefillAction }) {
  const [form, setForm] = useState({ awb: prefillAwb || '', action: prefillAction || 'reattempt', comment: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (prefillAwb) setForm(p => ({ ...p, awb: prefillAwb, action: prefillAction || p.action }));
  }, [prefillAwb, prefillAction]);

  const submit = async () => {
    if (!form.awb) { setError('AWB is required'); return; }
    setLoading(true); setError(''); setResult('');
    try {
      await srSvc.ndrAction(form);
      setResult('NDR action submitted successfully');
      setForm(p => ({ ...p, comment: '' }));
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
      <div className="h-1 bg-red-500" />
      <div className="px-5 py-3 border-b border-gray-100">
        <span className="font-semibold text-gray-700 text-sm">NDR Action</span>
        <p className="text-xs text-gray-400 mt-0.5">Submit a re-attempt or RTO instruction to the courier</p>
      </div>
      <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="AWB Code *">
          <input className={inp} placeholder="Enter AWB" value={form.awb} onChange={e => setForm(p => ({ ...p, awb: e.target.value }))} />
        </Field>
        <Field label="Action *">
          <select className={inp} value={form.action} onChange={e => setForm(p => ({ ...p, action: e.target.value }))}>
            <option value="reattempt">Re-attempt Delivery</option>
            <option value="return">Return to Origin (RTO)</option>
          </select>
        </Field>
        <Field label="Comment">
          <input className={inp} placeholder="Optional comment" value={form.comment} onChange={e => setForm(p => ({ ...p, comment: e.target.value }))} />
        </Field>
      </div>
      <div className="px-5 pb-5 flex items-center gap-3 flex-wrap">
        <button onClick={submit} disabled={loading}
          className="px-6 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition disabled:opacity-50">
          {loading ? 'Submitting…' : 'Submit NDR Action'}
        </button>
        {result && <span className="text-sm font-semibold text-green-600">{result}</span>}
        {error  && <span className="text-sm font-semibold text-red-500">{error}</span>}
      </div>
    </div>
  );
}

// ── NDR Notes Panel ───────────────────────────────────────────────────────────
function NdrNotesPanel() {
  const [notes, setNotes]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [search, setSearch]     = useState('');
  const [form, setForm]         = useState({ name: '', phone_number: '', reason: '', awb_number: '', date: new Date().toISOString().split('T')[0] });
  const [editId, setEditId]     = useState(null);
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);

  const fetchNotes = useCallback((date = filterDate, q = search) => {
    setLoading(true);
    const params = {};
    if (date) params.date = date;
    if (q)    params.search = q;
    srSvc.getNdrNotes(params)
      .then(r => setNotes(r.data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterDate, search]);

  useEffect(() => { fetchNotes(); }, []);

  const save = async () => {
    const { name, phone_number, reason, awb_number } = form;
    if (!name || !phone_number || !reason || !awb_number) {
      setError('All fields are required'); return;
    }
    setSaving(true); setError('');
    try {
      if (editId) {
        await srSvc.updateNdrNote(editId, { name, phone_number, reason, awb_number });
        setEditId(null);
      } else {
        await srSvc.createNdrNote({ name, phone_number, reason, awb_number });
      }
      setForm({ name: '', phone_number: '', reason: '', awb_number: '', date: new Date().toISOString().split('T')[0] });
      fetchNotes();
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (id) => {
    if (!window.confirm('Delete this note?')) return;
    await srSvc.deleteNdrNote(id).catch(() => {});
    setNotes(p => p.filter(n => n._id !== id));
  };

  const startEdit = (note) => {
    setEditId(note._id);
    setForm({ name: note.name, phone_number: note.phone_number, reason: note.reason, awb_number: note.awb_number, date: '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-4">
      {/* Add / Edit form */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="h-1 bg-yellow-400" />
        <div className="px-5 py-3 border-b border-gray-100">
          <span className="font-semibold text-gray-700 text-sm">{editId ? 'Edit Note' : 'Add New Note'}</span>
        </div>
        <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Customer Name *">
            <input className={inp} placeholder="Name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </Field>
          <Field label="Phone Number *">
            <input className={inp} placeholder="Phone" value={form.phone_number} onChange={e => setForm(p => ({ ...p, phone_number: e.target.value }))} />
          </Field>
          <Field label="AWB Number *">
            <input className={inp} placeholder="AWB" value={form.awb_number} onChange={e => setForm(p => ({ ...p, awb_number: e.target.value }))} />
          </Field>
          <Field label="Reason / Note *">
            <input className={inp} placeholder="Reason" value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} />
          </Field>
        </div>
        <div className="px-5 pb-4 flex items-center gap-3 flex-wrap">
          <button onClick={save} disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-yellow-500 text-white text-sm font-bold hover:bg-yellow-600 transition disabled:opacity-50">
            {saving ? 'Saving…' : editId ? 'Update Note' : '+ Add Note'}
          </button>
          {editId && (
            <button onClick={() => { setEditId(null); setForm({ name: '', phone_number: '', reason: '', awb_number: '', date: '' }); }}
              className="px-5 py-2.5 rounded-xl bg-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-300 transition">
              Cancel
            </button>
          )}
          {error && <span className="text-red-500 text-sm font-semibold">{error}</span>}
        </div>
      </div>

      {/* Notes list */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="h-1 bg-yellow-400" />
        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <span className="font-semibold text-gray-700 text-sm flex-1">
            Notes {notes.length > 0 && <span className="text-xs text-gray-400 font-normal ml-1">({notes.length})</span>}
          </span>
          <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchNotes(filterDate, search)}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-yellow-400 w-36" />
          <input type="date" value={filterDate} onChange={e => { setFilterDate(e.target.value); fetchNotes(e.target.value, search); }}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-yellow-400" />
          {filterDate && (
            <button onClick={() => { setFilterDate(''); fetchNotes('', search); }}
              className="text-xs text-gray-400 hover:text-gray-600 font-semibold">Clear</button>
          )}
          <button onClick={() => fetchNotes(filterDate, search)}
            className="px-4 py-1.5 rounded-xl bg-yellow-500 text-white text-xs font-bold hover:bg-yellow-600 transition">
            {loading ? '…' : 'Refresh'}
          </button>
        </div>

        {notes.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">
            {loading ? 'Loading…' : 'No notes found.'}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden sm:table w-full text-sm">
              <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-[0.1em] sticky top-0">
                <tr>{['Date', 'Name', 'Phone', 'AWB', 'Reason', 'By', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-bold">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {notes.map(n => (
                  <tr key={n._id} className="hover:bg-yellow-50/30 transition-colors">
                    <td className="px-4 py-3 text-[11px] text-gray-400 font-medium whitespace-nowrap">
                      {new Date(n.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800 text-[13px]">{n.name}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-gray-600">{n.phone_number}</td>
                    <td className="px-4 py-3">
                      <a href={`https://shiprocket.co/tracking/${n.awb_number}`} target="_blank" rel="noreferrer"
                        className="font-mono text-[11px] text-blue-600 font-bold hover:underline">{n.awb_number}</a>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-gray-600 max-w-[220px] truncate" title={n.reason}>{n.reason}</td>
                    <td className="px-4 py-3 text-[11px] text-gray-500">{n.createdBy?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => startEdit(n)}
                          className="w-8 h-8 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center hover:bg-blue-500 hover:text-white transition border border-blue-100">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button onClick={() => deleteNote(n._id)}
                          className="w-8 h-8 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition border border-red-100">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile */}
            <div className="sm:hidden divide-y divide-gray-50">
              {notes.map(n => (
                <div key={n._id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-sm">{n.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{n.phone_number}</p>
                    </div>
                    <p className="text-[10px] text-gray-400 shrink-0">{new Date(n.createdAt).toLocaleDateString('en-IN')}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1">
                    <p><span className="font-bold text-gray-400">AWB:</span> <a href={`https://shiprocket.co/tracking/${n.awb_number}`} target="_blank" rel="noreferrer" className="text-blue-600 font-mono font-bold hover:underline">{n.awb_number}</a></p>
                    <p><span className="font-bold text-gray-400">Reason:</span> {n.reason}</p>
                    <p><span className="font-bold text-gray-400">By:</span> {n.createdBy?.name || '—'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(n)} className="flex-1 text-[11px] font-bold py-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">Edit</button>
                    <button onClick={() => deleteNote(n._id)} className="flex-1 text-[11px] font-bold py-2 rounded-xl bg-red-50 text-red-600 border border-red-100">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main NDR Page ─────────────────────────────────────────────────────────────
const TABS = [
  { id: 'board',  label: 'Status Board',   icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { id: 'list',   label: 'NDR List',       icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
  { id: 'action', label: 'NDR Action',     icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { id: 'notes',  label: 'Notes',          icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> },
];

export default function NdrPage() {
  const [tab, setTab] = useState('board');
  const [actionAwb, setActionAwb] = useState('');
  const [actionType, setActionType] = useState('reattempt');

  const handleUseAwb = (awb, type = 'reattempt') => {
    setActionAwb(awb);
    setActionType(type);
    setTab('action');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex justify-start sm:justify-end overflow-x-auto pb-1 scrollbar-hide">
        <div className="inline-flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm whitespace-nowrap">
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`h-9 rounded-lg px-3 text-xs font-semibold transition-all inline-flex items-center gap-2 ${
                  active ? 'bg-red-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                }`}>
                <span className={`grid h-5 w-5 place-items-center rounded-md ${active ? 'bg-white/15' : 'bg-red-50 text-red-600'}`}>
                  {t.icon}
                </span>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'board'  && <OrderStatusBoard title="Undelivered Orders" defaultStatus="UNDELIVERED_1ST_ATTEMPT" />}
      {tab === 'list'   && <NdrList onSelectNdr={() => {}} onUseAwb={handleUseAwb} />}
      {tab === 'action' && <NdrActionPanel prefillAwb={actionAwb} prefillAction={actionType} />}
      {tab === 'notes'  && <NdrNotesPanel />}
    </div>
  );
}
