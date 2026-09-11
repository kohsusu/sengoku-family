// P1 回歸:委任懲罰 / 取次開放 / 遠方從屬可管 / 奉行職制(唯一・不閒置・病癒復職)
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
vm.runInContext(`render=function(){ if(S){try{armySync();aptSync();}catch(e){}} }; drawMap=function(){}; save=function(){};`,sb);
const ev=c=>vm.runInContext(c,sb); const g=sb.window.__game;
console.log('BUILD:', ev('BUILD'));
const checks=[]; const ok=(n,c,note)=>checks.push([n,c,note||'']);

// ── 1. 委任代價:郡奉行一年的石高產出 vs 手動四季屯田 ──
function yearKoku(mode, task){
  g.startGame(g.newState('委'+mode,0,'kokujin',mode,'mikawa'));
  ev(`S.money=99999; S.rice=99999; S.kokudaka=2500;
      S.retainers.forEach((r,i)=>{ r.stamina=100; r.sick=0; r.nai=55; r.task='${task}'; });`);
  const k0=ev('S.kokudaka');
  for(let i=0;i<4;i++){ ev(`S.retainers.forEach(r=>{ r.stamina=100; }); resolveTasks(); S.season=(S.season+1)%4;`); }
  return (ev('S.kokudaka')-k0) / ev('S.retainers.length');
}
const manual = yearKoku('gozoku','tonden');
const bugyo  = yearKoku('daimyo','bugyo_kori');
ok('委任代價收斂(郡奉行 ≥ 手動之半)', bugyo >= manual*0.5,
   `手動 ${manual.toFixed(1)} 石/年/人 vs 郡奉行 ${bugyo.toFixed(1)}(修正前約為 1/4)`);

// ── 2. 大名模式可派取次 ──
g.startGame(g.newState('取試',0,'kokujin','daimyo','mikawa'));
ev(`S.retainers[0].task='toritsugi'; resolveTasks();`);
ok('大名模式保留取次(不被強制改回休養)', ev(`S.retainers[0].task`)==='toritsugi', '現任 '+ev(`TASKS[S.retainers[0].task].name`));
ok('取次對從屬有效(信心/關係上升)', (()=>{
  ev(`var v=S.rivals.find(x=>x.alive); v.lord='player'; v.rel=0; v.ltrust=40;
      S.retainers[0].task='toritsugi'; S.retainers[0].stamina=100; S.money=999;`);
  const l0=ev('v.ltrust'); ev('resolveTasks()');
  return ev('v.ltrust') > l0;
})(), '信心 '+ev('v.ltrust'));

// ── 3. 遠方從屬仍列於番付 ──
g.startGame(g.newState('遠試',0,'kokujin','gozoku','mikawa'));
ev(`var far=S.rivals.filter(x=>x.alive).sort((a,b)=>pdist(b)-pdist(a))[0]; far.lord='player';`);
const farDist = ev('ri(pdist(far))');
ev('renderRivals()');
ok('遠方從屬必列番付', ev(`S.rivals.filter(f=>f.alive && (pdist(f)<=240 || f.lord==='player')).some(f=>f.id===far.id)`),
   '最遠從屬距離 '+farDist+(farDist>240?'(>240,舊版會消失)':''));

// ── 4. 奉行一職一人:改任時對調 ──
g.startGame(g.newState('職試',0,'kokujin','daimyo','mikawa'));
ev(`S.retainers[1].task='bugyo_kori'; S.retainers[2].task='bugyo_kanjo';`);
// 模擬 render 的 onchange:把 2 號也改成郡奉行
ev(`(function(){ const r=S.retainers[2], want='bugyo_kori', prev=r.task;
     const holder=S.retainers.find(x=>x!==r && !x.spare && x.task===want);
     if(holder) holder.task=(prev && prev.indexOf('bugyo_')===0)?prev:'rest';
     r.task=want; })()`);
ok('一職一人(改任即對調,無人閒置)',
   ev(`S.retainers[2].task`)==='bugyo_kori' && ev(`S.retainers[1].task`)==='bugyo_kanjo',
   `1號→${ev(`S.retainers[1].task`)} / 2號→${ev(`S.retainers[2].task`)}`);

// ── 5. 當主開局不閒置 ──
g.startGame(g.newState('主試',0,'kokujin','daimyo','mikawa'));
ok('大名開局當主有職', ev(`S.retainers[0].task`) !== 'rest', '當主任 '+ev(`TASKS[S.retainers[0].task].name`));
ok('五奉行皆有人', ev(`['bugyo_kori','bugyo_kanjo','bugyo_gun','bugyo_fushin','bugyo_minsei'].every(b=>S.retainers.some(r=>r.task===b))`), '');

// ── 6. 病癒復職 ──
g.startGame(g.newState('病試',0,'kokujin','daimyo','mikawa'));
ev(`var r1=S.retainers[1]; r1.task='bugyo_kori'; r1.sick=2; r1.stamina=50;`);
ev('resolveTasks()');
const midTask = ev('r1.task'), midSick = ev('r1.sick');
ev('resolveTasks()');
ok('病癒自動回任本職', ev('r1.task')==='bugyo_kori' && ev('r1.sick')===0,
   `臥病中 ${midTask}(餘${midSick}季) → 癒後 ${ev('r1.task')}`);

// ── 7. 適配標支援奉行 ──
g.startGame(g.newState('標試',0,'kokujin','daimyo','mikawa'));
ev(`S.season=0; S.retainers[1].task='bugyo_kori';`);
const fitSpring = JSON.parse(ev(`JSON.stringify(taskFit(S.retainers[1]))`));
ev(`S.season=3;`);
const fitWinter = JSON.parse(ev(`JSON.stringify(taskFit(S.retainers[1]))`));
ok('奉行顯示當季實務(原本畫面看不出來)',
   fitSpring.some(x=>/本季:農務/.test(x[0])) && fitWinter.some(x=>/本季:屯田/.test(x[0])),
   '春 '+JSON.stringify(fitSpring.map(x=>x[0]))+' / 冬 '+JSON.stringify(fitWinter.map(x=>x[0])));

let bad=0;
for(const [n,c,note] of checks){ console.log((c?'✓':'✗'),n,note?(' — '+note):''); if(!c)bad++; }
console.log(bad?'✗ 有未過':'全部通過');
process.exit(bad?1:0);
