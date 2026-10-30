import { z } from 'zod';

export const crearSchema = z.object({
  proyecto_id: z.string().uuid(),
});
