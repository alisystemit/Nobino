#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════
#  Nobino — automated deployment on an Ubuntu VPS
#
#  Run from an existing checkout:  sudo bash scripts/deploy-ubuntu.sh
#  One-line install from GitHub:
#    curl -fsSL https://raw.githubusercontent.com/alisystemit/Nobino/main/scripts/install-from-github.sh | sudo bash
#
#  Behavior: a clean server gets everything installed; on a server that already
#            has Apache or Nginx, that server is reused and only a new site file
#            is added. Existing components are never reinstalled or rewritten.
#
#  * Bare server      : Node.js, PostgreSQL and Nginx are installed and
#                       configured from scratch.
#  * Existing Apache  : the project goes to /var/www/nobino and gets its own
#    or Nginx          vhost/site file with its own domain; only Apache/Nginx
#                       is reloaded. Other sites, their folders, domains and
#                       certificates are not edited.
#  * Domain conflict  : the other site keeps its domain; Nobino is published on
#                       its own free port (8080-8099) instead.
#  * Database         : PostgreSQL is the only database: installed when missing,
#                       reused when present. An existing role is never altered:
#                       if its password is unknown, a separate role + database
#                       (suffix) is created.
#  * PHP / MySQL      : not dependencies of this app. They are never installed,
#                       upgraded, restarted or reconfigured; an existing LAMP
#                       stack used by other sites keeps working untouched.
#  * The app runs as its own unprivileged user (never as root); the web server
#    only proxies to 127.0.0.1:PORT.
#
#  Environment overrides (all optional):
#    REPO_URL        git repository to clone      (default: public Nobino repo)
#    GIT_REF         branch/tag/commit to deploy  (default: main)
#    APP_USER        unprivileged service user    (default: nobino)
#    APP_HOME        home of that user            (default: /var/lib/nobino)
#    APP_DIR         install directory            (default: /var/www/nobino)
#    PORT            internal Next.js port        (default: 3000)
#    WEB_SERVER      auto|apache|nginx            (auto = reuse what exists,
#                                                  Nginx on a clean server)
#    WEB_PORT        public port                  (default: 80 with a free
#                                                  domain, else a free 8080-
#                                                  8099; an explicit value is
#                                                  honored, 80 needs a domain)
#    DOMAIN          own domain for this install  (empty = IP + port)
#    SSL_EMAIL       certbot contact email
#    MANAGE_UFW      auto|1|0  firewall (auto = only on a clean server)
#    ENABLE_SSL      auto|1|0  certbot for DOMAIN (auto = when port 80 + domain)
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
APP_USER="${APP_USER:-nobino}"
APP_HOME="${APP_HOME:-/var/lib/${APP_USER}}"
# Filled in after detection: /var/www/nobino next to the web server's sites.
APP_DIR="${APP_DIR:-}"
PORT="${PORT:-3000}"
NODE_REQUIRED="18"
# The public repository is the default source, so a bare Enter accepts it.
REPO_URL="${REPO_URL:-https://github.com/alisystemit/Nobino.git}"
GIT_REF="${GIT_REF:-main}"
# Pre-set DOMAIN/WEB_PORT/SSL_EMAIL to run unattended.
DOMAIN="${DOMAIN:-}"
MANAGE_UFW="${MANAGE_UFW:-auto}"
ENABLE_SSL="${ENABLE_SSL:-auto}"
# auto | apache | nginx  — which web server serves Nobino (auto = reuse one
# that is already on the server, or install Nginx on a clean server).
WEB_SERVER="${WEB_SERVER:-auto}"
PUBLIC_PORT_OVERRIDE="${WEB_PORT:-${NGINX_PORT:-}}"

APACHE_SITE="/etc/apache2/sites-available/${APP_NAME}.conf"
APACHE_SITE_LINK="/etc/apache2/sites-enabled/${APP_NAME}.conf"
APACHE_PORT_CONF="/etc/apache2/conf-available/${APP_NAME}-port.conf"
APACHE_DENY_CONF="/etc/apache2/conf-available/${APP_NAME}-deny.conf"
NGINX_CONF="/etc/nginx/sites-available/${APP_NAME}.conf"
NGINX_CONF_LINK="/etc/nginx/sites-enabled/${APP_NAME}.conf"

# ══════════════════════════════════════════════════════════════════
#  Phase 0a — inspect the server (read-only) and choose the integration
# ══════════════════════════════════════════════════════════════════
APACHE_PRESENT=0
if command -v apache2ctl >/dev/null 2>&1 || command -v apachectl >/dev/null 2>&1 ||
   [ -d /etc/apache2 ] || pgrep -x apache2 >/dev/null 2>&1; then
  APACHE_PRESENT=1
fi
NGINX_PRESENT=0
if command -v nginx >/dev/null 2>&1 || [ -d /etc/nginx ]; then NGINX_PRESENT=1; fi
# PHP and MySQL/MariaDB are not dependencies of Nobino: they are never detected
# for installation, installed, upgraded or reconfigured. Only PostgreSQL matters.
POSTGRES_PRESENT=0
if command -v psql >/dev/null 2>&1; then POSTGRES_PRESENT=1; fi

# Which web server will own the public port? An existing one is always reused
# (never replaced); only a server without any web server gets Nginx.
WEB_INSTALLED=0
case "${WEB_SERVER,,}" in
  apache)
    APACHE_PRESENT=1; WEB_KIND=apache ;;
  nginx)
    WEB_KIND=nginx ;;
  auto|'')
    if [ "$APACHE_PRESENT" -eq 1 ] && systemctl is-active --quiet apache2 2>/dev/null; then
      WEB_KIND=apache
    elif [ "$NGINX_PRESENT" -eq 1 ] && systemctl is-active --quiet nginx 2>/dev/null; then
      WEB_KIND=nginx
    elif [ "$APACHE_PRESENT" -eq 1 ]; then
      WEB_KIND=apache
    elif [ "$NGINX_PRESENT" -eq 1 ]; then
      WEB_KIND=nginx
    else
      WEB_KIND=nginx; WEB_INSTALLED=1
    fi ;;
  *)
    warn "Unknown WEB_SERVER='${WEB_SERVER}'; using auto."
    if [ "$APACHE_PRESENT" -eq 1 ]; then WEB_KIND=apache
    elif [ "$NGINX_PRESENT" -eq 1 ]; then WEB_KIND=nginx
    else WEB_KIND=nginx; WEB_INSTALLED=1; fi ;;
