import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET /api/insurances - Listar todas las mutuas
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    const { data: insurances, error } = await supabase
      .from('insurances')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json(insurances || [])
  } catch (error) {
    console.error('Error fetching insurances:', error)
    return NextResponse.json({ error: 'Failed to fetch insurances', details: String(error) }, { status: 500 })
  }
}
