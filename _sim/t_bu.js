'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { doc, localStorage } = require('./shim');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = [...HTML.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1])[0];
const sb = {document:doc, localStorage, console, Math, JSON, Date, performance:{now:()=>0},
  setTimeout, clearTimeout, setInterval, clearInterval,
  requestAnimationFrame:()=>0, cancelAnimationFrame:()=>{},
  Image: class { set src(v){} }, navigator:{userAgent:'node'},
  alert:()=>{}, confirm:()=>true, prompt:()=>null,
  matchMedia:()=>({matches:false, addListener(){}, addEventListener(){}}),
  location:{port:'5877', reload(){}, replace(){}}};
sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
vm.runInContext(script, sb, {filename:'game.js'});
vm.runInContext('render=function(){};drawMap=function(){};save=function(){};', sb);
const g = sb.window.__game, ev = c => vm.runInContext(c, sb);
const $ = id => doc.getElementById(id);

for(const BU of [40, 90]){
  ev('KS=null; BT=null;');
  $('modalBack').classList.add('hidden');
  ev('S=newState("試",0,"kokujin","gozoku","mikawa")');
  const S = g.S;
  S.kokudaka = 3000; S.army = {ashigaru:320, yumi:100, kiba:88, teppo:44}; S.soldiers = 552;
  S.rice = 9999; S.money = 9999; S.prestige = 80;
  S.retainers.forEach(r=>{ r.stamina = 100; r.sick = 0; r.bu = BU; });
  sb.kokusen('imagawa', true);
  const clickBy = re => {
    const b = [...$('modalChoices').querySelectorAll('button')].find(b=>re.test(b.textContent));
    if(b) b.click(); return !!b;
  };
  clickBy(/布陣へ/); clickBy(/開戰——盤上/);
  const KS = ev('KS');
  const mine = KS.my.filter(x=>x.kind==='family');
  console.log('BU='+BU,
    '各備大將bu:', mine.map(s=>s.gen.bu).join(','),
    '士氣:', mine.map(s=>Math.round(s.mor)).join(','),
    '一備戰力:', Math.round(ev('ksStrength(KS.my[0], "charge", KS.ctx, KS.foe[0].army)')));
  $('modalBack').classList.add('hidden');
}
