#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════
#  Nobino — complete uninstall from an Ubuntu VPS
#  Run:  sudo bash scripts/uninstall-ubuntu.sh
#        sudo bash scripts/uninstall-ubuntu.sh --dry-run   # preview only
#        sudo bash scripts/uninstall-ubuntu.sh --yes       # confirm every section
#  From GitHub, without a local checkout (questions still work; input is read
#  from the terminal, not from the pipe):
#        curl -fsSL https://raw.githubusercontent.com/alisystemit/Nobino/main/scripts/uninstall-ubuntu.sh \
#          | sudo bash -s -- --dry-run
#  Behavior: each section (PM2, Nginx, SSL, database, firewall, Node, app folder)
#            is prompted separately; only confirmed items are removed.
#  Overridable env vars: APP_NAME, APP_DIR, PORT, DOMAIN, BACKUP_DIR
# ══════════════════════════════════════════════════════════════════
set -uo pipefail

C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'; C_CYAN=$'\033[36m'
C_DIM=$'\033[2m'; C_RESET=$'\033[0m'
info() { echo "${C_GREEN}[+]${C_RESET} $*"; }
warn() { echo "${C_YELLOW}[!]${C_RESET} $*"; }
fail() { echo "${C_RED}[x]${C_RESET} $*" >&2; exit 1; }
ok()   { echo "${C_GREEN}[ok]${C_RESET} $*"; }
header() { echo; echo "${C_CYAN}-- $* ----------------------------------${C_RESET}"; }

usage() {
  cat <<'EOF'
Usage:
  sudo bash scripts/uninstall-ubuntu.sh              interactive (default for every section: no)
  sudo bash scripts/uninstall-ubuntu.sh --dry-run    preview actions, change nothing
  sudo bash scripts/uninstall-ubuntu.sh --yes        confirm every section (full removal)

  Without a local checkout (fetch the script from GitHub):
  curl -fsSL https://raw.githubusercontent.com/alisystemit/Nobino/main/scripts/uninstall-ubuntu.sh | sudo bash -s -- --dry-run

Optional environment variables:
  APP_NAME=nobino  APP_DIR=/var/www/nobino  PORT=3000  DOMAIN=example.com
  BACKUP_DIR=/root/nobino-backups
EOF
}

DRY_RUN=0
ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    -n|--dry-run) DRY_RUN=1 ;;
    -y|--yes)     ASSUME_YES=1 ;;
    -h|--help)    usage; exit 0 ;;
    *) fail "Unknown option: $arg (see --help)" ;;
  esac
done

# ─── Helpers ──────────────────────────────────────────────────────
run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '    %s[dry-run]%s %s\n' "$C_DIM" "$C_RESET" "$*"
    return 0
  fi
  "$@"
}

as_postgres() { # run a command as the postgres system user (sudo may be absent on minimal images)
  if command -v sudo >/dev/null 2>&1; then sudo -u postgres "$@";
  elif command -v runuser >/dev/null 2>&1; then runuser -u postgres -- "$@";
  else su postgres -c "$*"; fi
}

read_answer() { # read_answer "<prompt-text>" — reads the terminal, not stdin
  # When the script is piped (curl ... | sudo bash) stdin carries the script
  # itself, so a plain `read` would consume code instead of the answer.
  local prompt="$1"
  if [ -t 0 ]; then
    read -r -p "$prompt" ans_input || ans_input=""
  elif [ -e /dev/tty ] && { : </dev/tty; } 2>/dev/null; then
    read -r -p "$prompt" ans_input </dev/tty || ans_input=""
  else
    echo "$prompt" >&2
    warn "No terminal available; using the default answer."
    ans_input=""
  fi
}

