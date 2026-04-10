@echo off
echo 블로그 스케줄 배정 어드민 시작 중...
cd /d %~dp0
wsl npm run dev
pause
