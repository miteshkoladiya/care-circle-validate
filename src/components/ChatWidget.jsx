import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, X, Copy, Send, Sparkles, Maximize2, Minimize2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/api';
import ChatLogo from '@/assets/chat-logo.svg';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function ChatWidget() {
  const { token, user } = useAuth();
  const API = getApiUrl();
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState('small'); // 'small' | 'large'
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
  }, [messages, open, size, typing]);

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
  const toggleSize = () => setSize(s => s === 'small' ? 'large' : 'small');

  return (
    <div className="fixed bottom-4 right-4 z-[100] sm:bottom-6 sm:right-6" aria-live="polite">
      <div className="flex items-end flex-col-reverse gap-3">
        {open && (
          <div 
            className={cn(
              "chat-widget-mobile bg-background/95 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden border border-border/50 transition-all duration-300 ease-in-out flex flex-col",
              size === 'large' ? "w-[90vw] h-[80vh] sm:w-[600px] sm:h-[700px]" : "w-[350px] h-[500px]"
            )}
            role="dialog" 
            aria-label="Chat with assistant"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
                     <img src={ChatLogo} alt="CareCircle assistant logo" className="w-7 h-7" aria-hidden={false} />
                  </div>
                  <Sparkles className="h-3.5 w-3.5 text-primary absolute -bottom-0.5 -right-0.5 bg-background rounded-full ring-2 ring-background" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">CareCircle Assistant</div>
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">AI Health Companion</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" 
                  onClick={toggleSize} 
                  title={size === 'small' ? "Expand" : "Minimize"}
                >
                  {size === 'small' ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                </button>
                <button 
                  className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" 
                  onClick={() => setOpen(false)} 
                  aria-label="Close chat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-muted/20 to-background" tabIndex={0} aria-live="polite">
              {messages.length === 0 && !loading && (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 opacity-80">
                  <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center mb-2">
                    <Sparkles className="h-8 w-8 text-primary/60" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-foreground">How can I help you?</h3>
                    <p className="text-sm text-muted-foreground max-w-[200px] mx-auto">Ask about symptoms, medications, or general health advice.</p>
                  </div>
                </div>
              )}
              
              {messages.map(m => (
                <div key={m._id || m.id} className={`flex ${m.role === 'assistant' ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                  <div 
                    className={cn(
                      "max-w-[85%] px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed relative group",
                      m.role === 'assistant' 
                        ? "bg-card border border-border/50 text-card-foreground rounded-tl-none" 
                        : "bg-primary text-primary-foreground rounded-tr-none"
                    )}
                  >
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <span className={cn("text-[10px] font-medium opacity-70", m.role === 'assistant' ? "text-muted-foreground" : "text-primary-foreground")}>
                        {m.role === 'assistant' ? 'Assistant' : 'You'}
                      </span>
                      {m.role === 'assistant' && (
                        <button 
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded" 
                          onClick={() => { navigator.clipboard?.writeText(m.content).catch(()=>{}); }} 
                          title="Copy reply"
                        >
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    <div className={cn("text-[10px] mt-1 text-right opacity-50", m.role === 'assistant' ? "text-muted-foreground" : "text-primary-foreground")}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              
              {typing && (
                <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2">
                  <div className="px-4 py-3 rounded-2xl rounded-tl-none bg-card border border-border/50 flex items-center gap-2 shadow-sm">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" />
                    </div>
                    <span className="text-xs text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border/50 bg-background/80 backdrop-blur-md shrink-0">
              <label htmlFor="chat-input" className="sr-only">Ask a question</label>
              <div className="flex gap-2 relative">
                <textarea
                  id="chat-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 pr-12 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px] max-h-[120px]"
                  placeholder="Type your health question..."
                  aria-label="Chat input"
                  style={{ height: 'auto', minHeight: '44px' }}
                  onInput={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                  }}
                />
                <Button 
                  onClick={send} 
                  disabled={loading || !input.trim()} 
                  size="icon" 
                  className={cn(
                    "absolute right-1.5 bottom-1.5 h-8 w-8 rounded-lg transition-all duration-200",
                    input.trim() ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground hover:bg-muted"
                  )}
                >
                  {loading ? <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <div className="mt-2 flex justify-between items-center px-1">
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-primary/50" />
                  <span>AI-generated content • Verify with a doctor</span>
                </div>
                <Button
                  onClick={async () => {
                    if (!token) {
                      setMessages([]);
                      setInput('');
                      toast({ title: 'Login required', description: 'Sign in to clear your saved chat history.' });
                      return;
                    }
                    try {
                      let res = await fetch(`${API}/api/chat/history`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      if (!res.ok && res.status === 404) {
                        res = await fetch(`${API}/api/chat/history/clear`, {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${token}` }
                        });
                      }
                      if (!res.ok) {
                        setMessages([]);
                        setInput('');
                        return;
                      }
                      await load();
                      toast({ title: 'Chat cleared', description: 'Your chat history has been removed.' });
                    } catch (err) {
                      setMessages([]);
                      setInput('');
                    }
                  }}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-muted-foreground hover:text-destructive px-2"
                >
                  Clear History
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Toggle button */}
        <button
          onClick={toggleOpen}
          aria-label={open ? 'Close assistant' : 'Open assistant'}
          aria-expanded={open}
          className={cn(
            "h-14 w-14 rounded-full shadow-xl border flex items-center justify-center transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            open 
              ? "bg-primary hover:bg-primary/90 rotate-90 scale-90" 
              : "bg-background hover:bg-muted chat-icon-animate hover:scale-105"
          )}
        >
          {!open ? (
            <div className="relative">
              <img src={ChatLogo} alt="Open assistant" className="h-8 w-8 opacity-90" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
              </span>
            </div>
          ) : (
            <X className="h-6 w-6 text-primary-foreground" />
          )}
        </button>
      </div>
    </div>
  );
}
