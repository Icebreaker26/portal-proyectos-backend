import { jest } from '@jest/globals';
jest.setTimeout(30000);

const { createApp } = await import('../../src/createApp.js');
const { default: pool } = await import('../../src/db/database.js');
const { default: request } = await import('supertest');
const { default: bcrypt } = await import('bcrypt');

const EMAIL = 'proyectos-test@portal.ucp.test';
const EMAIL_PROFESOR = 'proyectos-test-profesor@portal.ucp.test';
const EMAIL_PARTICIPANTE = 'proyectos-test-participante@portal.ucp.test';
const PASS = 'testpass123';

let app, agent, usuarioUuid, profesorAgent, profesorUuid, participanteAgent, participanteUuid;

beforeAll(async () => {
  app = await createApp();

  const hash = await bcrypt.hash(PASS, 10);
  const { rows } = await pool.query(
    `INSERT INTO global_usuarios (nombre, email, password_hash, rol)
     VALUES ('Test Estudiante', $1, $2, 'estudiante')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id`,
    [EMAIL, hash],
  );
  usuarioUuid = rows[0].id;

  await pool.query(
    `INSERT INTO permisos (usuario_uuid, modulo_id, accion_id)
     SELECT $1, m.id, a.id FROM modulos m, acciones a
     WHERE m.nombre = 'proyectos' AND a.nombre IN ('READ', 'WRITE', 'DELETE')
     ON CONFLICT DO NOTHING`,
    [usuarioUuid],
  );

  const profesor = await pool.query(
    `INSERT INTO global_usuarios (nombre, email, password_hash, rol)
     VALUES ('Test Profesor', $1, $2, 'profesor')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id`,
    [EMAIL_PROFESOR, hash],
  );
  profesorUuid = profesor.rows[0].id;
  await pool.query(
    `INSERT INTO permisos (usuario_uuid, modulo_id, accion_id)
     SELECT $1, m.id, a.id FROM modulos m, acciones a
     WHERE m.nombre = 'proyectos' AND a.nombre IN ('READ', 'WRITE', 'DELETE', 'APROBAR')
     ON CONFLICT DO NOTHING`,
    [profesorUuid],
  );

  const participante = await pool.query(
    `INSERT INTO global_usuarios (nombre, email, password_hash, rol)
     VALUES ('Test Participante', $1, $2, 'estudiante')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id`,
    [EMAIL_PARTICIPANTE, hash],
  );
  participanteUuid = participante.rows[0].id;
  await pool.query(
    `INSERT INTO permisos (usuario_uuid, modulo_id, accion_id)
     SELECT $1, m.id, a.id FROM modulos m, acciones a
     WHERE m.nombre = 'proyectos' AND a.nombre IN ('READ', 'WRITE')
     ON CONFLICT DO NOTHING`,
    [participanteUuid],
  );

  agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: EMAIL, password: PASS });

  profesorAgent = request.agent(app);
  await profesorAgent.post('/api/auth/login').send({ email: EMAIL_PROFESOR, password: PASS });

  participanteAgent = request.agent(app);
  await participanteAgent.post('/api/auth/login').send({ email: EMAIL_PARTICIPANTE, password: PASS });
});

afterAll(async () => {
  await pool.query('DELETE FROM proyectos WHERE autor_uuid IN ($1, $2, $3)', [usuarioUuid, profesorUuid, participanteUuid]);
  await pool.query('DELETE FROM permisos WHERE usuario_uuid IN ($1, $2, $3)', [usuarioUuid, profesorUuid, participanteUuid]);
  await pool.query('DELETE FROM global_usuarios WHERE id IN ($1, $2, $3)', [usuarioUuid, profesorUuid, participanteUuid]);
  await pool.end();
});

