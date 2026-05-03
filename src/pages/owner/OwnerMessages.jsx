import MessagesChat from '../../components/shared/MessagesChat';

export default function OwnerMessages() {
  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px', direction: 'rtl' }}>الرسائل</h1>
      <MessagesChat />
    </div>
  );
}
