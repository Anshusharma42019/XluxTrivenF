import axios from 'axios';

// Determine API base URL dynamically:
// - If running on xluxtriven.de or localhost, use relative '/api/v1'
// - If running on any other frontend domain (e.g. support.trivenayurveda.in),
//   point directly to the live backend server 'https://xluxtriven.de/api/v1'
const isBrowser = typeof window !== 'undefined';
const hostname = isBrowser ? window.location.hostname : '';
const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
const isXluxOrigin = hostname.endsWith('xluxtriven.de');

let BASE_URL = 'https://xluxtriven.de/api/v1';
if (isXluxOrigin || isLocalhost) {
  BASE_URL = '/api/v1';
} else {
  BASE_URL = 'https://xluxtriven.de/api/v1';
}

const API = axios.create({ baseURL: BASE_URL });
API.interceptors.request.use((config) => {
  const tokens = JSON.parse(localStorage.getItem('crmTokens') || 'null');
  if (tokens?.access?.token) {
    config.headers.Authorization = `Bearer ${tokens.access.token}`;
  }
  return config;
});

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (cb) => {
  refreshSubscribers.push(cb);
};

const onTokenRefreshed = (token) => {
  refreshSubscribers.map((cb) => cb(token));
  refreshSubscribers = [];
};

API.interceptors.response.use(
  (res) => {
    // Guard against SPA returning 200 OK with HTML index.html
    if (typeof res.data === 'string' && res.data.trim().startsWith('<!doctype')) {
      return Promise.reject(new Error('Backend API endpoint not found (received HTML instead of JSON)'));
    }
    return res;
  },
  async (error) => {
    const original = error.config;
    
    if (error.response?.status === 401 && !original._retry) {
      
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(API(original));
          });
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const tokens = JSON.parse(localStorage.getItem('crmTokens') || 'null');
        if (!tokens?.refresh?.token) {
          throw new Error('No refresh token available');
        }

        const { data } = await axios.post(`${BASE_URL}/auth/refresh-tokens`, {
          refreshToken: tokens.refresh.token,
        });

        const newTokens = data.data;
        localStorage.setItem('crmTokens', JSON.stringify(newTokens));
        
        isRefreshing = false;
        onTokenRefreshed(newTokens.access.token);

        original.headers.Authorization = `Bearer ${newTokens.access.token}`;
        return API(original);
      } catch (refreshError) {
        isRefreshing = false;
        
        const status = refreshError.response?.status;
        // Only log out if the refresh token is explicitly rejected (4xx) or missing
        if (refreshError.message === 'No refresh token available' || (status >= 400 && status < 500)) {
          localStorage.removeItem('crmTokens');
          localStorage.removeItem('crmUser');
          window.location.href = '/login';
        }
        
        return Promise.reject(refreshError);
      }
    }
    if (error.response?.status === 403 && (error.response?.data?.message?.toLowerCase().includes('check in') || error.response?.data?.message?.toLowerCase().includes('target'))) {
      // Dispatch a custom event that ToastContext can listen to
      window.dispatchEvent(new CustomEvent('api-error', { 
        detail: { message: error.response.data.message, title: 'Action Blocked' } 
      }));
    }
    return Promise.reject(error);
  }
);

export default API;
