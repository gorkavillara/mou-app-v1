'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageSquareIcon } from 'lucide-react';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { IFRMCard } from '@/components/dashboard/IFRMCard';
import { AdherenceChart } from '@/components/dashboard/AdherenceChart';
import { QualityChart } from '@/components/dashboard/QualityChart';
import { WeeklyProgress } from '@/components/dashboard/WeeklyProgress';
import { RecentExercises } from '@/components/dashboard/RecentExercises';
import { Suggestions } from '@/components/dashboard/Suggestions';
import { AppNav } from '@/components/AppNav';
import { createClient } from '@/lib/supabase';

const supabase = createClient();

interface Message {
  id: string;
  content: string;
  createdAt: string;
}

export default function Dashboard() {
  const [patient, setPatient] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMessages, setShowMessages] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.email) {
        setLoading(false);
        return;
      }

      type PatientRow = {
        id: string;
        name: string;
        email: string;
      };

      const { data: patientData } = await supabase
        .from('patients')
        .select('*')
        .eq('email', user.email)
        .single() as { data: PatientRow | null };

      if (!patientData) {
        setLoading(false);
        return;
      }

      setPatient(patientData);

      const { data: sessionsData } = await supabase
        .from('sessions')
        .select('*')
        .eq('patientId', patientData.id)
        .order('startedAt', { ascending: false })
        .limit(10);

      setSessions(sessionsData || []);

      setLoading(false);
    }

    fetchData();
  }, []);

  useEffect(() => {
    if (patient?.id && showMessages) {
      loadMessages();
    }
  }, [patient, showMessages]);

  const loadMessages = async () => {
    if (!patient?.id) return;
    const res = await fetch(`/api/messages?patientId=${patient.id}`);
    const data = await res.json();
    setMessages(data);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] pb-24 md:pb-8 md:pl-[220px] font-sans">
        <AppNav active="/dashboard" />
        <div className="flex items-center justify-center h-64 pt-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7] pb-24 md:pb-8 md:pl-[220px] font-sans">
      <AppNav active="/dashboard" />

      {/* Botón de Mensajes flotante */}
      <button
        onClick={() => setShowMessages(!showMessages)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-[#007AFF] rounded-full shadow-lg flex items-center justify-center text-white hover:bg-[#0069D9] transition-colors z-50"
      >
        <MessageSquareIcon size={24} />
      </button>

      {/* Panel de Mensajes */}
      {showMessages && (
        <div className="fixed bottom-24 right-6 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <h3 className="font-semibold text-gray-900">Mensajes de tu Doctor</h3>
          </div>
          <div className="h-64 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-8">No hay mensajes</p>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className="bg-gray-100 rounded-xl px-4 py-2">
                  <p className="text-sm text-gray-800">{msg.content}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(msg.createdAt).toLocaleDateString('es-ES')}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto">
        <div className="p-6 pt-12">
          <DashboardHeader name={patient?.name || 'Paciente'} />

          <IFRMCard />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="h-[240px]">
              <AdherenceChart />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="h-[240px]">
              <QualityChart />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8">
            <WeeklyProgress />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-8">
            <RecentExercises />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}>
            <Suggestions />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
