import { NextRequest } from 'next/server';
import QRCode from 'qrcode';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { errorResponse } from '@/lib/api/errors';

/**
 * B-15 — GET /api/doctor/patients/:id/qr.png
 *
 * Returns a PNG QR code that encodes the patient's public access URL
 * (`/p/<access_token>`). Designed to be embedded in an `<img>` or printed.
 *
 * Auth: middleware already gates `/api/doctor/*` (401/403). RLS filters by
 * `doctor_id = auth.uid()`, so a 404 here means "not visible to this doctor".
 *
 * Public URL precedence:
 *   1. NEXT_PUBLIC_APP_URL env (when behind a reverse proxy, prod, etc.)
 *   2. request.nextUrl.origin (dev / localhost fallback)
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const supabase = await createSupabaseServerClient();

  const { data: patient, error } = await supabase
    .from('patients')
    .select('access_token')
    .eq('id', id)
    .maybeSingle();

  if (error) return errorResponse('db_error', 500, error.message);
  if (!patient) return errorResponse('not_found', 404);

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') ??
    request.nextUrl.origin;
  const url = `${baseUrl}/p/${patient.access_token}`;

  const buffer = await QRCode.toBuffer(url, {
    errorCorrectionLevel: 'M',
    margin: 2,
    scale: 8,
    type: 'png',
  });

  // Convert Buffer to Uint8Array for the Web Response API.
  const body = new Uint8Array(buffer);

  return new Response(body, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'private, max-age=300, stale-while-revalidate=60',
    },
  });
}
