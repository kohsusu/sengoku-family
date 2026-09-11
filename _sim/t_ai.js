// AI 決策品質量測台:世界自行演化(玩家被動),量「聰明」而非只量「強」
// 指標:①出兵勝率(挑對仗?)②空轉率(做白工?)③淘汰整合④大名國力⑤外交活性
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const {doc, localStorage} = require('./shim');
const N = parseInt(process.argv[2]||'60', 10);
const TAG = process.argv[3] || '';

const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const script=[...HTML.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1])[0];
const sb={document:doc,localStorage,console,Math,JSON,Date,performance:{now:()=>0},
  setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},
  requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},Image:class{set src(v){}},
  navigator:{userAgent:'node'},alert:()=>{},confirm:()=>true,prompt:()=>null,
  matchMedia:()=>({matches:false,addListener(){},addEventListener(){}}),
  location:{port:'5877',reload(){throw new Error('__RELOAD__');},replace(){throw new Error('__RELOAD__');}}};
sb.window=sb;sb.globalThis=sb;vm.createContext(sb);
vm.runInContext(script,sb,{filename:'game.js'});
vm.runInContext(`
  render = function(){ if(!S) return; try{ armySync(); aptSync(); }catch(e){} };
  drawMap = function(){}; save = function(){};
  __lines = [];
  (function(){ const o = log; log = function(m,k){ __lines.push(String(m)); return o(m,k); }; })();
`,sb);
const ev = c=>vm.runInContext(c,sb);
const g = sb.window.__game;

function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

const agg = { games:0, err:0, atk:0, atkWin:0, atkKill:0, cmd:0, cmdWaste:0,
  survivors:[], topKoku:[], totKoku:[], gini:[], lordPow:[], lordsAlive:[],
  ally:0, marr:0, kiri:0, plan:{}, playerKoku:[], devTot:[], years:[], lordVassals:[], freeRivals:[] };
function gini(a){ if(!a.length) return 0;
  const b=[...a].sort((x,y)=>x-y), n=b.length, s=b.reduce((x,y)=>x+y,0);
  if(s<=0) return 0; let c=0; for(let i=0;i<n;i++) c += (2*(i+1)-n-1)*b[i];
  return c/(n*s); }

