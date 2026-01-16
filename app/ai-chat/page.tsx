'use client';

import { useState } from 'react';

export default function AIChatPage() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sendMessage = async () => {
    if (!message.trim()) return;

    setLoading(true);
    setError('');
    setResponse(null);

    try {
      const res = await fetch('/api/ai-assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          userId: '1',
          orgId: '1',
          conversationHistory: []
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to get response');
        console.error('API Error:', data);
      } else {
        setResponse(data);
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
      console.error('Request Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">AI Chat Assistant</h1>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Ask a question about your documents:
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="e.g., Show me engineering department docs"
          />
        </div>

        <button
          onClick={sendMessage}
          disabled={loading || !message.trim()}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing...' : 'Send Message'}
        </button>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setMessage('Show me engineering department docs')}
            className="text-sm bg-gray-100 px-3 py-1 rounded hover:bg-gray-200"
          >
            Engineering docs
          </button>
          <button
            onClick={() => setMessage('Find HR documents')}
            className="text-sm bg-gray-100 px-3 py-1 rounded hover:bg-gray-200"
          >
            HR docs
          </button>
          <button
            onClick={() => setMessage('What are the sales reports?')}
            className="text-sm bg-gray-100 px-3 py-1 rounded hover:bg-gray-200"
          >
            Sales reports
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h3 className="text-red-800 font-semibold mb-2">Error</h3>
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {response && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Response</h2>
          
          <div className="mb-4">
            <p className="text-gray-800 whitespace-pre-wrap">{response.data?.response}</p>
          </div>

          {response.data?.sources && response.data.sources.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold mb-2">Sources ({response.data.sources.length}):</h3>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {response.data.sources.map((source: string, idx: number) => (
                  <li key={idx}>{source}</li>
                ))}
              </ul>
            </div>
          )}

          {response.data?.reasoning && (
            <div className="text-sm text-gray-500 border-t pt-3">
              <strong>Reasoning:</strong> {response.data.reasoning}
            </div>
          )}

          <div className="text-xs text-gray-400 mt-3">
            Conversation ID: {response.data?.conversationId}
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-blue-800">Processing your request...</span>
          </div>
        </div>
      )}
    </div>
  );
}
