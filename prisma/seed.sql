-- Seed de Admin inicial
INSERT INTO admins (id, email, name, role, "createdAt") 
VALUES 
  (gen_random_uuid(), 'gorka@villar.es', 'Gorka Villar', 'OWNER', NOW()),
  (gen_random_uuid(), 'socio@ejemplo.com', 'Socio', 'PARTNER', NOW())
ON CONFLICT (email) DO NOTHING;
