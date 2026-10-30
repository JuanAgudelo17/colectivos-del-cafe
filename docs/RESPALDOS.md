# Respaldos de la base

## Qué corre solo

| Workflow | Cuándo | Qué hace |
|---|---|---|
| `respaldo.yml` | Domingos, 3 a. m. (Bogotá) | `pg_dump` del esquema `public` de Supabase, **cifrado** con `BACKUP_PASSPHRASE` (gpg, AES-256). Queda 90 días como artifact de la ejecución (unos 12 respaldos). |
| `mantener-activo.yml` | Todos los días, 8 a. m. | Una consulta a la base para que Supabase no pause el proyecto, y vuelve a habilitar los dos workflows (GitHub apaga los programados tras 60 días sin cambios en el repositorio). |

Si un respaldo falla, GitHub le manda un correo a quien tenga el repositorio.
Para sacar uno ya: **Actions → Respaldo semanal de la base → Run workflow**.

Secretos del repositorio (Settings → Secrets and variables → Actions):
- `DATABASE_URL`: la misma cadena del pooler que usa Netlify.
- `BACKUP_PASSPHRASE`: la clave para cifrar. **Sin ella los respaldos no se pueden abrir**: guárdala también fuera del computador (gestor de contraseñas). Está en el `.env` local.

> El repositorio es público: cualquiera con cuenta de GitHub puede descargar los artifacts. Por eso van cifrados; nunca subas un respaldo sin cifrar.

## Restaurar

Hace falta `gpg` (en Windows: Gpg4win) y `pg_restore` 17 (viene con PostgreSQL 17).

1. Descargar el respaldo: Actions → Respaldo semanal de la base → la ejecución que quieras → **Artifacts**. Llega un `.zip` con `respaldo-AAAA-MM-DD.dump.gpg`.
2. Descifrar (pide la clave `BACKUP_PASSPHRASE`):
   ```bash
   gpg --output respaldo.dump --decrypt respaldo-AAAA-MM-DD.dump.gpg
   ```
3. Revisar qué trae, sin tocar nada:
   ```bash
   pg_restore --list respaldo.dump
   ```
4. Restaurar en una base **vacía** (un proyecto nuevo de Supabase o una base local). Usar el pooler en modo **sesión** (puerto `5432`, no `6543`):
   ```bash
   pg_restore --no-owner --no-privileges --dbname "postgresql://…:5432/postgres" respaldo.dump
   ```
   Para pisar la base actual (¡borra lo que haya!) se agrega `--clean --if-exists`.
5. Borrar `respaldo.dump` cuando termines: tiene datos personales (Ley 1581).

Las fotos y facturas (Supabase Storage) no van en este respaldo; solo la base.
