'use client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function Header() {
  const { user, logout, isLoading } = useAuth();
  const pathname = usePathname();
  if (isLoading || !user) return null;
  const active = (path: string) => pathname === path;
  return (
    <aside className="w-[238px] shrink-0 bg-white border-r border-[#e6ece8] min-h-screen flex flex-col">
      <div className="px-7 pt-7 pb-9"><Link href="/dashboard" className="flex items-center gap-2"><span className="h-7 w-7 rounded-lg bg-[#202522] text-white grid place-items-center text-xs font-bold">O</span><span className="text-[17px] font-bold tracking-tight text-[#202522]">ReachInbox</span></Link></div>
      <nav className="px-4 space-y-1"><p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a1aca6]">Workspace</p>
        <Link href="/dashboard" className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${active('/dashboard') ? 'bg-[#eaf8f1] text-[#2c9b71]' : 'text-[#7a8580] hover:bg-[#f6faf8] hover:text-[#202522]'}`}><span className="text-base">▤</span> Dashboard</Link>
        <Link href="/senders" className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${active('/senders') ? 'bg-[#eaf8f1] text-[#2c9b71]' : 'text-[#7a8580] hover:bg-[#f6faf8] hover:text-[#202522]'}`}><span className="text-base">✉</span> Senders</Link>
        <a href={`${API_URL}/admin/queues`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#7a8580] hover:bg-[#f6faf8] hover:text-[#202522]"><span className="text-base">◫</span> Queue Monitor <span className="ml-auto text-[10px] text-[#a1aca6]">↗</span></a>
      </nav>
      <div className="mt-auto p-5 border-t border-[#e6ece8]"><div className="flex items-center gap-3 mb-4">
        {user.avatarUrl ? <img src={user.avatarUrl} alt={user.name || user.email} className="h-9 w-9 rounded-full" /> : <div className="h-9 w-9 rounded-full bg-[#202522] flex items-center justify-center text-white font-semibold text-sm">{user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}</div>}
        <div className="min-w-0"><p className="text-sm font-medium text-[#202522] truncate">{user.name || 'User'}</p><p className="text-xs text-[#8a948e] truncate">{user.email}</p></div>
      </div><Button onClick={() => logout()} variant="outline" size="sm" className="w-full">Logout</Button></div>
    </aside>
  );
}
