const API_URL = '/api';

async function request(endpoint, options = {}) {
  const config = {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  };

  const res = await fetch(`${API_URL}${endpoint}`, config);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'حدث خطأ غير متوقع');
  }

  return data;
}

export const api = {
  auth: {
    register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    me: () => request('/auth/me'),
    forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword: (token, password) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
    changePassword: (currentPassword, newPassword) => request('/auth/change-password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) }),
  },
  users: {
    profile: () => request('/users/profile'),
    updateProfile: (body) => request('/users/profile', { method: 'PUT', body: JSON.stringify(body) }),
    list: () => request('/users'),
    delete: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  },
  properties: {
    create: (body) => request('/properties', { method: 'POST', body: JSON.stringify(body) }),
    mine: () => request('/properties/mine'),
    get: (id) => request(`/properties/${id}`),
    update: (id, body) => request(`/properties/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/properties/${id}`, { method: 'DELETE' }),
    toggleAvailability: (id, available) => request(`/properties/${id}/availability`, { method: 'PATCH', body: JSON.stringify({ available }) }),
    myRatings: () => request('/properties/ratings'),
    propertyRatings: (id) => request(`/properties/${id}/ratings`),
  },
  bookings: {
    ownerList: (status) => request(`/bookings/owner${status ? `?status=${status}` : ''}`),
    accept: (id) => request(`/bookings/${id}/accept`, { method: 'PATCH' }),
    reject: (id) => request(`/bookings/${id}/reject`, { method: 'PATCH' }),
  },
  payments: {
    ownerEarnings: () => request('/payments/owner/earnings'),
  },
  studentRatings: {
    rate: (body) => request('/student-ratings', { method: 'POST', body: JSON.stringify(body) }),
    given: () => request('/student-ratings/given'),
  },
  withdrawals: {
    getBankAccount: () => request('/withdrawals/bank-account'),
    saveBankAccount: (body) => request('/withdrawals/bank-account', { method: 'PUT', body: JSON.stringify(body) }),
    deleteBankAccount: () => request('/withdrawals/bank-account', { method: 'DELETE' }),
    request: (amount) => request('/withdrawals', { method: 'POST', body: JSON.stringify({ amount }) }),
    history: (status) => request(`/withdrawals${status ? `?status=${status}` : ''}`),
  },
};
