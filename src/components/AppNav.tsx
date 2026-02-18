'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Activity, Calendar, User } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', icon: Home, label: 'Inicio' },
  { href: '/exercises', icon: Activity, label: 'Ejercicios' },
  { href: '/report', icon: Calendar, label: 'Informe' },
  { href: '/profile', icon: User, label: 'Perfil' },
] as const;

export function AppNav({ active }: { active?: string }) {
  const pathname = usePathname();

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────── */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-[220px] bg-white border-r border-gray-200 flex-col z-40">
        <div className="flex items-center gap-2 px-5 h-16 border-b border-gray-100 flex-shrink-0">
          <span className="font-bold text-blue-600 text-xl tracking-tight">Mou</span>
          <span className="text-gray-400 text-sm font-medium mt-0.5">· Paciente</span>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = active
              ? active === href
              : pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-sm font-medium">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100 text-xs text-gray-400 flex-shrink-0">
          © Mou · Rehabilitación
        </div>
      </aside>

      {/* ── Mobile bottom bar ────────────────────────────────────── */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-lg border-t border-gray-200 pb-safe pt-2 z-50">
        <div className="flex justify-around items-center px-4 h-16">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = active
              ? active === href
              : pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 transition-colors ${
                  isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
