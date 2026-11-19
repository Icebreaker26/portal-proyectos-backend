import { z } from 'zod';

const TIPOS_PROYECTO = ['investigacion', 'aplicativo', 'trabajo_de_grado', 'otro'];
const ROLES_PARTICIPANTE = ['lider', 'desarrollo', 'diseno', 'investigacion'];
const VISIBILIDADES = ['publico', 'comunidad', 'privado'];

// Únicos programas que ofrece la institución hasta ahora — ampliar cuando se habiliten más
// carreras (mantener en sync con PROGRAMAS en NuevoProyecto.jsx del frontend).
const PROGRAMAS = [
  'Ingeniería de Sistemas y Telecomunicaciones',
  'Ingeniería Industrial',
  'Tecnología en Desarrollo de Software',
];

// Dos semestres por año desde 2010 (no hay registros académicos antes de esa fecha) hasta el
// semestre en curso — ver generación equivalente en NuevoProyecto.jsx del frontend.
const ANIO_MINIMO_SEMESTRE = 2010;
const semestreMaximo = () => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${hoy.getMonth() < 6 ? 1 : 2}`;
};

const urlOpcional = z.string().url().max(500).nullable().optional().or(z.literal(''));

const semestreOpcional = z
  .string()
  .regex(/^\d{4}-[12]$/, 'El semestre debe tener el formato AAAA-1 o AAAA-2')
  .refine((v) => v <= semestreMaximo() && Number(v.slice(0, 4)) >= ANIO_MINIMO_SEMESTRE, {
    message: `El semestre debe estar entre ${ANIO_MINIMO_SEMESTRE}-1 y el semestre en curso`,
  })
  .nullable()
  .optional()
  .or(z.literal(''));

export const participanteSchema = z
  .object({
    usuario_uuid: z.string().uuid().nullable().optional(),
    nombre_libre: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[a-zA-ZÀ-ÖØ-öø-ÿ\s]+$/, 'El nombre solo puede contener letras y espacios')
      .nullable()
      .optional(),
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
  programa: z.enum(PROGRAMAS).nullable().optional().or(z.literal('')),
  asignatura: z.string().max(200).nullable().optional(),
  semestre: semestreOpcional,
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
