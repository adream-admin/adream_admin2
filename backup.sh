#!/bin/bash
# 소스코드 백업 스크립트
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SRC="/mnt/c/Users/ADREAM-PC08/어드민/스케줄 어드민"
BACKUP_DIR="$SRC/backups/$TIMESTAMP"

mkdir -p "$BACKUP_DIR"

rsync -a \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='backups' \
  --exclude='code-backups' \
  --exclude='*.tar.gz' \
  "$SRC/" "$BACKUP_DIR/"

echo "✓ 백업 완료: backups/$TIMESTAMP"
