// 存檔完整性:S 必須永遠可序列化(循環參照曾使玩家跑完一季就再也存不了檔)
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
vm.runInContext(`render=function(){ if(S){try{armySync();aptSync();}catch(e){}} }; drawMap=function(){};
  __alert=null; alert=function(m){ __alert=String(m); };`,sb);
const ev=c=>vm.runInContext(c,sb); const g=sb.window.__game;
console.log('BUILD:', ev('BUILD'));
const checks=[]; const ok=(n,c,note)=>checks.push([n,c,note||'']);
const canSave = ()=>{ try{ JSON.stringify(g.S); return ''; }catch(e){ return e.message.split('\n')[0].slice(0,60); } };

// ── 1. 兩種模式跑滿 25 年,每年檢查可序列化 ──
for(const mode of ['gozoku','daimyo']){
  g.startGame(g.newState('存'+mode,0,'kokujin',mode,'mikawa'));
  ev(`modalQueue.length=0; $('modalBack').classList.add('hidden');`);
  let firstFail = '';
  for(let i=0;i<25*4 && !firstFail;i++){
    ev(`S.retainers.forEach(r=>{ if((r.sick||0)===0 && r.task==='rest') r.task='${mode==='daimyo'?'bugyo_kori':'tonden'}'; });`);
    try{ g.endSeason(); }catch(e){ if(!/__R__/.test(e.message)) throw e; break; }
    const err = canSave();
    if(err) firstFail = `${g.S.year}年${g.S.season}季: ${err}`;
    let n=0; ev('pumpModal()');
    while(!ev(`$('modalBack').classList.contains('hidden')`) && n++<200){
      const cn=ev(`$('modalChoices').children.length`);
      if(!cn){ ev(`$('modalBack').classList.add('hidden')`); ev('pumpModal()'); continue; }
      try{ ev(`$('modalChoices').children[0].click()`); }catch(e){ if(/__R__/.test(e.message)) break; throw e; }
    }
    if(g.S.gameOver) break;
  }
  ok(`${mode==='daimyo'?'大名':'豪族'}模式 25 年全程可存檔`, !firstFail, firstFail || `至 ${g.S.year} 年皆可序列化`);
}

// ── 2. saveNow 真寫入(存檔壞掉時此處會噴警示) ──
g.startGame(g.newState('寫試',0,'kokujin','gozoku','mikawa'));
ev(`modalQueue.length=0; $('modalBack').classList.add('hidden'); __alert=null;`);
ev('simRivalSeason(); simRivalActions([]); simRivalPolitics([]);');   // 跑過 AI 決策(循環參照的來源)
ev('S.money = 31337; saveNow();');
const stored = ev(`(()=>{ try{ return JSON.parse(localStorage.getItem(SLOT_KEY(curSlot))||'{}').money; }catch(e){ return -1; } })()`);
ok('AI 決策跑過後 saveNow 真寫入', stored === 31337, '存欄 money=' + stored + (ev('__alert') ? ' / 警示:'+ev('__alert').slice(0,40) : ''));
ok('saveNow 未噴保存失敗', !ev('__alert'), ev('__alert') ? ev('__alert').slice(0,60) : '');

// ── 3. 從屬/眾身上不得殘留物件參照欄位 ──
g.startGame(g.newState('欄試',0,'kokujin','gozoku','mikawa'));
ev('simRivalSeason(); simRivalActions([]);');
const objFields = JSON.parse(ev(`JSON.stringify((()=>{
  const out=[];
  for(const f of S.rivals){
    for(const k in f){
      const v=f[k];
      if(v && typeof v==='object' && !Array.isArray(v)){
        // 允許純資料物件(dev/grudge/intel/plan),不允許指向其他眾的參照
        const bad = Object.values(v).some(x=> x && typeof x==='object' && x.id && S.rivals.includes(x));
        if(bad || (v.id && S.rivals.includes(v))) out.push(f.id+'.'+k);
      }
    }
  }
  return out.slice(0,6);
})())`));
ok('眾身上無指向其他眾的物件參照', objFields.length===0, objFields.join(', ') || '乾淨');

// ── 4. 讀回存檔可正常續玩 ──
g.startGame(g.newState('讀試',0,'kokujin','gozoku','mikawa'));
ev(`modalQueue.length=0; $('modalBack').classList.add('hidden');`);
for(let i=0;i<8;i++){ try{ g.endSeason(); }catch(e){ if(!/__R__/.test(e.message)) throw e; }
  let n=0; ev('pumpModal()');
  while(!ev(`$('modalBack').classList.contains('hidden')`) && n++<100){
    const cn=ev(`$('modalChoices').children.length`);
    if(!cn){ ev(`$('modalBack').classList.add('hidden')`); ev('pumpModal()'); continue; }
    try{ ev(`$('modalChoices').children[0].click()`); }catch(e){ break; }
  }
}
ev('S.kokudaka = 4321; saveNow();');
const reloaded = ev(`(()=>{ const raw = localStorage.getItem(SLOT_KEY(curSlot)); if(!raw) return -1;
  const st = migrate(JSON.parse(raw)); return st.kokudaka; })()`);
ok('存檔讀回無誤', reloaded === 4321, '讀回石高 '+reloaded);

let bad=0;
for(const [n,c,note] of checks){ console.log((c?'✓':'✗'),n,note?(' — '+note):''); if(!c)bad++; }
console.log(bad?'✗ 有未過':'全部通過');
process.exit(bad?1:0);
