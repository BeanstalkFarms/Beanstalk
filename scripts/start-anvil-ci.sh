#!/usr/bin/env bash

set -u

if [[ $# -eq 0 ]]; then
  echo "Usage: $0 <anvil command> [arguments...]" >&2
  exit 2
fi

healthcheck_url="${ANVIL_HEALTHCHECK_URL:-http://127.0.0.1:8545}"
startup_attempts="${ANVIL_STARTUP_ATTEMPTS:-30}"
startup_interval="${ANVIL_STARTUP_INTERVAL:-1}"
log_directory="${RUNNER_TEMP:-/tmp}"
log_file="$(mktemp "${log_directory}/beanstalk-anvil.XXXXXX.log")"

"$@" >"${log_file}" 2>&1 &
anvil_pid=$!

for ((attempt = 1; attempt <= startup_attempts; attempt++)); do
  if curl --silent --show-error --fail \
    --header "content-type: application/json" \
    --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' \
    "${healthcheck_url}" >/dev/null; then
    echo "Anvil is ready at ${healthcheck_url}."
    exit 0
  fi

  process_state="$(ps -o stat= -p "${anvil_pid}" 2>/dev/null || true)"
  process_state="${process_state#"${process_state%%[![:space:]]*}"}"
  if [[ -z "${process_state}" || "${process_state}" == Z* ]]; then
    wait "${anvil_pid}"
    launch_status=$?
    cat "${log_file}" >&2
    if [[ ${launch_status} -eq 0 ]]; then
      launch_status=1
    fi
    exit "${launch_status}"
  fi

  sleep "${startup_interval}"
done

echo "Anvil did not become ready at ${healthcheck_url} after ${startup_attempts} attempts." >&2
cat "${log_file}" >&2
kill "${anvil_pid}" 2>/dev/null || true
exit 1
