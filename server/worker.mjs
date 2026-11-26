import {readCatalog,writeCatalog} from './firebase.mjs';
const PHONE='01041663703';
export const defaults={revision:1,business:{name:'쿨라이프',phone:PHONE,area:'서비스 지역은 상담 시 안내해 드려요.',discountNote:''},services:[
 {id:'wall',name:'벽걸이 에어컨',description:'방 안의 공기를 산뜻하게',price:null,active:true},
 {id:'standing',name:'스탠드 에어컨',description:'거실을 채우는 깨끗한 바람',price:null,active:true},
 {id:'ceiling',name:'천장형 에어컨',description:'매장과 사무실도 꼼꼼하게',price:null,active:true},
 {id:'twoinone',name:'2 in 1 에어컨',description:'스탠드와 벽걸이를 함께',price:null,active:true}
]};
const states=['received','reviewing','approved','completed','cancelled'];
const names={received:'접수 완료',reviewing:'견적 확인 중',approved:'방문 확정',completed:'세척 완료',cancelled:'취소'};
const encoder=new TextEncoder();
export const hash=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(s)))].map(n=>n.toString(16).padStart(2,'0')).join('');
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),n=>n.toString(16).padStart(2,'0')).join('');
const json=(data,status=200,extra={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...extra}});
const sql=(env,q,...args)=>env.DB.prepare(q).bind(...args);
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const local=(request,env)=>env.LOCAL_PREVIEW==='1'&&['localhost','127.0.0.1','[::1]'].includes(new URL(request.url).hostname);
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
const text=(value,max,min=0)=>{if(typeof value!=='string'||value.trim().length<min||value.length>max)throw fail('입력 내용을 확인해 주세요.');return value.trim();};
const cleanPhone=s=>text(s,30,9).replace(/[^\d]/g,'');
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
async function body(request,max=1200000){
 if(Number(request.headers.get('content-length'))>max)throw fail('첨부 용량이 너무 커요.',413);
 const reader=request.body?.getReader();if(!reader)throw fail('입력 내용이 없어요.');let size=0;const chunks=[];
 for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw fail('첨부 용량이 너무 커요.',413)}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes))}catch{throw fail('입력 형식을 확인해 주세요.');}
}
async function rate(request,env,kind,max){
 const span=kind==='login'?600000:3600000,now=Date.now(),key=kind+':'+await hash((request.headers.get('CF-Connecting-IP')||'local')+':'+Math.floor(now/span));
 const row=await sql(env,'INSERT INTO limits(id,count,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count',key,now+span).first();
 if(row.count>max)throw fail('요청이 많아요. 잠시 후 다시 시도해 주세요.',429);
}
async function catalog(env){if(env.FIREBASE_DATABASE_URL)return readCatalog(env);return JSON.parse((await sql(env,"SELECT value FROM config WHERE id='catalog'").first())?.value||JSON.stringify(defaults));}
function token(request){return request.headers.get('Authorization')?.replace(/^Bearer /,'')||'';}
async function admin(request,env){
 const key=token(request)||request.headers.get('Cookie')?.match(/(?:^|;\s*)coollife_admin=([a-f0-9]{48})/)?.[1];if(!key||!/^[a-f0-9]{48}$/.test(key))return false;
 return !!await sql(env,'SELECT token_hash FROM admin_sessions WHERE token_hash=? AND expires>?',await hash(key),Date.now()).first();
}
async function requireAdmin(request,env){if(!await admin(request,env))throw fail('관리자 로그인이 필요해요.',401);}
async function customer(request,env){const key=token(request);if(key.length<32||key.length>128)throw fail('조회번호를 확인해 주세요.',404);const row=await sql(env,'SELECT * FROM quotes WHERE access_hash=?',await hash(key)).first();if(!row)throw fail('조회번호를 확인해 주세요.',404);return row;}
async function present(env,row,isAdmin=false){
 const events=(await sql(env,'SELECT id,kind,message,created_at FROM events WHERE quote_id=? ORDER BY created_at,id',row.id).all()).results;
 const photos=(await sql(env,'SELECT id,mime,bytes FROM photos WHERE quote_id=?',row.id).all()).results;
 const {access_hash,consent_at,last_action,...visible}=row;if(!isAdmin)delete visible.admin_note;
 return {...visible,items:JSON.parse(row.items),events,photos};
}
export async function passwordHash(password,salt){const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);return Array.from(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:100000},key,256)),n=>n.toString(16).padStart(2,'0')).join('');}
function secureEqual(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
async function login(request,env){
 await rate(request,env,'login',10);const input=await body(request,4096);
 if(!(local(request,env)&&input.preview===true)){
  const credentials=await sql(env,"SELECT value FROM config WHERE id='admin_credentials'").first();
  if(!credentials)throw fail('먼저 관리자 초기 설정을 완료해 주세요.',503);
  const stored=JSON.parse(credentials.value);
  if(typeof input.password!=='string'||input.password.length>200||!secureEqual(await passwordHash(input.password,stored.salt),stored.hash))throw fail('관리자 암호를 확인해 주세요.',401);
 }
 return sessionResponse(request,env);
}
async function setup(request,env){
 await rate(request,env,'login',10);const input=await body(request,4096);
 if(!env.ADMIN_SETUP_HASH||typeof input.setupToken!=='string'||input.setupToken.length>200||!secureEqual(await hash(input.setupToken),env.ADMIN_SETUP_HASH))throw fail('관리자 설정 링크를 확인해 주세요.',403);
 if(typeof input.password!=='string'||input.password.length<12||input.password.length>200)throw fail('관리자 암호는 12자 이상으로 설정해 주세요.');
 const salt=random(),credentials=JSON.stringify({salt,hash:await passwordHash(input.password,salt)});
 const result=await sql(env,"INSERT INTO config(id,value) VALUES('admin_credentials',?) ON CONFLICT(id) DO NOTHING",credentials).run();
 if(!result.meta.changes)throw fail('관리자 설정이 이미 완료됐어요. 암호로 로그인해 주세요.',409);
 return sessionResponse(request,env);
}
async function sessionResponse(request,env){
 const session=random();await sql(env,'INSERT INTO admin_sessions(token_hash,expires) VALUES(?,?)',await hash(session),Date.now()+7*86400000).run();
 const secure=new URL(request.url).protocol==='https:'?'; Secure':'';
 return json({ok:true,token:session},200,{'Set-Cookie':`coollife_admin=${session}; Path=/api/; HttpOnly; SameSite=Strict; Max-Age=604800${secure}`});
}
function photo(raw){
 if(typeof raw?.data!=='string'||raw.data.length>350000)throw fail('사진은 한 장당 250KB 이내로 압축해 주세요.');
 let bytes;try{bytes=Uint8Array.from(atob(raw.data),c=>c.charCodeAt(0));}catch{throw fail('사진 형식을 확인해 주세요.');}
 if(bytes.length>250000||bytes.length<12)throw fail('사진 용량을 확인해 주세요.');
 const isJpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const isPng=bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10';
 const isWebp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 const mime=isJpeg?'image/jpeg':isPng?'image/png':isWebp?'image/webp':null;
 if(!mime)throw fail('JPG, PNG, WebP 사진만 첨부할 수 있어요.');return{bytes,mime};
}
async function create(request,env){
 await rate(request,env,'quote',12);const b=await body(request),c=await catalog(env);
 const name=text(b.name,50,1),phone=cleanPhone(b.phone),address=text(b.address,200,5),detail=text(b.detail||'',100),note=text(b.note||'',1500);
 if(!/^0\d{8,10}$/.test(phone))throw fail('연락받을 전화번호를 확인해 주세요.');
 if(b.consent!==true)throw fail('견적 상담을 위한 정보 제공에 동의해 주세요.');
 if(!validDate(b.date)||b.date<today()||Date.parse(b.date)>Date.now()+370*86400000)throw fail('희망 날짜를 확인해 주세요.');
 if(!['flexible','morning','afternoon'].includes(b.time))throw fail('희망 시간대를 선택해 주세요.');
 if(!Array.isArray(b.items)||!b.items.length||b.items.length>12||new Set(b.items.map(x=>x.id)).size!==b.items.length)throw fail('세척할 에어컨을 선택해 주세요.');
 const items=b.items.map(item=>{const service=c.services.find(x=>x.id===item.id&&x.active);if(!service||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>20)throw fail('선택한 에어컨과 수량을 확인해 주세요.');return{id:service.id,name:service.name,quantity:item.quantity,price:service.price};});
 const lat=b.lat??null,lng=b.lng??null;if((lat!==null||lng!==null)&&!(Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=32&&lat<=40&&lng>=123&&lng<=133))throw fail('지도에서 국내 방문 위치를 확인해 주세요.');
 if(!Array.isArray(b.photos)||b.photos.length>3)throw fail('사진은 최대 3장까지 첨부해 주세요.');
 const photos=b.photos.map(photo);
 // An opaque, browser-generated capability also makes a retry idempotent after a lost response.
 if(!/^[a-f0-9]{48}$/.test(b.access||''))throw fail('신청 화면을 다시 열어 주세요.');
 const accessHash=await hash(b.access),existing=await sql(env,'SELECT id,reference FROM quotes WHERE access_hash=?',accessHash).first();if(existing)return json({id:existing.id,reference:existing.reference},200);
 const id=crypto.randomUUID(),now=Date.now(),reference='CL-'+today().replaceAll('-','')+'-'+random().slice(0,6).toUpperCase();
 const commands=[sql(env,'INSERT INTO quotes(id,reference,access_hash,customer_name,phone,address,detail_address,lat,lng,preferred_date,preferred_time,items,customer_note,consent_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,reference,accessHash,name,phone,address,detail,lat,lng,b.date,b.time,JSON.stringify(items),note,now,now,now),sql(env,'INSERT INTO events(id,quote_id,kind,message,created_at) VALUES(?,?,?,?,?)',crypto.randomUUID(),id,'received','견적 신청이 접수됐어요. 내용을 확인한 뒤 이 화면에 안내를 남겨드릴게요.',now)];
 for(const image of photos)commands.push(sql(env,'INSERT INTO photos(id,quote_id,mime,bytes,content) VALUES(?,?,?,?,?)',crypto.randomUUID(),id,image.mime,image.bytes.length,image.bytes));
 try{await env.DB.batch(commands);}catch(error){const retried=await sql(env,'SELECT id,reference FROM quotes WHERE access_hash=?',accessHash).first();if(retried)return json(retried);throw error;}
 return json({id,reference},201);
}
async function saveCatalog(request,env){
 const data=await body(request,20000),remote=env.FIREBASE_DATABASE_URL?await readCatalog(env,true):null,current=remote?.value||await catalog(env);
 if(data.revision!==current.revision)throw fail('다른 화면에서 가격표가 바뀌었어요. 새로고침 후 다시 저장해 주세요.',409);
 if(!Array.isArray(data.services)||data.services.length<1||data.services.length>20)throw fail('서비스는 1~20개까지 등록할 수 있어요.');
 const ids=new Set();const services=data.services.map(s=>{
  if(!/^[a-z0-9-]{1,40}$/.test(s.id)||ids.has(s.id))throw fail('서비스 항목을 확인해 주세요.');ids.add(s.id);
  if(s.price!==null&&(!Number.isInteger(s.price)||s.price<0||s.price>10000000))throw fail('가격은 0원 이상의 숫자로 입력해 주세요.');
  return{id:s.id,name:text(s.name,50,1),description:text(s.description||'',100),discount:text(s.discount||'',200),price:s.price,active:s.active===true};
 });
 const phone=cleanPhone(data.business.phone);if(!/^0\d{8,10}$/.test(phone))throw fail('대표 연락처를 확인해 주세요.');
 const updated={revision:current.revision+1,business:{name:'쿨라이프',phone,area:text(data.business.area||'',200),discountNote:text(data.business.discountNote||'',600)},services};
 if(remote){if(!await writeCatalog(env,updated,remote.etag))throw fail('가격표가 변경됐어요. 다시 불러와 주세요.',409);return json(updated);}
 const result=await sql(env,"INSERT INTO config(id,value) VALUES('catalog',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value WHERE CAST(json_extract(config.value,'$.revision') AS INTEGER)=?",JSON.stringify(updated),current.revision).run();
 if(!result.meta.changes)throw fail('가격표가 변경됐어요. 다시 불러와 주세요.',409);return json(updated);
}
async function update(request,env,id){
 const row=await sql(env,'SELECT * FROM quotes WHERE id=?',id).first();if(!row)throw fail('신청을 찾지 못했어요.',404);
 const b=await body(request,12000);if(b.revision!==row.revision)throw fail('다른 화면에서 변경됐어요. 다시 열어 주세요.',409);
 if(!['approve','message','call_request','status','note'].includes(b.action))throw fail('처리 방법을 선택해 주세요.');
 let status=row.status,amount=row.amount,visit=row.visit_at,adminNote=row.admin_note,message=text(b.message||'',2000),kind=b.action;
 if(b.action==='approve'){
  if(!Number.isInteger(b.amount)||b.amount<0||b.amount>10000000)throw fail('확정 견적 금액을 입력해 주세요.');
  if(!validDate(b.visitDate)||b.visitDate<today()||!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.visitTime||''))throw fail('방문 날짜와 시간을 확인해 주세요.');
  status='approved';amount=b.amount;visit=b.visitDate+'T'+b.visitTime+':00+09:00';message||='견적과 방문 일정이 확정됐어요. 안내된 시간에 찾아뵐게요.';
 }
 if(b.action==='status'){if(!states.includes(b.status)||b.status==='approved')throw fail('상태를 확인해 주세요.');status=b.status;message||=names[status]+' 상태로 변경됐어요.';}
 if(b.action==='message'&&!message)throw fail('고객에게 보낼 안내를 입력해 주세요.');
 if(b.action==='call_request')message||='방문 내용을 확인하려고 해요. 편하실 때 쿨라이프로 전화 부탁드려요.';
 if(b.action==='note')adminNote=text(b.note||'',3000);
 const now=Date.now(),actionId=crypto.randomUUID(),commands=[sql(env,'UPDATE quotes SET status=?,amount=?,visit_at=?,admin_note=?,revision=revision+1,updated_at=?,last_action=? WHERE id=? AND revision=?',status,amount,visit,adminNote,now,actionId,id,row.revision)];
 if(b.action!=='note')commands.push(sql(env,'INSERT INTO events(id,quote_id,kind,message,created_at) SELECT ?,?,?,?,? FROM quotes WHERE id=? AND last_action=?',actionId,id,kind,message,now,id,actionId));
 const result=await env.DB.batch(commands);if(!result[0].meta.changes)throw fail('다른 화면에서 변경됐어요. 다시 열어 주세요.',409);
 const updated=await sql(env,'SELECT * FROM quotes WHERE id=?',id).first();
 return json(await present(env,updated,true));
}
async function geo(request,env){
 await rate(request,env,'geo',60);const b=await body(request,2000);
 if(!env.KAKAO_REST_KEY)return json({address:null,available:false});
 if(!Number.isFinite(b.lat)||!Number.isFinite(b.lng)||b.lat<32||b.lat>40||b.lng<123||b.lng>133)throw fail('국내 위치를 선택해 주세요.');
 const key=b.lat.toFixed(5)+','+b.lng.toFixed(5),cache=await sql(env,'SELECT value FROM geo_cache WHERE id=? AND expires>?',key,Date.now()).first();if(cache)return json(JSON.parse(cache.value));
 const response=await fetch('https://dapi.kakao.com/v2/local/geo/coord2address.json?x='+b.lng+'&y='+b.lat,{headers:{Authorization:'KakaoAK '+env.KAKAO_REST_KEY},signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw fail('주소를 자동으로 찾지 못했어요. 주소 검색이나 직접 입력을 이용해 주세요.',502);
 const result=await response.json(),first=result.documents?.[0],data={address:first?.road_address?.address_name||first?.address?.address_name||null,available:true};
 await sql(env,'INSERT INTO geo_cache(id,value,expires) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value,expires=excluded.expires',key,JSON.stringify(data),Date.now()+86400000).run();return json(data);
}
async function api(request,env){
 const url=new URL(request.url),path=url.pathname;
 if(request.method!=='GET'&&!allowedOrigin(request,env))throw fail('허용되지 않은 요청이에요.',403);
 // No extra paid cron trigger: expired metadata is pruned on the first visit each day.
 const maintenance=await sql(env,"INSERT INTO config(id,value) VALUES('cleanup_at',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value WHERE CAST(config.value AS INTEGER)<?",String(Date.now()),Date.now()-86400000).run();
 if(maintenance.meta.changes)await cleanup(env);
 if(path==='/api/catalog'&&request.method==='GET')return json({...await catalog(env),preview:local(request,env),catalogURL:env.FIREBASE_DATABASE_URL?env.FIREBASE_DATABASE_URL+'/public/catalog.json':null});
 if(path==='/api/quotes'&&request.method==='POST')return create(request,env);
 if(path==='/api/quote'&&request.method==='GET')return json(await present(env,await customer(request,env)));
 if(path==='/api/geo'&&request.method==='POST')return geo(request,env);
 if(path==='/api/admin/login'&&request.method==='POST')return login(request,env);
 if(path==='/api/admin/setup'&&request.method==='POST')return setup(request,env);
 if(path==='/api/admin/session'&&request.method==='GET')return json({authenticated:await admin(request,env),setupRequired:!await sql(env,"SELECT id FROM config WHERE id='admin_credentials'").first()});
 if(path==='/api/admin/logout'&&request.method==='POST'){
  const key=token(request)||request.headers.get('Cookie')?.match(/(?:^|;\s*)coollife_admin=([a-f0-9]{48})/)?.[1];if(key)await sql(env,'DELETE FROM admin_sessions WHERE token_hash=?',await hash(key)).run();
  return json({ok:true},200,{'Set-Cookie':'coollife_admin=; Path=/api/; HttpOnly; SameSite=Strict; Max-Age=0'+(url.protocol==='https:'?'; Secure':'')});
 }
 if(path.startsWith('/api/photos/')&&request.method==='GET'){
  const photo=await sql(env,'SELECT * FROM photos WHERE id=?',path.split('/').at(-1)).first();if(!photo)throw fail('사진을 찾지 못했어요.',404);
  if(!await admin(request,env)&&(await customer(request,env)).id!==photo.quote_id)throw fail('사진을 찾지 못했어요.',404);
  return new Response(photo.content,{headers:{'Content-Type':photo.mime,'Cache-Control':'private, no-store','Content-Disposition':'inline','X-Content-Type-Options':'nosniff'}});
 }
 if(path.startsWith('/api/admin/')){
  await requireAdmin(request,env);
  if(path==='/api/admin/catalog'&&request.method==='PUT')return saveCatalog(request,env);
  if(path==='/api/admin/quotes'&&request.method==='GET'){
   const rows=(await sql(env,'SELECT id,reference,customer_name,phone,address,preferred_date,preferred_time,items,status,amount,visit_at,created_at,updated_at FROM quotes ORDER BY created_at DESC LIMIT 500').all()).results;
   return json({quotes:rows.map(x=>({...x,items:JSON.parse(x.items)}))});
  }
  const match=path.match(/^\/api\/admin\/quotes\/([a-f0-9-]{36})$/);
  if(match){if(request.method==='POST')return update(request,env,match[1]);if(request.method==='GET'){const row=await sql(env,'SELECT * FROM quotes WHERE id=?',match[1]).first();if(!row)throw fail('신청을 찾지 못했어요.',404);return json(await present(env,row,true));}}
 }
 throw fail('요청한 내용을 찾을 수 없어요.',404);
}
function allowedOrigin(request,env){const origin=request.headers.get('Origin');return !!origin&&(origin===new URL(request.url).origin||origin===env.APP_ORIGIN);}
async function cleanup(env){await env.DB.batch([sql(env,'DELETE FROM admin_sessions WHERE expires<?',Date.now()),sql(env,'DELETE FROM limits WHERE expires<?',Date.now()),sql(env,'DELETE FROM geo_cache WHERE expires<?',Date.now())]);}
export default {
 async fetch(request,env){
  let response;
  try{response=request.method==='OPTIONS'?(allowedOrigin(request,env)?new Response(null,{status:204}):json({error:'허용되지 않은 요청이에요.'},403)):new URL(request.url).pathname.startsWith('/api/')?await api(request,env):env.ASSETS?await env.ASSETS.fetch(request):json({service:'Coollife API',ok:true});}
  catch(error){response=json({error:error.status?error.message:'연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.'},error.status||500);}
  const headers=new Headers(response.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','no-referrer');headers.set('X-Frame-Options','DENY');headers.set('Permissions-Policy','geolocation=(self), camera=(self), microphone=()');
  if(allowedOrigin(request,env)){headers.set('Access-Control-Allow-Origin',request.headers.get('Origin'));headers.set('Vary','Origin');headers.set('Access-Control-Allow-Methods','GET,POST,PUT,OPTIONS');headers.set('Access-Control-Allow-Headers','Content-Type,Authorization');headers.set('Access-Control-Max-Age','600');}
  return new Response(response.body,{status:response.status,headers});
 },
 async scheduled(_,env){await cleanup(env);}
};
