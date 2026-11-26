// Personal account only. Secrets are written outside the repository, never logged.
const fs=require('node:fs'),path=require('node:path');
const project='coollife-minjaedy',email='kmj843337@gmail.com';
async function main(){
 const config=JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE,'.config/configstore/firebase-tools.json'),'utf8'));
 if(config.user?.email!==email)throw Error('Personal Firebase login required; refusing to use another account.');
 const auth=require(process.env.FIREBASE_AUTH_LIBRARY||'C:/Users/User/AppData/Local/npm-cache/_npx/7750544ccf494d8b/node_modules/firebase-tools/lib/auth.js');
 const token=(await auth.getAccessToken(config.tokens.refresh_token,config.loginScopes)).access_token;
 async function api(url,method='GET',data){const response=await fetch(url,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(data!==undefined?{body:JSON.stringify(data)}:{})});const result=await response.json();if(!response.ok)throw Error(method+' '+new URL(url).pathname+': '+response.status+' '+(result.error?.message||'API error'));return result;}
 const user=await api('https://www.googleapis.com/oauth2/v2/userinfo');if(user.email!==email)throw Error('Token identity did not match the personal Gmail.');
 console.log('Verified personal Firebase identity: '+user.email);
 async function operation(origin,result){if(!result?.name||!result.name.includes('operations/'))return result;for(let i=0;i<100;i++){const current=await api(origin+'/'+result.name);if(current.done){if(current.error)throw Error(current.error.message);return current.response;}await new Promise(resolve=>setTimeout(resolve,2000));}throw Error('Operation is still running: '+result.name);}
 const found=await api('https://cloudresourcemanager.googleapis.com/v1/projects?filter='+encodeURIComponent('projectId:'+project));
 if(!found.projects?.some(p=>p.projectId===project)){console.log('Creating separate personal project: '+project);await operation('https://cloudresourcemanager.googleapis.com/v1',await api('https://cloudresourcemanager.googleapis.com/v1/projects','POST',{projectId:project,name:'Coollife'}));}
 const linked=await api('https://firebase.googleapis.com/v1beta1/projects');
 if(!linked.results?.some(p=>p.projectId===project)){console.log('Adding Firebase without linking a billing account');await operation('https://firebase.googleapis.com/v1beta1',await api('https://firebase.googleapis.com/v1beta1/projects/'+project+':addFirebase','POST',{}));}
 const base='https://firebasedatabase.googleapis.com/v1beta/projects/'+project,listed=await api(base+'/locations/-/instances');
 let instance=listed.instances?.find(x=>x.type==='DEFAULT_DATABASE'||x.name.includes(project+'-default-rtdb'));
 if(!instance){console.log('Creating a dedicated Realtime Database');instance=await api(base+'/locations/asia-southeast1/instances?databaseId='+project+'-default-rtdb','POST',{type:'DEFAULT_DATABASE'});}
 const databaseURL=instance.databaseUrl||'https://'+project+'-default-rtdb.asia-southeast1.firebasedatabase.app';
 const database=databaseURL.replace(/\/$/,'');
 // Only intentionally public prices and business contact information can be read by customers.
 await api(database+'/.settings/rules.json','PUT',{rules:{'.read':false,'.write':false,public:{catalog:{'.read':true}}}});
 const service='coollife-server@'+project+'.iam.gserviceaccount.com',resource='projects/'+project+'/serviceAccounts/'+service;
 const accounts=await api('https://iam.googleapis.com/v1/projects/'+project+'/serviceAccounts');
 if(!accounts.accounts?.some(a=>a.email===service))await api('https://iam.googleapis.com/v1/projects/'+project+'/serviceAccounts','POST',{accountId:'coollife-server',serviceAccount:{displayName:'Coollife catalog server'}});
 const policy=await api('https://cloudresourcemanager.googleapis.com/v1/projects/'+project+':getIamPolicy','POST',{}),member='serviceAccount:'+service,role='roles/firebasedatabase.admin';policy.bindings??=[];let binding=policy.bindings.find(b=>b.role===role);
 if(!binding){binding={role,members:[]};policy.bindings.push(binding);}if(!binding.members.includes(member)){binding.members.push(member);await api('https://cloudresourcemanager.googleapis.com/v1/projects/'+project+':setIamPolicy','POST',{policy});}
 const folder=path.join(process.env.USERPROFILE,'.codex/private/coollife');fs.mkdirSync(folder,{recursive:true});
 const secret=path.join(folder,'firebase-account.json');if(!fs.existsSync(secret)){const key=await api('https://iam.googleapis.com/v1/'+resource+'/keys','POST',{privateKeyType:'TYPE_GOOGLE_CREDENTIALS_FILE'});fs.writeFileSync(secret,Buffer.from(key.privateKeyData,'base64'));}
 const {defaults}=await import('../server/worker.mjs');const current=await api(database+'/public/catalog.json');if(!current)await api(database+'/public/catalog.json','PUT',defaults);
 fs.mkdirSync(path.join(__dirname,'../.local'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../.local/firebase-setup.json'),JSON.stringify({project,databaseURL:database},null,2));
 console.log('Dedicated Firebase ready: '+project+' | '+database);console.log('Only public catalog reads are enabled. Server key stored privately; no existing apps modified.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
