#!/usr/bin/env bash
# Pathao API — pull cities → zones → areas into locations.json
#
# Usage:
#   ./fetch_pathao_locations.sh -a city   # fetch city list, overwrite locations.json
#   ./fetch_pathao_locations.sh -a zone   # for each city in locations.json, fetch zones, save
#   ./fetch_pathao_locations.sh -a area   # for each zone in locations.json, fetch areas, save
set -euo pipefail

BASE_URL="https://api-hermes.pathao.com"
ACCESS_TOKEN="${ACCESS_TOKEN:-eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyMTAyOTkiLCJhdWQiOlsiNTg0MiJdLCJleHAiOjE3OTkwOTczMzIsIm5iZiI6MTc5MTMyMTMzMiwiaWF0IjoxNzkxMzIxMzMyLCJqdGkiOiJiNWFjNGQ0YjVkMGViN2E5NDBiM2FmN2Y1NWQ3ODIwMzIyZGM1OGM0OWQ2MTlmZTZmYzgxNDdiZmNiYTUxODAwIiwibWVyY2hhbnRfaWQiOiJZUmRHWllFNWJEIiwic2NvcGVzIjpbXX0.siX92JmqIfUuJR41rxxFdk20MXxafr9DdScOOX2me0pS0MLEeXTJSZp0hq2N45Tjo6iYSu2r786b3g17hltVW9gHFIODQ9fUdoJB4pbisJPmpJSu5YwrAr4RWHHjcKcm3wE3pT_Kf06Kg4F_OAnfMYLwgcA687RWt_fgIPdYtd_Rk_75Teu1dwEydHlAHgFHYjwLhssRY4VWbhbNC1rg2EQ_bVheD2OSNRxtz-Kt4clghDL1OEtaz21kXbrT3Ky6s3Y93qSJqlcoWiqEDvhmnHbIPldkqpXfZbeuDk_Qm5xYGcrg9Nv2ZtPfpl-WvWersRAhKDT9Qv7bjEUsqz-YreS4aU1QRvzKVY3exlXGWwomhx05ktyp9of-e0FmFj4_G6P1E9WWn47bbtmC1av1e3MGk4wzke_kef6vjYW_ZaBEaKTX8wLft1-EiUv6Kvzpu78WQIk-Scl9PMWdtKTpMmV3l0xCFXjpdfsIj6mHsafXWzmqAHLyTOgRlLw6X6mWk72fVSnWjbS9CiwVZkr-DnQeyKEVzZCwHo2Cr_Ocnqy1dHZymGsBH98qcs7JHRs-YwV4tx4ThlodjxsEEma_Hbu4g0Trq9-uMcVL1LEtXRvXjMFp4FMCZC1ybgtJpVM4_ScZJvcrwHXuJt1nRnE72Q94-5Sl9FGTaBFgiPIJ7zc}"
OUTPUT_FILE="locations.json"
ACTION=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -a=*) ACTION="${1#-a=}"; shift ;;
    -a)   ACTION="${2:-}"; shift 2 ;;
    -o=*) OUTPUT_FILE="${1#-o=}"; shift ;;
    *)    echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

case "$ACTION" in
  city|zone|area) ;;
  *) echo "Usage: $0 -a=city|zone|area [-o=output.json]" >&2; exit 1 ;;
esac

api_get() {
  local attempt=1
  while true; do
    local out
    out=$(curl -s \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H "Content-Type: application/json; charset=UTF-8" \
      "$1")
    if echo "$out" | jq -e '.data.data' >/dev/null 2>&1; then
      echo "$out"
      return 0
    fi
    if [[ $attempt -ge 6 ]]; then
      echo "$out" >&2
      return 1
    fi
    echo "    ! retrying (attempt ${attempt})..." >&2
    sleep $((attempt * 3))
    attempt=$((attempt + 1))
  done
}

save() {
  echo "$1" | jq '.' > "${OUTPUT_FILE}.tmp" && mv "${OUTPUT_FILE}.tmp" "$OUTPUT_FILE"
  echo "    [✓] saved ${OUTPUT_FILE}"
}

# ── city ──────────────────────────────────────────────────────────────────────
if [[ "$ACTION" == "city" ]]; then
  echo "[*] Fetching cities..."
  CITIES_JSON=$(api_get "${BASE_URL}/aladdin/api/v1/city-list")
  RESULT=$(echo "$CITIES_JSON" | jq '[.data.data[] | {city_id, city_name}]')
  save "$RESULT"
  echo "$RESULT" | jq 'length' | xargs echo "[✓] cities:"
  exit 0
fi

[[ -f "$OUTPUT_FILE" ]] || { echo "$OUTPUT_FILE not found — run -a=city first" >&2; exit 1; }
RESULT=$(cat "$OUTPUT_FILE")

# ── zone ──────────────────────────────────────────────────────────────────────
if [[ "$ACTION" == "zone" ]]; then
  CITY_IDS=$(echo "$RESULT" | jq '.[].city_id')
  for CITY_ID in $CITY_IDS; do
    CITY_NAME=$(echo "$RESULT" | jq -r --argjson id "$CITY_ID" '.[] | select(.city_id==$id) | .city_name')
    echo "  [+] City: ${CITY_NAME} (id=${CITY_ID})"

    ZONES_JSON=$(api_get "${BASE_URL}/aladdin/api/v1/cities/${CITY_ID}/zone-list") || { echo "    ! failed, skipping"; continue; }
    sleep 1
    ZONES=$(echo "$ZONES_JSON" | jq '[.data.data[] | {zone_id, zone_name}]')

    RESULT=$(echo "$RESULT" | jq --argjson id "$CITY_ID" --argjson zones "$ZONES" \
      'map(if .city_id==$id then . + {zones: $zones} else . end)')
    save "$RESULT"
    echo "    [✓] zones: $(echo "$ZONES" | jq 'length')"
  done
  exit 0
fi

# ── area ──────────────────────────────────────────────────────────────────────
if [[ "$ACTION" == "area" ]]; then
  CITY_IDS=$(echo "$RESULT" | jq '.[].city_id')
  for CITY_ID in $CITY_IDS; do
    ZONE_IDS=$(echo "$RESULT" | jq --argjson id "$CITY_ID" '.[] | select(.city_id==$id) | .zones[]?.zone_id // empty')
    [[ -z "$ZONE_IDS" ]] && continue
    for ZONE_ID in $ZONE_IDS; do
      ZONE_NAME=$(echo "$RESULT" | jq -r --argjson cid "$CITY_ID" --argjson zid "$ZONE_ID" \
        '.[] | select(.city_id==$cid) | .zones[] | select(.zone_id==$zid) | .zone_name')
      echo "  [+] Zone: ${ZONE_NAME} (id=${ZONE_ID})"

      AREAS_JSON=$(api_get "${BASE_URL}/aladdin/api/v1/zones/${ZONE_ID}/area-list") || { echo "    ! failed, skipping"; continue; }
      sleep 1
      AREAS=$(echo "$AREAS_JSON" | jq '[.data.data[] | {area_id, area_name}]')

      RESULT=$(echo "$RESULT" | jq --argjson cid "$CITY_ID" --argjson zid "$ZONE_ID" --argjson areas "$AREAS" \
        'map(if .city_id==$cid then .zones |= map(if .zone_id==$zid then . + {areas: $areas} else . end) else . end)')
      save "$RESULT"
      echo "    [✓] areas: $(echo "$AREAS" | jq 'length')"
    done
  done
  exit 0
fi
