// Only the public catalog lives in Firebase. Private customer records stay in D1.
let cachedToken;
const encoder = new TextEncoder();
const base64url = value => btoa(String.fromCharCode(...value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const encoded = value => base64url(encoder.encode(JSON.stringify(value)));
function database(env) {
  const url = env.FIREBASE_DATABASE_URL;
  if (url !== 'https://coollife-minjaedy-default-rtdb.asia-southeast1.firebasedatabase.app') throw new Error('Unexpected Coollife database');
  return url + '/public/catalog.json';
}
async function accessToken(env) {
  if (cachedToken?.expires > Date.now() + 60000) return cachedToken.value;
  const account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  if (account.project_id !== 'coollife-minjaedy' || account.client_email !== 'coollife-server@coollife-minjaedy.iam.gserviceaccount.com') throw new Error('Unexpected Firebase identity');
  const keyBytes = Uint8Array.from(atob(account.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', keyBytes, {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'}, false, ['sign']);
  const now = Math.floor(Date.now()/1000);
  const payload = encoded({alg:'RS256',typ:'JWT'}) + '.' + encoded({iss:account.client_email,scope:'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(payload));
  const response = await fetch('https://oauth2.googleapis.com/token', {method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:payload+'.'+base64url(new Uint8Array(signature))}),signal:AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error('Firebase authentication failed');
  const result = await response.json();
  cachedToken = {value:result.access_token,expires:Date.now()+result.expires_in*1000};
  return cachedToken.value;
}
export async function readCatalog(env, etag=false) {
  const response = await fetch(database(env), {headers:etag?{'X-Firebase-ETag':'true'}:{},signal:AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error('Catalog unavailable');
  const value = await response.json();
  if (!value?.services) throw new Error('Catalog not initialized');
  return etag ? {value,etag:response.headers.get('etag')} : value;
}
export async function writeCatalog(env, value, etag) {
  if (!etag) throw new Error('Catalog version missing');
  const response = await fetch(database(env), {method:'PUT',headers:{Authorization:'Bearer '+await accessToken(env),'Content-Type':'application/json','If-Match':etag},body:JSON.stringify(value),signal:AbortSignal.timeout(10000)});
  if (response.status===412) return false;
  if (!response.ok) throw new Error('Catalog save failed');
  return true;
}
