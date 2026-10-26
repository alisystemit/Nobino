#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════
#  Nobino — automated deployment on an Ubuntu VPS
#
#  Run from an existing checkout:  sudo bash scripts/deploy-ubuntu.sh
#  One-line install from GitHub:
#    curl -fsSL https://raw.githubusercontent.com/alisystemit/Nobino/main/scripts/install-from-github.sh | sudo bash
#
#  Behavior: existing components are reused (not reinstalled);
#            only missing ones are installed and configured.
#
#  Safe next to an existing stack (Apache/LAMP + MySQL/MariaDB + Telegram bot):
#    * MySQL/MariaDB is never installed, restarted or reconfigured.
#    * Apache and its sites, folders and SSL certificates are never touched.
#    * The app runs as its own unprivileged user, never as root.
#    * When Apache owns port 80, Nginx is put on a free port instead.
#    * certbot and UFW are skipped in that mode (nothing of the existing
#      server changes); a ready Apache reverse-proxy snippet is printed.
#
#  Environment overrides (all optional):
#    REPO_URL        git repository to clone      (default: public Nobino repo)
#    GIT_REF         branch/tag/commit to deploy  (default: main)
#    APP_USER        unprivileged service user    (default: nobino)
#    APP_HOME        home of that user            (default: /var/lib/nobino)
#    APP_DIR         install directory            (default: /opt/nobino)
#    PORT            internal Next.js port        (default: 3000)
#    NGINX_PORT      public Nginx port            (default: 80, or a free port
#                                                  when Apache occupies 80)
#    COEXIST         auto|1|0  keep an existing Apache/MySQL stack untouched
#                              (auto = on when Apache is detected)
#    MANAGE_UFW      auto|1|0  configure the firewall (auto = off in coexistence)
#    ENABLE_SSL      auto|1|0  run certbot for DOMAIN (auto = off in coexistence)
#    DOMAIN          domain name for SSL; empty   = IP-only install
#    SSL_EMAIL       certbot contact email
#    APP_URL         public app URL (https://...)
#    ROOT_DOMAIN     root domain used for subdomains
#    NONINTERACTIVE  set to 1 to never prompt; every question uses its
#                    default or the env value above
# ══════════════════════════════════════════════════════════════════
set -euo pipefail

