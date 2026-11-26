export const MAX_AMOUNT=10000000;
export function catalogTotal(items,services){
 const lines=items.map(item=>{const service=services.find(s=>s.id===item.id),price=service?.price;const valid=Number.isInteger(price)&&price>=0&&price<=MAX_AMOUNT&&Number.isInteger(item.quantity)&&item.quantity>0&&item.quantity<=20;return {name:service?.name||item.name,quantity:item.quantity,price:valid?price:null,total:valid?price*item.quantity:null};});
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
