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
- **Archivos:** Supabase Storage, buckets **privados** `busetas` (fotos) y `facturas` (se crean con `npm run crear-buckets`). Mostrar imágenes solo con URLs firmadas (el backend redirige a una firmada de 10 min). Acceso por `server/compartido/almacen.js` (`req.app.locals.almacen`; en pruebas, `crearAlmacenMemoria()`).
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
- **buseta**: id, numero_interno (único), placa (única, mayúsculas), modelo, tiene_cupo (bool), valor_arriendo (obligatorio si no tiene cupo), activo, foto_path (bucket `busetas`; solo la sube el admin)
- **documento_buseta**: id, buseta_id (único), fecha_soat, fecha_tecnomecanica, fecha_tarjeta_operacion, fecha_poliza_rcc, fecha_poliza_rce, fecha_extintor (vencimiento de la recarga)
- **tipo_mantenimiento**: clave, nombre, intervalo_km, intervalo_meses, orden, activo — como `ruta`: solo para *proponer* el próximo cambio (editable por el admin). Valores iniciales por confirmar con el mecánico.
- **lectura_kilometraje**: buseta_id, fecha, kilometraje, registrado_por — único (buseta_id, fecha). El odómetro nunca retrocede (se valida contra lecturas y mantenimientos).
- **mantenimiento**: buseta_id, tipo, fecha, kilometraje, proximo_km, proxima_fecha, observacion, registrado_por, creado_en — historial; el "último" de cada tipo es el más reciente. Estado: vencido / pronto (≤ 500 km o ≤ 15 días) / al día, por km o fecha, lo que llegue primero.
- **producido_diario**: id, buseta_id, conductor_id, fecha, ingreso (= producido, valor de las planillas del día), peajes, salidas, acpm (lo paga el conductor del efectivo del día), acpm_credito (tanqueado a crédito en la bomba La Guaca; lo paga el dueño después), mantenimiento, otros, relevo (bool), observacion, creado_por, creado_en — único (buseta_id, fecha). Un día en cero se borra.
- **ruta**: nombre, peaje_trayecto, salida_ida, salida_regreso, activo — tarifas para *proponer* peajes y salidas según las vueltas (vuelta = 2 peajes + salida ida + salida regreso). Pereira–Cartago: 21.200 / 7.100 / 0. Pereira–Manizales: 23.500 / 14.100 / 17.100. Lo guardado en producido_diario son los valores finales (editables).
- **ajuste_mensual**: buseta_id, anio, mes, tipo (`bono` | `prestamo` | `mantenimiento`), descripcion, valor — varios por mes; restan del neto.
- **colpass**: buseta_id (PK), desde — busetas con Colpass (tag de peajes) y desde cuándo. La empresa le da al conductor la plata de los peajes (columna `peajes` del producido) pero el Colpass los cobra aparte: el conductor la guarda hasta entregarla.
- **liquidacion_peaje**: buseta_id, conductor_id, desde, hasta, valor (Σ peajes del producido de esos días al liquidar), observacion, registrado_por — rangos sin cruzarse (lo valida el backend). Solo el admin liquida; el conductor consulta lo suyo de una fecha a otra y lo que tiene por entregar ("Mi producido" → Peajes Colpass). Lo pendiente cuenta desde `colpass.desde`.
- **factura**: id, conductor_id, buseta_id, fecha, categoria (`peaje` | `mantenimiento` | `acpm` | `salida` | `otro`), descripcion, precio, imagen_path (opcional), creado_en
- **parametro**: id, clave, valor, vigente_desde — único (clave, vigente_desde). Claves: `porcentaje_empresa` (0.20, lo que se lleva Colectivos), `porcentaje_reposicion` (0.01), `sueldo_conductor` (3066000), `valor_relevo` (132000 por día de relevo), `fondo_fijo_arriendo` (70000), `seguro_contractual` (valor mensual, pendiente de cargar)
- **cierre_mensual**: id, buseta_id, anio, mes, bruto, reposicion, empresa, conductor, peajes, salidas, mantenimiento, arriendo, acpm, neto, estado (`abierto` | `cerrado`), cerrado_por, cerrado_en — único (buseta_id, anio, mes)
- **intento_login**: usuario, ip, creado_en — bloqueo tras 5 fallos por usuario (o 20 por IP) en 15 min.

Relación conductor–buseta: 1 a 1 en esta versión (`usuario.buseta_id`).
No se borran busetas ni conductores: se desactivan (`activo = false`) para no romper el histórico.

## Fórmula oficial del cierre mensual

Una sola versión (reemplaza RN-04, RN-05 y RN-06 del PDF):

```
bruto        = Σ ingreso del mes
reposicion   = tiene_cupo ? bruto × porcentaje_reposicion : fondo_fijo_arriendo   (sin cupo = paga arriendo)
empresa      = bruto × porcentaje_empresa
conductor    = sueldo_conductor (vigente en ese mes)
acpm         = Σacpm (conductor) + Σacpm_credito (La Guaca)
mantenimiento= Σ mantenimiento diario + Σ ajustes de mantenimiento del mes
arriendo     = tiene_cupo ? 0 : valor_arriendo
seguro       = seguro_contractual, solo de febrero a julio
relevo       = días con relevo × valor_relevo   (el conductor descansa y trabaja un reemplazo)
bono         = Σ bonos del mes (opcional)
prestamos    = Σ préstamos del mes
costos       = reposicion + empresa + conductor + Σpeajes + Σsalidas + mantenimiento + arriendo + acpm
             + relevo + seguro + bono + prestamos
neto         = bruto − costos
```

