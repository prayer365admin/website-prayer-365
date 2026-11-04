#!/usr/bin/env bash
#
# PRAYER 365 — interactive AWS deployment helper.
#
#   bash infra/scripts/deploy.sh              # full interactive flow
#   bash infra/scripts/deploy.sh --env catatia
#   bash infra/scripts/deploy.sh --check      # account + checklist, then exit
#
# Steps:
#   1. show the active AWS account (and let you pick, when several are available)
#   2. show what that account already has for this project (checklist)
#   3. show what to deploy: storage / data / workers / full deployment / diff only
#
# It never stores credentials and never prints secret values. Everything it runs
# is the same `cdk` command the runbook documents.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$INFRA_DIR/.." && pwd)"

export AWS_PAGER=""
CLI_ARGS="--no-cli-pager"
ENV_NAME=""
ENV_FILE=""
CHECK_ONLY="0"

while [ $# -gt 0 ]; do
  case "$1" in
    --env) ENV_NAME="${2:-}"; shift 2 ;;
    --env-file) ENV_FILE="${2:-}"; shift 2 ;;
    --check) CHECK_ONLY="1"; shift ;;
    -h|--help) sed -n '2,14p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

# ---------------------------------------------------------------- output ----
if [ -t 1 ]; then
  B=$'\033[1m'; G=$'\033[32m'; R=$'\033[31m'; Y=$'\033[33m'; D=$'\033[2m'; N=$'\033[0m'
else
  B=""; G=""; R=""; Y=""; D=""; N=""
fi

hdr()  { printf '\n%s== %s ==%s\n' "$B" "$1" "$N"; }
ok()   { printf '  %s✔%s %s\n' "$G" "$N" "$1"; }
bad()  { printf '  %s✘%s %s\n' "$R" "$N" "$1"; }
warn() { printf '  %s!%s %s\n' "$Y" "$N" "$1"; }
info() { printf '  %s·%s %s\n' "$D" "$N" "$1"; }
ask()  { printf '%s' "$1"; read -r "${2:-REPLY}"; }
die()  { printf '\n%sERROR:%s %s\n' "$R" "$N" "$1" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "'$1' is not installed"; }

# --------------------------------------------------------------- helpers ----
list_envs() { (cd "$REPO_ROOT" && bunx tsx "$INFRA_DIR/scripts/print-config.ts" --list 2>/dev/null); }

read_config() { (cd "$REPO_ROOT" && bunx tsx "$INFRA_DIR/scripts/print-config.ts" "$1" 2>/dev/null); }

# pull one field out of the single-line config JSON. Two helpers on purpose:
# BSD sed (macOS) supports backreferences in the REPLACEMENT only, never in the
# ERE pattern, so an optional-quote group like ("?)…\1 silently mis-parses.
cfg_str() { printf '%s' "$1" | sed -nE "s/.*\"$2\":\"([^\"]*)\".*/\1/p"; }
cfg_num() { printf '%s' "$1" | sed -nE "s/.*\"$2\":([^,}]*).*/\1/p"; }

# resolve [account, arn] for one credential source; prints "account<TAB>arn" or nothing
identity_of() {
  local source="$1"
  case "$source" in
    environment) aws sts get-caller-identity $CLI_ARGS --query '[Account,Arn]' --output text 2>/dev/null ;;
    dotenv)
      ( set -a; . "$REPO_ROOT/.env" >/dev/null 2>&1; set +a
        unset AWS_PROFILE
        aws sts get-caller-identity $CLI_ARGS --query '[Account,Arn]' --output text 2>/dev/null ) ;;
    profile:*) AWS_PROFILE="${source#profile:}" aws sts get-caller-identity $CLI_ARGS --query '[Account,Arn]' --output text 2>/dev/null ;;
  esac
}