ask_yes() { # ask_yes "<prompt>" yes|no  (default: no)
  local prompt="$1" def="${2:-no}" ans hint="no"
  [ "$def" = "yes" ] && hint="yes"
  if [ "$ASSUME_YES" -eq 1 ]; then
    echo "${C_CYAN}?${C_RESET} ${prompt} (yes/no) [${hint}] -> yes (--yes)"
    return 0
  fi
  read_answer "${C_CYAN}?${C_RESET} ${prompt} (yes/no) [${hint}]: "
  ans="${ans_input,,}"
  case "$ans" in
    y|yes) return 0 ;;
    n|no)  return 1 ;;
    '') [ "$def" = "yes" ] ;;
    *) warn "Unrecognized answer; using default (${hint})."; [ "$def" = "yes" ] ;;
  esac
}

ask_val() { # ask_val "<prompt>" "<default>"
  local prompt="$1" default="${2:-}"
  read_answer "${C_CYAN}?${C_RESET} ${prompt}${default:+ [${default}]}: "
  printf '%s' "${ans_input:-$default}"
}

# ─── Environment checks ───────────────────────────────────────────
if [ "$DRY_RUN" -eq 0 ] && [ "$(id -u)" -ne 0 ]; then
  fail "Run as root: sudo bash scripts/uninstall-ubuntu.sh"
fi
if [ "$(uname -s 2>/dev/null)" != "Linux" ] && [ "$DRY_RUN" -eq 0 ]; then
  fail "This script only runs on Linux/Ubuntu."
fi
if [ -f /etc/os-release ] && [ "$DRY_RUN" -eq 0 ]; then
  . /etc/os-release
  if [[ "${ID:-}" != "ubuntu" && "${ID_LIKE:-}" != *ubuntu* ]]; then
    warn "Detected distribution: ${NAME:-?} — this script is written for Ubuntu."
  fi
fi

# ─── Auto-detect paths and settings ──────────────────────────────
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
PROJECT_ROOT="$(dirname -- "$SCRIPT_DIR")"
APP_NAME="${APP_NAME:-nobino}"
if [ -z "${APP_DIR:-}" ]; then
  if [ -d "/var/www/$APP_NAME" ]; then APP_DIR="/var/www/$APP_NAME"; else APP_DIR="$PROJECT_ROOT"; fi
fi
APP_DIR="${APP_DIR%/}"
NGINX_CONF="${NGINX_CONF:-/etc/nginx/sites-available/${APP_NAME}}"
NGINX_LINK="${NGINX_LINK:-/etc/nginx/sites-enabled/${APP_NAME}}"
BACKUP_DIR="${BACKUP_DIR:-/root/nobino-backups}"

env_get() {
  local key="$1"
  [ -f "$APP_DIR/.env" ] || return 0
  grep -E "^${key}=" "$APP_DIR/.env" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'
}

# Internal port: env -> ecosystem -> nginx -> 3000
detect_port() {
  local p=""
  [ -n "${PORT:-}" ] && { printf '%s' "$PORT"; return; }
  if [ -f "$APP_DIR/ecosystem.config.cjs" ]; then
    p="$(sed -nE 's/.*start -p ([0-9]+).*/\1/p' "$APP_DIR/ecosystem.config.cjs" | head -1)"
  fi
  if [ -z "$p" ] && [ -f "$NGINX_CONF" ]; then
    p="$(sed -nE 's/.*proxy_pass[[:space:]]+http:\/\/127\.0\.0\.1:([0-9]+).*/\1/p' "$NGINX_CONF" | head -1)"
  fi
  printf '%s' "${p:-3000}"
}
PORT="$(detect_port)"

# Domain: env -> Nginx server_name -> NEXT_PUBLIC_APP_URL
detect_domain() {
  local d="${DOMAIN:-}" raw tok host
  if [ -z "$d" ] && [ -f "$NGINX_CONF" ]; then
    raw="$(sed -nE 's/^[[:space:]]*server_name[[:space:]]+([^;]+);.*/\1/p' "$NGINX_CONF" | head -1)"
    for tok in $raw; do
      case "$tok" in _|localhost|www.*|\*.*) continue ;; esac
      d="$tok"; break
    done
  fi
  if [ -z "$d" ] && [ -f "$APP_DIR/.env" ]; then
    host="$(env_get NEXT_PUBLIC_APP_URL | sed -E 's#^[a-z]+://##; s#/.*$##; s#:[0-9]+$##')"
    case "$host" in ''|localhost|127.*) ;; *) d="$host" ;; esac
  fi
  printf '%s' "$d"
}
DOMAIN="$(detect_domain)"

