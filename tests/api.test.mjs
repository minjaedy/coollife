import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{hash} from '../server/worker.mjs';
import {storage} from '../server/local.mjs';

const origin='https://minjaedy.github.io';
const tomorrow=()=>{const d=new Date();d.setDate(d.getDate()+1);return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(d);};
function fixture(){
 const env={DB:storage(),APP_ORIGIN:origin,ADMIN_SETUP_HASH:null};
 const call=(path,method='GET',data,token,requestOrigin=origin)=>worker.fetch(new Request('https://coollife.test/api/'+path,{method,headers:{Origin:requestOrigin,...(data?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(data?{body:JSON.stringify(data)}:{})}),env);
 return {env,call};
}
const quote=(access,photos=[])=>({access,photos,name:'테스트 고객',phone:'01000000000',address:'서울특별시 중구 세종대로 110',detail:'가상 주소',note:'테스트',date:tomorrow(),time:'morning',items:[{id:'wall',quantity:1}],consent:true});
const image={data:Buffer.from([255,216,255,224,0,0,0,0,0,0,0,0]).toString('base64')};
async function setup(f){f.env.ADMIN_SETUP_HASH=await hash('test-only-bootstrap');const result=await f.call('admin/setup','POST',{setupToken:'test-only-bootstrap',password:'test-only-password-123'});assert.equal(result.status,200);return (await result.json()).token;}

test('production setup is secret-protected, one-time and sessions are revocable',async()=>{
 const f=fixture();f.env.ADMIN_SETUP_HASH=await hash('test-only-bootstrap');
 assert.equal((await f.call('admin/quotes')).status,401);
 assert.equal((await f.call('admin/login','POST',{preview:true})).status,503);
 assert.equal((await f.call('admin/setup','POST',{setupToken:'wrong',password:'test-only-password-123'})).status,403);
 const token=await setup(f);
 assert.equal((await f.call('admin/setup','POST',{setupToken:'test-only-bootstrap',password:'test-only-password-456'})).status,409);
 assert.equal((await f.call('admin/quotes','GET',null,token)).status,200);
 assert.equal((await f.call('admin/login','POST',{password:'wrong'})).status,401);
 assert.equal((await f.call('admin/login','POST',{password:'test-only-password-123'})).status,200);
 await f.call('admin/logout','POST',{},token);
 assert.equal((await f.call('admin/quotes','GET',null,token)).status,401);
 f.env.DB.raw.close();
});
test('customer records and photos are isolated; private notes never reach customers',async()=>{
 const f=fixture(),admin=await setup(f),a='a'.repeat(48),b='b'.repeat(48);
 const created=await f.call('quotes','POST',quote(a,[image]));assert.equal(created.status,201);
 const {id}=await created.json();assert.equal((await f.call('quotes','POST',quote(a))).status,200);
 assert.equal(f.env.DB.raw.prepare('SELECT count(*) AS count FROM quotes').get().count,1);
 await f.call('quotes','POST',quote(b));
 assert.equal((await f.call('quote')).status,404);
 const own=await (await f.call('quote','GET',null,a)).json();assert.equal(own.id,id);assert.equal(own.access_hash,undefined);
 const photoId=own.photos[0].id;
 assert.equal((await f.call('photos/'+photoId,'GET',null,b)).status,404);
 assert.equal((await f.call('photos/'+photoId,'GET',null,a)).status,200);
 assert.equal((await f.call('photos/'+photoId,'GET',null,admin)).status,200);
 await f.call('admin/quotes/'+id,'POST',{revision:1,action:'note',note:'관리자 전용 정보'},admin);
 const customer=await (await f.call('quote','GET',null,a)).json();assert.equal(customer.admin_note,undefined);assert.equal(customer.events.length,1);
 const details=await (await f.call('admin/quotes/'+id,'GET',null,admin)).json();assert.equal(details.admin_note,'관리자 전용 정보');
 const approval=await f.call('admin/quotes/'+id,'POST',{revision:2,action:'approve',amount:90000,visitDate:tomorrow(),visitTime:'10:30'},admin);assert.equal(approval.status,200);
 const approved=await (await f.call('quote','GET',null,a)).json();assert.equal(approved.amount,90000);assert.equal(approved.status,'approved');assert.equal(approved.events.at(-1).kind,'approve');
 assert.equal((await f.call('admin/quotes/'+id,'POST',{revision:2,action:'message',message:'stale'},admin)).status,409);
 const message=await f.call('admin/quotes/'+id,'POST',{revision:3,action:'call_request'},admin);assert.equal(message.status,200);
 assert.equal((await (await f.call('quote','GET',null,a)).json()).events.at(-1).kind,'call_request');
 f.env.DB.raw.close();
});
test('public prices start empty and admin changes include discounts with stale-write protection',async()=>{
 const f=fixture(),admin=await setup(f),initial=await (await f.call('catalog')).json();assert.ok(initial.services.every(x=>x.price===null));
 const changed=structuredClone(initial);changed.services[0].price=80000;changed.services[0].discount='2대 이상 10% 할인';changed.business.discountNote='방문 전 상담';
 assert.equal((await f.call('admin/catalog','PUT',changed)).status,401);
 assert.equal((await f.call('admin/catalog','PUT',changed,admin)).status,200);
 const next=await (await f.call('catalog')).json();assert.equal(next.services[0].price,80000);assert.equal(next.services[0].discount,'2대 이상 10% 할인');assert.equal(next.business.discountNote,'방문 전 상담');
 assert.equal((await f.call('admin/catalog','PUT',changed,admin)).status,409);
 f.env.DB.raw.close();
});
test('CORS permits the configured customer web and refuses other mutation origins',async()=>{
 const f=fixture(),preflight=await f.call('quotes','OPTIONS');assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);
 const denied=await f.call('quotes','POST',quote('c'.repeat(48)),null,'https://unrelated.test');assert.equal(denied.status,403);assert.equal(denied.headers.get('Access-Control-Allow-Origin'),null);
 const invalid=quote('d'.repeat(48));invalid.consent=false;assert.equal((await f.call('quotes','POST',invalid)).status,400);
 invalid.consent=true;invalid.photos=[{data:Buffer.from('<script>bad</script>').toString('base64')}];assert.equal((await f.call('quotes','POST',invalid)).status,400);
 f.env.DB.raw.close();
});
test('scheduled cleanup removes expired metadata and preserves customer requests',async()=>{
 const f=fixture();await f.call('quotes','POST',quote('e'.repeat(48)));f.env.DB.raw.prepare('INSERT INTO admin_sessions VALUES(?,?)').run('expired',1);
 await worker.scheduled({},f.env);
 assert.equal(f.env.DB.raw.prepare('SELECT count(*) AS n FROM admin_sessions').get().n,0);
 assert.equal(f.env.DB.raw.prepare('SELECT count(*) AS n FROM quotes').get().n,1);f.env.DB.raw.close();
});
