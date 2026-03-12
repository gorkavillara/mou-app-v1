"use client"

import React, { useState, useEffect } from 'react';
import { LockIcon, EyeIcon, EyeOffIcon, CheckCircleIcon, ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function ResetPassword() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [validating, setValidating] = useState(true);

  useEffect(() => {
    // Verificar que el usuario viene de un enlace válido de recuperación
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // No hay sesión válida, redirigir a forgot-password
        router.push('/forgot-password');
      } else {
        setValidating(false);
      }
    };
    checkSession();
  }, [supabase, router]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      
      // Redirigir al dashboard directamente (el usuario ya está autenticado)
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen w-full bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#007AFF]"></div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen w-full bg-white flex items-center justify-center relative overflow-hidden font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
        <div className="absolute bottom-[-5%] right-[-5%] text-[400px] opacity-[0.03] select-none pointer-events-none transform rotate-12">
          👋
        </div>

        <div className="w-full max-w-[384px] p-10 bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-50 relative z-10 mx-4">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-6 text-green-500">
              <CheckCircleIcon size={32} strokeWidth={2} />
            </div>
            <h1 className="text-[28px] font-semibold text-gray-900 tracking-tight">
              Contraseña actualizada
            </h1>
            <p className="text-[15px] text-gray-500 mt-2 font-normal text-center">
              Tu contraseña ha sido cambiada correctamente
            </p>
          </div>

          <div className="bg-green-50 rounded-xl p-4 mb-6">
            <p className="text-[13px] text-green-700">
              Serás redirigido a tu dashboard...
            </p>
          </div>

          <div className="flex flex-col items-center">
            <Link
              href="/login"
              className="text-[15px] text-[#007AFF] hover:underline font-medium">
              Ir ahora
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-white flex items-center justify-center relative overflow-hidden font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      <div className="absolute bottom-[-5%] right-[-5%] text-[400px] opacity-[0.03] select-none pointer-events-none transform rotate-12">
        👋
      </div>

      <div className="w-full max-w-[384px] p-10 bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-50 relative z-10 mx-4">
        <Link
          href="/login"
          className="flex items-center gap-2 text-[13px] text-[#8E8E93] hover:text-[#007AFF] transition-colors mb-6">
          <ArrowLeftIcon size={16} />
          Cancelar
        </Link>

        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-6 text-blue-500">
            <LockIcon size={24} strokeWidth={2} />
          </div>
          <h1 className="text-[28px] font-semibold text-gray-900 tracking-tight">
            Nueva contraseña
          </h1>
          <p className="text-[15px] text-gray-500 mt-2 font-normal text-center">
            Ingresa tu nueva contraseña para recuperar el acceso a tu cuenta
          </p>
          {error && (
            <div className="mt-4 w-full bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <form className="space-y-4" onSubmit={handlePasswordReset}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-[13px] font-medium text-gray-500 ml-1">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full h-11 px-4 pr-12 bg-white border border-[#E5E5EA] rounded-[10px] text-[17px] text-gray-900 placeholder-[#C7C7CC] focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] focus:outline-none transition-all duration-200 ease-in-out"
                  value={password}
                  onChange={e => setPassword(e.target.value)} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="confirmPassword"
                className="block text-[13px] font-medium text-gray-500 ml-1">
                Confirmar contraseña
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                id="confirmPassword"
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full h-11 px-4 bg-white border border-[#E5E5EA] rounded-[10px] text-[17px] text-gray-900 placeholder-[#C7C7CC] focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] focus:outline-none transition-all duration-200 ease-in-out"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)} />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#007AFF] hover:bg-[#0069D9] active:bg-[#005BB5] disabled:bg-blue-300 text-white text-[17px] font-semibold rounded-[10px] transition-colors duration-200 flex items-center justify-center shadow-sm">
              {loading ? 'Actualizando...' : 'Cambiar contraseña'}
            </button>
          </div>
        </form>
      </div>

      <div className="absolute bottom-6 text-[11px] text-[#C7C7CC] font-medium">
        Restablecimiento de contraseña seguro
      </div>
    </div>
  );
}
