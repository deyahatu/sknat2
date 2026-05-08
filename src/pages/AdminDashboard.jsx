import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../components/shared/Toast';
import ConfirmModal from '../components/shared/ConfirmModal';
import { FiUsers, FiHome, FiShield, FiTrash2, FiAlertCircle, FiSearch, FiToggleLeft, FiToggleRight, FiStar, FiBarChart2, FiDollarSign, FiCreditCard, FiCheck, FiX, FiDownload, FiFileText, FiFlag, FiAlertTriangle } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import './AdminDashboard.css';

const TABS = [
  { id: 'users', label: 'المستخدمين', icon: <FiUsers /> },
  { id: 'properties', label: 'العقارات', icon: <FiHome /> },
  { id: 'refunds', label: 'طلبات الاسترداد', icon: <FiCreditCard /> },
  { id: 'withdrawals', label: 'طلبات السحب', icon: <FiDollarSign /> },
  { id: 'ratings', label: 'التقييمات', icon: <FiStar /> },
  { id: 'stats', label: 'الإحصائيات', icon: <FiBarChart2 /> },
  { id: 'audit', label: 'سجل النشاط', icon: <FiFileText /> },
  { id: 'reports', label: 'بلاغات التقييمات', icon: <FiFlag /> },
  { id: 'complaints', label: 'الشكاوى', icon: <FiAlertTriangle /> },
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
          {activeTab === 'audit' && <AuditTab />}
          {activeTab === 'reports' && <ReportsTab />}
          {activeTab === 'complaints' && <ComplaintsTab />}
        </main>
      </div>
    </div>
  );
}

