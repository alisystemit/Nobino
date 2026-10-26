#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════
#  Nobino — update an existing Ubuntu installation
#
#  sudo bash scripts/update-ubuntu.sh                 (inside the install dir)
#  sudo bash /root/update-ubuntu.sh                   (downloaded copy)
#  curl -fsSL https://raw.githubusercontent.com/alisystemit/Nobino/main/scripts/update-ubuntu.sh | sudo bash -s -- --yes
#
#  What it does, in order:
#    1. finds the installation (/var/www/nobino, or /opt/nobino from older
#       installs), shows what is on disk right now
#    2. backs up .env (and the database, with pg_dump, when possible)
#    3. brings the code to origin/$GIT_REF — a hand-edited working tree is
#       listed and left alone unless --stash is given
#    4. npm ci (fallback npm install), prisma generate + migrate/db push,
#       npm run build, pm2 restart, then a local HTTP health check
#
#  What it never does:
#    * it does not install or reconfigure anything system-wide (no web server,
#      no firewall, no SSL, no PHP, no MySQL) — that is deploy-ubuntu.sh
#    * it does not touch other sites or their domains
#    * it does not change any PostgreSQL role or password
#    * it does not delete .env, node_modules caches or backups it made
#
#  Flags:
#    --dir <path>     install directory (default: auto-detect)
#    --ref <name>     branch/tag/commit to update to     (default: main)
#    --stash          git-stash local edits first so the code can advance
#    --replace        no .git in the install dir: move it aside and clone fresh
#    --skip-deps      keep node_modules as they are (code-only update)
#    --no-build       skip npm run build / prisma / pm2 (fetch + backup only)
#    --full           run deploy-ubuntu.sh afterwards (re-create the site file)
#    --dry-run        print the plan, change nothing
#    --yes            no questions: use the defaults above
#
#  Environment overrides: APP_DIR APP_USER APP_HOME GIT_REF REPO_URL PORT
# ══════════════════════════════════════════════════════════════════
set -euo pipefail

C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'; C_CYAN=$'\033[36m'; C_RESET=$'\033[0m'
info() { echo "${C_GREEN}[+]${C_RESET} $*"; }
warn() { echo "${C_YELLOW}[!]${C_RESET} $*"; }
fail() { echo "${C_RED}[x]${C_RESET} $*" >&2; exit 1; }
run() { # run <cmd...> — echo then execute (unless DRY_RUN)
  printf '%s' "${C_CYAN}\$${C_RESET} "; printf '%q ' "$@"; echo
  [ "${DRY_RUN:-0}" = "1" ] && return 0
  "$@"
}
ask_yes() { # ask_yes <question> <yes|no default>
  local q="${1:-}" d="${2:-n}" ans=""
  if [ "${NONINTERACTIVE:-0}" = "1" ] || [ "${ASSUME_YES:-0}" = "1" ]; then
    [ "$d" = "y" ] && return 0 || return 1
  fi
  if [ -e /dev/tty ] && { : </dev/tty; } 2>/dev/null; then
    read -r -p "${C_CYAN}?${C_RESET} ${q} [${d}/$([ "$d" = y ] && echo no || echo yes)]: " ans </dev/tty || ans=""
  elif [ -t 0 ]; then
    read -r -p "${C_CYAN}?${C_RESET} ${q} [${d}/$([ "$d" = y ] && echo no || echo yes)]: " ans || ans=""
  else
    warn "No terminal available; using the default '${d}' for '${q}'."
  fi
  ans="${ans:-$d}"
  case "${ans,,}" in y|yes) return 0 ;; *) return 1 ;; esac
}

