# Trabajo por módulos

El sistema está dividido en **módulos**: cada uno es una carpeta en el backend y otra en el
frontend con todo lo suyo (rutas, consultas, validaciones, pruebas, pantallas y estilos).
Así dos personas pueden trabajar al mismo tiempo sin pisarse: cada quien toca su carpeta.

## Mapa de módulos

| Módulo | Backend (`server/modulos/`) | Frontend (`frontend/src/modulos/`) | Rol | Estado |
|---|---|---|---|---|
| Salud | `salud/` | — | público | ✅ |
| Auth (login) | `auth/` | `login/` | todos | ✅ |
| Panel general | — (usa busetas y conductores) | `dashboard/` | admin | ✅ |
| Busetas y documentos | `busetas/` | `busetas/` | admin | ✅ |
| Conductores | `conductores/` | `conductores/` | admin | ✅ |
| Mi buseta (panel del conductor) | `mi-buseta/` | `mi-buseta/` | conductor | ✅ |
| Producido diario (admin) | `producido/` | `producido/` | admin | ✅ |
| Mi producido | `producido/` (`GET /mio`) | `mi-producido/` | conductor | ✅ |
| Colpass (plata de peajes por liquidar) | `colpass/` | `colpass/` (sin menú: apartado "Peajes Colpass" en Producido para el admin y subpágina `mi-producido/peajes` del conductor) | ambos | ✅ |
| Rentabilidad (utilidad por buseta y flota) | `rentabilidad/` (usa `calcularResumen` y `datosDelAnio` de producido) | `rentabilidad/` | admin | ✅ |
| Mantenimiento y kilometraje (hoja de vida) | `mantenimiento/` | `mantenimiento/` (sin menú: lo usan `mi-buseta` y `busetas/:id`) | ambos | ✅ |
| Facturas con foto | por crear | por crear | ambos | Fase 2 |
| Cierre mensual | por crear | por crear | admin | Fase 3 |

Antes de empezar un módulo, acuerden quién lo toma, para que no lo hagan los dos.

## Qué es compartido y qué no

```
server/
  compartido/          ← de todos: cambiar con cuidado y avisar al otro
    bd/                  conexión, pool, migraciones, tipos
    http/                ErrorHttp, validar(), piezas de zod (texto, pesos, fechaOpcional…)
    seguridad/           autenticar, requiereRol, alcance, sesión JWT, contraseñas
    fecha.js             hoyBogota(), mesActualBogota()…
    test/helpers.js      crearBdPrueba(), crearUsuario(), iniciarServidor()
  modulos/<modulo>/    ← del dueño del módulo
    index.js             { ruta, router, restricciones } + lo que exporta a otros módulos
    rutas.js             endpoints (siempre con autenticar + requiereRol)
    repositorio.js       consultas SQL
    esquemas.js          validaciones zod
    <modulo>.test.js     pruebas
  modulos/index.js     ← registro: una línea por módulo

frontend/src/
  compartido/          ← de todos
    api.js               cliente HTTP (cookie, errores en español)
    sesion/              usuario actual, rutas protegidas por rol
    layout/Panel.jsx     panel: barra lateral negra con el menú agrupado + contenido
    ui/                  Campos, Dialogo, Indicador, EstadoDocumento, Iconos, Ilustraciones, Pestanas
    utilidades/          useDatos, useEnvio, formato (pesos, fechas)
    estilos/base.css     colores, botones, formularios, tablas
  modulos/<modulo>/    ← del dueño del módulo
    index.js             { id, titulo, icono, ruta, Pagina }
    Pagina*.jsx, Formulario*.jsx, <modulo>.css
  modulos/index.js     ← registro: menú lateral agrupado (menuAdmin / menuConductor) y rutas
```

**Regla:** un módulo solo usa otro a través de lo que este exporta en su `index.js`.
Ejemplo: `conductores` importa `obtenerBuseta` desde `../busetas/index.js`, nunca desde
`../busetas/repositorio.js`. Así el dueño de `busetas` puede reorganizar sus archivos sin
romper a nadie.

## Crear un módulo nuevo (ej. `producido`)

### Backend
1. Crea `server/modulos/producido/` copiando la forma de `busetas/`:
   - `rutas.js`: un `Router` con `router.use(autenticar, requiereRol(...))`.
   - Para el conductor, filtra siempre con `alcance(req.usuario)` (solo su buseta y sus registros).
   - `repositorio.js` con el SQL; `esquemas.js` con zod.
   - `index.js`:
     ```js
     import router from './rutas.js';
     export default { ruta: '/producido', router, restricciones: {} };
     ```
