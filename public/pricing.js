export const MAX_AMOUNT=10000000;
const subtypeDefaults={
 wall:[['general','일반형'],['windfree','무풍형']],
 standing:[['general','일반형'],['dual','듀얼형'],['tower','타워형'],['windfree','무풍형'],['commercial','업소용·대형']],
 ceiling:[['1way','1WAY · 1방향'],['2way','2WAY · 2방향'],['4way','4WAY · 4방향'],['round','360°'],['duct','천장 매립덕트형']],
 twoinone:[['general','일반 스탠드 + 벽걸이'],['tower','타워형 스탠드 + 벽걸이'],['windfree','무풍 스탠드 + 벽걸이']]
};
export const UNKNOWN_VARIANT='unknown';
export const UNKNOWN_LABEL='종류를 모르겠어요';
export function serviceVariants(service){return Array.isArray(service?.variants)?service.variants:(subtypeDefaults[service?.id]||[['general','기본형']]).map(([id,name])=>({id,name,price:null,active:true}));}
export const withVariants=catalog=>({...catalog,services:catalog.services.map(s=>({...s,variants:serviceVariants(s)}))});
export const itemKey=(id,variantId)=>id+':'+(variantId||'');
export const itemUnit=id=>id==='twoinone'?'세트':'대';
export function catalogTotal(items,services){
 const lines=items.map(item=>{const service=services.find(s=>s.id===item.id),variant=item.variantId&&service?serviceVariants(service).find(v=>v.id===item.variantId):null,price=item.variantId?variant?.price:service?.price;const valid=!!service&&Number.isInteger(price)&&price>=0&&price<=MAX_AMOUNT&&Number.isInteger(item.quantity)&&item.quantity>0&&item.quantity<=20;return {name:item.variantId?(variant?service.name+' · '+variant.name:item.name):(service?.name||item.name),quantity:item.quantity,unit:itemUnit(item.id),price:valid?price:null,total:valid?price*item.quantity:null};});
 const complete=lines.length>0&&lines.every(line=>line.total!==null);
 return {lines,complete,total:complete?lines.reduce((sum,line)=>sum+line.total,0):null};
}
export function validDiscount(preset){return preset&&['fixed','percent'].includes(preset.type)&&Number.isInteger(preset.value)&&preset.value>0&&preset.value<=(preset.type==='percent'?100:MAX_AMOUNT);}
export function calculateAmount(base,preset=null){
 if(!Number.isInteger(base)||base<0||base>MAX_AMOUNT)throw Error('기본 금액은 0~10,000,000원으로 입력해 주세요.');
 if(preset&&!validDiscount(preset))throw Error('할인 금액을 확인해 주세요.');
 const discount=preset?Math.min(base,preset.type==='percent'?Math.floor(base*preset.value/100):preset.value):0;
 return {base,discount,total:base-discount};
}
