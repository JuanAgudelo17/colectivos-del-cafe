# Colectivos del Café — Registro contable de busetas

Contexto del proyecto para Claude Code. Léelo completo antes de proponer o escribir código.
El documento de requerimientos original está en `docs/requerimientos.pdf`. Donde este archivo y el PDF difieran, **manda este archivo** (aquí están las correcciones ya decididas).

## Qué es

Dashboard web para llevar la contabilidad de busetas de transporte intermunicipal (Risaralda, Colombia).
Es **solo para Colectivos del Café** (una única empresa; el soporte multi-empresa se eliminó en la migración 004).
Lo desarrollan dos personas, organizado **por módulos** (ver `docs/MODULOS.md`).

Producción: https://el-producido.netlify.app

Dos roles:
- **admin**: ve y gestiona conductores, busetas, producido, cierres y reportes.
- **conductor**: solo ve y registra lo suyo (su buseta, su producido, sus facturas). Nunca datos de otros.

Ciclo mensual: se registra día a día durante el mes y se cierra el consolidado al final del mes. Un mes cerrado no se edita.

## Stack (decidido)

- **Frontend:** React + Vite, responsive (los conductores usan celular). UI en español.
- **Backend:** Node.js + Express, desplegado como **Netlify Functions** con `serverless-http`.
- **Base de datos:** PostgreSQL en **Supabase** (plan gratis). Conectar con la cadena del **pooler en modo transacción**, no la directa.
- **Archivos:** Supabase Storage, bucket **privado** `facturas`. Mostrar imágenes solo con URLs firmadas.
- **Hosting:** Netlify (plan gratis por créditos: 300/mes, ~15 por despliegue a producción; si se acaban se pausa el sitio). Producción se despliega desde la rama `produccion`, que solo avanza con el workflow manual "Publicar a producción", que exige la aprobación de JuanAgudelo17 (ambiente `produccion` de GitHub). `main` = ambiente de pruebas gratis (main--el-producido.netlify.app). Netlify salta el build si no cambió la app (`netlify/ignorar-build.sh`).
- **Respaldos:** GitHub Action semanal con `pg_dump` + consulta diaria para que Supabase no pause el proyecto.

No usar Vercel (su plan gratis prohíbe uso comercial).

## Estructura del repositorio

```
/
├── CLAUDE.md
├── docs/MODULOS.md        # cómo está organizado y cómo trabajar en pareja
├── frontend/src/
│   ├── compartido/        # api, sesión, layout (Panel), ui, utilidades, estilos base
│   └── modulos/           # login, dashboard, busetas, conductores, mi-buseta...
│       └── index.js       # registro de módulos por rol (menú + rutas)
├── server/
│   ├── app.js             # monta los módulos registrados en /api
│   ├── compartido/        # bd, http (errores, validación), seguridad, fecha, test/helpers
│   ├── modulos/           # salud, auth, busetas, conductores...
│   │   ├── <modulo>/      # index.js, rutas.js, repositorio.js, esquemas.js, *.test.js
│   │   └── index.js       # registro de módulos
│   └── scripts/           # migrar, crear-admin
├── netlify/functions/api.js   # envuelve server/app.js con serverless-http
├── db/migrations/         # SQL numerado: 001_inicial.sql, 002_...
├── netlify.toml
└── .github/workflows/     # ci.yml (backup y keepalive en Fase 4)
```

Un módulo solo usa otro a través de lo que este exporta en su `index.js` (nunca sus archivos internos).

## Modelo de datos (corregido respecto al PDF)

Dinero en pesos colombianos: usar `BIGINT` (pesos enteros) o `NUMERIC(14,2)`. **Nunca float.**