# ─── Flags ────────────────────────────────────────────────────────
GIT_REF="${GIT_REF:-main}"
REPO_URL="${REPO_URL:-https://github.com/alisystemit/Nobino.git}"
DRY_RUN=0; ASSUME_YES=0; ALLOW_STASH=0; ALLOW_REPLACE=0; SKIP_DEPS=0; NO_BUILD=0; RUN_FULL=0
while [ $# -gt 0 ]; do
  case "$1" in
    --dir)      APP_DIR="${2:-}"; shift 2 ;;
    --dir=*)    APP_DIR="${1#*=}"; shift ;;
    --ref)      GIT_REF="${2:-}"; shift 2 ;;
    --ref=*)    GIT_REF="${1#*=}"; shift ;;
    --stash)    ALLOW_STASH=1; shift ;;
    --replace)  ALLOW_REPLACE=1; shift ;;
    --skip-deps) SKIP_DEPS=1; shift ;;
    --no-build) NO_BUILD=1; shift ;;
    --full)     RUN_FULL=1; shift ;;
    --dry-run)  DRY_RUN=1; shift ;;
    --yes|-y)   ASSUME_YES=1; NONINTERACTIVE=1; shift ;;
    -h|--help)  sed -n '2,40p' "$0"; exit 0 ;;
    *)          fail "Unknown option: $1 (see --help)" ;;
  esac
done

[ "$(uname -s)" = "Linux" ] || fail "This script only runs on Linux/Ubuntu."
if [ "${DRY_RUN}" -eq 1 ] && [ "$(id -u)" -ne 0 ]; then
  info "Dry run without root: read-only checks only."
elif [ "$(id -u)" -ne 0 ]; then
  fail "Run as root: sudo bash scripts/update-ubuntu.sh"
fi

APP_USER="${APP_USER:-nobino}"
APP_HOME="${APP_HOME:-/var/lib/${APP_USER}}"
PORT="${PORT:-3000}"
APP_NAME="nobino"

# ─── Find the installation ────────────────────────────────────────
if [ -z "${APP_DIR:-}" ]; then
  for c in /var/www/nobino /opt/nobino; do
    if [ -f "$c/package.json" ]; then APP_DIR="$c"; break; fi
  done
fi
[ -n "${APP_DIR:-}" ] || fail "No Nobino installation found (/var/www/nobino, /opt/nobino). Pass --dir <path>."
[ -f "$APP_DIR/package.json" ] || fail "$APP_DIR has no package.json — that is not a Nobino install dir."
APP_DIR="$(cd "$APP_DIR" && pwd)"
info "Installation directory: $APP_DIR"

# ─── Run commands as the service user, with the Node toolchain ────
id -u "$APP_USER" >/dev/null 2>&1 || warn "Service user '${APP_USER}' does not exist; deploy-ubuntu.sh creates it."
node_dir_for_update() {
  local n
  n="$(command -v node 2>/dev/null || true)"
  [ -n "$n" ] || n="$(ls -d /usr/local/nvm/versions/node/*/bin/node 2>/dev/null | tail -1 || true)"
  [ -n "$n" ] || { echo ""; return 0; }
  dirname "$(readlink -f "$n")"
}
NODE_DIR="$(node_dir_for_update)"
[ -n "$NODE_DIR" ] || fail "Node.js was not found. Run deploy-ubuntu.sh first."
# npm's own global bin directory: where a global `npm install -g` puts its
# executables (pm2 and friends), which may differ from node's directory.
NPM_GLOBAL_BIN="$(PATH="$NODE_DIR:$PATH" npm config get prefix 2>/dev/null || true)"
EXTRA_PATH="$NODE_DIR"
if [ -n "$NPM_GLOBAL_BIN" ] && [ -d "$NPM_GLOBAL_BIN/bin" ] && [ "$NPM_GLOBAL_BIN/bin" != "$NODE_DIR" ]; then
  EXTRA_PATH="$NODE_DIR:$NPM_GLOBAL_BIN/bin"
fi
APP_PATH="$EXTRA_PATH:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
app_sh() { # app_sh '<snippet>' — inside APP_DIR, as the service user, with node on PATH
  if [ "$(id -un)" = "$APP_USER" ]; then
    env HOME="$APP_HOME" PM2_HOME="$APP_HOME/.pm2" PATH="$APP_PATH" bash -c "cd '$APP_DIR' && $1"
  elif command -v sudo >/dev/null 2>&1; then
    sudo -u "$APP_USER" -H env HOME="$APP_HOME" PM2_HOME="$APP_HOME/.pm2" PATH="$APP_PATH" bash -c "cd '$APP_DIR' && $1"
  else
    runuser -u "$APP_USER" -- env HOME="$APP_HOME" PM2_HOME="$APP_HOME/.pm2" PATH="$APP_PATH" bash -c "cd '$APP_DIR' && $1"
  fi
}

