-- =============================================================================
-- access_token: switch from raw base64 (which contains '/' and '+') to
-- URL-safe base64url so the token can sit in a Next.js dynamic segment
-- (/p/[token]) and a QR/URL without escape issues.
--
-- Background: the original migration used `encode(gen_random_bytes(24),
-- 'base64')` for the default. ~75% of tokens contain '/' or '+', which
-- break route matching and `URL` parsing in the patient client.
--
-- Fix: replace the default with a base64url encoder, and rewrite every
-- existing token in `public.patients` so any active access URLs continue
-- to work after the swap. Refs: docs/obsidian-vault/02-Decisiones-clave.md
-- (D7 onboarding via QR — anonymity-only IDs).
-- =============================================================================

alter table public.patients
  alter column access_token
  set default replace(replace(replace(encode(gen_random_bytes(24), 'base64'), '/', '_'), '+', '-'), '=', '');

-- Rewrite existing tokens so they are URL-safe. Anyone holding the old
-- base64 URL (with '/' or '+') would have hit a 404 anyway — better to
-- rotate now than carry the bug forward.
update public.patients
set access_token = replace(replace(replace(access_token, '/', '_'), '+', '-'), '=', '')
where access_token ~ '[/+=]';
