#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════
#  Nobino — automated deployment on an Ubuntu VPS
#  Run:  sudo bash scripts/deploy-ubuntu.sh
#  Behavior: existing components are reused (not reinstalled);
#            only missing ones are installed and configured.
# ══════════════════════════════════════════════════════════════════
set -euo pipefail

# ─── Colors and logging ───────────────────────────────────────────
C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'; C_CYAN=$'\033[36m'; C_RESET=$'\033[0m'
info()  { echo "${C_GREEN}[+]${C_RESET} $*"; }
warn()  { echo "${C_YELLOW}[!]${C_RESET} $*"; }
fail()  { echo "${C_RED}[x]${C_RESET} $*" >&2; exit 1; }
ask()   { # ask <prompt> <default>
  local prompt="${1:-}" default="${2:-}" ans
  read -r -p "${C_CYAN}?${C_RESET} ${prompt} [${default}]: " ans
  printf '%s\n' "${ans:-$default}"
}
set_env_var() { # set_env_var <KEY> <value> — writes KEY="value" into the .env in the current directory
  local key="$1" val="$2" line tmp l found=0
  line="${key}=\"${val}\""
  [ -f .env ] || : > .env
  # Rewritten with plain bash (no sed) so values with & | / " are stored verbatim.
  tmp="$(mktemp)"
  while IFS= read -r l || [ -n "$l" ]; do
    case "$l" in
      "${key}="*) printf '%s\n' "$line" >> "$tmp"; found=1 ;;
      *) printf '%s\n' "$l" >> "$tmp" ;;
    esac
  done < .env
  [ "$found" -eq 1 ] || printf '%s\n' "$line" >> "$tmp"
  mv "$tmp" .env
}

# ─── Checks: Ubuntu / root ────────────────────────────────────────
if [ "$(uname -s)" != "Linux" ]; then
  fail "This script only runs on Linux/Ubuntu."
fi
if [ -f /etc/os-release ]; then
  . /etc/os-release
  if [[ "${ID:-}" != "ubuntu" && "${ID_LIKE:-}" != *ubuntu* ]]; then
    warn "Detected distribution: ${NAME:-?} — this script is written for Ubuntu."
  fi
fi
if [ "$(id -u)" -ne 0 ]; then
  fail "Run as root: sudo bash scripts/deploy-ubuntu.sh"
fi

export DEBIAN_FRONTEND=noninteractive

APP_NAME="nobino"
APP_DIR="${APP_DIR:-/var/www/nobino}"
PORT="${PORT:-3000}"
NODE_REQUIRED="18"

# ══════════════════════════════════════════════════════════════════
#  Phase 0 — system prerequisites (missing only)
# ══════════════════════════════════════════════════════════════════
info "Checking and installing base prerequisites (apt)..."
apt-get update -y
# apt knows which packages are already present and installs only what is missing.
apt-get install -y \
  curl wget git ca-certificates gnupg lsb-release \
  ufw openssl build-essential python3 make g++ \
  postgresql postgresql-contrib \
  nginx \
  || warn "Some packages failed to install; continuing."

# ══════════════════════════════════════════════════════════════════
#  Phase 1 — PostgreSQL (use the existing server if present)
# ══════════════════════════════════════════════════════════════════
info "Checking PostgreSQL..."
if command -v psql >/dev/null 2>&1; then
  info "PostgreSQL is present ($(psql --version | awk '{print $3}'))."
  systemctl enable --now postgresql || true
else
  warn "PostgreSQL not found; installing..."
  apt-get install -y postgresql postgresql-contrib
  systemctl enable --now postgresql
fi

EXISTING_URL=""
DB_USER="nobino"
DB_NAME="nobino"
DB_PASS=""
DB_HOST="localhost"
# Reuse the previous database if an .env file already exists.
if [ -f "$APP_DIR/.env" ] && grep -q '^DATABASE_URL=' "$APP_DIR/.env"; then
  EXISTING_URL="$(grep '^DATABASE_URL=' "$APP_DIR/.env" | head -1 | cut -d= -f2- | tr -d '"')"
  info "Using the existing DATABASE_URL from $APP_DIR/.env"
fi

