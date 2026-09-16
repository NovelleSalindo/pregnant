#!/usr/bin/env python3
"""
app.py — Launcher for PregnaCare (PHP + MySQL app).

This does NOT rewrite the app in Python. It simply starts PHP's built-in
development server pointed at this folder, then (optionally) opens your
browser automatically. All the actual code that runs is still the PHP
files (base.php, login.php, dashboard.php, etc.) sitting next to this file.

Requirements:
  - PHP must be installed and on your PATH (php -v should work in a terminal)
  - MySQL must be running (e.g. start it from the XAMPP Control Panel) and
    the `pregnacare` database must already be imported (see sql/schema.sql)

Usage:
  python app.py
  python app.py --port 8000
  python app.py --no-browser
"""

import argparse
import shutil
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

DEFAULT_PORT = 8080
DEFAULT_HOST = "localhost"


def find_php():
    php_path = shutil.which("php")
    if not php_path:
        print("ERROR: PHP was not found on your PATH.")
        print("Install PHP, or (on XAMPP) add C:\\xampp\\php to your PATH,")
        print("then try again. You can check with:  php -v")
        sys.exit(1)
    return php_path


def main():
    parser = argparse.ArgumentParser(description="Run PregnaCare using PHP's built-in server.")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"Port to serve on (default: {DEFAULT_PORT})")
    parser.add_argument("--host", type=str, default=DEFAULT_HOST, help=f"Host to bind to (default: {DEFAULT_HOST})")
    parser.add_argument("--no-browser", action="store_true", help="Don't auto-open the browser")
    args = parser.parse_args()

    php_path = find_php()

    # Serve from the same folder this script lives in (where base.php, login.php, etc. are).
    docroot = Path(__file__).resolve().parent
    if not (docroot / "base.php").exists():
        print(f"WARNING: base.php was not found in {docroot}.")
        print("Make sure app.py sits in the same folder as base.php, login.php, etc.")

    url = f"http://{args.host}:{args.port}/index.php"

    print("=" * 60)
    print("  PregnaCare — starting PHP development server")
    print("=" * 60)
    print(f"  PHP binary : {php_path}")
    print(f"  Serving    : {docroot}")
    print(f"  URL        : {url}")
    print("=" * 60)
    print("  Make sure MySQL is running and the 'pregnacare' database")
    print("  has been imported (sql/schema.sql) before continuing.")
    print("  Press CTRL+C to stop the server.")
    print("=" * 60)

    proc = subprocess.Popen([php_path, "-S", f"{args.host}:{args.port}", "-t", str(docroot)])

    if not args.no_browser:
        time.sleep(1)  # give the server a moment to start
        webbrowser.open(url)

    try:
        proc.wait()
    except KeyboardInterrupt:
        print("\nStopping server...")
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        print("Server stopped.")


if __name__ == "__main__":
    main()