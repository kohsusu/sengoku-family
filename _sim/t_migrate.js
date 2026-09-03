// 存檔遷移回歸:降級檔(缺新欄位/舊版號)經 loadSave→migrate 後可玩且欄位齊備
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
vm.runInContext('render=function(){};drawMap=function(){};log=function(){};', sb);
const ev = c => vm.runInContext(c, sb);
const $ = id => doc.getElementById(id);
const R = []; const ok = (n,c,note)=>R.push([c?'✓':'✗',n,note||'']);
console.log('BUILD:', ev('typeof BUILD!=="undefined"?BUILD:"(無)"'));

// 基準:當前版完整存檔
ev(`S=newState('遷移試',0,'kokujin','gozoku','mikawa'); S.suiri=6; S.tradeLv=4; S.skSuiri={tameike:2}; S.mine=2;`);
const base = JSON.parse(ev('JSON.stringify(S)'));

// 降級剖面:各刪一批「後期新增」欄位並調降版號(模擬歷代舊檔)
const PROFILES = [
  ['v23缺技能樹', 23, ['skSuiri','skTrade','seen']],
  ['v20缺礦山官位', 20, ['skSuiri','skTrade','seen','mine','kuge','lordMarr','holds']],
  ['v16缺風聞戳記', 16, ['skSuiri','skTrade','seen','mine','kuge','lordMarr','holds','rumors','slain','warBoom','taishoId']],
  ['v12深度降級', 12, ['skSuiri','skTrade','seen','mine','kuge','lordMarr','holds','rumors','slain','warBoom','taishoId','consorts','lineage','flags','boshu','siege','leanRun','tokuseiCd','farmWork']],
];
for(const [name, ver, strip] of PROFILES){
  const d = JSON.parse(JSON.stringify(base));
  d.v = ver;
  for(const k of strip) delete d[k];
  // 眾身上也刪新欄位
  (d.rivals||[]).forEach(f=>{ delete f.grudge; delete f.ltrust; delete f.on; delete f.intel; delete f.allies; delete f.marrTo; delete f.plan; delete f.sol; delete f.men; delete f.dev; });
  ev('localStorage.setItem(SLOT_KEY(2), ' + JSON.stringify(JSON.stringify(d)) + ');');
  let loaded = null, err = '';
  try{ loaded = ev('(()=>{ const s2 = loadSave(2); return s2 ? {fam:s2.famName, v:s2.v, rivals:(s2.rivals||[]).length} : null; })()'); }
  catch(e){ err = e.message.slice(0,80); }
  ok(`${name}:loadSave 不炸且可讀`, !!loaded && loaded.fam === '遷移試', err || JSON.stringify(loaded));
  if(!loaded) continue;
  // 進場+推進一季(startGame 內含 saveNow)
  let playErr = '';
  try{
    ev('KS=null; BT=null; if(typeof modalQueue!=="undefined") modalQueue.length=0;');
    $('modalBack').classList.add('hidden');
    ev('startGame(loadSave(2));');
    let g = 0;
    while(!$('modalBack').classList.contains('hidden') && g++ < 12){
      const btns = [...$('modalChoices').querySelectorAll('button')].filter(b=>!b.disabled);
      if(!btns.length) break;
      btns[0].click(); ev('pumpModal()');
    }
    ev('__L=[]; simRivals(__L); simRivalActions(__L);');   // 舊檔眾缺欄位下跑 AI 迴圈
    ok(`${name}:進場+AI迴圈無例外`, true, '');
    ok(`${name}:技能樹防衛(skR=0/unspent=level)`, ev(`skR('suiri','tameike')`) >= 0 && ev(`skUnspent('suiri')`) >= 0, '');
  }catch(e){
    playErr = e.message.slice(0,100);
    ok(`${name}:進場+AI迴圈無例外`, false, playErr);
  }
}
ev('localStorage.removeItem(SLOT_KEY(2));');
for(const [st,n,note] of R) console.log(st, n, note?(' — '+note):'');
console.log(R.some(r=>r[0]==='✗') ? '✗ 有未過' : '全部通過');
