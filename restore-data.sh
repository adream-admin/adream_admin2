#!/bin/bash
# DB만 복원: bash restore.sh db 로 대체됨
exec bash "$(dirname "$0")/restore.sh" db
