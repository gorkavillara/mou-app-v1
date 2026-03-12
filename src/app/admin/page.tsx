'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { 
  UsersIcon, 
  StethoscopeIcon, 
  Building2Icon, 
  ActivityIcon,
  DatabaseIcon,
  ArrowRightIcon,
  SunIcon,
  MoonIcon
} from 'lucide-react'

interface Stats {
  totalDoctors: number
  totalPatients: number
  totalInsurances: number
  totalSessions: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalDoctors: 0,
    totalPatients: 0,
    totalInsurances: 0,
    totalSessions: 0
  })
  const [loading, setLoading] = useState(true)
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    // Load dark mode preference
    const saved = localStorage.getItem('adminDarkMode')
    if (saved === 'true') {
      setDarkMode(true)
      document.documentElement.classList.add('dark')
    }
    loadStats()
  }, [])

  const toggleDarkMode = () => {
    const newMode = !darkMode
    setDarkMode(newMode)
    localStorage.setItem('adminDarkMode', String(newMode))
    if (newMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const loadStats = async () => {
    try {
      const res = await fetch('/api/admin/stats')
      const data = await res.json()
      setStats(data)
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const isDark = darkMode

  const menuItems = [
    {
      title: 'Gestión de Usuarios',
      description: 'Crear, editar y eliminar usuarios',
      href: '/admin/users',
      icon: UsersIcon,
      color: 'bg-blue-50 text-blue-500'
    },
    {
      title: 'Doctores',
      description: 'Administrar doctores y especialidades',
      href: '/admin/doctors',
      icon: StethoscopeIcon,
      color: 'bg-green-50 text-green-500'
    },
    {
      title: 'Mutuas',
      description: 'Gestionar aseguradoras',
      href: '/admin/insurances',
      icon: Building2Icon,
      color: 'bg-purple-50 text-purple-500'
    },
    {
      title: 'Seed de Demo',
      description: 'Generar datos ficticios para pruebas',
      href: '/admin/seed',
      icon: DatabaseIcon,
      color: 'bg-orange-50 text-orange-500'
    }
  ]

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <header className={`border-b px-6 py-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Panel de Administrador
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg ${isDark ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} transition-colors`}
            >
              {isDark ? <SunIcon size={20} /> : <MoonIcon size={20} />}
            </button>
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Administrador</span>
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
              A
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className={`rounded-xl p-6 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
                <StethoscopeIcon size={24} />
              </div>
              <div>
                <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.totalDoctors}</p>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Doctores</p>
              </div>
            </div>
          </div>

          <div className={`rounded-xl p-6 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-500">
                <UsersIcon size={24} />
              </div>
              <div>
                <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.totalPatients}</p>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Pacientes</p>
              </div>
            </div>
          </div>

          <div className={`rounded-xl p-6 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-500">
                <Building2Icon size={24} />
              </div>
              <div>
                <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.totalInsurances}</p>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Mutuas</p>
              </div>
            </div>
          </div>

          <div className={`rounded-xl p-6 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500">
                <ActivityIcon size={24} />
              </div>
              <div>
                <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.totalSessions}</p>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Sesiones</p>
              </div>
            </div>
          </div>
        </div>

        {/* Menu */}
        <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Administración</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-xl p-6 border hover:shadow-sm transition-all group ${isDark ? 'bg-gray-800 border-gray-700 hover:border-gray-600' : 'bg-white border-gray-100 hover:border-gray-200'}`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${item.color}`}>
                  <item.icon size={24} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.title}</h3>
                    <ArrowRightIcon size={20} className={isDark ? 'text-gray-500' : 'text-gray-300'} />
                  </div>
                  <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
