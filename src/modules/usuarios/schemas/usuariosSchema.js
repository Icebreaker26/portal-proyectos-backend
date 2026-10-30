import { z } from 'zod';

// 'admin' no se asigna por esta vía — se mantiene manual en BD (ver ADR 0006).
export const actualizarRolSchema = z.object({
  rol: z.enum(['estudiante', 'profesor']),
}).strict();
