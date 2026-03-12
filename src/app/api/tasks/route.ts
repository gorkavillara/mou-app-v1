import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase'

// GET /api/tasks - Listar tareas
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patientId')
    const doctorId = searchParams.get('doctorId')
    const status = searchParams.get('status')

    const tasks = await prisma.task.findMany({
      where: {
        ...(patientId && { patientId }),
        ...(doctorId && { doctorId }),
        ...(status && { status: status as any }),
      },
      include: {
        patient: true,
        doctor: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(tasks)
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

// POST /api/tasks - Crear tarea
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
    const { patientId, title, description, dueDate, priority } = body

    if (!patientId || !title) {
      return NextResponse.json({ error: 'patientId and title are required' }, { status: 400 })
    }

    const task = await prisma.task.create({
      data: {
        patientId,
        doctorId: doctor.id,
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: priority || 'MEDIUM',
        status: 'PENDING',
      },
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}

// PUT /api/tasks - Actualizar tarea
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, title, description, dueDate, priority } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const updateData: any = {}
    if (status) updateData.status = status
    if (title) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null
    if (priority) updateData.priority = priority

    if (status === 'COMPLETED') {
      updateData.completedAt = new Date()
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}