esac
if [ "$WEB_KIND" = "apache" ] && [ "$APACHE_PRESENT" -eq 0 ]; then
  fail "WEB_SERVER=apache was requested, but Apache is not installed."
fi
if [ "$WEB_KIND" = "nginx" ] && [ "$NGINX_PRESENT" -eq 0 ]; then
  WEB_INSTALLED=1
fi

[ "$WEB_INSTALLED" -eq 1 ] && info "Clean server: Nginx will be installed as the web server."
[ "$WEB_INSTALLED" -eq 0 ] && info "Existing ${WEB_KIND} detected — it will be reused, not replaced."
[ "$POSTGRES_PRESENT" -eq 1 ] && info "PostgreSQL client detected — Phase 1 reuses the server if one is running, or installs it."

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
# A re-run must keep the port that this install already uses (the site file it
# wrote earlier listens there, so a busy port can be our own).
our_site_uses_port() { # our_site_uses_port <port>
  { [ -f "$NGINX_CONF" ] && grep -qE "^[[:space:]]*listen[[:space:]]+$1([[:space:];]|$)" "$NGINX_CONF" 2>/dev/null; } && return 0
  { [ -f "$APACHE_SITE" ] && grep -qE "<VirtualHost[[:space:]]+\*:$1>" "$APACHE_SITE" 2>/dev/null; } && return 0
  return 1
}

# ─── The project lives next to the existing sites, not in /opt ────
if [ -z "$APP_DIR" ]; then
  if [ -d "/var/www/$APP_NAME" ]; then
    APP_DIR="/var/www/$APP_NAME"
  elif [ -d "/opt/$APP_NAME" ]; then
    APP_DIR="/opt/$APP_NAME"          # layout of older installs
  else
    APP_DIR="/var/www/$APP_NAME"      # web root used by Apache and Nginx (Debian/Ubuntu)
  fi
fi
APP_DIR="${APP_DIR%/}"

# ─── Dedicated unprivileged user: the app never runs as root ──────
if id -u "$APP_USER" >/dev/null 2>&1; then
  info "Service user '${APP_USER}' already exists; reusing it."
else
  info "Creating the service user '${APP_USER}'..."
  useradd --system --create-home --home-dir "$APP_HOME" --shell /bin/bash "$APP_USER" \
    || fail "Could not create the service user '${APP_USER}'."
fi
APP_GROUP="$(id -gn "$APP_USER")"

# ─── Making the Node.js toolchain visible to the service user ──────
# nvm installs node under /usr/local/nvm/versions/node/<ver>/bin, which a
# plain login shell of another user does not have on its PATH. Everything the
# app user runs (npm, npx, prisma, pm2) lives in that directory or in the npm
# global bin directory, so both are exported explicitly.
APP_PATH_EXTRA=""
node_path_for_app() {
  local node_dir prefix out=""
  node_dir="$(dirname "$(command -v node 2>/dev/null || echo /usr/local/bin/node)")"
  out="$node_dir"
  prefix="$(npm config get prefix 2>/dev/null || true)"
  if [ -n "$prefix" ] && [ -d "$prefix/bin" ]; then
    out="$out:$prefix/bin"
  fi
  printf '%s' "$out"
}
link_for_app() { # link_for_app <name> — expose an executable root sees to the app user
  local name="$1" src
  as_app bash -lc "command -v $name >/dev/null 2>&1" && return 0
  src="$(command -v "$name" 2>/dev/null || true)"
  if [ -z "$src" ]; then
    return 1
  fi
  if ln -sf "$src" "/usr/local/bin/$name" 2>/dev/null; then
    info "Linked $name into /usr/local/bin so '${APP_USER}' can use it."
    return 0
  fi
  return 1
}

is_domain_name() { # is_domain_name <host> — a real dotted name, not an IP or localhost
  local h="${1:-}"
  if [ -z "$h" ] || [ "$h" = "localhost" ]; then
    return 1
  fi
  if [[ "$h" =~ ^[0-9.]+$ ]]; then
    return 1
  fi
  [[ "$h" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]]
}
root_domain_of() { # root_domain_of <host> — the domain the salon subdomains hang under
  local h="${1:-}"
  if ! is_domain_name "$h"; then
    printf 'localhost'
  elif [[ "$h" == *.*.* ]]; then
    printf '%s' "${h#*.}"          # bots.example.com -> example.com
  else
    printf '%s' "$h"               # already a bare domain: example.com -> example.com
  fi
}
url_host_of() { # url_host_of <url> — the host part of http(s)://host:port/path
  printf '%s' "${1:-}" | sed -e 's|^[A-Za-z][A-Za-z0-9+.-]*://||' -e 's|[/?#].*$||' -e 's|:[0-9]*$||'
}

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
  # The service user's login shell does not see the nvm version directory, so
  # npx (and every later global install) would be "command not found" there.
  # Prepend node's own directory and the npm global bin directory to its PATH.
  if [ -z "$APP_PATH_EXTRA" ]; then
    APP_PATH_EXTRA="$(node_path_for_app)"
  fi
  as_app bash -lc "cd '$APP_DIR' && export PATH=\"$APP_PATH_EXTRA:\$PATH\" && $1"
}

# ─── Own domain: every install gets its own vhost/site file ───────
if [ -z "$DOMAIN" ]; then
  DOMAIN="$(ask "Your own domain for Nobino (empty = serve on IP and a port)" "")"
fi
DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN%/}"; DOMAIN="${DOMAIN,,}"
if [ -n "$DOMAIN" ] && ! [[ "$DOMAIN" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]]; then
  warn "'${DOMAIN}' is not a valid domain name; continuing without one."
  DOMAIN=""
fi
[ -n "$DOMAIN" ] && info "Nobino will be published on its own domain: ${DOMAIN}"