# make the chosen source the active credentials for the rest of the script
activate_source() {
  local source="$1"
  case "$source" in
    environment) unset AWS_PROFILE ;;
    dotenv)      unset AWS_PROFILE; set -a; . "$REPO_ROOT/.env" >/dev/null 2>&1; set +a ;;
    profile:*)   export AWS_PROFILE="${source#profile:}" ;;
  esac
}

confirm() {
  local label="$1" answer
  ask "About to run: ${B}${label}${N}. Type 'yes' to continue: " answer || return 1
  [ "$answer" = "yes" ]
}

# ------------------------------------------------------- step 1: account ----
need aws
need bunx
[ -f "$REPO_ROOT/.env" ] || warn "no .env at $REPO_ROOT (only named AWS profiles or shell credentials will work)"

hdr "Step 1 — AWS account"

CANDIDATES=()
[ -n "${AWS_ACCESS_KEY_ID:-}" ] && CANDIDATES+=("environment")
if [ -f "$HOME/.aws/credentials" ] || [ -f "$HOME/.aws/config" ]; then
  while IFS= read -r profile_name; do
    [ -n "$profile_name" ] && CANDIDATES+=("profile:$profile_name")
  done < <(grep -hE '^\[' "$HOME/.aws/credentials" "$HOME/.aws/config" 2>/dev/null |
             tr -d '[]' | sed -E 's/^profile //' | sort -u)
fi
if [ -f "$REPO_ROOT/.env" ] && grep -qE '^AWS_ACCESS_KEY_ID=' "$REPO_ROOT/.env"; then
  CANDIDATES+=("dotenv")
fi

[ "${#CANDIDATES[@]}" -eq 0 ] && die "no AWS credentials found (shell env, ~/.aws profiles, or repo .env)"

LABELS=(); IDENTITIES=(); USABLE=()
for source in "${CANDIDATES[@]}"; do
  case "$source" in
    environment) LABELS+=("shell environment credentials") ;;
    dotenv)      LABELS+=("repo .env credentials (local AWS keys)") ;;
    profile:*)   LABELS+=("AWS profile '${source#profile:}'") ;;
  esac
  identity="$(identity_of "$source")"
  IDENTITIES+=("$identity")
  if [ -n "$identity" ]; then USABLE+=("$source"); fi
done

printf '  %-4s %-44s %-14s %s\n' "#" "source" "account" "identity"
for i in "${!CANDIDATES[@]}"; do
  account="$(printf '%s' "${IDENTITIES[$i]}" | cut -f1)"
  arn="$(printf '%s' "${IDENTITIES[$i]}" | cut -f2)"
  if [ -z "$account" ]; then
    printf '  %-4s %-44s %-14s %s\n' "$((i + 1))" "${LABELS[$i]}" "-" "${R}unusable${N}"
  else
    printf '  %-4s %-44s %-14s %s\n' "$((i + 1))" "${LABELS[$i]}" "$account" "$arn"
  fi
done

[ "${#USABLE[@]}" -eq 0 ] && die "none of the credential sources could be used (check the keys / profile)"

if [ "${#USABLE[@]}" -eq 1 ]; then
  SOURCE="${USABLE[0]}"
  for i in "${!CANDIDATES[@]}"; do [ "${CANDIDATES[$i]}" = "$SOURCE" ] && CHOSEN_INDEX="$((i + 1))"; done
  info "using ${LABELS[$((CHOSEN_INDEX - 1))]} (the only usable source)"
else
  while :; do
    ask "  Select the credential source [1-${#CANDIDATES[@]}]: " pick || die "no input (stdin closed) — run this in a terminal"
    idx=$((pick - 1))
    if [ "$pick" -ge 1 ] 2>/dev/null && [ "$pick" -le "${#CANDIDATES[@]}" ] 2>/dev/null; then
      SOURCE="${CANDIDATES[$idx]}"
      [ -n "${IDENTITIES[$idx]}" ] && break
      warn "that source cannot authenticate; pick another"
    else
      warn "enter a number between 1 and ${#CANDIDATES[@]}"
    fi
  done
fi

