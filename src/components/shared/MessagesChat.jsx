import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiMessageSquare, FiFlag } from 'react-icons/fi';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { connectSocket, getSocket } from '../../utils/socket';
import { useToast } from '../../components/shared/Toast';
import ReportModal from './ReportModal';
import Skeleton from './Skeleton';
import './MessagesChat.css';

export default function MessagesChat() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [reportTarget, setReportTarget] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [otherUser, setOtherUser] = useState(null);
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const selectedUserRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Keep ref in sync with state so socket callbacks see latest value
  useEffect(() => { selectedUserRef.current = selectedUser; }, [selectedUser]);

  useEffect(() => {
    loadConversations();

    const socket = connectSocket();

    socket.on('new_message', (message) => {
      const currentSelected = selectedUserRef.current;
      if (message.senderId === currentSelected) {
        setMessages(prev => [...prev, message]);
      }
      // Update conversation sidebar
      setConversations(prev => {
        const existing = prev.find(c => c.userId === message.senderId);
        if (existing) {
          return prev.map(c => c.userId === message.senderId ? {
            ...c,
            lastMessage: message.content.length > 50 ? message.content.slice(0, 50) + '...' : message.content,
            lastMessageAt: message.createdAt,
            unreadCount: message.senderId === currentSelected ? 0 : c.unreadCount + 1,
          } : c);
        }
        return [{ userId: message.senderId, userName: message.sender?.name, userAvatar: message.sender?.avatar, lastMessage: message.content.slice(0, 50), lastMessageAt: message.createdAt, unreadCount: 1 }, ...prev];
      });
    });

    socket.on('typing', ({ from }) => {
      if (from === selectedUserRef.current) setIsTyping(true);
    });

    socket.on('stop_typing', ({ from }) => {
      if (from === selectedUserRef.current) setIsTyping(false);
    });

    return () => {
      socket.off('new_message');
      socket.off('typing');
      socket.off('stop_typing');
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const data = await api.messages.conversations();
      let convs = data.conversations || [];

      // Auto-add booking contacts to sidebar
      try {
        const existingIds = new Set(convs.map(c => c.userId));

        if (user?.role === 'STUDENT') {
          const bookingsData = await api.bookings.studentList();
          const bookings = bookingsData.bookings || bookingsData || [];
          bookings.forEach(b => {
            const owner = b.property?.owner;
            if (owner && !existingIds.has(owner.id)) {
              existingIds.add(owner.id);
              convs.push({
                userId: owner.id,
                userName: owner.name,
                userAvatar: owner.avatar,
                userRole: 'OWNER',
                lastMessage: '',
                lastMessageAt: b.createdAt,
                unreadCount: 0,
              });
            }
          });
        } else if (user?.role === 'OWNER') {
          const bookingsData = await api.bookings.ownerList();
          const bookings = bookingsData.bookings || bookingsData || [];
          // Owners can only chat with students who have a confirmed booking
          // (APPROVED/PAID/COMPLETED). Anything else is hidden from the sidebar.
          const allowedStatuses = new Set(['PAID', 'APPROVED', 'COMPLETED']);
          const statusPriority = { PAID: 0, APPROVED: 1, COMPLETED: 2 };

          // Pick the best booking per student (active first, then most recent).
          const studentMap = {};
          bookings.forEach(b => {
            const student = b.student;
            if (!student || !allowedStatuses.has(b.status)) return;
            const current = studentMap[student.id];
            if (
              !current ||
              statusPriority[b.status] < statusPriority[current.status] ||
              (statusPriority[b.status] === statusPriority[current.status] &&
                new Date(b.createdAt) > new Date(current.createdAt))
            ) {
              studentMap[student.id] = b;
            }
          });

          // Drop any existing conversation whose student no longer has a confirmed
          // booking — past messages exist but the chat is no longer reachable.
          convs = convs.filter(c => {
            if (c.userRole && c.userRole !== 'STUDENT') return true;
            return studentMap[c.userId] !== undefined;
          });

          // Enrich existing conversations + auto-add students we haven't messaged yet.
          Object.entries(studentMap).forEach(([studentId, b]) => {
            const bInfo = {
              propertyTitle: b.property?.title,
              roomName: b.roomVariant?.name,
              roomPrice: b.roomVariant?.fullPrice,
              endDate: b.endDate,
              status: b.status,
            };
            const existing = convs.find(c => c.userId === studentId);
            if (existing) {
              existing.bookingInfo = bInfo;
            } else {
              existingIds.add(studentId);
              convs.push({
                userId: b.student.id,
                userName: b.student.name,
                userAvatar: b.student.avatar,
                userRole: 'STUDENT',
                lastMessage: '',
                lastMessageAt: b.createdAt,
                unreadCount: 0,
                bookingInfo: bInfo,
              });
            }
          });
        }
      } catch { /* no bookings */ }

      setConversations(convs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Open a specific chat when navigated with ?with=userId — used by the
  // "تواصل" buttons on bookings. Runs only after the initial conversation
  // load so we don't race with the sidebar fetch.
  useEffect(() => {
    if (loading) return;
    const withId = searchParams.get('with');
    if (!withId) return;
    if (selectedUser === withId) return;
    selectConversation(withId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, searchParams]);

  const selectConversation = async (userId) => {
    setSelectedUser(userId);
    setChatLoading(true);
    try {
      const data = await api.messages.getChat(userId);
      setMessages(data.messages || []);
      setOtherUser(data.otherUser);
      // Update unread count locally; if this user isn't in the sidebar yet
      // (e.g. opened via ?with=...), prepend a placeholder so the empty state
      // doesn't fight with the active chat on the right.
      setConversations(prev => {
        const exists = prev.some(c => c.userId === userId);
        if (exists) {
          return prev.map(c => c.userId === userId ? { ...c, unreadCount: 0 } : c);
        }
        if (!data.otherUser) return prev;
        return [
          {
            userId,
            userName: data.otherUser.name,
            userAvatar: data.otherUser.avatar,
            userRole: data.otherUser.role,
            lastMessage: '',
            lastMessageAt: new Date().toISOString(),
            unreadCount: 0,
          },
          ...prev,
        ];
      });
    } catch (err) {
      console.error(err);
    } finally {
      setChatLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMsg.trim() || !selectedUser) return;
    try {
      const data = await api.messages.send({ receiverId: selectedUser, content: newMsg.trim() });
      setMessages(prev => [...prev, data.message]);
      setNewMsg('');
      // Update conversation list
      setConversations(prev => {
        const existing = prev.find(c => c.userId === selectedUser);
        if (existing) {
          return prev.map(c => c.userId === selectedUser ? { ...c, lastMessage: newMsg.trim().slice(0, 50), lastMessageAt: new Date().toISOString() } : c);
        }
        return [{ userId: selectedUser, userName: otherUser?.name, userAvatar: otherUser?.avatar, userRole: otherUser?.role, lastMessage: newMsg.trim().slice(0, 50), lastMessageAt: new Date().toISOString(), unreadCount: 0 }, ...prev];
      });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const formatTime = (date) => {
    const d = new Date(date);
    return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  };

  const getInitial = (name) => name?.charAt(0)?.toUpperCase() || '?';

  if (loading) return (
    <div className="mc-skeleton-wrap">
      <Skeleton height={20} width="60%" />
      <div className="mc-skeleton-gap" />
      <Skeleton height={16} count={4} />
    </div>
  );

  return (
    <>
    <ReportModal
      open={!!reportTarget}
      targetType="MESSAGE"
      targetId={reportTarget}
      onClose={() => setReportTarget(null)}
    />
    <div className="mc-container">
      {/* Conversations sidebar */}
      <div className="mc-sidebar">
        <div className="mc-sidebar-title">المحادثات</div>
        {conversations.length === 0 ? (
          <div className="mc-no-convs">
            <div className="mc-no-convs-icon">
              <FiMessageSquare size={36} color="#d1d5db" />
            </div>
            <h3 className="mc-no-convs-title">لا يوجد محادثات</h3>
            <p className="mc-no-convs-sub">ستظهر محادثاتك مع الملاك هنا</p>
          </div>
        ) : (
          conversations.map(conv => (
            <div
              key={conv.userId}
              className={`mc-conv-item${selectedUser === conv.userId ? ' mc-conv-item-active' : ''}`}
              onClick={() => selectConversation(conv.userId)}
            >
              <div className="mc-conv-avatar">{getInitial(conv.userName)}</div>
              <div className="mc-conv-info">
                <div className="mc-conv-name">{conv.userName}</div>
                {conv.bookingInfo ? (
                  <div className="mc-conv-booking-info">
                    <span className="mc-conv-property">{conv.bookingInfo.propertyTitle}</span>
                    <span className="mc-conv-end-date">
                      {conv.bookingInfo.roomName} — {conv.bookingInfo.roomPrice?.toLocaleString()} ₪/شهر
                    </span>
                    <span className="mc-conv-end-date">
                      ينتهي: {new Date(conv.bookingInfo.endDate).toLocaleDateString('ar-SA')}
                    </span>
                  </div>
                ) : (
                  <div className="mc-conv-last-msg">{conv.lastMessage}</div>
                )}
              </div>
              {conv.unreadCount > 0 && <div className="mc-conv-unread">{conv.unreadCount}</div>}
            </div>
          ))
        )}
      </div>

      {/* Chat area */}
      <div className="mc-chat-area">
        {!selectedUser ? (
          <div className="mc-empty">اختر محادثة للبدء</div>
        ) : chatLoading ? (
          <div className="mc-skeleton-wrap">
            <Skeleton height={20} width="60%" />
            <div className="mc-skeleton-gap" />
            <Skeleton height={16} count={4} />
          </div>
        ) : (
          <>
            <div className="mc-chat-header">
              {otherUser?.name || 'محادثة'}
              <span className="mc-chat-header-name">
                ({otherUser?.role === 'OWNER' ? 'مالك' : otherUser?.role === 'STUDENT' ? 'طالب' : otherUser?.role})
              </span>
            </div>
            <div className="mc-messages-list">
              {messages.length === 0 && (
                <div className="mc-msgs-empty">لا توجد رسائل بعد. ابدأ المحادثة!</div>
              )}
              {messages.map(msg => {
                const isMine = msg.senderId === user.id;
                return (
                  <div
                    key={msg.id}
                    className={`mc-message${isMine ? ' mc-message-mine' : ' mc-message-other'}`}
                  >
                    <div>{msg.content}</div>
                    <div className="mc-message-footer">
                      <span className="mc-message-time">{formatTime(msg.createdAt)}</span>
                      {!isMine && (
                        <button
                          type="button"
                          className="mc-message-report"
                          title="بلاغ عن هذه الرسالة"
                          aria-label="بلاغ عن هذه الرسالة"
                          onClick={() => setReportTarget(msg.id)}
                        >
                          <FiFlag />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {isTyping && <div className="mc-typing">يكتب...</div>}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} className="mc-input-bar">
              <input
                aria-label="اكتب رسالة"
                className="mc-input"
                value={newMsg}
                onChange={e => {
                  setNewMsg(e.target.value);
                  const socket = getSocket();
                  if (socket && selectedUser) {
                    socket.emit('typing', { to: selectedUser });
                    clearTimeout(typingTimeoutRef.current);
                    typingTimeoutRef.current = setTimeout(() => {
                      socket.emit('stop_typing', { to: selectedUser });
                    }, 1500);
                  }
                }}
                onBlur={() => {
                  const socket = getSocket();
                  if (socket && selectedUser) {
                    socket.emit('stop_typing', { to: selectedUser });
                  }
                }}
                placeholder="اكتب رسالتك..."
              />
              <button type="submit" className="mc-send-btn" disabled={!newMsg.trim()}>إرسال</button>
            </form>
          </>
        )}
      </div>

      {/* Info sidebar — shown for owners when a student is selected */}
      {user?.role === 'OWNER' && selectedUser && !chatLoading && (() => {
        const conv = conversations.find(c => c.userId === selectedUser);
        const info = conv?.bookingInfo;
        const statusLabel = {
          PENDING: 'قيد الانتظار',
          APPROVED: 'مقبول',
          PAID: 'مدفوع',
          COMPLETED: 'مكتمل',
          CANCELLED: 'ملغي',
          REJECTED: 'مرفوض',
        };
        return (
          <div className="mc-info-sidebar">
            <div className="mc-info-avatar">{otherUser?.name?.charAt(0) || '?'}</div>
            <h3 className="mc-info-name">{otherUser?.name}</h3>
            <span className="mc-info-role">طالب</span>

            {info ? (
              <div className="mc-info-section">
                <h4>معلومات الحجز</h4>
                <div className="mc-info-row"><strong>العقار:</strong> {info.propertyTitle}</div>
                {info.roomName && <div className="mc-info-row"><strong>الغرفة:</strong> {info.roomName}</div>}
                {info.roomPrice && <div className="mc-info-row"><strong>السعر:</strong> {info.roomPrice.toLocaleString()} ₪/شهر</div>}
                <div className="mc-info-row"><strong>ينتهي:</strong> {new Date(info.endDate).toLocaleDateString('ar-SA')}</div>
                <div className="mc-info-row"><strong>الحالة:</strong> <span className={`mc-info-status mc-info-status--${info.status?.toLowerCase()}`}>{statusLabel[info.status] || info.status}</span></div>
              </div>
            ) : (
              <div className="mc-info-section">
                <h4>معلومات الحجز</h4>
                <div className="mc-info-row mc-info-row-muted">لا يوجد حجز مرتبط</div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
    </>
  );
}
