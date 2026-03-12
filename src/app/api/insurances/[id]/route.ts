import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// GET /api/insurances/[id] - Obtener una mutua por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createSupabaseServerClient()

    const { data: insurance, error } = await supabase
      .from('insurances')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!insurance) {
      return NextResponse.json({ error: 'Insurance not found' }, { status: 404 })
    }

    return NextResponse.json(insurance)
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
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const { data: insurance, error } = await supabase
      .from('insurances')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(insurance)
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
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const { data: insurance, error } = await supabase
      .from('insurances')
      .update({ isActive: false })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ message: 'Insurance deactivated', insurance })
  } catch (error) {
    console.error('Error deleting insurance:', error)
    return NextResponse.json({ error: 'Failed to delete insurance' }, { status: 500 })
  }
}