activate_source "$SOURCE"
ACCOUNT="$(aws sts get-caller-identity $CLI_ARGS --query Account --output text 2>/dev/null)"
ARN="$(aws sts get-caller-identity $CLI_ARGS --query Arn --output text 2>/dev/null)"
[ -z "$ACCOUNT" ] && die "could not resolve the caller identity"
ok "active account: ${B}${ACCOUNT}${N}  (${ARN})"

# --------------------------------------------------- step 2: environment ----
hdr "Step 2 — Environment (infra/config/environments)"

ENVS=()
while IFS= read -r line; do [ -n "$line" ] && ENVS+=("$line"); done < <(list_envs)
[ "${#ENVS[@]}" -eq 0 ] && die "no environment configs found in infra/config/environments"

# A file on disk that nobody registered is a dead end for `-c env=<name>`: say so
# instead of letting the user wonder why their new client is missing.
for file in "$INFRA_DIR"/config/environments/*.ts; do
  [ -e "$file" ] || continue
  candidate="$(basename "$file" .ts)"
  registered=""
  for known in "${ENVS[@]}"; do [ "$known" = "$candidate" ] && registered="yes"; done
  [ -z "$registered" ] && warn "infra/config/environments/${candidate}.ts exists but is NOT registered — add \`${candidate},\` to infra/config/index.ts"
done

if [ -z "$ENV_NAME" ]; then
  if [ "${#ENVS[@]}" -eq 1 ] || [ "$CHECK_ONLY" = "1" ]; then
    ENV_NAME="${ENVS[0]}"
    info "using environment: $ENV_NAME${CHECK_ONLY:+ (--check uses the first configured environment)}"
  else
    printf '  %-4s %s\n' "#" "environment"
    for i in "${!ENVS[@]}"; do printf '  %-4s %s\n' "$((i + 1))" "${ENVS[$i]}"; done
    while :; do
      ask "  Select the environment [1-${#ENVS[@]}]: " pick || die "no input (stdin closed) — run this in a terminal"
      if [ "$pick" -ge 1 ] 2>/dev/null && [ "$pick" -le "${#ENVS[@]}" ] 2>/dev/null; then
        ENV_NAME="${ENVS[$((pick - 1))]}"; break
      fi
      warn "enter a number between 1 and ${#ENVS[@]}"
    done
  fi
fi

CFG="$(read_config "$ENV_NAME")"
[ -z "$CFG" ] && die "could not read the config for '$ENV_NAME'"

# Which local file feeds the secrets for this environment. Same split as the app:
# .env is the developer/catatia file, .env.prod is the client production file.
if [ -z "$ENV_FILE" ]; then
  case "$ENV_NAME" in
    prayer-365) ENV_FILE=".env.prod" ;;
    *)          ENV_FILE=".env" ;;
  esac
fi
[ -f "$REPO_ROOT/$ENV_FILE" ] || warn "no $ENV_FILE at $REPO_ROOT — the secret seeding step will not work"
REGION="$(cfg_str "$CFG" region)"
EXPECTED_ACCOUNT="$(cfg_str "$CFG" account)"
REMOVAL="$(cfg_str "$CFG" removalPolicy)"
export AWS_REGION="$REGION" AWS_DEFAULT_REGION="$REGION" PRAYER365_ENV="$ENV_NAME"

STORAGE_MODE="$(printf '%s' "$CFG" | sed -E 's/.*"storage":\{"mode":"([a-z]+)".*/\1/')"
DB_MODE="$(printf '%s' "$CFG" | sed -E 's/.*"database":\{"mode":"([a-z]+)".*/\1/')"
NET_MODE="$(printf '%s' "$CFG" | sed -E 's/.*"network":\{"mode":"([a-z]+)".*/\1/')"
WORKERS_ENABLED="$(printf '%s' "$CFG" | sed -E 's/.*"workers":\{"enabled":(true|false).*/\1/')"
SES_DOMAIN="$(cfg_str "$CFG" domain)"
MAIL_PROVIDER_EXPECTED="$(cfg_str "$CFG" provider)"