describe('Proyectos — Integración', () => {
  describe('Auth', () => {
    test('Debe rechazar sin cookie', async () => {
      const res = await request(app).get('/api/proyectos');
      expect(res.status).toBe(401);
    });
  });

  describe('Pública', () => {
    test('GET /pub responde sin autenticación', async () => {
      const res = await request(app).get('/api/proyectos/pub');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Validación', () => {
    test('POST rechaza body inválido con 400', async () => {
      const res = await agent.post('/api/proyectos').send({});
      expect(res.status).toBe(400);
    });

    test('POST rechaza título de más de 200 caracteres con 400', async () => {
      const res = await agent
        .post('/api/proyectos')
        .send({ titulo: 'a'.repeat(201), descripcion: 'Descripción válida' });
      expect(res.status).toBe(400);
    });

    test('POST rechaza descripción de más de 5000 caracteres con 400', async () => {
      const res = await agent
        .post('/api/proyectos')
        .send({ titulo: 'Título válido', descripcion: 'a'.repeat(5001) });
      expect(res.status).toBe(400);
    });
  });

  describe('CRUD', () => {
    let proyectoId;

    test('POST crea proyecto', async () => {
      const res = await agent
        .post('/api/proyectos')
        .send({ titulo: 'Proyecto de prueba', descripcion: 'Descripción de prueba' });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      proyectoId = res.body.id;
    });

    test('DELETE hace borrado lógico', async () => {
      const res = await agent.delete(`/api/proyectos/${proyectoId}`);
      expect(res.status).toBe(200);

      const { rows } = await pool.query('SELECT is_active FROM proyectos WHERE id = $1', [proyectoId]);
      expect(rows[0].is_active).toBe(false);
    });
  });

  describe('Visibilidad de GET /api/proyectos', () => {
    const EMAIL_OTRO = 'proyectos-test-otro@portal.ucp.test';
    let otroUuid, propioPendienteId, otroAprobadoId, otroPendienteId;

    beforeAll(async () => {
      const hash = await bcrypt.hash(PASS, 10);
      const { rows } = await pool.query(
        `INSERT INTO global_usuarios (nombre, email, password_hash, rol)
         VALUES ('Test Otro Estudiante', $1, $2, 'estudiante')
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
         RETURNING id`,
        [EMAIL_OTRO, hash],
      );
      otroUuid = rows[0].id;

      const propio = await pool.query(
        `INSERT INTO proyectos (autor_uuid, titulo, descripcion, estado)
         VALUES ($1, 'Propio pendiente', 'd', 'pendiente') RETURNING id`,
        [usuarioUuid],
      );
      propioPendienteId = propio.rows[0].id;

      const aprobado = await pool.query(
        `INSERT INTO proyectos (autor_uuid, titulo, descripcion, estado)
         VALUES ($1, 'Otro aprobado', 'd', 'aprobado') RETURNING id`,
        [otroUuid],
      );
      otroAprobadoId = aprobado.rows[0].id;

      const pendiente = await pool.query(
        `INSERT INTO proyectos (autor_uuid, titulo, descripcion, estado)
         VALUES ($1, 'Otro pendiente', 'd', 'pendiente') RETURNING id`,
        [otroUuid],
      );
      otroPendienteId = pendiente.rows[0].id;
    });

    afterAll(async () => {
      await pool.query('DELETE FROM proyectos WHERE autor_uuid = $1 OR id = $2', [otroUuid, propioPendienteId]);
      await pool.query('DELETE FROM global_usuarios WHERE id = $1', [otroUuid]);
    });

    test('Estudiante ve lo propio (en cualquier estado) y lo aprobado de otros, no lo pendiente de otros', async () => {
      const res = await agent.get('/api/proyectos');
      expect(res.status).toBe(200);
      const ids = res.body.map((p) => p.id);
      expect(ids).toContain(propioPendienteId);
      expect(ids).toContain(otroAprobadoId);
      expect(ids).not.toContain(otroPendienteId);
    });

    test('El listado incluye el conteo de votos de cada proyecto', async () => {
      const res = await agent.get('/api/proyectos');
      const propio = res.body.find((p) => p.id === propioPendienteId);
      expect(propio).toHaveProperty('votos', 0);
    });
  });

  describe('GET /pub/:id — detalle público', () => {
    let aprobadoId, pendienteId;

    beforeAll(async () => {
      const aprobado = await pool.query(
        `INSERT INTO proyectos (autor_uuid, titulo, descripcion, repositorio_url, estado)
         VALUES ($1, 'Detalle de prueba', 'Descripción de detalle', 'https://github.com/ejemplo/repo', 'aprobado')
         RETURNING id`,
        [usuarioUuid],
      );
      aprobadoId = aprobado.rows[0].id;

      await pool.query(
        `INSERT INTO votos (usuario_uuid, proyecto_id) VALUES ($1, $2)`,
        [usuarioUuid, aprobadoId],
      );

      const pendiente = await pool.query(
        `INSERT INTO proyectos (autor_uuid, titulo, descripcion, estado)
         VALUES ($1, 'Pendiente de prueba', 'd', 'pendiente') RETURNING id`,
        [usuarioUuid],
      );
      pendienteId = pendiente.rows[0].id;
    });

    test('Responde sin autenticación con el detalle, autor y conteo de votos', async () => {
      const res = await request(app).get(`/api/proyectos/pub/${aprobadoId}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: aprobadoId,
        titulo: 'Detalle de prueba',
        autor_nombre: 'Test Estudiante',
        votos: 1,
      });
    });

    test('Responde 404 para un proyecto que no existe', async () => {
      const res = await request(app).get('/api/proyectos/pub/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });

    test('Responde 404 para un proyecto pendiente (no aprobado)', async () => {
      const res = await request(app).get(`/api/proyectos/pub/${pendienteId}`);
      expect(res.status).toBe(404);
    });

    test('Responde 400 si el id no es un UUID válido', async () => {
      const res = await request(app).get('/api/proyectos/pub/no-es-un-uuid');
      expect(res.status).toBe(400);
    });
  });

  describe('Campos extendidos (ADR 0008) y slug', () => {
    test('POST acepta los campos nuevos y genera un slug', async () => {
      const res = await agent.post('/api/proyectos').send({
        titulo: 'Proyecto Con Campos Extendidos',
        descripcion: 'Descripción básica',
        programa: 'Ingeniería de Sistemas',
        asignatura: 'Ingeniería de Software II',
        semestre: '2026-1',
        tipo_proyecto: 'aplicativo',
        resumen: 'Resumen corto del proyecto',
        stack: ['Node.js', 'React'],
        palabras_clave: ['software', 'ucp'],
        visibilidad: 'publico',
      });
      expect(res.status).toBe(201);
      expect(res.body.slug).toBe('proyecto-con-campos-extendidos');
      expect(res.body.stack).toEqual(['Node.js', 'React']);
    });

    test('Dos proyectos con el mismo título generan slugs distintos', async () => {
      const primero = await agent
        .post('/api/proyectos')
        .send({ titulo: 'Título Repetido', descripcion: 'd' });
      const segundo = await agent
        .post('/api/proyectos')
        .send({ titulo: 'Título Repetido', descripcion: 'd' });

      expect(primero.body.slug).toBe('titulo-repetido');
      expect(segundo.body.slug).toBe('titulo-repetido-2');
    });

    test('El autor queda como participante líder automáticamente', async () => {
      const res = await agent
        .post('/api/proyectos')
        .send({ titulo: 'Proyecto Autor Participante', descripcion: 'd' });

      const { rows } = await pool.query(
        'SELECT rol, consiente_publicacion FROM proyecto_participantes WHERE proyecto_id = $1 AND usuario_uuid = $2',
        [res.body.id, usuarioUuid],
      );
      expect(rows[0]).toMatchObject({ rol: 'lider', consiente_publicacion: true });
    });
  });

  describe('profesor_uuid', () => {
    test('Acepta una cuenta con rol profesor', async () => {
      const res = await agent.post('/api/proyectos').send({
        titulo: 'Proyecto con profesor válido',
        descripcion: 'd',
        profesor_uuid: profesorUuid,
      });
      expect(res.status).toBe(201);
    });

    test('Rechaza una cuenta que no es profesor con 400', async () => {
      const res = await agent.post('/api/proyectos').send({
        titulo: 'Proyecto con profesor inválido',
        descripcion: 'd',
        profesor_uuid: usuarioUuid,
      });
      expect(res.status).toBe(400);
    });

    test('Rechaza un UUID de profesor inexistente con 400', async () => {
      const res = await agent.post('/api/proyectos').send({
        titulo: 'Proyecto con profesor inexistente',
        descripcion: 'd',
        profesor_uuid: '00000000-0000-0000-0000-000000000000',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('Participantes, consentimiento y revisiones', () => {
    let proyectoId;

    beforeAll(async () => {
      const res = await agent.post('/api/proyectos').send({
        titulo: 'Proyecto con coautor',
        descripcion: 'd',
        participantes: [
          { usuario_uuid: usuarioUuid, rol: 'lider', orden_autoria: 1 },
          { usuario_uuid: participanteUuid, rol: 'desarrollo', orden_autoria: 2 },
        ],
      });
      proyectoId = res.body.id;
    });

    test('El participante agregado empieza sin consentimiento', async () => {
      const { rows } = await pool.query(
        'SELECT consiente_publicacion FROM proyecto_participantes WHERE proyecto_id = $1 AND usuario_uuid = $2',
        [proyectoId, participanteUuid],
      );
      expect(rows[0].consiente_publicacion).toBe(false);
    });

    test('No se puede aprobar mientras falte un consentimiento — responde 409', async () => {
      const res = await profesorAgent.put(`/api/proyectos/${proyectoId}/estado`).send({ estado: 'aprobado' });
      expect(res.status).toBe(409);
    });

    // Issue #12 (punto 3) — así es como un participante autenticado se entera de que debe
    // confirmar su consentimiento, sin que nadie le avise por fuera del portal.
    test('GET /api/proyectos le marca al participante que falta su consentimiento', async () => {
      const res = await participanteAgent.get('/api/proyectos');
      const fila = res.body.find((p) => p.id === proyectoId);
      expect(fila.requiere_mi_consentimiento).toBe(true);
    });

    test('A quien no es participante de ese proyecto no le marca nada (ni aparece la fila)', async () => {
      const res = await profesorAgent.get('/api/proyectos');
      const fila = res.body.find((p) => p.id === proyectoId);
      // profesorAgent sí ve el proyecto (tiene APROBAR), pero no es participante en él.
      expect(fila.requiere_mi_consentimiento).toBe(false);
    });

    test('El participante confirma su consentimiento', async () => {
      const res = await participanteAgent
        .put(`/api/proyectos/${proyectoId}/consentimiento`)
        .send({ consiente: true });
      expect(res.status).toBe(200);
    });

    test('Después de confirmar, GET /api/proyectos ya no se lo marca', async () => {
      const res = await participanteAgent.get('/api/proyectos');
      const fila = res.body.find((p) => p.id === proyectoId);
      expect(fila.requiere_mi_consentimiento).toBe(false);
    });

    test('Un usuario que no es participante no puede confirmar consentimiento — 404', async () => {
      const otroAgent = request.agent(app);
      // profesorAgent no es participante de este proyecto
      const res = await profesorAgent
        .put(`/api/proyectos/${proyectoId}/consentimiento`)
        .send({ consiente: true });
      expect(res.status).toBe(404);
      void otroAgent;
    });

    test('Ya con el consentimiento, el profesor puede aprobar', async () => {
      const res = await profesorAgent
        .put(`/api/proyectos/${proyectoId}/estado`)
        .send({ estado: 'aprobado', comentario: 'Buen trabajo' });
      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('aprobado');
    });

    test('El cambio de estado queda registrado en proyecto_revisiones con el comentario', async () => {
      const { rows } = await pool.query(
        `SELECT estado_anterior, estado_nuevo, comentario, revisor_uuid
           FROM proyecto_revisiones WHERE proyecto_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [proyectoId],
      );
      expect(rows[0]).toMatchObject({
        estado_anterior: 'pendiente',
        estado_nuevo: 'aprobado',
        comentario: 'Buen trabajo',
        revisor_uuid: profesorUuid,
      });
    });
  });

  describe('Visibilidad "privado"', () => {
    let privadoId;

    beforeAll(async () => {
      const res = await agent.post('/api/proyectos').send({
        titulo: 'Proyecto privado de prueba',
        descripcion: 'd',
        visibilidad: 'privado',
      });
      privadoId = res.body.id;
      await profesorAgent.put(`/api/proyectos/${privadoId}/estado`).send({ estado: 'aprobado' });
    });

    test('No aparece en el listado público', async () => {
      const res = await request(app).get('/api/proyectos/pub');
      expect(res.body.map((p) => p.id)).not.toContain(privadoId);
    });

    test('Su detalle público responde 404', async () => {
      const res = await request(app).get(`/api/proyectos/pub/${privadoId}`);
      expect(res.status).toBe(404);
    });

    test('Un estudiante que no es autor ni participante no lo ve en GET /api/proyectos', async () => {
      const res = await participanteAgent.get('/api/proyectos');
      expect(res.body.map((p) => p.id)).not.toContain(privadoId);
    });
  });

  describe('GET /:id — expediente autenticado', () => {
    let pendienteId;

    beforeAll(async () => {
      const res = await agent.post('/api/proyectos').send({
        titulo: 'Expediente de prueba',
        descripcion: 'd',
      });
      pendienteId = res.body.id;
    });

    test('Debe rechazar sin cookie', async () => {
      const res = await request(app).get(`/api/proyectos/${pendienteId}`);
      expect(res.status).toBe(401);
    });

    test('El autor ve su propio expediente, con participantes/archivos/revisiones', async () => {
      const res = await agent.get(`/api/proyectos/${pendienteId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('participantes');
      expect(res.body).toHaveProperty('archivos');
      expect(res.body).toHaveProperty('revisiones');
    });

    test('Un profesor ve el expediente aunque no sea el autor', async () => {
      const res = await profesorAgent.get(`/api/proyectos/${pendienteId}`);
      expect(res.status).toBe(200);
    });

    test('Un estudiante ajeno (ni autor ni participante) recibe 404 mientras está pendiente', async () => {
      const res = await participanteAgent.get(`/api/proyectos/${pendienteId}`);
      expect(res.status).toBe(404);
    });

    test('Responde 400 si el id no es un UUID válido', async () => {
      const res = await agent.get('/api/proyectos/no-es-un-uuid');
      expect(res.status).toBe(400);
    });

    test('Tras aprobar, cualquier estudiante autenticado puede verlo (público por defecto)', async () => {
      await profesorAgent.put(`/api/proyectos/${pendienteId}/estado`).send({ estado: 'aprobado', comentario: 'Ok' });
      const res = await participanteAgent.get(`/api/proyectos/${pendienteId}`);
      expect(res.status).toBe(200);
      expect(res.body.revisiones.length).toBeGreaterThan(0);
      expect(res.body.revisiones[0].comentario).toBe('Ok');
    });
  });
});
