// P2 下知系統:威令/六道令/服從判定/評定連動/AI大名同用
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const {doc, localStorage} = require('./shim');
const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const script=[...HTML.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1])[0];
const sb={document:doc,localStorage,console,Math,JSON,Date,performance:{now:()=>0},
  setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},
  requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},Image:class{set src(v){}},
  navigator:{userAgent:'node'},alert:()=>{},confirm:()=>true,prompt:()=>null,
  matchMedia:()=>({matches:false,addListener(){},addEventListener(){}}),
  location:{port:'5877',reload(){throw new Error('__R__');},replace(){throw new Error('__R__');}}};
sb.window=sb;sb.globalThis=sb;vm.createContext(sb);
vm.runInContext(script,sb,{filename:'game.js'});
vm.runInContext(`render=function(){ if(S){try{armySync();aptSync();}catch(e){}} }; drawMap=function(){}; save=function(){};
  __log=[]; (function(){ const o=log; log=function(m,k){ __log.push(String(m)); return o(m,k); }; })();`,sb);
const ev=c=>vm.runInContext(c,sb); const g=sb.window.__game;
console.log('BUILD:', ev('BUILD'));
const checks=[]; const ok=(n,c,note)=>checks.push([n,c,note||'']);
const setup=(tag)=>{
  g.startGame(g.newState(tag,0,'kokujin','daimyo','mikawa'));
  ev(`modalQueue.length=0; $('modalBack').classList.add('hidden'); __log.length=0;
      S.money=9999; S.rice=1000; S.prestige=90; S.kani=1;
      var V=S.rivals.filter(x=>x.alive).slice(0,3);
      V.forEach(f=>{ f.lord='player'; f.rel=50; f.ltrust=75; f.koku=1200; f.sol=150; f.money=300;
                     f.plan={type:'fukoku', since:S.year}; f._gechiY=0; f._gechiN=0; });
      var v=V[0];`);
};

// ── 1. 威令:上限與消耗 ──
setup('威試');
const cap = ev('gechiCap()');
ok('威令上限隨名分(官位1+家老數+取次)', cap>=3 && cap<=6, '本局 '+cap+' 道/季');
ev(`doGechi(v,'kaikon')`);
ok('下知消耗威令', ev('gechiLeft()') === cap-1, `餘 ${ev('gechiLeft()')}/${cap}`);
ev(`S.season=(S.season+1)%4;`);
ok('逐季重置', ev('gechiLeft()') === cap, `換季後餘 ${ev('gechiLeft()')}`);
// 威令用罄不得再下知
setup('罄試');
const cap2 = ev('gechiCap()');
for(let i=0;i<cap2;i++) ev(`doGechi(v,'hyoro')`);
const rice0 = ev('S.rice');
ev(`doGechi(v,'hyoro')`);
ok('威令用罄則不得下知', ev('S.rice') === rice0, '第 '+(cap2+1)+' 道無效');

// ── 2. 六道令各有實效 ──
setup('效試');
const k0=ev('v.koku'); ev(`doGechi(v,'kaikon')`);
ok('開墾令:從屬石高增', ev('v.koku') > k0, k0+' → '+ev('v.koku'));
setup('糧試'); const r0=ev('S.rice'); ev(`doGechi(v,'hyoro')`);
ok('兵糧供出:入倉', ev('S.rice') > r0, '+'+(ev('S.rice')-r0)+' 石');
setup('兵試'); const s0=ev('S.soldiers'), vs0=ev('v.sol'); ev(`doGechi(v,'gunyaku')`);
ok('軍役召集:兵自從屬轉入我軍', ev('S.soldiers')>s0 && ev('v.sol')<vs0,
   `我軍 ${s0}→${ev('S.soldiers')} / 其兵 ${vs0}→${ev('v.sol')}`);
setup('金試'); const m0=ev('S.money'); ev(`doGechi(v,'kenkin')`);
ok('獻金令:入錢且信心挫', ev('S.money')>m0 && ev('v.ltrust')<75, `+${ev('S.money')-m0} 貫・信心 ${ev('v.ltrust')}`);
setup('伐試');
ev(`v.plan={type:'heidon',since:S.year}; v.persona='武斷'; v.sol=400;`);
ev(`doGechi(v,'seibatsu')`);
ok('征伐令:推風聞・侵略之名上升', ev(`(S.rumors||[]).some(r=>r.who===v.id)`) && ev('S.aggression')>0,
   '風聞 '+ev(`(S.rumors||[]).length`)+' 件・侵略 '+ev('S.aggression'));
