import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { FiUsers, FiHome, FiShield, FiTrash2, FiAlertCircle, FiSearch, FiToggleLeft, FiToggleRight, FiStar, FiBarChart2, FiDollarSign, FiCreditCard, FiCheck, FiX, FiDownload } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import './AdminDashboard.css';

const TABS = [
  { id: 'users', label: 'المستخدمين', icon: <FiUsers /> },
  { id: 'properties', label: 'العقارات', icon: <FiHome /> },
  { id: 'refunds', label: 'طلبات الاسترداد', icon: <FiCreditCard /> },
  { id: 'withdrawals', label: 'طلبات السحب', icon: <FiDollarSign /> },
  { id: 'ratings', label: 'التقييمات', icon: <FiStar /> },
  { id: 'stats', label: 'الإحصائيات', icon: <FiBarChart2 /> },
];

function exportCSV(data, filename) {
  if (!data || data.length === 0) return;
  const keys = Object.keys(data[0]);
  const csv = [keys.join(','), ...data.map(row => keys.map(k => {
    const v = typeof row[k] === 'object' ? JSON.stringify(row[k]) : String(row[k] ?? '');
    return `"${v.replace(/"/g, '""')}"`;
  }).join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
}

export default function AdminDashboard() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('users');
  const [pendingCounts, setPendingCounts] = useState({ refunds: 0, withdrawals: 0 });

  useEffect(() => {
    api.admin.stats().then((s) => {
      setPendingCounts({ refunds: s.pendingRefunds || 0, withdrawals: s.pendingWithdrawals || 0 });
    }).catch(() => {});
  }, [activeTab]);

  const getBadge = (tabId) => {
    if (tabId === 'refunds' && pendingCounts.refunds > 0) return pendingCounts.refunds;
    if (tabId === 'withdrawals' && pendingCounts.withdrawals > 0) return pendingCounts.withdrawals;
    return null;
  };

  return (
    <div className="page admin-page">
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-header">
            <h2>لوحة التحكم</h2>
            <p>إدارة النظام</p>
          </div>
          <nav className="admin-sidebar-nav">
            {TABS.map((tab) => {
              const badge = getBadge(tab.id);
              return (
                <button
                  key={tab.id}
                  className={`admin-sidebar-item ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {badge && <span className="sidebar-badge">{badge}</span>}
                </button>
              );
            })}
          </nav>
          <div className="admin-sidebar-footer">
            <span>مدير النظام</span>
          </div>
        </aside>

        <main className="admin-main">
          {activeTab === 'users' && <UsersTab currentUser={currentUser} />}
          {activeTab === 'properties' && <PropertiesTab />}
          {activeTab === 'refunds' && <RefundsTab />}
          {activeTab === 'withdrawals' && <WithdrawalsTab />}
          {activeTab === 'ratings' && <RatingsTab />}
          {activeTab === 'stats' && <StatsTab />}
        </main>
      </div>
    </div>
  );
}

// ── Users Tab (UC-27, UC-28, UC-29, UC-30) ──
function UsersTab({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.q = search;
      if (roleFilter) params.role = roleFilter;
      const data = await api.users.list(params);
      setUsers(data.users);
      setError(null);
    } catch (err) {
      setError('فشل في جلب بيانات المستخدمين.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handle = setTimeout(fetchUsers, 300);
    return () => clearTimeout(handle);
  }, [search, roleFilter]);

  const handleDelete = async (id, name) => {
    if (id === currentUser.id) return;
    if (!window.confirm(`هل أنت متأكد من حذف "${name}"؟`)) return;
    try {
      await api.users.delete(id);
      setUsers(users.filter((u) => u.id !== id));
    } catch (err) {
      alert('خطأ: ' + (err.message || 'فشل الحذف'));
    }
  };

  const handleToggleActive = async (id) => {
    try {
      const res = await api.users.toggleActive(id);
      setUsers(users.map((u) => (u.id === id ? { ...u, isActive: res.user.isActive } : u)));
    } catch (err) {
      alert('خطأ: ' + (err.message || 'فشل التغيير'));
    }
  };

  const roleLabels = { STUDENT: 'طالب', OWNER: 'مالك عقار', ADMIN: 'مدير' };

  const studentsCount = users.filter((u) => u.role === 'STUDENT').length;
  const ownersCount = users.filter((u) => u.role === 'OWNER').length;

  return (
    <>
      <div className="admin-stats">
        <div className="stat-card">
          <FiUsers className="stat-icon-bg" />
          <div className="stat-content">
            <div className="stat-number">{users.length}</div>
            <div className="stat-label">إجمالي المستخدمين</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderColor: '#34a853' }}>
          <FiHome className="stat-icon-bg" />
          <div className="stat-content">
            <div className="stat-number" style={{ color: '#34a853' }}>{ownersCount}</div>
            <div className="stat-label">ملاك العقارات</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderColor: '#0284c7' }}>
          <FiShield className="stat-icon-bg" />
          <div className="stat-content">
            <div className="stat-number" style={{ color: '#0284c7' }}>{studentsCount}</div>
            <div className="stat-label">الطلاب</div>
          </div>
        </div>
      </div>

      <div className="admin-filters">
        <div className="admin-search">
          <FiSearch />
          <input
            type="text"
            placeholder="بحث بالاسم أو البريد أو الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="admin-role-filter"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">كل الأدوار</option>
          <option value="STUDENT">طلاب</option>
          <option value="OWNER">ملاك</option>
          <option value="ADMIN">مدراء</option>
        </select>
      </div>

      {error && <div className="admin-error">{error}</div>}

      {loading ? (
        <div className="loading-state">جاري التحميل...</div>
      ) : (
        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>المستخدم</th>
                <th>الدور</th>
                <th>الحالة</th>
                <th>تاريخ الانضمام</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ opacity: user.isActive === false ? 0.6 : 1 }}>
                  <td>
                    <div className="user-cell-info">
                      <div className="user-cell-avatar">{user.name.charAt(0).toUpperCase()}</div>
                      <div className="user-cell-details">
                        <span className="user-cell-name">{user.name}</span>
                        <span className="user-cell-email">{user.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`role-badge ${user.role.toLowerCase()}`}>
                      {roleLabels[user.role] || user.role}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${user.isActive !== false ? 'active' : 'inactive'}`}>
                      {user.isActive !== false ? 'مفعّل' : 'معطّل'}
                    </span>
                  </td>
                  <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString('ar-EG') : '—'}</td>
                  <td>
                    <div className="action-buttons">
                      {user.id !== currentUser.id && user.role !== 'ADMIN' && (
                        <button
                          className="action-btn toggle-btn"
                          onClick={() => handleToggleActive(user.id)}
                          title={user.isActive !== false ? 'تعطيل' : 'تفعيل'}
                        >
                          {user.isActive !== false ? <FiToggleRight color="#10b981" /> : <FiToggleLeft color="#dc2626" />}
                        </button>
                      )}
                      <button
                        className="action-btn delete-btn"
                        onClick={() => handleDelete(user.id, user.name)}
                        disabled={user.id === currentUser.id}
                        title="حذف"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: 40 }}>لا يوجد مستخدمين</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ── Properties Tab (UC-31, UC-32, UC-33) ──
function PropertiesTab() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.properties.list({ q: search })
      .then((data) => setProperties(data.properties || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search]);

  const handleDelete = async (id, title) => {
    if (!window.confirm(`حذف العقار "${title}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
    try {
      await api.properties.delete(id);
      setProperties(properties.filter((p) => p.id !== id));
    } catch (err) {
      alert('خطأ: ' + (err.message || 'فشل الحذف'));
    }
  };

  const handleToggleAvailability = async (id, available) => {
    try {
      await api.properties.toggleAvailability(id, !available);
      setProperties(properties.map((p) => (p.id === id ? { ...p, available: !available } : p)));
    } catch (err) {
      alert('خطأ: ' + (err.message || 'فشل التغيير'));
    }
  };

  if (loading) return <div className="loading-state">جاري التحميل...</div>;

  return (
    <>
      <div className="admin-stats">
        <div className="stat-card">
          <FiHome className="stat-icon-bg" />
          <div className="stat-content">
            <div className="stat-number">{properties.length}</div>
            <div className="stat-label">إجمالي العقارات</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderColor: '#10b981' }}>
          <div className="stat-content">
            <div className="stat-number" style={{ color: '#10b981' }}>
              {properties.filter((p) => p.available).length}
            </div>
            <div className="stat-label">متاح</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderColor: '#dc2626' }}>
          <div className="stat-content">
            <div className="stat-number" style={{ color: '#dc2626' }}>
              {properties.filter((p) => !p.available).length}
            </div>
            <div className="stat-label">معطّل/مرفوض</div>
          </div>
        </div>
      </div>

      <div className="admin-filters">
        <div className="admin-search">
          <FiSearch />
          <input type="text" placeholder="بحث بالاسم أو الحي..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>العقار</th>
              <th>المالك</th>
              <th>الحالة</th>
              <th>الغرف</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {properties.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="user-cell-details">
                    <span className="user-cell-name">{p.title}</span>
                    <span className="user-cell-email">{p.city}</span>
                  </div>
                </td>
                <td>{p.owner?.name || '—'}</td>
                <td>
                  <span className={`status-badge ${p.available ? 'active' : 'inactive'}`}>
                    {p.available ? 'متاح' : 'معطّل'}
                  </span>
                </td>
                <td>{p.roomVariants?.length || 0}</td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="action-btn toggle-btn"
                      onClick={() => handleToggleAvailability(p.id, p.available)}
                      title={p.available ? 'تعطيل (رفض)' : 'تفعيل'}
                    >
                      {p.available ? <FiToggleRight color="#10b981" /> : <FiToggleLeft color="#dc2626" />}
                    </button>
                    <button
                      className="action-btn delete-btn"
                      onClick={() => handleDelete(p.id, p.title)}
                      title="حذف"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {properties.length === 0 && (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: 40 }}>لا يوجد عقارات</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Ratings Tab (UC-35) ──
function RatingsTab() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.reviews.adminList()
      .then((data) => setReviews(data.reviews || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('حذف هذا التقييم؟')) return;
    try {
      await api.reviews.adminDelete(id);
      setReviews(reviews.filter((r) => r.id !== id));
    } catch (err) {
      alert('خطأ: ' + (err.message || 'فشل الحذف'));
    }
  };

  if (loading) return <div className="loading-state">جاري التحميل...</div>;

  return (
    <>
      <div className="admin-stats">
        <div className="stat-card">
          <FiStar className="stat-icon-bg" />
          <div className="stat-content">
            <div className="stat-number">{reviews.length}</div>
            <div className="stat-label">إجمالي التقييمات</div>
          </div>
        </div>
      </div>

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>الطالب</th>
              <th>العقار</th>
              <th>التقييم</th>
              <th>التعليق</th>
              <th>التاريخ</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((r) => (
              <tr key={r.id}>
                <td>{r.student?.name || '—'}</td>
                <td>{r.property?.title || '—'}</td>
                <td>{'⭐'.repeat(r.rating)}</td>
                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.comment || '—'}
                </td>
                <td>{new Date(r.createdAt).toLocaleDateString('ar-EG')}</td>
                <td>
                  <button className="action-btn delete-btn" onClick={() => handleDelete(r.id)} title="حذف">
                    <FiTrash2 />
                  </button>
                </td>
              </tr>
            ))}
            {reviews.length === 0 && (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: 40 }}>لا يوجد تقييمات</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Stats Tab (UC-36) ──
// ── Refunds Tab (UC-37) ──
function RefundsTab() {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const fetchRefunds = () => {
    setLoading(true);
    api.refunds.list(filter)
      .then((data) => setRefunds(data.refunds || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRefunds(); }, [filter]);

  const handleApprove = async (id) => {
    if (!window.confirm('الموافقة على طلب الاسترداد؟')) return;
    try {
      await api.refunds.approve(id);
      fetchRefunds();
    } catch (err) {
      alert('خطأ: ' + (err.message || 'فشل'));
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('سبب الرفض:');
    if (!reason) return;
    try {
      await api.refunds.reject(id, reason);
      fetchRefunds();
    } catch (err) {
      alert('خطأ: ' + (err.message || 'فشل'));
    }
  };

  const statusLabels = { PENDING: 'معلق', APPROVED: 'مقبول', REJECTED: 'مرفوض', COMPLETED: 'مكتمل' };
  const statusClass = { PENDING: '', APPROVED: 'active', REJECTED: 'inactive', COMPLETED: 'active' };

  if (loading) return <div className="loading-state">جاري التحميل...</div>;

  return (
    <>
      <div className="admin-filters">
        <select className="admin-role-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="PENDING">معلق</option>
          <option value="APPROVED">مقبول</option>
          <option value="REJECTED">مرفوض</option>
        </select>
      </div>

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>الطالب</th>
              <th>المبلغ الأصلي</th>
              <th>مبلغ الاسترداد</th>
              <th>النسبة</th>
              <th>الحالة</th>
              <th>التاريخ</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {refunds.map((r) => (
              <tr key={r.id}>
                <td>{r.student?.name || '—'}</td>
                <td>{Number(r.originalAmount).toLocaleString('en-US')} ₪</td>
                <td>{Number(r.refundAmount).toLocaleString('en-US')} ₪</td>
                <td>{r.refundPercentage}%</td>
                <td><span className={`status-badge ${statusClass[r.status] || ''}`}>{statusLabels[r.status] || r.status}</span></td>
                <td>{new Date(r.createdAt).toLocaleDateString('ar-EG')}</td>
                <td>
                  {r.status === 'PENDING' && (
                    <div className="action-buttons">
                      <button className="action-btn" onClick={() => handleApprove(r.id)} title="موافقة" style={{ color: '#10b981' }}>
                        <FiCheck />
                      </button>
                      <button className="action-btn" onClick={() => handleReject(r.id)} title="رفض" style={{ color: '#dc2626' }}>
                        <FiX />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {refunds.length === 0 && (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: 40 }}>لا يوجد طلبات استرداد</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Withdrawals Tab (UC-38) ──
function WithdrawalsTab() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const fetchWithdrawals = () => {
    setLoading(true);
    api.withdrawals.history(filter)
      .then((data) => setWithdrawals(data.withdrawals || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchWithdrawals(); }, [filter]);

  const handleApprove = async (id) => {
    if (!window.confirm('الموافقة على طلب السحب؟')) return;
    try {
      await api.admin.approveWithdrawal(id);
      fetchWithdrawals();
    } catch (err) {
      alert('خطأ: ' + (err.message || 'فشل'));
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('سبب الرفض:');
    if (!reason) return;
    try {
      await api.admin.rejectWithdrawal(id, reason);
      fetchWithdrawals();
    } catch (err) {
      alert('خطأ: ' + (err.message || 'فشل'));
    }
  };

  const statusLabels = { PENDING: 'معلق', APPROVED: 'مقبول', REJECTED: 'مرفوض', COMPLETED: 'مكتمل' };
  const statusClass = { PENDING: '', APPROVED: 'active', REJECTED: 'inactive', COMPLETED: 'active' };

  if (loading) return <div className="loading-state">جاري التحميل...</div>;

  return (
    <>
      <div className="admin-filters">
        <select className="admin-role-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="PENDING">معلق</option>
          <option value="APPROVED">مقبول</option>
          <option value="REJECTED">مرفوض</option>
        </select>
      </div>

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>المالك</th>
              <th>المبلغ</th>
              <th>البنك</th>
              <th>رقم الحساب</th>
              <th>الحالة</th>
              <th>التاريخ</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {withdrawals.map((w) => (
              <tr key={w.id}>
                <td>{w.owner?.name || '—'}</td>
                <td>{Number(w.amount).toLocaleString('en-US')} ₪</td>
                <td>{w.bankName || '—'}</td>
                <td style={{ direction: 'ltr' }}>{w.bankAccountNumber || '—'}</td>
                <td><span className={`status-badge ${statusClass[w.status] || ''}`}>{statusLabels[w.status] || w.status}</span></td>
                <td>{new Date(w.createdAt).toLocaleDateString('ar-EG')}</td>
                <td>
                  {w.status === 'PENDING' && (
                    <div className="action-buttons">
                      <button className="action-btn" onClick={() => handleApprove(w.id)} title="موافقة" style={{ color: '#10b981' }}>
                        <FiCheck />
                      </button>
                      <button className="action-btn" onClick={() => handleReject(w.id)} title="رفض" style={{ color: '#dc2626' }}>
                        <FiX />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {withdrawals.length === 0 && (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: 40 }}>لا يوجد طلبات سحب</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StatsTab() {
  const [stats, setStats] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(null);

  useEffect(() => {
    Promise.all([
      api.admin.stats(),
      api.admin.monthlyStats(),
    ]).then(([s, m]) => {
      setStats(s);
      setMonthly(m.months || []);
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleExport = async (type) => {
    setExporting(type);
    try {
      const res = await api.admin.exportData(type);
      const labels = { users: 'المستخدمين', bookings: 'الحجوزات', payments: 'المدفوعات' };
      exportCSV(res.data, labels[type] || type);
    } catch (err) {
      alert('خطأ: ' + (err.message || 'فشل التصدير'));
    } finally {
      setExporting(null);
    }
  };

  if (loading) return <div className="loading-state">جاري التحميل...</div>;
  if (!stats) return <div className="admin-error">تعذر تحميل الإحصائيات</div>;

  return (
    <>
      <div className="admin-stats-grid">
        <div className="stat-card"><div className="stat-content"><div className="stat-number">{stats.totalUsers}</div><div className="stat-label">المستخدمين</div></div></div>
        <div className="stat-card"><div className="stat-content"><div className="stat-number">{stats.totalStudents}</div><div className="stat-label">الطلاب</div></div></div>
        <div className="stat-card"><div className="stat-content"><div className="stat-number">{stats.totalOwners}</div><div className="stat-label">الملاك</div></div></div>
        <div className="stat-card"><div className="stat-content"><div className="stat-number">{stats.totalProperties}</div><div className="stat-label">العقارات</div></div></div>
        <div className="stat-card"><div className="stat-content"><div className="stat-number">{stats.totalBookings}</div><div className="stat-label">الحجوزات</div></div></div>
        <div className="stat-card"><div className="stat-content"><div className="stat-number">{stats.pendingBookings}</div><div className="stat-label">حجوزات معلقة</div></div></div>
        <div className="stat-card"><div className="stat-content"><div className="stat-number">{stats.totalPayments}</div><div className="stat-label">المدفوعات</div></div></div>
        <div className="stat-card"><div className="stat-content"><div className="stat-number">{stats.totalRevenue?.toLocaleString('en-US')} ₪</div><div className="stat-label">إجمالي الإيرادات</div></div></div>
        <div className="stat-card"><div className="stat-content"><div className="stat-number">{stats.totalReviews}</div><div className="stat-label">التقييمات</div></div></div>
        <div className="stat-card"><div className="stat-content"><div className="stat-number">{stats.pendingRefunds}</div><div className="stat-label">طلبات استرداد</div></div></div>
        <div className="stat-card"><div className="stat-content"><div className="stat-number">{stats.pendingWithdrawals}</div><div className="stat-label">طلبات سحب</div></div></div>
      </div>

      {monthly.length > 0 && (
        <>
          <div className="chart-section">
            <h3>الحجوزات الشهرية</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="bookings" fill="#4f46e5" name="حجوزات" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-section">
            <h3>نمو المستخدمين</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="users" stroke="#10b981" strokeWidth={3} name="مستخدمين جدد" dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-section">
            <h3>الإيرادات الشهرية (₪)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="revenue" fill="#059669" name="إيرادات" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <div className="export-section">
        <h3>تصدير البيانات</h3>
        <div className="export-buttons">
          <button className="export-btn" onClick={() => handleExport('users')} disabled={exporting === 'users'}>
            <FiDownload /> {exporting === 'users' ? 'جاري...' : 'تصدير المستخدمين'}
          </button>
          <button className="export-btn" onClick={() => handleExport('bookings')} disabled={exporting === 'bookings'}>
            <FiDownload /> {exporting === 'bookings' ? 'جاري...' : 'تصدير الحجوزات'}
          </button>
          <button className="export-btn" onClick={() => handleExport('payments')} disabled={exporting === 'payments'}>
            <FiDownload /> {exporting === 'payments' ? 'جاري...' : 'تصدير المدفوعات'}
          </button>
        </div>
      </div>
    </>
  );
}
