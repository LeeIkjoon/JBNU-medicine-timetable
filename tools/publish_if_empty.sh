#!/bin/bash
# 변환해 둔 기본 시간표(data/2026-2/<학교>/<학교>_<학년>.json)를 Firebase에 올린다.
# 이미 시간표가 있는 학년은 건드리지 않는다(덮어쓰려면 직접 PUT).
# 사용: tools/publish_if_empty.sh dcu yu     (학교 키 나열)
DB="https://jbnu-med-timetable-default-rtdb.firebaseio.com/timetable"
cd "$(dirname "$0")/.." || exit 1
for sc in "$@"; do
  for f in data/2026-2/"$sc"/"$sc"_*.json; do
    [ -f "$f" ] || continue
    key=$(basename "$f" .json)
    enc=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$key")
    cur=$(curl -s "$DB/$enc/ts.json")
    if [ "$cur" != "null" ]; then echo "건너뜀  $key (이미 있음)"; continue; fi
    code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT -H "Content-Type: application/json" --data-binary @"$f" "$DB/$enc.json")
    echo "등록 $code  $key"
  done
done
