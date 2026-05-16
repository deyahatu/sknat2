import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { useToast } from '../components/shared/Toast';
import ConfirmModal from '../components/shared/ConfirmModal';
import Skeleton from '../components/shared/Skeleton';
import { FiUsers, FiHome, FiShield, FiTrash2, FiAlertCircle, FiSearch, FiToggleLeft, FiToggleRight, FiStar, FiBarChart2, FiDollarSign, FiCreditCard, FiCheck, FiX, FiDownload, FiFileText, FiFlag, FiLogOut, FiAlertOctagon } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import NotificationBell from '../components/shared/NotificationBell';
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
  { id: 'reports', label: 'البلاغات', icon: <FiFlag /> },
  { id: 'complaints', label: 'الشكاوى', icon: <FiAlertOctagon /> },
];

// Neutralise CSV formula-injection: when Excel sees a cell starting with =, +, -, @,
// tab or CR it evaluates the contents as a formula. Prefixing with ' makes Excel
// treat the entire cell as a literal string.
function escapeCsvCell(raw) {
  let v = typeof raw === 'object' && raw !== null ? JSON.stringify(raw) : String(raw ?? '');
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
  return `"${v.replace(/"/g, '""')}"`;
}

const PAGE_SIZE = 10;

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const window = 2;
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - window && i <= page + window)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }
  return (
    <div className="ad-pagination">
      <button
        type="button"
        className="ad-page-btn"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        السابق
      </button>
      {pages.map((p, idx) =>
        p === '…' ? (
          <span key={`gap-${idx}`} className="ad-page-gap">…</span>
        ) : (
          <button
            key={p}
            type="button"
            className={`ad-page-btn ${p === page ? 'active' : ''}`}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        className="ad-page-btn"
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
      >
        التالي
      </button>
    </div>
  );
}

function exportCSV(data, filename) {
  if (!data || data.length === 0) return;
  const keys = Object.keys(data[0]);
  const csv = [keys.join(','), ...data.map(row => keys.map(k => escapeCsvCell(row[k])).join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
}

// Tabs reachable from notifications via /admin?tab=<id>. Anything else falls
// back to the default 'users' tab.
const VALID_TABS = new Set([
  'users', 'properties', 'refunds', 'withdrawals', 'appeals',
  'ratings', 'stats', 'audit', 'reports', 'complaints',
]);

export default function AdminDashboard() {
  const { user: currentUser, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    tabFromUrl && VALID_TABS.has(tabFromUrl) ? tabFromUrl : 'users',
  );
  const [pendingCounts, setPendingCounts] = useState({ refunds: 0, withdrawals: 0 });

  // Keep tab in sync when the URL changes (e.g. clicking another notification
  // while already on /admin). Without this, the second click is a no-op.
  useEffect(() => {
    if (tabFromUrl && VALID_TABS.has(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFromUrl]);

  // When the user switches tabs via the sidebar, drop the ?tab=… from the URL
  // so it doesn't get stale.
  function selectTab(id) {
    setActiveTab(id);
    if (searchParams.has('tab')) {
      const next = new URLSearchParams(searchParams);
      next.delete('tab');
      setSearchParams(next, { replace: true });
    }
  }

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
            <div className="admin-sidebar-header-top">
              <div>
                <h2>لوحة التحكم</h2>
                <p>إدارة النظام</p>
              </div>
              <NotificationBell />
            </div>
          </div>
          <nav className="admin-sidebar-nav">
            {TABS.map((tab) => {
              const badge = getBadge(tab.id);
              return (
                <button
                  key={tab.id}
                  className={`admin-sidebar-item ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => selectTab(tab.id)}
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
          {activeTab === 'complaints' && <ComplaintsTab />}
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
  const [page, setPage] = useState(1);
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

  useEffect(() => { setPage(1); }, [search, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedUsers = users.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
    if (reason.length === 0 || reason.length > 200) {
      toast.error('يجب إدخال سبب الحظر (حتى 200 حرف).');
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
              {paginatedUsers.map((user) => (
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
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
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
            <label className="ad-block-modal-label">سبب</label>
            <textarea
              className="ad-block-modal-textarea"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value.slice(0, 200))}
              rows={4}
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
                disabled={blockSaving || blockReason.trim().length === 0}
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
  const [page, setPage] = useState(1);
  const [confirmState, setConfirmState] = useState({ open: false, action: null, title: '', message: '' });

  useEffect(() => {
    api.properties.list({ q: search })
      .then((data) => setProperties(data.properties || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { setPage(1); }, [search]);

  const totalPages = Math.max(1, Math.ceil(properties.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedProperties = properties.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
            {paginatedProperties.map((p) => {
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
        <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
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
  const [selectedReview, setSelectedReview] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.reviews.adminList()
      .then((data) => setReviews(data.reviews || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalPages = Math.max(1, Math.ceil(reviews.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedReviews = reviews.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleDelete = (id) => {
    setConfirmState({
      open: true,
      title: 'تأكيد الحذف',
      message: 'حذف هذا التقييم؟',
      action: async () => {
        try {
          await api.reviews.adminDelete(id);
          setReviews(reviews.filter((r) => r.id !== id));
          setSelectedReview(null);
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
            {paginatedReviews.map((r) => (
              <tr
                key={r.id}
                className="report-row-clickable"
                onClick={() => setSelectedReview(r)}
              >
                <td>{r.student?.name || '—'}</td>
                <td>{r.property?.title || '—'}</td>
                <td>{'⭐'.repeat(r.rating)}</td>
                <td className="at-truncate">
                  {r.comment || '—'}
                </td>
                <td>{new Date(r.createdAt).toLocaleDateString('ar-EG')}</td>
                <td onClick={(e) => e.stopPropagation()}>
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
        <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
      </div>

      {selectedReview && (
        <div className="ad-modal-overlay" onClick={() => setSelectedReview(null)}>
          <div className="ad-modal-box report-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="report-detail-header">
              <h3>تفاصيل التقييم</h3>
              <button
                className="ad-modal-close"
                onClick={() => setSelectedReview(null)}
                aria-label="إغلاق"
              >
                <FiX />
              </button>
            </div>

            <div className="report-detail-grid">
              <div className="report-detail-item">
                <span className="report-detail-label">الطالب</span>
                <span className="report-detail-value">{selectedReview.student?.name || '—'}</span>
              </div>
              <div className="report-detail-item">
                <span className="report-detail-label">العقار</span>
                <span className="report-detail-value">{selectedReview.property?.title || '—'}</span>
              </div>
              <div className="report-detail-item">
                <span className="report-detail-label">التقييم</span>
                <span className="report-detail-value">{'⭐'.repeat(selectedReview.rating)} ({selectedReview.rating}/5)</span>
              </div>
              <div className="report-detail-item">
                <span className="report-detail-label">التاريخ</span>
                <span className="report-detail-value">{new Date(selectedReview.createdAt).toLocaleString('ar-EG')}</span>
              </div>
            </div>

            <div className="report-detail-section">
              <h4>التعليق</h4>
              <div className="report-detail-content">
                <p className={`report-detail-text ${!selectedReview.comment ? 'muted' : ''}`}>
                  {selectedReview.comment || 'لا يوجد تعليق'}
                </p>
              </div>
            </div>

            <div className="report-detail-actions">
              <button
                type="button"
                className="ad-block-modal-btn ghost"
                onClick={() => setSelectedReview(null)}
              >
                إغلاق
              </button>
              <button
                type="button"
                className="ad-block-modal-btn danger"
                onClick={() => handleDelete(selectedReview.id)}
              >
                <FiTrash2 style={{ marginLeft: 6 }} />
                حذف التقييم
              </button>
            </div>
          </div>
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

// ── Stats Tab (UC-36) ──
// ── Refunds Tab (UC-37) ──
function RefundsTab() {
  const toast = useToast();
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
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
  useEffect(() => { setPage(1); }, [filter]);

  const totalPages = Math.max(1, Math.ceil(refunds.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedRefunds = refunds.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
            {paginatedRefunds.map((r) => (
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
        <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
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
  const [page, setPage] = useState(1);
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
  useEffect(() => { setPage(1); }, [filter]);

  const totalPages = Math.max(1, Math.ceil(withdrawals.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedWithdrawals = withdrawals.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
            {paginatedWithdrawals.map((w) => (
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
        <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
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
  const [selectedLog, setSelectedLog] = useState(null);
  const [page, setPage] = useState(1);

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
  useEffect(() => { setPage(1); }, [entityFilter]);

  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedLogs = logs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const actionLabels = {
    ACCEPT: 'قبول',
    REJECT: 'رفض',
    CANCEL: 'إلغاء',
    COMPLETE: 'إكمال',
    CREATE: 'إنشاء',
    DELETE: 'حذف',
    TOGGLE_ACTIVE: 'تغيير الحالة',
    RENEW_REQUEST: 'طلب تجديد',
    REQUEST_DELETE_SELF: 'طلب حذف الحساب',
    DELETE_SELF: 'حذف الحساب',
    CANCEL_DELETE_SELF: 'إلغاء طلب الحذف',
    APPEAL_SUBMIT: 'تقديم اعتراض',
    APPEAL_ACCEPT: 'قبول اعتراض',
    APPEAL_REJECT: 'رفض اعتراض',
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
            {paginatedLogs.map((log) => (
              <tr
                key={log.id}
                className="report-row-clickable"
                onClick={() => setSelectedLog(log)}
              >
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
        <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
      </div>

      {selectedLog && (
        <div className="ad-modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="ad-modal-box report-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="report-detail-header">
              <h3>تفاصيل السجل</h3>
              <button
                className="ad-modal-close"
                onClick={() => setSelectedLog(null)}
                aria-label="إغلاق"
              >
                <FiX />
              </button>
            </div>

            <div className="report-detail-grid">
              <div className="report-detail-item">
                <span className="report-detail-label">المستخدم</span>
                <span className="report-detail-value">{selectedLog.userName || '—'}</span>
              </div>
              <div className="report-detail-item">
                <span className="report-detail-label">الإجراء</span>
                <span className="report-detail-value">{actionLabels[selectedLog.action] || selectedLog.action}</span>
              </div>
              <div className="report-detail-item">
                <span className="report-detail-label">النوع</span>
                <span className="report-detail-value">{entityLabels[selectedLog.entity] || selectedLog.entity}</span>
              </div>
              <div className="report-detail-item">
                <span className="report-detail-label">التاريخ</span>
                <span className="report-detail-value">{new Date(selectedLog.createdAt).toLocaleString('ar-EG')}</span>
              </div>
            </div>

            <div className="report-detail-section">
              <h4>التفاصيل</h4>
              <div className="report-detail-content">
                <p className={`report-detail-text ${!selectedLog.details ? 'muted' : ''}`}>
                  {selectedLog.details || 'لا يوجد تفاصيل إضافية'}
                </p>
              </div>
            </div>

            <div className="report-detail-actions">
              <button
                type="button"
                className="ad-block-modal-btn ghost"
                onClick={() => setSelectedLog(null)}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
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
  const [page, setPage] = useState(1);
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
  useEffect(() => { setPage(1); }, [filter]);

  const totalPages = Math.max(1, Math.ceil(reports.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedReports = reports.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
            {paginatedReports.map((r) => {
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
        <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
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


// ── Complaints Tab ──
// Distinct from ReportsTab: complaints are about a person's conduct between
// student↔owner (backed by a real booking), with optional image/video evidence.
function ComplaintsTab() {
  const toast = useToast();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [confirmState, setConfirmState] = useState({ open: false, action: null, title: '', message: '' });
  const [detail, setDetail] = useState(null);
  // Contact modal: which user the admin is messaging (complainant or target),
  // plus the message body. Null = closed.
  const [contactTarget, setContactTarget] = useState(null);
  const [contactBody, setContactBody] = useState('');
  const [contactSending, setContactSending] = useState(false);

  const typeLabels = {
    STUDENT_VS_OWNER: 'طالب ضد مالك',
    OWNER_VS_STUDENT: 'مالك ضد طالب',
  };
  const statusLabels = { PENDING: 'معلقة', REVIEWED: 'تمت المراجعة', DISMISSED: 'مرفوضة' };
  const statusClass = { PENDING: '', REVIEWED: 'active', DISMISSED: 'inactive' };

  const fetchComplaints = () => {
    setLoading(true);
    api.complaints
      .list({ status: statusFilter, type: typeFilter })
      .then((data) => setComplaints(data.complaints || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchComplaints(); }, [statusFilter, typeFilter]);
  useEffect(() => { setPage(1); }, [statusFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(complaints.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = complaints.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const doReview = (id, action, defaultMsg) => {
    const note = window.prompt('ملاحظة المشرف (اختياري):', '') || '';
    setConfirmState({
      open: true,
      title: defaultMsg,
      message: `${defaultMsg}؟`,
      action: async () => {
        try {
          await api.complaints.review(id, { action, adminNote: note });
          fetchComplaints();
          setDetail(null);
        } catch (err) {
          toast.error(err.message || 'فشل');
        }
      },
    });
  };

  function openContact(user) {
    setContactTarget(user);
    setContactBody('');
  }

  async function sendContact() {
    if (!contactTarget || !contactBody.trim() || contactSending) return;
    setContactSending(true);
    try {
      await api.admin.sendNotification({
        userId: contactTarget.id,
        title: 'رسالة من الإدارة',
        body: contactBody.trim(),
        // Deep-link to the right complaints page based on the recipient's role.
        url: contactTarget.role === 'OWNER' ? '/owner/complaints' : '/complaints',
      });
      toast.success(`تم إرسال الرسالة إلى ${contactTarget.name}.`);
      setContactTarget(null);
      setContactBody('');
    } catch (err) {
      toast.error(err.message || 'فشل إرسال الرسالة.');
    } finally {
      setContactSending(false);
    }
  }

  if (loading) return <div className="loading-state">جاري التحميل...</div>;

  return (
    <>
      <div className="admin-filters">
        <select className="admin-role-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="PENDING">معلقة</option>
          <option value="REVIEWED">تمت المراجعة</option>
          <option value="DISMISSED">مرفوضة</option>
        </select>
        <select className="admin-role-filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">كل الأنواع</option>
          <option value="STUDENT_VS_OWNER">طالب ضد مالك</option>
          <option value="OWNER_VS_STUDENT">مالك ضد طالب</option>
        </select>
      </div>

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>المُشتكي</th>
              <th>ضد</th>
              <th>النوع</th>
              <th>العنوان</th>
              <th>السكن</th>
              <th>المرفقات</th>
              <th>الحالة</th>
              <th>التاريخ</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((c) => {
              const attachments = (c.images?.length || 0) + (c.videoUrl ? 1 : 0);
              return (
                <tr key={c.id} className="report-row-clickable" onClick={() => setDetail(c)}>
                  <td>{c.complainant?.name || '—'}</td>
                  <td>{c.target?.name || '—'}</td>
                  <td>{typeLabels[c.type] || c.type}</td>
                  <td className="at-truncate ad-cell--target">{c.subject}</td>
                  <td>{c.booking?.property?.title || '—'}</td>
                  <td>{attachments > 0 ? `${attachments} ملف` : '—'}</td>
                  <td><span className={`status-badge ${statusClass[c.status] || ''}`}>{statusLabels[c.status] || c.status}</span></td>
                  <td>{new Date(c.createdAt).toLocaleDateString('ar-EG')}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {c.status === 'PENDING' && (
                      <div className="action-buttons">
                        <button className="action-btn" onClick={() => doReview(c.id, 'review', 'تأكيد المراجعة')} title="تأكيد المراجعة">
                          <FiCheck />
                        </button>
                        <button className="action-btn ad-text-muted" onClick={() => doReview(c.id, 'dismiss', 'رفض الشكوى')} title="رفض الشكوى">
                          <FiX />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {complaints.length === 0 && (
              <tr><td colSpan="9" className="at-td-center">لا يوجد شكاوى</td></tr>
            )}
          </tbody>
        </table>
        <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
      </div>

      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmText="تأكيد"
        variant="danger"
        onConfirm={async () => { await confirmState.action?.(); setConfirmState((s) => ({ ...s, open: false })); }}
        onCancel={() => setConfirmState((s) => ({ ...s, open: false }))}
      />

      {detail && (
        <div className="ad-modal-overlay" onClick={() => setDetail(null)}>
          <div className="ad-modal-box report-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="report-detail-header">
              <h3>تفاصيل الشكوى</h3>
              <button type="button" className="bb-modal-close" onClick={() => setDetail(null)}>
                <FiX />
              </button>
            </div>

            <div className="report-detail-grid">
              <div className="report-detail-item">
                <span className="report-detail-label">المُشتكي</span>
                <span className="report-detail-value">{detail.complainant?.name || '—'}</span>
                {detail.complainant?.email && (
                  <span className="report-detail-sub">{detail.complainant.email}</span>
                )}
              </div>
              <div className="report-detail-item">
                <span className="report-detail-label">ضد</span>
                <span className="report-detail-value">{detail.target?.name || '—'}</span>
                {detail.target?.email && (
                  <span className="report-detail-sub">{detail.target.email}</span>
                )}
              </div>
              <div className="report-detail-item">
                <span className="report-detail-label">النوع</span>
                <span className="report-detail-value">{typeLabels[detail.type] || detail.type}</span>
              </div>
              <div className="report-detail-item">
                <span className="report-detail-label">السكن</span>
                <span className="report-detail-value">{detail.booking?.property?.title || '—'}</span>
              </div>
              <div className="report-detail-item">
                <span className="report-detail-label">الحالة</span>
                <span className={`status-badge ${statusClass[detail.status] || ''}`}>
                  {statusLabels[detail.status] || detail.status}
                </span>
              </div>
              <div className="report-detail-item">
                <span className="report-detail-label">تاريخ الشكوى</span>
                <span className="report-detail-value">{new Date(detail.createdAt).toLocaleString('ar-EG')}</span>
              </div>
            </div>

            <div className="report-detail-section">
              <h4>عنوان الشكوى</h4>
              <p className="report-detail-text">{detail.subject}</p>
            </div>

            <div className="report-detail-section">
              <h4>تفاصيل الشكوى</h4>
              <p className="report-detail-text" style={{ whiteSpace: 'pre-wrap' }}>{detail.description}</p>
            </div>

            {(detail.images?.length > 0 || detail.videoUrl) && (
              <div className="report-detail-section">
                <h4>المرفقات</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {detail.images?.map((u, i) => (
                    <a key={i} href={u} target="_blank" rel="noopener noreferrer">
                      <img
                        src={u}
                        alt={`دليل ${i + 1}`}
                        style={{ width: 130, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }}
                      />
                    </a>
                  ))}
                  {detail.videoUrl && (
                    <video
                      src={detail.videoUrl}
                      controls
                      preload="metadata"
                      style={{ width: 220, height: 150, borderRadius: 8, background: '#000' }}
                    />
                  )}
                </div>
              </div>
            )}

            {detail.adminNote && (
              <div className="report-detail-section">
                <h4>ملاحظة المشرف</h4>
                <p className="report-detail-text">{detail.adminNote}</p>
              </div>
            )}

            <div className="report-detail-section">
              <h4>التواصل مع الأطراف</h4>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {detail.complainant && (
                  <button
                    type="button"
                    className="ad-block-modal-btn ghost"
                    onClick={() => openContact(detail.complainant)}
                  >
                    ✉️ تواصل مع المُشتكي ({detail.complainant.name})
                  </button>
                )}
                {detail.target && (
                  <button
                    type="button"
                    className="ad-block-modal-btn ghost"
                    onClick={() => openContact(detail.target)}
                  >
                    ✉️ تواصل مع المُشتكى عليه ({detail.target.name})
                  </button>
                )}
              </div>
            </div>

            {detail.status === 'PENDING' && (
              <div className="report-detail-actions">
                <button
                  className="ad-block-modal-btn ghost"
                  onClick={() => doReview(detail.id, 'dismiss', 'رفض الشكوى')}
                >
                  رفض الشكوى
                </button>
                <button
                  className="ad-block-modal-btn success"
                  onClick={() => doReview(detail.id, 'review', 'تأكيد المراجعة')}
                >
                  تأكيد المراجعة
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {contactTarget && (
        <div
          className="ad-modal-overlay"
          onClick={() => !contactSending && setContactTarget(null)}
        >
          <div
            className="ad-modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 480 }}
          >
            <div className="report-detail-header">
              <h3>إرسال رسالة لـ {contactTarget.name}</h3>
              <button
                type="button"
                className="bb-modal-close"
                onClick={() => !contactSending && setContactTarget(null)}
                disabled={contactSending}
              >
                <FiX />
              </button>
            </div>
            <textarea
              value={contactBody}
              onChange={(e) => setContactBody(e.target.value)}
              maxLength={1000}
              rows={5}
              placeholder="اكتب رسالتك هنا..."
              disabled={contactSending}
              style={{
                width: '100%',
                padding: 10,
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontFamily: 'inherit',
                fontSize: 14,
                resize: 'vertical',
              }}
            />
            <div style={{ textAlign: 'left', fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              {contactBody.length}/1000
            </div>
            <div className="report-detail-actions">
              <button
                type="button"
                className="ad-block-modal-btn ghost"
                onClick={() => setContactTarget(null)}
                disabled={contactSending}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="ad-block-modal-btn success"
                onClick={sendContact}
                disabled={contactSending || !contactBody.trim()}
              >
                {contactSending ? 'جارٍ الإرسال…' : 'إرسال'}
              </button>
            </div>
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
  const [page, setPage] = useState(1);

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
  useEffect(() => { setPage(1); }, [filter]);

  const totalPages = Math.max(1, Math.ceil(appeals.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedAppeals = appeals.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
          {paginatedAppeals.map((a) => (
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
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
        </div>
      )}
    </>
  );
}
