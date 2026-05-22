import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import useAppStore from '../store/appStore';
import api from '../api/client';

export default function MessagesPage() {
  const [conversations, setConversations] = useState([]);
  const [activeMatch, setActiveMatch] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useAppStore();

  useEffect(() => {
    api.get('/messages').then(res => {
      setConversations(res.data.conversations || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const loadMessages = async (matchId) => {
    setActiveMatch(matchId);
    const res = await api.get(`/messages/${matchId}`);
    setMessages(res.data.messages || []);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeMatch) return;
    try {
      const res = await api.post('/messages', { matchId: activeMatch, content: newMessage });
      setMessages([...messages, res.data]);
      setNewMessage('');
    } catch (err) { console.error(err); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          <Link to="/dashboard" className="text-teal-600 hover:text-teal-700 font-medium text-sm">← Dashboard</Link>
        </div>
      </header>
      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-6 flex gap-4">
        {/* Conversation list */}
        <div className="w-72 flex-shrink-0">
          <div className="card overflow-hidden">
            {loading ? (
              <div className="p-4 text-gray-500 text-sm">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                <div className="text-3xl mb-2">💬</div>
                No conversations yet.{' '}
                <Link to="/matches" className="text-teal-600 underline">Find a match</Link> to start chatting.
              </div>
            ) : (
              conversations.map(c => (
                <button key={c.match_id} onClick={() => loadMessages(c.match_id)}
                  className={`w-full text-left p-4 border-b hover:bg-gray-50 transition-colors ${activeMatch === c.match_id ? 'bg-teal-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center text-teal-700 font-bold text-sm flex-shrink-0">
                      {c.first_name?.[0]}{c.last_name?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm">{c.first_name} {c.last_name}</div>
                      <div className="text-xs text-gray-500 truncate">{c.last_message || 'No messages yet'}</div>
                    </div>
                    {c.unread_count > 0 && (
                      <div className="w-5 h-5 bg-teal-600 rounded-full flex items-center justify-center text-white text-xs">{c.unread_count}</div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Message area */}
        <div className="flex-1 card flex flex-col overflow-hidden">
          {!activeMatch ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              Select a conversation to start messaging
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${
                      msg.sender_id === user?.id
                        ? 'bg-teal-600 text-white rounded-br-sm'
                        : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={sendMessage} className="border-t p-4 flex gap-3">
                <input
                  type="text"
                  className="input-field flex-1 py-2"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                />
                <button type="submit" className="btn-primary py-2 px-5 text-sm">Send</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
