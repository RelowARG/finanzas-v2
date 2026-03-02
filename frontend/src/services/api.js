// src/services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (name, email, password) => api.post('/auth/register', { name, email, password }),
  me: () => api.get('/auth/me'),
};

// ─── Transactions ─────────────────────────────────────────────────────────────
export const transactionsAPI = {
  getAll: (params) => api.get('/transactions', { params }),
  create: (data) => api.post('/transactions', data),
  bulkCreate: (transactions) => api.post('/transactions/bulk', { transactions }),
  update: (id, data) => api.put(`/transactions/${id}`, data),
  delete: (id) => api.delete(`/transactions/${id}`),
  getSavingsSummary: (month) => api.get('/transactions/savings-summary', { params: { month } }),
};

// ─── Categories ───────────────────────────────────────────────────────────────
export const categoriesAPI = {
  getAll: () => api.get('/categories'),
  create: (data) => api.post('/categories', data),
  delete: (id) => api.delete(`/categories/${id}`),
};

// ─── PDF ──────────────────────────────────────────────────────────────────────
export const pdfAPI = {
  parse: (file, bank) => {
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('bank', bank);
    return api.post('/pdf/parse', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000,
    }).then(res => res.data);
  },
  getBanks: () => api.get('/pdf/banks'),
};

// ─── Analytics ────────────────────────────────────────────────────────────────
export const analyticsAPI = {
  monthlySummary: (months = 6) => api.get('/analytics/monthly-summary', { params: { months } }),
  byCategory: (month) => api.get('/analytics/by-category', { params: { month } }),
  savingsProgress: (month) => api.get('/analytics/savings-progress', { params: { month } }),
  insights: (months = 3) => api.get('/analytics/insights', { params: { months } }),
};

// ─── Goals ────────────────────────────────────────────────────────────────────
export const goalsAPI = {
  getAll: () => api.get('/goals'),
  save: (month_year, target_amount, notes, period_type = 'monthly', currency = 'USD') =>
    api.post('/goals', { month_year, target_amount, notes, period_type, currency }),
  delete: (id) => api.delete(`/goals/${id}`),
};