printf '  %-14s %s\n' "environment" "$ENV_NAME"
printf '  %-14s %s\n' "region" "$REGION"
printf '  %-14s %s\n' "storage" "$STORAGE_MODE"
printf '  %-14s %s\n' "database" "$DB_MODE"
printf '  %-14s %s\n' "network" "$NET_MODE"
printf '  %-14s %s\n' "email (SES)" "$SES_DOMAIN"
printf '  %-14s %s\n' "mail provider" "$MAIL_PROVIDER_EXPECTED"
printf '  %-14s %s\n' "secrets file" "$ENV_FILE"
printf '  %-14s %s\n' "workers" "enabled=$WORKERS_ENABLED"
printf '  %-14s %s\n' "on destroy" "removalPolicy=$REMOVAL"

if [ "$ACCOUNT" != "$EXPECTED_ACCOUNT" ]; then
  printf '\n'
  warn "the active account (${ACCOUNT}) is NOT the account ${ENV_NAME} targets (${EXPECTED_ACCOUNT})."
  if [ "$CHECK_ONLY" = "1" ]; then
    warn "--check: continuing so you can still see what exists here"
  else
    confirm "deploying '${ENV_NAME}' into account ${ACCOUNT}" || die "aborted: wrong account selected"
  fi
fi

# ------------------------------------------- step 3: requirements check ----
stack_status() {
  aws cloudformation describe-stacks --stack-name "$1" $CLI_ARGS \
    --query 'Stacks[0].StackStatus' --output text 2>/dev/null | grep -v '^None$'
}
param_exists() {
  aws ssm get-parameter --name "$1" $CLI_ARGS --query 'Parameter.Name' --output text >/dev/null 2>&1
}
secret_state() { # prints "<versions>" or nothing when the container is missing
  aws secretsmanager describe-secret --secret-id "$1" $CLI_ARGS \
    --query 'length(VersionIdsToStages)' --output text 2>/dev/null | grep -v '^None$'
}

# Classify a secret's value WITHOUT printing it. A CDK-created container starts
# with a generated placeholder, so "exists" alone is not readiness.
secret_kind() {
  local value
  value="$(aws secretsmanager get-secret-value --secret-id "$1" $CLI_ARGS \
    --query SecretString --output text 2>/dev/null | tr -d '\n' | cut -c1-24)"
  if [ -z "$value" ]; then echo "empty"; return; fi
  case "$value" in
    postgres://*|postgresql://*) echo "connection string" ;;
    sk_*) echo "provider key" ;;
    \{*) echo "json" ;;
    *) echo "placeholder-looking" ;;
  esac
}

