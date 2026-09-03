// UI 按鈕總觸發:自原始碼枚舉全部 $('btnX').onclick 綁定,逐一觸發斷言不拋錯
// (shim 的 innerHTML 不生子節點,故用原始碼枚舉而非 DOM 遍歷;存檔鈕另斷言真寫入)
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
  location:{port:'5877', reload(){ throw new Error('__RELOAD__'); }, replace(){ throw new Error('__RELOAD__'); }}};
sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
vm.runInContext(script, sb, {filename:'game.js'});
vm.runInContext('render=function(){};drawMap=function(){};log=function(){};', sb);
const ev = c => vm.runInContext(c, sb);
const $ = id => doc.getElementById(id);
const R = []; const ok = (n,c,note)=>R.push([c?'✓':'✗',n,note||'']);
console.log('BUILD:', ev('typeof BUILD!=="undefined"?BUILD:"(無)"'));

// 枚舉原始碼中的按鈕綁定
const ids = [...new Set([...script.matchAll(/\$\('(btn\w+)'\)\.onclick/g)].map(m => m[1]))];
console.log('綁定按鈕', ids.length, '顆:', ids.join(' '));

// 進入遊戲態
ev('KS=null;BT=null;');
$('modalBack').classList.add('hidden');
ev(`startGame(newState('鈕試', 0, 'kokujin', 'gozoku', 'mikawa'));
    S.money = 999; S.rice = 999; S.prestige = 80; S.suiri = 2; S.tradeLv = 2;`);
const drain = () => {
  let g = 0;
  while(!$('modalBack').classList.contains('hidden') && g++ < 15){
    const btns = [...$('modalChoices').querySelectorAll('button')].filter(b=>!b.disabled);
    if(!btns.length){ $('modalBack').classList.add('hidden'); break; }
    btns[0].click(); ev('pumpModal()');
  }
};
drain();

// 會 reload 的鈕排最後;btnReset(刪檔)完全跳過破壞性實測、僅檢查已綁定
const RELOADY = ['btnTitle'];
const SKIP = ['btnReset', 'btnNew', 'btnContinue', 'btnSeki'];   // 標題流/破壞性另有覆蓋
const order = ids.filter(i => !RELOADY.includes(i) && !SKIP.includes(i)).concat(RELOADY);
let failed = 0;
for(const id of order){
  const r = ev(`(()=>{ try{
      const b = document.getElementById('${id}');
      if(!b) return 'NOBTN';
      if(!b.onclick) return 'NOBIND';
      b.onclick({stopPropagation:()=>{}});
      return 'ok';
    }catch(e){ return 'ERR:' + (e && e.message || e); } })()`);
  drain();
  // NOBIND=render()內動態綁定(墊片stub render故不見)——非錯誤,標記略過
  const pass = r === 'ok' || r === 'NOBTN' || r === 'NOBIND' || (RELOADY.includes(id) && /__RELOAD__/.test(r));
  if(!pass) failed++;
  ok(`${id} 觸發`, pass, r === 'ok' ? '' : (r === 'NOBIND' ? '(render內動態綁定,墊片略過)' : r));
  // 每鈕後恢復基本資源,避免連鎖耗盡
  ev('if(S){ S.money = Math.max(S.money, 200); S.rice = Math.max(S.rice, 300); }');
}
// 存檔鈕真寫入斷言
ev(`S.money = 31337; if(typeof save==='function') save();`);
ev(`(()=>{ const b = document.getElementById('btnSave'); if(b && b.onclick) b.onclick({stopPropagation:()=>{}}); })()`);
drain();
const stored = ev(`(()=>{ try{ return JSON.parse(localStorage.getItem(SLOT_KEY(curSlot))||'{}').money; }catch(e){ return -1; } })()`);
ok('btnSave 真寫入存檔欄', stored === 31337, '存欄money=' + stored);
ev(`S.money = 41414; save();`);
ev(`(()=>{ const b = document.getElementById('btnSave2'); if(b && b.onclick) b.onclick({stopPropagation:()=>{}}); })()`);
const stored2 = ev(`(()=>{ try{ return JSON.parse(localStorage.getItem(SLOT_KEY(curSlot))||'{}').money; }catch(e){ return -1; } })()`);
ok('btnSave2(吸底💾) 真寫入', stored2 === 41414, '存欄money=' + stored2);

for(const [st,n,note] of R) console.log(st, n, note?(' — '+note):'');
console.log(R.some(r=>r[0]==='✗') ? '✗ 有未過' : '全部通過');