# Database from DATABASE_URL in .env
DB_URL="$(env_get DATABASE_URL)"
DB_USER="nobino"; DB_NAME="nobino"; DB_HOST="localhost"; DB_PORT="5432"
if [ -n "$DB_URL" ] && [[ "$DB_URL" =~ ^postgres(ql)?://([^:@/]+)(:([^@]*))?@([^:/?]+)(:([0-9]+))?/([^?]+) ]]; then
  DB_USER="${BASH_REMATCH[2]}"
  DB_HOST="${BASH_REMATCH[5]}"
  DB_PORT="${BASH_REMATCH[7]:-5432}"
  DB_NAME="${BASH_REMATCH[8]}"
fi
DB_USER="${DB_USER:-nobino}"
DB_NAME="${DB_NAME:-nobino}"
DB_LOCAL=1
case "$DB_HOST" in localhost|127.0.0.1|::1) DB_LOCAL=1 ;; *) DB_LOCAL=0 ;; esac

REMOVED=(); KEPT=(); PROBLEMS=()
mark_removed() { REMOVED+=("$*"); }
mark_kept()    { KEPT+=("$*"); }

# ─── Summary and final confirmation ──────────────────────────────
echo "${C_RED}"
echo "  +----------------------------------------------------+"
echo "  |  WARNING: this operation cannot be undone           |"
echo "  +----------------------------------------------------+"
echo "${C_RESET}"
echo "  App           : $APP_NAME"
echo "  App directory : $APP_DIR"
echo "  Internal port : $PORT"
echo "  Domain        : ${DOMAIN:-—}"
echo "  Database      : ${DB_NAME} / role ${DB_USER} @ ${DB_HOST}:${DB_PORT}$( [ "$DB_LOCAL" -eq 0 ] && echo ' (external)')"
echo "  Backups       : $BACKUP_DIR"
if [ "$DRY_RUN" -eq 1 ]; then
  warn "Dry-run mode: no changes will be made to the system."
fi
if [ "$ASSUME_YES" -eq 0 ]; then
  if ! ask_yes "Are you sure you want to continue?" no; then
    info "Cancelled; no changes were made."
    exit 0
  fi
fi

# ══════════════════════════════════════════════════════════════════
#  1) PM2 — app, startup service, package
# ══════════════════════════════════════════════════════════════════
section_pm2() {
  header "1) PM2"
  if ! command -v pm2 >/dev/null 2>&1; then
    info "PM2 is not installed on this server."
    return
  fi

  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    if ask_yes "Stop and remove the PM2 app '$APP_NAME'?" no; then
      if run pm2 delete "$APP_NAME" >/dev/null 2>&1; then
        ok "App '$APP_NAME' removed from PM2."
        mark_removed "PM2: app $APP_NAME"
      else
        warn "Failed to remove the app from PM2."
        PROBLEMS+=("PM2: remove app $APP_NAME")
      fi
      run pm2 save >/dev/null 2>&1 || true
    else
      mark_kept "PM2: app $APP_NAME"
    fi
  else
    info "App '$APP_NAME' was not found in PM2."
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    info "Dry-run: skipping remaining-app checks and PM2 service/package removal."
    return
  fi

  local remaining
  remaining="$(pm2 jlist 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).length)}catch(e){console.log(0)}})' 2>/dev/null || echo 0)"
  case "$remaining" in ''|*[!0-9]*) remaining=0 ;; esac
  if [ "$remaining" -gt 0 ]; then
    warn "Other PM2 apps are still running ($remaining); keeping the startup service and PM2 package."
    return
  fi

  if ask_yes "Remove the PM2 startup service (systemd)?" no; then
    pm2 unstartup systemd >/dev/null 2>&1 || true
    rm -f /etc/systemd/system/pm2-root.service
    systemctl daemon-reload >/dev/null 2>&1 || true
    ok "PM2 startup service removed."
    mark_removed "PM2: systemd service"
  fi

  if ask_yes "Remove the PM2 npm package and ~/.pm2 (logs/dump)?" no; then
    pm2 kill >/dev/null 2>&1 || true
    if command -v npm >/dev/null 2>&1 && npm uninstall -g pm2 >/dev/null 2>&1; then
      ok "PM2 package removed."
      mark_removed "PM2: npm package"
    else
      warn "Failed to remove the PM2 package (manual: npm uninstall -g pm2)."
      PROBLEMS+=("PM2: remove package")
    fi
    rm -rf /root/.pm2
    ok "~/.pm2 (logs and dump) removed."
  fi
}

