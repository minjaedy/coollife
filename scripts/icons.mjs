import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {Resvg} from '@resvg/resvg-js';
const source=await readFile(new URL('../public/icon.svg',import.meta.url),'utf8');
await mkdir(new URL('../public/icons/',import.meta.url),{recursive:true});
for(const size of [180,192,512])await writeFile(new URL(`../public/icons/icon-${size}.png`,import.meta.url),new Resvg(source,{fitTo:{mode:'width',value:size}}).render().asPng());
const maskable=source.replace('rx="44"','rx="0"').replace('translate(24 24) scale(1.5)','translate(34 34) scale(1.3)');
await writeFile(new URL('../public/icons/maskable-512.png',import.meta.url),new Resvg(maskable,{fitTo:{mode:'width',value:512}}).render().asPng());
