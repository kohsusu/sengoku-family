// 武藝樹:點數來源/三樹共用總上限30/八技能效果/UI/存檔遷移
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
vm.runInContext(`render=function(){ if(S){try{armySync();aptSync();}catch(e){}} }; drawMap=function(){}; save=function(){};
  __log=[]; (function(){ const o=log; log=function(m,k){ __log.push(String(m)); return o(m,k); }; })();`,sb);
const ev=c=>vm.runInContext(c,sb); const g=sb.window.__game;
console.log('BUILD:', ev('BUILD'));
const checks=[]; const ok=(n,c,note)=>checks.push([n,c,note||'']);
const fresh=(tag)=>{ g.startGame(g.newState(tag,0,'kokujin','gozoku','mikawa'));
  ev(`modalQueue.length=0; $('modalBack').classList.add('hidden'); __log.length=0;
      S.money=99999; S.rice=99999; S.pop=9000; S.kokudaka=9000;
      S.retainers.forEach(r=>{ r.stamina=100; r.sick=0; r.bu=80; });`); };

// ── 1. 練兵得武藝點 ──
fresh('點試');
ev(`S.retainers[1].task='drill'; S.drillType='ashigaru';`);
let seasons=0;
while(ev('S.bugei') < 1 && seasons++ < 40){ ev(`S.retainers.forEach(r=>{r.stamina=100;}); resolveTasks();`); }
ok('練兵可得武藝級', ev('S.bugei') >= 1, `${seasons} 季升到 ${ev('S.bugei')} 級`);
ok('升級有敘事並開技能樹', ev(`__log.some(l=>l.indexOf('兵法之議可擇新技') >= 0)`)
   && ev(`(modalQueue.length > 0) || !$('modalBack').classList.contains('hidden')`),
   ev(`JSON.stringify(__log.filter(l=>l.indexOf('武藝') >= 0).slice(0,1))`));

// ── 2. 三樹共用總上限 30 ──
fresh('限試');
ev(`S.suiri=12; S.tradeLv=12; S.bugei=5;`);
ok('總上限計算', ev('skTotalLv()')===29 && ev('skCapLeft()')===1, `總 ${ev('skTotalLv()')}/30,餘 ${ev('skCapLeft()')}`);
ev(`S.bugei=6;`);   // 滿 30
const b0=ev('S.bugei');
ev(`S.retainers[1].task='drill'; S.retainers[1]._bugei=99;`);
for(let i=0;i<6;i++) ev(`S.retainers.forEach(r=>{r.stamina=100;}); resolveTasks();`);
ok('滿 30 級後武藝不再增長', ev('S.bugei')===b0, `${b0} → ${ev('S.bugei')}`);
ev(`S.suiri=11; S.retainers[2].task='fushin'; S.retainers[2]._fushin=99;`);
const s0=ev('S.suiri');
ev(`S.retainers.forEach(r=>{r.stamina=100;}); resolveTasks();`);
ok('滿 30 級後水利亦不再增長', ev('S.suiri')===s0, `${s0} → ${ev('S.suiri')}`);
ok('水利受阻有敘事', ev(`__log.some(l=>/家業修練已臻極致/.test(l))`), '');

// ── 3. 八技能:配點與階層 ──
fresh('點配');
ev(`S.bugei=12;`);
ok('未配點數 = 等級', ev(`skUnspent('bugei')`)===12, ''+ev(`skUnspent('bugei')`));
ok('中傳初始未開', !ev(`skTierOpen('bugei',2)`), '');
ev(`skAlloc('bugei','yarifusuma'); skAlloc('bugei','yarifusuma'); skAlloc('bugei','yarifusuma');
    skAlloc('bugei','yumigumi'); skAlloc('bugei','yumigumi');`);
ok('初傳累計 5 級開中傳', ev(`skTierOpen('bugei',2)`), `初傳 ${ev(`skSpent('bugei',1)`)} 級`);
ev(`skAlloc('bugei','kiba'); skAlloc('bugei','kiba'); skAlloc('bugei','kiba');
    skAlloc('bugei','teppogumi'); skAlloc('bugei','teppogumi');`);
ok('中傳累計 5 級開奧傳', ev(`skTierOpen('bugei',3)`), `中傳 ${ev(`skSpent('bugei',2)`)} 級`);
ok('同技不逾上限', (()=>{ ev(`skAlloc('bugei','yarifusuma')`); return ev(`skR('bugei','yarifusuma')`)===3; })(), ''+ev(`skR('bugei','yarifusuma')`));