# ─── Colors and logging ───────────────────────────────────────────
C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'; C_CYAN=$'\033[36m'; C_RESET=$'\033[0m'
info()  { echo "${C_GREEN}[+]${C_RESET} $*"; }
warn()  { echo "${C_YELLOW}[!]${C_RESET} $*"; }
fail()  { echo "${C_RED}[x]${C_RESET} $*" >&2; exit 1; }
ask()   { # ask <prompt> <default>
  local prompt="${1:-}" default="${2:-}" ans=""
  # NONINTERACTIVE=1 → never block on input (unattended installs).
  if [ "${NONINTERACTIVE:-0}" = "1" ]; then
    printf '%s\n' "$default"
    return 0
  fi
  # Read from the terminal, never from stdin: this script is commonly piped
  # (curl ... | sudo bash) and stdin then carries the script itself, so a plain
  # `read` would swallow the next lines of code instead of the user's answer.
  if [ -t 0 ]; then
    read -r -p "${C_CYAN}?${C_RESET} ${prompt} [${default}]: " ans
  elif [ -e /dev/tty ] && { : </dev/tty; } 2>/dev/null; then
    read -r -p "${C_CYAN}?${C_RESET} ${prompt} [${default}]: " ans </dev/tty || ans=""
  else
    warn "No terminal available; using the default for '${prompt}'."
  fi
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
# The app never runs as root and lives outside the Apache web root, so an
# existing LAMP/PHP site keeps its folders exactly as they are.
APP_USER="${APP_USER:-nobino}"
APP_HOME="${APP_HOME:-/var/lib/${APP_USER}}"
APP_DIR="${APP_DIR:-/opt/nobino}"
PORT="${PORT:-3000}"
NODE_REQUIRED="18"
# The public repository is the default source, so a bare Enter accepts it.
REPO_URL="${REPO_URL:-https://github.com/alisystemit/Nobino.git}"
GIT_REF="${GIT_REF:-main}"
# Pre-set DOMAIN/APP_URL/NGINX_PORT/SSL_EMAIL to run unattended.
DOMAIN="${DOMAIN:-}"
COEXIST="${COEXIST:-auto}"
MANAGE_UFW="${MANAGE_UFW:-auto}"
ENABLE_SSL="${ENABLE_SSL:-auto}"
NGINX_CONF="/etc/nginx/sites-available/${APP_NAME}.conf"

# ══════════════════════════════════════════════════════════════════
#  Phase 0a — detect the existing stack (read-only) and pick safe defaults
# ══════════════════════════════════════════════════════════════════
APACHE_PRESENT=0
if command -v apache2ctl >/dev/null 2>&1 || command -v apachectl >/dev/null 2>&1 ||
   [ -d /etc/apache2 ] || pgrep -x apache2 >/dev/null 2>&1; then
  APACHE_PRESENT=1
fi
MYSQL_PRESENT=0
if [ -d /etc/mysql ] || command -v mysqld >/dev/null 2>&1 || command -v mariadbd >/dev/null 2>&1 ||
   systemctl list-unit-files 2>/dev/null | grep -qE '^(mysql|mariadb)\.service'; then
  MYSQL_PRESENT=1
fi
PHP_PRESENT=0
if command -v php >/dev/null 2>&1 || ls /etc/php >/dev/null 2>&1; then PHP_PRESENT=1; fi

[ "$APACHE_PRESENT" -eq 1 ] && info "Apache detected — coexistence mode keeps it untouched."
[ "$MYSQL_PRESENT" -eq 1 ] && info "MySQL/MariaDB detected — it will not be installed, restarted or reconfigured."
[ "$PHP_PRESENT" -eq 1 ] && info "PHP detected (existing sites) — no PHP packages are changed."

case "${COEXIST,,}" in
  auto) if [ "$APACHE_PRESENT" -eq 1 ]; then COEXIST=1; else COEXIST=0; fi ;;
  1|yes|true) COEXIST=1 ;;
  0|no|false) COEXIST=0 ;;
  *) warn "Unknown COEXIST='${COEXIST}'; falling back to auto."; COEXIST=$([ "$APACHE_PRESENT" -eq 1 ] && echo 1 || echo 0) ;;
esac
[ "$COEXIST" -eq 1 ] && info "Coexistence mode: Nginx gets its own port; certbot and UFW are not touched."

# ─── Port helpers (read-only) ─────────────────────────────────────
port_in_use() { # port_in_use <port>
  local p="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -H -ltn "sport = :$p" 2>/dev/null | grep -q . && return 0
    return 1
  fi
  if command -v netstat >/dev/null 2>&1; then
    netstat -ltn 2>/dev/null | awk 'NR>2 {print $4}' | grep -qE "[:.]${p}\$" && return 0
  fi
  return 1
}
free_port() { # free_port <start> [end] — first unused port in the range
  local p="$1" end="${2:-$(( $1 + 20 ))}"
  while [ "$p" -le "$end" ]; do
    port_in_use "$p" || { printf '%s\n' "$p"; return 0; }
    p=$(( p + 1 ))
  done
  return 1
}
# A re-run must keep the port that this install already uses: when Nginx is the
# one listening, the port is taken by ourselves, not by a foreign service.
nginx_owns_port() { # nginx_owns_port <port>
  [ -f "$NGINX_CONF" ] || return 1
  grep -qE "^[[:space:]]*listen[[:space:]]+$1([[:space:];]|$)" "$NGINX_CONF" 2>/dev/null
}

# Default public port: 80 on a dedicated server, but never fight Apache for it.
DEFAULT_NGINX_PORT=80
if port_in_use 80 && ! nginx_owns_port 80; then
  if [ "$COEXIST" -eq 1 ]; then
    if FREE_NGINX_PORT="$(free_port 8080 8099)"; then
      DEFAULT_NGINX_PORT="$FREE_NGINX_PORT"
      warn "Port 80 is already taken (Apache); Nginx will listen on ${DEFAULT_NGINX_PORT} instead."
    else
      fail "Ports 8080-8099 are all busy; set NGINX_PORT manually."
    fi
  else
    warn "Port 80 is already taken by another service."
    if FREE_NGINX_PORT="$(free_port 8080 8099)"; then
      DEFAULT_NGINX_PORT="$FREE_NGINX_PORT"
      warn "Nginx will listen on ${DEFAULT_NGINX_PORT} instead (override with NGINX_PORT)."
    fi
  fi
