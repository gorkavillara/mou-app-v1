import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase'

// GET /api/doctors - Listar médicos
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const insuranceId = searchParams.get('insuranceId')
    const isActive = searchParams.get('isActive')

    const doctors = await prisma.doctor.findMany({
      where: {
        isActive: isActive !== null ? isActive === 'true' : undefined,
        ...(insuranceId && {
          insurances: {
            some: {
              insuranceId,
            },
          },
        }),
      },
      include: {
        insurances: {
          include: {
            insurance: true,
          },
        },
      },
    })

    return NextResponse.json(doctors)
  } catch (error) {
    console.error('Error fetching doctors:', error)
    return NextResponse.json({ error: 'Failed to fetch doctors' }, { status: 500 })
  }
}

// POST /api/doctors - Crear médico (Admin o Mutua)
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = user.user_metadata?.role
    if (userRole !== 'admin' && userRole !== 'mutua') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { email, name, specialization, licenseNumber, phone, insuranceId } = body

    if (!email || !name) {
      return NextResponse.json({ error: 'Email and name are required' }, { status: 400 })
    }

    // Crear médico
    const doctor = await prisma.doctor.create({
      data: {
        email,
        name,
        specialization,
        licenseNumber,
        phone,
        isActive: true,
        ...(insuranceId && {
          insurances: {
            create: {
              insuranceId,
              role: 'DOCTOR',
            },
          },
        }),
      },
    })

    return NextResponse.json(doctor, { status: 201 })
  } catch (error) {
    console.error('Error creating doctor:', error)
    return NextResponse.json({ error: 'Failed to create doctor' }, { status: 500 })
  }
}
