import { Link, useLocation } from 'react-router';
import { Sword, User, Home, BookOpen } from 'lucide-react';

export function Navbar() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-[#1a1a2e] text-white border-b border-[#16213e] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Sword className="w-6 h-6 text-amber-400" />
          <span className="text-amber-400 tracking-wider">TRPG Solo</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
              isActive('/') ? 'text-amber-400' : 'text-gray-300 hover:text-white'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>首页</span>
          </Link>
          <Link
            to="/modules"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
              isActive('/modules') ? 'text-amber-400' : 'text-gray-300 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>模组</span>
          </Link>
          <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-600">
            <div className="w-8 h-8 rounded-full bg-[#533483] flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <span className="text-sm text-gray-300">冒险者</span>
          </div>
        </div>
      </div>
    </nav>
  );
}
