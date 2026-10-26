import { describe, it, expect } from 'vitest';
import { patchPatientSchema } from '@/lib/validation/patients';

/**
 * GORA-12 — the doctor can edit `pathology_code` from the patient detail.
 * Same enum as the DB CHECK (flexor | extensor | otros); `null` clears it.
 */
describe('patchPatientSchema — pathology_code (GORA-12)', () => {
  it.each(['flexor', 'extensor', 'otros'] as const)('accepts %s', (code) => {
    const parsed = patchPatientSchema.safeParse({ pathology_code: code });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ pathology_code: code });
  });

  it('accepts null (clears the pathology)', () => {
    const parsed = patchPatientSchema.safeParse({ pathology_code: null });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ pathology_code: null });
  });

  it('rejects an unknown pathology value', () => {
    expect(patchPatientSchema.safeParse({ pathology_code: 'tendon' }).success).toBe(false);
    expect(patchPatientSchema.safeParse({ pathology_code: 'Flexor' }).success).toBe(false);
    expect(patchPatientSchema.safeParse({ pathology_code: '' }).success).toBe(false);
  });

  it('still rejects {} (at least one field required)', () => {
    expect(patchPatientSchema.safeParse({}).success).toBe(false);
  });

  it('still rejects external_id (not editable, strict)', () => {
    expect(
      patchPatientSchema.safeParse({ pathology_code: 'flexor', external_id: 'P-999' }).success,
    ).toBe(false);
  });

  it('combines with other fields', () => {
    const parsed = patchPatientSchema.safeParse({
      pathology_code: 'extensor',
      injured_fingers: ['indice'],
    });
    expect(parsed.success).toBe(true);
  });
});
