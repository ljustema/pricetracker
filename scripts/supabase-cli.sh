#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-kfrbehvggqebpoqjftfg}"
ENV_FILE="${SUPABASE_ENV_FILE:-$HOME/.config/pricetracker/supabase.env}"

configure_token() {
  mkdir -p "$(dirname "$ENV_FILE")"
  chmod 700 "$(dirname "$ENV_FILE")"

  printf "Supabase access token: "
  stty -echo
  read -r token
  stty echo
  printf "\n"

  if [ -z "$token" ]; then
    printf "No token provided.\n" >&2
    exit 1
  fi

  {
    printf "SUPABASE_PROJECT_REF=%s\n" "$PROJECT_REF"
    printf "SUPABASE_ACCESS_TOKEN=%s\n" "$token"
  } > "$ENV_FILE"

  chmod 600 "$ENV_FILE"
  printf "Saved Supabase credentials to %s\n" "$ENV_FILE"

  npx supabase login --token "$token" --name pricetracker-cli >/dev/null
  printf "Supabase CLI is logged in as profile pricetracker-cli\n"
}

if [ "${1:-}" = "configure-token" ]; then
  configure_token
  exit 0
fi

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

if [ "${1:-}" = "link" ]; then
  shift
  exec npx supabase link --project-ref "${SUPABASE_PROJECT_REF:-$PROJECT_REF}" "$@"
fi

exec npx supabase "$@"
