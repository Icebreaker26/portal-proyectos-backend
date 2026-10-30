import { z } from 'zod';

const TIPOS_PROYECTO = ['investigacion', 'aplicativo', 'trabajo_de_grado', 'otro'];
const ROLES_PARTICIPANTE = ['lider', 'desarrollo', 'diseno', 'investigacion'];
const VISIBILIDADES = ['publico', 'comunidad', 'privado'];

const urlOpcional = z.string().url().max(500).nullable().optional().or(z.literal(''));

export const participanteSchema = z
  .object({
    usuario_uuid: z.string().uuid().nullable().optional(),
    nombre_libre: z.string().min(1).max(200).nullable().optional(),
    rol: z.enum(ROLES_PARTICIPANTE).default('desarrollo'),
    orden_autoria: z.preprocess((v) => Number(v), z.number().int().positive()).default(1),
    aporte: z.string().max(500).nullable().optional(),
  })
  .refine((p) => p.usuario_uuid || p.nombre_libre, {
    message: 'Cada participante necesita usuario_uuid o nombre_libre',
  });

export const crearSchema = z.object({
  titulo: z.string().min(1, 'El título es obligatorio').max(200, 'El título no puede superar 200 caracteres'),
  descripcion: z.string().min(1, 'La descripción es obligatoria').max(5000, 'La descripción no puede superar 5000 caracteres'),
  repositorio_url: urlOpcional,

  // Campos del modelo extendido (ADR 0008) — todos opcionales en Fase 1 para no romper
  // flujos existentes mientras el frontend (issue frontend#14) se pone al día.
  programa: z.string().max(200).nullable().optional(),
  asignatura: z.string().max(200).nullable().optional(),
  semestre: z.string().max(20).nullable().optional(),
  tipo_proyecto: z.enum(TIPOS_PROYECTO).nullable().optional(),
  profesor_uuid: z.string().uuid().nullable().optional(),
  resumen: z.string().max(300, 'El resumen no puede superar 300 caracteres').nullable().optional(),
  imagen_portada_url: urlOpcional,
  cuerpo: z.string().max(20000, 'El cuerpo no puede superar 20000 caracteres').nullable().optional(),
  stack: z.array(z.string().max(50)).max(20).optional(),
  palabras_clave: z.array(z.string().max(50)).max(20).optional(),
  video_demo_url: urlOpcional,
  demo_url: urlOpcional,
  visibilidad: z.enum(VISIBILIDADES).optional(),
  licencia: z.string().max(100).nullable().optional(),
  participantes: z.array(participanteSchema).max(20).optional(),
});

export const actualizarEstadoSchema = z.object({
  estado: z.enum(['pendiente', 'aprobado', 'rechazado']),
  comentario: z.string().max(1000).nullable().optional(),
}).strict();

export const consentimientoSchema = z.object({
  consiente: z.boolean(),
}).strict();

export const idParamSchema = z.object({
  id: z.string().uuid('Id de proyecto inválido'),
});
