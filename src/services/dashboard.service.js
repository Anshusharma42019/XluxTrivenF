import API from '../api';
export const fetchStats = (date, from, to, department) => {
  let url = `/dashboard/stats?date=${date || ''}`;
  if (from) url += `&from=${from}`;
  if (to) url += `&to=${to}`;
  if (department) url += `&department=${department}`;
  return API.get(url).then(r => r.data.data);
};
export const fetchRevenueChart = (period = 'monthly') => API.get(`/dashboard/revenue-chart?period=${period}`).then(r => r.data.data);
export const fetchStaffStats = (date, staffId, from, to, department) => {
  let url = `/dashboard/staff-stats?date=${date || ''}`;
  if (staffId) url += `&staffId=${staffId}`;
  if (from) url += `&from=${from}`;
  if (to) url += `&to=${to}`;
  if (department) url += `&department=${department}`;
  return API.get(url).then(r => r.data.data);
};
export const saveStaffTarget = (target, userId, date) => API.post('/dashboard/staff-target', { target, ...(userId && { userId }), ...(date && { date }) }).then(r => r.data.data);
export const fetchTargetHistory = (month, year, days, userId) => {
  let url = `/dashboard/target-history?`;
  const params = new URLSearchParams();
  if (month !== undefined && month !== null) params.append('month', month);
  if (year !== undefined && year !== null) params.append('year', year);
  if (days !== undefined && days !== null) params.append('days', days);
  if (userId) params.append('userId', userId);
  return API.get(url + params.toString()).then(r => r.data.data);
};
export const fetchStaffVerifications = () => API.get('/dashboard/staff-verifications').then(r => r.data.data);
export const fetchStaffTodayLists = (date, staffId, from, to, department) => {
  let url = `/dashboard/staff-today-lists?date=${date || ''}`;
  if (staffId) url += `&staffId=${staffId}`;
  if (from) url += `&from=${from}`;
  if (to) url += `&to=${to}`;
  if (department) url += `&department=${department}`;
  return API.get(url).then(r => r.data.data);
};
export const fetchStaffMonthlyChart = () => API.get('/dashboard/staff-monthly-chart').then(r => r.data.data);
export const fetchAllStaffStats = (date, from, to) => {
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  if (from) params.append('from', from);
  if (to) params.append('to', to);
  return API.get(`/dashboard/all-staff-stats?${params.toString()}`).then(r => r.data.data);
};
export const fetchStaffCommission = (month, year) => API.get(`/dashboard/staff-commission?month=${month}&year=${year}`).then(r => r.data.data);
export const fetchAllStaffCommissions = (month, year) => API.get(`/dashboard/all-staff-commissions?month=${month}&year=${year}`).then(r => r.data.data);
export const saveCommissionOverride = (data) => API.post('/dashboard/save-commission-override', data).then(r => r.data.data);