# ══════════════════════════════════════════════════════════════════
#  2) Nginx — site, restore default, package
# ══════════════════════════════════════════════════════════════════
reload_nginx() {
  if [ "$DRY_RUN" -eq 1 ]; then
    run nginx -t
    run systemctl reload nginx
    return
  fi
  if command -v nginx >/dev/null 2>&1; then
    if nginx -t >/dev/null 2>&1; then
      systemctl reload nginx >/dev/null 2>&1 || true
    else
      warn "nginx -t failed; reload skipped."
    fi
  fi
}

section_nginx() {
  header "2) Nginx"
  local removed_site=0
  if [ -e "$NGINX_CONF" ] || [ -e "$NGINX_LINK" ] || [ -L "$NGINX_LINK" ]; then
    if ask_yes "Remove the Nginx site config for '$APP_NAME'?" no; then
      run rm -f "$NGINX_LINK" "$NGINX_CONF"
      removed_site=1
      ok "Nginx site config removed."
      mark_removed "Nginx: site $APP_NAME"
      reload_nginx
    else
      mark_kept "Nginx: site $APP_NAME"
    fi
  else
    info "No Nginx config found for '$APP_NAME'."
  fi

  if [ "$removed_site" -eq 1 ] && command -v nginx >/dev/null 2>&1 \
     && [ -f /etc/nginx/sites-available/default ] && [ ! -e /etc/nginx/sites-enabled/default ]; then
    if ask_yes "Re-enable the default Nginx site?" yes; then
      run ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
      reload_nginx
      ok "Default Nginx site re-enabled."
    fi
  fi

  if command -v nginx >/dev/null 2>&1; then
    local others
    others="$(find /etc/nginx/sites-enabled -mindepth 1 -maxdepth 1 ! -name default ! -name "$APP_NAME" 2>/dev/null | wc -l | tr -d ' ')"
    if [ "${others:-0}" -eq 0 ] && ask_yes "Purge the Nginx package as well? (no other site uses Nginx)" no; then
      if run apt-get purge -y nginx nginx-common nginx-core; then
        run rm -rf /etc/nginx /var/log/nginx
        ok "Nginx package removed."
        mark_removed "Nginx: package"
      else
        warn "Failed to remove the Nginx package."
        PROBLEMS+=("Nginx: remove package")
      fi
    fi
  fi
}