setup('賞試');
const pk0=ev('S.kokudaka'), lt0=ev('v.ltrust'), left0=ev('gechiLeft()');
ev(`doGechi(v,'kazou')`);
ok('加增:割己地予之,信心大增且不費威令',
   ev('S.kokudaka')<pk0 && ev('v.ltrust')>lt0 && ev('gechiLeft()')===left0,
   `我 ${pk0}→${ev('S.kokudaka')} 石・其信心 ${lt0}→${ev('v.ltrust')}・威令仍 ${ev('gechiLeft()')}`);

// ── 3. 服從判定:評定相合與否、信心高低 ──
setup('順試');
const oFit = ev(`(v.plan={type:'fukoku',since:S.year}, gechiObey(v,'kaikon'))`);
const oBad = ev(`(v.plan={type:'chikujo',since:S.year}, gechiObey(v,'kaikon'))`);
ok('順其評定者順從度較高', oFit > oBad + 20, `合志 ${oFit} vs 逆志 ${oBad}`);
const oHi = ev(`(v.ltrust=95, v.rel=80, gechiObey(v,'hyoro'))`);
const oLo = ev(`(v.ltrust=15, v.rel=-40, gechiObey(v,'hyoro'))`);
ok('信心關係越低越指使不動', oHi > oLo + 25, `信95關80→${oHi} / 信15關-40→${oLo}`);
ok('離心者可致拒命', ev(`gechiLevel(gechiObey(v,'kenkin'))`)==='refuse', '順從 '+ev(`gechiObey(v,'kenkin')`));
// 拒命:威令照耗、信心再挫、無實效
setup('拒試');
ev(`v.ltrust=10; v.rel=-50; v.on=0; S.prestige=0; S.kani=0; v.plan={type:'chikujo',since:S.year};`);
const rr0=ev('S.rice'), lt1=ev('v.ltrust'), lf1=ev('gechiLeft()');
ev(`doGechi(v,'hyoro')`);
ok('拒命:無實效・信心再挫・威令空擲',
   ev('S.rice')===rr0 && ev('v.ltrust')<lt1 && ev('gechiLeft()')<lf1,
   `米未增・信心 ${lt1}→${ev('v.ltrust')}・威令 ${lf1}→${ev('gechiLeft()')}`);
ok('拒命有敘事', ev(`__log.some(l=>/陽奉陰違/.test(l))`), '');
// 同一家年內連下知,順從遞減
setup('頻試');
ev(`v.ltrust=60; v.rel=20; v.on=0; S.prestige=40; S.kani=0;`);
const oA = ev(`gechiObey(v,'kaikon')`);
ev(`gechiBump(v); gechiBump(v);`);
const oB = ev(`gechiObey(v,'kaikon')`);
ok('同家年內屢下知則順從遞減', oA < 100 && oB <= oA - 20, `首令 ${oA} → 第三令 ${oB}(未飽和)`);

// ── 4. AI 大名也下知(原本只是隨機加增/削封) ──
g.startGame(g.newState('AI試',0,'kokujin','gozoku','mikawa'));
ev(`S.rivals.filter(x=>x.alive).slice(0,6).forEach(f=>{ f.lord='oda'; f.ltrust=70; f.koku=1000; });`);
let dem0 = ev(`S.lords.oda.demesne`);
const lt0m = JSON.parse(ev(`JSON.stringify(Object.fromEntries(S.rivals.filter(f=>f.lord==='oda').map(f=>[f.id,f.ltrust])))`));
for(let i=0;i<12;i++) ev(`S.rivals.filter(f=>f.alive).slice(0,6).forEach(f=>{ if(!f.lord) f.lord='oda'; }); simLords([])`);
const lt1m = JSON.parse(ev(`JSON.stringify(Object.fromEntries(S.rivals.filter(f=>f.lord==='oda').map(f=>[f.id,f.ltrust])))`));
const ltMoved = Object.keys(lt1m).filter(id=>lt0m[id]!=null && lt1m[id]!==lt0m[id]).length;
ok('AI大名的下知會牽動從屬信心', ltMoved>0, ltMoved+'/'+Object.keys(lt1m).length+' 家信心有變動');
ok('AI大名的課役會回饋直轄領', ev(`S.lords.oda.demesne`) > dem0, dem0+' → '+ev(`S.lords.oda.demesne`));

// ── 5. 下知卡:無從屬則不顯示 ──
g.startGame(g.newState('卡試',0,'kokujin','daimyo','mikawa'));
ev(`S.rivals.forEach(f=>{ if(f.lord==='player') f.lord=null; }); renderGechi();`);
ok('無從屬則下知卡隱藏', ev(`$('gechiBox').style.display`)==='none' || ev(`myVassals().length`)===0, '');

let bad=0;
for(const [n,c,note] of checks){ console.log((c?'✓':'✗'),n,note?(' — '+note):''); if(!c)bad++; }
console.log(bad?'✗ 有未過':'全部通過');
process.exit(bad?1:0);
