import { z } from 'zod';

// 'admin' no se asigna por esta vía — se mantiene manual en BD (ver ADR 0006).
export const actualizarRolSchema = z.object({
  rol: z.enum(['estudiante', 'profesor']),
}).strict();

// Issue #12 — exige el email completo y exacto (nunca un prefijo) para mitigar enumeración de
// usuarios: z.string().email() ya rechaza fragmentos que no sean una dirección válida completa.
export const buscarSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
}).strict();