# ══════════════════════════════════════════════════════════════════
#  Phase 0b — decide how Nobino is published, before anything is installed
#  Every install owns its domain. If that domain already serves another site,
#  that site is left alone and Nobino is published on a free port instead.
# ══════════════════════════════════════════════════════════════════
# ─── port-decision:start ───
domain_taken() { # domain_taken <domain> — is it served by another site already?
  local d="${1:-}" esc
  [ -n "$d" ] || return 1
  esc="${d//./\\.}"
  if [ "$WEB_KIND" = "apache" ]; then
    grep -RIsE "Server(Name|Alias)[^#]*[[:space:]]${esc}([[:space:]]|$)" \
      /etc/apache2/sites-enabled/ /etc/apache2/apache2.conf 2>/dev/null \
      | grep -v "${APP_NAME}" | grep -q . && return 0
  else
    grep -RIsE "server_name[^;]*[[:space:]]${esc}([[:space:];]|$)" \
      /etc/nginx/sites-enabled/ 2>/dev/null \
      | grep -v "${APP_NAME}" | grep -q . && return 0
  fi
  return 1
}
prior_public_port() { # the port this install used on an earlier run, if any
  if [ -f "$NGINX_CONF" ]; then
    sed -nE 's/^[[:space:]]*listen[[:space:]]+([0-9]+).*/\1/p' "$NGINX_CONF" | head -1
  elif [ -f "$APACHE_SITE" ]; then
    sed -nE 's/.*<VirtualHost[[:space:]]+\*:([0-9]+)>.*/\1/p' "$APACHE_SITE" | head -1
  fi
}

DOMAIN_TAKEN=0
DEDICATED_PORT=0
if [ -z "$DOMAIN" ]; then
  DEDICATED_PORT=1
elif domain_taken "$DOMAIN"; then
  DOMAIN_TAKEN=1
  warn "The domain '${DOMAIN}' is already used by another site on this server."
  warn "It will not be touched; Nobino is published on its own port instead."
  DEDICATED_PORT=1
fi

PUBLIC_PORT=80
# An explicit WEB_PORT is honored even when the domain itself is free.
if [ -n "$PUBLIC_PORT_OVERRIDE" ] && [[ "$PUBLIC_PORT_OVERRIDE" =~ ^[0-9]+$ ]]; then
  PUBLIC_PORT="$PUBLIC_PORT_OVERRIDE"
fi

# Port 80 is only shared through name-based vhosts, which needs a free domain;
# otherwise Nobino gets a port of its own and no other site can be shadowed.
if [ "$PUBLIC_PORT" != "80" ]; then
  DEDICATED_PORT=1
elif [ -z "$DOMAIN" ] || [ "$DOMAIN_TAKEN" -eq 1 ]; then
  DEDICATED_PORT=1
  if [ -n "$PUBLIC_PORT_OVERRIDE" ]; then
    warn "WEB_PORT=80 cannot be used without a free domain; choosing a dedicated port."
  fi
fi

if [ "$DEDICATED_PORT" -eq 1 ]; then
  # No explicit port: keep the one from an earlier run, else pick a free one.
  if [ "$PUBLIC_PORT" = "80" ]; then
    PRIOR_PORT="$(prior_public_port)"
    if [ -n "$PRIOR_PORT" ] && [ "$PRIOR_PORT" != "80" ]; then
      PUBLIC_PORT="$PRIOR_PORT"
    elif FREE_WEB_PORT="$(free_port 8080 8099)"; then
      PUBLIC_PORT="$FREE_WEB_PORT"
    else
      fail "No free port found in 8080-8099; set WEB_PORT to a free port."
    fi
  fi
  if port_in_use "$PUBLIC_PORT" && ! our_site_uses_port "$PUBLIC_PORT"; then
    if ALT_PORT="$(free_port 8080 8099)"; then
      warn "Port ${PUBLIC_PORT} is already in use; using ${ALT_PORT} instead."
      PUBLIC_PORT="$ALT_PORT"
    else
      fail "Port ${PUBLIC_PORT} is in use and no free fallback was found; set WEB_PORT."
    fi
  fi
  info "Nobino will answer directly on port ${PUBLIC_PORT} (no other site is touched)."
else
  info "Nobino will answer on port 80 for its own domain: ${DOMAIN}"
fi
# ─── port-decision:end ───

SERVER_IP="$(curl -4 -s --max-time 5 ifconfig.me 2>/dev/null || true)"
SERVER_IP="${SERVER_IP:-IP_SERVER}"
if [ "$DEDICATED_PORT" -eq 1 ]; then
  PUBLIC_BASE="http://${DOMAIN:-$SERVER_IP}:${PUBLIC_PORT}"
else
  PUBLIC_BASE="https://${DOMAIN}"
fi
info "Public address of this install: ${PUBLIC_BASE}"

# ══════════════════════════════════════════════════════════════════
#  Phase 0 — system prerequisites (missing only)
# ══════════════════════════════════════════════════════════════════
info "Checking and installing base prerequisites (apt)..."
apt-get update -y
# apache2, php*, mysql-server and mariadb-server are deliberately absent:
# this app needs none of them. An existing LAMP stack belongs to other sites
# and is never installed, upgraded or reconfigured here. PostgreSQL is the only
# database and is installed in Phase 1, only when it is really missing.
apt-get install -y \
  curl wget git ca-certificates gnupg lsb-release \
  openssl build-essential python3 make g++ \
  || warn "Some packages failed to install; continuing."
if [ "$WEB_INSTALLED" -eq 1 ]; then
  info "Installing Nginx (this server has no web server yet)..."
  apt-get install -y nginx || fail "Nginx could not be installed."
fi

# ══════════════════════════════════════════════════════════════════
#  Phase 1 — PostgreSQL — the only database this app uses
#  Absent  → installed and configured from scratch.
#  Present → reused; an existing role and its password are never changed.
# ══════════════════════════════════════════════════════════════════
EXISTING_URL=""
DB_USER="nobino"
DB_NAME="nobino"
DB_PASS=""
DB_HOST="localhost"
DB_PORT="5432"
DB_CONFLICT=0

# A previous .env wins: its credentials are reused exactly as they are.
if [ -f "$APP_DIR/.env" ] && grep -q '^DATABASE_URL=' "$APP_DIR/.env"; then
  EXISTING_URL="$(grep '^DATABASE_URL=' "$APP_DIR/.env" | head -1 | cut -d= -f2- | tr -d '"')"
  info "Using the existing DATABASE_URL from $APP_DIR/.env"
fi

# Parse user / password / host / port / database out of the existing URL, so a
# re-run reuses the same credentials instead of resetting them.
if [ -n "$EXISTING_URL" ] && [[ "$EXISTING_URL" =~ ^postgres(ql)?://([^:@/]+)(:([^@]*))?@([^:/?]+)(:([0-9]+))?/([^?]+) ]]; then
  DB_USER="${BASH_REMATCH[2]}"
  DB_PASS="${BASH_REMATCH[4]}"
  DB_HOST="${BASH_REMATCH[5]}"
  DB_PORT="${BASH_REMATCH[7]:-$DB_PORT}"
  DB_NAME="${BASH_REMATCH[8]}"
fi

# Only a local cluster is managed here. A managed or remote database means no
# PostgreSQL server is installed on this machine at all.
LOCAL_DB=1
case "$DB_HOST" in
  localhost|127.0.0.1|::1|unix|'') : ;;
  *) LOCAL_DB=0 ;;
