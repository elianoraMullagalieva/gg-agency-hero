#!/usr/bin/env bash
# Выгрузка сайта на хостинг Beget по SFTP.
# Пароль берётся из deploy/secrets.env и в команду не попадает.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SECRETS="$SCRIPT_DIR/secrets.env"

if [[ ! -f "$SECRETS" ]]; then
  echo "Нет файла с паролем: $SECRETS" >&2
  echo "Скопируйте secrets.env.example в secrets.env и впишите пароль." >&2
  exit 1
fi

# shellcheck source=/dev/null
set -a; source "$SECRETS"; set +a

: "${SFTP_HOST:?SFTP_HOST не задан в secrets.env}"
: "${SFTP_USER:?SFTP_USER не задан в secrets.env}"
: "${SFTP_PASS:?SFTP_PASS не задан в secrets.env}"
SFTP_PORT="${SFTP_PORT:-22}"
REMOTE_DIR="${REMOTE_DIR:?REMOTE_DIR не задан в secrets.env}"

DRY_RUN=""
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN="--dry-run"
  echo "Пробный прогон: ничего не заливается, только показывается план."
fi

# Что не заливаем на сервер
EXCLUDES=(
  --exclude-glob '.git/'
  --exclude-glob '.git*'
  --exclude-glob '.DS_Store'
  --exclude-glob '*.log'
  --exclude-glob 'deploy/'
  --exclude-glob 'node_modules/'
)

echo "Заливаю $PROJECT_DIR → $SFTP_USER@$SFTP_HOST:$REMOTE_DIR"

LFTP_PASSWORD="$SFTP_PASS" lftp -c "
set cmd:fail-exit yes;
set sftp:auto-confirm yes;
set net:max-retries 3;
set net:timeout 20;
open --env-password -u '$SFTP_USER' sftp://$SFTP_HOST:$SFTP_PORT;
mkdir -p -f '$REMOTE_DIR';
mirror --reverse --verbose --continue --parallel=4 $DRY_RUN ${EXCLUDES[*]@Q} '$PROJECT_DIR' '$REMOTE_DIR';
bye
"

echo "Готово."
