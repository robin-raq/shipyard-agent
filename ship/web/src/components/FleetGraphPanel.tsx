import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFleetGraph } from '../hooks/useFleetGraph';

export interface FleetGraphPanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
}

const severityStyles: Record<string, { bg: string; text: string; ring: string }> = {
  critical: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' },
  info: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200' },
  clean: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
};

export default function FleetGraphPanel({ open, onClose, title = 'FleetGraph Assistant' }: FleetGraphPanelProps) {
  const { messages, loading, error, sendMessage } = useFleetGraph();
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change or panel opens
  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, open]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const hasMessages = useMemo(() => messages && messages.length > 0, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput('');
    await sendMessage(text);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Slide-in panel */}
      <div className={`absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl border-l border-gray-200 transform transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white text-xs">FG</span>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            aria-label="Close FleetGraph panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-4 mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Messages list */}
        <div ref={listRef} className="px-4 py-4 overflow-y-auto h-[calc(100%-9.5rem)]">
          {!hasMessages && !loading && (
            <div className="mt-12 text-center text-gray-500">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">🤖</div>
              <p className="text-sm">Ask FleetGraph about the current page, entity, or recent findings.</p>
              <p className="mt-1 text-xs text-gray-400">Try: "What risks are present here?" or "Summarize key issues"</p>
            </div>
          )}

          {messages.map((m, idx) => {
            const isUser = m.role === 'user';
            return (
              <div key={idx} className={`mb-3 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                  isUser ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-800 border border-gray-200'
                }`}>
                  {/* Assistant metadata */}
                  {!isUser && (
                    <div className="mb-1 flex items-center gap-2">
                      {m.severity && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1 ${
                          severityStyles[m.severity]?.bg || 'bg-gray-100'
                        } ${severityStyles[m.severity]?.text || 'text-gray-700'} ${
                          severityStyles[m.severity]?.ring || 'ring-gray-200'
                        }`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current"></span>
                          {m.severity}
                        </span>
                      )}
                      <span className="text-[10px] uppercase tracking-wide text-gray-400">Assistant</span>
                    </div>
                  )}

                  <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>

                  {/* Findings (assistant) */}
                  {!isUser && m.findings && m.findings.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {m.findings.slice(0, 5).map((f) => (
                        <div key={f.id} className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700">
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate pr-2">{f.title || 'Finding'}</span>
                            <span className={`ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
                              f.severity === 'critical' ? 'bg-red-100 text-red-700' : f.severity === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {f.severity}
                            </span>
                          </div>
                          {f.category && <div className="mt-0.5 text-[11px] text-gray-500">{f.category}</div>}
                          {f.detail && <div className="mt-1 text-[11px] text-gray-600 line-clamp-3">{f.detail}</div>}
                        </div>
                      ))}
                      {m.findings.length > 5 && (
                        <div className="text-[11px] text-gray-500">and {m.findings.length - 5} more…</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading indicator */}
          {loading && (
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
              Thinking…
            </div>
          )}
        </div>

        {/* Input area */}
        <form onSubmit={handleSubmit} className="absolute bottom-0 left-0 right-0 border-t border-gray-200 bg-white p-3">
          <div className="flex items-end gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about this page…"
              className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white transition-colors ${
                loading || !input.trim() ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.125A59.769 59.769 0 0121.485 12 59.77 59.77 0 013.27 20.875L6 12zm0 0h7.5" />
                </svg>
              )}
              <span>{loading ? 'Sending' : 'Send'}</span>
            </button>
          </div>
          <div className="mt-1 text-[11px] text-gray-400">Press Enter to send</div>
        </form>
      </div>
    </div>
  );
}