# ══════════════════════════════════════════════════════════════════
#  3) SSL certificate — only the certificate for this domain
# ══════════════════════════════════════════════════════════════════
section_ssl() {
  header "3) SSL certificate"
  if ! command -v certbot >/dev/null 2>&1; then
    info "Certbot is not installed (remove self-signed/other certificates manually)."
    return
  fi

  local list cert_name="" cert_domains="" name domains
  list="$(certbot certificates 2>/dev/null | awk '
    /Certificate Name:/ { name=$3 }
    /Domains:/ { sub(/^[^:]*Domains:[ ]*/, ""); print name "\t" $0 }
  ')"
  if [ -z "$list" ]; then
    info "No certificates are registered with Certbot."
    return
  fi

  while IFS=$'\t' read -r name domains; do
    [ -n "$name" ] || continue
    if [ -n "$DOMAIN" ] && { [ "$name" = "$DOMAIN" ] || [[ " $domains " == *" $DOMAIN "* ]] || [[ "$name" == *"$DOMAIN"* ]]; }; then
      cert_name="$name"; cert_domains="$domains"; break
    fi
    if [ -z "$DOMAIN" ] && [ -z "$cert_name" ]; then
      cert_name="$name"; cert_domains="$domains"
    fi
  done <<< "$list"

  if [ -z "$cert_name" ]; then
    warn "No certificate matched '${DOMAIN:-$APP_NAME}'. Available certificates:"
    printf '%s\n' "$list" | awk -F'\t' '{ printf "    - %s (%s)\n", $1, $2 }'
    cert_name="$(ask_val "Certificate name to delete (empty = skip)" "")"
    [ -n "$cert_name" ] || { mark_kept "SSL: certificate"; return; }
    cert_domains="$(printf '%s\n' "$list" | awk -F'\t' -v n="$cert_name" '$1==n { print $2 }')"
  fi

  if [ -n "$DOMAIN" ] && [[ " $cert_domains " != *" $DOMAIN "* ]] && [[ "$cert_name" != *"$DOMAIN"* ]]; then
    warn "This certificate is not issued for '$DOMAIN'; another site may be using it."
  fi

  if ask_yes "Delete SSL certificate '$cert_name' (${cert_domains:-?})?" no; then
    if run certbot delete --cert-name "$cert_name" --non-interactive >/dev/null 2>&1; then
      ok "SSL certificate removed."
      mark_removed "SSL: $cert_name"
    else
      warn "Failed to remove the certificate (manual: certbot delete --cert-name $cert_name)."
      PROBLEMS+=("SSL: $cert_name")
    fi
  else
    mark_kept "SSL: $cert_name"
  fi
}

# ══════════════════════════════════════════════════════════════════
#  4) PostgreSQL database — optional backup first
# ══════════════════════════════════════════════════════════════════
section_db() {
  header "4) PostgreSQL database"
  if [ "$DB_LOCAL" -ne 1 ]; then
    warn "The database is hosted externally on '$DB_HOST'; automatic removal is skipped."
    mark_kept "Database (external)"
    return
  fi
  if ! command -v psql >/dev/null 2>&1; then
    info "PostgreSQL/psql is not installed on this server."
    return
  fi
  if ! as_postgres psql -tAc "SELECT 1" >/dev/null 2>&1; then
    warn "Could not connect to PostgreSQL (is the service stopped?)."
    PROBLEMS+=("Database: connection failed")
    return
  fi

  if ! ask_yes "Delete database '$DB_NAME' and role '$DB_USER'?" no; then
    mark_kept "Database: $DB_NAME"
    return
  fi

  DB_NAME="$(ask_val "Database name" "$DB_NAME")"
  DB_USER="$(ask_val "PostgreSQL role name" "$DB_USER")"
  if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ "$DB_NAME" = "postgres" ] || [ "$DB_USER" = "postgres" ]; then
    warn "Invalid database/role name; skipping this section for safety."
    mark_kept "Database: invalid name"
    return
  fi
  if ! [[ "$DB_NAME" =~ ^[A-Za-z0-9_]+$ ]] || ! [[ "$DB_USER" =~ ^[A-Za-z0-9_]+$ ]]; then
    warn "Names may only contain letters, digits, and underscores."
    mark_kept "Database: invalid name"
    return
  fi

  if ask_yes "Create a database backup before deletion?" yes; then
    run mkdir -p "$BACKUP_DIR"
    local dump_file="$BACKUP_DIR/${DB_NAME}-$(date +%Y%m%d-%H%M%S).dump"
    if [ "$DRY_RUN" -eq 1 ]; then
      run as_postgres pg_dump -Fc "$DB_NAME" ">" "$dump_file"
    elif as_postgres pg_dump -Fc "$DB_NAME" > "$dump_file" 2>/dev/null; then
      chmod 600 "$dump_file" 2>/dev/null || true
      ok "Database backup: $dump_file ($(du -h "$dump_file" 2>/dev/null | cut -f1))"
    else
      rm -f "$dump_file"
      warn "Backup failed."
      if ! ask_yes "Continue without a backup? (risk of data loss)" no; then
        mark_kept "Database: $DB_NAME"
        return
      fi
    fi
  fi

  local db_there role_there
  db_there="$(as_postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null | tr -d ' ')"
  role_there="$(as_postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" 2>/dev/null | tr -d ' ')"

  if [ "$db_there" = "1" ]; then
    run as_postgres psql -tAc "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid <> pg_backend_pid()" >/dev/null 2>&1 || true
    if run as_postgres dropdb --if-exists "$DB_NAME"; then
      ok "Database '$DB_NAME' removed."
      mark_removed "Database: $DB_NAME"
    else
      warn "Failed to remove the database."
      PROBLEMS+=("Database: drop $DB_NAME")
    fi
  else
    info "Database '$DB_NAME' does not exist."
  fi

  if [ "$role_there" = "1" ]; then
    if run as_postgres psql -v ON_ERROR_STOP=1 -c "DROP ROLE IF EXISTS \"${DB_USER}\";" >/dev/null 2>&1; then
      ok "Role '$DB_USER' removed."
      mark_removed "Database role: $DB_USER"
    else
      warn "Role '$DB_USER' was not removed (it may own objects elsewhere)."
      PROBLEMS+=("Database: role $DB_USER")
    fi
  else
    info "Role '$DB_USER' does not exist."
  fi
}