- **usuario**: id, usuario (único sin distinguir mayúsculas, para login), nombre, cedula, telefono, password_hash, rol (`admin` | `conductor`), buseta_id (FK única, nullable; solo conductores), activo, debe_cambiar_password, password_temporal_hasta, sesion_version, creado_en
- **solicitud_recuperacion**: usuario_id, ip, creado_en, atendida_en, atendida_por — a lo sumo una pendiente por usuario
- **buseta**: id, numero_interno (único), placa (única, mayúsculas), modelo, tiene_cupo (bool), valor_arriendo (obligatorio si no tiene cupo), activo
- **documento_buseta**: id, buseta_id (único), fecha_soat, fecha_tecnomecanica
- **producido_diario**: id, buseta_id, conductor_id, fecha, ingreso, peajes, salidas, acpm, mantenimiento, otros, observacion, creado_por, creado_en — único (buseta_id, fecha)
- **factura**: id, conductor_id, buseta_id, fecha, categoria (`peaje` | `mantenimiento` | `acpm` | `salida` | `otro`), descripcion, precio, imagen_path (opcional), creado_en
- **parametro**: id, clave, valor, vigente_desde — único (clave, vigente_desde). Claves: `porcentaje_empresa` (0.20, lo que se lleva Colectivos), `porcentaje_reposicion` (0.01), `sueldo_conductor` (3066000)
- **cierre_mensual**: id, buseta_id, anio, mes, bruto, reposicion, empresa, conductor, peajes, salidas, mantenimiento, arriendo, acpm, neto, estado (`abierto` | `cerrado`), cerrado_por, cerrado_en — único (buseta_id, anio, mes)
- **intento_login**: usuario, ip, creado_en — bloqueo tras 5 fallos por usuario (o 20 por IP) en 15 min.

Relación conductor–buseta: 1 a 1 en esta versión (`usuario.buseta_id`).
No se borran busetas ni conductores: se desactivan (`activo = false`) para no romper el histórico.

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

- Validar sesión y rol en cada endpoint del backend (`autenticar` + `requiereRol`); no confiar en el frontend.
- Un conductor solo accede a registros donde `conductor_id` o `buseta_id` sean los suyos (usar `alcance(req.usuario)`).
- No se crea, edita ni borra producido/facturas de un mes con `cierre_mensual.estado = 'cerrado'`.
- Las fechas de SOAT y tecnomecánica las edita solo el admin; el conductor solo las consulta.
- Mostrar alerta visual si un documento vence en ≤ 30 días o ya venció.
- Factura mínima: fecha, descripción, precio. Foto opcional.
- Fechas y "mes actual" en zona horaria `America/Bogota`.

## Seguridad

- Contraseñas con bcrypt. Cada usuario crea la suya: las que genera el sistema (crear conductor, restablecer, recuperar) son **temporales** (vencen en 48 h) y obligan a crear una propia antes de usar cualquier módulo (`requiereRol` responde 403). Reglas: ≥ 8 caracteres, con letra y número, sin el nombre de usuario.
- Cambiar o restablecer la contraseña sube `usuario.sesion_version` (va en el JWT) y cierra las demás sesiones.
- Recuperación sin correo: el conductor pide en /recuperar, el admin genera la temporal desde el panel. Si el admin olvida la suya: `npm run restablecer-password -- --usuario <u>`.
- Sesión con JWT en cookie `httpOnly`, `secure`, `sameSite`, expiración por inactividad de 30 min.
- Secretos solo en variables de entorno: `DATABASE_URL`, `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Nunca en el frontend ni en git. Mantener `.env.example` sin valores reales.
- Comprimir imágenes en el navegador antes de subir (`browser-image-compression`).
- Datos personales de conductores sujetos a la Ley 1581 de 2012 (habeas data).

## Fases

**Fase 1 (actual): base funcionando y desplegada**
1. ✅ Estructura del repo, Vite + Express + `netlify.toml`, correr local con `netlify dev`.
2. ✅ Migración SQL inicial con todas las tablas y datos semilla (admin con `npm run crear-admin`, parámetros).
3. ✅ Login, logout, sesión, middleware de rol, bloqueo por intentos.
4. ✅ Admin: dashboard, CRUD de busetas, conductores y fechas de documentos.
5. Conductor: ver su buseta y estado de documentos (módulo `mi-buseta`).
6. ✅ Despliegue en Netlify conectado a Supabase.

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
- Vite escucha en `127.0.0.1` (si queda en IPv6, `netlify dev` responde "Could not proxy request").
- Las pruebas del backend van junto al módulo (`modulos/<m>/<m>.test.js`) y usan PGlite (`compartido/test/helpers.js`).
- Trabajo en pareja: una rama por cambio (`modulo/descripcion`), Pull Request a `main`, el CI debe pasar (el bot comenta el resultado en el PR). Ver `docs/MODULOS.md`.
- Nunca hacer commits ni push directo a `produccion`. Para no gastar créditos: no publicar por cambios pequeños; juntar y publicar.
- Commits pequeños y descriptivos en español.
- Antes de dar algo por terminado: correrlo localmente y probar el flujo con ambos roles.
