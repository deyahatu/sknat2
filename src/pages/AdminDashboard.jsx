import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../components/shared/Toast';
import ConfirmModal from '../components/shared/ConfirmModal';
import Skeleton from '../components/shared/Skeleton';
import { FiUsers, FiHome, FiShield, FiTrash2, FiAlertCircle, FiSearch, FiToggleLeft, FiToggleRight, FiStar, FiBarChart2, FiDollarSign, FiCreditCard, FiCheck, FiX, FiDownload, FiFileText, FiFlag, FiLogOut } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import './AdminDashboard.css';

const TABS = [
  { id: 'users', label: 'المستخدمين', icon: <FiUsers /> },
  { id: 'properties', label: 'العقارات', icon: <FiHome /> },
  { id: 'refunds', label: 'طلبات الاسترداد', icon: <FiCreditCard /> },
  { id: 'withdrawals', label: 'طلبات السحب', icon: <FiDollarSign /> },
  { id: 'appeals', label: 'اعتراضات الحظر', icon: <FiAlertCircle /> },
  { id: 'ratings', label: 'التقييمات', icon: <FiStar /> },
  { id: 'stats', label: 'الإحصائيات', icon: <FiBarChart2 /> },
  { id: 'audit', label: 'سجل النشاط', icon: <FiFileText /> },
  { id: 'reports', label: 'البلاغات والشكاوى', icon: <FiFlag /> },
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
  const { user: currentUser, logout } = useAuth();
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
          <button
            type="button"
            className="admin-sidebar-logout"
            onClick={() => logout()}
          >
            <FiLogOut />
            <span>تسجيل الخروج</span>
          </button>
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
          {activeTab === 'appeals' && <AppealsTab />}
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
  const [selectedUser, setSelectedUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(false);
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

  // Modal state for entering the block reason. Unblocking doesn't need a
  // reason — only blocking does.
  const [blockModal, setBlockModal] = useState({ open: false, userId: null, userName: '' });
  const [blockReason, setBlockReason] = useState('');
  const [blockSaving, setBlockSaving] = useState(false);

  const handleToggleActive = async (user) => {
    if (user.isActive === false) {
      // Unblock — no reason needed, no modal.
      try {
        const res = await api.users.toggleActive(user.id);
        setUsers(users.map((u) => (u.id === user.id ? { ...u, isActive: res.user.isActive } : u)));
      } catch (err) {
        toast.error(err.message || 'فشل التغيير');
      }
      return;
    }
    // Block — open the reason modal.
    setBlockModal({ open: true, userId: user.id, userName: user.name });
    setBlockReason('');
  };

  const confirmBlock = async () => {
    const reason = blockReason.trim();
    if (reason.length < 10 || reason.length > 200) {
      toast.error('يجب إدخال سبب الحظر (10 إلى 200 حرف).');
      return;
    }
    setBlockSaving(true);
    try {
      const res = await api.users.toggleActive(blockModal.userId, reason);
      setUsers(users.map((u) =>
        u.id === blockModal.userId ? { ...u, isActive: res.user.isActive } : u,
      ));
      toast.success('تم حظر أنشطة الحساب.');
      setBlockModal({ open: false, userId: null, userName: '' });
      setBlockReason('');
    } catch (err) {
      toast.error(err.message || 'فشل الحظر');
    } finally {
      setBlockSaving(false);
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
        <div className="stat-card ad-border-owner">
          <FiHome className="stat-icon-bg" />
          <div className="stat-content">
            <div className="stat-number ad-text-owner">{ownersCount}</div>
            <div className="stat-label">ملاك العقارات</div>
          </div>
        </div>
        <div className="stat-card ad-border-student">
          <FiShield className="stat-icon-bg" />
          <div className="stat-content">
            <div className="stat-number ad-text-student">{studentsCount}</div>
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
                <tr key={user.id} className={user.isActive === false ? 'at-user-opacity' : ''}>
                  <td>
                    <div className="user-cell-info" onClick={() => viewUser(user.id)}>
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
                      {user.isActive !== false ? 'مفعّل' : 'محظور الأنشطة'}
                    </span>
                  </td>
                  <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString('ar-EG') : '—'}</td>
                  <td>
                    <div className="action-buttons">
                      {user.id !== currentUser.id && user.role !== 'ADMIN' && (
                        <button
                          className="action-btn toggle-btn"
                          onClick={() => handleToggleActive(user)}
                          title={user.isActive !== false ? 'حظر الأنشطة' : 'رفع الحظر'}
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
                  <td colSpan="5" className="at-td-center">لا يوجد مستخدمين</td>
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

      {/* Block reason modal */}
      {blockModal.open && (
        <div className="ad-modal-overlay" onClick={() => !blockSaving && setBlockModal({ open: false, userId: null, userName: '' })}>
          <div className="ad-modal-box ad-block-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="ad-block-modal-title">حظر أنشطة: {blockModal.userName}</h3>
            <p className="ad-block-modal-sub">
              سيتلقى المستخدم إشعاراً + بريداً إلكترونياً بسبب الحظر، ويمكنه تقديم اعتراض واحد.
            </p>
            <label className="ad-block-modal-label">سبب الحظر (10–200 حرف) — إجباري</label>
            <textarea
              className="ad-block-modal-textarea"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value.slice(0, 200))}
              rows={4}
              placeholder="مثال: إساءة في الرسائل، بيانات هوية مزورة، انتهاك متكرر لسياسة المنصة..."
            />
            <div className="ad-block-modal-counter">
              {blockReason.length} / 200
            </div>
            <div className="ad-block-modal-actions">
              <button
                className="ad-block-modal-btn ghost"
                onClick={() => setBlockModal({ open: false, userId: null, userName: '' })}
                disabled={blockSaving}
              >
                إلغاء
              </button>
              <button
                className="ad-block-modal-btn danger"
                onClick={confirmBlock}
                disabled={blockSaving || blockReason.trim().length < 10}
              >
                {blockSaving ? 'جاري الحفظ...' : 'حظر الأنشطة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="ad-modal-overlay" onClick={() => setSelectedUser(null)}>
          <div onClick={(e) => e.stopPropagation()} className="ad-modal-box">
            {loadingUser ? (
              <div className="ad-modal-loading">جاري التحميل...</div>
            ) : selectedUser.id ? (
              <>
                <div className="ad-modal-head">
                  <h2 className="ad-modal-title">بيانات المستخدم</h2>
                  <button onClick={() => setSelectedUser(null)} className="ad-modal-close">✕</button>
                </div>
                <div className="ad-modal-user">
                  <div className="ad-modal-avatar">{selectedUser.name?.charAt(0)}</div>
                  <div className="ad-modal-username">{selectedUser.name}</div>
                  <div className="ad-modal-userrole">{roleLabels[selectedUser.role] || selectedUser.role}</div>
                </div>
                <div className="ad-modal-rows">
                  {[
                    { label: 'البريد', value: selectedUser.email },
                    { label: 'الهاتف', value: selectedUser.phone || '—' },
                    { label: 'رقم الهوية', value: selectedUser.idNumber || '—' },
                    { label: 'الجنس', value: selectedUser.gender === 'MALE' ? 'ذكر' : selectedUser.gender === 'FEMALE' ? 'أنثى' : '—' },
                    { label: 'التخصص', value: selectedUser.major || '—' },
                    { label: 'الحالة', value: selectedUser.isActive ? 'مفعّل' : 'محظور الأنشطة' },
                    { label: 'تاريخ التسجيل', value: new Date(selectedUser.createdAt).toLocaleDateString('ar-EG') },
                  ].map((row, i) => (
                    <div key={i} className={`ad-modal-row${i % 2 === 0 ? ' ad-modal-row--alt' : ''}`}>
                      <span className="ad-modal-row-label">{row.label}</span>
                      <span className="ad-modal-row-value">{row.value}</span>
                    </div>
                  ))}
                </div>
                {selectedUser.idPhoto && (
                  <div className="ad-modal-id">
                    <div className="ad-modal-id-label">صورة بطاقة الهوية:</div>
                    <img src={selectedUser.idPhoto} alt="بطاقة الهوية" className="ad-modal-id-img" />
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  );

  async function viewUser(id) {
    setLoadingUser(true);
    setSelectedUser({});
    try {
      const data = await api.users.get(id);
      setSelectedUser(data.user);
    } catch { toast.error('تعذر تحميل بيانات المستخدم'); setSelectedUser(null); }
    finally { setLoadingUser(false); }
  }
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
        <div className="stat-card ad-border-success">
          <div className="stat-content">
            <div className="stat-number ad-text-success">
              {properties.filter((p) => p.available).length}
            </div>
            <div className="stat-label">متاح</div>
          </div>
        </div>
        <div className="stat-card ad-border-danger">
          <div className="stat-content">
            <div className="stat-number ad-text-danger">
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
              <th>الحجوزات النشطة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {properties.map((p) => {
              const activeBookings = p.activeBookingsCount ?? p._count?.bookings ?? 0;
              return (
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
                    <span className={activeBookings > 0 ? 'ad-text-warning' : ''} style={{ fontWeight: 700 }}>
                      {activeBookings}
                    </span>
                  </td>
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
              );
            })}
            {properties.length === 0 && (
              <tr><td colSpan="6" className="at-td-center">لا يوجد عقارات</td></tr>
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
                <td className="at-truncate">
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
              <tr><td colSpan="6" className="at-td-center">لا يوجد تقييمات</td></tr>
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
                      <button className="action-btn ad-text-success" onClick={() => handleApprove(r.id)} title="موافقة">
                        <FiCheck />
                      </button>
                      <button className="action-btn ad-text-danger" onClick={() => handleReject(r.id)} title="رفض">
                        <FiX />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {refunds.length === 0 && (
              <tr><td colSpan="7" className="at-td-center">لا يوجد طلبات استرداد</td></tr>
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
                <td className="at-dir-ltr">{w.bankAccountNumber || '—'}</td>
                <td><span className={`status-badge ${statusClass[w.status] || ''}`}>{statusLabels[w.status] || w.status}</span></td>
                <td>{new Date(w.createdAt).toLocaleDateString('ar-EG')}</td>
                <td>
                  {w.status === 'PENDING' && (
                    <div className="action-buttons">
                      <button className="action-btn ad-text-success" onClick={() => handleApprove(w.id)} title="موافقة">
                        <FiCheck />
                      </button>
                      <button className="action-btn ad-text-danger" onClick={() => handleReject(w.id)} title="رفض">
                        <FiX />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {withdrawals.length === 0 && (
              <tr><td colSpan="7" className="at-td-center">لا يوجد طلبات سحب</td></tr>
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
                <td className="at-truncate">
                  {log.details || '—'}
                </td>
                <td>{new Date(log.createdAt).toLocaleString('ar-EG')}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan="5" className="at-td-center">لا يوجد سجلات</td></tr>
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
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(null);

  useEffect(() => {
    api.admin.recentActivity().then(d => setActivities(d.activities || [])).catch(() => {});
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

  if (loading) return <div className="ad-loading-wrap"><Skeleton height={40} /><div className="ad-loading-gap" /><Skeleton height={20} count={5} /></div>;
  if (!stats) return <div className="admin-error">تعذر تحميل الإحصائيات</div>;

  const highlights = [
    { label: 'إجمالي الإيرادات', value: `${stats.totalRevenue?.toLocaleString('en-US')} ₪`, color: '#059669', bg: '#ecfdf5', icon: <FiDollarSign /> },
    { label: 'المستخدمين', value: stats.totalUsers, color: '#4f46e5', bg: '#eef2ff', icon: <FiUsers /> },
    { label: 'الحجوزات', value: stats.totalBookings, color: '#0891b2', bg: '#ecfeff', icon: <FiCreditCard /> },
    { label: 'العقارات', value: stats.totalProperties, color: '#d97706', bg: '#fffbeb', icon: <FiHome /> },
  ];

  const occupancyRate = stats.totalRooms > 0 ? Math.round((stats.occupiedRooms / stats.totalRooms) * 100) : 0;

  const details = [
    { label: 'الطلاب', value: stats.totalStudents },
    { label: 'الملاك', value: stats.totalOwners },
    { label: 'معدل الإشغال', value: `${occupancyRate}%`, warn: occupancyRate < 20 },
    { label: 'غرف محجوزة', value: `${stats.occupiedRooms || 0}/${stats.totalRooms || 0}` },
    { label: 'المدفوعات', value: stats.totalPayments },
    { label: 'حجوزات معلقة', value: stats.pendingBookings, warn: stats.pendingBookings > 0 },
    { label: 'التقييمات', value: stats.totalReviews },
    { label: 'طلبات استرداد', value: stats.pendingRefunds, warn: stats.pendingRefunds > 0 },
    { label: 'طلبات سحب', value: stats.pendingWithdrawals, warn: stats.pendingWithdrawals > 0 },
  ];

  return (
    <>
      {/* Highlight cards */}
      <div className="as-highlights">
        {highlights.map((h, i) => (
          <div key={i} className="as-highlight-card" style={{
            background: h.bg, border: `1px solid ${h.color}22`,
          }}>
            <div className="as-highlight-icon" style={{
              background: `${h.color}18`, color: h.color,
            }}>{h.icon}</div>
            <div>
              <div className="as-highlight-value" style={{ color: h.color }}>{h.value}</div>
              <div className="as-highlight-label">{h.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Detail stats row */}
      <div className="as-details-row">
        {details.map((d, i) => (
          <div key={i} className="as-detail-item">
            <div className={`as-detail-value${d.warn ? ' as-detail-warn' : ''}`}>{d.value}</div>
            <div className="as-detail-label">{d.label}</div>
          </div>
        ))}
      </div>

      {/* Occupancy + Recent Activity */}
      <div className="as-middle-grid">
        {/* Occupancy Ring */}
        <div className="as-occupancy-card">
          <div className="as-occupancy-title">معدل الإشغال</div>
          <div className="as-occupancy-ring">
            <svg viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f0f0f0" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke={occupancyRate >= 70 ? '#10b981' : occupancyRate >= 40 ? '#d97706' : '#dc2626'} strokeWidth="3" strokeDasharray={`${occupancyRate} ${100 - occupancyRate}`} strokeLinecap="round" className="ad-ring-segment" />
            </svg>
            <div className="as-occupancy-number">{occupancyRate}%</div>
          </div>
          <div className="as-occupancy-subtitle">{stats.occupiedRooms || 0} محجوزة من {stats.totalRooms || 0} غرفة</div>
        </div>

        {/* Recent Activity */}
        <div className="as-activity-card">
          <div className="as-activity-title">آخر النشاطات</div>
          {activities.length === 0 ? (
            <div className="as-activity-empty">لا توجد نشاطات</div>
          ) : (
            <div className="as-activity-list">
              {activities.map((a, i) => {
                const statusColors = { PENDING: '#d97706', APPROVED: '#4f46e5', PAID: '#059669', COMPLETED: '#10b981', REJECTED: '#dc2626', CANCELLED: '#6b7280' };
                const statusLabels = { PENDING: 'معلق', APPROVED: 'مقبول', PAID: 'مدفوع', COMPLETED: 'مكتمل', REJECTED: 'مرفوض', CANCELLED: 'ملغى' };
                const timeAgo = (() => {
                  const diff = Math.floor((Date.now() - new Date(a.time).getTime()) / 60000);
                  if (diff < 1) return 'الآن';
                  if (diff < 60) return `منذ ${diff} د`;
                  if (diff < 1440) return `منذ ${Math.floor(diff / 60)} س`;
                  return `منذ ${Math.floor(diff / 1440)} يوم`;
                })();
                return (
                  <div key={i} className="as-activity-item">
                    <div className="as-activity-dot" style={{
                      background: a.type === 'payment' ? '#059669' : (statusColors[a.status] || '#94a3b8'),
                    }} />
                    <div className="as-activity-text">{a.text}</div>
                    <span className="as-activity-badge" style={{
                      background: `${statusColors[a.status] || '#94a3b8'}15`,
                      color: statusColors[a.status] || '#94a3b8',
                    }}>{statusLabels[a.status] || a.status}</span>
                    <span className="as-activity-time">{timeAgo}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Charts — 2-column grid */}
      {monthly.length > 0 && (
        <div className="as-charts-grid">
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

          <div className="chart-section ad-chart-full">
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
      <div className="as-export-bar">
        <div className="as-export-info">
          <div className="as-export-title">تصدير البيانات</div>
          <div className="as-export-sub">حمّل ملف CSV لأي قسم</div>
        </div>
        <div className="as-export-buttons">
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
  const [detailReport, setDetailReport] = useState(null);

  const reasonLabels = {
    OFFENSIVE: 'لغة مسيئة',
    FALSE_INFO: 'معلومات خاطئة',
    HARASSMENT: 'تحرّش',
    POLICY_VIOLATION: 'انتهاك السياسات',
  };
  const typeLabels = { REVIEW: 'تقييم سكن', STUDENT_RATING: 'تقييم طالب', MESSAGE: 'رسالة' };
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

  const handleDeleteTarget = (id) => {
    setConfirmState({
      open: true,
      title: 'تأكيد الحذف',
      message: 'حذف المحتوى المُبلَّغ عنه وإغلاق البلاغ؟',
      action: async () => {
        try {
          await api.reports.review(id, { action: 'delete_target' });
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
              <th>النوع</th>
              <th>المحتوى</th>
              <th>السبب</th>
              <th>التفاصيل</th>
              <th>الحالة</th>
              <th>التاريخ</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => {
              const targetText = r.type === 'MESSAGE'
                ? (r.message
                    ? `رسالة من ${r.message.sender?.name || 'مرسل'} → ${r.message.receiver?.name || 'مستلم'}: ${r.message.content || ''}`
                    : '— (الرسالة محذوفة)')
                : r.type === 'STUDENT_RATING'
                ? (r.studentRating
                    ? `تقييم ${r.studentRating.owner?.name || 'مالك'} للطالب ${r.studentRating.student?.name || ''} — ${r.studentRating.comment || 'بدون تعليق'}`
                    : '—')
                : (r.review?.comment || '—');
              return (
                <tr
                  key={r.id}
                  className="report-row-clickable"
                  onClick={() => setDetailReport(r)}
                >
                  <td>{r.reporter?.name || '—'}</td>
                  <td>{typeLabels[r.type] || r.type}</td>
                  <td className="at-truncate ad-cell--target">{targetText}</td>
                  <td>{reasonLabels[r.reason] || r.reason}</td>
                  <td className="at-truncate ad-cell--details">{r.details || '—'}</td>
                  <td><span className={`status-badge ${statusClass[r.status] || ''}`}>{statusLabels[r.status] || r.status}</span></td>
                  <td>{new Date(r.createdAt).toLocaleDateString('ar-EG')}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {r.status === 'PENDING' && (
                      <div className="action-buttons">
                        <button className="action-btn delete-btn" onClick={() => handleDeleteTarget(r.id)} title="حذف المحتوى">
                          <FiTrash2 />
                        </button>
                        <button className="action-btn ad-text-muted" onClick={() => handleDismiss(r.id)} title="رفض البلاغ">
                          <FiX />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {reports.length === 0 && (
              <tr><td colSpan="8" className="at-td-center">لا يوجد بلاغات</td></tr>
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

      {/* Report detail modal */}
      {detailReport && (
        <div className="ad-modal-overlay" onClick={() => setDetailReport(null)}>
          <div className="ad-modal-box report-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="report-detail-header">
              <h3>تفاصيل البلاغ</h3>
              <button
                type="button"
                className="bb-modal-close"
                onClick={() => setDetailReport(null)}
              >
                <FiX />
              </button>
            </div>

            <div className="report-detail-grid">
              <div className="report-detail-item">
                <span className="report-detail-label">المُبلِّغ</span>
                <span className="report-detail-value">{detailReport.reporter?.name || '—'}</span>
                {detailReport.reporter?.email && (
                  <span className="report-detail-sub">{detailReport.reporter.email}</span>
                )}
              </div>

              <div className="report-detail-item">
                <span className="report-detail-label">النوع</span>
                <span className="report-detail-value">{typeLabels[detailReport.type] || detailReport.type}</span>
              </div>

              <div className="report-detail-item">
                <span className="report-detail-label">السبب</span>
                <span className="report-detail-value">{reasonLabels[detailReport.reason] || detailReport.reason}</span>
              </div>

              <div className="report-detail-item">
                <span className="report-detail-label">الحالة</span>
                <span className={`status-badge ${statusClass[detailReport.status] || ''}`}>
                  {statusLabels[detailReport.status] || detailReport.status}
                </span>
              </div>

              <div className="report-detail-item">
                <span className="report-detail-label">تاريخ البلاغ</span>
                <span className="report-detail-value">{new Date(detailReport.createdAt).toLocaleString('ar-EG')}</span>
              </div>
            </div>

            <div className="report-detail-section">
              <h4>المحتوى المُبلَّغ عنه</h4>
              {detailReport.type === 'MESSAGE' && detailReport.message ? (
                <div className="report-detail-content">
                  <div className="report-detail-sub">
                    من: <strong>{detailReport.message.sender?.name || 'مرسل'}</strong> →
                    إلى: <strong>{detailReport.message.receiver?.name || 'مستلم'}</strong>
                  </div>
                  <p className="report-detail-text">{detailReport.message.content || '—'}</p>
                </div>
              ) : detailReport.type === 'STUDENT_RATING' && detailReport.studentRating ? (
                <div className="report-detail-content">
                  <div className="report-detail-sub">
                    تقييم المالك <strong>{detailReport.studentRating.owner?.name || '—'}</strong>
                    للطالب <strong>{detailReport.studentRating.student?.name || '—'}</strong>
                  </div>
                  <p className="report-detail-text">{detailReport.studentRating.comment || 'بدون تعليق'}</p>
                </div>
              ) : detailReport.type === 'REVIEW' && detailReport.review ? (
                <div className="report-detail-content">
                  <p className="report-detail-text">{detailReport.review.comment || '—'}</p>
                </div>
              ) : (
                <p className="report-detail-text muted">المحتوى غير متاح أو محذوف.</p>
              )}
            </div>

            {detailReport.details && (
              <div className="report-detail-section">
                <h4>تفاصيل البلاغ من المُبلِّغ</h4>
                <p className="report-detail-text">{detailReport.details}</p>
              </div>
            )}

            {detailReport.status === 'PENDING' && (
              <div className="report-detail-actions">
                <button
                  className="ad-block-modal-btn ghost"
                  onClick={() => {
                    handleDismiss(detailReport.id);
                    setDetailReport(null);
                  }}
                >
                  رفض البلاغ
                </button>
                <button
                  className="ad-block-modal-btn danger"
                  onClick={() => {
                    handleDeleteTarget(detailReport.id);
                    setDetailReport(null);
                  }}
                >
                  حذف المحتوى المُبلَّغ عنه
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}


// ── Block Appeals Tab ──
function AppealsTab() {
  const toast = useToast();
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [resolving, setResolving] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.blockAppeals.list(filter);
      setAppeals(data.appeals || []);
    } catch (err) {
      toast.error(err.message || 'فشل جلب الاعتراضات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const handleResolve = async (id, decision) => {
    const note = decision === 'REJECTED'
      ? window.prompt('سبب الرفض (اختياري):') || ''
      : '';
    setResolving(id);
    try {
      await api.blockAppeals.resolve(id, decision, note);
      toast.success(decision === 'ACCEPTED' ? 'تم قبول الاعتراض ورفع الحظر.' : 'تم رفض الاعتراض.');
      await load();
    } catch (err) {
      toast.error(err.message || 'فشلت العملية');
    } finally {
      setResolving(null);
    }
  };

  const statusLabel = { PENDING: 'قيد المراجعة', ACCEPTED: 'مقبول', REJECTED: 'مرفوض' };

  return (
    <>
      <div className="admin-filters">
        <select
          className="admin-role-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="PENDING">قيد المراجعة</option>
          <option value="ACCEPTED">المقبولة</option>
          <option value="REJECTED">المرفوضة</option>
          <option value="">الكل</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-state">جاري التحميل...</div>
      ) : appeals.length === 0 ? (
        <div className="admin-empty-state">لا يوجد اعتراضات.</div>
      ) : (
        <div className="appeals-list">
          {appeals.map((a) => (
            <div key={a.id} className={`appeal-card appeal-${a.status.toLowerCase()}`}>
              <div className="appeal-header">
                <div>
                  <h4 className="appeal-user-name">{a.user?.name || 'مستخدم محذوف'}</h4>
                  <p className="appeal-user-email">{a.user?.email}</p>
                </div>
                <span className={`status-badge appeal-status-${a.status.toLowerCase()}`}>
                  {statusLabel[a.status]}
                </span>
              </div>

              {a.user?.blockReason && (
                <div className="appeal-section">
                  <strong>سبب الحظر:</strong>
                  <p>{a.user.blockReason}</p>
                </div>
              )}

              <div className="appeal-section">
                <strong>رد المستخدم:</strong>
                <p>{a.message}</p>
              </div>

              {a.adminNote && (
                <div className="appeal-section">
                  <strong>ملاحظة الإدارة:</strong>
                  <p>{a.adminNote}</p>
                </div>
              )}

              <div className="appeal-footer">
                <span className="appeal-date">
                  {new Date(a.createdAt).toLocaleDateString('ar-EG')}
                </span>
                {a.status === 'PENDING' && (
                  <div className="appeal-actions">
                    <button
                      className="ad-block-modal-btn danger"
                      disabled={resolving === a.id}
                      onClick={() => handleResolve(a.id, 'REJECTED')}
                    >
                      رفض
                    </button>
                    <button
                      className="ad-block-modal-btn success"
                      disabled={resolving === a.id}
                      onClick={() => handleResolve(a.id, 'ACCEPTED')}
                    >
                      قبول ورفع الحظر
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
