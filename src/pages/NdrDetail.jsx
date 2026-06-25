import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as srSvc from '../services/shiprocket.service';

const LABELS = {
  awb_code: 'AWB Code',
  channel_order_id: 'Channel Order ID',
  order_id: 'Order ID',
  shipment_id: 'Shipment ID',
  customer_name: 'Customer Name',
  customer_phone: 'Customer Phone',
  customer_email: 'Customer Email',
  reason: 'Reason',
  remarks: 'Remarks',
  comment: 'Comment',
  action: 'Action',
  attempts: 'Attempts',
  ndr_raised_at: 'NDR Raised At',
  current_status: 'Current Status',
  status: 'Status',
  courier_name: 'Courier Name',
  payment_method: 'Payment Method',
  pickup_date: 'Pickup Date',
  edd: 'Estimated Delivery',
  delivered_date: 'Delivered Date',
  address: 'Customer Address',
  address_2: 'Customer Address 2',
  city: 'Customer City',
  state: 'Customer State',
  pincode: 'Customer Pincode',
  channel_name: 'Channel Name',
  payment_status: 'Payment Status',
  status_code: 'Status Code',
  id: 'ID',
};

const SECTION_ORDER = [
  {
    title: 'Shipment',
    keys: ['awb_code', 'channel_order_id', 'order_id', 'shipment_id', 'courier_name', 'channel_name', 'status_code'],
  },
  {
    title: 'Customer',
    keys: ['customer_name', 'customer_phone', 'customer_email'],
  },
  {
    title: 'NDR',
    keys: ['reason', 'remarks', 'comment', 'action', 'attempts', 'ndr_raised_at', 'current_status', 'status'],
  },
  {
    title: 'Payment',
    keys: ['payment_method', 'payment_status'],
  },
  {
    title: 'Delivery',
    keys: ['pickup_date', 'edd', 'delivered_date'],
  },
  {
    title: 'Address',
    keys: ['address', 'address_2', 'city', 'state', 'pincode'],
  },
];

const formatDetailLabel = (key) => LABELS[key] || String(key || '')
  .replace(/_/g, ' ')
  .replace(/\b\w/g, ch => ch.toUpperCase());

const isProtectedPhone = (value) => {
  const text = String(value || '').trim();
  if (!text) return true;
  if (/^not authorized$/i.test(text)) return true;
  if (/^x+$/i.test(text)) return true;
  const digits = text.replace(/\D/g, '');
  return digits.length < 10;
};

const isComplexValue = (value) => {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(item => item && typeof item === 'object');
  return true;
};

const formatDetailValue = (value, key = '') => {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) {
    if (!value.length) return '-';
    if (value.every(item => item === null || typeof item !== 'object')) {
      return value.map(item => String(item)).join(', ');
    }
    return value.map((item, index) => {
      if (item === null || item === undefined) return `Item ${index + 1}: -`;
      if (typeof item !== 'object') return `Item ${index + 1}: ${String(item)}`;
      const lines = Object.entries(item).map(([childKey, childValue]) =>
        `${formatDetailLabel(childKey)}: ${formatDetailValue(childValue, childKey)}`
      );
      return [`Item ${index + 1}`, ...lines.map(line => `  ${line}`)].join('\n');
    }).join('\n\n');
  }
  if (typeof value === 'object') {
    return Object.entries(value).map(([childKey, childValue]) =>
      `${formatDetailLabel(childKey)}: ${formatDetailValue(childValue, childKey)}`
    ).join('\n');
  }

  const text = String(value);
  const lowerKey = key.toLowerCase();

  if (lowerKey.includes('date') || lowerKey.includes('raised_at') || lowerKey === 'edd') {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }

  return text;
};

const statusTone = (status) => {
  const value = String(status || '').toUpperCase();
  if (value.includes('UNDELIVERED') || value.includes('NDR')) return 'bg-red-50 text-red-700 border-red-200';
  if (value.includes('DELIVERED')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (value.includes('TRANSIT') || value.includes('PICKUP')) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
};

const isLongValue = (key) => ['address', 'address_2', 'remarks', 'comment'].includes(key);

function DetailRow({ label, value, mono = false, long = false, link = false, href = '' }) {
  const complex = isComplexValue(value);

  return (
    <div className={`grid gap-2 py-3 ${long ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] md:gap-6'}`}>
      <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</div>
      <div className={`text-sm font-semibold text-slate-800 break-words ${mono || complex ? 'font-mono text-[13px]' : ''} ${complex ? 'whitespace-pre-wrap' : ''}`}>
        {link && href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            {value}
          </a>
        ) : value}
      </div>
    </div>
  );
}

