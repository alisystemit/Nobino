#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════
#  Nobino — one-line installer for a clean Ubuntu VPS
#
#  The code is fetched from the public GitHub repository, so nothing has to
#  be uploaded to the server by hand.
#
#    curl -fsSL https://raw.githubusercontent.com/alisystemit/Nobino/main/scripts/install-from-github.sh | sudo bash
#
#  or, if wget is all the box has:
#
#    wget -qO- https://raw.githubusercontent.com/alisystemit/Nobino/main/scripts/install-from-github.sh | sudo bash
#
#  From a local copy of this file (no download at all):
#
#    sudo bash scripts/install-from-github.sh
#
#  Environment overrides (passed straight through to deploy-ubuntu.sh):
#    REPO_URL        git repository to clone   (default: public Nobino repo)
#    GIT_REF         branch/tag/commit         (default: main)
#    APP_USER        service user for the app  (default: nobino)
#    APP_HOME        home of that user         (default: /var/lib/nobino)
#    APP_DIR         install directory         (default: /opt/nobino)
#    PORT            internal Next.js port     (default: 3000)
#    NGINX_PORT      public Nginx port         (default: 80, or a free port
#                                               when Apache owns 80)
#    COEXIST         auto|1|0 keep an existing Apache/MySQL/PHP stack intact
#    MANAGE_UFW      auto|1|0 firewall handling
#    ENABLE_SSL      auto|1|0 certbot for DOMAIN
#    DOMAIN          domain for SSL (empty = IP/port only)
#    SSL_EMAIL       certbot contact email
#    APP_URL         public app URL
#    ROOT_DOMAIN     root domain for subdomains
#    NONINTERACTIVE  1 = never prompt, use defaults/env values
#
#  Safe on a server that already runs Apache + PHP 8 + MySQL (a Telegram bot,
#  phpMyAdmin, etc.): nothing of that stack is installed, upgraded, restarted
#  or reconfigured. Nobino gets its own user, its own folder, its own Node
#  process and its own Nginx file on a free port.
#
#  Re-running it is safe: the repository is updated and the deployment
#  phases that are already satisfied are skipped.
# ══════════════════════════════════════════════════════════════════
set -euo pipefail

C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'; C_CYAN=$'\033[36m'; C_RESET=$'\033[0m'
info() { echo "${C_GREEN}[+]${C_RESET} $*"; }
warn() { echo "${C_YELLOW}[!]${C_RESET} $*"; }
fail() { echo "${C_RED}[x]${C_RESET} $*" >&2; exit 1; }
ask() { # ask <prompt> <default> — reads the terminal, never stdin (it holds the script when piped)
  local prompt="${1:-}" default="${2:-}" ans=""
  if [ "${NONINTERACTIVE:-0}" = "1" ]; then printf '%s\n' "$default"; return 0; fi
  if [ -t 0 ]; then
    read -r -p "${C_CYAN}?${C_RESET} ${prompt} [${default}]: " ans
  elif [ -e /dev/tty ] && { : </dev/tty; } 2>/dev/null; then
    read -r -p "${C_CYAN}?${C_RESET} ${prompt} [${default}]: " ans </dev/tty || ans=""
  else
    warn "No terminal available; using the default for '${prompt}' (or set NONINTERACTIVE=1 with env values)."
  fi
  printf '%s\n' "${ans:-$default}"
}

REPO_URL="${REPO_URL:-https://github.com/alisystemit/Nobino.git}"
GIT_REF="${GIT_REF:-main}"
# Outside /var/www on purpose: an existing Apache/PHP site keeps its folders.
APP_DIR="${APP_DIR:-/opt/nobino}"

# ─── Sanity checks ────────────────────────────────────────────────
[ "$(uname -s)" = "Linux" ] || fail "This installer only runs on Linux/Ubuntu."
if [ -f /etc/os-release ]; then
  . /etc/os-release
  case "${ID:-}" in
    ubuntu|debian|linuxmint|pop) : ;;
    *) case "${ID_LIKE:-}" in *debian*|*ubuntu*) : ;; *) warn "Detected ${NAME:-?}; this installer is written for Ubuntu/Debian." ;; esac ;;
  esac
fi

