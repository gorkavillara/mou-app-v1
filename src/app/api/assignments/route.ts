import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase'

// GET /api/assignments - Listar asignaciones
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const doctorId = searchParams.get('doctorId')
    const patientId = searchParams.get('patientId')
    const insuranceId = searchParams.get('insuranceId')

    const assignments = await prisma.patientAssignment.findMany({
      where: {
        ...(doctorId && { doctorId }),
        ...(patientId && { patientId }),
        ...(insuranceId && { insuranceId }),
      },
      include: {
        patient: true,
        doctor: true,
      },
    })

    return NextResponse.json(assignments)
  } catch (error) {
    console.error('Error fetching assignments:', error)
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })
  }
}

// POST /api/assignments - Asignar paciente a médico
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
    const { patientId, doctorId, insuranceId, notes } = body

    if (!patientId || !doctorId || !insuranceId) {
      return NextResponse.json({ error: 'patientId, doctorId, and insuranceId are required' }, { status: 400 })
    }

    // Verificar que el paciente pertenece a la mutua
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, insuranceId },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient does not belong to this insurance' }, { status: 400 })
    }

    // Crear asignación
    const assignment = await prisma.patientAssignment.create({
      data: {
        patientId,
        doctorId,
        insuranceId,
        notes,
        status: 'ACTIVE',
      },
    })

    return NextResponse.json(assignment, { status: 201 })
  } catch (error) {
    console.error('Error creating assignment:', error)
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 })
  }
}

// PUT /api/assignments - Actualizar estado de asignación
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { patientId, doctorId, insuranceId, status, notes } = body

    if (!patientId || !doctorId || !insuranceId) {
      return NextResponse.json({ error: 'patientId, doctorId, and insuranceId are required' }, { status: 400 })
    }

    const assignment = await prisma.patientAssignment.update({
      where: {
        patientId_doctorId_insuranceId: {
          patientId,
          doctorId,
          insuranceId,
        },
      },
      data: {
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
      },
    })

    return NextResponse.json(assignment)
  } catch (error) {
    console.error('Error updating assignment:', error)
    return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 })
  }
}
