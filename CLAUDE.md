# Colectivos del Café — Registro contable de busetas

Contexto del proyecto para Claude Code. Léelo completo antes de proponer o escribir código.
El documento de requerimientos original está en `docs/requerimientos.pdf`. Donde este archivo y el PDF difieran, **manda este archivo** (aquí están las correcciones ya decididas).

## Qué es

Dashboard web para llevar la contabilidad de busetas de transporte intermunicipal (Risaralda, Colombia).
Proyecto personal que atiende a ~5 empresas/clientes desde **una sola instalación** (multi-empresa).

Dos roles:
- **admin**: yo. Ve y gestiona todas las empresas, conductores, busetas, producido, cierres y reportes.
- **conductor**: solo ve y registra lo suyo (su buseta, su producido, sus facturas). Nunca datos de otros.

Ciclo mensual: se registra día a día durante el mes y se cierra el consolidado al final del mes. Un mes cerrado no se edita.

## Stack (decidido)

- **Frontend:** React + Vite, responsive (los conductores usan celular). UI en español.
- **Backend:** Node.js + Express, desplegado como **Netlify Functions** con `serverless-http`.
- **Base de datos:** PostgreSQL en **Supabase** (plan gratis). Conectar con la cadena del **pooler en modo transacción**, no la directa.
- **Archivos:** Supabase Storage, bucket **privado** `facturas`. Mostrar imágenes solo con URLs firmadas.
- **Hosting:** Netlify (plan gratis; permite uso comercial). Despliegue automático con cada push a `main`.
- **Respaldos:** GitHub Action semanal con `pg_dump` + consulta diaria para que Supabase no pause el proyecto.

No usar Vercel (su plan gratis prohíbe uso comercial).

## Estructura del repositorio

```
/
├── CLAUDE.md
├── docs/requerimientos.pdf
├── frontend/              # React + Vite
├── server/                # App Express (rutas, middlewares, acceso a BD)
│   ├── app.js
│   ├── routes/
│   ├── middleware/        # auth, rol, empresa
│   └── db/
├── netlify/functions/
│   └── api.js             # envuelve server/app.js con serverless-http
├── db/migrations/         # SQL numerado: 001_inicial.sql, 002_...
├── netlify.toml
└── .github/workflows/     # backup.yml, keepalive
```

## Modelo de datos (corregido respecto al PDF)

Dinero en pesos colombianos: usar `BIGINT` (pesos enteros) o `NUMERIC(14,2)`. **Nunca float.**
Todas las tablas de negocio llevan `empresa_id` (directo o a través de buseta).

- **empresa**: id, nombre, nit, activo, creado_en
- **usuario**: id, empresa_id (NULL para admin global), usuario (único, para login), nombre, cedula, telefono, password_hash, rol (`admin` | `conductor`), buseta_id (FK, nullable), activo, creado_en
- **buseta**: id, empresa_id, numero_interno, placa (única), modelo, tiene_cupo (bool), valor_arriendo (si no tiene cupo), activo
- **documento_buseta**: id, buseta_id (único), fecha_soat, fecha_tecnomecanica
- **producido_diario**: id, buseta_id, conductor_id, fecha, ingreso, peajes, salidas, acpm, mantenimiento, otros, observacion, creado_por, creado_en — único (buseta_id, fecha)
- **factura**: id, conductor_id, buseta_id, fecha, categoria (`peaje` | `mantenimiento` | `acpm` | `salida` | `otro`), descripcion, precio, imagen_path (opcional), creado_en
- **parametro**: id, empresa_id (NULL = global), clave, valor, vigente_desde. Claves: `porcentaje_empresa` (0.20), `porcentaje_reposicion` (0.01), `sueldo_conductor` (3066000)
- **cierre_mensual**: id, buseta_id, anio, mes, bruto, reposicion, empresa, conductor, peajes, salidas, mantenimiento, arriendo, acpm, neto, estado (`abierto` | `cerrado`), cerrado_por, cerrado_en — único (buseta_id, anio, mes)

Relación conductor–buseta: 1 a 1 en esta versión (`usuario.buseta_id`).