# Parse user / password / host / database out of the existing URL, so a
# re-run reuses the same credentials instead of resetting them.
if [ -n "$EXISTING_URL" ] && [[ "$EXISTING_URL" =~ ^postgres(ql)?://([^:@/]+)(:([^@]*))?@([^:/?]+)(:([0-9]+))?/([^?]+) ]]; then
  DB_USER="${BASH_REMATCH[2]}"
  DB_PASS="${BASH_REMATCH[4]}"
  DB_HOST="${BASH_REMATCH[5]}"
  DB_PORT="${BASH_REMATCH[7]:-5432}"
  DB_NAME="${BASH_REMATCH[8]}"
fi

DB_USER="$(ask "Database user" "$DB_USER")"
DB_NAME="$(ask "Database name" "$DB_NAME")"
if [ -n "$EXISTING_URL" ]; then
  DATABASE_URL="$EXISTING_URL"
else
  DB_PASS="$(ask "Database password (empty = auto-generate)" "")"
  if [ -z "$DB_PASS" ]; then DB_PASS="$(openssl rand -hex 16)"; fi
  DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public"
fi

# Only a local PostgreSQL cluster is managed by this script; a managed or
# remote database is left untouched.
LOCAL_DB=1
case "$DB_HOST" in
  localhost|127.0.0.1|::1|unix|'') : ;;
  *) LOCAL_DB=0 ;;
esac

info "Ensuring the PostgreSQL user and database exist..."
# Create only if missing (never destroy existing data).
as_postgres() {
  if command -v sudo >/dev/null 2>&1; then sudo -u postgres "$@";
  elif command -v runuser >/dev/null 2>&1; then runuser -u postgres -- "$@";
  else su postgres -c "$*"; fi
}
run_psql() { as_postgres psql -v ON_ERROR_STOP=1 -tAc "$1"; }

if [ "$LOCAL_DB" -eq 0 ]; then
  warn "DATABASE_URL points at ${DB_HOST} (not local); skipping role/database creation."
elif ! run_psql "SELECT 1" >/dev/null 2>&1; then
  warn "Cannot reach the local PostgreSQL cluster (is the service running?). Start it and rerun: systemctl start postgresql"
else
  if ! [[ "$DB_NAME" =~ ^[A-Za-z0-9_]+$ ]] || ! [[ "$DB_USER" =~ ^[A-Za-z0-9_]+$ ]]; then
    fail "Database user/name may only contain letters, digits and underscores."
  fi
  if [ "$(run_psql "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")" != "1" ]; then
    if [ -z "$DB_PASS" ]; then
      fail "No password available for role '${DB_USER}'. Set DATABASE_URL (or a new password) and rerun."
    fi
    as_postgres psql -c "CREATE ROLE \"${DB_USER}\" LOGIN PASSWORD '${DB_PASS}';" >/dev/null
    info "Database user created."
  else
    if [ -z "$EXISTING_URL" ] && [ -n "$DB_PASS" ]; then
      as_postgres psql -c "ALTER ROLE \"${DB_USER}\" WITH PASSWORD '${DB_PASS}';" >/dev/null
    fi
    info "Database user already existed."
  fi
  if [ "$(run_psql "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")" != "1" ]; then
    as_postgres createdb -O "$DB_USER" "$DB_NAME"
    info "Database created."
  else
    info "Database already existed."
  fi
fi

# ══════════════════════════════════════════════════════════════════
#  Phase 2 — Node.js via nvm (only if the current version is too old)
# ══════════════════════════════════════════════════════════════════
node_version_ok() {
  command -v node >/dev/null 2>&1 || return 1
  local v; v="$(node -v | tr -d v | cut -d. -f1)"
  [ "$v" -ge "$NODE_REQUIRED" ]
}
if node_version_ok; then
  info "Node.js is present ($(node -v)) — reusing it."
else
  warn "Sufficient Node.js not found; installing via nvm..."
  export NVM_DIR="/usr/local/nvm"
  mkdir -p "$NVM_DIR"
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash >/dev/null
    # Install globally under /usr/local/nvm for the root user.
    cp -r "$HOME/.nvm/." "$NVM_DIR/" 2>/dev/null || true
  fi
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  nvm install --lts >/dev/null
  nvm alias default node >/dev/null
  ln -sf "$NVM_DIR/versions/node/$(nvm version)/bin/node" /usr/local/bin/node || true
  ln -sf "$NVM_DIR/versions/node/$(nvm version)/bin/npm" /usr/local/bin/npm || true
fi

# ══════════════════════════════════════════════════════════════════
#  Phase 3 — fetch the code (clone or pull)
# ══════════════════════════════════════════════════════════════════
if [ -d "$APP_DIR/.git" ]; then
  info "$APP_DIR is already a git repository; running pull."
  git -C "$APP_DIR" pull --ff-only || warn "pull failed; continuing."