checklist() {
  DONE=0; TOTAL=0
  mark() { TOTAL=$((TOTAL + 1)); if [ "$1" = "1" ]; then DONE=$((DONE + 1)); ok "$2"; else bad "$2"; fi; }
  # mark takes the boolean outcome (1 = satisfied); commands hand us an exit code
  # instead, so this maps 0 -> satisfied.
  mark_exit() { local status="$1"; shift; if [ "$status" = "0" ]; then mark 1 "$1"; else mark 0 "$1"; fi; }

  hdr "Step 3 — What this account already has (project: prayer-365, env: ${ENV_NAME})"

  status="$(stack_status CDKToolkit)"
  [ "$status" = "CREATE_COMPLETE" ] || [ "$status" = "UPDATE_COMPLETE" ]
  mark_exit "$?" "CDK bootstrap (CDKToolkit: ${status:-missing})"

  for component in storage data workers; do
    status="$(stack_status "prayer365-${ENV_NAME}-${component}")"
    if [ -n "$status" ]; then mark 1 "stack prayer365-${ENV_NAME}-${component} (${status})"
    else mark 0 "stack prayer365-${ENV_NAME}-${component} (not deployed)"; fi
  done

  if [ "$STORAGE_MODE" = "existing" ]; then
    info "storage: reuses an existing bucket, so no bucket check (mode=existing)"
  else
    # list-buckets, not head-bucket: head-bucket has no output shape, so any
    # invalid default output in ~/.aws/config (e.g. `output = JSON`) makes it fail
    # with "Unknown output type" and the bucket looks missing.
    bucket="$(aws s3api list-buckets $CLI_ARGS \
      --query "Buckets[?Name=='prayer365-${ENV_NAME}-media'].Name" --output text 2>/dev/null)"
    [ -n "$bucket" ] && [ "$bucket" != "None" ]; mark_exit "$?" "media bucket prayer365-${ENV_NAME}-media"
  fi
  param_exists "/prayer365/${ENV_NAME}/bucket-name"
  mark_exit "$?" "SSM parameter /prayer365/${ENV_NAME}/bucket-name"

  for queue in "prayer365-${ENV_NAME}-jobs" "prayer365-${ENV_NAME}-jobs-dlq"; do
    aws sqs get-queue-url --queue-name "$queue" $CLI_ARGS --query QueueUrl --output text >/dev/null 2>&1
    mark_exit "$?" "SQS queue ${queue}"
  done

  if [ "$DB_MODE" = "create" ]; then
    dbs="$(aws rds describe-db-instances $CLI_ARGS --query 'length(DBInstances)' --output text 2>/dev/null)"
    [ "${dbs:-0}" -gt 0 ]; mark_exit "$?" "RDS instance (database.mode=create)"
  else
    info "database: external — the DB lives outside this account (no RDS expected)"
  fi

  if [ "$NET_MODE" = "vpc" ]; then
    param_exists "/prayer365/${ENV_NAME}/nat-egress-ip"
    mark_exit "$?" "fixed NAT egress IP parameter (network.mode=vpc)"
  fi

  # SES domain identity: without it the app's transactional mail cannot be sent.
  ses_verified="$(aws sesv2 get-email-identity --email-identity "$SES_DOMAIN" $CLI_ARGS \
    --query 'VerifiedForSendingStatus' --output text 2>/dev/null)"
  [ "$ses_verified" = "True" ]; mark_exit "$?" "SES domain identity ${SES_DOMAIN} verified"

  # Provider the live consumer will actually use: a mismatch means the deployed
  # function is older than the config (or was hand-edited in the console). The env
  # var is authoritative — a MAIL_PROVIDER key in the secret is ignored.
  consumer_provider="$(aws lambda get-function-configuration \
    --function-name "prayer365-${ENV_NAME}-consumer" $CLI_ARGS \
    --query 'Environment.Variables.MAIL_PROVIDER' --output text 2>/dev/null)"
  [ "$consumer_provider" = "$MAIL_PROVIDER_EXPECTED" ]
  mark_exit "$?" "consumer MAIL_PROVIDER=${consumer_provider:-missing} (config: ${MAIL_PROVIDER_EXPECTED})"

  # Local .env vs Secrets Manager — read only. A non-zero count means the seed step
  # (menu 3) is needed before the workers deploy, otherwise the Lambdas keep the
  # value they were deployed with.
  local secrets_mismatch
  secrets_mismatch="$( cd "$REPO_ROOT" && bunx tsx "$INFRA_DIR/scripts/seed-secrets.ts" \
    --env "$ENV_NAME" --file "$REPO_ROOT/$ENV_FILE" --check-only 2>/dev/null \
    | sed -nE 's/.*secrets not matching .*: ([0-9]+)\/([0-9]+).*/\1/p' )"
  if [ "${secrets_mismatch:-x}" = "0" ]; then
    mark 1 "secrets match ${ENV_FILE}"
  else
    mark 0 "secrets differ from ${ENV_FILE} (${secrets_mismatch:-unknown} to write)"
  fi

  SECRET_TOTAL=0; SECRET_WITH_VALUE=0
  for suffix in database-url elevenlabs-api-key stripe-secret-key stripe-webhook-secret mail-credentials device-token-key firebase-service-account; do
    SECRET_TOTAL=$((SECRET_TOTAL + 1))
    versions="$(secret_state "/prayer365/${ENV_NAME}/${suffix}")"
    kind="$(secret_kind "/prayer365/${ENV_NAME}/${suffix}")"
    if [ -z "$versions" ]; then
      bad "secret /prayer365/${ENV_NAME}/${suffix} missing"
    elif [ "$kind" = "empty" ]; then
      warn "secret /prayer365/${ENV_NAME}/${suffix} exists but has no value (seed it)"
    else
      SECRET_WITH_VALUE=$((SECRET_WITH_VALUE + 1))
      if [ "$kind" = "placeholder-looking" ]; then
        warn "secret /prayer365/${ENV_NAME}/${suffix} still looks like the generated placeholder (seed it)"
      else
        info "secret /prayer365/${ENV_NAME}/${suffix} present (${kind})"
      fi
    fi
  done
  [ "$SECRET_WITH_VALUE" -gt 0 ]; mark_exit "$?" "secrets seeded (${SECRET_WITH_VALUE}/${SECRET_TOTAL})"

  [ "$(secret_kind "/prayer365/${ENV_NAME}/database-url")" = "connection string" ]
  mark_exit "$?" "database-url is a real connection string (workers cannot start without it)"
  [ "$(secret_kind "/prayer365/${ENV_NAME}/elevenlabs-api-key")" = "provider key" ]
  mark_exit "$?" "elevenlabs-api-key is a real provider key (audio jobs fail without it)"

  for name in dispatcher consumer; do
    aws lambda get-function-configuration --function-name "prayer365-${ENV_NAME}-${name}" $CLI_ARGS \
      --query FunctionName --output text >/dev/null 2>&1
    mark_exit "$?" "Lambda prayer365-${ENV_NAME}-${name}"
  done

  rules="$(aws events list-rules --name-prefix "prayer365-${ENV_NAME}" $CLI_ARGS --query 'length(Rules)' --output text 2>/dev/null)"
  [ "${rules:-0}" -gt 0 ]; mark_exit "$?" "EventBridge dispatch schedule (${rules:-0} rule(s))"

  alarms="$(aws cloudwatch describe-alarms --alarm-name-prefix "prayer365-${ENV_NAME}" $CLI_ARGS --query 'length(MetricAlarms)' --output text 2>/dev/null)"
  [ "${alarms:-0}" -ge 3 ]; mark_exit "$?" "CloudWatch alarms (${alarms:-0}/3)"

  printf '\n  %schecklist: %s/%s satisfied%s\n' "$B" "$DONE" "$TOTAL" "$N"
}

