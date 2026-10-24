import { z } from 'zod';

// Lo que entrega el navegador al suscribirse (PushSubscription.toJSON()).
export const suscripcionEsquema = z.object({
  endpoint: z.url({ protocol: /^https$/, message: 'Dirección inválida' }).max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

export const quitarSuscripcionEsquema = z.object({
  endpoint: z.string().min(1).max(1000),
});

// Sin ids = marcar todas como leídas.
export const leidasEsquema = z.object({
  ids: z.array(z.number().int().positive()).max(100).optional(),
});
