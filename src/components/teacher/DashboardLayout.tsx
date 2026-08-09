'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOutUser } from '@/lib/firebase/auth';
import { useAuth } from '@/lib/hooks/useAuth';
import Button from '@/components/ui/Button';
import ClassfullyMark from '@/components/brand/ClassfullyMark';
import { 
  BookOpen,
  Home, 
  BarChart, 
  Settings, 
  LogOut,
  Menu,
  X,
  UserCheck,
  GraduationCap,
  Gift,
  Blocks,
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const primaryNavigation = [
  { name: 'Home', href: '/dashboard', icon: Home },
  { name: 'Classes', href: '/dashboard/classes', icon: GraduationCap },
  { name: 'Student progress', href: '/dashboard/progress', icon: UserCheck },
  { name: 'Review', href: '/dashboard/analytics', icon: BarChart },
];

const teachingTools = [
  { name: 'Teaching modules', href: '/dashboard/modules', icon: Blocks },
  { name: 'Case studies', href: '/dashboard/case-studies', icon: BookOpen },
  { name: 'Rewards', href: '/dashboard/rewards', icon: Gift },
];

const accountNavigation = [
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOutUser();
      router.push('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#fffefa]">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-[#101a38]/55" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-[#e3e5ed] bg-white ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-200 ease-in-out lg:static lg:inset-0 lg:translate-x-0`}>
        <div className="flex h-20 items-center justify-between border-b border-[#e3e5ed] px-6">
          <Link href="/dashboard" className="classfully-lockup text-xl" aria-label="Classfully dashboard">
            <ClassfullyMark className="classfully-mark" />
            <span className="classfully-wordmark">Classfully</span>
          </Link>
          <button
            type="button"
            className="seminar-focus rounded-lg p-1 text-[#697087] hover:text-[#101a38] lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="mt-6 px-4" aria-label="Instructor workspace">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#9aa0b1]">Teach</p>
          <ul className="space-y-1">
            {primaryNavigation.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
              const Icon = item.icon;
              
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`flex min-h-10 items-center rounded-[10px] px-3 py-2 text-sm font-semibold transition-colors ${
                      isActive
                        ? 'bg-[#f0efff] text-[#4137c7]'
                        : 'text-[#697087] hover:bg-[#f8f7fb] hover:text-[#101a38]'
                    }`}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className="mt-7 px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#9aa0b1]">Modules</p>
          <ul className="space-y-1">
            {teachingTools.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`flex min-h-10 items-center rounded-[10px] px-3 py-2 text-sm font-semibold transition-colors ${
                      isActive
                        ? 'bg-[#f0efff] text-[#4137c7]'
                        : 'text-[#697087] hover:bg-[#f8f7fb] hover:text-[#101a38]'
                    }`}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>

          <ul className="mt-7 border-t border-[#ececf1] pt-4">
            {accountNavigation.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <li key={item.name}>
                  <Link href={item.href} className={`flex min-h-10 items-center rounded-[10px] px-3 py-2 text-sm font-semibold transition-colors ${isActive ? 'bg-[#f0efff] text-[#4137c7]' : 'text-[#697087] hover:bg-[#f8f7fb] hover:text-[#101a38]'}`}>
                    <Icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User info */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-[#e3e5ed] bg-white p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#101a38]">
                <span className="text-sm font-medium text-white">
                  {user?.name?.charAt(0).toUpperCase() || 'T'}
                </span>
              </div>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-semibold text-[#101a38]">{user?.name}</p>
              <p className="max-w-[120px] truncate text-xs text-[#697087]">{user?.email}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="ml-2 p-2"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="min-w-0 flex-1 lg:pl-0">
        {/* Mobile header */}
        <div className="border-b border-[#e3e5ed] bg-white lg:hidden">
          <div className="flex items-center justify-between h-16 px-6">
            <button
              type="button"
              className="seminar-focus rounded-lg p-1 text-[#697087] hover:text-[#101a38]"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="classfully-lockup text-lg">
              <ClassfullyMark className="classfully-mark" />
              <span className="classfully-wordmark">Classfully</span>
            </span>
            <div className="w-6" /> {/* Spacer */}
          </div>
        </div>

        {/* Page content */}
        <main className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
