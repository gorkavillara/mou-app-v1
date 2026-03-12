import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase'

// GET /api/patients - Listar pacientes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const insuranceId = searchParams.get('insuranceId')
    const doctorId = searchParams.get('doctorId')

    const patients = await prisma.patient.findMany({
      where: {
        ...(insuranceId && { insuranceId }),
        ...(doctorId && {
          assignments: {
            some: { doctorId },
          },
        }),
      },
      include: {
        insurance: true,
        assignments: {
          include: {
            doctor: true,
          },
        },
      },
    })

    return NextResponse.json(patients)
  } catch (error) {
    console.error('Error fetching patients:', error)
    return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 })
  }
}

// POST /api/patients - Crear paciente (Admin o Mutua)
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
    const { name, email, phone, insuranceId, diagnosis, birthDate, injuryDate } = body

    if (!name || !phone || !insuranceId) {
      return NextResponse.json({ error: 'Name, phone, and insuranceId are required' }, { status: 400 })
    }

    const patient = await prisma.patient.create({
      data: {
        name,
        email,
        phone,
        insuranceId,
        diagnosis,
        birthDate: birthDate ? new Date(birthDate) : null,
        injuryDate: injuryDate ? new Date(injuryDate) : null,
        isActive: true,
      },
    })

    return NextResponse.json(patient, { status: 201 })
  } catch (error) {
    console.error('Error creating patient:', error)
    return NextResponse.json({ error: 'Failed to create patient' }, { status: 500 })
  }
}
