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

// ── 視窗不可以開成一片空白、無處可點 ──
// (註:queueModal 會把「單鈕・無 hud・短內文」的純通報降級成年代記一行、不進佇列,
//  所以底下的測試視窗一律給兩個選項,否則量的是降級路徑而非顯示路徑。)
// 盤上指揮曾經 queueModal → pumpModal → 直接改 $('modalBody');
// 畫面上若已有別的視窗(包圍網來襲那種一季擠一堆事件的時候),pumpModal 會直接 return,
// 盤面遂畫到別人身上,輪到自己時再被 m.body/m.hud 覆寫成空白——整局卡死,退不出去。
{
  ev("modalQueue.length = 0; $('modalBack').classList.add('hidden');");

  // ① onShow 要在視窗真的顯示之後才跑
  ev("__seen = []; queueModal({title:'甲', body:'', choices:[{label:'領命', fn:function(){}},{label:'再議', fn:function(){}}]," +
     " onShow:function(){ __seen.push('甲:' + ($('modalTitle').textContent)); }}); pumpModal();");
  ok('onShow 於視窗顯示後觸發,且看得到自己的標題', ev("__seen.join('|')") === '甲:甲', ev("__seen.join('|')"));

  // ② 前面有視窗擋著時,後來者的 onShow 不可提早跑——那正是畫到別人身上的成因
  ev("queueModal({title:'乙', body:'', choices:[{label:'領命', fn:function(){}},{label:'再議', fn:function(){}}]," +
     " onShow:function(){ __seen.push('乙:' + ($('modalTitle').textContent)); }}); pumpModal();");
  ok('被擋在後面時 onShow 不提早跑(不會畫到別人的視窗上)', ev("__seen.length") === 1,
     ev("__seen.join('|')"));

  // 關掉甲,乙登場,這時才輪到它畫
  ev("$('modalBack').classList.add('hidden'); pumpModal();");
  ok('前一扇關上後,後來者才畫自己的內容', ev("__seen.join('|')") === '甲:甲|乙:乙', ev("__seen.join('|')"));

  // ③ 死鎖護欄:真的一個按鈕都沒有時,一定補得出一條退路
  ev("modalQueue.length = 0; $('modalBack').classList.add('hidden');");
  ev("queueModal({title:'絕地', hud:'', body:'', choices:[]}); pumpModal();");
  ok('毫無選項的視窗會補上退路(不可鎖死玩家)',
     ev("$('modalChoices').querySelectorAll('button').length") >= 1,
     ev("($('modalChoices').innerHTML||'').slice(0,40)"));

  // ④ 盤上指揮已改用 onShow,而不是 pumpModal 之後硬改 DOM
  {
    const i = HTML.indexOf('function ksHexRound');
    const seg = HTML.slice(i, HTML.indexOf('function ksHexAutoRun', i));
    ok('盤上指揮以 onShow 畫盤面', seg.indexOf('onShow') > 0 && seg.indexOf('ksHexRedraw') > seg.indexOf('onShow'), '');
    ok('盤上指揮不再於 pumpModal() 之後才動 modalBody',
       seg.indexOf("pumpModal();") > seg.indexOf("$('modalBody')"), '');
  }
  ev("modalQueue.length = 0; $('modalBack').classList.add('hidden');");
}

// ── 重要事件不可被靜音 ──
// queueModal 原本把「單鈕・無 hud・內文短」一律降級成年代記一行並自動執行,
// 只靠標題黑名單擋下重要的。實測 150 局靜音了 24 種視窗,無一種該被靜音:
// ⛩ 大名として、📜 陣觸れ、各合戰結果、圍城成否、【If】線劇情轉折、梅雨大水……
// 改成白名單:只有標了 notice:true 的才降級。
{
  ev("modalQueue.length = 0; $('modalBack').classList.add('hidden');");
  const seen = () => ev("modalQueue.length") + (ev("$('modalBack').classList.contains('hidden')") ? 0 : 1);

  // 單鈕、無 hud、內文短——正是從前會被靜音的那種
  ev("queueModal({title:'⛩ 大名として', body:'昇格為大名。', choices:[{label:'受領', fn:function(){}}]});");
  ok('單鈕短視窗預設會被看見(不再被靜音)', seen() >= 1, '佇列+畫面 ' + seen());
  ev("modalQueue.length = 0; $('modalBack').classList.add('hidden');");

  ev("queueModal({title:'📜 陣觸れ——今川家動員令', body:'下季出陣。', choices:[{label:'領命', fn:function(){}}]});");
  ok('陣觸れ(一季前的預告)會被看見', seen() >= 1, '');
  ev("modalQueue.length = 0; $('modalBack').classList.add('hidden');");

  ev("queueModal({title:'【If】義元入京', body:'天下易主。', choices:[{label:'……', fn:function(){}}]});");
  ok('【If】線劇情轉折會被看見(舊黑名單只擋【史】)', seen() >= 1, '');
  ev("modalQueue.length = 0; $('modalBack').classList.add('hidden');");

  // 白名單仍然有效:明確標了 notice 的才降級,且即行其效
  ev("__ran = 0; queueModal({title:'例行', body:'小事。', notice:true, choices:[{label:'知道了', fn:function(){ __ran++; }}]});");
  ok('標了 notice:true 的才降級,且即行其效', seen() === 0 && ev('__ran') === 1, '執行 ' + ev('__ran') + ' 次');

  // 第二道保險:就算誤標 notice,史實/勝敗大事仍不降級
  ev("queueModal({title:'【史】桶狹間の戰(1560)', body:'義元討死。', notice:true, choices:[{label:'……', fn:function(){}}]});");
  ok('誤標 notice 的史實大事仍會被看見(黑名單作第二道保險)', seen() >= 1, '');
  ev("modalQueue.length = 0; $('modalBack').classList.add('hidden');");
}

for(const [st,n,note] of R) console.log(st, n, note?(' — '+note):'');
console.log(R.some(r=>r[0]==='✗') ? '✗ 有未過' : '全部通過');
