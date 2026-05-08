import { FiMessageSquare } from 'react-icons/fi';
import MessagesChat from '../../components/shared/MessagesChat';

export default function StudentMessages() {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px', direction: 'rtl', display: 'flex', alignItems: 'center', gap: '8px' }}><FiMessageSquare /> الرسائل</h1>
      <MessagesChat />
    </div>
  );
}