// ── Users Tab (UC-27, UC-28, UC-29, UC-30) ──
function UsersTab({ currentUser }) {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [confirmState, setConfirmState] = useState({ open: false, action: null, title: '', message: '' });

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

  const handleDelete = (id, name) => {
    if (id === currentUser.id) return;
    setConfirmState({
      open: true,
      title: 'تأكيد الحذف',
      message: `هل أنت متأكد من حذف "${name}"؟`,
      action: async () => {
        try {
          await api.users.delete(id);
          setUsers(users.filter((u) => u.id !== id));
        } catch (err) {
          toast.error(err.message || 'فشل الحذف');
        }
      },
    });
  };

  const handleToggleActive = async (id) => {
    try {
      const res = await api.users.toggleActive(id);
      setUsers(users.map((u) => (u.id === id ? { ...u, isActive: res.user.isActive } : u)));
    } catch (err) {
      toast.error(err.message || 'فشل التغيير');
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
      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmText="تأكيد"
        variant="danger"
        onConfirm={async () => { await confirmState.action?.(); setConfirmState(s => ({ ...s, open: false })); }}
        onCancel={() => setConfirmState(s => ({ ...s, open: false }))}
      />
    </>
  );
}

// ── Properties Tab (UC-31, UC-32, UC-33) ──
function PropertiesTab() {
  const toast = useToast();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirmState, setConfirmState] = useState({ open: false, action: null, title: '', message: '' });

  useEffect(() => {
    api.properties.list({ q: search })
      .then((data) => setProperties(data.properties || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search]);

  const handleDelete = (id, title) => {
    setConfirmState({
      open: true,
      title: 'تأكيد الحذف',
      message: `حذف العقار "${title}"؟ هذا الإجراء لا يمكن التراجع عنه.`,
      action: async () => {
        try {
          await api.properties.delete(id);
          setProperties(properties.filter((p) => p.id !== id));
        } catch (err) {
          toast.error(err.message || 'فشل الحذف');
        }
      },
    });
  };

  const handleToggleAvailability = async (id, available) => {
    try {
      await api.properties.toggleAvailability(id, !available);
      setProperties(properties.map((p) => (p.id === id ? { ...p, available: !available } : p)));
    } catch (err) {
      toast.error(err.message || 'فشل التغيير');
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
      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmText="تأكيد"
        variant="danger"
        onConfirm={async () => { await confirmState.action?.(); setConfirmState(s => ({ ...s, open: false })); }}
        onCancel={() => setConfirmState(s => ({ ...s, open: false }))}
      />
    </>
  );
}

// ── Ratings Tab (UC-35) ──
function RatingsTab() {
  const toast = useToast();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmState, setConfirmState] = useState({ open: false, action: null, title: '', message: '' });

  useEffect(() => {
    api.reviews.adminList()
      .then((data) => setReviews(data.reviews || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = (id) => {
    setConfirmState({
      open: true,
      title: 'تأكيد الحذف',
      message: 'حذف هذا التقييم؟',
      action: async () => {
        try {
          await api.reviews.adminDelete(id);
          setReviews(reviews.filter((r) => r.id !== id));
        } catch (err) {
          toast.error(err.message || 'فشل الحذف');
        }
      },
    });
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
      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmText="تأكيد"
        variant="danger"
        onConfirm={async () => { await confirmState.action?.(); setConfirmState(s => ({ ...s, open: false })); }}
        onCancel={() => setConfirmState(s => ({ ...s, open: false }))}
      />
    </>
  );
}

// ── Stats Tab (UC-36) ──
// ── Refunds Tab (UC-37) ──
function RefundsTab() {
  const toast = useToast();
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [confirmState, setConfirmState] = useState({ open: false, action: null, title: '', message: '' });
  const [promptState, setPromptState] = useState({ open: false, action: null });

  const fetchRefunds = () => {
    setLoading(true);
    api.refunds.list(filter)
      .then((data) => setRefunds(data.refunds || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRefunds(); }, [filter]);

  const handleApprove = (id) => {
    setConfirmState({
      open: true,
      title: 'تأكيد الموافقة',
      message: 'الموافقة على طلب الاسترداد؟',
      action: async () => {
        try {
          await api.refunds.approve(id);
          fetchRefunds();
        } catch (err) {
          toast.error(err.message || 'فشل');
        }
      },
    });
  };

  const handleReject = (id) => {
    setPromptState({
      open: true,
      action: async (reason) => {
        try {
          await api.refunds.reject(id, reason);
          fetchRefunds();
        } catch (err) {
          toast.error(err.message || 'فشل');
        }
      },
    });
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
      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmText="تأكيد"
        variant="danger"
        onConfirm={async () => { await confirmState.action?.(); setConfirmState(s => ({ ...s, open: false })); }}
        onCancel={() => setConfirmState(s => ({ ...s, open: false }))}
      />
      <ConfirmModal
        open={promptState.open}
        title="سبب الرفض"
        inputMode
        inputPlaceholder="اكتب سبب الرفض..."
        confirmText="رفض"
        variant="warning"
        onConfirm={async (reason) => { await promptState.action?.(reason); setPromptState({ open: false }); }}
        onCancel={() => setPromptState({ open: false })}
      />
    </>
  );
}

// ── Withdrawals Tab (UC-38) ──
function WithdrawalsTab() {
  const toast = useToast();
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [confirmState, setConfirmState] = useState({ open: false, action: null, title: '', message: '' });
  const [promptState, setPromptState] = useState({ open: false, action: null });

  const fetchWithdrawals = () => {
    setLoading(true);
    api.withdrawals.history(filter)
      .then((data) => setWithdrawals(data.withdrawals || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchWithdrawals(); }, [filter]);

  const handleApprove = (id) => {
    setConfirmState({
      open: true,
      title: 'تأكيد الموافقة',
      message: 'الموافقة على طلب السحب؟',
      action: async () => {
        try {
          await api.admin.approveWithdrawal(id);
          fetchWithdrawals();
        } catch (err) {
          toast.error(err.message || 'فشل');
        }
      },
    });
  };

  const handleReject = (id) => {
    setPromptState({
      open: true,
      action: async (reason) => {
        try {
          await api.admin.rejectWithdrawal(id, reason);
          fetchWithdrawals();
        } catch (err) {
          toast.error(err.message || 'فشل');
        }
      },
    });
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
      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmText="تأكيد"
        variant="danger"
        onConfirm={async () => { await confirmState.action?.(); setConfirmState(s => ({ ...s, open: false })); }}
        onCancel={() => setConfirmState(s => ({ ...s, open: false }))}
      />
      <ConfirmModal
        open={promptState.open}
        title="سبب الرفض"
        inputMode
        inputPlaceholder="اكتب سبب الرفض..."
        confirmText="رفض"
        variant="warning"
        onConfirm={async (reason) => { await promptState.action?.(reason); setPromptState({ open: false }); }}
        onCancel={() => setPromptState({ open: false })}
      />
    </>
  );
}

// ── Audit Log Tab ──
function AuditTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('');

  const fetchLogs = () => {
    setLoading(true);
    const params = {};
    if (entityFilter) params.entity = entityFilter;
    api.admin.auditLog(params)
      .then((data) => setLogs(data.logs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLogs(); }, [entityFilter]);

  const actionLabels = {
    ACCEPT: 'قبول',
    REJECT: 'رفض',
    CANCEL: 'إلغاء',
    COMPLETE: 'إكمال',
    CREATE: 'إنشاء',
    DELETE: 'حذف',
    TOGGLE_ACTIVE: 'تغيير الحالة',
  };

  const entityLabels = {
    BOOKING: 'حجز',
    PROPERTY: 'عقار',
    USER: 'مستخدم',
  };

  if (loading) return <div className="loading-state">جاري التحميل...</div>;

  return (
    <>
      <div className="admin-filters">
        <select className="admin-role-filter" value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
          <option value="">كل الأنواع</option>
          <option value="BOOKING">حجز</option>
          <option value="PROPERTY">عقار</option>
          <option value="USER">مستخدم</option>
        </select>
      </div>

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>المستخدم</th>
              <th>الإجراء</th>
              <th>النوع</th>
              <th>التفاصيل</th>
              <th>التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{log.userName}</td>
                <td><span className="role-badge">{actionLabels[log.action] || log.action}</span></td>
                <td>{entityLabels[log.entity] || log.entity}</td>
                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.details || '—'}
                </td>
                <td>{new Date(log.createdAt).toLocaleString('ar-EG')}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: 40 }}>لا يوجد سجلات</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StatsTab() {
  const toast = useToast();
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
      toast.error(err.message || 'فشل التصدير');
    } finally {
      setExporting(null);
    }
  };

  if (loading) return <div style={{ padding: 20 }}><Skeleton height={40} /><div style={{ height: 16 }} /><Skeleton height={20} count={5} /></div>;
  if (!stats) return <div className="admin-error">تعذر تحميل الإحصائيات</div>;

  const highlights = [
    { label: 'إجمالي الإيرادات', value: `${stats.totalRevenue?.toLocaleString('en-US')} ₪`, color: '#059669', bg: '#ecfdf5', icon: <FiDollarSign /> },
    { label: 'المستخدمين', value: stats.totalUsers, color: '#4f46e5', bg: '#eef2ff', icon: <FiUsers /> },
    { label: 'الحجوزات', value: stats.totalBookings, color: '#0891b2', bg: '#ecfeff', icon: <FiCreditCard /> },
    { label: 'العقارات', value: stats.totalProperties, color: '#d97706', bg: '#fffbeb', icon: <FiHome /> },
  ];

  const details = [
    { label: 'الطلاب', value: stats.totalStudents },
    { label: 'الملاك', value: stats.totalOwners },
    { label: 'المدفوعات', value: stats.totalPayments },
    { label: 'حجوزات معلقة', value: stats.pendingBookings, warn: stats.pendingBookings > 0 },
    { label: 'التقييمات', value: stats.totalReviews },
    { label: 'طلبات استرداد', value: stats.pendingRefunds, warn: stats.pendingRefunds > 0 },
    { label: 'طلبات سحب', value: stats.pendingWithdrawals, warn: stats.pendingWithdrawals > 0 },
  ];

  return (
    <>
      {/* Highlight cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        {highlights.map((h, i) => (
          <div key={i} style={{
            background: h.bg, borderRadius: 16, padding: '24px 20px',
            display: 'flex', alignItems: 'center', gap: 16,
            border: `1px solid ${h.color}22`, transition: 'transform 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: `${h.color}18`, color: h.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>{h.icon}</div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 900, color: h.color, lineHeight: 1 }}>{h.value}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{h.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Detail stats row */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 28,
        background: '#fff', borderRadius: 14, padding: '18px 20px',
        border: '1px solid #e8ecf4',
      }}>
        {details.map((d, i) => (
          <div key={i} style={{
            flex: '1 1 120px', textAlign: 'center', padding: '8px 0',
            borderLeft: i < details.length - 1 ? '1px solid #f0f0f0' : 'none',
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: d.warn ? '#dc2626' : '#1e293b' }}>{d.value}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{d.label}</div>
          </div>
        ))}
      </div>

      {/* Charts — 2-column grid */}
      {monthly.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div className="chart-section">
            <h3>الحجوزات الشهرية</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="bookings" fill="#4f46e5" name="حجوزات" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-section">
            <h3>نمو المستخدمين</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                <Line type="monotone" dataKey="users" stroke="#10b981" strokeWidth={3} name="مستخدمين جدد" dot={{ r: 5, fill: '#10b981' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-section" style={{ gridColumn: '1 / -1' }}>
            <h3>الإيرادات الشهرية (₪)</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="revenue" fill="#059669" name="إيرادات" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Export */}
      <div style={{
        background: '#f8fafc', borderRadius: 14, padding: '20px 24px',
        border: '1px solid #e8ecf4', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>تصدير البيانات</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>حمّل ملف CSV لأي قسم</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['users', 'bookings', 'payments'].map(type => {
            const labels = { users: 'المستخدمين', bookings: 'الحجوزات', payments: 'المدفوعات' };
            return (
              <button key={type} className="export-btn" onClick={() => handleExport(type)} disabled={exporting === type}>
                <FiDownload /> {exporting === type ? 'جاري...' : labels[type]}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── Reports Tab (UC-41) ──
function ReportsTab() {
  const toast = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [confirmState, setConfirmState] = useState({ open: false, action: null, title: '', message: '' });

  const reasonLabels = { OFFENSIVE: 'مسيء', INCORRECT: 'خاطئ', SPAM: 'سبام' };
  const statusLabels = { PENDING: 'معلق', REVIEWED: 'تمت المراجعة', DISMISSED: 'مرفوض' };
  const statusClass = { PENDING: '', REVIEWED: 'active', DISMISSED: 'inactive' };

  const fetchReports = () => {
    setLoading(true);
    api.reports.list(filter)
      .then((data) => setReports(data.reports || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchReports(); }, [filter]);

  const handleDeleteReview = (id) => {
    setConfirmState({
      open: true,
      title: 'تأكيد الحذف',
      message: 'حذف التقييم وإغلاق البلاغ؟',
      action: async () => {
        try {
          await api.reports.review(id, { action: 'delete_review' });
          fetchReports();
        } catch (err) {
          toast.error(err.message || 'فشل');
        }
      },
    });
  };

  const handleDismiss = (id) => {
    setConfirmState({
      open: true,
      title: 'رفض البلاغ',
      message: 'رفض البلاغ؟',
      action: async () => {
        try {
          await api.reports.review(id, { action: 'dismiss' });
          fetchReports();
        } catch (err) {
          toast.error(err.message || 'فشل');
        }
      },
    });
  };

  if (loading) return <div className="loading-state">جاري التحميل...</div>;

  return (
    <>
      <div className="admin-filters">
        <select className="admin-role-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="PENDING">معلق</option>
          <option value="REVIEWED">تمت المراجعة</option>
          <option value="DISMISSED">مرفوض</option>
        </select>
      </div>

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>المُبلِّغ</th>
              <th>تعليق التقييم</th>
              <th>السبب</th>
              <th>الحالة</th>
              <th>التاريخ</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>{r.reporter?.name || '—'}</td>
                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.review?.comment || '—'}
                </td>
                <td>{reasonLabels[r.reason] || r.reason}</td>
                <td><span className={`status-badge ${statusClass[r.status] || ''}`}>{statusLabels[r.status] || r.status}</span></td>
                <td>{new Date(r.createdAt).toLocaleDateString('ar-EG')}</td>
                <td>
                  {r.status === 'PENDING' && (
                    <div className="action-buttons">
                      <button className="action-btn delete-btn" onClick={() => handleDeleteReview(r.id)} title="حذف التقييم">
                        <FiTrash2 />
                      </button>
                      <button className="action-btn" onClick={() => handleDismiss(r.id)} title="رفض البلاغ" style={{ color: '#6b7280' }}>
                        <FiX />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: 40 }}>لا يوجد بلاغات</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmText="تأكيد"
        variant="danger"
        onConfirm={async () => { await confirmState.action?.(); setConfirmState(s => ({ ...s, open: false })); }}
        onCancel={() => setConfirmState(s => ({ ...s, open: false }))}
      />
    </>
  );
}

// ── Complaints Tab (UC-34) ──
function ComplaintsTab() {
  const toast = useToast();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [replies, setReplies] = useState({});
  const [statusEdits, setStatusEdits] = useState({});
  const [saving, setSaving] = useState({});

  const TYPE_LABELS = { ACCOMMODATION: 'سكن', USER_ISSUE: 'مستخدم', TECHNICAL: 'تقني', OTHER: 'أخرى' };
  const STATUS_LABELS = { OPEN: 'مفتوحة', IN_REVIEW: 'قيد المراجعة', RESOLVED: 'محلولة', REJECTED: 'مرفوضة' };
  const STATUS_CLASS = { OPEN: '', IN_REVIEW: '', RESOLVED: 'active', REJECTED: 'inactive' };

  const fetchComplaints = () => {
    setLoading(true);
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (typeFilter) params.type = typeFilter;
    api.complaints.list(params)
      .then((data) => setComplaints(data.complaints || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchComplaints(); }, [statusFilter, typeFilter]);

  const handleSave = async (id) => {
    setSaving((s) => ({ ...s, [id]: true }));
    try {
      await api.complaints.update(id, {
        status: statusEdits[id] || complaints.find((c) => c.id === id)?.status,
        adminResponse: replies[id] || '',
      });
      fetchComplaints();
    } catch (err) {
      toast.error(err.message || 'فشل');
    } finally {
      setSaving((s) => ({ ...s, [id]: false }));
    }
  };

  if (loading) return <div className="loading-state">جاري التحميل...</div>;

  return (
    <>
      <div className="admin-filters">
        <select className="admin-role-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="OPEN">مفتوحة</option>
          <option value="IN_REVIEW">قيد المراجعة</option>
          <option value="RESOLVED">محلولة</option>
          <option value="REJECTED">مرفوضة</option>
        </select>
        <select className="admin-role-filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">كل الأنواع</option>
          <option value="ACCOMMODATION">سكن</option>
          <option value="USER_ISSUE">مستخدم</option>
          <option value="TECHNICAL">تقني</option>
          <option value="OTHER">أخرى</option>
        </select>
      </div>

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>المستخدم</th>
              <th>النوع</th>
              <th>الموضوع</th>
              <th>الحالة</th>
              <th>التاريخ</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {complaints.map((c) => (
              <tr key={c.id}>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600 }}>{c.user?.name || c.userName || '—'}</span>
                    <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{c.user?.email || ''}</span>
                  </div>
                </td>
                <td><span className="role-badge">{TYPE_LABELS[c.type] || c.type}</span></td>
                <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.subject}</td>
                <td>
                  <span className={`status-badge ${STATUS_CLASS[c.status] || ''}`}>
                    {STATUS_LABELS[c.status] || c.status}
                  </span>
                </td>
                <td>{new Date(c.createdAt).toLocaleDateString('ar-EG')}</td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}>
                    <select
                      defaultValue={c.status}
                      onChange={(e) => setStatusEdits((s) => ({ ...s, [c.id]: e.target.value }))}
                      style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                    >
                      <option value="OPEN">مفتوحة</option>
                      <option value="IN_REVIEW">قيد المراجعة</option>
                      <option value="RESOLVED">محلولة</option>
                      <option value="REJECTED">مرفوضة</option>
                    </select>
                    <textarea
                      placeholder="رد على الشكوى..."
                      defaultValue={c.adminResponse || ''}
                      rows={2}
                      onChange={(e) => setReplies((r) => ({ ...r, [c.id]: e.target.value }))}
                      style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem', resize: 'vertical' }}
                    />
                    <button
                      className="action-btn"
                      onClick={() => handleSave(c.id)}
                      disabled={saving[c.id]}
                      style={{ color: '#fff', background: '#4f46e5', borderRadius: 6, padding: '4px 12px', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      {saving[c.id] ? 'جاري...' : 'حفظ'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {complaints.length === 0 && (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: 40 }}>لا يوجد شكاوى</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
