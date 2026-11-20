/* Beispiel: Cloudflare Worker als geschützte Brücke zu den Bild-APIs.
   NICHT Teil der Demo. Die API-Schlüssel liegen als Worker-Secrets vor
   (wrangler secret put OPENAI_API_KEY) und erreichen nie den Browser.

   Vertrag mit dem Frontend (js/ai/pipeline.js):
   POST /generate  { provider, prompt, negative_prompt, width, height, count }
   →               { images: [ { b64, mime } ] }

   Vor dem Einsatz: aktuelle API-Dokumentation des Anbieters prüfen (Modellname,
   erlaubte Bildgrössen, Antwortformat) und ALLOWED_ORIGIN auf die eigene Domain setzen. */
const ALLOWED_ORIGIN = 'https://example.github.io';

export default {
  async fetch(request, env) {
    const cors = { 'Access-Control-Allow-Origin': ALLOWED_ORIGIN, 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/generate') return new Response('Not found', { status: 404, headers: cors });

    const body = await request.json();
    const count = Math.min(4, Math.max(1, body.count | 0));
    let images = [];

    if (body.provider === 'openai') {
      // Platzhalter: Endpunkt, Modell und Parameter gemäss aktueller OpenAI-Images-Dokumentation eintragen.
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: env.OPENAI_IMAGE_MODEL, prompt: body.prompt, n: count, size: pickSize(body.width, body.height) })
      });
      if (!res.ok) return new Response(await res.text(), { status: 502, headers: cors });
      const data = await res.json();
      images = (data.data || []).map((d) => ({ b64: d.b64_json, mime: 'image/png' }));
    } else {
      // 'flux' und 'recraft' nach demselben Muster ergänzen.
      return new Response(JSON.stringify({ error: 'Provider not configured' }), { status: 501, headers: { ...cors, 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ images }), { headers: { ...cors, 'content-type': 'application/json' } });
  }
};

function pickSize(w, h) {
  // Auf die vom Anbieter unterstützten Grössen abbilden; das Studio schneidet beim Export passend zu.
  if (w === h) return '1024x1024';
  return w > h ? '1536x1024' : '1024x1536';
}
