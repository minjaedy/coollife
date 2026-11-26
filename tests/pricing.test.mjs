import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogTotal,calculateAmount,withVariants} from '../public/pricing.js';

test('quote totals use current catalog prices and quantities without treating missing prices as free',()=>{
 const items=[{id:'wall',quantity:2},{id:'stand',quantity:1}];
 assert.equal(catalogTotal(items,[{id:'wall',price:80000},{id:'stand',price:120000}]).total,280000);
 assert.equal(catalogTotal(items,[{id:'wall',price:80000},{id:'stand',price:null}]).total,null);
 assert.equal(catalogTotal(items,[{id:'wall',price:80000}]).complete,false);
 assert.equal(catalogTotal([{id:'wall',quantity:1}],[{id:'wall',price:0}]).total,0);
});
test('discounts round down to whole won, never exceed the base, and always calculate from the base',()=>{
 const percent={type:'percent',value:10},fixed={type:'fixed',value:10000};
 assert.deepEqual(calculateAmount(80001,percent),{base:80001,discount:8000,total:72001});
 assert.equal(calculateAmount(8000,fixed).total,0);
 assert.equal(calculateAmount(160000,percent).total,144000);
 assert.equal(calculateAmount(160000,fixed).total,150000);
 assert.equal(calculateAmount(160000).total,160000);
 for(const base of [-1,1.5,10000001,NaN])assert.throws(()=>calculateAmount(base));
 assert.throws(()=>calculateAmount(80000,{type:'percent',value:101}));
});

test('subtype totals use their own current prices and keep unknown types unpriced',()=>{
 const source={services:[{id:'ceiling',name:'천장형',price:99999}]},catalog=withVariants(source);
 assert.equal(source.services[0].variants,undefined);
 const service=catalog.services[0];
 assert.deepEqual(service.variants.map(v=>v.id),['1way','2way','4way','round','duct']);
 assert.equal(service.variants.find(v=>v.id==='round').name,'360°');
 assert.ok(service.variants.every(v=>v.price===null));
 service.variants[0].price=80000;service.variants[2].price=120000;
 const items=[{id:'ceiling',variantId:'1way',quantity:2},{id:'ceiling',variantId:'4way',quantity:1}];
 assert.equal(catalogTotal(items,catalog.services).total,280000);
 service.variants[0].price=90000;service.variants[0].active=false;
 assert.equal(catalogTotal(items,catalog.services).total,300000);
 for(const variantId of ['unknown','deleted','2way'])assert.equal(catalogTotal([{id:'ceiling',variantId,quantity:1}],catalog.services).total,null);
 assert.equal(catalogTotal(items,[]).complete,false);
 assert.equal(catalogTotal([{id:'ceiling',quantity:1}],catalog.services).total,99999);
 service.variants[0].price=0;
 assert.equal(catalogTotal([items[0]],catalog.services).total,0);
});
