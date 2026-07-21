# 🚀 Déploiement sur `send.aemconseil.eu` (VPS IONOS)

L'app génère les vidéos avec **ffmpeg côté serveur** : elle a besoin d'un
**serveur Node** (pas d'un hébergement statique/Deploy Now). Sur IONOS, c'est un
**VPS / Cloud Server**. Domaine et DNS étant chez IONOS, le sous-domaine pointe
vers l'IP du VPS via un enregistrement **A**.

---

## 1. DNS chez IONOS

Dans **IONOS → Domaines & SSL → `aemconseil.eu` → DNS** :

| Type | Nom (hôte) | Valeur | TTL |
| --- | --- | --- | --- |
| **A** | `send` | **l'IPv4 de ton VPS IONOS** | 3600 |
| **AAAA** *(si ton VPS a une IPv6)* | `send` | l'IPv6 du VPS | 3600 |

> Le nom est bien `send` (IONOS complète en `send.aemconseil.eu`). L'IP se trouve
> dans **IONOS → Serveurs & Cloud → ton serveur** (adresse IP publique).

La propagation prend de quelques minutes à ~1 h.

---

## 2. Préparer le VPS (Ubuntu/Debian)

```bash
# Node.js 20 + ffmpeg (avec libx264 et libass, indispensables)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs ffmpeg nginx
ffmpeg -version   # vérifie la présence de --enable-libx264 et --enable-libass
```

## 3. Installer l'app

```bash
sudo mkdir -p /opt/generate-ad && sudo chown $USER /opt/generate-ad
git clone <url-du-repo> /opt/generate-ad
cd /opt/generate-ad
npm ci --omit=dev

cp .env.example .env
# ⚠️ édite .env : définis APP_PASSWORD (accès interne), PORT=3000...
nano .env
```

## 4. Lancer en service (systemd)

```bash
sudo cp deploy/generate-ad.service /etc/systemd/system/
# adapte User=/chemins si besoin, puis :
sudo systemctl daemon-reload
sudo systemctl enable --now generate-ad
sudo systemctl status generate-ad
```

## 5. Reverse proxy + HTTPS

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/send.aemconseil.eu
sudo ln -s /etc/nginx/sites-available/send.aemconseil.eu /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Certificat HTTPS gratuit (une fois le DNS propagé) :
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d send.aemconseil.eu
```

Ouvre ensuite **https://send.aemconseil.eu** → l'app demande l'utilisateur/mot de
passe définis dans `.env` (accès interne).

---

## Sécurité « interne »

- **`APP_PASSWORD`** protège tout l'accès (HTTP Basic Auth). Ne le laisse jamais vide en prod.
- La page envoie `noindex, nofollow` (pas d'indexation moteurs).
- Pour restreindre encore, tu peux limiter l'accès par IP dans Nginx :
  ```nginx
  location / { allow 1.2.3.4;  deny all;  proxy_pass http://127.0.0.1:3000; ... }
  ```
- Pense au **pare-feu IONOS** : n'ouvre que les ports 80/443 (et 22 pour SSH).

## Mise à jour

```bash
cd /opt/generate-ad && git pull && npm ci --omit=dev
sudo systemctl restart generate-ad
```
