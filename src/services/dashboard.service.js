import API from '../api';

const cacheMap = new Map();
const inFlightMap = new Map();

export const clearDashboardCache = () => {
  cacheMap.clear();
  inFlightMap.clear();
  try {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('dash_cache_')) localStorage.removeItem(key);
    });
  } catch (e) {}
};

/**
 * High-performance SWR (Stale-While-Revalidate) in-memory cache.
 * Returns cached data in < 0.1ms from browser memory.
 * Silently updates cache in background if stale.
 */
function cachedGet(url, options = {}) {
  const { bypass = false, ttl = 180000, staleTime = 45000 } = options;
  const now = Date.now();
  const cached = cacheMap.get(url);

  // Instant RAM return (0.1ms)
  if (!bypass && cached && (now - cached.timestamp < ttl)) {
    // Background revalidation if stale
    if (now - cached.timestamp > staleTime && !inFlightMap.has(url)) {
      const bgPromise = API.get(url)
        .then(r => {
          const freshData = r.data.data !== undefined ? r.data.data : r.data;
          cacheMap.set(url, { data: freshData, timestamp: Date.now() });
          return freshData;
        })
        .catch(() => {})
        .finally(() => inFlightMap.delete(url));
      inFlightMap.set(url, bgPromise);
    }
    return Promise.resolve(cached.data);
  }

  // Deduplicate inflight network requests
  if (!bypass && inFlightMap.has(url)) {
    return inFlightMap.get(url);
  }

  const promise = API.get(url)
    .then(r => {
      const data = r.data.data !== undefined ? r.data.data : r.data;
      cacheMap.set(url, { data, timestamp: Date.now() });
      return data;
    })
    .finally(() => {
      inFlightMap.delete(url);
    });

  inFlightMap.set(url, promise);
  return promise;
}

export const fetchStats = (date, from, to, department, refresh = false) => {
  let url = `/dashboard/stats?date=${date || ''}`;
  if (from) url += `&from=${from}`;
  if (to) url += `&to=${to}`;
  if (department) url += `&department=${department}`;
  if (refresh) url += `&refresh=true`;
  return cachedGet(url, { bypass: refresh });
};

export const fetchRevenueChart = (period = 'monthly', refresh = false) =>
  cachedGet(`/dashboard/revenue-chart?period=${period}${refresh ? '&refresh=true' : ''}`, { bypass: refresh });

export const fetchStaffStats = (date, staffId, from, to, department, refresh = false, preset = null) => {
  let url = `/dashboard/staff-stats?date=${date || ''}`;
  if (staffId) url += `&staffId=${staffId}`;
  if (from) url += `&from=${from}`;
  if (to) url += `&to=${to}`;
  if (preset) url += `&preset=${preset}`;
  if (department) url += `&department=${department}`;
  if (refresh) url += `&refresh=true`;
  return cachedGet(url, { bypass: refresh });
};

export const saveStaffTarget = (targetOrObj, userId, date) => {
  clearDashboardCache();
  const target = typeof targetOrObj === 'object' && targetOrObj !== null ? targetOrObj.target : targetOrObj;
  const uid = (typeof targetOrObj === 'object' && targetOrObj !== null ? targetOrObj.userId : userId) || userId;
  const dt = (typeof targetOrObj === 'object' && targetOrObj !== null ? targetOrObj.date : date) || date;
  return API.post('/dashboard/staff-target', { target: Number(target), ...(uid && { userId: uid }), ...(dt && { date: dt }) }).then(r => r.data.data);
};

export const fetchTargetHistory = (month, year, days, userId, refresh = false) => {
  let url = `/dashboard/target-history?`;
  const params = new URLSearchParams();
  if (month !== undefined && month !== null) params.append('month', month);
  if (year !== undefined && year !== null) params.append('year', year);
  if (days !== undefined && days !== null) params.append('days', days);
  if (userId) params.append('userId', userId);
  if (refresh) params.append('refresh', 'true');
  return cachedGet(url + params.toString(), { bypass: refresh });
};

export const fetchStaffVerifications = (refresh = false) =>
  cachedGet(`/dashboard/staff-verifications${refresh ? '?refresh=true' : ''}`, { bypass: refresh });

export const fetchStaffTodayLists = (date, staffId, from, to, department, refresh = false, preset = null) => {
  let url = `/dashboard/staff-today-lists?date=${date || ''}`;
  if (staffId) url += `&staffId=${staffId}`;
  if (from) url += `&from=${from}`;
  if (to) url += `&to=${to}`;
  if (preset) url += `&preset=${preset}`;
  if (department) url += `&department=${department}`;
  if (refresh) url += `&refresh=true`;
  return cachedGet(url, { bypass: refresh });
};

export const fetchStaffMonthlyChart = (staffIdOrRefresh = null, refresh = false) => {
  let staffId = null;
  let shouldRefresh = false;
  if (typeof staffIdOrRefresh === 'boolean') {
    shouldRefresh = staffIdOrRefresh;
  } else {
    staffId = staffIdOrRefresh;
    shouldRefresh = refresh;
  }
  let url = `/dashboard/staff-monthly-chart?`;
  if (staffId && staffId !== 'all') url += `staffId=${staffId}&`;
  if (shouldRefresh) url += `refresh=true`;
  return cachedGet(url, { bypass: shouldRefresh });
};

