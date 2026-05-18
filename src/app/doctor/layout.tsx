import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DoctorShell } from '@/components/doctor/DoctorShell';

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: doctor } = await supabase
    .from('doctors')
    .select('id, external_label')
    .eq('id', user.id)
    .maybeSingle();

  if (!doctor) {
    await supabase.auth.signOut();
    redirect('/login?error=no_access');
  }

  return <DoctorShell doctor={doctor}>{children}</DoctorShell>;
}
