import { Outlet } from 'react-router';
import { Navbar } from './Navbar';

export function Layout() {
  return (
    <div className="min-h-screen bg-[#0f0f23] text-gray-100">
      <Navbar />
      <Outlet />
    </div>
  );
}
