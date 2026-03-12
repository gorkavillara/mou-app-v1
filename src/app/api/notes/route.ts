import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase'

// GET /api/notes - Listar notas
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patientId')
    const doctorId = searchParams.get('doctorId')

    const notes = await prisma.sessionNote.findMany({
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

    return NextResponse.json(notes)
  } catch (error) {
    console.error('Error fetching notes:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}

// POST /api/notes - Crear nota
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // El doctor debe existir en nuestra BD
    const doctor = await prisma.doctor.findFirst({
      where: { email: user.email! },
    })

    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }

    const body = await request.json()
    const { patientId, content, isPrivate, sessionId } = body

    if (!patientId || !content) {
      return NextResponse.json({ error: 'patientId and content are required' }, { status: 400 })
    }

    const note = await prisma.sessionNote.create({
      data: {
        patientId,
        doctorId: doctor.id,
        content,
        isPrivate: isPrivate ?? true,
        sessionId,
      },
    })

    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    console.error('Error creating note:', error)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }
}

// PUT /api/notes - Actualizar nota
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, content, isPrivate } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const note = await prisma.sessionNote.update({
      where: { id },
      data: {
        ...(content && { content }),
        ...(isPrivate !== undefined && { isPrivate }),
      },
    })

    return NextResponse.json(note)
  } catch (error) {
    console.error('Error updating note:', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}
