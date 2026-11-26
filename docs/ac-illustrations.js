// Small, original vector illustrations of representative shapes, not exact models.
// Keep this module independent of catalog names and prices so renamed/custom items
// never become markup or remote image URLs.
const line='#6685a4',blue='#579bc9',mint='#2aa88f';
const rect=(x,y,w,h,r,fill='#fff',stroke=line)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.8"/>`;
const path=(d,color=line,width=1.8)=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const dots=(x,y,cols,rows,spacing=5)=>Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>`<circle cx="${x+c*spacing}" cy="${y+r*spacing}" r=".9" fill="${blue}"/>`).join('')).join('');
const vent=(x,y,w,h)=>rect(x,y,w,h,2,'#8bc8dc',blue);
const grille=(x,y,w,h)=>rect(x,y,w,h,3,'#e5edf4','#bacbd9')+Array.from({length:Math.floor(h/4)-1},(_,i)=>path(`M${x+3} ${y+4+i*4}h${w-6}`,'#b2c7d8',1)).join('');
const arrow=(rotation=0)=>`<g transform="rotate(${rotation} 48 48)">${path('M48 77v10m-4-4 4 4 4-4',mint,2.4)}</g>`;
function wall(windfree=false){return rect(11,29,74,35,9,'#e6f0f8','#b9ccde')+rect(11,26,74,34,9)+path('M17 49h62',line,1.5)+vent(20,51,56,5)+(windfree?dots(22,33,11,3,5):path('M22 35h42','#d6e3ed',2))+`<circle cx="75" cy="34" r="1.6" fill="${mint}"/>`+path('M30 66q-4 5 0 10M48 66q-4 5 0 10M66 66q-4 5 0 10',mint,1.8);}
function standing(kind='general'){
 const x=kind==='commercial'?28:32,w=kind==='commercial'?40:32;
 let face=kind==='dual'?rect(36,20,9,25,4,'#67a9cc',blue)+rect(51,20,9,25,4,'#67a9cc',blue)
  :kind==='tower'?vent(35,18,4,46)+vent(57,18,4,46)+rect(43,22,10,5,2,'#d9e9f4','#d9e9f4')
  :kind==='windfree'?dots(38,23,5,10,5)+rect(42,16,12,3,1,'#90b2ca','#90b2ca')
  :grille(x+5,19,w-10,kind==='commercial'?22:18);
 return `<ellipse cx="48" cy="84" rx="${w/2+4}" ry="3" fill="#dae7f0"/>`+rect(x,10,w,73,kind==='commercial'?4:8)+face+path(`M${x+5} 72h${w-10}`,'#d1e0ec')+`<circle cx="48" cy="64" r="1.7" fill="${mint}"/>`;
}
function ceiling(kind){
 if(kind==='1way')return rect(9,31,78,29,5)+grille(16,36,64,10)+vent(17,50,62,5)+path('M29 66v12m-3-3 3 3 3-3M48 66v12m-3-3 3 3 3-3M67 66v12m-3-3 3 3 3-3',mint,2);
 if(kind==='2way')return rect(15,24,66,48,5)+grille(23,38,50,20)+vent(23,29,50,5)+vent(23,62,50,5)+arrow()+arrow(180);
 if(kind==='4way')return rect(19,19,58,58,6)+grille(31,31,34,34)+vent(31,24,34,4)+vent(31,68,34,4)+vent(24,31,4,34)+vent(68,31,4,34)+[0,90,180,270].map(arrow).join('');
 if(kind==='round')return `<circle cx="48" cy="48" r="29" fill="#fff" stroke="${line}" stroke-width="1.8"/><circle cx="48" cy="48" r="23" fill="none" stroke="#8bc8dc" stroke-width="5"/><circle cx="48" cy="48" r="16" fill="#e7eff5" stroke="#bccfdd" stroke-width="1.3"/>`+dots(40,40,5,5,4)+[0,45,90,135,180,225,270,315].map(arrow).join('');
 // Show the visible ceiling grille and a dashed outline of the concealed unit.
 return path('M8 55h80','#bed1e1',2)+`<path d="M20 30V17h56v13M31 30v9M65 30v9" fill="none" stroke="#9db4c7" stroke-width="1.7" stroke-dasharray="3 3"/>`+rect(10,39,76,18,2)+Array.from({length:4},(_,i)=>path(`M16 ${43+i*3}h64`,blue,1.5)).join('')+path('M27 66q-5 5 0 11M48 66q-5 5 0 11M69 66q-5 5 0 11',mint,2);
}
function pair(kind){return `<g transform="translate(0 13) scale(.64)">${wall(kind==='windfree')}</g><g transform="translate(52 9) scale(.65)">${standing(kind)}</g>`+path('M46 67v10m-5-5h10','#8fa8bd',1.8);}
const unknown=rect(19,29,58,42,9)+rect(30,23,17,8,3)+`<circle cx="48" cy="49" r="13" fill="#e9f4fb" stroke="${line}" stroke-width="1.6"/>`+path('M44 45a4 4 0 1 1 6 3c-2 1-2 2-2 4',blue,2)+`<circle cx="48" cy="57" r="1.3" fill="${blue}"/>`;
const generic=rect(25,14,46,67,8)+grille(31,22,34,17)+path('M37 51h22M37 59h22','#c1d4e3')+`<circle cx="48" cy="70" r="2" fill="${mint}"/>`;
const guides={
 wall:{general:[wall(),'아래쪽에 긴 바람 날개'],windfree:[wall(true),'전면에 촘촘한 작은 구멍']},
 standing:{general:[standing(),'세워 두는 일반 스탠드'],dual:[standing('dual'),'앞면에 나란한 두 송풍구'],tower:[standing('tower'),'길쭉하고 매끈한 타워 형태'],windfree:[standing('windfree'),'전면에 촘촘한 작은 구멍'],commercial:[standing('commercial'),'매장용 큰 사각 본체']},
 ceiling:{'1way':[ceiling('1way'),'긴 직사각형 · 한 방향 송풍'],'2way':[ceiling('2way'),'마주 보는 두 방향 송풍'],'4way':[ceiling('4way'),'정사각형 · 네 방향 송풍'],round:[ceiling('round'),'둥근 테두리를 따라 송풍'],duct:[ceiling('duct'),'본체는 천장 안 · 그릴만 노출']},
 twoinone:{general:[pair('general'),'일반 스탠드와 벽걸이 한 세트'],tower:[pair('tower'),'타워형과 벽걸이 한 세트'],windfree:[pair('windfree'),'무풍 스탠드와 벽걸이 한 세트']}
};
const fallback={wall:wall(),standing:standing(),ceiling:ceiling('4way'),twoinone:pair('general')};
export function variantGuide(serviceId,variantId){
 const [drawing,hint]=variantId==='unknown'?[unknown,'사진을 첨부하면 확인해 드려요.']:(Object.hasOwn(guides,serviceId)&&Object.hasOwn(guides[serviceId],variantId)?guides[serviceId][variantId]:[Object.hasOwn(fallback,serviceId)?fallback[serviceId]:generic,'사진과 모델명으로 확인해 주세요.']);
 return {hint,svg:`<span class="variant-visual" aria-hidden="true"><svg viewBox="0 0 96 96" fill="none" focusable="false">${drawing}</svg></span>`};
}
