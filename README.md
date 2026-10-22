# Colectivos del Café

Registro contable de busetas de transporte intermunicipal (Risaralda, Colombia).
Dashboard web multi-empresa con dos roles: **admin** y **conductor**.

Contexto completo, modelo de datos y reglas de negocio: [CLAUDE.md](CLAUDE.md).

## Stack

| Capa          | Tecnología                                          |
| ------------- | --------------------------------------------------- |
| Frontend      | React + Vite (`frontend/`)                          |
| Backend       | Express (`server/`) en Netlify Functions            |
| Base de datos | PostgreSQL en Supabase                              |
| Archivos      | Supabase Storage (bucket privado `facturas`)        |
| Hosting       | Netlify                                             |

## Requisitos

- Node.js 22 o superior (`.nvmrc`)
- npm

## Correr en local

```bash
npm install          # instala raíz, server/ y frontend/
cp .env.example .env # y llenar valores (desde la Fase 1.2)
npm run dev          # http://localhost:8888
```

`npm run dev` ejecuta `netlify dev`, que sirve el frontend (Vite) y enruta `/api/*` a la función Express.
Comprobar: `http://localhost:8888/api/salud` → `{ "ok": true, ... }`.

## Scripts

| Comando         | Qué hace                                  |
| --------------- | ----------------------------------------- |
| `npm run dev`   | Frontend + API en local                   |
| `npm test`      | Pruebas del backend (`node:test`)         |
| `npm run lint`  | ESLint del frontend                       |
| `npm run build` | Build de producción del frontend          |

## Estructura

```
frontend/             React + Vite
server/               App Express (app.js, routes/, middleware/, db/, lib/, test/)
netlify/functions/    api.js envuelve server/app.js con serverless-http
db/migrations/        SQL numerado (001_inicial.sql, ...)
.github/workflows/    CI (y respaldos/keep-alive en Fase 4)
```

Las carpetas `frontend/` y `server/` tienen cada una su `package.json`.
Para agregar una dependencia: `npm install <paquete> --prefix server` (o `--prefix frontend`).

## Despliegue

Netlify despliega automáticamente cada push a `main`. Las variables de entorno se configuran en
Netlify → Site settings → Environment variables (nunca en el repositorio).