# ─── Current state ────────────────────────────────────────────────
echo
info "Current state:"
echo "    node $(node -v 2>/dev/null || echo '?')   npm $(PATH="$APP_PATH" npm -v 2>/dev/null || echo '?')"
if [ -d "$APP_DIR/.git" ]; then
  git config --global --add safe.directory "$APP_DIR" >/dev/null 2>&1 || true
  echo "    code $(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo '?') ($(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?'))"
else
  echo "    code not a git checkout (files were placed manually)"
fi
if [ -f "$APP_DIR/.env" ]; then
  ENV_URL="$(grep -m1 '^NEXT_PUBLIC_APP_URL=' "$APP_DIR/.env" 2>/dev/null | cut -d= -f2- | tr -d '"')"
  ENV_ROOT="$(grep -m1 '^NEXT_PUBLIC_ROOT_DOMAIN=' "$APP_DIR/.env" 2>/dev/null | cut -d= -f2- | tr -d '"')"
  echo "    .env app url ${ENV_URL:-unset}   root domain ${ENV_ROOT:-unset}"
else
  echo "    .env missing (deploy-ubuntu.sh creates it)"
fi
echo "    PATH given to '${APP_USER}': $APP_PATH"

# ─── Phase 1: backups ─────────────────────────────────────────────
BACKUP_DIR="/var/backups/nobino"
STAMP="$(date +%Y%m%d-%H%M%S)"
echo
if [ "${DRY_RUN}" -eq 1 ]; then
  info "Plan: back up .env to ${BACKUP_DIR}/env-${STAMP} (and the database with pg_dump, best effort)."
else
  mkdir -p "$BACKUP_DIR" && chmod 700 "$BACKUP_DIR"
  if [ -f "$APP_DIR/.env" ]; then
    cp -a "$APP_DIR/.env" "${BACKUP_DIR}/env-${STAMP}" && chmod 600 "${BACKUP_DIR}/env-${STAMP}"
    info ".env backed up to ${BACKUP_DIR}/env-${STAMP}"
  else
    warn "No .env to back up."
  fi
  DB_URL="$(grep -m1 '^DATABASE_URL=' "$APP_DIR/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)"
  if [ -n "$DB_URL" ] && command -v pg_dump >/dev/null 2>&1; then
    # postgresql://user:pass@host:port/dbname?schema=public
    db_creds="$(printf '%s' "$DB_URL" | sed -nE "s#^postgres(ql)?://([^:/@]+)(:([^@]*))?@([^/:]+)(:([0-9]+))?/([^?]+).*#\2\t\4\t\5\t\7\t\8#p")"
    if [ -n "$db_creds" ]; then
      IFS=$'\t' read -r DBU DBP DBH DBPRT DBN <<< "$db_creds"
      if [ -n "$DBU" ] && [ -n "$DBN" ]; then
        DUMP="${BACKUP_DIR}/db-${DBN}-${STAMP}.dump"
        if [ -n "$DBP" ]; then
          if PGPASSWORD="$DBP" pg_dump -h "${DBH:-127.0.0.1}" -p "${DBPRT:-5432}" -U "$DBU" -Fc -f "$DUMP" "$DBN" >/dev/null 2>&1; then
            chmod 600 "$DUMP"; info "Database '${DBN}' backed up to ${DUMP}"
          else
            warn "pg_dump failed; the update will continue without a database backup."
          fi
        else
          warn "DATABASE_URL has no password in it; skipping pg_dump."
        fi
      fi
    fi
  elif ! command -v pg_dump >/dev/null 2>&1; then
    warn "pg_dump is not installed; no database backup taken (apt install postgresql-client)."
  fi