for(let seed=0; seed<N; seed++){
  const rnd = mulberry32(seed*2654435761 + 999);
  const region = ['mikawa','owari','totomi','shinano'][Math.floor(rnd()*4)];
  try{
    ev('__lines.length = 0;');
    g.startGame(g.newState('觀測'+seed, seed%12, 'kokujin', 'gozoku', region));
    ev(`modalQueue.length=0; $('modalBack').classList.add('hidden');`);
    for(let i=0; i<71*4; i++){
      ev(`S.retainers.forEach(r=>{ if((r.sick||0)===0) r.task='farm'; });`);   // 被動玩家
      const before = {};
      for(const f of g.S.rivals) if(f.alive) before[f.id] = {k:f.koku, m:f.money, s:f.sol, ft:f.fort||0, b:f.build||0};
      try{ g.endSeason(); }catch(e){ if(!/__RELOAD__/.test(e.message)) throw e; break; }
      for(const f of g.S.rivals){
        if(!f.alive || !f.lastCmd) continue;
        const b = before[f.id]; if(!b) continue;
        agg.cmd++;
        const noop = (f.lastCmd==='練兵' && f.sol <= b.s)
          || (f.lastCmd==='普請' && (f.fort||0) <= b.ft && (f.build||0) <= b.b)
          || (f.lastCmd==='開墾' && f.koku <= b.k)
          || (f.lastCmd==='經商' && f.money <= b.m)
          || (f.lastCmd==='農務' && f.koku <= b.k);
        if(noop) agg.cmdWaste++;
      }
      // 被動玩家:排掉插隊事件,一律選第一個非毀檔選項
      let n2=0;
      ev('pumpModal()');
      while(!ev(`$('modalBack').classList.contains('hidden')`) && n2++ < 200){
        const cn = ev(`$('modalChoices').children.length`);
        if(!cn){ ev(`$('modalBack').classList.add('hidden')`); ev('pumpModal()'); continue; }
        sb.__lines.push(ev(`$('modalBody').textContent`));   // 歲末世界動態寫在 modal body,不在 log
        let idx=0;
        for(let j=0;j<cn;j++){
          const t = ev(`$('modalChoices').children[${j}].textContent`);
          if(!/新的家史|重新開始|開啟新/.test(t)){ idx=j; break; }
        }
        try{ ev(`$('modalChoices').children[${idx}].click()`); }
        catch(e){ if(/__RELOAD__/.test(e.message)) break; throw e; }
      }
      if(g.S.gameOver) break;
    }
    const NL = String.fromCharCode(10);
    const lines = sb.__lines.join(NL).split(NL);
    for(const l of lines){
      if(/攻滅.*盡取其領/.test(l)){ agg.atk++; agg.atkWin++; agg.atkKill++; }
      else if(/破.*於境上,割其地/.test(l)){ agg.atk++; agg.atkWin++; }
      else if(/攻.*不克,折兵/.test(l)) agg.atk++;
      if(/結攻守之盟/.test(l)) agg.ally++;
      if(/結為姻親/.test(l)) agg.marr++;
      if(/切り取り/.test(l)) agg.kiri++;
      const pm = l.match(/評定:「(.{1,6}?)」/);
      if(pm) agg.plan[pm[1]] = (agg.plan[pm[1]]||0)+1;
    }
    const ks = g.S.rivals.filter(f=>f.alive).map(f=>f.koku);
    agg.survivors.push(ks.length);
    agg.topKoku.push(ks.length?Math.max(...ks):0);
    agg.totKoku.push(ks.reduce((a,b)=>a+b,0));
    agg.gini.push(gini(ks));
    agg.lordPow.push(ev(`aliveLords().reduce((a,k)=>a+lordPower(k),0)`));
    agg.lordsAlive.push(ev(`aliveLords().length`));
    agg.playerKoku.push(g.S.kokudaka);
    agg.devTot.push(g.S.rivals.filter(f=>f.alive).reduce((a,f)=>a+Object.values(f.dev||{}).reduce((x,y)=>x+y,0),0));
    agg.years.push(g.S.year);
    agg.lordVassals.push(g.S.rivals.filter(f=>f.alive && f.lord && f.lord!=='player').length);
    agg.freeRivals.push(g.S.rivals.filter(f=>f.alive && !f.lord).length);
    agg.games++;
  }catch(e){
    agg.err++;
    if(agg.err<=2) console.error('ERR:', (e.stack||e.message).split('\n').slice(0,3).join(' | '));
  }
}
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const med=a=>{const b=[...a].sort((x,y)=>x-y); return b.length?b[Math.floor(b.length/2)]:0;};
const planTop = Object.entries(agg.plan).sort((a,b)=>b[1]-a[1]).slice(0,6)
  .map(([k,v])=>k+':'+(v/Math.max(1,agg.games)).toFixed(1)).join(' ');
console.log(JSON.stringify({
  tag:TAG, games:agg.games, err:agg.err,
  攻勝率: agg.atk ? +(agg.atkWin/agg.atk*100).toFixed(1) : 0,
  出兵:   +(agg.atk/Math.max(1,agg.games)).toFixed(2),
  滅家:   +(agg.atkKill/Math.max(1,agg.games)).toFixed(2),
  空轉率: agg.cmd ? +(agg.cmdWaste/agg.cmd*100).toFixed(1) : 0,
  存活眾: +med(agg.survivors).toFixed(0),
  最強眾: +med(agg.topKoku).toFixed(0),
  眾總石高: +med(agg.totKoku).toFixed(0),
  集中G:  +avg(agg.gini).toFixed(3),
  大名國力: +med(agg.lordPow).toFixed(0),
  存活大名: +med(agg.lordsAlive).toFixed(1),
  同盟: +(agg.ally/Math.max(1,agg.games)).toFixed(2),
  聯姻: +(agg.marr/Math.max(1,agg.games)).toFixed(2),
  切取: +(agg.kiri/Math.max(1,agg.games)).toFixed(2),
  特化階: +med(agg.devTot).toFixed(1),
  被動玩家石高: +med(agg.playerKoku).toFixed(0),
  終年: +med(agg.years).toFixed(0),
  大名從屬眾: +med(agg.lordVassals).toFixed(1),
  無主眾: +med(agg.freeRivals).toFixed(1),
}));
console.log('方針分佈/局:', planTop);
