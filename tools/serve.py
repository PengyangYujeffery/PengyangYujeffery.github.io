#!/usr/bin/env python3
"""Preview public/ locally with the same routing as production.

Applies public/_redirects the way Cloudflare does for this site: 200 rules
rewrite (e.g. /research -> research.html), 301/302 rules redirect, and a
trailing * matches any rest of the path. Like the production setting
html_handling: "none", it never guesses .html extensions or lists folders.

    py tools/serve.py [--port 8000]
"""

import argparse
import functools
import http.server
import urllib.parse
from pathlib import Path

PUBLIC = Path(__file__).resolve().parent.parent / "public"
NOT_PUBLISHED = {"/_redirects", "/_headers"}


def load_rules():
    rules = []
    for line in (PUBLIC / "_redirects").read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if len(parts) < 2 or parts[0].startswith("#"):
            continue
        rules.append((parts[0], parts[1], int(parts[2]) if len(parts) > 2 else 302))
    return rules


def resolve(path):
    for source, target, status in load_rules():
        if source.endswith("*"):
            if path.startswith(source[:-1]):
                return target.replace(":splat", path[len(source) - 1:]), status
        elif path == source:
            return target, status
    return None


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = dict(http.server.SimpleHTTPRequestHandler.extensions_map,
                          **{".jfif": "image/jpeg", ".svg": "image/svg+xml", ".json": "application/json"})

    def route(self):
        url = urllib.parse.urlsplit(self.path)
        path = urllib.parse.unquote(url.path)
        if path in NOT_PUBLISHED:
            self.send_error(404)
            return False
        rule = resolve(path)
        if rule:
            target, status = rule
            if status == 200:
                self.path = target + ("?" + url.query if url.query else "")
            else:
                self.send_response(status)
                self.send_header("Location", target)
                self.send_header("Content-Length", "0")
                self.end_headers()
                return False
        return True

    def do_GET(self):
        if self.route():
            super().do_GET()

    def do_HEAD(self):
        if self.route():
            super().do_HEAD()

    def list_directory(self, path):
        self.send_error(404)
        return None

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description="Preview public/ with production-like routing.")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    handler = functools.partial(Handler, directory=str(PUBLIC))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    print("Serving public/ at http://127.0.0.1:{}/ (Ctrl+C to stop)".format(args.port), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
