/* ============================================================================
 * cloudflare-worker.js  —  Proxy CORS en la nube (para GitHub Pages)
 * ----------------------------------------------------------------------------
 * Reemplaza al proxy.py cuando la app está publicada. Siempre encendido, con
 * HTTPS y gratis. Agrega las cabeceras CORS que la API no envía y reenvía el
 * código de estado real (400/401/429/500...) para no romper la resiliencia.
 *
 * Cómo desplegarlo (una sola vez):
 *   1. Crea cuenta gratis en https://dash.cloudflare.com
 *   2. Workers & Pages -> Create -> Workers -> Create Worker -> Deploy
 *   3. Edit code -> pega TODO este archivo -> Deploy
 *   4. Copia la URL que te da (algo como https://xxxx.tu-usuario.workers.dev)
 *   5. Pon esa URL como API_BASE en js/api.js (ver instrucciones del chat)
 * ========================================================================== */

const UPSTREAM = 'https://worldcup26.ir';

function corsHeaders() {
  const h = new Headers();
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  return h;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Preflight: respondemos nosotros con las cabeceras CORS.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Reenvío a la API real conservando método, cabeceras y cuerpo.
    const init = {
      method: request.method,
      headers: {},
      redirect: 'follow'
    };
    const auth = request.headers.get('Authorization');
    if (auth) init.headers['Authorization'] = auth;
    const ctype = request.headers.get('Content-Type');
    if (ctype) init.headers['Content-Type'] = ctype;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = await request.arrayBuffer();
    }

    const upstreamResp = await fetch(UPSTREAM + url.pathname + url.search, init);
    const body = await upstreamResp.arrayBuffer();

    const headers = corsHeaders();
    headers.set('Content-Type', upstreamResp.headers.get('Content-Type') || 'application/json');
    return new Response(body, { status: upstreamResp.status, headers });
  }
};
