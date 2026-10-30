import { z } from 'zod';

export const crearSchema = z.object({
  titulo: z.string().min(1, 'El título es obligatorio'),
  descripcion: z.string().min(1, 'La descripción es obligatoria'),
  repositorio_url: z.string().url().nullable().optional().or(z.literal('')),
});

export const actualizarEstadoSchema = z.object({
  estado: z.enum(['pendiente', 'aprobado', 'rechazado']),
}).strict();