fi

# ─── Dedicated unprivileged user: the app never runs as root ──────
if id -u "$APP_USER" >/dev/null 2>&1; then
  info "Service user '${APP_USER}' already exists; reusing it."
else
  info "Creating the service user '${APP_USER}'..."
  useradd --system --create-home --home-dir "$APP_HOME" --shell /bin/bash "$APP_USER" \
    || fail "Could not create the service user '${APP_USER}'."
fi
APP_GROUP="$(id -gn "$APP_USER")"

as_app() { # as_app <command...> — run as the service user with its own home/PM2
  if [ "$(id -un)" = "$APP_USER" ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo -u "$APP_USER" -H env HOME="$APP_HOME" PM2_HOME="$APP_HOME/.pm2" "$@"
  else
    runuser -u "$APP_USER" -- env HOME="$APP_HOME" PM2_HOME="$APP_HOME/.pm2" "$@"
  fi
}
app_sh() { # app_sh '<shell snippet>' — executed inside APP_DIR as the service user
  as_app bash -lc "cd '$APP_DIR' && $1"
}

# ══════════════════════════════════════════════════════════════════
#  Phase 0 — system prerequisites (missing only)
# ══════════════════════════════════════════════════════════════════
info "Checking and installing base prerequisites (apt)..."
apt-get update -y
# Only the packages Nobino needs are named here: apache2, php*, mysql-server
# and mariadb-server are deliberately absent, so apt never upgrades or
# reconfigures the existing LAMP stack that other sites/robots rely on.
apt-get install -y \
  curl wget git ca-certificates gnupg lsb-release \
  openssl build-essential python3 make g++ \
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
# The service user must be able to run node/npm from its own login shell.
if ! as_app bash -lc 'command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1'; then
  NODE_BIN="$(command -v node || true)"
  NPM_BIN="$(command -v npm || true)"
  if [ -n "$NODE_BIN" ] && [ -n "$NPM_BIN" ]; then
    ln -sf "$NODE_BIN" /usr/local/bin/node
    ln -sf "$NPM_BIN" /usr/local/bin/npm
    warn "Linked node/npm into /usr/local/bin so '${APP_USER}' can use them."
  else
    fail "node/npm are not usable by '${APP_USER}'. Install Node.js 18+ system-wide and rerun."
  fi
fi

# ══════════════════════════════════════════════════════════════════
#  Phase 3 — fetch the code (clone from GitHub, or update in place)
# ══════════════════════════════════════════════════════════════════
# Git refuses to operate on a directory owned by another user; on a VPS the
# app folder is often owned by www-data while this script runs as root.
git config --global --add safe.directory "$APP_DIR" >/dev/null 2>&1 || true

# Bring the working tree to $GIT_REF (branch, tag or commit).
checkout_ref() {
  # Never discard hand-edited files on the server: a dirty tree is left alone.
  # package-lock.json is excluded because `npm install` legitimately rewrites it
  # on the server (different npm version) and that must not block updates.
  local dirty
  dirty="$(git -C "$APP_DIR" status --porcelain --untracked-files=no 2>/dev/null | grep -v ' package-lock.json$' || true)"
  if [ -n "$dirty" ]; then
    warn "$APP_DIR has uncommitted changes; not touching the working tree."
    warn "Commit or revert them to let this script update the code."
    return 0
  fi
  if git -C "$APP_DIR" rev-parse --verify --quiet "origin/$GIT_REF" >/dev/null; then
    # A remote branch: fast-forward onto it, keeping history linear.
    git -C "$APP_DIR" checkout -B "$GIT_REF" "origin/$GIT_REF" >/dev/null
  elif git -C "$APP_DIR" rev-parse --verify --quiet "$GIT_REF^{commit}" >/dev/null; then
    # A tag or an explicit commit: detached checkout.
    git -C "$APP_DIR" checkout --detach "$GIT_REF" >/dev/null
  else
    warn "Ref '$GIT_REF' was not found in the repository; keeping the current checkout."
    return 0
  fi
  info "Code is at $(git -C "$APP_DIR" rev-parse --short HEAD) ($GIT_REF)."
}

if [ -d "$APP_DIR/.git" ]; then
  info "$APP_DIR is already a git repository; updating it."
  CURRENT_REMOTE="$(git -C "$APP_DIR" remote get-url origin 2>/dev/null || echo '')"
  if [ -n "$CURRENT_REMOTE" ] && [ "${CURRENT_REMOTE%.git}" != "${REPO_URL%.git}" ]; then
    warn "Its origin is $CURRENT_REMOTE (asked for $REPO_URL); using the existing remote."
    REPO_URL="$CURRENT_REMOTE"
  elif [ -z "$CURRENT_REMOTE" ]; then
    git -C "$APP_DIR" remote add origin "$REPO_URL"
  fi
  git -C "$APP_DIR" fetch --tags --prune origin || warn "fetch failed; continuing with the local copy."
  checkout_ref || warn "Could not update the code; continuing with the local copy."
else
  REPO="$(ask "GitHub repository URL to clone" "$REPO_URL")"
  [ -n "$REPO" ] || fail "Repository URL is required (or place the code in $APP_DIR yourself)."
  if [ -d "$APP_DIR" ] && [ -n "$(ls -A "$APP_DIR" 2>/dev/null)" ]; then
    warn "Directory $APP_DIR already has files; using it as-is (no clone)."
  else
    mkdir -p "$APP_DIR"
    info "Cloning $REPO ($GIT_REF) into $APP_DIR..."
    # Clone into a throwaway directory first so APP_DIR is never removed,
    # even when the requested branch/tag does not resolve.
    CLONE_TMP="$(mktemp -d)"
    trap 'rm -rf "$CLONE_TMP"' EXIT
    if git clone --branch "$GIT_REF" "$REPO" "$CLONE_TMP/repo" >/dev/null 2>&1; then
      :
    else
      warn "git clone --branch failed (tag/commit ref?); cloning the default branch instead."
      git clone "$REPO" "$CLONE_TMP/repo" >/dev/null 2>&1 || { rm -rf "$CLONE_TMP"; trap - EXIT; fail "Could not clone $REPO."; }
      if ! git -C "$CLONE_TMP/repo" checkout "$GIT_REF" >/dev/null 2>&1; then
        warn "Ref '$GIT_REF' not found; using the default branch."
        GIT_REF="$(git -C "$CLONE_TMP/repo" rev-parse --abbrev-ref HEAD)"
      fi
    fi
    cp -a "$CLONE_TMP/repo/." "$APP_DIR/"
    rm -rf "$CLONE_TMP"
    trap - EXIT
    checkout_ref
  fi
fi
cd "$APP_DIR"
# Everything below runs as the service user; hand the tree over to it.
chown -R "$APP_USER":"$APP_GROUP" "$APP_DIR" 2>/dev/null || warn "Could not chown $APP_DIR to ${APP_USER}."

# ══════════════════════════════════════════════════════════════════
#  Phase 4 — npm dependencies (reuse existing node_modules)
# ══════════════════════════════════════════════════════════════════
if [ -d node_modules ]; then
  info "node_modules exists; running an incremental npm install."
  app_sh "npm install" || warn "npm install reported errors; continuing."
else
  info "Installing dependencies (npm install)..."
  app_sh "npm install"
fi

# ══════════════════════════════════════════════════════════════════
#  Phase 5 — .env file (created from .env.example if missing)
# ══════════════════════════════════════════════════════════════════
if [ ! -f .env ]; then
  info "Creating .env from .env.example..."
  [ -f .env.example ] || fail ".env.example not found."
  cp .env.example .env

  # App URL (DOMAIN from the environment is the default when provided)
  if [ -z "${APP_URL:-}" ]; then
    if [ -n "$DOMAIN" ]; then
      APP_URL="$(ask "Public app URL (https://...)" "https://${DOMAIN}")"
    else
      APP_URL="$(ask "Public app URL (https://...)" "http://localhost:${PORT}")"
    fi
  fi
  if [ -z "${ROOT_DOMAIN:-}" ]; then
    ROOT_DOMAIN="$(ask "Root domain (for subdomains)" "${DOMAIN:-localhost}")"
  fi

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
# Keep .env private and owned by the service user (root wrote it).
chmod 600 .env
chown "$APP_USER":"$APP_GROUP" .env 2>/dev/null || true

# ══════════════════════════════════════════════════════════════════
#  Phase 6 — Prisma: generate + migrate + seed
# ══════════════════════════════════════════════════════════════════
info "Generating Prisma Client and applying the schema..."
app_sh "npx prisma generate"
app_sh "npx prisma migrate deploy" || { info "migrate deploy failed; trying db push..."; app_sh "npx prisma db push"; }
info "Seeding initial data..."
app_sh "node prisma/seed.mjs" || warn "seed reported errors (data may already exist)."

# ══════════════════════════════════════════════════════════════════
#  Phase 7 — production build (as the service user)
# ══════════════════════════════════════════════════════════════════
info "Building for production (npm run build)..."
app_sh "npm run build" || fail "Build failed."

# ══════════════════════════════════════════════════════════════════
#  Phase 8 — PM2, running as the service user (never as root)
# ══════════════════════════════════════════════════════════════════
if command -v pm2 >/dev/null 2>&1; then
  info "PM2 is present ($(pm2 --version))."
else
  info "Installing PM2 (global)..."
  npm install -g pm2
fi
if ! as_app bash -lc 'command -v pm2 >/dev/null 2>&1'; then
  PM2_BIN="$(command -v pm2 || true)"
  [ -n "$PM2_BIN" ] && ln -sf "$PM2_BIN" /usr/local/bin/pm2
  warn "Linked pm2 into /usr/local/bin so '${APP_USER}' can use it."
fi

# PM2 ecosystem file (owned by the service user)
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
chown "$APP_USER":"$APP_GROUP" ecosystem.config.cjs 2>/dev/null || true

info "Starting ${APP_NAME} with PM2 as '${APP_USER}'..."
app_sh "pm2 startOrRestart ecosystem.config.cjs --update-env" || fail "PM2 could not start the app."
app_sh "pm2 save" || warn "pm2 save failed; the process will not survive a reboot until 'pm2 startup' is fixed."
# Autostart on boot for this user only (a separate PM2 instance per user).
pm2 startup systemd -u "$APP_USER" --hp "$APP_HOME" >/dev/null 2>&1 || \
  warn "pm2 startup failed; run: pm2 startup systemd -u ${APP_USER} --hp ${APP_HOME}"

# ══════════════════════════════════════════════════════════════════
#  Phase 9 — Nginx reverse proxy (config created if missing)
#  Nginx listens on a user-chosen port to avoid conflicts with
#  other services on the server.
# ══════════════════════════════════════════════════════════════════
NGINX_PORT="${NGINX_PORT:-$(ask "Port Nginx should listen on" "$DEFAULT_NGINX_PORT")}"
# Validate that the port is numeric and actually free (a port this very site
# already listens on is not a conflict, so re-runs keep it).
case "$NGINX_PORT" in ''|*[!0-9]*) NGINX_PORT="$DEFAULT_NGINX_PORT";; esac
if port_in_use "$NGINX_PORT" && ! nginx_owns_port "$NGINX_PORT"; then
  if ALT_PORT="$(free_port 8080 8099)"; then
    warn "Port ${NGINX_PORT} is already in use; using ${ALT_PORT} instead."
    NGINX_PORT="$ALT_PORT"
  else
    fail "Port ${NGINX_PORT} is in use and no free fallback was found; set NGINX_PORT."
  fi
fi
if ! command -v nginx >/dev/null 2>&1; then
  info "Installing Nginx..."
  apt-get install -y nginx
fi

# DOMAIN may already come from the environment (unattended install); only ask
# when it was not supplied.
if [ -n "$DOMAIN" ]; then
  info "Using the domain supplied from the environment: ${DOMAIN}"
else
  USE_DOMAIN="$(ask "Do you have a domain? (yes/no)" "no")"
  if [[ "${USE_DOMAIN,,}" == "y" || "${USE_DOMAIN,,}" == "yes" ]]; then
    DOMAIN="$(ask "Domain name (e.g., nobino.ir)" "")"
    [ -n "$DOMAIN" ] || DOMAIN=""
  fi
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
elif [ "$COEXIST" -eq 1 ]; then
  # Coexistence: Apache keeps 80/443. Nginx is a private proxy for one port
  # only, so nothing about the existing sites changes.
  info "Coexistence mode: Nginx answers on port ${NGINX_PORT} only (Apache keeps 80/443)."
  cat > "$NGINX_CONF" <<EOF
server {
    listen ${NGINX_PORT};
    server_name ${DOMAIN};

    client_max_body_size 20M;

${PROXY_BLOCK}
}
EOF
else
  # Standalone server with a domain: port 80 (for SSL) plus the chosen port
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

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/"${APP_NAME}.conf"

# The stock Nginx default site binds port 80. When Apache already owns 80,
# nginx refuses to start until that file is out of the way. Only the stock
# file is touched: any custom site is reported and left alone.
if [ -f /etc/nginx/sites-enabled/default ] && port_in_use 80; then
  if grep -q "Default server configuration" /etc/nginx/sites-enabled/default 2>/dev/null; then
    info "Disabling the stock Nginx default site (port 80 belongs to another service)."
    rm -f /etc/nginx/sites-enabled/default
  else
    warn "/etc/nginx/sites-enabled/default is not the stock file; leaving it untouched."
    warn "If nginx fails below, disable that site manually or pick another NGINX_PORT."
  fi
fi

if nginx -t; then
  if systemctl is-active --quiet nginx; then
    systemctl reload nginx || warn "nginx reload failed."
  else
    systemctl enable --now nginx || warn "nginx could not be started."
  fi
else
  warn "nginx -t failed; fix the config and run: nginx -t && systemctl restart nginx"
fi

# ══════════════════════════════════════════════════════════════════
#  Phase 10 — SSL (standalone servers only; Apache keeps its own certs)
# ══════════════════════════════════════════════════════════════════
case "${ENABLE_SSL,,}" in
  auto) if [ -n "$DOMAIN" ] && [ "$COEXIST" -eq 0 ]; then ENABLE_SSL=1; else ENABLE_SSL=0; fi ;;
  1|yes|true) ENABLE_SSL=1 ;;
  0|no|false) ENABLE_SSL=0 ;;
  *) warn "Unknown ENABLE_SSL='${ENABLE_SSL}'; skipping SSL."; ENABLE_SSL=0 ;;
