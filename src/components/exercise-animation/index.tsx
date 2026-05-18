'use client';

import type { ComponentType } from 'react';
import { FlexionPasivaDedos } from './FlexionPasivaDedos';
import { ExtensionActivaDedos } from './ExtensionActivaDedos';
import { GenericHand } from './GenericHand';

/**
 * Routes an exercise code to the right inline-SVG animation. Until a
 * designer ships real Lottie assets these stylised animations stand in;
 * `MAP` is the single place that needs editing when new exercises arrive.
 *
 * The `code` strings here MUST match the `exercises.code` values in the
 * Supabase seed (see `supabase/migrations/20260508000000_fase1_init.sql`).
 */
const MAP: Record<string, ComponentType<{ className?: string }>> = {
  'flexion-pasiva-dedos': FlexionPasivaDedos,
  'extension-activa-dedos': ExtensionActivaDedos,
};

export function ExerciseAnimation({
  exerciseCode,
  className,
}: {
  exerciseCode: string;
  className?: string;
}) {
  const C = MAP[exerciseCode] ?? GenericHand;
  return <C className={className} />;
}

export { FlexionPasivaDedos, ExtensionActivaDedos, GenericHand };
