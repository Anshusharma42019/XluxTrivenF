import axios from 'axios';

const API = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL });
API.interceptors.request.use((config) => {
  const tokens = JSON.parse(localStorage.getItem('crmTokens') || 'null');
  if (tokens?.access?.token) {
    config.headers.Authorization = `Bearer ${tokens.access.token}`;
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url} - Token attached`);
  } else {
    console.warn(`[API Request] ${config.method?.toUpperCase()} ${config.url} - No token found`);
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
  (res) => res,
  async (error) => {
    const original = error.config;
    
    if (error.response?.status === 401 && !original._retry) {
      console.warn(`[API Response] 401 Unauthorized for ${original.url}. Attempting token refresh...`);
      
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

        const { data } = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/auth/refresh-tokens`, {
          refreshToken: tokens.refresh.token,
        });

        console.log('[API Refresh] Token refreshed successfully');
        const newTokens = data.data;
        localStorage.setItem('crmTokens', JSON.stringify(newTokens));
        
        isRefreshing = false;
        onTokenRefreshed(newTokens.access.token);

        original.headers.Authorization = `Bearer ${newTokens.access.token}`;
        return API(original);
      } catch (refreshError) {
        console.error('[API Refresh] Token refresh failed:', refreshError.message);
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
