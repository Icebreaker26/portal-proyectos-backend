import { jest } from '@jest/globals';
jest.setTimeout(30000);

const { createApp } = await import('../../src/createApp.js');
const { default: pool } = await import('../../src/db/database.js');
const { default: request } = await import('supertest');
const { default: bcrypt } = await import('bcrypt');

const EMAIL_AUTOR = 'archivos-test-autor@portal.ucp.test';
const EMAIL_OTRO = 'archivos-test-otro@portal.ucp.test';
const PASS = 'testpass123';

let app, autorAgent, otroAgent, autorUuid, otroUuid, proyectoId;

beforeAll(async () => {
  app = await createApp();
  const hash = await bcrypt.hash(PASS, 10);

  const autor = await pool.query(
    `INSERT INTO global_usuarios (nombre, email, password_hash, rol)
     VALUES ('Test Autor Archivos', $1, $2, 'estudiante')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id`,
    [EMAIL_AUTOR, hash],
  );
  autorUuid = autor.rows[0].id;
  await pool.query(
    `INSERT INTO permisos (usuario_uuid, modulo_id, accion_id)
     SELECT $1, m.id, a.id FROM modulos m, acciones a
     WHERE m.nombre = 'proyectos' AND a.nombre IN ('READ', 'WRITE')
     ON CONFLICT DO NOTHING`,
    [autorUuid],
  );

  const otro = await pool.query(
    `INSERT INTO global_usuarios (nombre, email, password_hash, rol)
     VALUES ('Test Otro Archivos', $1, $2, 'estudiante')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id`,
    [EMAIL_OTRO, hash],
  );
  otroUuid = otro.rows[0].id;
  await pool.query(
    `INSERT INTO permisos (usuario_uuid, modulo_id, accion_id)
     SELECT $1, m.id, a.id FROM modulos m, acciones a
     WHERE m.nombre = 'proyectos' AND a.nombre IN ('READ', 'WRITE')
     ON CONFLICT DO NOTHING`,
    [otroUuid],
  );

  autorAgent = request.agent(app);
  await autorAgent.post('/api/auth/login').send({ email: EMAIL_AUTOR, password: PASS });

  otroAgent = request.agent(app);
  await otroAgent.post('/api/auth/login').send({ email: EMAIL_OTRO, password: PASS });

  const proyecto = await autorAgent
    .post('/api/proyectos')
    .send({ titulo: 'Proyecto con archivos', descripcion: 'd' });
  proyectoId = proyecto.body.id;
});

afterAll(async () => {
  await pool.query('DELETE FROM proyectos WHERE autor_uuid IN ($1, $2)', [autorUuid, otroUuid]);
  await pool.query('DELETE FROM permisos WHERE usuario_uuid IN ($1, $2)', [autorUuid, otroUuid]);
  await pool.query('DELETE FROM global_usuarios WHERE id IN ($1, $2)', [autorUuid, otroUuid]);
  await pool.end();
});

describe('Archivos de proyecto — Integración', () => {
  test('Debe rechazar sin cookie', async () => {
    const res = await request(app)
      .post(`/api/proyectos/${proyectoId}/archivos`)
      .attach('archivo', Buffer.from('%PDF-1.4 contenido de prueba'), 'trabajo.pdf');
    expect(res.status).toBe(401);
  });

  test('Rechaza un tipo de archivo no permitido con 400', async () => {
    const res = await autorAgent
      .post(`/api/proyectos/${proyectoId}/archivos`)
      .attach('archivo', Buffer.from('contenido'), { filename: 'script.exe', contentType: 'application/x-msdownload' });
    expect(res.status).toBe(400);
  });

  test('Rechaza la subida de alguien que no es el autor con 403', async () => {
    const res = await otroAgent
      .post(`/api/proyectos/${proyectoId}/archivos`)
      .attach('archivo', Buffer.from('%PDF-1.4 contenido'), { filename: 'trabajo.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(403);
  });

  describe('Subida válida', () => {
    let archivoId;
    const contenido = Buffer.from('%PDF-1.4 contenido de prueba del trabajo escrito');

    test('El autor sube un PDF — 201 con hash y metadatos', async () => {
      const res = await autorAgent
        .post(`/api/proyectos/${proyectoId}/archivos`)
        .attach('archivo', contenido, { filename: 'trabajo.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ tipo: 'pdf', nombre_original: 'trabajo.pdf', mime_type: 'application/pdf' });
      expect(res.body.tamano_bytes).toBe(contenido.length);
      archivoId = res.body.id;
    });

    test('GET lista los archivos del proyecto', async () => {
      const res = await autorAgent.get(`/api/proyectos/${proyectoId}/archivos`);
      expect(res.status).toBe(200);
      expect(res.body.map((a) => a.id)).toContain(archivoId);
    });

    test('El hash guardado en BD coincide con el sha256 real del contenido', async () => {
      const crypto = await import('crypto');
      const hashEsperado = crypto.createHash('sha256').update(contenido).digest('hex');
      const { rows } = await pool.query('SELECT hash_sha256 FROM proyecto_archivos WHERE id = $1', [archivoId]);
      expect(rows[0].hash_sha256).toBe(hashEsperado);
    });

    test('GET /archivos/:id/descargar devuelve el contenido original', async () => {
      const res = await autorAgent.get(`/api/proyectos/archivos/${archivoId}/descargar`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(Buffer.from(res.body).equals(contenido) || res.text === contenido.toString()).toBe(true);
    });
  });

  test('Descargar un archivo inexistente responde 404', async () => {
    const res = await autorAgent.get('/api/proyectos/archivos/00000000-0000-0000-0000-000000000000/descargar');
    expect(res.status).toBe(404);
  });
});
