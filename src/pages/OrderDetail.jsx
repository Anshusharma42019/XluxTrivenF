import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as srSvc from '../services/shiprocket.service';

const STATUS_COLORS = {
  DELIVERED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  OUT_FOR_DELIVERY: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  IN_TRANSIT: 'bg-amber-100 text-amber-700 border-amber-200',
  RTO_INITIATED: 'bg-orange-100 text-orange-700 border-orange-200',
  RTO_DELIVERED: 'bg-blue-100 text-blue-700 border-blue-200',
  CANCELED: 'bg-red-100 text-red-700 border-red-200',
  SHIPPED: 'bg-green-100 text-green-700 border-green-200',
};

const SR_STATUS = {
  1: 'Pending', 2: 'Confirmed', 3: 'Processing', 4: 'Pickup Scheduled',
  5: 'Pickup Error', 6: 'Picked Up', 7: 'Out for Delivery', 8: 'In Transit',
  9: 'Delivered', 10: 'Cancelled', 11: 'RTO Initiated', 12: 'RTO In Transit',
  13: 'RTO Delivered', 14: 'Lost', 15: 'Damaged', 16: 'Shipment Held',
  17: 'Undelivered', 18: 'In Transit', 19: 'Out for Delivery',
  20: 'Reached Destination Hub', 21: 'Undelivered — 2nd Attempt',
  22: 'Pickup Exception', 23: 'Misrouted', 24: 'RTO Out for Delivery',
  25: 'Reached Back at Seller', 38: 'Pickup Scheduled', 39: 'Undelivered — 3rd Attempt',
  42: 'Picked Up', 44: 'Reached at Destination Hub',
};

const SR_STATUS_COLOR = {
  9: 'bg-emerald-500', 7: 'bg-cyan-500', 19: 'bg-cyan-500',
  6: 'bg-green-500', 42: 'bg-green-500', 8: 'bg-amber-400', 18: 'bg-amber-400',
  20: 'bg-amber-400', 44: 'bg-amber-400', 17: 'bg-red-400', 21: 'bg-red-400',
  39: 'bg-red-400', 11: 'bg-orange-400', 12: 'bg-orange-400', 13: 'bg-blue-400',
  10: 'bg-gray-400', 14: 'bg-gray-500', 15: 'bg-gray-500',
};

const getStatusLabel = (a) => {
  const code = Number(a['sr-status'] ?? a.status_id ?? a.statusCode);
  if (code && SR_STATUS[code]) return SR_STATUS[code];
  return a.activity || a['sr-status-label'] || a.status || String(a['sr-status'] || '—');
};

const getStatusDot = (a) => {
  const code = Number(a['sr-status'] ?? a.status_id ?? a.statusCode);
  return SR_STATUS_COLOR[code] || 'bg-gray-300';
};

