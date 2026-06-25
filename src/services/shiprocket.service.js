import api from '../api';

const BASE = '/shiprocket';

// ── Token management ──────────────────────────────────────────────────────────
const TOKEN_KEY = 'sr_token';
const TOKEN_EXP_KEY = 'sr_token_exp';
const TOKEN_TTL = 23 * 60 * 60 * 1000;

export const getSavedToken = () => {
  const exp = localStorage.getItem(TOKEN_EXP_KEY);
  if (exp && Date.now() < Number(exp)) return localStorage.getItem(TOKEN_KEY) || '';
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXP_KEY);
  return '';
};

export const saveToken = (t) => {
  localStorage.setItem(TOKEN_KEY, t);
  localStorage.setItem(TOKEN_EXP_KEY, String(Date.now() + TOKEN_TTL));
};

export const getValidToken = async () => {
  const saved = getSavedToken();
  if (saved) return saved;
  const { data } = await login();
  saveToken(data.data.token);
  return data.data.token;
};

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = () => api.post(`${BASE}/auth/login`);

// ── Orders ────────────────────────────────────────────────────────────────────
export const createOrder = (body) => api.post(`${BASE}/orders/create/adhoc`, body);
export const updateOrder = (body) => api.post(`${BASE}/orders/update/adhoc`, body);
export const cancelOrders = (ids) => api.post(`${BASE}/orders/cancel`, { ids });
export const deleteLocalOrder = (id) => api.delete(`${BASE}/orders/delete/${id}`);
export const getOrders = (params) => api.get(`${BASE}/orders`, { params });
export const getDeliveredOrders = (params) => api.get(`${BASE}/orders/delivered`, { params });
export const getDeliveredOrdersFromSchema = (params) => api.get(`${BASE}/orders/delivered-schema`, { params });
export const getInTransitOrdersFromSchema = (params) => api.get(`${BASE}/orders/in-transit-schema`, { params });
export const getDeliveredOrdersLive = () => api.get(`${BASE}/orders/delivered-live`);
export const getDeliveredStats = (params) => api.get(`${BASE}/orders/delivered-stats`, { params });
export const getStatusOrders = (params) => api.get(`${BASE}/orders/status-details`, { params });
export const getLocalOrderLookup = (params) => api.get(`${BASE}/orders/local-lookup`, { params });
export const syncShiprocket = () => api.post(`${BASE}/orders/sync`);
export const backfillDeliveredAt = () => api.post(`${BASE}/orders/backfill-delivered`);
export const debugOrderFields = () => api.get(`${BASE}/orders/debug-fields`);
export const getOrder = (id) => api.get(`${BASE}/orders/show/${id}`);
export const getFollowupCommissionSettings = () => api.get('/commission/settings');
export const updateFollowupCommissionSettings = (body) => api.put('/commission/settings', body);
export const getOrderActivity = (id) => api.get(`${BASE}/orders/${id}/notes`);
export const getStaffCommissions = (params) => api.get('/commission/reorder', { params });

// ── Courier ───────────────────────────────────────────────────────────────────
export const checkServiceability = (params) => api.get(`${BASE}/courier/serviceability`, { params });
export const getCourierListWithCounts = () => api.get(`${BASE}/courier/courierListWithCounts`);
export const assignAWB = (shipment_id, courier_id) =>
  api.post(`${BASE}/courier/assign/awb`, { shipment_id, courier_id });
export const reassignCourier = (body) => api.post(`${BASE}/courier/reassign`, body);

// ── Shipments ─────────────────────────────────────────────────────────────────
export const getShipments = (params) => api.get(`${BASE}/shipments`, { params });
export const getShipment = (id) => api.get(`${BASE}/shipments/${id}`);
export const cancelShipment = (awbs) => api.post(`${BASE}/shipments/cancel`, { awbs });

// ── Label / Manifest ──────────────────────────────────────────────────────────
export const generateLabel = (shipment_id) => api.post(`${BASE}/courier/generate/label`, { shipment_id });
export const generateManifest = (shipment_id) => api.post(`${BASE}/manifests/generate`, { shipment_id });
export const printManifest = (order_ids) => api.post(`${BASE}/manifests/print`, { order_ids });
export const printInvoice = (ids) => api.post(`${BASE}/orders/print/invoice`, { ids });

// ── Pickup ────────────────────────────────────────────────────────────────────
export const generatePickup = (shipment_id) => api.post(`${BASE}/courier/generate/pickup`, { shipment_id });
export const cancelPickup = (body) => api.post(`${BASE}/courier/cancel/pickup`, body);
export const getPickupLocations = () => api.get(`${BASE}/settings/company/pickup`);

// ── Tracking ──────────────────────────────────────────────────────────────────
export const trackByAWB = (awb) => api.get(`${BASE}/courier/track/awb/${awb}`);
export const trackByShipment = (id) => api.get(`${BASE}/courier/track/shipment/${id}`);

// ── Returns ───────────────────────────────────────────────────────────────────
export const createReturn = (body) => api.post(`${BASE}/orders/create/return`, body);
export const getReturns = (params) => api.get(`${BASE}/returns`, { params });

// ── Wallet ────────────────────────────────────────────────────────────────────
export const getWalletBalance = () => api.get(`${BASE}/wallet/balance`);
export const getWalletTransactions = (params) => api.get(`${BASE}/wallet/transactions`, { params });

// ── NDR ───────────────────────────────────────────────────────────────────────
export const getNDR = (params) => api.get(`${BASE}/ndr`, { params });
export const ndrAction = (body) => api.post(`${BASE}/ndr/action`, body);
export const getNdrNotes = (params) => api.get(`${BASE}/ndr/notes`, { params });
export const createNdrNote = (body) => api.post(`${BASE}/ndr/notes`, body);
export const updateNdrNote = (id, body) => api.put(`${BASE}/ndr/notes/${id}`, body);
export const deleteNdrNote = (id) => api.delete(`${BASE}/ndr/notes/${id}`);

// ── Next order ID ─────────────────────────────────────────────────────────────
export const getNextOrderId = () => api.get(`${BASE}/next-order-id`);
export const saveOrderNote = (id, text, type = 'general', section = '') => api.patch(`${BASE}/orders/${id}/notes`, { text, type, section });
