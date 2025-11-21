import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, X, Copy, Send, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/api';
import ChatLogo from '@/assets/chat-logo.svg';
import { useToast } from '@/hooks/use-toast';

export default function ChatWidget() {
  const { token, user } = useAuth();
  const API = getApiUrl();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef(null);
  const { toast } = useToast();

  const load = async () => {
    try {
      const res = await fetch(`${API}/api/chat/history`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const json = await res.json();
      setMessages(json.messages || []);
      // small UX: show assistant typing briefly when new assistant message pending
      if (json.messages && json.messages.some(m => m.role === 'assistant')) {
        setTyping(false);
      }
    } catch (err) { console.error(err); setMessages([]); }
  };

  useEffect(() => { if (open) load(); }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const send = async () => {
    if (!input || !input.trim()) return;
    const questionText = input.trim();
    const localId = `local-${Date.now()}`;
    setLoading(true);
    setTyping(true);
    let sent = false;
    try {
      const res = await fetch(`${API}/api/chat/ask`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: questionText }) });
      try { await res.clone().json(); } catch (e) { /* ignore parse errors */ }
      if (res.ok) {
        // refresh chat history to show assistant reply
        await load();
        sent = true;
      }
    } catch (err) {
      console.error('chat ask failed', err);
    } finally {
      // always dispatch a local placeholder post so the Dashboard shows the user's question immediately
      try {
        const localPost = {
          _id: localId,
          title: questionText.split('\n')[0].slice(0, 120) || 'Question',
          content: questionText,
          community: 'General',
          createdAt: new Date().toISOString(),
          authorName: user?.name || 'You',
          authorId: user?._id || user?.id || null,
          responses: 0,
          validationStatus: 'pending',
          __local: true,
        };
        try {
          // persist local placeholders per-user so they survive navigation/reload
          const key = `carecircle:localPosts:${user?._id || user?.id || 'anon'}`;
          const existing = JSON.parse(localStorage.getItem(key) || '[]');
          existing.unshift(localPost);
          localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
        } catch (e) { console.warn('persist local post failed', e); }
        window.dispatchEvent(new CustomEvent('carecircle:post-created', { detail: localPost }));
        console.debug('dispatched local post', localPost);
      } catch (e) { console.warn('dispatch local post failed', e); }
      setInput('');
      setLoading(false);
      setTyping(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const toggleOpen = () => setOpen(v => !v);

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6" aria-live="polite">
      <div className="flex items-end flex-col-reverse gap-3">
        {open && (
          <div className="chat-widget-mobile bg-white rounded-2xl shadow-2xl overflow-hidden border" role="dialog" aria-label="Chat with assistant">
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-sky-500/10 via-sky-500/5 to-transparent border-b">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img src={ChatLogo} alt="CareCircle assistant logo" className="w-9 h-9 rounded-full ring-2 ring-sky-500/30" aria-hidden={false} />
                  <Sparkles className="h-4 w-4 text-sky-500 absolute -bottom-1 -right-1 bg-white rounded-full" />
                </div>
                <div>
                  <div className="text-sm font-semibold">CareCircle Assistant</div>
                  <div className="text-xs text-muted-foreground">Informational only • not medical advice</div>
                </div>
              </div>
              <div>
                <button className="p-1 rounded hover:bg-muted" onClick={() => setOpen(false)} aria-label="Close chat"><X className="h-4 w-4 text-muted-foreground" /></button>
              </div>
            </div>
            <div ref={scrollRef} className="max-h-80 overflow-auto p-4 space-y-3 bg-gradient-to-b from-gray-50 to-white" tabIndex={0} aria-live="polite">
              {messages.length === 0 && !loading && (
                <div className="text-sm text-muted-foreground flex items-center gap-2"><Sparkles className="h-4 w-4 text-sky-500" />Ask the assistant anything health-related.</div>
              )}
              {messages.map(m => (
                <div key={m._id || m.id} className={`flex ${m.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-2xl shadow-sm ${m.role === 'assistant' ? 'bg-white border text-gray-900' : 'bg-sky-600 text-white'}`}>
                    <div className="flex items-center justify-between">
                      <div className={`text-[11px] ${m.role === 'assistant' ? 'text-muted-foreground' : 'text-white/90'} mb-1`}>{m.role === 'assistant' ? 'Assistant' : (m.userId?.name || 'You')}</div>
                      {m.role === 'assistant' && (
                        <button className="ml-2 p-1 text-muted-foreground rounded hover:bg-muted" onClick={() => { navigator.clipboard?.writeText(m.content).catch(()=>{}); }} title="Copy reply"><Copy className="h-4 w-4" /></button>
                      )}
                    </div>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</div>
                    <div className={`${m.role === 'assistant' ? 'text-[11px] text-muted-foreground mt-1' : 'text-[11px] text-white/80 mt-1'}`}>{new Date(m.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}
              {typing && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded-2xl bg-white border text-sm text-muted-foreground flex items-center gap-2">
                    <span className="inline-flex h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
                    Assistant is typing...
                  </div>
                </div>
              )}
            </div>
            <div className="p-3 border-t bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
              <label htmlFor="chat-input" className="sr-only">Ask a question</label>
              <div className="flex gap-2">
                <textarea
                  id="chat-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={2}
                  className="w-full resize-none rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  placeholder="Ask a question... (Enter to send)"
                  aria-label="Chat input"
                />
                <Button onClick={send} disabled={loading} size="icon" className="h-9 w-9 self-end">
                  {loading ? <span className="h-4 w-4 rounded-full border-2 border-white/60 border-t-white animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <div className="mt-1 flex justify-between items-center">
                <div className="text-[11px] text-muted-foreground">Messages are stored for moderation.</div>
                <Button
                  onClick={async () => {
                    if (!token) {
                      // Without login we cannot delete server history; just clear local view
                      setMessages([]);
                      setInput('');
                      toast({ title: 'Login required', description: 'Sign in to clear your saved chat history.' });
                      return;
                    }
                    try {
                      let j = {};
                      let res = await fetch(`${API}/api/chat/history`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      if (!res.ok && res.status === 404) {
                        // fallback to alias when DELETE not available
                        res = await fetch(`${API}/api/chat/history/clear`, {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${token}` }
                        });
                      }
                      if (!res.ok) {
                        toast({ title: 'Clear failed', description: `Server responded ${res.status}` });
                        // still clear locally for UX
                        setMessages([]);
                        setInput('');
                        return;
                      }
                      j = await res.json().catch(() => ({}));
                      await load();
                      if ((j.deletedCount ?? 0) === 0 && (messages?.length || 0) > 0) {
                        toast({ title: 'Some messages remain', description: 'Could not remove all messages on server.' });
                      } else {
                        toast({ title: 'Chat cleared', description: 'Your chat history has been removed.' });
                      }
                    } catch (err) {
                      console.error('clear history failed', err);
                      setMessages([]);
                      setInput('');
                      toast({ title: 'Network error', description: 'Cleared locally; will reappear if not deleted on server.' });
                    }
                  }}
                  variant="ghost"
                  size="sm"
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Toggle button: accessible, keyboard friendly, animated when closed */}
        <button
          onClick={toggleOpen}
          aria-label={open ? 'Close assistant' : 'Open assistant'}
          aria-expanded={open}
          className={`h-14 w-14 rounded-full shadow-xl border flex items-center justify-center transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${open ? 'bg-sky-600 hover:bg-sky-700' : 'bg-white hover:bg-gray-50 chat-icon-animate'}`}
        >
          {!open ? (
            <img src={ChatLogo} alt="Open assistant" className="h-7 w-7 opacity-90" />
          ) : (
            <MessageSquare className="h-6 w-6 text-white" />
          )}
        </button>
      </div>
    </div>
  );
}
