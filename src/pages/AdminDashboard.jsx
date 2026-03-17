import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { FiUsers, FiHome, FiShield, FiTrash2, FiAlertCircle } from 'react-icons/fi';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await api.users.list();
      setUsers(data.users);
      setError(null);
    } catch (err) {
      setError('فشل في جلب بيانات المستخدمين. يرجى المحاولة لاحقاً.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDelete = async (id, name) => {
    if (id === currentUser.id) return;
    
    if (window.confirm(`هل أنت متأكد من حذف المستخدم "${name}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) {
      try {
        await api.users.delete(id);
        setUsers(users.filter(u => u.id !== id));
      } catch (err) {
        alert('حدث خطأ أثناء الحذف: ' + (err.message || 'خطأ غير معروف'));
      }
    }
  };

  const roleTranslations = {
    STUDENT: 'طالب',
    OWNER: 'مالك عقار',
    ADMIN: 'مدير'
  };

  if (loading) return (
    <div className="page admin-page">
      <div className="container">
        <div className="loading-state">جاري تحميل البيانات...</div>
      </div>
    </div>
  );

  if (error) return (
    <div className="page admin-page">
      <div className="container">
        <div className="error-state">
          <FiAlertCircle size={40} style={{ marginBottom: 16 }} />
          <p>{error}</p>
        </div>
      </div>
    </div>
  );

  const studentsCount = users.filter(u => u.role === 'STUDENT').length;
  const ownersCount = users.filter(u => u.role === 'OWNER').length;

  return (
    <div className="page admin-page">
      <div className="container">
        <div className="admin-header">
          <h1>لوحة التحكم</h1>
          <p>إدارة المستخدمين والنظام</p>
        </div>

        <div className="admin-stats">
          <div className="stat-card">
            <FiUsers className="stat-icon-bg" />
            <div className="stat-content">
              <div className="stat-number">{users.length}</div>
              <div className="stat-label"><FiUsers /> إجمالي المستخدمين</div>
            </div>
          </div>
          
          <div className="stat-card" style={{ borderColor: '#34a853' }}>
            <FiHome className="stat-icon-bg" />
            <div className="stat-content">
              <div className="stat-number" style={{ color: '#34a853' }}>{ownersCount}</div>
              <div className="stat-label"><FiHome /> ملاك العقارات</div>
            </div>
          </div>
          
          <div className="stat-card" style={{ borderColor: '#0284c7' }}>
            <FiShield className="stat-icon-bg" />
            <div className="stat-content">
              <div className="stat-number" style={{ color: '#0284c7' }}>{studentsCount}</div>
              <div className="stat-label"><FiShield /> الطلاب</div>
            </div>
          </div>
        </div>

        <div className="users-section">
          <div className="users-section-header">
            <h2><FiUsers /> قائمة المستخدمين</h2>
          </div>
          
          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>المستخدم</th>
                  <th>الدور</th>
                  <th>تاريخ الانضمام</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div className="user-cell-info">
                        <div className="user-cell-avatar">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="user-cell-details">
                          <span className="user-cell-name">{user.name}</span>
                          <span className="user-cell-email">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`role-badge ${user.role.toLowerCase()}`}>
                        {roleTranslations[user.role] || user.role}
                      </span>
                    </td>
                    <td>
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ar-EG') : 'غير محدد'}
                    </td>
                    <td>
                      <button 
                        className="delete-btn" 
                        onClick={() => handleDelete(user.id, user.name)}
                        disabled={user.id === currentUser.id}
                        title={user.id === currentUser.id ? "لا يمكنك حذف حسابك الحالي" : "حذف المستخدم"}
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '40px' }}>
                      لا يوجد مستخدمين لعرضهم
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
