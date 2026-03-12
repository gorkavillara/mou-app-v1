import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getConsentStatus } from '@/lib/consent'

async function checkConsent(patientId: string): Promise<boolean> {
  const status = await getConsentStatus(patientId)
  return status === 'ACTIVE'
}

// GET /api/sessions - Listar sesiones
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patientId')
    const status = searchParams.get('status')

    const sessions = await prisma.session.findMany({
      where: {
        ...(patientId && { patientId }),
        ...(status && { status: status as any }),
      },
      include: {
        patient: true,
        exercise: true,
        repData: true,
        fingerStatus: true,
      },
      orderBy: { startedAt: 'desc' },
    })

    return NextResponse.json(sessions)
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
  }
}

// POST /api/sessions - Iniciar sesión de ejercicio
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { patientId, exerciseId, targetReps, doctorId } = body

    if (!patientId || !exerciseId) {
      return NextResponse.json({ error: 'patientId and exerciseId are required' }, { status: 400 })
    }

    const hasConsent = await checkConsent(patientId)
    if (!hasConsent) {
      return NextResponse.json(
        { error: 'Consentimiento requerido', code: 'CONSENT_REQUIRED' },
        { status: 403 }
      )
    }

    const session = await prisma.session.create({
      data: {
        patientId,
        exerciseId,
        targetReps: targetReps || 10,
        doctorId,
        status: 'IN_PROGRESS',
      },
    })

    return NextResponse.json(session, { status: 201 })
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}

// PUT /api/sessions - Actualizar sesión (completar)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, rom, maxFlexion, maxExtension, repetitions, progress, repData, fingerStatus } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const session = await prisma.session.findUnique({
      where: { id },
      include: { patient: true },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const hasConsent = await checkConsent(session.patientId)
    if (!hasConsent) {
      return NextResponse.json(
        { error: 'Consentimiento requerido', code: 'CONSENT_REQUIRED' },
        { status: 403 }
      )
    }

    const updateData: any = {}
    if (status) updateData.status = status
    if (status === 'COMPLETED') {
      updateData.endedAt = new Date()
      if (rom !== undefined) updateData.rom = rom
      if (maxFlexion !== undefined) updateData.maxFlexion = maxFlexion
      if (maxExtension !== undefined) updateData.maxExtension = maxExtension
      if (repetitions !== undefined) updateData.repetitions = repetitions
      if (progress !== undefined) updateData.progress = progress
    }

    const updatedSession = await prisma.session.update({
      where: { id },
      data: updateData,
    })

    if (repData && repData.length > 0) {
      await prisma.repData.deleteMany({ where: { sessionId: id } })
      await prisma.repData.createMany({
        data: repData.map((rep: any) => ({
          sessionId: id,
          repNumber: rep.repNumber,
          maxFlexion: rep.maxFlexion,
          maxExtension: rep.maxExtension,
        })),
      })
    }

    if (fingerStatus && fingerStatus.length > 0) {
      await prisma.fingerStatus.deleteMany({ where: { sessionId: id } })
      await prisma.fingerStatus.createMany({
        data: fingerStatus.map((finger: any) => ({
          sessionId: id,
          fingerName: finger.fingerName,
          status: finger.status,
        })),
      })
    }

    return NextResponse.json(updatedSession)
  } catch (error) {
    console.error('Error updating session:', error)
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
  }
}