esac

if [ "$ENABLE_SSL" -eq 1 ] && [ -n "$DOMAIN" ]; then
  SYSTEMD_EDITOR=true
  if ! command -v certbot >/dev/null 2>&1; then
    info "Installing Certbot..."
    apt-get install -y certbot python3-certbot-nginx
  fi
  certbot --nginx -d "$DOMAIN" -d "www.${DOMAIN}" --non-interactive --agree-tos \
    -m "${SSL_EMAIL:-$(ask "Email for the SSL certificate (optional)" "admin@${DOMAIN}")}" \
    --redirect || warn "certbot reported errors; rerun after fixing DNS: certbot --nginx -d ${DOMAIN}"
elif [ -n "$DOMAIN" ]; then
  info "SSL is left to Apache: Nginx serves plain HTTP on 127.0.0.1:${NGINX_PORT}."
  info "To publish Nobino on your existing HTTPS domain, add this to the Apache"
  info "vhost of ${DOMAIN} (a2enmod proxy proxy_http, then reload Apache):"
  cat <<SNIPPET

    ProxyPreserveHost On
    ProxyPass        / http://127.0.0.1:${NGINX_PORT}/ retry=0
    ProxyPassReverse / http://127.0.0.1:${NGINX_PORT}/

SNIPPET
  info "Nothing in /etc/apache2 was modified."
