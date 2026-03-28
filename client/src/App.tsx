import { useState, useRef, FormEvent } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const API_BASE = '/api/chat';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [useGrounding, setUseGrounding] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: input };
    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setInput('');
    setLoading(true);

    try {
      // TODO: attach Firebase Auth ID token via Authorization header
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          history: messages,
          useGrounding,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const { text } = (await res.json()) as { text: string };
      setMessages([...updatedHistory, { role: 'assistant', content: text }]);
    } catch (err) {
      setMessages([
        ...updatedHistory,
        { role: 'assistant', content: `Error: ${String(err)}` },
      ]);
    } finally {
      setLoading(false);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      <header className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <h1 className="text-xl font-semibold">AI Chatbot</h1>
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={useGrounding}
            onChange={(e) => setUseGrounding(e.target.checked)}
            className="accent-blue-500"
          />
          Web grounding
        </label>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-gray-500 mt-20">Send a message to start.</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-2xl mx-auto rounded-xl px-4 py-3 whitespace-pre-wrap text-sm ${
              m.role === 'user'
                ? 'bg-blue-600 ml-auto'
                : 'bg-gray-800'
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="max-w-2xl mx-auto bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400 animate-pulse">
            Thinking...
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      <form
        onSubmit={sendMessage}
        className="px-4 py-4 border-t border-gray-800 flex gap-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={loading}
          className="flex-1 bg-gray-800 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
