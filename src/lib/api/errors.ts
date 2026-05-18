import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Shared JSON error helpers. Format: { error: 'kind', message?: '...' }.
 * Never echo arbitrary user input into the message — keep it short and stable.
 */
export function errorResponse(
  kind: string,
  status: number,
  message?: string,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    { error: kind, ...(message ? { message } : {}), ...(extra ?? {}) },
    { status },
  );
}

/**
 * Convert a ZodError into a 400 response.
 * Zod 4 exposes `.issues` (array). We surface field paths only — never values.
 */
export function zodErrorResponse(err: ZodError) {
  const issues = err.issues.map((i) => ({
    path: i.path.join('.'),
    code: i.code,
    message: i.message,
  }));
  return NextResponse.json(
    { error: 'invalid_body', message: 'Validation failed', issues },
    { status: 400 },
  );
}