fi

# ─── Phase 2: bring the code up to date ───────────────────────────
OLD_SHA=""
echo
if [ -d "$APP_DIR/.git" ]; then
  if [ "${DRY_RUN}" -eq 1 ]; then
    info "Plan: git fetch origin, then advance to origin/${GIT_REF} (local edits are listed, never discarded, unless --stash)."
  else
    run git -C "$APP_DIR" fetch --tags --prune origin
    NEW_REF="$(git -C "$APP_DIR" rev-parse --short "origin/$GIT_REF" 2>/dev/null || true)"
    OLD_SHA="$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo '')"
    if [ -z "$NEW_REF" ]; then
      warn "Ref 'origin/$GIT_REF' does not exist; keeping $(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo '?')."
    else
      DIRTY="$(git -C "$APP_DIR" status --porcelain --untracked-files=no 2>/dev/null | grep -v ' package-lock.json$' || true)"
      if [ -n "$DIRTY" ]; then
        warn "Local edits in $APP_DIR (not touching the working tree):"
        printf '%s\n' "$DIRTY" | sed -n '1,15p;s/^/          /'
        if [ "$ALLOW_STASH" -eq 1 ]; then
          if ask_yes "Stash these edits and update to ${NEW_REF}?" "$([ "${ASSUME_YES}" = 1 ] && echo y || echo n)"; then
            run git -C "$APP_DIR" stash push -m "nobino-update-${STAMP}"
            warn "Stashed as 'nobino-update-${STAMP}' (restore with: git -C $APP_DIR stash pop)"
          else
            warn "Keeping the local edits; the code stays at ${OLD_SHA}."
            NEW_REF="$OLD_SHA"
          fi
        else
          warn "Code stays at ${OLD_SHA} while origin/${GIT_REF} is ${NEW_REF}; this updates nothing."
          warn "See the edits with: git -C $APP_DIR diff    |    or rerun with --stash"
          NEW_REF="$OLD_SHA"
        fi
      fi
      if [ -n "$NEW_REF" ] && [ "$NEW_REF" != "$OLD_SHA" ]; then
        run git -C "$APP_DIR" checkout -B "$GIT_REF" "origin/$GIT_REF"
        info "Code: ${OLD_SHA:-?} -> $(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo '?')"
      elif [ "$NEW_REF" = "$OLD_SHA" ]; then
        info "Code is already at ${OLD_SHA}."
      fi
    fi
  fi
elif [ "${DRY_RUN}" -eq 1 ]; then
  info "Plan: $APP_DIR is not a git checkout — with --replace it is moved aside to ${APP_DIR}.old-${STAMP} and cloned fresh (your .env is restored)."
else
  warn "$APP_DIR has files but no .git, so it cannot be updated from GitHub."
  if [ "$ALLOW_REPLACE" -eq 1 ] && ask_yes "Move it aside and clone ${REPO_URL} (${GIT_REF}) into ${APP_DIR}, restoring your .env?" "$([ "${ASSUME_YES}" = 1 ] && echo y || echo n)"; then
    OLD_DIR="${APP_DIR}.old-${STAMP}"
    run mv "$APP_DIR" "$OLD_DIR"
    run git clone --branch "$GIT_REF" "$REPO_URL" "$APP_DIR"
    if [ -f "${OLD_DIR}/.env" ]; then
      run cp -a "${OLD_DIR}/.env" "${APP_DIR}/.env"
    fi
    warn "The previous files are kept in ${OLD_DIR} (delete it once the update is verified)."
  else
    fail "Nothing to update. Rerun deploy-ubuntu.sh, or pass --replace to convert $APP_DIR into a git checkout."
  fi
fi

# A hand-placed tree that was replaced, or a fresh clone, still needs its owner.
if [ "${DRY_RUN}" -eq 0 ] && id -u "$APP_USER" >/dev/null 2>&1; then
  chown -R "$APP_USER":"$(id -gn "$APP_USER")" "$APP_DIR" 2>/dev/null || warn "Could not chown $APP_DIR."
