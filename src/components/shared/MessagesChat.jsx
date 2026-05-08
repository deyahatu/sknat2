import { useState, useEffect, useRef, useCallback } from 'react';
import { FiMessageSquare } from 'react-icons/fi';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { connectSocket, getSocket } from '../../utils/socket';
import { useToast } from '../../components/shared/Toast';
import Skeleton from './Skeleton';
import './MessagesChat.css';

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

  if (loading) return (
    <div className="mc-skeleton-wrap">
      <Skeleton height={20} width="60%" />
      <div className="mc-skeleton-gap" />
      <Skeleton height={16} count={4} />
    </div>
  );

  return (
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
                <div className="mc-conv-last-msg">{conv.lastMessage}</div>
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
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`mc-message${msg.senderId === user.id ? ' mc-message-mine' : ' mc-message-other'}`}
                >
                  <div>{msg.content}</div>
                  <div className="mc-message-time">{formatTime(msg.createdAt)}</div>
                </div>
              ))}
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
    </div>
  );
}
