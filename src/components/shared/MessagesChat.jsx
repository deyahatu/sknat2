import { useState, useEffect, useRef, useCallback } from 'react';
import { FiMessageSquare } from 'react-icons/fi';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { connectSocket, getSocket } from '../../utils/socket';
import { useToast } from '../../components/shared/Toast';
import Skeleton from './Skeleton';

const styles = {
  container: { display: 'flex', height: 'calc(100vh - 120px)', direction: 'rtl', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', background: '#fff' },
  sidebar: { width: '320px', borderLeft: '1px solid #e2e8f0', overflowY: 'auto', background: '#f8fafc' },
  sidebarHeader: { padding: '16px', borderBottom: '1px solid #e2e8f0', fontWeight: '700', fontSize: '18px' },
  convItem: { padding: '14px 16px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: 'background 0.2s' },
  convItemActive: { background: '#e0f2fe' },
  avatar: { width: '40px', height: '40px', borderRadius: '50%', background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '16px', flexShrink: 0 },
  convInfo: { flex: 1, overflow: 'hidden' },
  convName: { fontWeight: '600', fontSize: '14px', marginBottom: '2px' },
  convPreview: { fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  badge: { background: '#ef4444', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700' },
  chatArea: { flex: 1, display: 'flex', flexDirection: 'column' },
  chatHeader: { padding: '14px 20px', borderBottom: '1px solid #e2e8f0', fontWeight: '600', fontSize: '16px', background: '#f8fafc' },
  messagesArea: { flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' },
  msgBubble: { maxWidth: '70%', padding: '10px 14px', borderRadius: '12px', fontSize: '14px', lineHeight: '1.5' },
  msgMine: { alignSelf: 'flex-start', background: '#3b82f6', color: '#fff', borderBottomLeftRadius: '4px' },
  msgOther: { alignSelf: 'flex-end', background: '#f1f5f9', color: '#1e293b', borderBottomRightRadius: '4px' },
  msgTime: { fontSize: '10px', marginTop: '4px', opacity: 0.7 },
  inputArea: { padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '10px' },
  input: { flex: 1, border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', outline: 'none', direction: 'rtl' },
  sendBtn: { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' },
  empty: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '16px' },
  loading: { textAlign: 'center', padding: '40px', color: '#64748b' },
};

export default function MessagesChat() {
  const { user } = useAuth();
  const toast = useToast();
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
      setConversations(data.conversations || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectConversation = async (userId) => {
    setSelectedUser(userId);
    setChatLoading(true);
    try {
      const data = await api.messages.getChat(userId);
      setMessages(data.messages || []);
      setOtherUser(data.otherUser);
      // Update unread count locally
      setConversations(prev => prev.map(c => c.userId === userId ? { ...c, unreadCount: 0 } : c));
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

  if (loading) return <div style={{ maxWidth: 600, margin: '0 auto', padding: 40 }}><Skeleton height={20} width="60%" /><div style={{ height: 12 }} /><Skeleton height={16} count={4} /></div>;

  return (
    <div style={styles.container}>
      {/* Conversations sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>المحادثات</div>
        {conversations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <FiMessageSquare size={36} color="#d1d5db" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#374151', marginBottom: 8 }}>لا يوجد محادثات</h3>
            <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 20 }}>ستظهر محادثاتك مع الملاك هنا</p>
          </div>
        ) : (
          conversations.map(conv => (
            <div
              key={conv.userId}
              style={{ ...styles.convItem, ...(selectedUser === conv.userId ? styles.convItemActive : {}) }}
              onClick={() => selectConversation(conv.userId)}
            >
              <div style={styles.avatar}>{getInitial(conv.userName)}</div>
              <div style={styles.convInfo}>
                <div style={styles.convName}>{conv.userName}</div>
                <div style={styles.convPreview}>{conv.lastMessage}</div>
              </div>
              {conv.unreadCount > 0 && <div style={styles.badge}>{conv.unreadCount}</div>}
            </div>
          ))
        )}
      </div>

      {/* Chat area */}
      <div style={styles.chatArea}>
        {!selectedUser ? (
          <div style={styles.empty}>اختر محادثة للبدء</div>
        ) : chatLoading ? (
          <div style={{ maxWidth: 600, margin: '0 auto', padding: 40 }}><Skeleton height={20} width="60%" /><div style={{ height: 12 }} /><Skeleton height={16} count={4} /></div>
        ) : (
          <>
            <div style={styles.chatHeader}>
              {otherUser?.name || 'محادثة'}
              <span style={{ fontSize: '12px', color: '#64748b', marginRight: '8px' }}>
                ({otherUser?.role === 'OWNER' ? 'مالك' : otherUser?.role === 'STUDENT' ? 'طالب' : otherUser?.role})
              </span>
            </div>
            <div style={styles.messagesArea}>
              {messages.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '40px' }}>لا توجد رسائل بعد. ابدأ المحادثة!</div>}
              {messages.map(msg => (
                <div key={msg.id} style={{ ...styles.msgBubble, ...(msg.senderId === user.id ? styles.msgMine : styles.msgOther) }}>
                  <div>{msg.content}</div>
                  <div style={styles.msgTime}>{formatTime(msg.createdAt)}</div>
                </div>
              ))}
              {isTyping && <div style={{ padding: '8px 16px', color: '#6b7280', fontSize: 13, fontStyle: 'italic' }}>يكتب...</div>}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} style={styles.inputArea}>
              <input
                aria-label="اكتب رسالة"
                style={styles.input}
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
              <button type="submit" style={styles.sendBtn} disabled={!newMsg.trim()}>إرسال</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
