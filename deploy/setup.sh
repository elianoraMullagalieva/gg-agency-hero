#!/usr/bin/env bash
# Разовая настройка: спрашивает данные хостинга и сохраняет их в deploy/secrets.env.
# Пароль вводится скрытым вводом и нигде не отображается.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECRETS="$SCRIPT_DIR/secrets.env"

if [[ -f "$SECRETS" ]]; then
  read -r -p "Файл $SECRETS уже есть. Перезаписать? [y/N] " answer
  [[ "$answer" =~ ^[Yy]$ ]] || { echo "Отменено."; exit 0; }
fi

read -r -p "Хост (например elianono.beget.tech): " host
read -r -p "Порт [22]: " port
port="${port:-22}"
read -r -p "Логин: " user
read -r -s -p "Пароль (ввод не отображается): " pass
echo
read -r -s -p "Пароль ещё раз: " pass2
echo
if [[ "$pass" != "$pass2" ]]; then
  echo "Пароли не совпали. Запустите скрипт заново." >&2
  exit 1
fi
# Путь БЕЗ ведущего слэша: SFTP на Beget заходит сразу в домашнюю папку,
# а /<домен> от корня сервера не существует.
read -r -p "Папка на сервере [$host/public_html]: " remote
remote="${remote:-$host/public_html}"
remote="${remote#/}"

umask 177
cat > "$SECRETS" <<SECRETS_EOF
SFTP_HOST=$host
SFTP_PORT=$port
SFTP_USER=$user
SFTP_PASS=$pass
REMOTE_DIR=$remote
SECRETS_EOF
chmod 600 "$SECRETS"

echo "Сохранено в $SECRETS (права 600, в git не попадёт)."
echo "Проверьте подключение:  ./deploy/deploy.sh --dry-run"