else
  REPO="$(ask "GitHub repository URL (e.g., https://github.com/you/nobino.git)" "")"
  [ -n "$REPO" ] || fail "Repository URL is required."
  if [ -d "$APP_DIR" ] && [ -n "$(ls -A "$APP_DIR")" ]; then
    warn "Directory $APP_DIR is not empty; using it as-is (no re-clone)."
  else
    mkdir -p "$APP_DIR"
    git clone "$REPO" "$APP_DIR"
  fi
fi
cd "$APP_DIR"

# ══════════════════════════════════════════════════════════════════
#  Phase 4 — npm dependencies (reuse existing node_modules)
# ══════════════════════════════════════════════════════════════════
if [ -d node_modules ]; then
  info "node_modules exists; running an incremental npm install."
  npm install || warn "npm install reported errors; continuing."
else
  info "Installing dependencies (npm install)..."
  npm install
fi

# ══════════════════════════════════════════════════════════════════
#  Phase 5 — .env file (created from .env.example if missing)
# ══════════════════════════════════════════════════════════════════
if [ ! -f .env ]; then
  info "Creating .env from .env.example..."
  [ -f .env.example ] || fail ".env.example not found."
  cp .env.example .env

  # App URL
  APP_URL="$(ask "Public app URL (https://...)" "http://localhost:${PORT}")"
  ROOT_DOMAIN="$(ask "Root domain (for subdomains)" "localhost")"

  # Generate secrets
  JWT_SECRET="$(openssl rand -base64 32)"
  CRON_SECRET="$(openssl rand -base64 32)"

  # Override key variables in .env
  set_env_var DATABASE_URL "$DATABASE_URL"
  set_env_var JWT_SECRET "$JWT_SECRET"
  set_env_var CRON_SECRET "$CRON_SECRET"
  set_env_var NEXT_PUBLIC_APP_URL "$APP_URL"
  set_env_var NEXT_PUBLIC_SITE_URL "$APP_URL"
  set_env_var NEXT_PUBLIC_ROOT_DOMAIN "$ROOT_DOMAIN"
fi
# Make sure the variables the app reads always exist in .env.
grep -q '^DATABASE_URL=' .env || echo "DATABASE_URL=\"${DATABASE_URL}\"" >> .env
if ! grep -q '^NEXT_PUBLIC_SITE_URL=' .env; then
  APP_FROM_ENV="$(grep '^NEXT_PUBLIC_APP_URL=' .env | head -1 | cut -d= -f2- | tr -d '"')"
  set_env_var NEXT_PUBLIC_SITE_URL "${APP_FROM_ENV:-http://localhost:${PORT}}"
fi
# Warn (never silently rotate) about placeholder secrets in an existing .env.
for key in JWT_SECRET CRON_SECRET; do
  val="$(grep "^${key}=" .env | head -1 | cut -d= -f2- | tr -d '"')"
  case "$val" in
    ''|replace-with-*|change-me|secret) warn "${key} still looks like a placeholder; set a real value (openssl rand -base64 32)." ;;
  esac
done
# Keep .env private.
chmod 600 .env

# ══════════════════════════════════════════════════════════════════
#  Phase 6 — Prisma: generate + migrate + seed
# ══════════════════════════════════════════════════════════════════
info "Generating Prisma Client and applying the schema..."
npx prisma generate
npx prisma migrate deploy || { info "migrate deploy failed; trying db push..."; npx prisma db push; }
info "Seeding initial data..."
node prisma/seed.mjs || warn "seed reported errors (data may already exist)."

# ══════════════════════════════════════════════════════════════════
#  Phase 7 — production build
# ══════════════════════════════════════════════════════════════════
info "Building for production (npm run build)..."
npm run build || fail "Build failed."

# ══════════════════════════════════════════════════════════════════
#  Phase 8 — PM2 (installed only if missing)
# ══════════════════════════════════════════════════════════════════
if command -v pm2 >/dev/null 2>&1; then
  info "PM2 is present ($(pm2 --version))."
else
  info "Installing PM2 (global)..."
  npm install -g pm2
fi

# PM2 ecosystem file
cat > ecosystem.config.cjs <<EOF
module.exports = {
  apps: [{
    name: "${APP_NAME}",
    cwd: "${APP_DIR}",
    script: "node_modules/next/dist/bin/next",
    args: "start -p ${PORT}",
    instances: 1,
    autorestart: true,
    max_memory_restart: "1G",
    env: { NODE_ENV: "production", PORT: "${PORT}" }
  }]
};
EOF

info "Starting with PM2..."
pm2 startOrRestart ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

# ══════════════════════════════════════════════════════════════════
#  Phase 9 — Nginx reverse proxy (config created if missing)
#  Nginx listens on a user-chosen port to avoid conflicts with
#  other services on the server.
# ══════════════════════════════════════════════════════════════════
NGINX_CONF="/etc/nginx/sites-available/${APP_NAME}"
NGINX_PORT="$(ask "Port Nginx should listen on (default 80)" "80")"
# Validate that the port is numeric
case "$NGINX_PORT" in ''|*[!0-9]*) NGINX_PORT="80";; esac
DOMAIN=""
if ! command -v nginx >/dev/null 2>&1; then
  info "Installing Nginx..."
  apt-get install -y nginx
