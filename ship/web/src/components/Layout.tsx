import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { path: '/docs', label: 'Documents', icon: '📄' },
    { path: '/issues', label: 'Issues', icon: '🐛' },
    { path: '/projects', label: 'Projects', icon: '📁' },
    { path: '/weeks', label: 'Weeks', icon: '📅' },
    { path: '/teams', label: 'Teams', icon: '👥' },
    { path: '/ships', label: 'Ships', icon: '⛵' },
    { path: '/programs', label: 'Programs', icon: '🎯' },
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div className="flex h-screen bg-gray-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Skip to main content
      </a>

      <nav aria-label="Main navigation">
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
          <header className="p-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">⚓ Ship</h1>
          </header>
          <div className="flex-1 p-4 overflow-y-auto">
            <ul className="space-y-1" role="list">
              {navItems.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      isActive(item.path)
                        ? 'bg-blue-50 text-blue-800 font-medium'
                        : 'text-gray-800 hover:bg-gray-100'
                    }`}
                    aria-current={isActive(item.path) ? 'page' : undefined}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {user && (
            <div className="p-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="truncate">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.display_name || user.username}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
                <button
                  onClick={logout}
                  className="ml-2 p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                  aria-label="Sign out"
                  title="Sign out"
                >
                  ↩
                </button>
              </div>
            </div>
          )}
        </aside>
      </nav>

      <main id="main-content" role="main" className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