esac

as_postgres() {
  if command -v sudo >/dev/null 2>&1; then sudo -u postgres "$@";
  elif command -v runuser >/dev/null 2>&1; then runuser -u postgres -- "$@";
  else su postgres -c "$*"; fi
}
run_psql() { as_postgres psql -v ON_ERROR_STOP=1 -tAc "$1"; }
pg_can_login() { # pg_can_login <user> <password> — do these credentials work?
  [ -n "$2" ] || return 1
  PGPASSWORD="$2" psql -h 127.0.0.1 -p "${DB_PORT:-5432}" -U "$1" -d postgres -tAc 'SELECT 1' >/dev/null 2>&1
}
pg_accepting() { # does some cluster actually answer connections?
  if command -v pg_isready >/dev/null 2>&1; then
    pg_isready -q -h 127.0.0.1 -p "${DB_PORT:-5432}" 2>/dev/null && return 0
    return 1
  fi
  command -v psql >/dev/null 2>&1 && as_postgres psql -tAc 'SELECT 1' >/dev/null 2>&1
}
pg_wait() { # give a started or freshly installed cluster time to come up
  local i
  for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    pg_accepting && return 0
    sleep 1
  done
  return 1
}

if [ "$LOCAL_DB" -eq 0 ]; then
  info "DATABASE_URL points at ${DB_HOST}: no local database server is needed, so nothing is installed."
elif pg_accepting; then
  info "PostgreSQL is already running ($(psql --version 2>/dev/null | awk '{print $3}')) — the existing server is reused."
else
  if command -v psql >/dev/null 2>&1; then
    info "PostgreSQL client found but no running cluster; starting the service..."
    systemctl enable --now postgresql >/dev/null 2>&1 || true
  fi
  if ! pg_wait; then
    info "Installing PostgreSQL (this app's only database)..."
    apt-get install -y postgresql postgresql-contrib || \
      fail "PostgreSQL could not be installed; install it and rerun this script."
    systemctl enable --now postgresql >/dev/null 2>&1 || true
    pg_wait || warn "PostgreSQL is installed but no cluster answers yet: systemctl start postgresql"
  fi
fi

DB_USER="$(ask "Database user" "$DB_USER")"
DB_NAME="$(ask "Database name" "$DB_NAME")"
if [ -n "$EXISTING_URL" ]; then
  DATABASE_URL="$EXISTING_URL"
else
  DB_PASS="$(ask "Database password (empty = auto-generate)" "")"
  if [ -z "$DB_PASS" ]; then DB_PASS="$(openssl rand -hex 16)"; fi
  DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}?schema=public"
fi

info "Ensuring the PostgreSQL user and database exist..."
# Create only if missing (never destroy existing data).

if [ "$LOCAL_DB" -eq 0 ]; then
  warn "DATABASE_URL points at ${DB_HOST} (not local); skipping role/database creation."
elif ! run_psql "SELECT 1" >/dev/null 2>&1; then
  warn "Cannot reach the local PostgreSQL cluster (is the service running?). Start it and rerun: systemctl start postgresql"
else
  if ! [[ "$DB_NAME" =~ ^[A-Za-z0-9_]+$ ]] || ! [[ "$DB_USER" =~ ^[A-Za-z0-9_]+$ ]]; then
    fail "Database user/name may only contain letters, digits and underscores."
  fi

  # An existing role is never altered (its password belongs to someone else),
  # and an existing database is never taken over. On any doubt, a separate
  # role + database are created so the previous install keeps working.
  DB_CONFLICT=0
  CONFLICT_REASON=""
  if [ -z "$EXISTING_URL" ]; then
    ROLE_EXISTS="$(run_psql "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")"
    DB_EXISTS="$(run_psql "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")"
    if [ "$ROLE_EXISTS" = "1" ] && ! pg_can_login "$DB_USER" "$DB_PASS"; then
      DB_CONFLICT=1
      CONFLICT_REASON="role '${DB_USER}' already exists with a password this installer does not know"
    elif [ "$DB_EXISTS" = "1" ]; then
      DB_OWNER="$(run_psql "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname='${DB_NAME}'")"
      if [ "$DB_OWNER" != "$DB_USER" ]; then
        DB_CONFLICT=1
        CONFLICT_REASON="database '${DB_NAME}' already exists and belongs to '${DB_OWNER:-another role}'"
      fi
    fi
  fi

  if [ "$DB_CONFLICT" -eq 1 ]; then
    BASE_USER="$DB_USER"; BASE_NAME="$DB_NAME"
    SUFFIX="$(date +%s)"; SUFFIX="${SUFFIX: -4}"
    DB_USER="${BASE_USER}_${SUFFIX}"
    DB_NAME="${BASE_NAME}_${SUFFIX}"
    # Extremely unlikely, but never collide with another role/database.
    i=1
    while [ "$(run_psql "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")" = "1" ] ||
          [ "$(run_psql "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")" = "1" ]; do
      DB_USER="${BASE_USER}_${SUFFIX}${i}"; DB_NAME="${BASE_NAME}_${SUFFIX}${i}"; i=$((i+1))
    done
    DB_PASS="$(openssl rand -hex 16)"
    DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:${DB_PORT:-5432}/${DB_NAME}?schema=public"
    warn "${CONFLICT_REASON}."
    warn "Creating a separate role/database (${DB_USER} / ${DB_NAME}) so the old one is not touched."
  fi

  if [ "$(run_psql "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")" != "1" ]; then
    if [ -z "$DB_PASS" ]; then
      fail "No password available for role '${DB_USER}'. Set DATABASE_URL (or a new password) and rerun."
    fi
    as_postgres psql -c "CREATE ROLE \"${DB_USER}\" LOGIN PASSWORD '${DB_PASS}';" >/dev/null
    info "Database user created."
  else
    info "Database user already exists; its password is left unchanged."
  fi
  if [ "$(run_psql "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")" != "1" ]; then
    as_postgres createdb -O "$DB_USER" "$DB_NAME"
    info "Database created."
  else
    info "Database already existed; its data is kept."
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
for tool in node npm npx corepack; do
  link_for_app "$tool" || true