# ══════════════════════════════════════════════════════════════════
#  5) Firewall — only the app's internal port (80/443 untouched)
# ══════════════════════════════════════════════════════════════════
section_firewall() {
  header "5) UFW firewall"
  if ! command -v ufw >/dev/null 2>&1; then
    info "UFW is not installed on this server."
    return
  fi
  if ! ufw status 2>/dev/null | grep -q "Status: active"; then
    info "UFW is not active."
    return
  fi
  if ufw status 2>/dev/null | grep -qE "(^|[[:space:]])${PORT}/tcp"; then
    if ask_yes "Remove the firewall rule that allows port ${PORT}?" no; then
      run ufw delete allow "${PORT}/tcp" >/dev/null 2>&1 || true
      ok "Rule for port ${PORT} removed."
      mark_removed "UFW: port $PORT"
    else
      mark_kept "UFW: port $PORT"
    fi
  else
    info "No UFW rule found for port ${PORT}."
  fi
}

# ══════════════════════════════════════════════════════════════════
#  6) Node.js installed via nvm (optional, high risk)
# ══════════════════════════════════════════════════════════════════
section_node() {
  header "6) Node.js (nvm)"
  local found=0 f
  [ -d /usr/local/nvm ] && found=1
  if [ -L /usr/local/bin/node ] && readlink /usr/local/bin/node 2>/dev/null | grep -q '/usr/local/nvm'; then
    found=1
  fi
  if [ "$found" -eq 0 ]; then
    info "No nvm-managed global Node.js found at /usr/local/nvm."
    return
  fi
  warn "Removing Node.js may break other Node projects on this server."
  if ask_yes "Remove the Node.js installed for this project (nvm at /usr/local/nvm)?" no; then
    run rm -rf /usr/local/nvm /root/.nvm
    for f in node npm npx; do
      if [ -L "/usr/local/bin/$f" ] && readlink "/usr/local/bin/$f" 2>/dev/null | grep -q '/usr/local/nvm'; then
        run rm -f "/usr/local/bin/$f"
      fi
    done
    hash -r 2>/dev/null || true
    ok "Node.js and its symlinks were removed."
    mark_removed "Node.js: nvm"
  else
    mark_kept "Node.js: nvm"
  fi
}

