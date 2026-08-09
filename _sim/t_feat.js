// P1 戰場特徵卡驗證:搶要地 vs 無視要地 的勝率差(等兵力野戰)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { doc, localStorage } = require('./shim');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...HTML.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const sandbox = {
  document: doc, localStorage, console, Math, JSON, Date, performance: {now: () => 0},
  setTimeout, clearTimeout, setInterval, clearInterval,
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  Image: class { set src(v){} }, navigator: {userAgent:'node'},
  alert: () => {}, confirm: () => true, prompt: () => null,
  matchMedia: () => ({matches:false, addListener(){}, addEventListener(){}}),
  location: {port:'5877', reload(){}, replace(){}},
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(scripts[0], sandbox, {filename:'game.js'});
const g = sandbox.window.__game;
vm.runInContext(`render=function(){}; drawMap=function(){}; save=function(){};`, sandbox);
const $ = id => doc.getElementById(id);
const ev = c => vm.runInContext(c, sandbox);

function playOut(policy){
  let outcome = null, guard = 0, round = 0;
  while(!$('modalBack').classList.contains('hidden') && guard++ < 40){
    const title = $('modalTitle').textContent;
    if(/^【勝】/.test(title)) outcome = true;
    if(/^【敗】/.test(title)) outcome = false;
    const btns = [...$('modalChoices').querySelectorAll('button')].filter(b=>!b.disabled);
    if(!btns.length){ $('modalBack').classList.add('hidden'); break; }
    const by = re => btns.find(b => re.test(b.textContent));
    let pick = null;
    if(by(/魚鱗|鶴翼|方圓|雁行/)) pick = by(/魚鱗/);
    else if(by(/突擊|遠戰|固守|迂迴/)){ pick = policy(round, by) || by(/突擊/); round++; }
    (pick || btns[0]).click();
  }
  return outcome;
}

function battle(terrain, policy){
  ev('BT = null;');
  $('modalBack').classList.add('hidden');
  ev(`S = newState('試', 0, 'kokujin', 'gozoku', 'mikawa');`);
  const S = g.S;
  const M = +(process.env.MYRATIO||1);
  S.army = {ashigaru:Math.round(60*M), yumi:Math.round(20*M), kiba:Math.round(15*M), teppo:Math.round(5*M)};
  S.soldiers = Math.round(100*M);
  S.rice = 9999; S.money = 9999;
  S.retainers.forEach(r=>{ r.stamina=100; r.sick=0; });
  const fa = {ashigaru:60, yumi:20, kiba:15, teppo:5};
  sandbox.startBattle({
    title:'試合戰', intro:'', sent:{...S.army}, terrain,
    foe:{name:'敵勢', army:fa, morale:80, general:{name:'敵將', bu:60, chi:50}},
    onEnd:()=>{}
  });
  if(process.env.FORCEHOLD){ const BT2 = ev('BT'); if(BT2 && BT2.feat) ev('BT.feat.holder="foe"'); }
  return playOut(policy);
}

const N = 200;
const ignore = () => null;                                     // 全程突擊
const grab = (r, by) => r === 0 ? by(/爭奪/) : null;           // 首陣搶,搶到後突擊
const grabAlways = (r, by) => by(/爭奪/);                      // 見縫就搶

for(const terr of ['river','mountain','plain']){
  const row = [];
  for(const [name, pol] of [['無視要地',ignore],['首陣搶',grab],['執著搶',grabAlways]]){
    let w=0,n=0;
    for(let i=0;i<N;i++){ const r = battle(terr, pol); if(r!==null){ n++; if(r)w++; } }
    row.push(name+' '+Math.round(w/n*100)+'%');
  }
  console.log(terr.padEnd(9), row.join('  '));
}
// 要地生成率與敵搶占率
let spawn=0, foeGrab=0, T=100;
for(let i=0;i<T;i++){
  ev('BT = null;');
  $('modalBack').classList.add('hidden');
  ev(`S = newState('試', 0, 'kokujin', 'gozoku', 'mikawa');`);
  const S=g.S; S.army={ashigaru:60,yumi:20,kiba:15,teppo:5}; S.soldiers=100; S.rice=9999; S.money=9999;
  S.retainers.forEach(r=>{r.stamina=100;r.sick=0;});
  sandbox.startBattle({title:'x',intro:'',sent:{...S.army},terrain:'plain',
    foe:{name:'敵',army:{ashigaru:60,yumi:20,kiba:15,teppo:5},morale:80,general:{name:'敵',bu:60,chi:50}},onEnd:()=>{}});
  const BT = ev('BT');
  if(BT && BT.feat){ spawn++; if(BT.feat.holder==='foe') foeGrab++; }
  playOut(ignore);
}
console.log('平原要地生成率:', spawn+'%', ' 其中敵先據:', Math.round(foeGrab/Math.max(1,spawn)*100)+'%');
