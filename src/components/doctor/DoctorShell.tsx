'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase';

type Doctor = { id: string; external_label: string };

export function DoctorShell({ doctor, children }: { doctor: Doctor; children: React.ReactNode }) {
  const router = useRouter();
  const supabase = createClient();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold tracking-tight">Mou</span>
            <span className="text-sm text-gray-400">·</span>
            <span className="text-sm text-gray-600">{doctor.external_label}</span>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
          >
            <LogOut size={16} />
            {loggingOut ? 'Cerrando…' : 'Cerrar sesión'}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">{children}</main>
    </div>
  );
}