# ══════════════════════════════════════════════════════════════════
#  7) App folder — path guards and .env backup
# ══════════════════════════════════════════════════════════════════
section_folder() {
  header "7) App folder"
  if [ ! -d "$APP_DIR" ]; then
    info "Folder '$APP_DIR' does not exist."
    return
  fi

  if ! ask_yes "Delete the app folder '$APP_DIR' (including .env and node_modules)?" no; then
    mark_kept "Folder: $APP_DIR"
    return
  fi

  local normalized parent base depth
  # Normalize only the parent so that if APP_DIR is a symlink, the link is removed
  # rather than the directory it points to.
  parent="$(dirname -- "$APP_DIR")"
  base="$(basename -- "$APP_DIR")"
  parent="$(readlink -f -- "$parent" 2>/dev/null || printf '%s' "$parent")"
  normalized="${parent%/}/$base"
  case "$normalized" in
    /|/var|/var/www|/usr|/usr/local|/etc|/root|/home|"${HOME:-/root}")
      warn "Path '$normalized' is protected; deletion skipped."
      mark_kept "Folder: protected path"
      return ;;
  esac
  depth="$(printf '%s' "$normalized" | awk -F/ '{print NF-1}')"
  if [ "${depth:-0}" -lt 2 ]; then
    warn "Path '$normalized' is too short; deletion skipped."
    mark_kept "Folder: path too short"
    return
  fi

  if [ ! -f "$normalized/package.json" ] && [ ! -f "$normalized/ecosystem.config.cjs" ] && [ ! -d "$normalized/prisma" ]; then
    warn "This folder does not look like the Nobino project."
    if ! ask_yes "Delete the whole folder anyway?" no; then
      mark_kept "Folder: no project marker"
      return
    fi
  fi

  if [ -f "$normalized/.env" ]; then
    if ask_yes "Copy .env to $BACKUP_DIR before deletion?" yes; then
      local dest="$BACKUP_DIR/${APP_NAME}-env-$(date +%Y%m%d-%H%M%S)"
      run mkdir -p "$BACKUP_DIR"
      if [ "$DRY_RUN" -eq 1 ]; then
        run cp -a "$normalized/.env" "$dest"
      elif cp -a "$normalized/.env" "$dest"; then
        chmod 600 "$dest" 2>/dev/null || true
        ok ".env backup: $dest"
      else
        warn "Failed to copy .env."
        PROBLEMS+=(".env: backup")
      fi
    fi
  fi

  if run rm -rf -- "$normalized"; then
    if [ "$DRY_RUN" -eq 1 ] || [ ! -e "$normalized" ]; then
      ok "App folder removed."
      mark_removed "Folder: $normalized"
    else
      warn "Folder still exists after deletion."
      PROBLEMS+=("Folder: $normalized")
    fi
  else
    warn "Failed to remove the folder."
    PROBLEMS+=("Folder: $normalized")
  fi
}

# ─── Run ──────────────────────────────────────────────────────────
section_pm2
section_nginx
section_ssl
section_db
section_firewall
section_node
section_folder

# ─── Final summary ────────────────────────────────────────────────
header "Summary"
if [ "${#REMOVED[@]}" -gt 0 ]; then
  echo "${C_GREEN}Removed:${C_RESET}"
  printf '  + %s\n' "${REMOVED[@]}"
fi
if [ "${#KEPT[@]}" -gt 0 ]; then
  echo "${C_YELLOW}Kept (not confirmed):${C_RESET}"
  printf '  - %s\n' "${KEPT[@]}"
fi
if [ "${#PROBLEMS[@]}" -gt 0 ]; then
  echo "${C_RED}Manual follow-up required:${C_RESET}"
  printf '  ! %s\n' "${PROBLEMS[@]}"
fi

echo
if [ "$DRY_RUN" -eq 1 ]; then
  warn "Dry-run mode: no changes were made."
else
  info "Uninstall finished."
fi
echo "  Reminder: disable DNS/Cloudflare records and external services (SMS, payments) separately."
if [ -d "$BACKUP_DIR" ]; then
  echo "  Backups: $BACKUP_DIR"
fi
echo "  To remove unused packages (optional): apt-get autoremove --purge"

if [ "${#PROBLEMS[@]}" -gt 0 ]; then
  exit 1
fi
exit 0