export const fetchAllStaffStats = (date, from, to, preset, refresh = false) => {
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  if (from) params.append('from', from);
  if (to) params.append('to', to);
  if (preset) params.append('preset', preset);
  if (refresh) params.append('refresh', 'true');
  const url = `/dashboard/all-staff-stats?${params.toString()}`;
  return cachedGet(url, { bypass: refresh });
};

export const fetchStaffCommission = (month, year, staffIdOrRefresh = null, refresh = false) => {
  let staffId = null;
  let shouldRefresh = false;
  if (typeof staffIdOrRefresh === 'boolean') {
    shouldRefresh = staffIdOrRefresh;
  } else {
    staffId = staffIdOrRefresh;
    shouldRefresh = refresh;
  }
  let url = `/dashboard/staff-commission?month=${month}&year=${year}`;
  if (staffId && staffId !== 'all') url += `&staffId=${staffId}`;
  if (shouldRefresh) url += `&refresh=true`;
  return cachedGet(url, { bypass: shouldRefresh });
};

export const fetchAllStaffCommissions = (month, year, refresh = false) =>
  cachedGet(`/dashboard/all-staff-commissions?month=${month}&year=${year}${refresh ? '&refresh=true' : ''}`, { bypass: refresh });

export const saveCommissionOverride = (data) => {
  clearDashboardCache();
  return API.post('/dashboard/save-commission-override', data).then(r => r.data.data);
};

export const fetchUnassignedOrders = (month, year, refresh = false) =>
  cachedGet(`/dashboard/unassigned-orders?month=${month}&year=${year}${refresh ? '&refresh=true' : ''}`, { bypass: refresh });

export const fetchStaffDeliveryStats = (month, year, refresh = false) =>
  cachedGet(`/dashboard/staff-delivery-stats?month=${month}&year=${year}${refresh ? '&refresh=true' : ''}`, { bypass: refresh });

export const fetchMyDeliveryStats = (month, year, userId = null, refresh = false) =>
  cachedGet(`/dashboard/my-delivery-stats?month=${month}&year=${year}${userId ? `&userId=${userId}` : ''}${refresh ? '&refresh=true' : ''}`, { bypass: refresh });

export const assignOrder = (orderId, staffId, platform) => {
  clearDashboardCache();
  return API.post('/dashboard/assign-order', { orderId, staffId, platform }).then(r => r.data.data);
};

export const fetchEmployeePerformanceMatrix = (paramsObj = {}, refresh = false) => {
  const params = new URLSearchParams();
  Object.keys(paramsObj).forEach(k => {
    if (paramsObj[k] !== undefined && paramsObj[k] !== null && paramsObj[k] !== '') {
      params.append(k, paramsObj[k]);
    }
  });
  if (refresh) params.append('refresh', 'true');
  return cachedGet(`/dashboard/employee-performance-matrix?${params.toString()}`, { bypass: refresh });
};

export const fetchStaffDetailKPIs = (paramsObj = {}, refresh = false) => {
  const params = new URLSearchParams();
  Object.keys(paramsObj).forEach(k => {
    if (paramsObj[k] !== undefined && paramsObj[k] !== null && paramsObj[k] !== '') {
      params.append(k, paramsObj[k]);
    }
  });
  if (refresh) params.append('refresh', 'true');
  return cachedGet(`/dashboard/staff-detail-kpis?${params.toString()}`, { bypass: refresh });
};

export const fetchTaskDrilldown = (paramsObj = {}, refresh = false) => {
  const params = new URLSearchParams();
  Object.keys(paramsObj).forEach(k => {
    if (paramsObj[k] !== undefined && paramsObj[k] !== null && paramsObj[k] !== '') {
      params.append(k, paramsObj[k]);
    }
  });
  if (refresh) params.append('refresh', 'true');
  return cachedGet(`/dashboard/task-drilldown?${params.toString()}`, { bypass: refresh });
};

export const fetchSupportStats = (paramsObj = {}, refresh = false) => {
  const params = new URLSearchParams();
  Object.keys(paramsObj).forEach(k => {
    if (paramsObj[k] !== undefined && paramsObj[k] !== null && paramsObj[k] !== '') {
      params.append(k, paramsObj[k]);
    }
  });
  if (refresh) params.append('refresh', 'true');
  return cachedGet(`/dashboard/support-stats?${params.toString()}`, { bypass: refresh });
};

export const fetchLogisticsStats = (paramsObj = {}, refresh = false) => {
  const params = new URLSearchParams();
  Object.keys(paramsObj).forEach(k => {
    if (paramsObj[k] !== undefined && paramsObj[k] !== null && paramsObj[k] !== '') {
      params.append(k, paramsObj[k]);
    }
  });
  if (refresh) params.append('refresh', 'true');
  return cachedGet(`/dashboard/logistics-stats?${params.toString()}`, { bypass: refresh });
};
