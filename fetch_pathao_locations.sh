#!/usr/bin/env bash
# Pathao API — pull cities → zones → areas into locations.json
#
# Usage:
#   ./fetch_pathao_locations.sh -a city   # fetch city list, overwrite locations.json
#   ./fetch_pathao_locations.sh -a zone   # for each city in locations.json, fetch zones, save
#   ./fetch_pathao_locations.sh -a area   # for each zone in locations.json, fetch areas, save
set -euo pipefail

BASE_URL="https://api-hermes.pathao.com"
ACCESS_TOKEN="${ACCESS_TOKEN:-eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyMTAyOTkiLCJhdWQiOlsiNTg0MiJdLCJleHAiOjE3OTkwOTk0MzEsIm5iZiI6MTc5MTMyMzQzMSwiaWF0IjoxNzkxMzIzNDMxLCJqdGkiOiJhZDExYWZhOTEwZTAwZGU2MjRhZDIzYTNkZWVhYzY1YzA0ZTdhY2FhYjJmMWQzNTEzNzc5MDM2ZWUwODgzOWJiIiwibWVyY2hhbnRfaWQiOiJZUmRHWllFNWJEIiwic2NvcGVzIjpbXX0.KO3_SvWHhb7RWVj2TKOTMlHwnjL9KI5xEj8E-BUQ3-2EvKGl-9jELpoaMYrBkI5LpBMcHdY05Ywgtthr6fq5fBP3wa549JNDimxAc80bX_cNIoJrLxdzOzVn6vCOpSAKyPAX7WGhWzRxg3GuFZ0CZezH7SN7xa5Hv4hBGPVU4L363VVvuLtiKiSrUjkm9b3RpDlq0uwvSDMd5_I1MAkOot9uJOBqqewaLBrs8j8_-fR6Muq_oZ7nx9nQBMQCGnwYpj_ffIQlzFWYZfSiER20R1oGFFM7DRYdWAEisgUVAnJWwsy_4CNuhf6Tu8Wpi0isRWLSkvNd37BSkr5MyVgkd3gIqLmBg4uQnCc6mnNjNjlLbZwcZm1yqqnSx5FC-Q2ZBAUke2Ln6-sSYujp2cFhZbhSU3xNBtnF5hoGtKKcwBmn6IJxceJrYSZh3gLMzi4fPFOVaQ0ZG3geYKqPfn4982YMYwUIU9VpVx2p2lOWLEh8uzC2tG109boSa87zA650xQ9ro36GdVX5f4Ff3APQLplDcarrwDDgDjx2-OJgpOrK1lecy2IbXG9UlTQfbSRp6UqzmiM2Bghch7pLQbCpNCRCrEgkhEaAW4eNCJbFAf7RTN73PRGGNRspt1-KoaopK8HnHjIQfnDtRVkMIJs0vqGQxL1KHU48PuFSAD5HdXo}"
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

PARALLEL=3

# ── zone ──────────────────────────────────────────────────────────────────────
if [[ "$ACTION" == "zone" ]]; then
  TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
  export -f api_get; export BASE_URL ACCESS_TOKEN TMP
  echo "$RESULT" | jq -r '.[].city_id' | \
    xargs -P "$PARALLEL" -I{} bash -c '
      out=$(api_get "${BASE_URL}/aladdin/api/v1/cities/{}/zone-list") \
        && echo "$out" | jq "[.data.data[] | {zone_id, zone_name}]" > "$TMP/{}.json"
      sleep 0.5' || true
  while read -r CITY_ID; do
    [[ -f "$TMP/$CITY_ID.json" ]] || continue
    ZONES=$(cat "$TMP/$CITY_ID.json")
    RESULT=$(echo "$RESULT" | jq --argjson id "$CITY_ID" --argjson zones "$ZONES" \
      'map(if .city_id==$id then . + {zones: $zones} else . end)')
    save "$RESULT"
    echo "  [✓] city $CITY_ID zones: $(echo "$ZONES" | jq 'length')"
  done < <(echo "$RESULT" | jq -r '.[].city_id')
  exit 0
fi

# ── area ──────────────────────────────────────────────────────────────────────
if [[ "$ACTION" == "area" ]]; then
  TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
  export -f api_get; export BASE_URL ACCESS_TOKEN TMP
  echo "$RESULT" | jq -r '.[] | .city_id as $c | .zones[]? | "\($c) \(.zone_id)"' | \
    xargs -P "$PARALLEL" -n2 bash -c '
      cid=$0; zid=$1
      out=$(api_get "${BASE_URL}/aladdin/api/v1/zones/${zid}/area-list") \
        && echo "$out" | jq "[.data.data[] | {area_id, area_name}]" > "$TMP/${cid}_${zid}.json"
      sleep 0.5' || true
  while read -r CITY_ID ZONE_ID; do
    [[ -f "$TMP/${CITY_ID}_${ZONE_ID}.json" ]] || continue
    AREAS=$(cat "$TMP/${CITY_ID}_${ZONE_ID}.json")
    RESULT=$(echo "$RESULT" | jq --argjson cid "$CITY_ID" --argjson zid "$ZONE_ID" --argjson areas "$AREAS" \
      'map(if .city_id==$cid then .zones |= map(if .zone_id==$zid then . + {areas: $areas} else . end) else . end)')
    save "$RESULT"
    echo "  [✓] zone $ZONE_ID areas: $(echo "$AREAS" | jq 'length')"
  done < <(echo "$RESULT" | jq -r '.[] | .city_id as $c | .zones[]? | "\($c) \(.zone_id)"')
  exit 0
fi
