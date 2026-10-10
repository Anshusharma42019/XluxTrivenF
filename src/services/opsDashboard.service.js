import API from '../api';

const BASE = '/ops-dashboard';

const buildParams = (filters = {}) => {
  const p = {};
  if (filters.preset) p.preset = filters.preset;
  if (filters.from) p.from = filters.from;
  if (filters.to) p.to = filters.to;
  if (filters.hub) p.hub = filters.hub;
  if (filters.courier) p.courier = filters.courier;
  if (filters.awb) p.awb = filters.awb;
  if (filters.state) p.state = filters.state;
  if (filters.status) p.status = filters.status;
  if (filters.platform) p.platform = filters.platform;
  if (filters.page) p.page = filters.page;
  if (filters.limit) p.limit = filters.limit;
  if (filters.rtoThreshold !== undefined) p.rtoThreshold = filters.rtoThreshold;
  if (filters.ndrThreshold !== undefined) p.ndrThreshold = filters.ndrThreshold;
  return p;
};

const cacheMap = new Map();
const inFlightMap = new Map();

export const clearOpsDashboardCache = () => {
  cacheMap.clear();
  inFlightMap.clear();
};

function cachedGet(url, params = {}, options = {}) {
  const { bypass = false, ttl = 180000, staleTime = 45000 } = options;
  const queryString = new URLSearchParams(params).toString();
  const cacheKey = queryString ? `${url}?${queryString}` : url;
  const now = Date.now();

  const cached = cacheMap.get(cacheKey);
  if (!bypass && cached && (now - cached.timestamp < ttl)) {
    if (now - cached.timestamp > staleTime && !inFlightMap.has(cacheKey)) {
      const bgPromise = API.get(url, { params })
        .then(r => {
          const freshData = r.data.data !== undefined ? r.data.data : r.data;
          cacheMap.set(cacheKey, { data: freshData, timestamp: Date.now() });
          return freshData;
        })
        .catch(() => {})
        .finally(() => inFlightMap.delete(cacheKey));
      inFlightMap.set(cacheKey, bgPromise);
    }
    return Promise.resolve(cached.data);
  }

  if (!bypass && inFlightMap.has(cacheKey)) {
    return inFlightMap.get(cacheKey);
  }

  const promise = API.get(url, { params })
    .then(r => {
      const data = r.data.data !== undefined ? r.data.data : r.data;
      cacheMap.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    })
    .finally(() => inFlightMap.delete(cacheKey));

  inFlightMap.set(cacheKey, promise);
  return promise;
}

export const fetchKPIs = (filters, refresh = false) =>
  cachedGet(`${BASE}/kpis`, buildParams(filters), { bypass: refresh });

export const fetchTrend = (filters, refresh = false) =>
  cachedGet(`${BASE}/trend`, buildParams(filters), { bypass: refresh });

export const fetchFunnel = (filters, refresh = false) =>
  cachedGet(`${BASE}/funnel`, buildParams(filters), { bypass: refresh });

export const fetchRtoReasons = (filters, refresh = false) =>
  cachedGet(`${BASE}/rto-reasons`, buildParams(filters), { bypass: refresh });

export const fetchAging = (filters, refresh = false) =>
  cachedGet(`${BASE}/aging`, buildParams(filters), { bypass: refresh });

export const fetchLeaderboard = (filters, refresh = false) =>
  cachedGet(`${BASE}/leaderboard`, buildParams(filters), { bypass: refresh });

export const fetchShipments = (filters, refresh = false) =>
  cachedGet(`${BASE}/shipments`, buildParams(filters), { bypass: refresh });

export const fetchAlerts = (filters, refresh = false) =>
  cachedGet(`${BASE}/alerts`, buildParams(filters), { bypass: refresh });

export const fetchStaffBreakdown = (filters, refresh = false) =>
  cachedGet(`${BASE}/staff-breakdown`, buildParams(filters), { bypass: refresh });

export const submitRtoVerification = (payload) => {
  clearOpsDashboardCache();
  return API.post(`${BASE}/rto-verification`, payload).then(r => r.data);
};

export const fetchInteraktTemplates = () =>
  API.get('/interakt/templates').then(r => r.data.data?.templates || []);

export const sendInteraktMessages = (payload, filters = {}) =>
  API.post(`${BASE}/send-interakt-messages`, payload, { params: buildParams(filters) }).then(r => r.data);

export const saveInvoiceHistory = (payload) =>
  API.post(`${BASE}/invoice-history`, payload).then(r => r.data);
