#!/usr/bin/env python3
# ============================================================================
# proxy.py  -  Puente CORS local para la API del Mundial 2026
# ----------------------------------------------------------------------------
# El servidor https://worldcup26.ir NO envia las cabeceras CORS que el
# navegador exige, asi que un fetch() directo desde localhost siempre falla.
# Este proxy corre en tu maquina (http://localhost:3001), reenvia cada
# peticion a la API y le agrega las cabeceras CORS que faltan.
#
# Importante: reenvia el CODIGO DE ESTADO REAL (400/401/429/500...) y el
# cuerpo tal cual, para que la logica de resiliencia de tu app (backoff,
# modal de sesion, etc.) siga funcionando igual.
#
# USO:  python proxy.py       (dejalo corriendo en su propia terminal)
# ============================================================================

import http.server
import urllib.request
import urllib.error
import ssl

UPSTREAM = 'https://worldcup26.ir'   # la API real
PORT = 3001                          # puerto local del proxy
SSL_CTX = ssl._create_unverified_context()  # evita problemas de certificado en local


class Handler(http.server.BaseHTTPRequestHandler):

    def _send_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        # Necesario cuando la pagina se abre como file:// (o desde un origen
        # "publico"): Chrome/Edge exigen esta cabecera para permitir el acceso
        # a una direccion "privada" como localhost (Private Network Access).
        self.send_header('Access-Control-Allow-Private-Network', 'true')

    # El navegador manda un OPTIONS de "permiso" antes del POST/GET real.
    # Aqui lo respondemos nosotros con las cabeceras CORS -> preflight OK.
    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors()
        self.end_headers()

    def _forward(self):
        length = int(self.headers.get('Content-Length', 0) or 0)
        body = self.rfile.read(length) if length else None

        req = urllib.request.Request(UPSTREAM + self.path, data=body, method=self.command)
        if self.headers.get('Authorization'):
            req.add_header('Authorization', self.headers['Authorization'])
        if self.headers.get('Content-Type'):
            req.add_header('Content-Type', self.headers['Content-Type'])

        try:
            resp = urllib.request.urlopen(req, context=SSL_CTX)
            status = resp.status
            data = resp.read()
            ctype = resp.headers.get('Content-Type', 'application/json')
        except urllib.error.HTTPError as e:
            # 400/401/429/500... se reenvian con su codigo y cuerpo reales.
            status = e.code
            data = e.read()
            ctype = e.headers.get('Content-Type', 'application/json')
        except Exception as e:
            status = 502
            data = ('Proxy error: ' + str(e)).encode()
            ctype = 'text/plain'

        self.send_response(status)
        self._send_cors()
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    do_GET = _forward
    do_POST = _forward

    def log_message(self, fmt, *args):
        # Log compacto: metodo, ruta y codigo devuelto.
        print('%s %s' % (self.command, self.path))


if __name__ == '__main__':
    print('Proxy CORS activo en  http://localhost:%d   ->  %s' % (PORT, UPSTREAM))
    print('Dejalo corriendo. Ctrl+C para detener.')
    http.server.HTTPServer(('localhost', PORT), Handler).serve_forever()