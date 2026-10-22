#!/usr/bin/env bash
# ¿Hay cambios que afecten la app publicada entre dos commits?
#
#   exit 0 → NO hay cambios de la app: Netlify cancela el build (no gasta créditos).
#   exit 1 → SÍ hay cambios (o no se puede saber): Netlify construye.
#
# Netlify lo ejecuta como `ignore` (netlify.toml) comparando el último commit
# desplegado ($CACHED_COMMIT_REF) con el nuevo ($COMMIT_REF). El workflow
# "Publicar a producción" lo reusa pasando dos referencias:
#   bash netlify/ignorar-build.sh origin/produccion HEAD

BASE="${1:-$CACHED_COMMIT_REF}"
DESTINO="${2:-$COMMIT_REF}"

# Lo que entra en el sitio publicado…
RUTAS=(
  frontend/ server/ netlify/ netlify.toml package.json package-lock.json
  # …menos lo que no cambia lo que ve el usuario:
  ':(exclude,glob)**/*.md'
  ':(exclude,glob)server/**/*.test.js'
  ':(exclude)server/compartido/test/'
  ':(exclude)server/scripts/'
  ':(exclude)frontend/eslint.config.js'
  ':(exclude)netlify/ignorar-build.sh'
)

if [ -z "$BASE" ] || [ -z "$DESTINO" ] || [ "$BASE" = "$DESTINO" ]; then
  echo "→ Sin despliegue anterior con qué comparar: se construye."
  exit 1
fi

git diff --quiet "$BASE" "$DESTINO" -- "${RUTAS[@]}"
codigo=$?

if [ "$codigo" -eq 0 ]; then
  echo "→ Sin cambios en la app (solo docs, pruebas, CI o migraciones): no se despliega."
  exit 0
fi

if [ "$codigo" -eq 1 ]; then
  echo "→ Cambios en la app:"
  git diff --name-only "$BASE" "$DESTINO" -- "${RUTAS[@]}" | sed 's/^/   /'
  exit 1
fi

echo "→ No se pudo comparar ($BASE..$DESTINO): se construye por seguridad."
exit 1
