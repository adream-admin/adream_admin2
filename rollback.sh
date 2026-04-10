#!/bin/bash
# 롤백 스크립트 - blog-schedule-admin
# 사용법:
#   bash rollback.sh        → 코드 롤백 (최신 백업으로)
#   bash rollback.sh code   → 코드 롤백 (백업 선택)
#   bash rollback.sh db     → DB 롤백 (백업 선택)

SERVER="ubuntu@3.35.150.185"
KEY="$HOME/.ssh/lightsail.pem"
REMOTE_DIR="/home/ubuntu/blog-schedule-admin"
CODE_BACKUP_DIR="/home/ubuntu/backups/schedule-admin"
DB_BACKUP_DIR="/home/ubuntu/blog-schedule-admin/backups"
APP_NAME="blog-schedule-admin"
MODE="${1:-code}"

ssh -i "$KEY" -o StrictHostKeyChecking=no "$SERVER" << ENDSSH
set -e
MODE="$MODE"

if [ "\$MODE" = "db" ]; then
  echo "=== DB 롤백 ==="
  echo ""
  echo "사용 가능한 DB 백업 목록:"
  BACKUPS=(\$(ls -dt $DB_BACKUP_DIR/*/ 2>/dev/null | head -10))
  if [ \${#BACKUPS[@]} -eq 0 ]; then
    echo "❌ 백업이 없습니다."
    exit 1
  fi
  for i in "\${!BACKUPS[@]}"; do
    echo "  [\$((i+1))] \$(basename \${BACKUPS[\$i]})"
  done
  echo ""
  read -p "복원할 번호 입력 (기본값: 1): " CHOICE
  CHOICE=\${CHOICE:-1}
  SELECTED=\${BACKUPS[\$((CHOICE-1))]}
  if [ -z "\$SELECTED" ]; then
    echo "❌ 잘못된 번호입니다."
    exit 1
  fi
  echo ""
  echo "선택: \$(basename \$SELECTED)"
  read -p "DB를 복원하면 현재 데이터가 덮어써집니다. 계속하시겠습니까? (y/N): " CONFIRM
  if [ "\$CONFIRM" != "y" ] && [ "\$CONFIRM" != "Y" ]; then
    echo "취소됐습니다."
    exit 0
  fi
  # 현재 DB 임시 백업
  TIMESTAMP=\$(date +"%Y%m%d_%H%M%S")
  cp $REMOTE_DIR/prisma/dev.db $REMOTE_DIR/prisma/dev.db.before_rollback_\$TIMESTAMP
  # DB 복원
  cp "\$SELECTED/dev.db" "$REMOTE_DIR/prisma/dev.db"
  echo "✓ DB 롤백 완료: \$(basename \$SELECTED)"
  echo "  (롤백 전 DB는 dev.db.before_rollback_\$TIMESTAMP 으로 보존됨)"

else
  echo "=== 코드 롤백 ==="
  echo ""
  echo "사용 가능한 코드 백업 목록:"
  BACKUPS=(\$(ls -dt $CODE_BACKUP_DIR/*/ 2>/dev/null | head -10))
  if [ \${#BACKUPS[@]} -eq 0 ]; then
    echo "❌ 백업이 없습니다."
    exit 1
  fi
  for i in "\${!BACKUPS[@]}"; do
    echo "  [\$((i+1))] \$(basename \${BACKUPS[\$i]})"
  done
  echo ""
  read -p "복원할 번호 입력 (기본값: 1 = 최신): " CHOICE
  CHOICE=\${CHOICE:-1}
  SELECTED=\${BACKUPS[\$((CHOICE-1))]}
  if [ -z "\$SELECTED" ]; then
    echo "❌ 잘못된 번호입니다."
    exit 1
  fi
  echo ""
  echo "선택: \$(basename \$SELECTED)"
  read -p "코드를 복원하시겠습니까? (y/N): " CONFIRM
  if [ "\$CONFIRM" != "y" ] && [ "\$CONFIRM" != "Y" ]; then
    echo "취소됐습니다."
    exit 0
  fi
  # 코드 복원 (DB 제외)
  rsync -a --exclude='*.db' --exclude='*.db-shm' --exclude='*.db-wal' "\$SELECTED/" "$REMOTE_DIR/"
  # PM2 무중단 재시작
  cd $REMOTE_DIR
  npm install --production --silent
  pm2 reload $APP_NAME --update-env
  pm2 save
  echo "✓ 코드 롤백 완료: \$(basename \$SELECTED)"
  echo "✓ PM2 재시작 완료"
fi
ENDSSH
