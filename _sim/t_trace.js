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
ev('S=newState("試",0,"kokujin","gozoku","mikawa")');
const S = g.S;
S.army = {ashigaru:60, yumi:20, kiba:15, teppo:5}; S.soldiers = 100; S.rice = 9999; S.money = 9999;
S.retainers.forEach(r=>{ r.stamina = 100; r.sick = 0; });
try{
  sb.startBattle({title:'試合戰', intro:'', sent:{...S.army}, terrain:'river',
    foe:{name:'敵勢', army:{ashigaru:60, yumi:20, kiba:15, teppo:5}, morale:80, general:{name:'敵將', bu:60, chi:50}},
    onEnd:()=>{}});
}catch(e){ console.log('startBattle THREW:', e.message); }
console.log('modal open?', !$('modalBack').classList.contains('hidden'), 'title:', JSON.stringify($('modalTitle').textContent));
console.log('BT:', ev('BT?JSON.stringify({feat:BT.feat,form:BT.form,round:BT.round}):null'));
let guard = 0;
while(!$('modalBack').classList.contains('hidden') && guard++ < 15){
  const title = $('modalTitle').textContent;
  const btns = [...$('modalChoices').querySelectorAll('button')];
  console.log(guard, title.slice(0,26), '|', btns.map(b=>b.textContent.split('\n')[0].slice(0,12)).join(' / '));
  const by = re => btns.find(b=>re.test(b.textContent));
  const pick = by(/魚鱗/) || by(/突擊/) || btns[0];
  if(!pick) break;
  pick.click();
}
console.log('end BT:', ev('BT?JSON.stringify({round:BT.round,form:BT.form}):"cleared"'));
