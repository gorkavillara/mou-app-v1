import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase'

// GET /api/insurances/[id] - Obtener una mutua
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const insurance = await prisma.insurance.findUnique({
      where: { id },
      include: {
        doctors: {
          include: {
            doctor: true,
          },
        },
        patients: true,
      },
    })

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
    // Verificar autenticación
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = user.user_metadata?.role
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const insurance = await prisma.insurance.update({
      where: { id },
      data: body,
    })

    return NextResponse.json(insurance)
  } catch (error) {
    console.error('Error updating insurance:', error)
    return NextResponse.json({ error: 'Failed to update insurance' }, { status: 500 })
  }
}

// DELETE /api/insurances/[id] - Eliminar una mutua
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticación
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = user.user_metadata?.role
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const { id } = await params

    // Soft delete - marcar como inactiva
    const insurance = await prisma.insurance.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ message: 'Insurance deactivated', insurance })
  } catch (error) {
    console.error('Error deleting insurance:', error)
    return NextResponse.json({ error: 'Failed to delete insurance' }, { status: 500 })
  }
}
