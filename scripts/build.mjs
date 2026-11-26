import {cp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await import('./icons.mjs');
await mkdir(new URL('../docs/',import.meta.url),{recursive:true});
await cp(new URL('../public/',import.meta.url),new URL('../docs/',import.meta.url),{recursive:true});
const digest=async file=>createHash('sha256').update(await readFile(new URL('../docs/'+file,import.meta.url))).digest('hex').slice(0,12);
const pricingVersion=await digest('pricing.js'),illustrationVersion=await digest('ac-illustrations.js'),iconVersion=await digest('icon.svg');
const appFile=new URL('../docs/app.js',import.meta.url);
await writeFile(appFile,(await readFile(appFile,'utf8')).replace("'./pricing.js'","'./pricing.js?v="+pricingVersion+"'").replace("'./ac-illustrations.js'","'./ac-illustrations.js?v="+illustrationVersion+"'").replace('/brand-mark.svg"','/brand-mark.svg?v='+iconVersion+'"'));
const scriptVersion=await digest('app.js'),styleVersion=await digest('style.css');
for(const page of ['customer','admin']){
 const file=new URL('../docs/'+page+'/index.html',import.meta.url);
 const content=(await readFile(file,'utf8')).replace('../app.js"','../app.js?v='+scriptVersion+'"').replace('../style.css"','../style.css?v='+styleVersion+'"').replaceAll('../icon.svg"','../icon.svg?v='+iconVersion+'"').replace('../icons/icon-180.png"','../icons/icon-180.png?v='+iconVersion+'"').replace('./manifest.webmanifest"','./manifest.webmanifest?v='+iconVersion+'"');
 await writeFile(file,content);
 const manifestFile=new URL('../docs/'+page+'/manifest.webmanifest',import.meta.url),manifest=JSON.parse(await readFile(manifestFile,'utf8'));
 for(const icon of manifest.icons)icon.src+='?v='+iconVersion;
 await writeFile(manifestFile,JSON.stringify(manifest,null,2)+'\n');
}
await writeFile(new URL('../docs/version.json',import.meta.url),JSON.stringify({version:scriptVersion}));
await writeFile(new URL('../docs/.nojekyll',import.meta.url),'');
console.log('GitHub Pages files generated in docs/');
