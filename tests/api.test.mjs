import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{hash} from '../server/worker.mjs';
import {storage} from '../server/local.mjs';

const origin='https://minjaedy.github.io';
const tomorrow=()=>{const d=new Date();d.setDate(d.getDate()+1);return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(d);};
function fixture(){
 const env={DB:storage(),APP_ORIGIN:origin,ADMIN_LINK_HASH:null};
 const call=(path,method='GET',data,token,requestOrigin=origin)=>worker.fetch(new Request('https://coollife.test/api/'+path,{method,headers:{Origin:requestOrigin,...(data?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(data?{body:JSON.stringify(data)}:{})}),env);
 return {env,call};
}
const quote=(access,photos=[])=>({access,photos,name:'테스트 고객',phone:'01000000000',address:'서울특별시 중구 세종대로 110',detail:'가상 주소',note:'테스트',date:tomorrow(),time:'morning',items:[{id:'wall',quantity:1}],consent:true});
const image={data:Buffer.from([255,216,255,224,0,0,0,0,0,0,0,0]).toString('base64')};
async function setup(f){const key='1'.repeat(64);f.env.ADMIN_LINK_HASH=await hash(key);assert.equal((await (await f.call('admin/session','GET',null,key)).json()).authenticated,true);return key;}

test('private admin link grants access, public URL does not, and rotating the key revokes access',async()=>{
 const f=fixture();assert.equal((await f.call('admin/quotes')).status,401);
 assert.equal((await f.call('admin/login','POST',{preview:true})).status,403);
 const token=await setup(f);
 assert.equal((await f.call('admin/quotes','GET',null,token)).status,200);
 assert.equal((await f.call('admin/quotes','GET',null,'2'.repeat(64))).status,401);
 f.env.ADMIN_LINK_HASH=await hash('3'.repeat(64));
 assert.equal((await f.call('admin/quotes','GET',null,token)).status,401);
 assert.equal((await f.call('admin/quotes','GET',null,'3'.repeat(64))).status,200);
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
 const changed=structuredClone(initial);changed.services[0].price=80000;changed.services[0].discount='2대 이상 10% 할인';changed.services[0].brandPriceNote='삼성 일부 모델: 10,000원 추가\nLG 일부 모델: 별도 견적';changed.business.discountNote='방문 전 상담';
 assert.equal((await f.call('admin/catalog','PUT',changed)).status,401);
 assert.equal((await f.call('admin/catalog','PUT',changed,admin)).status,200);
 const next=await (await f.call('catalog')).json();assert.equal(next.services[0].price,80000);assert.equal(next.services[0].discount,'2대 이상 10% 할인');assert.equal(next.business.discountNote,'방문 전 상담');assert.equal(next.services[0].brandPriceNote,changed.services[0].brandPriceNote);
 assert.equal((await f.call('admin/catalog','PUT',changed,admin)).status,409);
 const olderClient=structuredClone(next);delete olderClient.services[0].brandPriceNote;assert.equal((await f.call('admin/catalog','PUT',olderClient,admin)).status,200);
 const preserved=await (await f.call('catalog')).json();assert.equal(preserved.services[0].brandPriceNote,changed.services[0].brandPriceNote);
 const tooLong=structuredClone(preserved);tooLong.services[0].brandPriceNote='a'.repeat(601);assert.equal((await f.call('admin/catalog','PUT',tooLong,admin)).status,400);
 preserved.services[0].brandPriceNote='';assert.equal((await f.call('admin/catalog','PUT',preserved,admin)).status,200);assert.equal((await (await f.call('catalog')).json()).services[0].brandPriceNote,'');
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

test('production D1 BLOB array is returned as original image bytes',async()=>{
 const f=fixture(),admin=await setup(f),access='f'.repeat(48);
 await f.call('quotes','POST',quote(access,[image]));
 const q=await (await f.call('quote','GET',null,access)).json();
 const prepare=f.env.DB.prepare;
 f.env.DB.prepare=statement=>{const original=prepare(statement);const bind=original.bind;original.bind=(...args)=>{const bound=bind(...args);const first=bound.first;bound.first=async()=>{const row=await first();if(row?.content)row.content=Array.from(row.content);return row;};return bound;};return original;};
 for(const credential of [access,admin]){const response=await f.call('photos/'+q.photos[0].id,'GET',null,credential);assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),Buffer.from(image.data,'base64'));}
 f.env.DB.raw.close();
});
test('quick status changes preserve approval requirements and avoid duplicate history',async()=>{
 const f=fixture(),admin=await setup(f),access='9'.repeat(48);
 const {id}=await (await f.call('quotes','POST',quote(access))).json();
 let response=await f.call('admin/quotes/'+id,'POST',{revision:1,action:'status',status:'reviewing'},admin);assert.equal(response.status,200);
 let q=await response.json();assert.equal(q.status,'reviewing');assert.equal(q.revision,2);
 response=await f.call('admin/quotes/'+id,'POST',{revision:2,action:'status',status:'reviewing'},admin);q=await response.json();assert.equal(q.events.length,2);assert.equal(q.revision,2);
 assert.equal((await f.call('admin/quotes/'+id,'POST',{revision:2,action:'status',status:'approved'},admin)).status,400);
 assert.equal((await f.call('admin/quotes/'+id,'POST',{revision:1,action:'status',status:'completed'},admin)).status,409);
 response=await f.call('admin/quotes/'+id,'POST',{revision:2,action:'status',status:'cancelled'},admin);assert.equal(response.status,200);
 assert.equal((await (await f.call('quote','GET',null,access)).json()).status,'cancelled');
 const list=await (await f.call('admin/quotes','GET',null,admin)).json();assert.equal(list.quotes[0].revision,3);assert.equal(list.quotes[0].photo_count,0);
 f.env.DB.raw.close();
});

test('private discount presets support fixed/percent discounts, revision checks, and server-verified approvals',async()=>{
 const f=fixture(),admin=await setup(f),access='7'.repeat(48);
 assert.equal((await f.call('admin/discounts')).status,401);
 const initial=await (await f.call('admin/discounts','GET',null,admin)).json();assert.equal(initial.revision,1);assert.deepEqual(initial.presets,[]);
 const config={revision:1,presets:[{id:'return',name:'재방문 고객',type:'percent',value:10},{id:'event',name:'이벤트',type:'fixed',value:10000}]};
 assert.equal((await f.call('admin/discounts','PUT',config,admin)).status,200);
 assert.equal((await f.call('admin/discounts','PUT',config,admin)).status,409);
 assert.equal((await f.call('admin/discounts','PUT',{revision:2,presets:[{id:'wrong',name:'잘못된 할인',type:'percent',value:101}]},admin)).status,400);
 const publicCatalog=await (await f.call('catalog')).json();assert.equal(publicCatalog.presets,undefined);
 const {id}=await (await f.call('quotes','POST',quote(access))).json();
 const approval={revision:1,action:'approve',amount:144000,visitDate:tomorrow(),visitTime:'11:30',pricing:{baseAmount:160000,discountId:'return',discountRevision:2}};
 assert.equal((await f.call('admin/quotes/'+id,'POST',{...approval,amount:1},admin)).status,400);
 assert.equal((await f.call('admin/quotes/'+id,'POST',{...approval,pricing:{...approval.pricing,discountId:'deleted'}},admin)).status,409);
 assert.equal((await f.call('admin/quotes/'+id,'POST',approval,admin)).status,200);
 const customer=await (await f.call('quote','GET',null,access)).json();assert.equal(customer.amount,144000);assert.match(customer.events.at(-1).message,/재방문 고객 할인 16,000원/);assert.match(customer.events.at(-1).message,/최종 144,000원/);
 assert.equal((await f.call('admin/discounts','PUT',{revision:2,presets:[]},admin)).status,200);
 assert.equal((await f.call('admin/quotes/'+id,'POST',{...approval,revision:2},admin)).status,409);
 assert.equal((await f.call('admin/quotes/'+id,'POST',{...approval,revision:2,amount:160000,pricing:{baseAmount:160000,discountId:''}},admin)).status,200);
 f.env.DB.raw.close();
});

test('subtype prices persist, quote snapshots are server-owned, and old clients preserve subtype settings',async()=>{
 const f=fixture(),admin=await setup(f),initial=await (await f.call('catalog')).json();
 const ceiling=initial.services.find(s=>s.id==='ceiling');
 ceiling.variants.find(v=>v.id==='1way').price=80000;
 ceiling.variants.find(v=>v.id==='4way').price=120000;
 ceiling.variants.find(v=>v.id==='2way').active=false;
 ceiling.variants.push({id:'custom',name:'관리자 추가 종류',price:150000,active:true});
 assert.equal((await f.call('admin/catalog','PUT',initial,admin)).status,200);
 const saved=await (await f.call('catalog')).json();
 assert.deepEqual(saved.services.find(s=>s.id==='ceiling').variants,ceiling.variants);
 const access='8'.repeat(48),request=quote(access);
 request.items=[{id:'ceiling',variantId:'1way',quantity:2,price:1,name:'위조 이름'},{id:'ceiling',variantId:'4way',quantity:1}];
 const created=await f.call('quotes','POST',request);assert.equal(created.status,201);const {id}=await created.json();
 const own=await (await f.call('quote','GET',null,access)).json(),review=await (await f.call('admin/quotes/'+id,'GET',null,admin)).json();
 assert.deepEqual(own.items,review.items);assert.equal(own.items[0].price,80000);assert.equal(own.items[0].quantity,2);
 assert.match(own.items[0].name,/1WAY/);assert.equal(own.items[0].unit,'대');assert.match(own.items[1].name,/4WAY/);
 const oldClient=structuredClone(saved);oldClient.services.forEach(s=>delete s.variants);
 assert.equal((await f.call('admin/catalog','PUT',oldClient,admin)).status,200);
 const preserved=await (await f.call('catalog')).json();assert.deepEqual(preserved.services.find(s=>s.id==='ceiling').variants,ceiling.variants);
 assert.equal((await f.call('admin/catalog','PUT',saved,admin)).status,409);
 preserved.services.find(s=>s.id==='ceiling').variants[0].price=90000;
 assert.equal((await f.call('admin/catalog','PUT',preserved,admin)).status,200);
 assert.equal((await (await f.call('quote','GET',null,access)).json()).items[0].price,80000);
 f.env.DB.raw.close();
});

test('subtype requests reject duplicate, hidden and invalid choices, while unknown and legacy requests remain possible',async()=>{
 const f=fixture(),admin=await setup(f),catalog=await (await f.call('catalog')).json();
 catalog.services.find(s=>s.id==='ceiling').variants.find(v=>v.id==='2way').active=false;
 await f.call('admin/catalog','PUT',catalog,admin);
 for(const items of [
  [{id:'ceiling',variantId:'1way',quantity:1},{id:'ceiling',variantId:'1way',quantity:2}],
  [{id:'ceiling',variantId:'2way',quantity:1}],
  [{id:'ceiling',variantId:'windfree',quantity:1}],
  [{id:'ceiling',variantId:'does-not-exist',quantity:1}],
  [{id:'ceiling',variantId:4,quantity:1}],
  [null]
 ])assert.equal((await f.call('quotes','POST',{...quote(crypto.randomUUID().replaceAll('-','')+'0'.repeat(16)),items})).status,400);
 const access='6'.repeat(48),unknown={...quote(access),items:[{id:'ceiling',variantId:'unknown',quantity:1}]};
 assert.equal((await f.call('quotes','POST',unknown)).status,201);
 const own=await (await f.call('quote','GET',null,access)).json();assert.equal(own.items[0].price,null);assert.match(own.items[0].name,/종류를 모르겠어요/);
 assert.equal((await f.call('quotes','POST',quote('5'.repeat(48)))).status,201);
 f.env.DB.raw.close();
});

test('catalog rejects ambiguous or invalid subtype definitions',async()=>{
 const f=fixture(),admin=await setup(f),initial=await (await f.call('catalog')).json();
 for(const mutate of [
  s=>s.variants.push({...s.variants[0]}),
  s=>s.variants[0].id='unknown',
  s=>s.variants[0].price=-1,
  s=>s.variants[0].name='',
  s=>s.variants=[],
  s=>s.variants=Array.from({length:21},(_,i)=>({id:'v-'+i,name:'종류',price:null,active:true}))
 ]){const data=structuredClone(initial);mutate(data.services[0]);assert.equal((await f.call('admin/catalog','PUT',data,admin)).status,400);}
 f.env.DB.raw.close();
});