- Los parámetros se leen de la tabla `parametro` según la fecha del mes, nunca quemados en el código.
- Al cerrar, se guardan todos los valores calculados en `cierre_mensual` y el mes queda inmutable.
- El cálculo vive en una sola función pura: `server/modulos/producido/calculo.js` (`calcularResumen`), con pruebas. Porcentajes en puntos básicos (enteros) y redondeo al peso.
- Las pruebas incluyen planillas reales: buseta 2033 (bruto 11.459.500 → neto 1.811.404) y 2007 de octubre (sin cupo, ACPM La Guaca 585.506; neto 1.218.294 con fondo fijo 70.000). Si el cálculo cambia, deben seguir cuadrando.
- El resumen se muestra como en la planilla: descuentos sin combustible → **Total bruto** (`netoAntesAcpm`) → ACPM conductor y ACPM La Guaca → **Total neto**. Debajo, "Por pagar a La Guaca" (Σacpm_credito del mes). "Producido del mes" es la suma de lo producido (`bruto` en el código).
- El 20 % y el fondo se calculan sobre el bruto completo; bono y préstamos restan al final.
- **Rentabilidad** (módulo `rentabilidad`, solo admin): utilidad (= neto) del año por buseta y de la flota, mes a mes, con la misma `calcularResumen`. Solo cuentan los meses con algún registro (un mes vacío no es pérdida); el mes en curso se marca porque ya descuenta el sueldo completo. Margen = neto ÷ producido.

## Reglas que el código debe respetar

- Validar sesión y rol en cada endpoint del backend (`autenticar` + `requiereRol`); no confiar en el frontend.
- Un conductor solo accede a registros donde `conductor_id` o `buseta_id` sean los suyos (usar `alcance(req.usuario)`).
- No se crea, edita ni borra producido/facturas de un mes con `cierre_mensual.estado = 'cerrado'`.
- Las fechas de los documentos (SOAT, tecnomecánica, tarjeta de operación, pólizas, extintor) las edita solo el admin; el conductor solo las consulta.
- Kilometraje y mantenimientos: el conductor los registra en su buseta y puede corregir o borrar **lo suyo durante 7 días**; el admin ve y corrige todo. Los mantenimientos no alimentan el cierre (el costo sigue saliendo de la cuadrícula del producido).
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
5. ✅ Conductor: panel con su buseta y estado de documentos (módulo `mi-buseta`, `GET /api/mi-buseta`).
6. ✅ Despliegue en Netlify conectado a Supabase.

**Fase 2:** ✅ producido diario (admin: cuadrícula del mes, pegar desde Excel, vueltas, relevo, ACPM La Guaca, mantenimiento, bono, préstamos y resumen; conductor: "Mi producido" con sus días y el resumen del mes, de solo lectura). Pendiente: facturas (sin foto primero; la foto en otra fase).
**Fase 3:** cierre mensual, resumen financiero, exportar PDF/imagen (generado en el navegador).
**Fase 4:** respaldos automáticos, keep-alive y pulido.

## Decisiones pendientes (preguntar antes de asumir)

- ✅ Decidido: el **admin** digita el producido. El conductor **solo consulta** ("Mi producido"): sus días y el **mismo resumen del mes que ve el admin** (20 %, fondo, arriendo, mantenimiento, préstamos, neto: "en qué se gastó"), sin poder agregar ni quitar nada (`ResumenMes` con `soloLectura`). Lo de La Guaca solo le aparece si ese mes tanqueó allá.
- ¿Las facturas alimentan peajes/mantenimiento/ACPM o son solo respaldo? (Recomendado: solo respaldo, porque el admin ya digita esos valores en la cuadrícula.)
- ¿Un conductor puede rotar de buseta? (Supuesto actual: no, 1 a 1.)
- ¿El neto es para el propietario de la buseta? ¿Hace falta rol "propietario"?

## Convenciones

- Base de datos en español, `snake_case`. JavaScript en `camelCase`. Textos de UI en español.
- Migraciones SQL numeradas; nunca editar una migración ya aplicada. Antes de crear una, traer `main` y usar el siguiente número libre (hay dos 007 por crearse en paralelo; ya están aplicadas, no renombrarlas).
- `frontend/` y `server/` tienen `package.json` propio; **no usar npm workspaces** (Netlify CLI los detecta como monorepo y `netlify dev` se bloquea pidiendo elegir proyecto). Dependencias con `npm install <pkg> --prefix server|frontend`. `serverless-http` vive en la raíz porque lo importa `netlify/functions/api.js`.
- `docs/requerimientos.pdf` está en `.gitignore` (tiene cédulas); existe solo en local.
- **Estilo visual** (`frontend/src/compartido/estilos/base.css`): kiosco de transporte en blanco y negro, fuente Inter, sin sombras, radios de 8px (píldora solo en la barra y los interruptores). El color vive solo en las ilustraciones planas (`compartido/ui/Ilustraciones.jsx`); excepción: estados de documentos (rojo/ámbar, siempre con icono + texto). Turquesa solo en la pestaña activa. En celular la acción principal de una página usa la clase `accion-fija` (barra negra abajo).
- Vite escucha en `127.0.0.1` (si queda en IPv6, `netlify dev` responde "Could not proxy request").
- Las pruebas del backend van junto al módulo (`modulos/<m>/<m>.test.js`) y usan PGlite (`compartido/test/helpers.js`).
- Trabajo en pareja: una rama por cambio (`modulo/descripcion`), Pull Request a `main`, el CI debe pasar (el bot comenta el resultado en el PR). Ver `docs/MODULOS.md`.
- Nunca hacer commits ni push directo a `produccion`. Para no gastar créditos: no publicar por cambios pequeños; juntar y publicar.
- Commits pequeños y descriptivos en español.
- Antes de dar algo por terminado: correrlo localmente y probar el flujo con ambos roles.
