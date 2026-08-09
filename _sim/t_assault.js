// 控制實驗:玩家主動討伐的勝率掃描(兵力比 × 城級 × 指令策略)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { doc, localStorage } = require('./shim');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...HTML.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const sandbox = {
  document: doc, localStorage,
  console, Math, JSON, Date, performance: {now: () => 0},
  setTimeout, clearTimeout, setInterval, clearInterval,
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  Image: class { constructor(){ this.onload=null; } set src(v){} },
  navigator: {userAgent:'node'},
  alert: () => {}, confirm: () => true, prompt: () => null,
  matchMedia: () => ({matches:false, addListener(){}, addEventListener(){}}),
  location: {port:'5877', href:'http://localhost:5877/', reload(){}, replace(){}},
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(scripts[0], sandbox, {filename:'game.js'});
const g = sandbox.window.__game;
vm.runInContext(`render=function(){}; drawMap=function(){}; save=function(){};`, sandbox);

const $ = id => doc.getElementById(id);

// 依策略點按鈕;回傳 '勝'/'敗'/null
function playOut(policy){
  let outcome = null, guard = 0, round = 0;
  while(!$('modalBack').classList.contains('hidden') && guard++ < 60){
    const title = $('modalTitle').textContent;
    if(/^【勝】/.test(title)) outcome = true;
    if(/^【敗】/.test(title)) outcome = false;
    const btns = [...$('modalChoices').querySelectorAll('button')].filter(b=>!b.disabled);
    if(!btns.length){ $('modalBack').classList.add('hidden'); break; }
    let pickBtn = null;
    const by = re => btns.find(b => re.test(b.textContent));
    if(/出兵討伐/.test(title)) pickBtn = by(policy.mode);
    else if(by(/魚鱗|鶴翼|方圓|雁行/)) pickBtn = by(policy.form);
    else if(by(/乘り崩し|鐵砲射掛け/)){ pickBtn = by(policy.siege(round)); round++; }
    else if(by(/突擊|遠戰|固守|迂迴/)){ pickBtn = by(policy.field(round)); round++; }
    else if(/處遇/.test(title)) pickBtn = by(/割地/);
    else pickBtn = btns[0];
    (pickBtn || btns[0]).click();
  }
  return outcome;
}

const POLICIES = {
  '武斷流(力攻+全程乘り崩し)': {mode:/力攻/, form:/魚鱗/, siege:()=>/乘り崩し/, field:()=>/突擊/},
  '教科書(射掛→仕寄→乘り崩し)': {mode:/力攻/, form:/方圓/, siege:r=>r===0?/鐵砲射掛け/:r===1?/仕寄/:/乘り崩し/, field:()=>/固守/},
  '野戰決戰(突擊)': {mode:/野戰/, form:/魚鱗/, siege:()=>/乘り崩し/, field:()=>/突擊/},
  '野戰決戰(齊射)': {mode:/野戰/, form:/雁行/, siege:()=>/乘り崩し/, field:r=>r<2?/遠戰/:/突擊/},
};

const N = 40;
console.log('比率\\t城級\\t' + Object.keys(POLICIES).join('\t'));
for(const ratio of [2, 3, 4]){
  for(const koku of [500, 1500]){          // 居城 1+koku/700 → 1級 / 3級
    const row = [];
    for(const [pname, pol] of Object.entries(POLICIES)){
      let w = 0, n = 0;
      for(let i = 0; i < N; i++){
        vm.runInContext(`S = newState('試','木瓜','kokujin','gozoku','mikawa');`, sandbox);
        const S = g.S;
        const f = S.rivals.find(x => x.alive);
        f.koku = koku; f.sol = 100; f.money = 80; f.fort = 0;
        // 兵力=比率×敵兵;編成六二一一
        const X = Math.round(100 * ratio / 0.8);   // conquestWar 出陣 80%
        S.army = {ashigaru: Math.round(X*.6), yumi: Math.round(X*.2), kiba: Math.round(X*.1), teppo: Math.round(X*.1)};
        S.soldiers = ['ashigaru','yumi','kiba','teppo'].reduce((a,k)=>a+S.army[k],0);
        S.rice = 99999; S.money = 9999;
        S.retainers.forEach(r=>{ r.stamina = 100; r.sick = 0; });
        sandbox.conquestWar(f);
        const res = playOut(pol);
        if(res !== null){ n++; if(res) w++; }
      }
      row.push(n ? Math.round(w/n*100) + '%(' + n + ')' : '-');
    }
    console.log(ratio + 'x\t' + (1 + Math.floor(koku/700)) + '級\t' + row.join('\t'));
  }
}
