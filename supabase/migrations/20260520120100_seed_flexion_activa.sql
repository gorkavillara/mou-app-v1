-- CLÍNICA-1a (2026-05-20): la pauta del cirujano para flexores es flexión
-- pasiva + extensión activa 3 semanas, y a partir de la semana 3 flexión
-- ACTIVA. El catálogo no tenía "flexión activa de dedos".
insert into public.exercises (code, name, description, tracked_joints, target_finger)
values ('flexion-activa-dedos',
        'Flexión activa de dedos',
        'Cierra la mano doblando los dedos por ti mismo, sin ayudarte de la otra mano, y vuelve a abrirla.',
        array['MCP','PIP','DIP'],
        'all')
on conflict (code) do nothing;
