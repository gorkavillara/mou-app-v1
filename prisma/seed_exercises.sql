-- Seed de Ejercicios
INSERT INTO exercises (id, name, description, "target_reps") VALUES
  ('MP_IP_BLOCKED', 'FE activa MP con IP bloqueadas', 'Flexión/extensión activa de la articulación metacarpo-falángica con interfalángicas bloqueadas', 10),
  ('FINGERS_NO_IP_BLOCK', 'Movimiento dedos sin bloquear', 'Flexión/extensión completa de todos los dedos', 10),
  ('THUMB_OPPOSITION', 'Oposición del pulgar', 'Ejercicios de oposición del pulgar', 15),
  ('WRIST_FLEXION', 'Flexión de muñeca', 'Flexión y extensión de muñeca', 12),
  ('GRIP_STRENGTH', 'Fuerza de agarre', 'Ejercicios de fuerza de agarre', 8)
ON CONFLICT (id) DO NOTHING;
