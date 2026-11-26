import {cp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await mkdir(new URL('../docs/',import.meta.url),{recursive:true});
await cp(new URL('../public/',import.meta.url),new URL('../docs/',import.meta.url),{recursive:true});
const digest=async file=>createHash('sha256').update(await readFile(new URL('../public/'+file,import.meta.url))).digest('hex').slice(0,12);
const scriptVersion=await digest('app.js'),styleVersion=await digest('style.css');
for(const page of ['customer','admin']){
 const file=new URL('../docs/'+page+'/index.html',import.meta.url);
 const content=(await readFile(file,'utf8')).replace('../app.js"','../app.js?v='+scriptVersion+'"').replace('../style.css"','../style.css?v='+styleVersion+'"');
 await writeFile(file,content);
}
await writeFile(new URL('../docs/.nojekyll',import.meta.url),'');
console.log('GitHub Pages files generated in docs/');
