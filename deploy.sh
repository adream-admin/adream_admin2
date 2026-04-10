#!/bin/bash
# 스케줄 어드민 배포 스크립트 (로컬 빌드 → 서버 업로드)
# 사용법: bash deploy.sh

set -e

SRC="/mnt/c/Users/ADREAM-PC08/어드민/스케줄 어드민"
SERVER="ubuntu@3.35.150.185"
KEY="$HOME/.ssh/lightsail.pem"
REMOTE_DIR="/home/ubuntu/blog-schedule-admin"
REMOTE_BACKUP_DIR="/home/ubuntu/backups/schedule-admin"
S3_BUCKET="adream-backup"
APP_NAME="blog-schedule-admin"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "=== [1/6] 로컬 빌드 ==="
cd "$SRC"
npm run build
if [ ! -d ".next" ]; then
  echo "빌드 실패: .next 디렉토리가 없습니다"
  exit 1
fi
echo "빌드 성공"

echo "=== [2/6] 로컬 백업 ==="
bash "$SRC/backup.sh"

echo "=== [3/6] 서버 현재 버전 백업 ==="
ssh -i "$KEY" -o StrictHostKeyChecking=no "$SERVER" << ENDSSH
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_PATH="$REMOTE_BACKUP_DIR/\$TIMESTAMP"
mkdir -p "\$BACKUP_PATH"
if [ -d "$REMOTE_DIR" ]; then
  rsync -a --exclude='*.db' --exclude='*.db-shm' --exclude='*.db-wal' --exclude='backups' --exclude='code-backups' "$REMOTE_DIR/" "\$BACKUP_PATH/"
  echo "✓ 서버 백업 완료: \$BACKUP_PATH"
  ls -dt $REMOTE_BACKUP_DIR/*/ 2>/dev/null | tail -n +6 | xargs rm -rf
fi
ENDSSH

echo "=== [4/6] 서버 파일 업로드 ==="
rsync -az --delete \
  --exclude='node_modules' \
  --exclude='*.db' \
  --exclude='*.db-shm' \
  --exclude='*.db-wal' \
  --exclude='backups' \
  --exclude='code-backups' \
  --exclude='.claude' \
  -e "ssh -i $KEY -o StrictHostKeyChecking=no" \
  "$SRC/" "$SERVER:$REMOTE_DIR/"
echo "업로드 완료"

echo "=== [5/6] S3 코드 백업 ==="
ssh -i "$KEY" -o StrictHostKeyChecking=no "$SERVER" bash << ENDSSH
source /home/ubuntu/.env_alert
cd /home/ubuntu
if tar --exclude='blog-schedule-admin/node_modules' --exclude='blog-schedule-admin/*.db' \
       --exclude='blog-schedule-admin/backups' --exclude='blog-schedule-admin/code-backups' \
       -czf /tmp/schedule_code_${TIMESTAMP}.tar.gz blog-schedule-admin/ && \
   aws s3 cp /tmp/schedule_code_${TIMESTAMP}.tar.gz s3://$S3_BUCKET/schedule-admin/code/${TIMESTAMP}.tar.gz; then
  rm -f /tmp/schedule_code_${TIMESTAMP}.tar.gz
  echo "✓ S3 코드 백업 완료"
else
  rm -f /tmp/schedule_code_${TIMESTAMP}.tar.gz
  curl -s -X POST "https://api.telegram.org/bot\$TELEGRAM_BOT_TOKEN/sendMessage" \
    -d chat_id="\$TELEGRAM_CHAT_ID" \
    -d parse_mode="HTML" \
    -d text="🚨 <b>코드 백업 실패</b>
앱: 스케줄 어드민
시간: \$(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S')" > /dev/null
  echo "❌ S3 코드 백업 실패 (배포는 계속 진행)"
fi
ENDSSH

echo "=== [6/6] 서버 의존성 설치 및 PM2 무중단 재시작 ==="
ssh -i "$KEY" -o StrictHostKeyChecking=no "$SERVER" << ENDSSH
set -e
cd $REMOTE_DIR
npm install --production --silent
npx prisma db push 2>&1

if pm2 describe $APP_NAME > /dev/null 2>&1; then
  pm2 reload $APP_NAME --update-env
else
  pm2 start npm --name "$APP_NAME" -- start -- -p 3001
fi

pm2 save
echo "서버 재시작 완료"
ENDSSH

echo ""
echo "=== 배포 완료 ==="