export default function NdrDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const ndr = location.state?.ndr || null;
  const [resolvedPhone, setResolvedPhone] = useState('');

  useEffect(() => {
    let active = true;
    const currentPhone = String(ndr?.customer_phone || '').trim();
    const needsLookup = !!ndr && isProtectedPhone(currentPhone);

    if (!needsLookup) {
      setResolvedPhone(currentPhone);
      return () => { active = false; };
    }

    setResolvedPhone('');
    srSvc.getLocalOrderLookup({
      awb: ndr?.awb_code || '',
      channel_order_id: ndr?.channel_order_id || '',
      order_id: ndr?.order_id || '',
      shipment_id: ndr?.shipment_id || '',
    }).then(res => {
      const phone = res.data?.data?.billing_phone || '';
      if (active && phone) setResolvedPhone(phone);
    }).catch(() => {
      if (active) setResolvedPhone('');
    });

    return () => { active = false; };
  }, [ndr]);

  const displayPhone = resolvedPhone && !isProtectedPhone(resolvedPhone)
    ? resolvedPhone
    : (isProtectedPhone(ndr?.customer_phone) ? '-' : ndr?.customer_phone);

  const displayNdr = ndr
    ? { ...ndr, customer_phone: displayPhone }
    : null;

  const sections = displayNdr
    ? SECTION_ORDER
        .map(section => ({
          ...section,
          rows: section.keys
            .filter(key => key in displayNdr)
            .map(key => ({ key, value: displayNdr[key] })),
        }))
        .filter(section => section.rows.length > 0)
    : [];

  const usedKeys = new Set(sections.flatMap(section => section.rows.map(row => row.key)));
  const extraRows = displayNdr
    ? Object.entries(displayNdr)
        .filter(([key]) => !usedKeys.has(key))
        .map(([key, value]) => ({ key, value }))
    : [];

  if (!displayNdr) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-10 text-center shadow-sm">
          <h2 className="text-xl font-bold text-gray-800">NDR Details</h2>
          <p className="mt-2 text-sm text-gray-400">No NDR record was passed to this page.</p>
          <button
            onClick={() => navigate('/shiprocket/ndr')}
            className="mt-5 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Back to NDR
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <button
                onClick={() => navigate('/shiprocket/ndr')}
                className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-700"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                Back to NDR List
              </button>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">NDR Details</h1>
              <p className="mt-1 text-sm text-gray-500">
                {displayNdr.customer_name?.trim() || 'Unknown Customer'} | {displayNdr.awb_code || '-'}
              </p>
            </div>
            <button
              onClick={() => navigate('/shiprocket/ndr', { state: { prefillAwb: displayNdr.awb_code || '' } })}
              className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              Use AWB in Action
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 border-b border-gray-100 bg-slate-50/70 px-5 py-4 sm:grid-cols-2 xl:grid-cols-4 sm:px-6">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">AWB Code</p>
            <p className="mt-1 font-mono text-sm font-bold text-slate-800 break-all">
              <a href={`https://shiprocket.co/tracking/${displayNdr.awb_code}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                {formatDetailValue(displayNdr.awb_code, 'awb_code')}
              </a>
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Order ID</p>
            <p className="mt-1 font-mono text-sm font-bold text-slate-800 break-all">{formatDetailValue(displayNdr.channel_order_id || displayNdr.order_id, 'channel_order_id')}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Status</p>
            <div className="mt-1">
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusTone(displayNdr.status || displayNdr.current_status)}`}>
                {formatDetailValue(displayNdr.status || displayNdr.current_status, 'status')}
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Attempts</p>
            <p className="mt-1 text-sm font-bold text-slate-800">{formatDetailValue(displayNdr.attempts, 'attempts')}</p>
          </div>
        </div>

        <div className="px-5 py-5 sm:px-6 space-y-6">
          {sections.map(section => (
            <section key={section.title} className="overflow-hidden rounded-2xl border border-gray-200">
              <div className="border-b border-gray-100 bg-slate-50/80 px-4 py-3">
                <h2 className="text-sm font-bold text-gray-800">{section.title}</h2>
              </div>
              <div className="divide-y divide-gray-100 px-4">
                {section.rows.map(row => (
                  <DetailRow
                    key={row.key}
                    label={formatDetailLabel(row.key)}
                    value={formatDetailValue(row.value, row.key)}
                    mono={row.key.includes('id') || row.key.includes('awb') || row.key.includes('code')}
                    long={isLongValue(row.key)}
                    link={row.key === 'awb_code'}
                    href={row.key === 'awb_code' ? `https://shiprocket.co/tracking/${row.value}` : ''}
                  />
                ))}
              </div>
            </section>
          ))}

          {extraRows.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-gray-200">
              <div className="border-b border-gray-100 bg-slate-50/80 px-4 py-3">
                <h2 className="text-sm font-bold text-gray-800">Additional Information</h2>
              </div>
              <div className="divide-y divide-gray-100 px-4">
                {extraRows.map(row => (
                  <DetailRow
                    key={row.key}
                    label={formatDetailLabel(row.key)}
                    value={formatDetailValue(row.value, row.key)}
                    mono={row.key.includes('id') || row.key.includes('awb') || row.key.includes('code')}
                    long={isLongValue(row.key)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
