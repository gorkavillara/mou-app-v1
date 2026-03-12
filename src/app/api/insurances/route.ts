import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase'

// GET /api/insurances - Listar todas las mutuas
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('isActive')

    const insurances = await prisma.insurance.findMany({
      where: isActive !== null ? { isActive: isActive === 'true' } : {},
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(insurances)
  } catch (error) {
    console.error('Error fetching insurances:', error)
    return NextResponse.json({ error: 'Failed to fetch insurances' }, { status: 500 })
  }
}

// POST /api/insurances - Crear una mutua (solo Admin)
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verificar rol de admin
    const userRole = user.user_metadata?.role
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const { name, slug, logo, contactEmail, phone, address } = body

    // Validaciones
    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 })
    }

    // Verificar que el slug sea único
    const existing = await prisma.insurance.findUnique({
      where: { slug },
    })

    if (existing) {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 })
    }

    // Obtener el adminId del usuario autenticado
    const admin = await prisma.admin.findUnique({
      where: { email: user.email! },
    })

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    // Crear la mutua
    const insurance = await prisma.insurance.create({
      data: {
        name,
        slug,
        logo,
        contactEmail,
        phone,
        address,
        adminId: admin.id,
      },
    })

    return NextResponse.json(insurance, { status: 201 })
  } catch (error) {
    console.error('Error creating insurance:', error)
    return NextResponse.json({ error: 'Failed to create insurance' }, { status: 500 })
  }
}