done
if ! as_app bash -lc 'command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1'; then
  fail "node/npm are not usable by '${APP_USER}'. Install Node.js ${NODE_REQUIRED}+ system-wide and rerun."
fi
# Node may have been installed above: refresh the PATH handed to app_sh so the
# service user also reaches npx and anything installed globally later (pm2).
APP_PATH_EXTRA="$(node_path_for_app)"
info "Toolchain for '${APP_USER}': PATH+=${APP_PATH_EXTRA}"

# ══════════════════════════════════════════════════════════════════
#  Phase 3 — fetch the code (clone from GitHub, or update in place)
# ══════════════════════════════════════════════════════════════════
# Git refuses to operate on a directory owned by another user; on a VPS the
# app folder is often owned by www-data while this script runs as root.
if [ -n "$APP_DIR" ]; then
  git config --global --add safe.directory "$APP_DIR" >/dev/null 2>&1 || true
fi

# Bring the working tree to $GIT_REF (branch, tag or commit).
checkout_ref() {
  # Never discard hand-edited files on the server: a dirty tree is left alone.
  # package-lock.json is excluded because `npm install` legitimately rewrites it
  # on the server (different npm version) and that must not block updates.
  local dirty head_ref new_ref
  dirty="$(git -C "$APP_DIR" status --porcelain --untracked-files=no 2>/dev/null | grep -v ' package-lock.json$' || true)"
  if [ -n "$dirty" ]; then
    warn "$APP_DIR has uncommitted changes; not touching the working tree."
    printf '%s\n' "$dirty" | sed -n '1,15p;s/^/          /'
    if [ "$(printf '%s\n' "$dirty" | wc -l)" -gt 15 ]; then
      warn "...and more."
    fi
    # Say out loud when that means the server keeps running stale code, since a
    # stale package.json is what usually makes the dependency step fail later.
    head_ref="$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo '?')"
    new_ref="$(git -C "$APP_DIR" rev-parse --short "origin/$GIT_REF" 2>/dev/null || true)"
    if [ -n "$new_ref" ] && [ "$head_ref" != "$new_ref" ]; then
      warn "Code stays at ${head_ref} while origin/${GIT_REF} is ${new_ref}; this run installs the OLD code."
      warn "To update: git -C ${APP_DIR} diff          (see the edits)"
      warn "             git -C ${APP_DIR} stash && sudo bash ${APP_DIR}/scripts/deploy-ubuntu.sh"
    fi
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
    warn "There is no .git here, so this run cannot update the code from GitHub; the"
    warn "dependency step will keep failing on whatever package.json is on this disk."
    warn "Make it a checkout (your .env stays): cp $APP_DIR/.env /root/nobino.env.bak"
    warn "  then: rm -rf $APP_DIR && git clone --branch $GIT_REF $REPO $APP_DIR && cp /root/nobino.env.bak $APP_DIR/.env"
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
#  Phase 4 — npm dependencies (reuse an existing node_modules)
# ══════════════════════════════════════════════════════════════════
DEPS_OK=0
if [ -d node_modules ]; then
  info "node_modules exists; updating dependencies incrementally (npm install)..."
  app_sh "npm install --no-audit --no-fund" && DEPS_OK=1
elif [ -f package-lock.json ]; then
  info "Installing dependencies from package-lock.json (npm ci)..."
  if app_sh "npm ci --no-audit --no-fund"; then
    DEPS_OK=1
  else
    warn "npm ci failed; trying npm install..."
    app_sh "npm install --no-audit --no-fund" && DEPS_OK=1
  fi
else
  info "Installing dependencies (npm install)..."
  app_sh "npm install --no-audit --no-fund" && DEPS_OK=1
fi
if [ "$DEPS_OK" -eq 0 ]; then
  fail "npm could not install the dependencies. This is usually an ERESOLVE peer conflict: fetch the current repository (its package-lock.json is committed) and rerun. Update first with: git -C ${APP_DIR} pull --ff-only"
fi

# ══════════════════════════════════════════════════════════════════
#  Phase 5 — .env file (created from .env.example if missing)
# ══════════════════════════════════════════════════════════════════
ENV_PREEXISTED=1
if [ ! -f .env ]; then
  ENV_PREEXISTED=0
  info "Creating .env from .env.example..."
  [ -f .env.example ] || fail ".env.example not found."
  cp .env.example .env

  # App URL: the address decided in Phase 0b (own domain, or IP + own port).
  if [ -z "${APP_URL:-}" ]; then
    APP_URL="$(ask "Public app URL" "$PUBLIC_BASE")"
  fi
  # Root domain for the salon subdomains: the domain the app URL host sits on,
  # so typing http://bots.example.com gets example.com, not "localhost".
  if [ -z "${ROOT_DOMAIN:-}" ]; then
    URL_HOST="$(url_host_of "$APP_URL")"
    ROOT_DEFAULT="$(root_domain_of "${DOMAIN:-$URL_HOST}")"
    if [ "$ROOT_DEFAULT" = "localhost" ]; then
      info "No domain behind this address (IP or localhost): subdomain per salon is unavailable."
    fi
    ROOT_DOMAIN="$(ask "Root domain (for subdomains)" "$ROOT_DEFAULT")"
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
  set_env_var NEXT_PUBLIC_SITE_URL "${APP_FROM_ENV:-$PUBLIC_BASE}"
fi
# An existing .env is never rewritten silently, but a stale address is worth a warning.
ENV_URL="$(grep '^NEXT_PUBLIC_APP_URL=' .env | head -1 | cut -d= -f2- | tr -d '"')"
if [ "$ENV_PREEXISTED" -eq 1 ] && [ -n "$ENV_URL" ] && [ -z "${APP_URL:-}" ] && [ "$ENV_URL" != "$PUBLIC_BASE" ]; then
  warn ".env still points at ${ENV_URL}, while this install publishes at ${PUBLIC_BASE}."
  warn "To adopt the new address: APP_URL=${PUBLIC_BASE} sudo bash ${APP_DIR}/scripts/deploy-ubuntu.sh"
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
app_sh "npx prisma generate" || fail "prisma generate failed; the npm output above has the reason."
# `migrate deploy` happily says "No pending migrations to apply." on an empty
# database, so the schema has to be pushed when the repo carries no migrations.
if [ -d prisma/migrations ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  if app_sh "npx prisma migrate deploy"; then
    info "Migrations applied."
  else
    info "migrate deploy failed; trying db push..."
    app_sh "npx prisma db push" \
      || fail "Prisma could not create the schema. Check DATABASE_URL in ${APP_DIR}/.env (a fresh PostgreSQL role needs the password the script generated for it)."
  fi
else
  info "No prisma/migrations in the repository; creating the schema with db push..."
  app_sh "npx prisma db push" \
    || fail "Prisma could not create the schema. Check DATABASE_URL in ${APP_DIR}/.env and run 'npx prisma db push' by hand to read any prompt."
fi
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
  npm install -g pm2 || fail "Could not install PM2 globally."
fi
hash -r 2>/dev/null || true
# pm2 was just placed in the npm global bin directory: let app_sh see it and
# give the service user its own link.
APP_PATH_EXTRA="$(node_path_for_app)"
link_for_app pm2 || warn "pm2 is not visible to '${APP_USER}'; the PM2 step will fail."

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

# ─── Did it actually come up? ───────────────────────────────────────
# Next.js needs a few seconds after PM2 says "online", and a database whose
# tables were never created answers with an error page instead of the app. So:
# retry, then show the log tail rather than declaring a silent success.
wait_for_app() {
  local i code=""
  for i in 1 2 3 4 5 6 7 8 9 10; do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${PORT}/" 2>/dev/null || true)"
    case "$code" in
      200|301|302|307) info "Health check: HTTP ${code} — the app is serving."; return 0 ;;
      000|"") sleep 2 ;;
      *) warn "Health check: HTTP ${code} — the app answers but reports an error."; return 2 ;;
    esac
  done
  warn "Health check: 127.0.0.1:${PORT} did not answer."
  return 1
}
HEALTH=0
wait_for_app || HEALTH=$?
if [ "$HEALTH" -ne 0 ]; then
  app_sh "pm2 logs ${APP_NAME} --lines 30 --nostream" || true
  warn "If the log says 'The table public.X does not exist', the schema was never created. Fix it with: sudo -u ${APP_USER} -H bash -lc 'cd ${APP_DIR} && npx prisma db push && node prisma/seed.mjs' && sudo -u ${APP_USER} -H pm2 restart ${APP_NAME} --update-env"
