import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

export const registroSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  email: z
    .string()
    .email()
    .refine((v) => v.toLowerCase().endsWith('@ucp.edu.co'), {
      message: 'El registro solo está disponible con correo institucional @ucp.edu.co',
    }),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});
