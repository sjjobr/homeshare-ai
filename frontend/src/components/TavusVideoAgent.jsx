/**
 * TavusVideoAgent.jsx
 * Embeds the Tavus CVI video agent in an iframe.
 * Manages conversation lifecycle: start, active, ended.
 * Notifies the parent when the conversation completes.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/client';

const POLLING_INTERVAL_MS = 5000;

export default function TavusVideoAgent({ onConversationComplete }) {
  const [conversationId,  setConversationId]  = useState(null);
  const [conversationUrl, setConversationUrl] = useState(null);
  const [status, setStatus]   = useState('idle'); // idle | starting | active | ended | error
  const [error,  setError]    = useState(null);
  const pollRef  = useRef(null);
  const iframeRef = useRef(null);

  // -----------------------------------------------------------------------
  // Start the Tavus conversation
  // -----------------------------------------------------------------------
  const startConversation = useCallback(async () => {
    try {
      setStatus('starting');
      setError(null);

      const { data } = await api.post('/tavus/conversation');
      setConversationId(data.conversationId);
      setConversationUrl(data.conversationUrl);
      setStatus('active');
    } catch (err) {
      console.error('Failed to start Tavus conversation:', err);
      setError('Could not start the video session. Please try again.');
      setStatus('error');
    }
  }, []);

  // -----------------------------------------------------------------------
  // Poll for conversation completion
  // When status changes to "ended", the webhook has already fired
  // and the user profile has been populated.
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!conversationId || status !== 'active') return;

    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/tavus/conversation/${conversationId}`);
        if (data.status === 'ended') {
          setStatus('ended');
          clearInterval(pollRef.current);
          if (typeof onConversationComplete === 'function') {
            onConversationComplete(data.extractedData);
          }
        }
      } catch (err) {
        console.warn('Polling error:', err.message);
      }
    }, POLLING_INTERVAL_MS);

    return () => clearInterval(pollRef.current);
  }, [conversationId, status, onConversationComplete]);

  // -----------------------------------------------------------------------
  // End conversation manually (e.g., if user clicks "Skip")
  // -----------------------------------------------------------------------
  const endConversation = useCallback(async () => {
    if (!conversationId) return;
    try {
      await api.post(`/tavus/conversation/${conversationId}/end`);
    } catch (err) {
      console.warn('Error ending conversation:', err.message);
    }
    setStatus('ended');
    clearInterval(pollRef.current);
    if (typeof onConversationComplete === 'function') {
      onConversationComplete(null);
    }
  }, [conversationId, onConversationComplete]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  if (status === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-warm-cream rounded-2xl border border-warm-200 shadow-sm">
        <div className="mb-6 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-teal-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">
            Meet Haven, Your Guide
          </h2>
          <p className="text-gray-600 max-w-md">
            Haven is our friendly AI who will ask you a few friendly questions to set up your
            profile — right here, face to face. It only takes about 5 minutes.
          </p>
        </div>
        <button
          onClick={startConversation}
          className="px-8 py-3 bg-teal-600 text-white rounded-full font-medium hover:bg-teal-700 
                     transition-colors shadow-md hover:shadow-lg"
        >
          Start Conversation with Haven
        </button>
        <p className="mt-4 text-sm text-gray-400">
          Make sure your camera and microphone are enabled.
        </p>
      </div>
    );
  }

  if (status === 'starting') {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-teal-600 border-t-transparent 
                          rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Starting your session with Haven...</p>
        </div>
      </div>
    );
  }

  if (status === 'ended') {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 mb-4 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">All done!</h3>
        <p className="text-gray-600">
          Thanks for chatting with Haven. Your profile is being set up now — 
          we'll show you your matches in just a moment.
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={startConversation}
          className="px-6 py-2 bg-teal-600 text-white rounded-full hover:bg-teal-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  // status === 'active'
  return (
    <div className="w-full">
      <div className="relative w-full" style={{ paddingBottom: '56.25%', height: 0 }}>
        <iframe
          ref={iframeRef}
          src={conversationUrl}
          title="HomeShare AI Agent - Haven"
          allow="camera; microphone; fullscreen"
          className="absolute inset-0 w-full h-full rounded-2xl border-0 shadow-lg"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
        />
      </div>
      <div className="mt-4 text-center">
        <button
          onClick={endConversation}
          className="text-sm text-gray-400 hover:text-gray-600 underline transition-colors"
        >
          Skip and fill in manually instead
        </button>
      </div>
    </div>
  );
}
