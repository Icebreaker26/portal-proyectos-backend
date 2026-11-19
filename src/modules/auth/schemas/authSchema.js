import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1, 'La contraseña es obligatoria').max(72),
});

export const registroSchema = z.object({
  nombre: z
    .string()
    .min(1, 'El nombre es obligatorio')
    .max(200, 'El nombre no puede superar 200 caracteres')
    .regex(/^[a-zA-ZÀ-ÖØ-öø-ÿ\s]+$/, 'El nombre solo puede contener letras y espacios'),
  email: z
    .string()
    .email()
    .max(255)
    .refine((v) => v.toLowerCase().endsWith('@ucp.edu.co'), {
      message: 'El registro solo está disponible con correo institucional @ucp.edu.co',
    }),
  // bcrypt solo usa los primeros 72 bytes del password al hashear — limitar aquí evita que el
  // usuario escriba más creyendo que suma seguridad, y mantiene login/registro consistentes.
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(72, 'La contraseña no puede superar 72 caracteres'),
});
