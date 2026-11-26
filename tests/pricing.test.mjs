import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogTotal,calculateAmount} from '../public/pricing.js';

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
