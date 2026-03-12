import { NextResponse } from 'next/server';
import { getMutuaPatientProgress, validateApiKey } from '@/lib/doctor-api';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateApiKey(request.headers)) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'API key inválida' },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const progress = getMutuaPatientProgress(id);

    if (!progress) {
      return NextResponse.json(
        { error: 'Not Found', message: `Paciente ${id} no encontrado` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: progress,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Error al obtener progreso' },
      { status: 500 }
    );
  }
}