const Field = ({ label, value, mono, link, href }) => (
  <div>
    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
    {link && href
      ? <a href={href} target="_blank" rel="noreferrer" className={`text-sm font-semibold text-blue-600 hover:underline ${mono ? 'font-mono' : ''}`}>{value || '—'}</a>
      : <p className={`text-sm font-semibold text-gray-800 ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
    }
  </div>
);

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trackLoading, setTrackLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    srSvc.getLocalOrderLookup(id.match(/^[0-9a-f]{24}$/i) ? { _id: id } : { order_id: id })
      .then(res => {
        const o = res.data?.data;
        setOrder(o);
        if (o?.awb_code) {
          setTrackLoading(true);
          srSvc.trackByAWB(o.awb_code)
            .then(r => setTracking(r.data?.data))
            .catch(() => {})
            .finally(() => setTrackLoading(false));
        }
      })
      .catch(() => setError('Order not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const loadTracking = async () => {
    if (!order?.awb_code) return;
    setTrackLoading(true);
    try {
      const res = await srSvc.trackByAWB(order.awb_code);
      setTracking(res.data?.data);
    } catch { setTracking(null); }
    finally { setTrackLoading(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-gray-400">
      <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      Loading order...
    </div>
  );

  if (error || !order) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-gray-400">{error || 'Order not found'}</p>
      <button onClick={() => navigate(-1)} className="text-sm text-green-600 hover:underline">← Go back</button>
    </div>
  );

  const statusKey = String(order.status || '').toUpperCase().replace(/[\s-]+/g, '_');
  const statusColor = STATUS_COLORS[statusKey] || 'bg-gray-100 text-gray-600 border-gray-200';
  const trackingData = tracking?.tracking_data;
  const activities = trackingData?.shipment_track_activities || [];

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">Order {order.order_id || order.shiprocket_order_id}</h1>
          <p className="text-xs text-gray-400 mt-0.5">Created {fmt(order.createdAt)}</p>
        </div>
        <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${statusColor}`}>
          {String(order.status || '').replace(/[-_]+/g, ' ')}
        </span>
      </div>

      {/* Customer & Shipping */}
      <div className="bg-white rounded-2xl shadow-sm p-5 grid grid-cols-2 sm:grid-cols-3 gap-4" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="col-span-2 sm:col-span-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Customer & Shipping</p>
        </div>
        <Field label="Customer" value={order.billing_customer_name} />
        <Field label="Phone" value={order.billing_phone} />
        <Field label="Email" value={order.billing_email} />
        <Field label="Address" value={order.billing_address} />
        <Field label="City" value={order.billing_city} />
        <Field label="State" value={order.billing_state} />
        <Field label="Pincode" value={order.billing_pincode} />
        <Field label="Country" value={order.billing_country} />
        <Field label="Payment" value={order.payment_method?.toUpperCase()} />
      </div>

      {/* Order Info */}
      <div className="bg-white rounded-2xl shadow-sm p-5 grid grid-cols-2 sm:grid-cols-3 gap-4" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="col-span-2 sm:col-span-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Order Info</p>
        </div>
        <Field label="Order ID" value={order.order_id} mono />
        <Field label="Shiprocket ID" value={order.shiprocket_order_id} mono />
        <Field label="Shipment ID" value={order.shiprocket_shipment_id} mono />
        <Field label="AWB Code" value={order.awb_code} mono link href={`https://shiprocket.co/tracking/${order.awb_code}`} />
        <Field label="Courier" value={order.courier_name} />
        <Field label="Amount" value={order.sub_total ? `₹${Number(order.sub_total).toLocaleString()}` : null} />
        <Field label="Order Date" value={fmt(order.order_date || order.createdAt)} />
        <Field label="Delivered At" value={fmt(order.delivered_at)} />
        <Field label="Status Updated" value={fmt(order.status_updated_at)} />
      </div>

      {/* Items */}
      {order.order_items?.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-5" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Items</p>
          <div className="divide-y divide-gray-50">
            {order.order_items.map((item, i) => (
              <div key={i} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{item.name || 'Item'}</p>
                  {item.sku && <p className="text-xs text-gray-400 mt-0.5">SKU: {item.sku}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900">₹{Number(item.selling_price || 0).toLocaleString()}</p>
                  <p className="text-xs text-gray-400">×{item.units || 1}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tracking */}
      <div className="bg-white rounded-2xl shadow-sm p-5" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Tracking</p>
          {order.awb_code && (
            <button onClick={loadTracking} disabled={trackLoading}
              className="text-[11px] font-bold bg-blue-600 text-white px-4 py-1.5 rounded-xl hover:bg-blue-700 disabled:opacity-60 transition">
              {trackLoading ? 'Loading...' : 'Refresh'}
            </button>
          )}
        </div>

        {!order.awb_code && <p className="text-sm text-gray-400">No AWB assigned yet.</p>}

        {tracking && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
              <Field label="Current Status" value={trackingData?.current_status || (activities[0] ? getStatusLabel(activities[0]) : '—')} />
              <Field label="Delivered Date" value={trackingData?.delivered_date || '—'} />
              <Field label="ETA" value={trackingData?.etd ? new Date(trackingData.etd).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} />
            </div>
            {activities.length > 0 && (
              <div className="relative mt-2">
                {activities.map((a, i) => {
                  const label = getStatusLabel(a);
                  const dot = getStatusDot(a);
                  const isFirst = i === 0;
                  const datetime = [a.date, a.time].filter(Boolean).join(' ');
                  return (
                    <div key={i} className="relative flex gap-4 pb-5">
                      {/* Line */}
                      {i < activities.length - 1 && (
                        <div className="absolute left-[11px] top-5 bottom-0 w-0.5 bg-gray-100" />
                      )}
                      {/* Dot */}
                      <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        isFirst ? `${dot} shadow-md` : 'bg-gray-100'
                      }`}>
                        {isFirst
                          ? <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
                          : <div className={`w-2 h-2 rounded-full ${dot}`} />}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className={`text-sm font-semibold ${isFirst ? 'text-gray-900' : 'text-gray-600'}`}>{label}</p>
                        <div className="flex flex-wrap gap-x-3 mt-0.5">
                          {datetime && <span className="text-[11px] text-gray-400">{datetime}</span>}
                          {a.location && <span className="text-[11px] font-semibold text-gray-500">{a.location}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="bg-white rounded-2xl shadow-sm p-5" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Notes</p>
          <p className="text-sm text-gray-700">{order.notes}</p>
        </div>
      )}
    </div>
  );
}
