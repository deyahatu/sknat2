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

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      if (value.length === 0) return;
      search.set(key, value.join(','));
    } else {
      search.set(key, String(value));
    }
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  auth: {
    register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    verifyEmail: (email, code) => request('/auth/verify-email', { method: 'POST', body: JSON.stringify({ email, code }) }),
    resendCode: (email) => request('/auth/resend-code', { method: 'POST', body: JSON.stringify({ email }) }),
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
    list: (params) => request(`/users${buildQuery(params)}`),
    get: (id) => request(`/users/${id}`),
    delete: (id) => request(`/users/${id}`, { method: 'DELETE' }),
    deleteMe: (password) => request('/users/me', { method: 'DELETE', body: JSON.stringify({ password }) }),
    toggleActive: (id, reason) => request(`/users/${id}/toggle-active`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
  },
  properties: {
    list: (filters) => request(`/properties${buildQuery(filters)}`),
    create: (body) => request('/properties', { method: 'POST', body: JSON.stringify(body) }),
    mine: () => request('/properties/mine'),
    get: (id) => request(`/properties/${id}`),
    update: (id, body) => request(`/properties/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/properties/${id}`, { method: 'DELETE' }),
    toggleAvailability: (id, available) => request(`/properties/${id}/availability`, { method: 'PATCH', body: JSON.stringify({ available }) }),
    myRatings: () => request('/properties/ratings'),
    propertyRatings: (id) => request(`/properties/${id}/ratings`),
    // Room Variants
    listVariants: (propertyId) => request(`/properties/${propertyId}/variants`),
    createVariant: (propertyId, body) => request(`/properties/${propertyId}/variants`, { method: 'POST', body: JSON.stringify(body) }),
    bulkCreateVariants: (propertyId, variants) => request(`/properties/${propertyId}/variants/bulk`, { method: 'POST', body: JSON.stringify({ variants }) }),
    updateVariant: (propertyId, variantId, body) => request(`/properties/${propertyId}/variants/${variantId}`, { method: 'PUT', body: JSON.stringify(body) }),
    setRoomManualStatus: (propertyId, variantId, status) => request(`/properties/${propertyId}/variants/${variantId}/manual-status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    deleteVariant: (propertyId, variantId) => request(`/properties/${propertyId}/variants/${variantId}`, { method: 'DELETE' }),
  },
  bookings: {
    create: (body) => request('/bookings', { method: 'POST', body: JSON.stringify(body) }),
    studentList: (status) => request(`/bookings/student${status ? `?status=${status}` : ''}`),
    ownerList: (status) => request(`/bookings/owner${status ? `?status=${status}` : ''}`),
    get: (id) => request(`/bookings/${id}`),
    accept: (id) => request(`/bookings/${id}/accept`, { method: 'PATCH' }),
    reject: (id) => request(`/bookings/${id}/reject`, { method: 'PATCH' }),
    cancel: (id) => request(`/bookings/${id}/cancel`, { method: 'PATCH' }),
    complete: (id) => request(`/bookings/${id}/complete`, { method: 'PATCH' }),
    cancellationPolicy: (id) => request(`/bookings/${id}/cancellation-policy`),
    renew: (id, body) => request(`/bookings/${id}/renew`, { method: 'POST', body: JSON.stringify(body) }),
  },
  payments: {
    checkout: (bookingId) => request('/payments', { method: 'POST', body: JSON.stringify({ bookingId }) }),
    verifySession: (sessionId) => request(`/payments/verify/${sessionId}`),
    studentList: () => request('/payments/student'),
    ownerEarnings: () => request('/payments/owner/earnings'),
  },
  favorites: {
    list: () => request('/favorites'),
    add: (propertyId) => request('/favorites', { method: 'POST', body: JSON.stringify({ propertyId }) }),
    remove: (propertyId) => request(`/favorites/${propertyId}`, { method: 'DELETE' }),
    check: (propertyId) => request(`/favorites/check/${propertyId}`),
  },
  reviews: {
    create: (body) => request('/reviews', { method: 'POST', body: JSON.stringify(body) }),
    studentList: () => request('/reviews/student'),
    adminList: () => request('/reviews/admin/all'),
    adminDelete: (id) => request(`/reviews/admin/${id}`, { method: 'DELETE' }),
  },
  refunds: {
    studentList: () => request('/refunds/student'),
    list: (status) => request(`/refunds${status ? `?status=${status}` : ''}`),
    approve: (id) => request(`/refunds/${id}/approve`, { method: 'PATCH' }),
    reject: (id, reason) => request(`/refunds/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
  },
  studentRatings: {
    rate: (body) => request('/student-ratings', { method: 'POST', body: JSON.stringify(body) }),
    given: () => request('/student-ratings/given'),
    received: () => request('/student-ratings/received'),
  },
  withdrawals: {
    getBankAccount: () => request('/withdrawals/bank-account'),
    saveBankAccount: (body) => request('/withdrawals/bank-account', { method: 'PUT', body: JSON.stringify(body) }),
    deleteBankAccount: () => request('/withdrawals/bank-account', { method: 'DELETE' }),
    request: (amount) => request('/withdrawals', { method: 'POST', body: JSON.stringify({ amount }) }),
    history: (status) => request(`/withdrawals${status ? `?status=${status}` : ''}`),
  },
  invoices: {
    get: (paymentId) => request(`/invoices/${paymentId}`),
  },
  messages: {
    conversations: () => request('/messages'),
    getChat: (userId) => request(`/messages/${userId}`),
    send: (body) => request('/messages', { method: 'POST', body: JSON.stringify(body) }),
  },
  push: {
    vapidKey: () => request('/push/vapid-key'),
    subscribe: (body) => request('/push/subscribe', { method: 'POST', body: JSON.stringify(body) }),
    unsubscribe: (body) => request('/push/unsubscribe', { method: 'POST', body: JSON.stringify(body) }),
  },
  notifications: {
    list: () => request('/notifications'),
    unreadCount: () => request('/notifications/unread-count'),
    readAll: () => request('/notifications/read-all', { method: 'PATCH' }),
    read: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  },
  reports: {
    create: (body) => request('/reports', { method: 'POST', body: JSON.stringify(body) }),
    list: (status) => request(`/reports${status ? `?status=${status}` : ''}`),
    review: (id, body) => request(`/reports/${id}/review`, { method: 'PATCH', body: JSON.stringify(body) }),
  },
  complaints: {
    create: (body) => request('/complaints', { method: 'POST', body: JSON.stringify(body) }),
    mine: () => request('/complaints/mine'),
    list: (params) => request(`/complaints${buildQuery(params)}`),
    review: (id, body) => request(`/complaints/${id}/review`, { method: 'PATCH', body: JSON.stringify(body) }),
    uploadMedia: async ({ images = [], video = null }) => {
      const formData = new FormData();
      images.forEach((f) => formData.append('images', f));
      if (video) formData.append('video', video);
      const res = await fetch(`${API_URL}/complaints/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل رفع المرفقات');
      return data;
    },
  },
  blockAppeals: {
    submit: (message) => request('/block-appeals', { method: 'POST', body: JSON.stringify({ message }) }),
    mine: () => request('/block-appeals/me'),
    list: (status) => request(`/block-appeals${status ? `?status=${status}` : ''}`),
    resolve: (id, decision, adminNote) =>
      request(`/block-appeals/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ decision, adminNote }),
      }),
  },
  upload: {
    images: async (files) => {
      const formData = new FormData();
      files.forEach(f => formData.append('images', f));
      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل رفع الصور');
      return data;
    },
    single: async (file) => {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`${API_URL}/upload/single`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل رفع الصورة');
      return data;
    },
  },
  chat: {
    sendMessage: (body) => request('/chat/message', { method: 'POST', body: JSON.stringify(body) }),
    listSessions: () => request('/chat/sessions'),
    getSession: (id) => request(`/chat/sessions/${id}`),
    deleteSession: (id) => request(`/chat/sessions/${id}`, { method: 'DELETE' }),
  },
  admin: {
    stats: () => request('/admin/stats'),
    monthlyStats: () => request('/admin/stats/monthly'),
    recentActivity: () => request('/admin/stats/activity'),
    exportData: (type) => request(`/admin/export/${type}`),
    approveWithdrawal: (id) => request(`/withdrawals/${id}/approve`, { method: 'PATCH' }),
    rejectWithdrawal: (id, reason) => request(`/withdrawals/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
    auditLog: (params) => request(`/audit-log${buildQuery(params)}`),
    sendNotification: (body) => request('/admin/send-notification', { method: 'POST', body: JSON.stringify(body) }),
  },
};
