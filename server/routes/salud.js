import { Router } from 'express';
import { ahoraBogota } from '../lib/fecha.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({ ok: true, hora: ahoraBogota() });
});

export default router;
