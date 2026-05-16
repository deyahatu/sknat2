import { FiMessageSquare } from 'react-icons/fi';
import MessagesChat from '../../components/shared/MessagesChat';

export default function StudentMessages() {
  return (
    <div className="mc-page">
      <h1 className="mc-page__title"><FiMessageSquare /> الرسائل</h1>
      <MessagesChat />
    </div>
  );
}
