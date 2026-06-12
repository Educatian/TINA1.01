"""Apply a TINA migration .sql file to the live Supabase project via the
Management API (same engine the dashboard SQL Editor uses).

USER-RUN ONLY (Supabase provisioning gate): run from the repo root with
    py scripts/apply_sql.py tina-discourse.sql

Token: Supabase personal access token (sbp_...), read from
    Desktop\\_Personal\\_Credentials\\codex_supabase_accesstoken.txt
"""
import json
import pathlib
import sys
import urllib.error
import urllib.request

PROJECT_REF = "qjopomljrjjhukhjiwwm"  # TINA
TOKEN_PATH = pathlib.Path.home() / "Desktop/_Personal/_Credentials/codex_supabase_accesstoken.txt"

def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    sql_path = pathlib.Path(sys.argv[1])
    if not sql_path.exists():
        print(f"SQL file not found: {sql_path}")
        return 2
    token = TOKEN_PATH.read_text(encoding="utf-8").strip()
    sql = sql_path.read_text(encoding="utf-8")

    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query",
        data=json.dumps({"query": sql}).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            # api.supabase.com sits behind Cloudflare, which 403s (error 1010)
            # urllib's default Python-urllib/3.x signature; present a normal UA.
            "User-Agent": "tina-apply-sql/1.0 (+curl-compatible)",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as r:
            print(f"HTTP {r.status} — applied {sql_path.name}")
            body = r.read().decode()
            if body and body != "[]":
                print(body[:1000])
            return 0
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code} — FAILED")
        print(e.read().decode()[:1500])
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
