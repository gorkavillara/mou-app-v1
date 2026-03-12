'use client';

import React, { useEffect, useState } from 'react';
import { Users, Activity, TrendingUp, BarChart3, MessageSquareIcon, MicIcon, PlusIcon, SendIcon } from 'lucide-react';
import Link from 'next/link';

interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
  diagnosis: string;
  ifrm: number;
  adherence: number;
  status: string;
  insuranceId: string;
}

interface Message {
  id: string;
  patientId: string;
  doctorId: string;
  content: string;
  isFromDoctor: boolean;
  createdAt: string;
}

export default function DoctorDashboard() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showMessages, setShowMessages] = useState(false);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      const res = await fetch('/api/doctor/patients');
      const data = await res.json();
      setPatients(data);
    } catch (error) {
      console.error('Error loading patients:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (patientId: string) => {
    try {
      const res = await fetch(`/api/messages?patientId=${patientId}`);
      const data = await res.json();
      setMessages(data);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedPatient) return;

    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: selectedPatient.id,
        content: newMessage
      })
    });

    if (res.ok) {
      setNewMessage('');
      loadMessages(selectedPatient.id);
    }
  };

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    loadMessages(patient.id);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'bg-red-100 text-red-700';
      case 'warning': return 'bg-orange-100 text-orange-700';
      default: return 'bg-green-100 text-green-700';
    }
  };

  const avgAdherence = patients.length > 0
    ? Math.round(patients.reduce((sum, p) => sum + (p.adherence || 0), 0) / patients.length * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">
            Panel de Doctor
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNewPatient(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#007AFF] text-white rounded-lg hover:bg-[#0069D9]"
            >
              <PlusIcon size={18} />
              Nuevo Paciente
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
                <Users size={24} />
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">{patients.length}</p>
                <p className="text-sm text-gray-500">Pacientes</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-500">
                <Activity size={24} />
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">
                  {patients.filter(p => (p.adherence || 0) > 0.5).length}
                </p>
                <p className="text-sm text-gray-500">Activos</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-500">
                <TrendingUp size={24} />
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">{avgAdherence}%</p>
                <p className="text-sm text-gray-500">Adherencia</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500">
                <BarChart3 size={24} />
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">
                  {patients.length > 0 ? Math.round(patients.reduce((sum, p) => sum + (p.ifrm || 0), 0) / patients.length) : 0}
                </p>
                <p className="text-sm text-gray-500">IFRM Medio</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de Pacientes */}
          <div className="lg:col-span-1 bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Mis Pacientes</h2>
            </div>
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500">Cargando...</div>
              ) : patients.length === 0 ? (
                <div className="p-4 text-center text-gray-500">No hay pacientes asignados</div>
              ) : (
                patients.map(patient => (
                  <button
                    key={patient.id}
                    onClick={() => handlePatientSelect(patient)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${selectedPatient?.id === patient.id ? 'bg-blue-50' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{patient.name}</p>
                        <p className="text-sm text-gray-500">{patient.diagnosis || 'Sin diagnóstico'}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(patient.status)}`}>
                          {patient.ifrm || 0}%
                        </span>
                        <p className="text-xs text-gray-400 mt-1">{Math.round((patient.adherence || 0) * 100)}% ad.</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Panel de Detalles */}
          <div className="lg:col-span-2">
            {selectedPatient ? (
              <div className="bg-white rounded-xl border border-gray-100">
                {/* Header del paciente */}
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">{selectedPatient.name}</h2>
                      <p className="text-gray-500">{selectedPatient.diagnosis}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowMessages(!showMessages)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${showMessages ? 'bg-[#007AFF] text-white border-[#007AFF]' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                      >
                        <MessageSquareIcon size={18} />
                        Mensajes
                      </button>
                      <Link
                        href={`/doctor/session?patientId=${selectedPatient.id}`}
                        className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                      >
                        <MicIcon size={18} />
                        Nueva Sesión
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Métricas */}
                <div className="p-6 grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500">IFRM</p>
                    <p className="text-2xl font-semibold text-gray-900">{selectedPatient.ifrm || 0}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500">Adherencia</p>
                    <p className="text-2xl font-semibold text-gray-900">{Math.round((selectedPatient.adherence || 0) * 100)}%</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500">Teléfono</p>
                    <p className="text-lg font-semibold text-gray-900">{selectedPatient.phone}</p>
                  </div>
                </div>

                {/* Mensajes */}
                {showMessages && (
                  <div className="border-t border-gray-100">
                    <div className="p-4 h-64 overflow-y-auto space-y-3">
                      {messages.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">No hay mensajes</p>
                      ) : (
                        messages.map(msg => (
                          <div key={msg.id} className={`flex ${msg.isFromDoctor ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[70%] rounded-xl px-4 py-2 ${msg.isFromDoctor ? 'bg-[#007AFF] text-white' : 'bg-gray-100 text-gray-900'}`}>
                              <p className="text-sm">{msg.content}</p>
                              <p className={`text-xs mt-1 ${msg.isFromDoctor ? 'text-blue-200' : 'text-gray-400'}`}>
                                {new Date(msg.createdAt).toLocaleString('es-ES')}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="p-4 border-t border-gray-100 flex gap-2">
                      <input
                        type="text"
                        placeholder="Escribir mensaje..."
                        className="flex-1 px-4 py-2 border border-gray-200 rounded-lg"
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && sendMessage()}
                      />
                      <button
                        onClick={sendMessage}
                        className="px-4 py-2 bg-[#007AFF] text-white rounded-lg hover:bg-[#0069D9]"
                      >
                        <SendIcon size={18} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                <Users size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Selecciona un paciente para ver sus detalles</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Nuevo Paciente */}
      {showNewPatient && (
        <NewPatientModal onClose={() => setShowNewPatient(false)} onSuccess={loadPatients} />
      )}
    </div>
  );
}

function NewPatientModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    diagnosis: ''
  });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    const res = await fetch('/api/doctor/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (res.ok) {
      onSuccess();
      onClose();
    } else {
      alert('Error al crear paciente');
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Nuevo Paciente</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 border border-gray-200 rounded-lg"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              className="w-full px-4 py-2 border border-gray-200 rounded-lg"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input
              type="tel"
              required
              className="w-full px-4 py-2 border border-gray-200 rounded-lg"
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Diagnóstico</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg"
              value={formData.diagnosis}
              onChange={e => setFormData({...formData, diagnosis: e.target.value})}
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={sending}
              className="flex-1 px-4 py-2 bg-[#007AFF] text-white rounded-lg hover:bg-[#0069D9] disabled:opacity-50"
            >
              {sending ? 'Enviando...' : 'Crear y Enviar Invitación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