2. Agrégalo a `server/modulos/index.js`.
3. Si necesitas tablas nuevas: crea `db/migrations/00N_descripcion.sql` (el siguiente número libre).
   **Avisa al otro antes**, porque dos migraciones con el mismo número chocan.
4. Pruebas en `server/modulos/producido/producido.test.js` (mira `busetas.test.js`).
   Corre `npm test`.

### Frontend
1. Crea `frontend/src/modulos/producido/` con `PaginaProducido.jsx` y su `index.js`:
   ```js
   import { PaginaProducido } from './PaginaProducido.jsx';
   export default { id: 'producido', titulo: 'Producido', icono: 'dinero', ruta: 'producido', Pagina: PaginaProducido };
   ```
2. En `frontend/src/modulos/index.js` cambia la entrada `{ id: 'producido', …, fase: 2 }` del grupo
   "Próximamente" por el módulo importado y muévelo al grupo que corresponda (o crea uno). Con eso aparece
   en la barra lateral y su ruta queda en `/admin/producido`. Los iconos son los de
   `compartido/ui/Iconos.jsx` (monocromos; si falta uno, agrégalo ahí).
3. Usa `useDatos('/producido')` para cargar y `useEnvio()` + `api()` para guardar.

## Flujo de trabajo en pareja

1. **Actualiza `main`** antes de empezar:
   ```bash
   git checkout main && git pull
   ```
2. **Crea una rama** con el módulo y lo que haces:
   ```bash
   git checkout -b producido/registro-diario
   ```
3. Trabaja, prueba en local (`npm run dev`) con **ambos roles**, y haz commits pequeños en español.
4. **Sube la rama y abre un Pull Request** a `main`:
   ```bash
   git push -u origin producido/registro-diario
   gh pr create --fill
   ```
5. En el PR:
   - El **CI** (pruebas + lint + build) debe quedar en verde. El bot **github-actions** deja un
     comentario con el resultado: qué pruebas fallaron y por qué, y los problemas de lint (que además
     salen marcados en la línea exacta en **Files changed**). Cada push a la rama actualiza ese mismo
     comentario.
   - Netlify publica un **Deploy Preview** con su propia URL para revisarlo (gratis). Ojo: usa la
     misma base de datos que producción.
   - El otro revisa y aprueba.
6. **Merge** a `main` → se publica en **pruebas**: https://main--el-producido.netlify.app (gratis).
7. **Producción** solo cambia cuando **Juan lo autoriza**: GitHub → **Actions → Publicar a producción →
   Run workflow**. Cualquiera de los dos puede pedirlo (con "Solo simular" ves qué saldría), pero el
   paso que publica queda **esperando la aprobación de Juan** (ambiente `produccion` de GitHub).

Si `main` cambió mientras trabajabas: `git pull origin main` en tu rama y resuelve conflictos.

## Ramas, ambientes y créditos de Netlify

| Rama | Ambiente | URL | Créditos |
|---|---|---|---|
| tu rama + PR | Deploy Preview | la que comenta Netlify en el PR | 0 |
| `main` | Pruebas | https://main--el-producido.netlify.app | 0 |
| `produccion` | Producción | https://el-producido.netlify.app | ~15 por despliegue |

- El plan gratis da **300 créditos al mes** (~20 despliegues a producción). Si se acaban, Netlify
  **pausa el sitio** hasta el mes siguiente. Por eso producción solo avanza con "Publicar" y la
  aprobación de Juan. Junten varios cambios y publíquenlos de una vez.
- **Nunca hagas commits directo en `produccion`**: el workflow solo avanza esa rama copiando `main`,
  y fallará si alguien la modificó a mano.
- Netlify **no construye** si el cambio no toca la app: docs (`*.md`), pruebas (`*.test.js`),
  `.github/`, migraciones (`db/`) o `server/scripts/`. La regla está en `netlify/ignorar-build.sh`.
- Las migraciones (`db/migrations/`) no se aplican al desplegar: se corren con `npm run migrar`
  **antes** de publicar el código que las necesita.
- Los buckets privados de Storage (`busetas`, `facturas`) se crean una vez con `npm run crear-buckets`.

## Preparar el entorno (compañero nuevo)

1. Pide acceso al repositorio en GitHub (colaborador).
2. `git clone https://github.com/JuanAgudelo17/colectivos-del-cafe.git` y `npm install`.
3. Copia `.env.example` a `.env`. Los valores se piden por un canal privado
   (nunca por el chat del grupo ni en el repositorio).
4. `npm run dev` → http://localhost:8888
5. `npm test` debe pasar completo antes de cada PR.
