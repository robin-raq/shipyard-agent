import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface CommandItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  section: string;
}

const COMMANDS: CommandItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: '🏠', section: 'Pages' },
  { id: 'docs', label: 'Documents', path: '/docs', icon: '📄', section: 'Pages' },
  { id: 'issues', label: 'Issues', path: '/issues', icon: '🐛', section: 'Pages' },
  { id: 'projects', label: 'Projects', path: '/projects', icon: '📁', section: 'Pages' },
  { id: 'weeks', label: 'Weeks', path: '/weeks', icon: '📅', section: 'Pages' },
  { id: 'teams', label: 'Teams', path: '/teams', icon: '👥', section: 'Pages' },
  { id: 'standups', label: 'Standups', path: '/standups', icon: '📝', section: 'Pages' },
  { id: 'plans', label: 'Weekly Plans', path: '/weekly-plans', icon: '📋', section: 'Pages' },
  { id: 'retros', label: 'Weekly Retros', path: '/weekly-retros', icon: '🔄', section: 'Pages' },
  { id: 'reviews', label: 'Reviews', path: '/reviews', icon: '✅', section: 'Pages' },
  { id: 'ships', label: 'Ships', path: '/ships', icon: '⛵', section: 'Pages' },
  { id: 'programs', label: 'Programs', path: '/programs', icon: '🎯', section: 'Pages' },
  { id: 'admin', label: 'Admin Dashboard', path: '/admin', icon: '⚙️', section: 'Admin' },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const filtered = COMMANDS.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  // Cmd+K / Ctrl+K to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSelect = useCallback((item: CommandItem) => {
    navigate(item.path);
    setOpen(false);
  }, [navigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      handleSelect(filtered[selectedIndex]);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />

      {/* Palette */}
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center px-4 border-b border-gray-200">
          <span className="text-gray-400 mr-2">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search pages..."
            className="w-full py-3 text-sm outline-none bg-transparent"
          />
          <kbd className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">No results found.</p>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors ${
                  i === selectedIndex ? 'bg-blue-50 text-blue-900' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                <span className="text-xs text-gray-400">{item.section}</span>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-200 flex gap-4 text-xs text-gray-400">
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>ESC Close</span>
        </div>
      </div>
    </div>
  );
}
