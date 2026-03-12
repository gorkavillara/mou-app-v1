"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon, PlusIcon, TrashIcon, UserIcon } from 'lucide-react'

type UserRole = 'doctor' | 'patient' | 'mutua'

interface User {
  id: string
  email: string
  name: string
  role: UserRole
  createdAt: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'patient' as UserRole,
    specialization: '',
    phone: '',
    insuranceId: ''
  })
  const [insurances, setInsurances] = useState<{id: string, name: string}[]>([])
  const [doctors, setDoctors] = useState<{id: string, name: string}[]>([])

  useEffect(() => {
    loadUsers()
    loadInsurances()
    loadDoctors()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      setUsers(data)
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadInsurances = async () => {
    const res = await fetch('/api/insurances')
    const data = await res.json()
    setInsurances(data)
  }

  const loadDoctors = async () => {
    const res = await fetch('/api/doctors')
    const data = await res.json()
    setDoctors(data)
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })

    if (res.ok) {
      setShowModal(false)
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'patient',
        specialization: '',
        phone: '',
        insuranceId: ''
      })
      loadUsers()
    } else {
      alert('Error al crear usuario')
    }
  }

  const handleDeleteUser = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return
    
    const res = await fetch(`/api/admin/users?id=${id}`, {
      method: 'DELETE'
    })

    if (res.ok) {
      loadUsers()
    }
  }

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'doctor': return 'Doctor'
      case 'patient': return 'Paciente'
      case 'mutua': return 'Mutua'
    }
  }

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'doctor': return 'bg-green-100 text-green-700'
      case 'patient': return 'bg-blue-100 text-blue-700'
      case 'mutua': return 'bg-purple-100 text-purple-700'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-500 hover:text-gray-700">
              <ArrowLeftIcon size={20} />
            </Link>
            <h1 className="text-xl font-semibold text-gray-900">
              Gestión de Usuarios
            </h1>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#007AFF] text-white rounded-lg hover:bg-[#0069D9] transition-colors"
          >
            <PlusIcon size={18} />
            Nuevo Usuario
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Cargando...</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Usuario</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Rol</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Email</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Creado</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <UserIcon size={16} className="text-gray-500" />
                        </div>
                        <span className="font-medium text-gray-900">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{user.email}</td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {new Date(user.createdAt).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <TrashIcon size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No hay usuarios. Crea uno nuevo.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de creación */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Crear Nuevo Usuario
            </h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña
                </label>
                <input
                  type="password"
                  required
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rol
                </label>
                <select
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                >
                  <option value="patient">Paciente</option>
                  <option value="doctor">Doctor</option>
                  <option value="mutua">Mutua</option>
                </select>
              </div>

              {formData.role === 'doctor' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Especialidad
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={formData.specialization}
                    onChange={e => setFormData({...formData, specialization: e.target.value})}
                  />
                </div>
              )}

              {formData.role === 'patient' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      required
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mutua
                    </label>
                    <select
                      required
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                      value={formData.insuranceId}
                      onChange={e => setFormData({...formData, insuranceId: e.target.value})}
                    >
                      <option value="">Seleccionar mutua</option>
                      {insurances.map(i => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#007AFF] text-white rounded-lg hover:bg-[#0069D9]"
                >
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
