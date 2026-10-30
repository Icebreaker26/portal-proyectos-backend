import { z } from 'zod';

export const crearSchema = z.object({
  titulo: z.string().min(1, 'El título es obligatorio').max(200, 'El título no puede superar 200 caracteres'),
  descripcion: z.string().min(1, 'La descripción es obligatoria').max(5000, 'La descripción no puede superar 5000 caracteres'),
  repositorio_url: z.string().url().max(500).nullable().optional().or(z.literal('')),
});

export const actualizarEstadoSchema = z.object({
  estado: z.enum(['pendiente', 'aprobado', 'rechazado']),
}).strict();

export const idParamSchema = z.object({
  id: z.string().uuid('Id de proyecto inválido'),
});
