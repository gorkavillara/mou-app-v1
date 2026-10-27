/**
 * DELETE statements run by `cleanup-e2e-data.ts`, in execution order.
 *
 * Every statement takes the E2E doctor id as `$1` and MUST be scoped by it:
 * the database is shared with the pilot, so an unscoped delete would wipe
 * real patient data. `src/test/cleanup-e2e-statements.test.ts` enforces it.
 */

export type CleanupStatement = {
  table: string;
  sql: string;
};

export const E2E_CLEANUP_STATEMENTS: readonly CleanupStatement[] = [
  {
    table: 'rep_measurements',
    sql: `delete from public.rep_measurements where session_id in (
         select s.id from public.sessions s
         join public.patients p on p.id = s.patient_id
         where p.doctor_id = $1
       )`,
  },
  {
    table: 'sessions',
    sql: `delete from public.sessions where patient_id in (
         select id from public.patients where doctor_id = $1
       )`,
  },
  {
    table: 'prescriptions',
    sql: `delete from public.prescriptions where patient_id in (
         select id from public.patients where doctor_id = $1
       )`,
  },
  {
    table: 'patients',
    sql: `delete from public.patients where doctor_id = $1`,
  },
  // Last: the B-16 triggers copy external_id / pathology_code into
  // audit_log.payload on every run (GORA-16).
  {
    table: 'audit_log',
    sql: `delete from public.audit_log where doctor_id = $1`,
  },
];
