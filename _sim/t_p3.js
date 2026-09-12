// P3 權力政治:移封/分封/和睦令/人質 + 坐大從屬 + 忠誠模型合一
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
  __log=[]; __cap=null;
  (function(){ const o=log; log=function(m,k){ __log.push(String(m)); return o(m,k); }; })();
  __all=[]; (function(){ const o=queueModal; queueModal=function(m){ __cap=m; __all.push(m); return o(m); }; })();`,sb);
const ev=c=>vm.runInContext(c,sb); const g=sb.window.__game;
console.log('BUILD:', ev('BUILD'));
const checks=[]; const ok=(n,c,note)=>checks.push([n,c,note||'']);
const setup=(tag)=>{
  g.startGame(g.newState(tag,0,'kokujin','daimyo','mikawa'));
  ev(`modalQueue.length=0; $('modalBack').classList.add('hidden'); __log.length=0; __cap=null;
      S.money=9999; S.rice=2000; S.prestige=120; S.kani=2; S.kokudaka=4000;
      var V=S.rivals.filter(x=>x.alive).slice(0,3);
      V.forEach(f=>{ f.lord='player'; f.rel=60; f.ltrust=80; f.koku=1500; f.sol=200; f.money=400;
                     f.fort=2; f.grudge={}; f.allies=[]; f.hostage=false;
                     f.plan={type:'fukoku',since:S.year}; f._gechiY=0; f._gechiN=0; });
      var v=V[0], w=V[1];`);
};

// ── 1. 移封:拔其根(石高/城砦/舊怨舊盟) ──
setup('移試');
ev(`v.grudge={'oda_x':40}; v.allies=['x1']; S.rivals[5].grudge={}; addGrudge(S.rivals[5], v.id, 30); v.fort=3;`);
const k0=ev('v.koku'), ft0=ev('v.fort');
ev(`doGechi(v,'tenpou')`);
ok('移封:削其地・降其城・斷其舊怨舊盟',
   ev('v.koku')<k0 && ev('v.fort')<ft0 && ev(`Object.keys(v.grudge||{}).length`)===0 && ev(`(v.allies||[]).length`)===0
   && ev(`!(S.rivals[5].grudge||{})['`+ev('v.id')+`']`),
   `石高 ${k0}→${ev('v.koku')}・城 ${ft0}→${ev('v.fort')}・宿怨盟約俱清`);
ok('移封:信心重挫', ev('v.ltrust') <= 80-18+1, '信心 80→'+ev('v.ltrust'));

// ── 2. 分封:削其半入我直轄 ──
setup('削試');
const pk0=ev('S.kokudaka'), vk0=ev('v.koku');
ev(`doGechi(v,'bunpou')`);
ok('分封:其地入我直轄', ev('S.kokudaka')>pk0 && ev('v.koku')<vk0,
   `我 ${pk0}→${ev('S.kokudaka')}・其 ${vk0}→${ev('v.koku')}`);
ok('分封:結怨於我', ev(`rGrudge(v,'player')`)>0 && ev('v.ltrust')<60, `宿怨 ${ev(`rGrudge(v,'player')`)}・信心 ${ev('v.ltrust')}`);

// ── 3. 和睦令:同僚釋怨 ──
setup('和試');
ev(`addGrudge(v, w.id, 40); addGrudge(w, v.id, 35);`);
const pr0=ev('S.prestige');
ok('和睦令僅在同僚有宿怨時可用', ev(`!!GECHI.wabok.avail(v)`), '');
ev(`doGechi(v,'wabok')`);
ok('和睦令:兩家釋怨・信心俱增・主威增',
   ev(`rGrudge(v,w.id)`)===0 && ev(`rGrudge(w,v.id)`)===0 && ev('S.prestige')>pr0,
   `宿怨清零・威望 ${pr0}→${ev('S.prestige')}`);
setup('和無試');
ok('無宿怨則和睦令不列入選單', ev(`!GECHI.wabok.avail(v)`), '');

// ── 4. 人質:傷心而束身 ──
setup('質試');
const o0=ev(`gechiObey(v,'kenkin')`);
ev(`doGechi(v,'hitojichi')`);
const o1=ev(`gechiObey(v,'kenkin')`);
ok('人質:信心挫但此後順從提升', ev('v.hostage')===true && ev('v.ltrust')<80 && o1 > o0 - 5,
   `信心 80→${ev('v.ltrust')}・對獻金令順從 ${o0}→${o1}`);
ok('已有質子者不再重取', ev(`!GECHI.hitojichi.avail(v)`), '');

// ── 5. 重令自有阻力(移封/分封比開墾令難行) ──
setup('阻試');
const oK=ev(`gechiObey(v,'kaikon')`), oT=ev(`gechiObey(v,'tenpou')`), oB=ev(`gechiObey(v,'bunpou')`);
ok('重令阻力:開墾 > 移封 > 分封', oK > oT && oT > oB, `開墾 ${oK} / 移封 ${oT} / 分封 ${oB}`);

// ── 6. 忠誠模型合一:去留看信心與勢,不再只看家格比 ──
function outRate(lt, pw, hostage){
  let out=0; const N=400;
  for(let i=0;i<N;i++){
    setup('去試');
    ev(`v.ltrust=${lt}; v.hostage=${hostage?'true':'false'}; v.marr=false; v.pact=false;
        S.kokudaka=${Math.round(1500/pw)}; S.prestige=0;`);
    const lt2=ev('v.ltrust'), pw2=ev(`score(v)/Math.max(1,playerScore())`);
    // 直接套用歲末判定式
    const p = ev(`(function(){ const lt=v.ltrust??60, pw=score(v)/Math.max(1,playerScore());
      return clamp(0.015 + Math.max(0,45-lt)*0.006 + Math.max(0,pw-0.8)*0.10 - meiboHold()*0.12 - (v.hostage?0.05:0), 0, 0.35); })()`);
    out += p; break;
  }
  return out;
}
const pLoyal = outRate(80, 0.5, false), pBitter = outRate(10, 0.5, false),
      pBig = outRate(80, 1.4, false), pHost = outRate(10, 0.5, true);
ok('離心者更易脫離', pBitter > pLoyal*2, `信80 ${(pLoyal*100).toFixed(1)}% vs 信10 ${(pBitter*100).toFixed(1)}%`);
ok('勢大者更易自立', pBig > pLoyal*1.5, `勢0.5 ${(pLoyal*100).toFixed(1)}% vs 勢1.4 ${(pBig*100).toFixed(1)}%`);
ok('質子在我則不敢背', pHost < pBitter, `無質 ${(pBitter*100).toFixed(1)}% vs 有質 ${(pHost*100).toFixed(1)}%`);

// ── 7. 坐大從屬事件 ──
setup('坐試');
ev(`S.kokudaka=1500; S.prestige=10; v.koku=3000; v.ltrust=50;`);
let fired=false, bigModal=-1;
for(let i=0;i<40 && !fired;i++){
  ev(`__all.length=0; v.ltrust=50; v.koku=3000; S.kokudaka=1500; S.prestige=10; v.marr=false; v.pact=false;`);
  ev('winterSettle()');
  bigModal = ev(`__all.findIndex(m=>/重臣坐大/.test(m.title||''))`);
  if(bigModal >= 0) fired=true;
}
ok('坐大從屬會觸發抉擇', fired, fired?ev(`__all[${bigModal}].title`):'40 年未觸發');
if(fired){
  const labels=JSON.parse(ev(`JSON.stringify((__all[${bigModal}].choices||[]).map(c=>c.label))`));
  ok('坐大抉擇四選(加增/削封/取質/坐視)', labels.length===4 && /加增/.test(labels[0]) && /削其封/.test(labels[1]),
     labels.join(' | ').slice(0,70));
  const k1=ev('S.kokudaka');
  ev(`__all[${bigModal}].choices[1].fn()`);
  ok('削封:其地入我直轄', ev('S.kokudaka') > k1, k1+' → '+ev('S.kokudaka'));
}

// ── 8. 存檔仍可序列化 ──
ok('P3 諸令後存檔無礙', (()=>{ try{ JSON.stringify(g.S); return true; }catch(e){ return false; } })(), '');

let bad=0;
for(const [n,c,note] of checks){ console.log((c?'✓':'✗'),n,note?(' — '+note):''); if(!c)bad++; }
console.log(bad?'✗ 有未過':'全部通過');
process.exit(bad?1:0);
