import API from '../api';

export const syncCallLogs = (logs) => {
  return API.post('/call-logs/sync', { logs });
};

export const getCallingStats = (params) => {
  return API.get('/call-logs/stats', { params });
};

export const getCallLogs = (params) => {
  return API.get('/call-logs', { params });
};

export const getLeadCallingHistory = (phone) => {
  return API.get(`/call-logs/lead/${phone}`);
};

export const getPendingMissedCalls = (params) => {
  return API.get('/call-logs/missed', { params });
};

export const resolveMissedCall = (id) => {
  return API.patch(`/call-logs/missed/${id}/resolve`);
};

