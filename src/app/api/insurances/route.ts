import { NextResponse } from 'next/server'

// GET /api/insurances - Listar todas las mutuas
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const response = await fetch(
      `${supabaseUrl}/rest/v1/insurances?select=*&order=createdAt.desc`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    )

    if (!response.ok) {
      const text = await response.text()
      console.error('API Error:', response.status, text)
      return NextResponse.json({ 
        error: 'Failed to fetch', 
        status: response.status,
        details: text 
      }, { status: 500 })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching insurances:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch insurances', 
      details: String(error) 
    }, { status: 500 })
  }
}