checklist

if [ "$CHECK_ONLY" = "1" ]; then
  printf '\n'
  info "--check given: stopping here, nothing was deployed"
  exit 0
fi

# ------------------------------------------------------- step 4: action ----
cd "$INFRA_DIR" || die "cannot enter $INFRA_DIR"

STACK_STORAGE="prayer365-${ENV_NAME}-storage"
STACK_DATA="prayer365-${ENV_NAME}-data"
STACK_WORKERS="prayer365-${ENV_NAME}-workers"

run_cdk() { # $1 = "diff" | "deploy", rest = stack ids
  local verb="$1"; shift
  local args=()
  for stack_id in "$@"; do args+=("$stack_id"); done
  printf '\n%s$ bunx cdk %s %s -c env=%s%s\n' "$D" "$verb" "${args[*]}" "$ENV_NAME" "$N"
  bunx cdk "$verb" "${args[@]}" -c "env=$ENV_NAME"
  return $?
}

warn_secrets() {
  local suffix kind
  for suffix in database-url elevenlabs-api-key; do
    kind="$(secret_kind "/prayer365/${ENV_NAME}/${suffix}")"
    if [ "$kind" = "empty" ]; then
      warn "secret /prayer365/${ENV_NAME}/${suffix} has no value — the worker Lambdas will fail until you seed it"
    elif [ "$kind" = "placeholder-looking" ]; then
      warn "secret /prayer365/${ENV_NAME}/${suffix} still holds the generated placeholder — seed the real value before the workers run"
    fi
  done
}