fi

# ─── Phase 3: dependencies ────────────────────────────────────────
echo
if [ "$SKIP_DEPS" -eq 1 ]; then
  info "--skip-deps: node_modules left as it is."
elif [ "${DRY_RUN}" -eq 1 ]; then
  info "Plan: npm ci as '${APP_USER}' when package-lock.json exists (fallback npm install)."
elif [ -d "$APP_DIR/node_modules" ]; then
  app_sh "npm install --no-audit --no-fund" || fail "npm install failed; see the npm output above."
elif [ -f "$APP_DIR/package-lock.json" ]; then
  app_sh "npm ci --no-audit --no-fund" || { warn "npm ci failed; trying npm install..."; app_sh "npm install --no-audit --no-fund" || fail "npm could not install the dependencies."; }
else
  app_sh "npm install --no-audit --no-fund" || fail "npm could not install the dependencies."
fi

if [ "$NO_BUILD" -eq 1 ] || [ "${DRY_RUN}" -eq 1 ]; then
  echo
  info "Stopped after the code update (--no-build / --dry-run)."
  exit 0
fi

# ─── Phase 4: database schema ─────────────────────────────────────
echo
info "Prisma: generate + migrate (fallback db push)..."
app_sh "npx prisma generate" || fail "prisma generate failed; see the output above."
if ! app_sh "npx prisma migrate deploy"; then
  info "migrate deploy failed; trying db push..."
  app_sh "npx prisma db push" || fail "Prisma could not apply the schema. Check DATABASE_URL in $APP_DIR/.env; the backups are in ${BACKUP_DIR}."
fi

# ─── Phase 5: build ───────────────────────────────────────────────
echo
info "Building for production..."
app_sh "npm run build" || fail "Build failed; the running version is untouched until PM2 restarts."

# ─── Phase 6: restart ─────────────────────────────────────────────
echo
if ! command -v pm2 >/dev/null 2>&1 && [ ! -x "$NODE_DIR/pm2" ]; then
  fail "pm2 is not installed; run deploy-ubuntu.sh."
fi
if [ ! -f "$APP_DIR/ecosystem.config.cjs" ]; then
  info "Recreating ecosystem.config.cjs for the service user..."
  cat > "$APP_DIR/ecosystem.config.cjs" <<EOF
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
  chown "$APP_USER":"$(id -gn "$APP_USER")" "$APP_DIR/ecosystem.config.cjs" 2>/dev/null || true
fi
info "Restarting '${APP_NAME}' on 127.0.0.1:${PORT}..."
app_sh "pm2 startOrRestart ecosystem.config.cjs --update-env" || fail "PM2 could not (re)start the app."
app_sh "pm2 save" || warn "pm2 save failed; the app will not survive a reboot."

# ─── Phase 7: health check ────────────────────────────────────────
echo
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "http://127.0.0.1:${PORT}/" || echo 000)"
if [ "$CODE" = "200" ] || [ "$CODE" = "301" ] || [ "$CODE" = "302" ] || [ "$CODE" = "307" ]; then
  info "Health check: HTTP $CODE from the app itself — the update looks good."
else
  warn "Health check: HTTP $CODE from 127.0.0.1:${PORT}. Last log lines:"
  app_sh "pm2 logs ${APP_NAME} --lines 30 --nostream" || true
  warn "Roll the code back with: git -C $APP_DIR checkout ${OLD_SHA:-<previous sha>} && sudo bash $APP_DIR/scripts/update-ubuntu.sh --skip-deps"
fi

if [ "${RUN_FULL}" -eq 1 ]; then
  echo
  info "Running deploy-ubuntu.sh so the site/vhost file matches the new code..."
  bash "$APP_DIR/scripts/deploy-ubuntu.sh"
fi

echo
info "Update finished."
if [ -n "$OLD_SHA" ]; then
  echo "    code was ${OLD_SHA}, now $(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo '?')"
fi
echo "    backups: ${BACKUP_DIR}/env-${STAMP} (and db-*.dump when pg_dump was available)"
