#!/bin/bash
# 스케줄 어드민 배포 스크립트 (git push → webhook 자동 배포)
# 사용법: bash deploy.sh "커밋 메시지"

set -e

SRC="/mnt/c/Users/ADREAM-PC08/어드민/스케줄 어드민"
MSG="${1:-deploy}"

cd "$SRC"

echo "=== [1/2] Git push ==="
git add -A
git commit -m "$MSG" || echo "(변경사항 없음)"
git push origin main
echo "Push 완료 → 서버에서 자동 빌드/배포 시작"

echo ""
echo "=== 배포 시작됨 ==="
echo "텔레그램으로 완료 알림이 옵니다."