else
  info "No domain supplied; skipping SSL (the site is reachable on port ${NGINX_PORT})."
fi

# ══════════════════════════════════════════════════════════════════
#  Phase 11 — firewall (never surprises a running server)
# ══════════════════════════════════════════════════════════════════
case "${MANAGE_UFW,,}" in
  auto) if [ "$COEXIST" -eq 1 ]; then MANAGE_UFW=0; else MANAGE_UFW=1; fi ;;
  1|yes|true) MANAGE_UFW=1 ;;
  0|no|false) MANAGE_UFW=0 ;;
  *) warn "Unknown MANAGE_UFW='${MANAGE_UFW}'; leaving the firewall alone."; MANAGE_UFW=0 ;;
esac

if [ "$MANAGE_UFW" -eq 1 ]; then
  command -v ufw >/dev/null 2>&1 || apt-get install -y ufw
  info "Configuring the UFW firewall..."
  ufw allow 22/tcp >/dev/null || true
  ufw allow "${NGINX_PORT}/tcp" >/dev/null || true
  [ "$ENABLE_SSL" -eq 1 ] && ufw allow 443/tcp >/dev/null || true
  # The Next.js port stays private: Nginx proxies to 127.0.0.1:${PORT}.
  info "Keeping the internal app port (${PORT}) closed to the public."
  ufw --force enable || true
