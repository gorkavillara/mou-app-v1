import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase'

// GET /api/recordings - Listar grabaciones
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patientId')
    const doctorId = searchParams.get('doctorId')

    const recordings = await prisma.audioRecording.findMany({
      where: {
        ...(patientId && { patientId }),
        ...(doctorId && { doctorId }),
      },
      include: {
        patient: true,
        doctor: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(recordings)
  } catch (error) {
    console.error('Error fetching recordings:', error)
    return NextResponse.json({ error: 'Failed to fetch recordings' }, { status: 500 })
  }
}

// POST /api/recordings - Crear grabación (metadata, el archivo se sube separately)
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const doctor = await prisma.doctor.findFirst({
      where: { email: user.email! },
    })

    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }

    const body = await request.json()
    const { patientId, title, duration, audioUrl, sessionId } = body

    if (!patientId || !title || !duration || !audioUrl) {
      return NextResponse.json({ error: 'patientId, title, duration, and audioUrl are required' }, { status: 400 })
    }

    const recording = await prisma.audioRecording.create({
      data: {
        patientId,
        doctorId: doctor.id,
        title,
        duration,
        audioUrl,
        sessionId,
      },
    })

    return NextResponse.json(recording, { status: 201 })
  } catch (error) {
    console.error('Error creating recording:', error)
    return NextResponse.json({ error: 'Failed to create recording' }, { status: 500 })
  }
}

// DELETE /api/recordings - Eliminar grabación
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    await prisma.audioRecording.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Recording deleted' })
  } catch (error) {
    console.error('Error deleting recording:', error)
    return NextResponse.json({ error: 'Failed to delete recording' }, { status: 500 })
  }
}
