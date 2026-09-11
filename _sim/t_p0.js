// P0 回歸:大名情勢卡崩潰 / 課役無限迴圈 / ltrust 初始化 / 從屬死方針
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
  __cap=null; (function(){ const o=queueModal; queueModal=function(m){ __cap=m; return o(m); }; })();`,sb);
const ev=c=>vm.runInContext(c,sb); const g=sb.window.__game;
console.log('BUILD:', ev('BUILD'));
const checks=[]; const ok=(n,c,note)=>checks.push([n,c,note||'']);

// ── 1. 大名情勢卡:不再出現「絕緣自立」,亦不崩潰 ──
g.startGame(g.newState('P0試',0,'kokujin','daimyo','mikawa'));
ev(`modalQueue.length=0; $('modalBack').classList.add('hidden');`);
let bad=0, labelsAll=[];
for(const k of ['imagawa','oda','takeda','saito','nagao']){
  ev(`openLord('${k}')`);
  const labels=JSON.parse(ev(`JSON.stringify((__cap.choices||[]).map(c=>c.label))`));
  labelsAll.push(...labels);
  if(labels.some(l=>/絕緣自立|謀反決行/.test(l))) bad++;
}
ok('大名情勢卡無「絕緣/謀反」選項', bad===0, bad?bad+' 家仍有':'五家皆無');
// 縱使誤入 breakAway 亦不炸
let crashed=false;
try{ ev(`breakAway()`); }catch(e){ crashed=true; }
ok('breakAway 無主時守門不炸', !crashed);
// 臣從玩家仍看得到「絕緣自立」
g.startGame(g.newState('P0臣',0,'kokujin','gozoku','mikawa'));
ev(`modalQueue.length=0; $('modalBack').classList.add('hidden'); S.allegiance='imagawa'; S.lords.imagawa.favor=30;`);
ev(`openLord('imagawa')`);
const vLabels=JSON.parse(ev(`JSON.stringify((__cap.choices||[]).map(c=>c.label))`));
ok('臣從者仍可絕緣自立', vLabels.some(l=>/絕緣自立/.test(l)), vLabels.join('|').slice(0,60));
ev(`openLord('oda')`);
const oLabels=JSON.parse(ev(`JSON.stringify((__cap.choices||[]).map(c=>c.label))`));
ok('對非主家之大名顯示「請求臣從」', oLabels.some(l=>/請求臣從/.test(l)), oLabels.join('|').slice(0,60));

// ── 2. 課役/安堵:一年一度,無限迴圈已堵 ──
g.startGame(g.newState('P0役',0,'kokujin','gozoku','mikawa'));
ev(`modalQueue.length=0; $('modalBack').classList.add('hidden');
    S.money=99999; S.rice=0; S.prestige=200; S.kani=2;
    var __v=S.rivals.find(x=>x.alive); __v.lord='player'; __v.koku=2000; __v.rel=60;`);
const rice0=ev('S.rice');
ev(`openRival(__v.id)`);
const kaeki=ev(`(__cap.choices||[]).findIndex(c=>/課役/.test(c.label))`);
for(let i=0;i<5;i++) ev(`__cap.choices[${kaeki}].fn()`);
const riceGain=ev('S.rice')-rice0;
ok('課役一年一度(五連點只入帳一次)', riceGain===100, '入米 '+riceGain+'(單次應為 100)');
const ando=ev(`(__cap.choices||[]).findIndex(c=>/所領安堵/.test(c.label))`);
const rel0=ev('__v.rel');
for(let i=0;i<5;i++) ev(`__cap.choices[${ando}].fn()`);
ok('安堵一年一度', ev('__v.rel')-rel0===12, '關係 +'+(ev('__v.rel')-rel0));
// 跨年後可再課
ev(`S.year += 1;`);
ev(`openRival(__v.id)`);
const kaeki2=ev(`(__cap.choices||[]).findIndex(c=>/課役/.test(c.label))`);
const rice1=ev('S.rice'); ev(`__cap.choices[${kaeki2}].fn()`);
ok('翌年可再課役', ev('S.rice')-rice1===100, '入米 '+(ev('S.rice')-rice1));

// ── 3. ltrust 初始化與統一預設 ──
g.startGame(g.newState('P0信',0,'kokujin','gozoku','mikawa'));
ok('新局全眾 ltrust=60', ev(`S.rivals.every(f=>f.ltrust===60)`), '未初始化數 '+ev(`S.rivals.filter(f=>f.ltrust==null).length`));
ev(`S.rivals.forEach(f=>{ delete f.ltrust; }); S.rivals[0].lord='oda'; S.rivals[0].ltrust=20;`);
ev(`simRivalSeason()`);   // rivalEndow 應補齊舊檔
ok('舊檔缺欄位者自動補齊', ev(`S.rivals.every(f=>f.ltrust!=null)`), '');
const before=ev('S.rivals[0].ltrust');
ev(`S.rivals[0].lord='oda'; simRivalActions([]);`);
ok('信心年年向 60 回復(不再被 undefined 守衛卡住)', ev('S.rivals[0].ltrust') > before, before+' → '+ev('S.rivals[0].ltrust'));
ok('無 50/60 雙預設殘留', !/ltrust!=null\?f\.ltrust:50|ltrust != null \? f\.ltrust : 50/.test(HTML), '');

// ── 4. 玩家從屬不再採「併吞」死方針;攀附有實效 ──
g.startGame(g.newState('P0屬',0,'kokujin','gozoku','mikawa'));
ev(`S.rivals.forEach(f=>{ if(f.alive) f.lord='player'; });`);
let heidonN=0;
for(let i=0;i<400;i++){
  ev(`(function(){ const f=S.rivals.filter(x=>x.alive)[${'' }0]; })()`);
  ev(`S.rivals.filter(f=>f.alive).forEach(f=>{ f._sitAt=-1; rivalPlan(f, null); });`);
  heidonN += ev(`S.rivals.filter(f=>f.alive && f.plan && f.plan.type==='heidon').length`);
  if(heidonN) break;
}
ok('玩家從屬不再採「併吞」方針', heidonN===0, heidonN?('仍有 '+heidonN+' 家'):'400 輪評定 0 例');
// 攀附對玩家從屬有實效
ev(`var __w=S.rivals.find(x=>x.alive); __w.lord='player'; __w.plan={type:'kizoku',since:S.year}; __w.money=500; __w.rel=0; __w.ltrust=50;`);
let moved=false;
for(let i=0;i<30 && !moved;i++){ ev(`__w.money=500; __w.plan={type:'kizoku',since:S.year}; simRivalActions([]);`); moved = ev('__w.rel')>0 || ev('__w.ltrust')>50; }
ok('攀附方針對玩家從屬不再空轉', moved, '關係 '+ev('__w.rel')+'・信心 '+ev('__w.ltrust'));

// ── 5. 從屬員額上限 ──
g.startGame(g.newState('P0額',0,'kokujin','gozoku','mikawa'));
ev(`S.prestige=10; S.kani=0;`);
const cap0=ev('vassalCap()');
ev(`S.prestige=120; S.kani=2;`);
const cap1=ev('vassalCap()');
ok('從屬上限隨名分成長', cap0===4 && cap1===12, `威望10官位0→${cap0} / 威望120官位2→${cap1}`);

let f2=0;
for(const [n,c,note] of checks){ console.log((c?'✓':'✗'),n,note?(' — '+note):''); if(!c)f2++; }
console.log(f2?'✗ 有未過':'全部通過');
process.exit(f2?1:0);
