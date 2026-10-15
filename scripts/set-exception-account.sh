#!/usr/bin/env bash
# Sync the STAGING exception_accounts table to match a JSON file.
# Every existing row is deleted, then each entry in the file is inserted.
#
# The real list (scripts/exception-accounts.json) is gitignored; start from
# scripts/exception-accounts.example.json.
#
# Usage:
#   ./scripts/set-exception-account.sh [path/to/file.json]
#   (default file: exception-accounts.json next to this script)
#
# JSON format: an array of entries.
#   [
#     { "email": "a@x.com", "childAllowed": 9 },
#     { "email": "b@y.com", "childAllowed": 4, "billingDescription": "Custom text" },
#     { "email": "c@z.com", "childAllowed": 2, "exceptionGiven": false }
#   ]
# billingDescription is optional (defaults to the standard message) and
# exceptionGiven is optional (defaults to true).
set -euo pipefail

SSH_HOST="busyserver"
DB_CONTAINER="busy-brains-backend-staging-db-1"
DB_USER="busybrains"
DB_NAME="busybrains_staging"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
json_file="${1:-$script_dir/exception-accounts.json}"
if [ ! -f "$json_file" ]; then
  echo "File not found: $json_file" >&2
  echo "Copy scripts/exception-accounts.example.json to scripts/exception-accounts.json and edit it." >&2
  exit 1
fi

# Validate the JSON and turn it into SQL plus a human readable summary.
sql_file="$(mktemp)"
trap 'rm -f "$sql_file"' EXIT

python3 -I - "$json_file" "$sql_file" <<'PY'
import json, re, sys

src, out = sys.argv[1], sys.argv[2]
try:
    with open(src) as f:
        entries = json.load(f)
except Exception as e:
    sys.exit(f"Invalid JSON: {e}")
if not isinstance(entries, list):
    sys.exit("JSON must be an array of entries")

email_re = re.compile(r"^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$")
seen, rows = set(), []

def q(s):
    return "'" + s.replace("'", "''") + "'"

for i, e in enumerate(entries, 1):
    if not isinstance(e, dict):
        sys.exit(f"Entry {i}: must be an object")
    unknown = set(e) - {"email", "childAllowed", "billingDescription", "exceptionGiven"}
    if unknown:
        sys.exit(f"Entry {i}: unknown field(s): {', '.join(sorted(unknown))}")
    email = str(e.get("email", "")).strip().lower()
    if not email_re.match(email):
        sys.exit(f"Entry {i}: invalid email {email!r}")
    if email in seen:
        sys.exit(f"Entry {i}: duplicate email {email}")
    seen.add(email)
    n = e.get("childAllowed")
    if isinstance(n, bool) or not isinstance(n, int) or n < 1:
        sys.exit(f"Entry {i} ({email}): childAllowed must be a positive whole number")
    given = e.get("exceptionGiven", True)
    if not isinstance(given, bool):
        sys.exit(f"Entry {i} ({email}): exceptionGiven must be true or false")
    desc = e.get("billingDescription")
    if desc is None or str(desc).strip() == "":
        noun = "child" if n == 1 else "children"
        desc = f"You have paid outside the system. You are allowed up to {n} {noun}."
    if not isinstance(desc, str):
        sys.exit(f"Entry {i} ({email}): billingDescription must be a string")
    rows.append((email, n, given, desc))

lines = ["BEGIN;", "DELETE FROM exception_accounts;"]
for email, n, given, desc in rows:
    lines.append(
        'INSERT INTO exception_accounts (email, "childAllowed", "exceptionGiven", "billingDescription") '
        f"VALUES ({q(email)}, {n}, {'true' if given else 'false'}, {q(desc)});"
    )
lines += [
    "COMMIT;",
    'SELECT email, "childAllowed", "exceptionGiven", "billingDescription" FROM exception_accounts ORDER BY email;',
]
with open(out, "w") as f:
    f.write("\n".join(lines) + "\n")

print(f"{len(rows)} entr{'y' if len(rows) == 1 else 'ies'} in file:")
for email, n, given, desc in rows:
    print(f"  {email}  children={n}  active={given}")
    print(f"    \"{desc}\"")
PY

echo
echo "Target : staging ($SSH_HOST / $DB_NAME)"
echo "Action : DELETE all existing exception accounts, then insert the entries above"
read -r -p "Continue? [y/N] " answer
case "$answer" in
  y | Y | yes | YES) ;;
  *)
    echo "Aborted."
    exit 1
    ;;
esac

ssh "$SSH_HOST" "docker exec -i $DB_CONTAINER psql -v ON_ERROR_STOP=1 -U $DB_USER -d $DB_NAME" <"$sql_file"