else
  info "Firewall left untouched (coexistence mode keeps the server exactly as it was)."
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
    warn "UFW is active: allow ${NGINX_PORT}/tcp yourself if you want the app reachable"
    warn "from outside, e.g.  ufw allow ${NGINX_PORT}/tcp"
  fi
fi

# ══════════════════════════════════════════════════════════════════
#  Phase 12 — summary
# ══════════════════════════════════════════════════════════════════
echo ""
echo "${C_GREEN}+------------------------------------------------------+${C_RESET}"
echo "${C_GREEN}|   Nobino deployed successfully                       |${C_RESET}"
echo "${C_GREEN}+------------------------------------------------------+${C_RESET}"
echo "  App directory : $APP_DIR  (owned by ${APP_USER})"
echo "  Service user  : ${APP_USER}  (the app never runs as root)"
echo "  Internal port : ${PORT}  (127.0.0.1 only)"
echo "  Nginx port    : ${NGINX_PORT}"
if [ -n "$DOMAIN" ] && [ "$ENABLE_SSL" -eq 1 ]; then
  echo "  Site URL      : https://${DOMAIN}"
elif [ "$COEXIST" -eq 1 ] && [ -n "$DOMAIN" ]; then
  echo "  Site URL      : https://${DOMAIN}  (via your Apache proxy)"
  echo "  Direct URL    : http://$(curl -4 -s ifconfig.me || echo 'IP_SERVER'):${NGINX_PORT}"
