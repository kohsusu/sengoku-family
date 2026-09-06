// 短劇本scn1:桶狹間之路(1555起/1565終局)+關原之道(1595起/世界線/關原/大坂終局)
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const {doc,localStorage}=require('./shim');
const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const script=[...HTML.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1])[0];
const sb={document:doc,localStorage,console,Math,JSON,Date,performance:{now:()=>0},setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},Image:class{set src(v){}},navigator:{userAgent:'node'},alert:()=>{},confirm:()=>true,prompt:()=>null,matchMedia:()=>({matches:false,addListener(){},addEventListener(){}}),location:{port:'5877',reload(){ throw new Error('__RELOAD__'); },replace(){ throw new Error('__RELOAD__'); }}};
sb.window=sb;sb.globalThis=sb;vm.createContext(sb);
vm.runInContext(script,sb,{filename:'game.js'});
vm.runInContext(`
render = function(){ if(!S) return; try{ armySync(); aptSync(); }catch(e){} };
drawMap = function(){}; save = function(){};
`,sb);
const ev=c=>vm.runInContext(c,sb);
const $=id=>ev(`document.getElementById('${JSON.stringify(id).slice(1,-1)}')`);
console.log('BUILD:', ev('BUILD'));

function drain(rec){
  let n=0;
  ev('pumpModal()');
  while(!ev(`$('modalBack').classList.contains('hidden')`) && n++<500){
    const title=ev(`$('modalTitle').textContent`);
    if(!title && !ev(`$('modalChoices').children.length`)){ ev(`$('modalBack').classList.add('hidden')`); ev('pumpModal()'); continue; }
    rec.titles.push(title);
    // 溫和玩家:避免砍檔/重開;其餘選第一顆
    const nBtn=ev(`$('modalChoices').children.length`);
    let idx=0;
    for(let i=0;i<nBtn;i++){
      const t=ev(`$('modalChoices').children[${i}].textContent`);
      if(!/新的家史|重新開始|開啟新/.test(t)){ idx=i; break; }
    }
    try{ ev(`$('modalChoices').children[${idx}] && $('modalChoices').children[${idx}].click()`); }
    catch(e){ if(/__RELOAD__/.test(e.message)){ rec.reload=true; return; } throw e; }
  }
  if(n>=500) rec.storm=true;
}
function playScen(scen, stopYear){
  const rec={titles:[],err:''};
  try{
    ev(`modalQueue.length=0; $('modalBack').classList.add('hidden');`);   // shim 初始 modalBack 無 hidden→pumpModal 不放行
    ev(`S=newState('劇試',0,'kokujin','gozoku','mikawa','${scen}')`);
    rec.startYear=ev('S.year');
    rec.lordsOda=ev('S.lords.oda.alive !== false');
    rec.toyotomi=ev('!!(S.lords.toyotomi && S.lords.toyotomi.alive)');
    rec.tokuName=ev('LORD_META.tokugawa.name');
    rec.histDoneN=ev('S.histDone.length');
    rec.rivalAlive=ev('S.rivals.filter(f=>f.alive).length');
    rec.rivalDev=ev('S.rivals.filter(f=>f.alive && f.dev && Object.keys(f.dev).length).length');
    let guard=0;
    while(ev('S.year') < stopYear && !ev('S.gameOver') && guard++<400){
      ev(`S.retainers.forEach((r,i)=>{ if((r.sick||0)===0) r.task=['tonden','farm','drill','trade'][i%4]; })`);
      try{ ev('endSeason()'); }catch(e){ if(!/__RELOAD__/.test(e.message)) throw e; }
      drain(rec);
      if(rec.reload) break;
    }
    rec.endYearReached=ev('S.year');
    rec.histDone2=ev('JSON.stringify(S.histDone.slice(-30))');
  }catch(e){ rec.err=(e.stack||e.message).slice(0,250); }
  return rec;
}

// ── 桶狹間之路 ──
const oke=playScen('oke', 1566);
// ── 關原之道 ──
const seki=playScen('seki', 1616);

const checks=[
 ['桶狹間之路無錯', !oke.err, oke.err||''],
 ['起始 1555', oke.startYear===1555, String(oke.startYear)],
 ['既往事件已標記', oke.histDoneN>=3, oke.histDoneN+'則'],
 ['桶狹間事件仍會發生', /okehazama/.test(oke.histDone2||''), ''],
 ['1565 終局卷出現', oke.titles.some(t=>/桶狹間之路——十年立家記/.test(t)), ''],
 ['關原之道無錯', !seki.err, seki.err||''],
 ['起始 1595・織田已亡・豐臣當國・稱德川', seki.startYear===1595 && !seki.lordsOda && seki.toyotomi && seki.tokuName==='德川',
   `${seki.startYear}/oda:${seki.lordsOda}/toyo:${seki.toyotomi}/${seki.tokuName}`],
 ['五十年淘洗(存活13~21家,特化已授)', seki.rivalAlive>=10 && seki.rivalDev>=5, seki.rivalAlive+'家存/'+seki.rivalDev+'家有特化'],
 ['關原事件發生', /sekigahara/.test(seki.histDone2||''), ''],
 ['大坂終局到達', seki.endYearReached>=1615 && (/osaka/.test(seki.histDone2||'') || seki.titles.some(t=>/大坂|元和偃武/.test(t))), '至'+seki.endYearReached],
];
let bad=0;
for(const [n,c,note] of checks){ console.log((c?'✓':'✗'),n,note?(' — '+note):''); if(!c)bad++; }
console.log(bad?'✗ 有未過':'全部通過');
process.exit(bad?1:0);