fi

# ══════════════════════════════════════════════════════════════════
#  Phase 9 — write the site/vhost decided in Phase 0b
#  An existing Apache/Nginx is reused; only a new site file is added and the
#  server is reloaded. Sites, domains and certificates of other apps are never
#  edited, and Nobino keeps its own domain (or its own port).
# ══════════════════════════════════════════════════════════════════
WEB_OK=0

# ─── Which names this site file answers for ────────────────────────
# Its own domain plus the salon subdomains under the root domain. A wildcard
# another site already owns is never added: each app keeps its own domains.
SITE_HOST="${DOMAIN:-}"
if [ -z "$SITE_HOST" ]; then
  SITE_HOST="$(url_host_of "$(grep -m1 '^NEXT_PUBLIC_APP_URL=' "$APP_DIR/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)")"
fi
if ! is_domain_name "$SITE_HOST"; then
  SITE_HOST=""
fi
SUB_ROOT="${ROOT_DOMAIN:-}"
if [ -z "$SUB_ROOT" ]; then
  SUB_ROOT="$(grep -m1 '^NEXT_PUBLIC_ROOT_DOMAIN=' "$APP_DIR/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)"
fi
if [ -z "$SUB_ROOT" ] || [ "$SUB_ROOT" = "localhost" ]; then
  SUB_ROOT="$(root_domain_of "${SITE_HOST:-}")"
  if [ "$SUB_ROOT" = "localhost" ]; then
    SUB_ROOT=""
  fi
fi
if [ -n "$SUB_ROOT" ] && ! is_domain_name "$SUB_ROOT"; then
  warn "Ignoring an unusable root domain for subdomains: ${SUB_ROOT}"
  SUB_ROOT=""
fi
if [ -n "$SITE_HOST" ] && [ -z "${DOMAIN:-}" ]; then
  info "The site file will answer for ${SITE_HOST}, published on port ${PUBLIC_PORT}."
fi

wildcard_claimed() { # wildcard_claimed <root> — does another site already serve *.<root>?
  local root="${1:-}" name="*.${1:-}"
  [ -n "$root" ] || return 1
  if [ "$WEB_KIND" = "apache" ]; then
    grep -RFI "ServerAlias ${name}" /etc/apache2/sites-enabled/ /etc/apache2/conf-enabled/ 2>/dev/null \
      | grep -v "${APP_NAME}" | grep -q . && return 0
  else
    grep -RFI "$name" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null \
      | grep -v "${APP_NAME}" | grep -q . && return 0
  fi
  return 1
}

WILDCARD_ROOT=""
if [ -n "$SITE_HOST" ] && [ -n "$SUB_ROOT" ]; then
  if wildcard_claimed "$SUB_ROOT"; then
    warn "Another site already serves *.${SUB_ROOT}; Nobino keeps only ${SITE_HOST} on this server."
    SUB_ROOT=""
  else
    WILDCARD_ROOT="$SUB_ROOT"
  fi
fi

