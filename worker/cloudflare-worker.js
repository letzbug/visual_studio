// Secrets: OPENAI_API_KEY, STUDIO_ACCESS_CODE. Variables: ALLOWED_ORIGIN, OPENAI_IMAGE_MODEL.
export default { async fetch(request, env) {
  const origin = request.headers.get('Origin');
  const cors = {'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '', 'Access-Control-Allow-Headers':'content-type, authorization','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
  const reply = (body,status=200) => Response.json(body,{status,headers:cors});
  if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) return reply({error:'Origine non autorisée'},403);
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:cors});
  if (request.method !== 'POST' || new URL(request.url).pathname !== '/generate') return reply({error:'Route inconnue'},404);
  if (!env.STUDIO_ACCESS_CODE || env.STUDIO_ACCESS_CODE.length < 24 || !env.OPENAI_API_KEY || !env.OPENAI_IMAGE_MODEL || !env.QUOTA) return reply({error:'Service non configuré'},503);
  if (request.headers.get('Authorization') !== 'Bearer '+env.STUDIO_ACCESS_CODE) return reply({error:'Code incorrect'},401);
  try {
    const raw = await request.text(); if(raw.length > 18000000) return reply({error:'Références trop volumineuses'},413);
    const b = JSON.parse(raw); const refs = b.refs || [];
    if(b.provider !== 'openai' || typeof b.prompt !== 'string' || !b.prompt.trim() || b.prompt.length > 20000 || !Number.isInteger(b.count) || b.count<1 || b.count>4 || !Array.isArray(refs) || refs.length>3 || refs.some(r=>typeof r !== 'string'||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(r))) return reply({error:'Paramètres invalides'},400);
    const quota = await env.QUOTA.get(env.QUOTA.idFromName('global')).fetch('https://quota/reserve',{method:'POST',body:JSON.stringify({count:b.count})});
    if(!quota.ok) return reply({error:'Limite quotidienne atteinte'},429);
    const size = b.width === b.height ? '1024x1024' : b.width>b.height ? '1536x1024':'1024x1536';
    const prompt = b.prompt + (b.negative_prompt ? '\nAvoid: '+String(b.negative_prompt).slice(0,4000):'') + (refs.length?'\nUse references for visual style only; create a new composition, do not reproduce existing text or logos.':'');
    const params = {model:env.OPENAI_IMAGE_MODEL,prompt,n:b.count,size,quality:'medium'};
    const headers = {Authorization:'Bearer '+env.OPENAI_API_KEY}; let body;
    if(refs.length){body=new FormData(); for(const [k,v] of Object.entries(params)) body.append(k,String(v)); for(const [i,r] of refs.entries()) body.append('image[]',new Blob([Uint8Array.from(atob(r.split(',')[1]),c=>c.charCodeAt(0))],{type:'image/png'}),`reference-${i}.png`);}
    else {headers['Content-Type']='application/json';body=JSON.stringify(params);}
    const res=await fetch('https://api.openai.com/v1/images/'+(refs.length?'edits':'generations'),{method:'POST',headers,body});
    if(!res.ok) return reply({error:'OpenAI : HTTP '+res.status+' (vérifiez modèle, accès et facturation)'},502);
    const data=await res.json(); const images=(data.data||[]).filter(x=>x.b64_json).map(x=>({b64:x.b64_json,mime:'image/png'}));
    return images.length?reply({images}):reply({error:'Aucune image reçue'},502);
  } catch {return reply({error:'Requête ou service indisponible'},400);}
}};
export class Quota {
  constructor(ctx){this.ctx=ctx;}
  async fetch(request){const {count}=await request.json(); const day=new Date().toISOString().slice(0,10); const ok=await this.ctx.storage.transaction(async tx=>{const old=await tx.get('daily'); const used=old?.day===day?old.used:0; if(used+count>20)return false; await tx.put('daily',{day,used:used+count});return true;});return new Response(null,{status:ok?200:429});}
}
