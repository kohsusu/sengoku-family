// ③軍事適應驗證:同一對手連戰,一招用老 vs 靈活換招 vs 放流言
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

function playOut(cmdPick){
  let outcome = null, guard = 0, round = 0;
  while(!$('modalBack').classList.contains('hidden') && guard++ < 60){
    const title = $('modalTitle').textContent;
    if(/^【勝】/.test(title)) outcome = true;
    if(/^【敗】/.test(title)) outcome = false;
    const btns = [...$('modalChoices').querySelectorAll('button')].filter(b=>!b.disabled);
    if(!btns.length){ $('modalBack').classList.add('hidden'); break; }
    const by = re => btns.find(b => re.test(b.textContent));
    let pick = null;
    if(/出兵討伐/.test(title)) pick = by(/野戰決戰/);
    else if(by(/魚鱗|鶴翼|方圓|雁行/)) pick = by(/魚鱗/);
    else if(by(/突擊|遠戰|固守|迂迴/)){ pick = by(cmdPick(round)); round++; }
    else if(/處遇/.test(title)) pick = by(/割地/);
    (pick || btns[0]).click();
  }
  return outcome;
}

// 連戰 6 場:每場重置雙方兵力與該眾石高,只讓 intel 累積
function series(cmdPick, useRumor){
  const W = [];
  vm.runInContext(`S = newState('試', 0, 'kokujin', 'gozoku', 'mikawa');`, sandbox);
  const S = g.S;
  const f = S.rivals.find(x => x.alive);
  for(let i = 0; i < 6; i++){
    f.koku = 500; f.sol = 100; f.money = 80; f.fort = 0; f.alive = true;
    const X = Math.round(100 * 1.0 / 0.8);
    // 騎馬三成——正好觸發「知我多騎馬」的適應
    S.army = {ashigaru: Math.round(X*.5), yumi: Math.round(X*.1), kiba: Math.round(X*.3), teppo: Math.round(X*.1)};
    S.soldiers = ['ashigaru','yumi','kiba','teppo'].reduce((a,k)=>a+S.army[k],0);
    S.rice = 99999; S.money = 99999;
    S.retainers.forEach(r=>{ r.stamina = 100; r.sick = 0; });
    if(useRumor && i === 3){   // 第四場前放流言
      f.intel = {n:3, teppoP:0.55, kibaP:0.05, fake:true};
    }
    sandbox.conquestWar(f);
    const res = playOut(cmdPick);
    if(res !== null) W.push(res ? 1 : 0);
  }
  if(!series.logged){ series.logged=1; console.log('  (六戰後 intel:', JSON.stringify(f.intel), ')'); }
  return W;
}

const N = 60;
function sweep(name, cmdPick, useRumor){
  const early = [], late = [];
  for(let t = 0; t < N; t++){
    const w = series(cmdPick, useRumor);
    w.slice(0, 2).forEach(x => early.push(x));
    w.slice(3, 6).forEach(x => late.push(x));
  }
  const pct = a => Math.round(a.reduce((x,y)=>x+y,0)/a.length*100);
  console.log(name.padEnd(22), '前兩戰', pct(early)+'%', ' 四戰後', pct(late)+'%');
}
sweep('一招用老(全程突擊)', () => /突擊/);
sweep('靈活換招(輪替)', r => [/突擊/, /遠戰/, /迂迴/, /固守/, /突擊/][r % 5]);
sweep('用老+放流言', () => /突擊/, true);
sweep('聰明變招(突遠交替)', r => r % 2 ? /遠戰/ : /突擊/);
