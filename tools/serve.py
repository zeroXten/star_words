#!/usr/bin/env python3
"""Local preview server that tells the browser never to cache, so edits always show up.

    python3 tools/serve.py [port]
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    ThreadingHTTPServer(("127.0.0.1", port), partial(NoCacheHandler, directory=str(ROOT))).serve_forever()
