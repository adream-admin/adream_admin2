#!/bin/bash
# 스케줄 어드민 복원 스크립트 (서버 장애 / 새 서버 셋업 시)
# 사용법:
#   bash restore.sh         → 코드 + DB 전체 복원 (S3에서)
#   bash restore.sh code    → 코드만 복원 (S3에서)
#   bash restore.sh db      → DB만 복원 (S3에서)

SERVER="ubuntu@3.35.150.185"
KEY="$HOME/.ssh/lightsail.pem"
REMOTE_DIR="/home/ubuntu/blog-schedule-admin"
S3_BUCKET="adream-backup"
APP_NAME="blog-schedule-admin"
MODE="${1:-all}"

echo "=== 스케줄 어드민 복원 시작 (모드: $MODE) ==="
echo ""

if [ "$MODE" = "db" ]; then
  echo "사용 가능한 DB 백업 (S3):"
  BACKUPS=$(ssh -i "$KEY" -o StrictHostKeyChecking=no "$SERVER" \
    "aws s3 ls s3://$S3_BUCKET/schedule-admin/db/ | sort -r | awk '{print \$4}' | head -10")
  echo "$BACKUPS" | nl -w2 -s'] ' | sed 's/^ */[/'
  echo ""
  read -p "복원할 번호 입력 (기본값: 1 = 최신): " CHOICE
  CHOICE=${CHOICE:-1}
  SELECTED=$(echo "$BACKUPS" | sed -n "${CHOICE}p")
  if [ -z "$SELECTED" ]; then echo "❌ 잘못된 번호입니다."; exit 1; fi
  echo "선택: $SELECTED"
  read -p "DB를 복원하면 현재 데이터가 덮어써집니다. 계속하시겠습니까? (y/N): " CONFIRM
  if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then echo "취소됐습니다."; exit 0; fi
  ssh -i "$KEY" -o StrictHostKeyChecking=no "$SERVER" bash << ENDSSH
set -e
TIMESTAMP=\$(date +"%Y%m%d_%H%M%S")
mkdir -p $REMOTE_DIR/prisma
[ -f $REMOTE_DIR/prisma/dev.db ] && cp $REMOTE_DIR/prisma/dev.db $REMOTE_DIR/prisma/dev.db.before_restore_\$TIMESTAMP
aws s3 cp s3://$S3_BUCKET/schedule-admin/db/$SELECTED /tmp/restore_dev.db
cp /tmp/restore_dev.db $REMOTE_DIR/prisma/dev.db
rm -f /tmp/restore_dev.db
echo "✓ DB 복원 완료: $SELECTED"
ENDSSH

elif [ "$MODE" = "code" ]; then
  echo "사용 가능한 코드 백업 (S3):"
  BACKUPS=$(ssh -i "$KEY" -o StrictHostKeyChecking=no "$SERVER" \
    "aws s3 ls s3://$S3_BUCKET/schedule-admin/code/ | sort -r | awk '{print \$4}' | head -10")
  echo "$BACKUPS" | nl -w2 -s'] ' | sed 's/^ */[/'
  echo ""
  read -p "복원할 번호 입력 (기본값: 1 = 최신): " CHOICE
  CHOICE=${CHOICE:-1}
  SELECTED=$(echo "$BACKUPS" | sed -n "${CHOICE}p")
  if [ -z "$SELECTED" ]; then echo "❌ 잘못된 번호입니다."; exit 1; fi
  echo "선택: $SELECTED"
  read -p "코드를 복원하시겠습니까? (y/N): " CONFIRM
  if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then echo "취소됐습니다."; exit 0; fi
  ssh -i "$KEY" -o StrictHostKeyChecking=no "$SERVER" bash << ENDSSH