if [ "$WEB_KIND" = "apache" ]; then
  # ── Apache: new vhost + optional extra port, existing sites untouched ──
  APACHE_CTL="apache2ctl"
  command -v apache2ctl >/dev/null 2>&1 || APACHE_CTL="apachectl"
  if command -v a2enmod >/dev/null 2>&1; then
    a2enmod proxy proxy_http headers >/dev/null 2>&1 || \
      warn "Could not enable proxy modules; check 'a2enmod proxy proxy_http headers'."
  fi

  if [ "$DEDICATED_PORT" -eq 1 ]; then
    if [ -d /etc/apache2/conf-available ]; then
      printf '%s\n' "# Managed by Nobino: one additional port for its own vhost." \
        "Listen ${PUBLIC_PORT}" > "$APACHE_PORT_CONF"
      a2enconf "${APP_NAME}-port" >/dev/null 2>&1 || \
        ln -sf "$APACHE_PORT_CONF" "/etc/apache2/conf-enabled/${APP_NAME}-port.conf"
    else
      warn "Apache has no conf-available directory; add 'Listen ${PUBLIC_PORT}' to ports.conf manually."
    fi
  elif [ -f "$APACHE_PORT_CONF" ]; then
    # A previous run published Nobino on a dedicated port; this run uses 80.
    command -v a2disconf >/dev/null 2>&1 && a2disconf "${APP_NAME}-port" >/dev/null 2>&1
    rm -f "$APACHE_PORT_CONF" "/etc/apache2/conf-enabled/${APP_NAME}-port.conf"
  fi

  # The project folder is inside /var/www; never let it be served as plain files
  # (the .env lives there). This block only applies to filesystem requests.
  case "$APP_DIR" in
    /var/www/*)
      if [ -d /etc/apache2/conf-available ]; then
        cat > "$APACHE_DENY_CONF" <<EOF
# Managed by Nobino: block direct file access to the project sources.
<Directory "${APP_DIR}">
    Options -Indexes
    Require all denied
</Directory>
EOF
        a2enconf "${APP_NAME}-deny" >/dev/null 2>&1 || \
          ln -sf "$APACHE_DENY_CONF" "/etc/apache2/conf-enabled/${APP_NAME}-deny.conf"
      fi ;;
  esac

  SERVER_NAME_LINE=""
  if [ -n "$SITE_HOST" ]; then
    SERVER_NAME_LINE="    ServerName ${SITE_HOST}"
    if [ -n "$WILDCARD_ROOT" ]; then
      SERVER_NAME_LINE="${SERVER_NAME_LINE}
    ServerAlias *.${WILDCARD_ROOT}"
    fi
  fi
  cat > "$APACHE_SITE" <<EOF
# Managed by Nobino — do not edit other vhosts; each app keeps its own domain.
<VirtualHost *:${PUBLIC_PORT}>
${SERVER_NAME_LINE}
    ProxyPreserveHost On
    ProxyRequests Off
    AllowEncodedSlashes NoDecode
    ProxyPass        / http://127.0.0.1:${PORT}/ retry=0 connectiontimeout=5 timeout=60
    ProxyPassReverse / http://127.0.0.1:${PORT}/
    RequestHeader set X-Forwarded-Proto "http"
    RequestHeader set X-Forwarded-Proto "https" env=HTTPS
    ErrorLog \${APACHE_LOG_DIR}/${APP_NAME}-error.log
    CustomLog \${APACHE_LOG_DIR}/${APP_NAME}-access.log combined
</VirtualHost>
EOF
  if command -v a2ensite >/dev/null 2>&1; then
    a2ensite "$APP_NAME" >/dev/null 2>&1 || ln -sf "$APACHE_SITE" "$APACHE_SITE_LINK"
  else
    ln -sf "$APACHE_SITE" "$APACHE_SITE_LINK"
  fi

  if "$APACHE_CTL" configtest >/dev/null 2>&1; then
    if systemctl is-active --quiet apache2 2>/dev/null; then
      systemctl reload apache2 >/dev/null 2>&1 || systemctl restart apache2 >/dev/null 2>&1 || true
    else
      systemctl enable --now apache2 >/dev/null 2>&1 || true
    fi
    if systemctl is-active --quiet apache2 2>/dev/null; then
      WEB_OK=1
      info "Apache vhost created: ${APACHE_SITE}"
    else
      warn "Apache did not start; check '${APACHE_CTL} configtest'."
    fi
  else
    warn "Apache config test failed; rolling back the Nobino vhost."
    command -v a2dissite >/dev/null 2>&1 && a2dissite "$APP_NAME" >/dev/null 2>&1
    rm -f "$APACHE_SITE_LINK"
    [ -f "$APACHE_PORT_CONF" ] && { command -v a2disconf >/dev/null 2>&1 && a2disconf "${APP_NAME}-port" >/dev/null 2>&1; rm -f "/etc/apache2/conf-enabled/${APP_NAME}-port.conf"; }
    "$APACHE_CTL" configtest >/dev/null 2>&1 && systemctl reload apache2 >/dev/null 2>&1 || true
  fi

else
  # ── Nginx: one site file; existing sites and their domains stay as they are ──
  if ! command -v nginx >/dev/null 2>&1; then
    info "Installing Nginx..."
    apt-get install -y nginx || fail "Nginx could not be installed."
  fi
  NGINX_SERVER_NAME="${SITE_HOST:-_}"
  if [ -n "$WILDCARD_ROOT" ]; then
    NGINX_SERVER_NAME="${NGINX_SERVER_NAME} *.${WILDCARD_ROOT}"
  fi
  cat > "$NGINX_CONF" <<EOF
# Managed by Nobino — each app keeps its own site file and domain.
server {
    listen ${PUBLIC_PORT};
    server_name ${NGINX_SERVER_NAME};

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
}
EOF
  ln -sf "$NGINX_CONF" "$NGINX_CONF_LINK"

  # On a clean server the stock site owns port 80 as default_server; it is
  # only disabled there (it is the stock file, kept in sites-available).
  if [ "$WEB_INSTALLED" -eq 1 ] && [ "$PUBLIC_PORT" = "80" ] &&
     [ -f /etc/nginx/sites-enabled/default ] &&
     grep -q "Default server configuration" /etc/nginx/sites-enabled/default 2>/dev/null; then
    info "Disabling the stock Nginx default site so Nobino answers on port 80."
    rm -f /etc/nginx/sites-enabled/default
  fi

  if nginx -t; then
    if systemctl is-active --quiet nginx 2>/dev/null; then
      systemctl reload nginx >/dev/null 2>&1 || true
    else
      systemctl enable --now nginx >/dev/null 2>&1 || true
    fi
    if systemctl is-active --quiet nginx 2>/dev/null; then
      WEB_OK=1
      info "Nginx site created: ${NGINX_CONF}"
    else
      warn "Nginx did not start; check 'nginx -t' and 'systemctl status nginx'."
    fi
  else
    warn "nginx -t failed; disabling the new site so the existing server keeps working."
    rm -f "$NGINX_CONF_LINK"
    nginx -t >/dev/null 2>&1 && systemctl reload nginx >/dev/null 2>&1 || true
  fi
fi


# ══════════════════════════════════════════════════════════════════
#  Phase 10 — SSL for Nobino's own domain (never for other sites)
# ══════════════════════════════════════════════════════════════════
SSL_OK=0
case "${ENABLE_SSL,,}" in
  auto)
    if [ -n "$DOMAIN" ] && [ "$PUBLIC_PORT" = "80" ] && [ "$WEB_OK" -eq 1 ] && ! domain_taken "$DOMAIN"; then
      ENABLE_SSL=1
    else
      ENABLE_SSL=0
    fi ;;
  1|yes|true) ENABLE_SSL=1 ;;
  0|no|false) ENABLE_SSL=0 ;;
  *) warn "Unknown ENABLE_SSL='${ENABLE_SSL}'; skipping SSL."; ENABLE_SSL=0 ;;
esac

if [ "$ENABLE_SSL" -eq 1 ] && [ -n "$DOMAIN" ] && [ "$PUBLIC_PORT" = "80" ]; then
  SYSTEMD_EDITOR=true
  if ! command -v certbot >/dev/null 2>&1; then
    info "Installing Certbot..."
    apt-get install -y certbot || warn "Certbot installation reported errors."
  fi
  CERTBOT_PLUGIN="python3-certbot-${WEB_KIND}"
  dpkg -s "$CERTBOT_PLUGIN" >/dev/null 2>&1 || apt-get install -y "$CERTBOT_PLUGIN" >/dev/null 2>&1 || true
  info "Requesting a certificate for ${DOMAIN} (only this domain is affected)..."
  if certbot "--${WEB_KIND}" -d "$DOMAIN" --non-interactive --agree-tos \
       -m "${SSL_EMAIL:-$(ask "Email for the SSL certificate (optional)" "admin@${DOMAIN}")}" \
       --redirect; then
    SSL_OK=1
    info "HTTPS is enabled for ${DOMAIN}."
  else
    warn "certbot reported errors; HTTP still works. Rerun after DNS: certbot --${WEB_KIND} -d ${DOMAIN}"
  fi
elif [ -n "$DOMAIN" ] && [ "$DEDICATED_PORT" -eq 1 ]; then
  info "SSL skipped: '${DOMAIN}' is served by another site or Nobino is on port ${PUBLIC_PORT}."
  info "Point a free domain here (DOMAIN=app.example.com) to get a certificate on port 80."
else
  info "No domain supplied; the site is reachable on http://IP:${PUBLIC_PORT}."
fi

# ══════════════════════════════════════════════════════════════════
#  Phase 11 — firewall (never surprises a running server)
# ══════════════════════════════════════════════════════════════════
case "${MANAGE_UFW,,}" in
  auto) if [ "$WEB_INSTALLED" -eq 1 ]; then MANAGE_UFW=1; else MANAGE_UFW=0; fi ;;
  1|yes|true) MANAGE_UFW=1 ;;
  0|no|false) MANAGE_UFW=0 ;;
  *) warn "Unknown MANAGE_UFW='${MANAGE_UFW}'; leaving the firewall alone."; MANAGE_UFW=0 ;;
esac

if [ "$MANAGE_UFW" -eq 1 ]; then
  command -v ufw >/dev/null 2>&1 || apt-get install -y ufw
  info "Configuring the UFW firewall..."
  ufw allow 22/tcp >/dev/null || true
  if [ "$PUBLIC_PORT" = "80" ]; then
    ufw allow 80/tcp >/dev/null || true
  else
    ufw allow "${PUBLIC_PORT}/tcp" >/dev/null || true
  fi
  [ "$SSL_OK" -eq 1 ] && ufw allow 443/tcp >/dev/null || true
  # The Next.js port stays private: the web server proxies to 127.0.0.1:${PORT}.
  info "Keeping the internal app port (${PORT}) closed to the public."
  ufw --force enable || true
else
  info "Firewall left untouched (an existing server keeps its own rules)."
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
    if [ "$SSL_OK" -eq 1 ]; then
      warn "UFW is active: allow 80, 443 and ${PUBLIC_PORT}/tcp if the app must be reachable."
    else
      warn "UFW is active: allow ${PUBLIC_PORT}/tcp (and 443 for HTTPS) if the app must be reachable."
    fi
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
if [ "$WEB_KIND" = "apache" ]; then
  echo "  Web server    : Apache ($( [ "$WEB_INSTALLED" -eq 1 ] && echo 'installed now' || echo 'existing, reused'))"
  echo "  Site config   : ${APACHE_SITE}"
else
  echo "  Web server    : Nginx ($( [ "$WEB_INSTALLED" -eq 1 ] && echo 'installed now' || echo 'existing, reused'))"
  echo "  Site config   : ${NGINX_CONF}"
fi
echo "  Public port   : ${PUBLIC_PORT}"
if [ "$DEDICATED_PORT" -eq 0 ]; then
  if [ "$SSL_OK" -eq 1 ]; then
    echo "  Site URL      : https://${DOMAIN}"
  else
    echo "  Site URL      : http://${DOMAIN}"
  fi
elif [ "$DOMAIN_TAKEN" -eq 1 ]; then
  echo "  Site URL      : http://${DOMAIN}:${PUBLIC_PORT}  (its domain stays with the other site)"
else
  echo "  Site URL      : ${PUBLIC_BASE}"
fi
echo "  PM2 status    : sudo -u ${APP_USER} -H env PM2_HOME=${APP_HOME}/.pm2 pm2 status"
echo "  Logs          : sudo -u ${APP_USER} -H env PM2_HOME=${APP_HOME}/.pm2 pm2 logs ${APP_NAME}"
echo "  Database      : ${DB_NAME} (user: ${DB_USER})"
echo ""
echo "  Update later   : sudo bash ${APP_DIR}/scripts/update-ubuntu.sh"
echo "  (or a tag)     : sudo bash ${APP_DIR}/scripts/update-ubuntu.sh --ref v1.2.0"
echo "  (dry run)      : sudo bash ${APP_DIR}/scripts/update-ubuntu.sh --dry-run"
echo "  (change domain / port / site file): sudo bash ${APP_DIR}/scripts/deploy-ubuntu.sh"
echo ""
if [ "$WEB_INSTALLED" -eq 0 ]; then
  info "Your existing ${WEB_KIND} was reused: other sites, domains and certificates were not modified."
  info "Nobino only added its own site file and reloaded the server."
else
  info "Nginx was installed for this app and only one site file is served."
fi
info "PHP and MySQL/MariaDB are not dependencies of Nobino; neither was installed or changed."
[ "$DB_CONFLICT" -eq 1 ] && info "The previous PostgreSQL role/database were kept; Nobino uses its own pair."
warn "Default seeded admin: phone 09120000000 (default password in prisma/seed.mjs)."
warn "Change the password after the first login."
