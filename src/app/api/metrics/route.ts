import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/metrics - Listar métricas de pacientes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patientId')

    const metrics = await prisma.patientMetric.findMany({
      where: {
        ...(patientId && { patientId }),
      },
      include: {
        patient: true,
      },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Error fetching metrics:', error)
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 })
  }
}

// POST /api/metrics - Crear registro de métricas
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { patientId, ifrm, adherence, painLevel, notes } = body

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 })
    }

    const metric = await prisma.patientMetric.create({
      data: {
        patientId,
        ifrm,
        adherence,
        painLevel,
        notes,
        date: new Date(),
      },
    })

    // Actualizar paciente con últimos valores
    const updateData: any = {}
    if (ifrm !== undefined) updateData.ifrm = ifrm
    if (adherence !== undefined) updateData.adherence = adherence
    if (painLevel !== undefined) updateData.painLevel = painLevel
    
    if (Object.keys(updateData).length > 0) {
      await prisma.patient.update({
        where: { id: patientId },
        data: updateData,
      })
    }

    return NextResponse.json(metric, { status: 201 })
  } catch (error) {
    console.error('Error creating metric:', error)
    return NextResponse.json({ error: 'Failed to create metric' }, { status: 500 })
  }
}
