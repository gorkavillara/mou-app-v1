import { NextResponse } from 'next/server';
import { getMutuaPatients, validateApiKey } from '@/lib/doctor-api';

export async function GET(request: Request) {
  if (!validateApiKey(request.headers)) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'API key inválida' },
      { status: 401 }
    );
  }

  try {
    const patients = getMutuaPatients();
    return NextResponse.json({
      success: true,
      data: patients,
      meta: {
        total: patients.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Error al obtener pacientes' },
      { status: 500 }
    );
  }
}