# Seed every secret from the local env file, showing the diff and asking first.
# Runs inside the repo root so the script's relative rules import resolves.
seed_secrets() {
  local script_args=(--env "$ENV_NAME" --file "$REPO_ROOT/$ENV_FILE")
  [ -n "${SEED_PROFILE:-}" ] && script_args+=(--profile "$SEED_PROFILE")
  ( cd "$REPO_ROOT" && bunx tsx "$INFRA_DIR/scripts/seed-secrets.ts" "${script_args[@]}" )
}

while :; do
  DATA_LABEL="data component (job queue + secret containers)"
  [ "$DB_MODE" = "create" ] && DATA_LABEL="data component (job queue + secrets + VPC + NAT + RDS)"
  hdr "Step 4 — What do you want to deploy?"
  cat <<MENU
  ${B}1${N}) storage component
  ${B}2${N}) ${DATA_LABEL}
  ${B}3${N}) seed / verify the secrets from ${ENV_FILE}
  ${B}4${N}) workers component (dispatcher + consumer Lambdas)
  ${B}5${N}) full deployment (storage -> data -> secrets -> workers)
  ${B}6${N}) show diff only (no changes)
  ${B}7${N}) exit
MENU

  ask "  Select [1-7]: " action || exit 0

  case "$action" in
    1)
      [ "$STORAGE_MODE" = "existing" ] && info "storage.mode=existing: this deploy writes SSM parameters only, it creates no bucket"
      confirm "cdk deploy ${STACK_STORAGE}" && run_cdk deploy "$STACK_STORAGE"
      ;;
    2)
      if [ "$DB_MODE" = "create" ] && [ "$NET_MODE" != "vpc" ]; then
        bad "database.mode=create needs network.mode=vpc — fix the config first"
        continue
      fi
      [ "$DB_MODE" = "create" ] && info "this also creates the VPC, NAT instance and RDS instance (slow, ~10 min)"
      confirm "cdk deploy ${STACK_DATA}" && run_cdk deploy "$STACK_DATA"
      warn_secrets
      ;;
    3)
      seed_secrets
      ;;
    4)
      warn_secrets
      ask "  Seed / verify the secrets from ${ENV_FILE} first? [Y/n] " seed_choice || exit 0
      if [ "${seed_choice:-y}" != "n" ]; then
        seed_secrets || { bad "seeding failed — deploy cancelled (the Lambdas would keep the old values)"; continue; }
      fi
      [ "$WORKERS_ENABLED" != "true" ] && info "workers.enabled=false: the Lambdas deploy throttled off until you flip it"
      confirm "cdk deploy ${STACK_WORKERS}" && run_cdk deploy "$STACK_WORKERS"
      ;;
    5)
      warn_secrets
      info "order matters: data (secret containers) -> secrets -> workers (the Lambda env is resolved at deploy time)"
      if confirm "full deployment (${STACK_STORAGE} -> ${STACK_DATA} -> secrets -> ${STACK_WORKERS})"; then
        run_cdk deploy "$STACK_STORAGE" || continue
        run_cdk deploy "$STACK_DATA" || continue
        seed_secrets || { bad "seeding failed — workers not deployed"; continue; }
        run_cdk deploy "$STACK_WORKERS"
      fi
      ;;
    6)
      run_cdk diff "$STACK_STORAGE" "$STACK_DATA" "$STACK_WORKERS"
      ;;
    7|"")
      printf '\n  done — nothing else was changed.\n'
      exit 0
      ;;
    *) warn "enter a number between 1 and 7" ;;
  esac

  printf '\n'
  ask "Press Enter to return to the menu (or type q to quit): " again || exit 0
  [ "$again" = "q" ] && exit 0
done
