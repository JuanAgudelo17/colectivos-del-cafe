import serverless from 'serverless-http';
import { crearApp } from '../../server/app.js';
import { crearPool } from '../../server/compartido/bd/pool.js';

export const handler = serverless(crearApp({ db: crearPool() }));
