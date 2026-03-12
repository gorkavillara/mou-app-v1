"use client"

import React, { useState } from 'react';
import { LockIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';

export function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      setError('Credenciales incorrectas. Inténtalo de nuevo.');
      setLoading(false);
      return;
    }

    // Obtener el perfil del usuario para determinar el rol
    const res = await fetch('/api/auth/role')
    const profile = await res.json()

    // Redirigir según el rol
    const redirectPath = profile?.role === 'admin' ? '/admin'
      : profile?.role === 'doctor' ? '/doctor'
      : profile?.role === 'mutua' ? '/mutua'
      : '/dashboard';

    router.push(redirectPath);
    router.refresh();
  };

  return (
    <div className="min-h-screen w-full bg-white flex items-center justify-center relative overflow-hidden font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Background Watermark */}
      <div
        className="absolute bottom-[-5%] right-[-5%] text-[400px] opacity-[0.03] select-none pointer-events-none transform rotate-12"
        aria-hidden="true">
        👋
      </div>

      {/* Main Card Container */}
      <div className="w-full max-w-[384px] p-10 bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-50 relative z-10 mx-4">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-6 text-blue-500">
            <LockIcon size={24} strokeWidth={2} />
          </div>
          <h1 className="text-[28px] font-semibold text-gray-900 tracking-tight">
            Bienvenido
          </h1>
          <p className="text-[15px] text-gray-500 mt-2 font-normal">
            Inicia sesión para continuar
          </p>
          {error && (
            <div className="mt-4 w-full bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <form className="space-y-4" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-[13px] font-medium text-gray-500 ml-1">
                Correo electrónico
              </label>
              <input
                type="email"
                id="email"
                placeholder="correo@ejemplo.com"
                className="w-full h-11 px-4 bg-white border border-[#E5E5EA] rounded-[10px] text-[17px] text-gray-900 placeholder-[#C7C7CC] focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] focus:outline-none transition-all duration-200 ease-in-out"
                value={email}
                onChange={e => setEmail(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-[13px] font-medium text-gray-500 ml-1">
                Contraseña
              </label>
              <input
                type="password"
                id="password"
                placeholder="••••••••"
                className="w-full h-11 px-4 bg-white border border-[#E5E5EA] rounded-[10px] text-[17px] text-gray-900 placeholder-[#C7C7CC] focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] focus:outline-none transition-all duration-200 ease-in-out"
                value={password}
                onChange={e => setPassword(e.target.value)} />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#007AFF] hover:bg-[#0069D9] active:bg-[#005BB5] disabled:bg-blue-300 text-white text-[17px] font-semibold rounded-[10px] transition-colors duration-200 flex items-center justify-center shadow-sm">
              {loading ? 'Iniciando...' : 'Iniciar Sesión'}
            </button>
          </div>

          <div className="flex flex-col items-center space-y-3 pt-2">
            <Link
              href="/forgot-password"
              className="text-[13px] text-[#8E8E93] hover:text-[#007AFF] transition-colors font-normal">
              ¿Olvidaste tu contraseña?
            </Link>
            <a
              href="#"
              className="text-[13px] text-[#8E8E93] hover:text-[#007AFF] transition-colors font-normal">
              Crear cuenta
            </a>
          </div>
        </form>
      </div>

      <div className="absolute bottom-6 text-[11px] text-[#C7C7CC] font-medium">
        Inicio de sesión seguro estilo iOS
      </div>
    </div>
  );
}
