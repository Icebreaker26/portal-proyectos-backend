import { logger } from '../config/logger.js';

// Stub mínimo para este proyecto: sin sockets ni cola de correo.
// Los módulos importan esto para no acoplarse directo a console.log.
export const emitirNotificacion = (usuarioUuid, mensaje) => {
  logger.info('notificacion', { usuarioUuid, mensaje });
};
