#!/usr/bin/env python3
# ============================================================================
# proxy.py  -  Puente CORS local para la API del Mundial 2026 (version rapida)
# ----------------------------------------------------------------------------
# Ademas de agregar las cabeceras CORS que la API no envia, esta version:
#   * es MULTI-HILO  -> atiende varias peticiones a la vez (no en fila),
#     asi las 3 llamadas del Dashboard (equipos/partidos/grupos) van juntas.
#   * cachea en memoria las respuestas GET por unos segundos -> cambiar de
#     pestana o recargar es instantaneo y no vuelve a golpear la API lenta.
#
# Reenvia el codigo de estado real (400/401/429/500...) para que la logica
# de resiliencia de la app siga funcionando igual.
#
# USO:  python proxy.py     (dejalo corriendo en su propia terminal)
# ============================================================================

import time
import threading
import urllib.request
import urllib.error
import ssl
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

UPSTREAM = 'https://worldcup26.ir'   # la API real
PORT = 3001                          # puerto local del proxy
CACHE_TTL = 30                       # segundos que se guarda una respuesta GET
SSL_CTX = ssl._create_unverified_context()

_cache = {}                          # path -> (expira_en, status, data, ctype)
_lock = threading.Lock()


class Handler(BaseHTTPRequestHandler):

    def _send_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors()
        self.end_headers()

    def _reply(self, status, data, ctype):
        self.send_response(status)
        self._send_cors()
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _cache_get(self):
        with _lock:
            hit = _cache.get(self.path)
            if hit and hit[0] > time.time():
                return hit
        return None

    def _cache_put(self, status, data, ctype):
        if status == 200:  # solo cacheamos respuestas correctas
            with _lock:
                _cache[self.path] = (time.time() + CACHE_TTL, status, data, ctype)

    def _forward(self):
        # 1) Cache (solo GET): respuesta instantanea si esta fresca.
        if self.command == 'GET':
            hit = self._cache_get()
            if hit:
                self._reply(hit[1], hit[2], hit[3])
                return

        # 2) Reenvio a la API real.
        length = int(self.headers.get('Content-Length', 0) or 0)
        body = self.rfile.read(length) if length else None
        req = urllib.request.Request(UPSTREAM + self.path, data=body, method=self.command)
        if self.headers.get('Authorization'):
            req.add_header('Authorization', self.headers['Authorization'])
        if self.headers.get('Content-Type'):
            req.add_header('Content-Type', self.headers['Content-Type'])

        try:
            resp = urllib.request.urlopen(req, context=SSL_CTX, timeout=20)
            status, data = resp.status, resp.read()
            ctype = resp.headers.get('Content-Type', 'application/json')
        except urllib.error.HTTPError as e:
            status, data = e.code, e.read()
            ctype = e.headers.get('Content-Type', 'application/json')
        except Exception as e:
            status, data, ctype = 502, ('Proxy error: ' + str(e)).encode(), 'text/plain'

        if self.command == 'GET':
            self._cache_put(status, data, ctype)
        self._reply(status, data, ctype)

    do_GET = _forward
    do_POST = _forward

    def log_message(self, fmt, *args):
        print('%s %s' % (self.command, self.path))


if __name__ == '__main__':
    print('Proxy CORS (multi-hilo + cache %ds) en  http://localhost:%d  ->  %s'
          % (CACHE_TTL, PORT, UPSTREAM))
    print('Dejalo corriendo. Ctrl+C para detener.')
    ThreadingHTTPServer(('localhost', PORT), Handler).serve_forever()