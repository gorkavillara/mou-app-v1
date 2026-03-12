import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createSupabaseServerClient()

  // Verificar que es admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Buscar si es admin
  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('email', user.email)
    .single()

  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Obtener estadísticas
  const [doctors, patients, insurances, sessions] = await Promise.all([
    supabase.from('doctors').select('id', { count: 'exact', head: true }),
    supabase.from('patients').select('id', { count: 'exact', head: true }),
    supabase.from('insurances').select('id', { count: 'exact', head: true }),
    supabase.from('sessions').select('id', { count: 'exact', head: true })
  ])

  return NextResponse.json({
    totalDoctors: doctors.count || 0,
    totalPatients: patients.count || 0,
    totalInsurances: insurances.count || 0,
    totalSessions: sessions.count || 0
  })
}
