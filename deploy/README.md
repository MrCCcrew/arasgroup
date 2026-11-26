# Deployment Guide — arasgroup.app

## Server Info
- **VPS**: Hostinger KVM 2 — Ubuntu 24.04 LTS
- **IP**: 187.124.47.168
- **Domain**: arasgroup.app
- **App path**: `/var/www/arasgroup.app`
- **Port**: 3001 (proxied via Nginx)
- **Process manager**: PM2

---

## Prerequisites (on the VPS)

1. **DNS**: Point `arasgroup.app` A record → `187.124.47.168`
2. **MySQL**: Database + user created and accessible
3. **`.env` file**: Copied to `/var/www/arasgroup.app/.env` (based on `.env.example`)

---

## First-Time Setup

```bash
# SSH into server
ssh root@187.124.47.168

# Run setup script (installs Node, PM2, Nginx, Certbot, clones repo)
bash /var/www/arasgroup.app/deploy/setup.sh
```

Then copy your `.env` file to the server (**never commit it to git**):

```bash
# From your local machine:
scp .env root@187.124.47.168:/var/www/arasgroup.app/.env
```

Then run the first deploy:

```bash
bash /var/www/arasgroup.app/deploy/deploy.sh
```

---

## Every Update (Re-deploy)

```bash
ssh root@187.124.47.168
bash /var/www/arasgroup.app/deploy/deploy.sh
```

---

## MySQL Setup (if not already done)

```sql
CREATE DATABASE rashidgroup_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'rashiduser'@'localhost' IDENTIFIED BY 'strong-password-here';
GRANT ALL PRIVILEGES ON rashidgroup_db.* TO 'rashiduser'@'localhost';
FLUSH PRIVILEGES;
```

---

## Useful Commands

```bash
# View app logs
pm2 logs arasgroup

# Restart app
pm2 restart arasgroup

# Check app status
pm2 status

# View Nginx errors
tail -f /var/log/nginx/arasgroup.app.error.log

# Renew SSL (auto via certbot timer, or manually)
certbot renew --dry-run
```

---

## ⚠️ Important Notes

- **Do NOT touch** anything in `/var/www/fitzoneland.com` or its Nginx config.
- **Do NOT commit** `.env` files — use `.env.example` as a template only.
- The app runs on port **3001** — do not conflict with other apps.