set -e
aws s3 cp s3://$S3_BUCKET/schedule-admin/code/$SELECTED /tmp/restore_code.tar.gz
tar -xzf /tmp/restore_code.tar.gz -C /home/ubuntu/
rm -f /tmp/restore_code.tar.gz
cd $REMOTE_DIR
npm install --production --silent
npx prisma db push 2>&1
if pm2 describe $APP_NAME > /dev/null 2>&1; then
  pm2 reload $APP_NAME --update-env
else
  pm2 start npm --name "$APP_NAME" -- start -- -p 3001
fi
pm2 save
echo "✓ 코드 복원 및 PM2 재시작 완료: $SELECTED"
ENDSSH

else
  # 전체 복원 (code + db)
  echo "사용 가능한 코드 백업 (S3):"
  CODE_BACKUPS=$(ssh -i "$KEY" -o StrictHostKeyChecking=no "$SERVER" \
    "aws s3 ls s3://$S3_BUCKET/schedule-admin/code/ | sort -r | awk '{print \$4}' | head -10")
  echo "$CODE_BACKUPS" | nl -w2 -s'] ' | sed 's/^ */[/'
  read -p "코드 복원할 번호 입력 (기본값: 1): " CODE_CHOICE
  CODE_CHOICE=${CODE_CHOICE:-1}
  SELECTED_CODE=$(echo "$CODE_BACKUPS" | sed -n "${CODE_CHOICE}p")

  echo ""
  echo "사용 가능한 DB 백업 (S3):"
  DB_BACKUPS=$(ssh -i "$KEY" -o StrictHostKeyChecking=no "$SERVER" \
    "aws s3 ls s3://$S3_BUCKET/schedule-admin/db/ | sort -r | awk '{print \$4}' | head -10")
  echo "$DB_BACKUPS" | nl -w2 -s'] ' | sed 's/^ */[/'
  read -p "DB 복원할 번호 입력 (기본값: 1): " DB_CHOICE
  DB_CHOICE=${DB_CHOICE:-1}
  SELECTED_DB=$(echo "$DB_BACKUPS" | sed -n "${DB_CHOICE}p")

  if [ -z "$SELECTED_CODE" ] || [ -z "$SELECTED_DB" ]; then echo "❌ 잘못된 번호입니다."; exit 1; fi
  echo ""
  echo "코드: $SELECTED_CODE"
  echo "DB:   $SELECTED_DB"
  read -p "전체 복원하시겠습니까? (y/N): " CONFIRM
  if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then echo "취소됐습니다."; exit 0; fi

  ssh -i "$KEY" -o StrictHostKeyChecking=no "$SERVER" bash << ENDSSH
set -e
TIMESTAMP=\$(date +"%Y%m%d_%H%M%S")
# 코드 복원
aws s3 cp s3://$S3_BUCKET/schedule-admin/code/$SELECTED_CODE /tmp/restore_code.tar.gz
tar -xzf /tmp/restore_code.tar.gz -C /home/ubuntu/
rm -f /tmp/restore_code.tar.gz
echo "✓ 코드 복원 완료"
# DB 복원
mkdir -p $REMOTE_DIR/prisma
[ -f $REMOTE_DIR/prisma/dev.db ] && cp $REMOTE_DIR/prisma/dev.db $REMOTE_DIR/prisma/dev.db.before_restore_\$TIMESTAMP
aws s3 cp s3://$S3_BUCKET/schedule-admin/db/$SELECTED_DB /tmp/restore_dev.db
cp /tmp/restore_dev.db $REMOTE_DIR/prisma/dev.db
rm -f /tmp/restore_dev.db
echo "✓ DB 복원 완료"
# PM2 시작
cd $REMOTE_DIR
npm install --production --silent
npx prisma db push 2>&1
if pm2 describe $APP_NAME > /dev/null 2>&1; then
  pm2 reload $APP_NAME --update-env
else
  pm2 start npm --name "$APP_NAME" -- start -- -p 3001
fi
pm2 save
echo "✓ PM2 재시작 완료"
ENDSSH
fi

echo ""
echo "=== 복원 완료 ==="
