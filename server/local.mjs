import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFile,mkdir} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import worker,{hash,defaults} from './worker.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export function storage(filename=':memory:'){
 const db=new DatabaseSync(filename);db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
 const prepared=(statement,args=[])=>({statement,args,bind(...values){return prepared(statement,values)},async first(){return db.prepare(statement).get(...args)||null;},async all(){return{results:db.prepare(statement).all(...args)}},async run(){return{meta:db.prepare(statement).run(...args)}}});
 return{raw:db,prepare:statement=>prepared(statement),async batch(statements){db.exec('BEGIN');try{const results=[];for(const item of statements)results.push(await item.run());db.exec('COMMIT');return results;}catch(error){db.exec('ROLLBACK');throw error;}}};
}
export async function seed(DB){
 if(DB.raw.prepare('SELECT count(*) AS n FROM quotes').get().n)return;
 const names=['김○○','박○○','이○○','정○○','최○○','윤○○'],states=['received','received','reviewing','approved','completed','approved'];
 for(let i=0;i<names.length;i++){
  const date=new Date();date.setDate(date.getDate()+i+1);const d=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(date),id=crypto.randomUUID(),now=Date.now()-i*3600000;
  const code=i===0?'111122223333444455556666777788889999aaaabbbbcccc':crypto.randomUUID().replaceAll('-','')+'0102030405060708';
  const service=defaults.services[i%4],items=[{id:service.id,name:service.name,quantity:i%3===0?2:1,price:null}];
  DB.raw.prepare('INSERT INTO quotes(id,reference,access_hash,customer_name,phone,address,detail_address,preferred_date,preferred_time,items,customer_note,consent_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,'CL-DEMO-'+String(i+1).padStart(4,'0'),await hash(code),names[i],'0100000000'+i,'서울특별시 중구 세종대로 110','가상 주소 · 미리보기',d,i%2?'afternoon':'morning',JSON.stringify(items),i%2?'에어컨에서 냄새가 나요. 방문 전에 연락 부탁드립니다.':'전반적인 분해 세척을 상담받고 싶어요.',now,states[i],now,now);
  if(states[i]==='approved')DB.raw.prepare('UPDATE quotes SET visit_at=?,amount=? WHERE id=?').run(d+'T10:00:00+09:00',null,id);
  DB.raw.prepare('INSERT INTO events(id,quote_id,kind,message,created_at) VALUES(?,?,?,?,?)').run(crypto.randomUUID(),id,'received','미리보기용 가상 신청입니다. 실제 고객에게 전달되지 않습니다.',now);
 }
}
async function main(){
 await mkdir(path.join(root,'.local'),{recursive:true});
 const DB=storage(path.join(root,'.local','preview.sqlite'));await seed(DB);
 const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
 const env={DB,LOCAL_PREVIEW:'1',KAKAO_REST_KEY:process.env.COOLLIFE_KAKAO_REST_KEY,ASSETS:{async fetch(request){
  let urlPath=new URL(request.url).pathname;if(urlPath==='/')return Response.redirect(new URL('/customer/',request.url),302);
  if(urlPath.endsWith('/'))urlPath+='index.html';const base=path.join(root,'public'),file=path.resolve(base,'.'+decodeURIComponent(urlPath));
  if(!file.startsWith(base+path.sep))return new Response('Not found',{status:404});
  try{return new Response(await readFile(file),{headers:{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}})}catch{return new Response('Not found',{status:404})}
 }}};
 const port=Number(process.env.PORT||8789);
 createServer(async(req,res)=>{
  try{
   const origin='http://127.0.0.1:'+port,headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);
   const request=new Request(origin+req.url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:req,duplex:'half'}:{})});
   const response=await worker.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500);res.end('Preview server error');}
 }).listen(port,'127.0.0.1',()=>console.log('Coollife local preview: http://127.0.0.1:'+port+'/customer/\nAdmin: http://127.0.0.1:'+port+'/admin/\nFictional data only. No cloud accounts or customer messages are used.'));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