## Fórmula oficial del cierre mensual

Una sola versión (reemplaza RN-04, RN-05 y RN-06 del PDF):

```
bruto        = Σ ingreso del mes
reposicion   = bruto × porcentaje_reposicion
empresa      = bruto × porcentaje_empresa
conductor    = sueldo_conductor (vigente en ese mes)
arriendo     = tiene_cupo ? 0 : valor_arriendo
costos       = reposicion + empresa + conductor + Σpeajes + Σsalidas + Σmantenimiento + arriendo + Σacpm
neto         = bruto − costos
```

- Los parámetros se leen de la tabla `parametro` según la fecha del mes, nunca quemados en el código.
- Al cerrar, se guardan todos los valores calculados en `cierre_mensual` y el mes queda inmutable.
- El cálculo vive en una sola función pura del backend, con pruebas unitarias.

## Reglas que el código debe respetar

- Validar rol **y** empresa en cada endpoint del backend (no confiar en el frontend).
- Un conductor solo accede a registros donde `conductor_id` o `buseta_id` sean los suyos.
- No se crea, edita ni borra producido/facturas de un mes con `cierre_mensual.estado = 'cerrado'`.
- Las fechas de SOAT y tecnomecánica las edita solo el admin; el conductor solo las consulta.
- Mostrar alerta visual si un documento vence en ≤ 30 días o ya venció.
- Factura mínima: fecha, descripción, precio. Foto opcional.
- Fechas y "mes actual" en zona horaria `America/Bogota`.

## Seguridad

- Contraseñas con bcrypt.
- Sesión con JWT en cookie `httpOnly`, `secure`, `sameSite`, expiración por inactividad de 30 min.
- Secretos solo en variables de entorno: `DATABASE_URL`, `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Nunca en el frontend ni en git. Mantener `.env.example` sin valores reales.
- Comprimir imágenes en el navegador antes de subir (`browser-image-compression`).
- Datos personales de conductores sujetos a la Ley 1581 de 2012 (habeas data).

## Fases

**Fase 1 (actual): base funcionando y desplegada**
1. Estructura del repo, Vite + Express + `netlify.toml`, correr local con `netlify dev`.
2. Migración SQL inicial con todas las tablas y datos semilla (1 admin, 1 empresa, parámetros).
3. Login, logout, sesión, middleware de rol y empresa.
4. Admin: CRUD de empresas, busetas, conductores y fechas de documentos.
5. Conductor: ver su buseta y estado de documentos.
6. Despliegue en Netlify conectado a Supabase.

**Fase 2:** registro de producido diario y facturas con foto; consultas por día/mes.
**Fase 3:** cierre mensual, resumen financiero, exportar PDF/imagen (generado en el navegador).
**Fase 4:** respaldos automáticos, keep-alive y pulido.

## Decisiones pendientes (preguntar antes de asumir)

- ¿Quién digita el producido diario: el conductor, el admin, o ambos?
- ¿Las facturas alimentan automáticamente peajes/mantenimiento/ACPM del producido, o son solo respaldo? (Supuesto actual: alimentan, por categoría.)
- ¿Un conductor puede rotar de buseta? (Supuesto actual: no, 1 a 1.)
- ¿El neto es para el propietario de la buseta? ¿Hace falta rol "propietario"?

## Convenciones

- Base de datos en español, `snake_case`. JavaScript en `camelCase`. Textos de UI en español.
- Migraciones SQL numeradas; nunca editar una migración ya aplicada.
- `frontend/` y `server/` tienen `package.json` propio; **no usar npm workspaces** (Netlify CLI los detecta como monorepo y `netlify dev` se bloquea pidiendo elegir proyecto). Dependencias con `npm install <pkg> --prefix server|frontend`. `serverless-http` vive en la raíz porque lo importa `netlify/functions/api.js`.
- `docs/requerimientos.pdf` está en `.gitignore` (tiene cédulas); existe solo en local.
- Commits pequeños y descriptivos en español.
- Antes de dar algo por terminado: correrlo localmente y probar el flujo con ambos roles.
