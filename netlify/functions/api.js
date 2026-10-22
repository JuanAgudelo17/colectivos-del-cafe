import serverless from 'serverless-http';
import { crearApp } from '../../server/app.js';
import { crearPool } from '../../server/db/pool.js';

export const handler = serverless(crearApp({ db: crearPool() }));
