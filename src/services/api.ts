import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
});

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.method?.toLowerCase() === 'get' && config.url) {
    const cached = cache.get(config.url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      config.adapter = async () => {
        return {
          data: cached.data,
          status: 200,
          statusText: 'OK',
          headers: config.headers as any,
          config,
          request: {}
        };
      };
    }
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use((response) => {
  if (response.config.method?.toLowerCase() === 'get' && response.config.url && response.status === 200) {
    cache.set(response.config.url, {
      data: response.data,
      timestamp: Date.now()
    });
  }
  return response;
}, (error) => {
  if (error.response && error.response.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
  return Promise.reject(error);
});

export default api;
