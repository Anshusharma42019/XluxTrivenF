import api from '../api';

const BASE = '/shipmaxx';

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (email, password, api_key, base_url) => api.post(`${BASE}/auth/login`, { email, password, api_key, base_url });

// ── Orders ────────────────────────────────────────────────────────────────────
export const getOrders          = (params)         => api.get(`${BASE}/orders`, { params });
export const getOrder           = (order_id)       => api.get(`${BASE}/orders/${order_id}`);
export const createOrder        = (body)           => api.post(`${BASE}/orders/create`, body);
export const updateOrder        = (order_id, body) => api.put(`${BASE}/orders/${order_id}`, body);
export const getDeliveredOrders = (params)         => api.get(`${BASE}/orders/delivered`, { params });
export const getDeliveredOrdersFromSchema  = (params) => api.get(`${BASE}/orders/delivered-schema`, { params });
export const getInTransitOrdersFromSchema  = (params) => api.get(`${BASE}/orders/in-transit-schema`, { params });
export const searchOrderByPhone = (phone)          => api.get(`${BASE}/orders/search-by-phone`, { params: { phone } });

// ── Shipping ──────────────────────────────────────────────────────────────────
export const createShipment = (body) => api.post(`${BASE}/shipping/create-shipment`, body);
export const trackShipment  = (awb)  => api.get(`${BASE}/shipping/track-shipment`, { params: { awb } });
export const generateLabel  = (awb)  => api.get(`${BASE}/shipping/generate-label`, { params: { awb } });
export const getManifest    = (awb)  => api.get(`${BASE}/shipping/manifest/${awb}`);
export const cancelShipment = (body) => api.post(`${BASE}/shipping/cancel-shipment`, body);
export const checkServiceability = (body) => api.post(`${BASE}/shipping/serviceability`, body);
export const getShipments   = (params) => api.get(`${BASE}/shipping/shipments`, { params });
export const getShipmentById = (shipment_id) => api.get(`${BASE}/shipping/shipments/${shipment_id}`);

// ── Warehouses ────────────────────────────────────────────────────────────────
export const getWarehouses   = (params) => api.get(`${BASE}/warehouses`, { params });
export const createWarehouse = (body)   => api.post(`${BASE}/warehouses/create`, body);

// ── Invoice ───────────────────────────────────────────────────────────────────
export const getInvoice = (order_id) => api.get(`${BASE}/invoice/${order_id}`);

// ── NDR & NDR Notes ───────────────────────────────────────────────────────────
export const getNdrList    = (params) => api.get(`${BASE}/ndr`, { params });
export const ndrAction     = (ndr_id, body) => api.post(`${BASE}/ndr/${ndr_id}/action`, body);
export const ndrBulkAction = (body)   => api.post(`${BASE}/ndr/bulk-action`, body);

export const getNdrNotes   = (params)   => api.get(`${BASE}/ndr/notes`, { params });
export const createNdrNote = (body)     => api.post(`${BASE}/ndr/notes`, body);
export const updateNdrNote = (id, body) => api.put(`${BASE}/ndr/notes/${id}`, body);
export const deleteNdrNote = (id)       => api.delete(`${BASE}/ndr/notes/${id}`);

// ── Stats & Board ─────────────────────────────────────────────────────────────
export const getDeliveredStats = (params) => api.get(`${BASE}/orders/stats`, { params });
export const getStatusOrders   = (params) => api.get(`${BASE}/orders/status`, { params });

// ── Sync & Import ─────────────────────────────────────────────────────────────
export const syncShipmaxx  = ()          => api.post(`${BASE}/orders/sync`);
export const importByIds   = (order_ids) => api.post(`${BASE}/orders/import-by-ids`, { order_ids });

// ── Order Notes ───────────────────────────────────────────────────────────────
export const saveOrderNote = (id, text, type = 'general', section = '') => api.post(`${BASE}/orders/${id}/notes`, { text, type, section });
export const getOrderActivity = (id) => api.get(`${BASE}/orders/${id}/activity`);
export const updateOrderContact = (id, body) => api.patch(`${BASE}/orders/${id}/contact`, body);

// ── Follow-ups ────────────────────────────────────────────────────────────────
export const getOrdersWithFollowUps  = (params) => api.get(`${BASE}/orders/with-followups`, { params });
export const getCompletedFollowUps   = (params) => api.get(`${BASE}/orders/completed-followups`, { params });
export const completeFollowUp        = (id, body) => api.post(`${BASE}/orders/${id}/complete-followup`, body);
export const addFollowUp             = (id, body) => api.post(`${BASE}/orders/${id}/follow-up`, body);
export const setNextFollowUp         = (id, body) => api.patch(`${BASE}/orders/${id}/next-follow-up`, body);
export const updateFollowupRelief    = (id, body) => api.patch(`${BASE}/orders/${id}/followup-relief`, body);
export const createManualFollowup    = (body)     => api.post(`${BASE}/orders/manual-followup`, body);

// ── Verification ──────────────────────────────────────────────────────────────
export const sendToVerification = (id) => api.post(`${BASE}/orders/${id}/send-to-verification`);