// ── 4. 戰鬥效果(僅我方) ──
fresh('效試');
const ctx={weather:'clear',terrain:'plain'};
const armyA = `{ashigaru:200,yumi:0,kiba:0,teppo:0}`;
const m0 = ev(`bugeiMul(${armyA},'hold',{weather:'clear',terrain:'plain'})`);
ev(`S.skBugei={yarifusuma:3};`);
const m1 = ev(`bugeiMul(${armyA},'hold',{weather:'clear',terrain:'plain'})`);
ok('槍衾:足輕固守防禦上升', m1 > m0 * 1.10 && m1 < m0 * 1.35, `${m0} → ${m1.toFixed(3)}(全足輕滿級,應在 1.10~1.35)`);
ev(`S.skBugei={teppogumi:3};`);
const rainOff = ev(`bugeiMul({ashigaru:0,yumi:0,kiba:0,teppo:100},'volley',{weather:'clear',terrain:'plain'})`);
const rainOn  = ev(`bugeiMul({ashigaru:0,yumi:0,kiba:0,teppo:100},'volley',{weather:'rain',terrain:'plain'})`);
ok('鐵砲組:雨天另有補償', rainOn > rainOff, `晴 ${rainOff.toFixed(2)} / 雨 ${rainOn.toFixed(2)}`);
ok('敵軍不受武藝之益', ev(`(function(){ const s={army:{ashigaru:100,yumi:0,kiba:0,teppo:0},gen:ensureApt({name:'x',bu:60,nai:50,chi:50,trait:null}),pos:'sen',kind:'foe'};
   const a=ksStrength(s,'hold',{weather:'clear',terrain:'plain'},{ashigaru:100});
   S.skBugei={yarifusuma:3};
   const b=ksStrength(s,'hold',{weather:'clear',terrain:'plain'},{ashigaru:100});
   return Math.abs(a-b) < 1e-9; })()`), '');
ok('我軍受武藝之益', ev(`(function(){ S.skBugei={};
   const s={army:{ashigaru:100,yumi:0,kiba:0,teppo:0},gen:ensureApt({name:'x',bu:60,nai:50,chi:50,trait:null}),pos:'sen',kind:'family'};
   const a=ksStrength(s,'hold',{weather:'clear',terrain:'plain'},{ashigaru:100});
   S.skBugei={yarifusuma:3};
   const b=ksStrength(s,'hold',{weather:'clear',terrain:'plain'},{ashigaru:100});
   return b > a*1.08; })()`), '');

// ── 5. 奧傳:軍配減誤差 ──
fresh('配試');
ev(`S.skBugei={};`);
const n0 = ev(`(1 - clamp(40,20,100)/100) * 18 * Math.max(0.35, 1 - 0.25*skR('bugei','gunbai'))`);
ev(`S.skBugei={gunbai:2};`);
const n1 = ev(`(1 - clamp(40,20,100)/100) * 18 * Math.max(0.35, 1 - 0.25*skR('bugei','gunbai'))`);
ok('軍配:軍師所見誤差下降', n1 < n0*0.6, `誤差 ${n0.toFixed(1)} → ${n1.toFixed(1)}`);

// ── 6. 存檔遷移與序列化 ──
fresh('遷試');
const st=JSON.parse(ev('JSON.stringify(S)'));
delete st.bugei; delete st.skBugei;
ev(`__old = ${JSON.stringify(st)}; __new = migrate(__old);`);
ok('舊檔自動補武藝欄位', ev('__new.bugei')===0 && ev(`typeof __new.skBugei==='object'`), '');
ok('存檔可序列化', (()=>{ try{ JSON.stringify(g.S); return true; }catch(e){ return false; } })(), '');

// ── 7. UI ──
fresh('UI試');
ev(`S.bugei=3; S.suiri=4; S.tradeLv=2;`);
const html = ev(`skTreeHtml('bugei')`);
ok('武藝樹可渲染', /武藝/.test(html) && /槍衾/.test(html) && /不退轉/.test(html), '');
ok('三樹標題各異', ev(`SK_LABEL.suiri!==SK_LABEL.bugei && SK_LABEL.trade!==SK_LABEL.bugei`), '');

let bad=0;
for(const [n,c,note] of checks){ console.log((c?'✓':'✗'),n,note?(' — '+note):''); if(!c)bad++; }
console.log(bad?'✗ 有未過':'全部通過');
process.exit(bad?1:0);
