"use client"

import React, { useState } from 'react';
import { ArrowLeftIcon, MailIcon, CheckCircleIcon } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';

export default function ForgotPassword() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
    }
  };

  if (sent) {
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
              Revisa tu correo
            </h1>
            <p className="text-[15px] text-gray-500 mt-2 font-normal text-center">
              Hemos enviado un enlace de recuperación a <br />
              <span className="font-medium text-gray-700">{email}</span>
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <p className="text-[13px] text-gray-500">
              Revisa tu bandeja de entrada y sigue las instrucciones para crear una nueva contraseña.
            </p>
          </div>

          <div className="flex flex-col items-center space-y-3">
            <Link
              href="/login"
              className="text-[15px] text-[#007AFF] hover:underline font-medium">
              Volver a iniciar sesión
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
          Volver
        </Link>

        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-6 text-blue-500">
            <MailIcon size={24} strokeWidth={2} />
          </div>
          <h1 className="text-[28px] font-semibold text-gray-900 tracking-tight">
            ¿Olvidaste tu contraseña?
          </h1>
          <p className="text-[15px] text-gray-500 mt-2 font-normal text-center">
            Ingresa tu correo electrónico y te enviaremos un enlace para recuperar tu contraseña
          </p>
          {error && (
            <div className="mt-4 w-full bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <form className="space-y-4" onSubmit={handleResetRequest}>
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
                required
                className="w-full h-11 px-4 bg-white border border-[#E5E5EA] rounded-[10px] text-[17px] text-gray-900 placeholder-[#C7C7CC] focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] focus:outline-none transition-all duration-200 ease-in-out"
                value={email}
                onChange={e => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#007AFF] hover:bg-[#0069D9] active:bg-[#005BB5] disabled:bg-blue-300 text-white text-[17px] font-semibold rounded-[10px] transition-colors duration-200 flex items-center justify-center shadow-sm">
              {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
            </button>
          </div>
        </form>
      </div>

      <div className="absolute bottom-6 text-[11px] text-[#C7C7CC] font-medium">
        Recuperación de contraseña segura
      </div>
    </div>
  );
}