fi

USE_DOMAIN="$(ask "Do you have a domain? (yes/no)" "no")"
if [[ "${USE_DOMAIN,,}" == "y" || "${USE_DOMAIN,,}" == "yes" ]]; then
  DOMAIN="$(ask "Domain name (e.g., nobino.ir)" "")"
  [ -n "$DOMAIN" ] || DOMAIN=""
fi

# Shared proxy body (Nginx variables stay literal)
PROXY_BLOCK='    location / {
        proxy_pass http://127.0.0.1:'"$PORT"';
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }'

if [ -z "$DOMAIN" ]; then
  # No domain: listen on the chosen port only
  info "No domain configured; the site will be available on port ${NGINX_PORT}."
  cat > "$NGINX_CONF" <<EOF
server {
    listen ${NGINX_PORT};
    server_name _;

    client_max_body_size 20M;

${PROXY_BLOCK}
}
EOF
else
  # With domain: port 80 (for SSL) plus the chosen port
  info "Creating Nginx config for ${DOMAIN} on port ${NGINX_PORT}..."
  if [ "$NGINX_PORT" = "80" ]; then
    LISTEN_LINE="listen 80;"
  else
    LISTEN_LINE="listen 80;
    listen ${NGINX_PORT};"
  fi
  cat > "$NGINX_CONF" <<EOF
server {
    ${LISTEN_LINE}
    server_name ${DOMAIN} www.${DOMAIN} *.${DOMAIN};

    client_max_body_size 20M;

${PROXY_BLOCK}
}
EOF
fi

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/${APP_NAME}
# Remove the default site if it conflicts
[ -f /etc/nginx/sites-enabled/default ] && rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ══════════════════════════════════════════════════════════════════
#  Phase 10 — SSL certificate with Certbot (if missing)
# ══════════════════════════════════════════════════════════════════
if [ -n "$DOMAIN" ]; then
  SYSTEMD_EDITOR=true
  if ! command -v certbot >/dev/null 2>&1; then
    info "Installing Certbot..."
    apt-get install -y certbot python3-certbot-nginx
  fi
  certbot --nginx -d "$DOMAIN" -d "www.${DOMAIN}" --non-interactive --agree-tos \
    -m "$(ask "Email for the SSL certificate (optional)" "admin@${DOMAIN}")" \
    --redirect || warn "certbot reported errors; rerun after fixing DNS: certbot --nginx -d ${DOMAIN}"
fi

# ══════════════════════════════════════════════════════════════════
#  Phase 11 — UFW firewall
# ══════════════════════════════════════════════════════════════════
info "Configuring the UFW firewall..."
ufw allow 22/tcp >/dev/null || true
ufw allow "${NGINX_PORT}/tcp" >/dev/null || true
ufw allow 443/tcp >/dev/null || true
# The Next.js port stays private: Nginx proxies to 127.0.0.1:${PORT}.
info "Keeping the internal app port (${PORT}) closed to the public."
ufw --force enable || true

# ══════════════════════════════════════════════════════════════════
#  Phase 12 — summary
# ══════════════════════════════════════════════════════════════════
echo ""
echo "${C_GREEN}+------------------------------------------------------+${C_RESET}"
echo "${C_GREEN}|   Nobino deployed successfully                       |${C_RESET}"
echo "${C_GREEN}+------------------------------------------------------+${C_RESET}"
echo "  App directory : $APP_DIR"
echo "  Internal port : ${PORT}"
echo "  Nginx port    : ${NGINX_PORT}"
if [ -n "$DOMAIN" ]; then
  echo "  Site URL      : https://${DOMAIN}"
else
  echo "  Site URL      : http://$(curl -4 -s ifconfig.me || echo 'IP_SERVER'):${NGINX_PORT}"
fi
echo "  PM2 status    : pm2 status"
echo "  Logs          : pm2 logs ${APP_NAME}"
echo "  Database      : ${DB_NAME} (user: ${DB_USER})"
echo ""
warn "Default seeded admin: phone 09120000000 (default password in prisma/seed.mjs)."
warn "Change the password after the first login."
