#!/usr/bin/env bash
# Installation tout-en-un du générateur de vidéos publicitaires sur un VPS
# Ubuntu (22.04 / 24.04). À exécuter EN ROOT depuis le dossier du dépôt cloné :
#
#   sudo bash deploy/install.sh
#
# Variables optionnelles :
#   DOMAIN=send.aemconseil.eu   APP_USER=aem   APP_PASSWORD=...   PORT=3000
# Si APP_PASSWORD n'est pas fourni, le script le demande.

set -euo pipefail

DOMAIN="${DOMAIN:-send.aemconseil.eu}"
APP_USER="${APP_USER:-aem}"
PORT="${PORT:-3000}"
APP_DIR="/opt/generate-ad"

echo "==> Installation pour ${DOMAIN} (port ${PORT})"

if [[ $EUID -ne 0 ]]; then
  echo "Ce script doit être lancé en root : sudo bash deploy/install.sh" >&2
  exit 1
fi

# Mot de passe d'accès interne
if [[ -z "${APP_PASSWORD:-}" ]]; then
  read -rsp "Choisis un mot de passe d'accès à l'app (utilisateur ${APP_USER}) : " APP_PASSWORD
  echo
fi
if [[ -z "${APP_PASSWORD}" ]]; then
  echo "Mot de passe vide refusé." >&2
  exit 1
fi

# 1) Dépendances système
echo "==> Installation de Node.js, ffmpeg, nginx..."
export DEBIAN_FRONTEND=noninteractive
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs ffmpeg nginx git

# 2) Récupération du code (si le script n'est pas déjà dans le dépôt)
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "${REPO_ROOT}/server/server.js" ]]; then
  if [[ "${REPO_ROOT}" != "${APP_DIR}" ]]; then
    echo "==> Copie du code vers ${APP_DIR}..."
    mkdir -p "${APP_DIR}"
    cp -r "${REPO_ROOT}/." "${APP_DIR}/"
  fi
else
  echo "Code introuvable : lance ce script depuis le dépôt cloné." >&2
  exit 1
fi
cd "${APP_DIR}"

# 3) Dépendances Node
echo "==> npm ci..."
npm ci --omit=dev

# 4) Fichier .env
if [[ ! -f .env ]]; then
  echo "==> Création du .env..."
  cat > .env <<EOF
APP_USER=${APP_USER}
APP_PASSWORD=${APP_PASSWORD}
PORT=${PORT}
HOST=127.0.0.1
RENDER_CONCURRENCY=1
EOF
fi

# 5) Service systemd
echo "==> Configuration du service systemd..."
sed -e "s#WorkingDirectory=.*#WorkingDirectory=${APP_DIR}#" \
    -e "s#EnvironmentFile=.*#EnvironmentFile=${APP_DIR}/.env#" \
    -e "s#User=www-data#User=root#" \
    deploy/generate-ad.service > /etc/systemd/system/generate-ad.service
systemctl daemon-reload
systemctl enable --now generate-ad

# 6) Reverse proxy nginx
echo "==> Configuration de nginx pour ${DOMAIN}..."
sed "s/send.aemconseil.eu/${DOMAIN}/g" deploy/nginx.conf.example > "/etc/nginx/sites-available/${DOMAIN}"
ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"
nginx -t && systemctl reload nginx

echo
echo "======================================================================"
echo " ✅ Installation terminée."
echo "    App locale : http://127.0.0.1:${PORT}  (via nginx sur le port 80)"
echo
echo " Étapes restantes :"
echo "  1. Pointe la DNS de ${DOMAIN} (enregistrement A) vers l'IP de ce VPS."
echo "  2. Une fois le DNS propagé, active le HTTPS :"
echo "       apt-get install -y certbot python3-certbot-nginx"
echo "       certbot --nginx -d ${DOMAIN}"
echo
echo "  Identifiants d'accès : utilisateur « ${APP_USER} » + le mot de passe choisi."
echo "======================================================================"