# ─── Privilege: needs root ────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1 && [ -f "$0" ] && [ -r "$0" ]; then
    info "Not root; restarting through sudo..."
    exec sudo -E bash "$0" "$@"
  fi
  fail "Root is required. Run: curl -fsSL <this script URL> | sudo bash"
fi

export REPO_URL GIT_REF APP_DIR
export APP_USER="${APP_USER:-nobino}"
[ -n "${APP_HOME:-}" ] && export APP_HOME || true
export PORT="${PORT:-3000}"
# NGINX_PORT is only exported when asked for: deploy-ubuntu.sh then chooses 80
# on a dedicated server, or a free port (8080+) when Apache already owns 80.
[ -n "${NGINX_PORT:-}" ] && export NGINX_PORT || true
export COEXIST="${COEXIST:-auto}" MANAGE_UFW="${MANAGE_UFW:-auto}" ENABLE_SSL="${ENABLE_SSL:-auto}"
export NONINTERACTIVE="${NONINTERACTIVE:-0}"
export DEBIAN_FRONTEND=noninteractive

# ─── Bootstrap the few tools needed to fetch the code ─────────────
if ! command -v git >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
  info "Installing git/curl so the repository can be fetched..."
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y >/dev/null
    apt-get install -y git curl ca-certificates >/dev/null || warn "apt reported errors; continuing."
  else
    fail "git/curl are missing and apt-get is unavailable; install them and rerun."
  fi
fi

# ─── Fetch the code (or keep what is already there) ───────────────
if [ -d "$APP_DIR/.git" ]; then
  info "$APP_DIR already contains a git checkout; deploy-ubuntu.sh will update it."
elif [ -d "$APP_DIR" ] && [ -n "$(ls -A "$APP_DIR" 2>/dev/null)" ]; then
  if [ -f "$APP_DIR/package.json" ] && [ -f "$APP_DIR/scripts/deploy-ubuntu.sh" ]; then
    warn "$APP_DIR holds files that were placed there manually; using them as-is."
  else
    fail "$APP_DIR exists and is not empty, and is not a Nobino checkout. Choose another APP_DIR or clean it up first."
  fi
else
  CONFIRMED_REPO="$(ask "Repository URL to clone" "$REPO_URL")"
  [ -n "$CONFIRMED_REPO" ] || fail "A repository URL is required."
  CONFIRMED_REF="$(ask "Branch or tag to install" "$GIT_REF")"
  GIT_REF="$CONFIRMED_REF"
  export GIT_REF

  # Clone into a throwaway directory first: nothing inside APP_DIR is ever
  # removed, even if the requested ref does not exist.
  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TMP_DIR"' EXIT
  info "Cloning ${CONFIRMED_REPO} (${GIT_REF})..."
  if ! git clone --branch "$GIT_REF" "$CONFIRMED_REPO" "$TMP_DIR/repo"; then
    warn "--branch failed (a commit hash or an unusual ref?); cloning the default branch..."
    git clone "$CONFIRMED_REPO" "$TMP_DIR/repo"
    if ! git -C "$TMP_DIR/repo" checkout "$GIT_REF" >/dev/null 2>&1; then
      warn "Could not check out '$GIT_REF'; deploying the default branch instead."
      GIT_REF="$(git -C "$TMP_DIR/repo" rev-parse --abbrev-ref HEAD)"; export GIT_REF
    fi
  fi
  info "Cloned at $(git -C "$TMP_DIR/repo" rev-parse --short HEAD)."
  mkdir -p "$APP_DIR"
  cp -a "$TMP_DIR/repo/." "$APP_DIR/"
  trap - EXIT
  rm -rf "$TMP_DIR"
fi

# ─── Hand over to the real deployment script, from the cloned file ─
# Running it as a file (not through the pipe) keeps the terminal usable for
# its questions.
DEPLOY_SCRIPT="$APP_DIR/scripts/deploy-ubuntu.sh"
[ -f "$DEPLOY_SCRIPT" ] || fail "$DEPLOY_SCRIPT not found after the clone; check REPO_URL/GIT_REF."
chmod +x "$DEPLOY_SCRIPT"

echo ""
info "Starting the Nobino deployment (service user, PostgreSQL, Node.js, build, PM2, Nginx on its own port)..."
info "Apache, PHP and MySQL already on this server are left exactly as they are."
echo ""
exec bash "$DEPLOY_SCRIPT"
