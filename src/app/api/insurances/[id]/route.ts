import { NextRequest, NextResponse } from 'next/server'

// GET /api/insurances/[id] - Obtener una mutua por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const response = await fetch(
      `${supabaseUrl}/rest/v1/insurances?id=eq.${id}`,
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
      return NextResponse.json({ error: 'Failed to fetch', details: text }, { status: 500 })
    }

    const data = await response.json()
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Insurance not found' }, { status: 404 })
    }

    return NextResponse.json(data[0])
  } catch (error) {
    console.error('Error fetching insurance:', error)
    return NextResponse.json({ error: 'Failed to fetch insurance' }, { status: 500 })
  }
}

// PUT /api/insurances/[id] - Actualizar una mutua
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const body = await request.json()
    
    // Quitar campos que no existen en la tabla
    delete body.id
    delete body.createdAt
    
    const response = await fetch(
      `${supabaseUrl}/rest/v1/insurances?id=eq.${id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify(body)
      }
    )

    if (!response.ok) {
      const text = await response.text()
      return NextResponse.json({ error: 'Failed to update', details: text }, { status: 500 })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating insurance:', error)
    return NextResponse.json({ error: 'Failed to update insurance' }, { status: 500 })
  }
}

// DELETE /api/insurances/[id] - Eliminar (soft delete) una mutua
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const response = await fetch(
      `${supabaseUrl}/rest/v1/insurances?id=eq.${id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({ isActive: false })
      }
    )

    if (!response.ok) {
      const text = await response.text()
      return NextResponse.json({ error: 'Failed to delete', details: text }, { status: 500 })
    }

    return NextResponse.json({ message: 'Insurance deactivated' })
  } catch (error) {
    console.error('Error deleting insurance:', error)
    return NextResponse.json({ error: 'Failed to delete insurance' }, { status: 500 })
  }
}
