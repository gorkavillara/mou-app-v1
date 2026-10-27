import { describe, it, expect } from 'vitest';
import { E2E_CLEANUP_STATEMENTS } from '../../scripts/cleanup-e2e-statements';

// The Supabase DB is shared with the pilot: e2e:cleanup must never delete
// anything that is not owned by the E2E doctor (GORA-16).
describe('E2E_CLEANUP_STATEMENTS', () => {
  it('only contains DELETEs scoped by the E2E doctor id ($1)', () => {
    for (const { table, sql } of E2E_CLEANUP_STATEMENTS) {
      expect(sql, table).toMatch(new RegExp(`^delete from public\\.${table} where `));
      expect(sql, table).toMatch(/doctor_id = \$1/);
      expect(sql, table).not.toMatch(/\$[2-9]/);
    }
  });

  it('deletes the audit_log rows of the E2E doctor', () => {
    const audit = E2E_CLEANUP_STATEMENTS.find((s) => s.table === 'audit_log');
    expect(audit?.sql).toBe('delete from public.audit_log where doctor_id = $1');
  });

  it('deletes children before their parents', () => {
    expect(E2E_CLEANUP_STATEMENTS.map((s) => s.table)).toEqual([
      'rep_measurements',
      'sessions',
      'prescriptions',
      'patients',
      'audit_log',
    ]);
  });
});
