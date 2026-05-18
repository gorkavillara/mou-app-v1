'use client';

import React, { useState } from 'react';
import { LockIcon } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';

const ERROR_MESSAGES: Record<string, string> = {
  no_access: 'Esta cuenta no tiene acceso al panel.',
};

export function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(ERROR_MESSAGES[params.get('error') ?? ''] ?? '');
  const [loading, setLoading] = useState(false);

  const next = params.get('next') ?? '/doctor';

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError('Credenciales incorrectas. Inténtalo de nuevo.');
      setLoading(false);
      return;
    }

    const me = await fetch('/api/auth/me', { cache: 'no-store' });
    if (me.status === 403) {
      await supabase.auth.signOut();
      setError(ERROR_MESSAGES.no_access);
      setLoading(false);
      return;
    }
    if (!me.ok) {
      setError('No se pudo verificar la sesión. Inténtalo de nuevo.');
      setLoading(false);
      return;
    }

    router.replace(next);
    router.refresh();
  }

  return (
    <div className="min-h-screen w-full bg-white flex items-center justify-center relative overflow-hidden font-sans antialiased">
      <div className="w-full max-w-[384px] p-10 bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-50 mx-4">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-6 text-blue-500">
            <LockIcon size={24} strokeWidth={2} />
          </div>
          <h1 className="text-[28px] font-semibold text-gray-900 tracking-tight">Mou</h1>
          <p className="text-[15px] text-gray-500 mt-2">Panel del doctor</p>
          {error && (
            <div className="mt-4 w-full bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <form className="space-y-4" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-[13px] font-medium text-gray-500 ml-1">
                Correo electrónico
              </label>
              <input
                type="email"
                id="email"
                autoComplete="username"
                placeholder="javi@mou.local"
                className="w-full h-11 px-4 bg-white border border-[#E5E5EA] rounded-[10px] text-[17px] text-gray-900 placeholder-[#C7C7CC] focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] focus:outline-none"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-[13px] font-medium text-gray-500 ml-1">
                Contraseña
              </label>
              <input
                type="password"
                id="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full h-11 px-4 bg-white border border-[#E5E5EA] rounded-[10px] text-[17px] text-gray-900 placeholder-[#C7C7CC] focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] focus:outline-none"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full h-11 bg-[#007AFF] hover:bg-[#0069D9] active:bg-[#005BB5] disabled:bg-blue-300 text-white text-[17px] font-semibold rounded-[10px] flex items-center justify-center"
            >
              {loading ? 'Iniciando…' : 'Iniciar sesión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
