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

export const fetchKPIs = (filters) =>
  API.get(`${BASE}/kpis`, { params: buildParams(filters) }).then(r => r.data.data);

export const fetchTrend = (filters) =>
  API.get(`${BASE}/trend`, { params: buildParams(filters) }).then(r => r.data.data);

export const fetchFunnel = (filters) =>
  API.get(`${BASE}/funnel`, { params: buildParams(filters) }).then(r => r.data.data);

export const fetchRtoReasons = (filters) =>
  API.get(`${BASE}/rto-reasons`, { params: buildParams(filters) }).then(r => r.data.data);

export const fetchAging = (filters) =>
  API.get(`${BASE}/aging`, { params: buildParams(filters) }).then(r => r.data.data);

export const fetchLeaderboard = (filters) =>
  API.get(`${BASE}/leaderboard`, { params: buildParams(filters) }).then(r => r.data.data);

export const fetchShipments = (filters) =>
  API.get(`${BASE}/shipments`, { params: buildParams(filters) }).then(r => r.data.data);

export const fetchAlerts = (filters) =>
  API.get(`${BASE}/alerts`, { params: buildParams(filters) }).then(r => r.data.data);

export const submitRtoVerification = (payload) =>
  API.post(`${BASE}/rto-verification`, payload).then(r => r.data);