else
  echo "  Site URL      : http://$(curl -4 -s ifconfig.me || echo 'IP_SERVER'):${NGINX_PORT}"
fi
echo "  PM2 status    : sudo -u ${APP_USER} -H env PM2_HOME=${APP_HOME}/.pm2 pm2 status"
echo "  Logs          : sudo -u ${APP_USER} -H env PM2_HOME=${APP_HOME}/.pm2 pm2 logs ${APP_NAME}"
echo "  Database      : ${DB_NAME} (user: ${DB_USER})"
echo ""
echo "  Update later   : sudo bash ${APP_DIR}/scripts/deploy-ubuntu.sh"
echo "  (or pull a tag) : GIT_REF=v1.2.0 sudo bash ${APP_DIR}/scripts/deploy-ubuntu.sh"
echo ""
if [ "$COEXIST" -eq 1 ]; then
  info "Untouched on purpose: Apache + its sites/SSL, MySQL/MariaDB, PHP, and /var/www."
  [ "$MYSQL_PRESENT" -eq 1 ] && info "MySQL/MariaDB was not installed, restarted or reconfigured."
  info "Nginx only adds its own file: /etc/nginx/sites-available/${APP_NAME}.conf"
fi
warn "Default seeded admin: phone 09120000000 (default password in prisma/seed.mjs)."
warn "Change the password after the first login."
