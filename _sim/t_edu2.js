const fs=require('fs'),path=require('path'),vm=require('vm');
const {doc,localStorage}=require('./shim');
const src=[...fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)][0][1];
const sb={document:doc,localStorage,console,Math,JSON,Date,performance:{now:()=>Date.now()},
 setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame:()=>0,Image:class{},
 navigator:{userAgent:'node'},alert:()=>{},confirm:()=>true,
 matchMedia:()=>({matches:false,addListener(){},addEventListener(){}}),location:{port:'5877',reload(){},replace(){}}};
sb.window=sb;sb.globalThis=sb;vm.createContext(sb);
const LOG=[];
vm.runInContext(src,sb,{filename:'game.js'});
vm.runInContext("render=function(){if(S){armySync();aptSync();}};drawMap=function(){};save=function(){};",sb);
sb.__L=LOG;
vm.runInContext("(function(){const o=log; log=function(m,k){ __L.push(String(m)); return o(m,k); };})();",sb);
const g=sb.window.__game,ev=c=>vm.runInContext(c,sb),$=id=>doc.getElementById(id);
$('modalBack').classList.add('hidden');
const drain=()=>{let n=0;while(!$('modalBack').classList.contains('hidden')===false&&n++<40){const b=$('modalChoices').querySelectorAll('button');if(!b.length){$('modalBack').classList.add('hidden');break;}b[0].click();}};
g.startGame(g.newState('育',0,'kokujin','gozoku')); drain();
const S=g.S;
S.retainers=[S.retainers[0]];
S.children=[{name:'竹千代',sex:'m',age:6,eduBu:0,eduNai:0,eduChi:0}];
const lines=[]; ev('succession')(lines,'病歿'); drain();
ev('rosterAdd')({name:'傅役甲',role:'傅役',kind:'譜代',age:40,bu:70,nai:70,chi:70,task:'educate',merit:0,salary:10,loyalty:80,rank:0,stamina:100});
S.money=9999;S.rice=99999;
LOG.length=0;
S.retainers.forEach((r,i)=>{ if(i>0) r.task='educate'; });
g.endSeason(); drain();
console.log('=== 教育任務的 log ===');
console.log(LOG.filter(l=>/教導子弟/.test(l)).join('\n') || '(無)');
console.log('\n=== 幼主詳情頁 ===');
$('modalBack').classList.add('hidden');
ev('openRetainer')(0);
console.log($('modalBody').textContent.split('\n').filter(l=>/髫齡|五成半/.test(l)).join('\n') || '(無髫齡欄)');
// 跑到親政
for(let y=0;y<10;y++){ for(let s=0;s<4;s++){ S.retainers.forEach((r,i)=>{if(i>0){r.task='educate';r.stamina=100;}}); LOG.length=0; g.endSeason(); drain(); if(S.gameOver)break; } if(S.gameOver||S.retainers[0].role==='當主')break; }
console.log('\n=== 親政訊息 ===');
console.log(LOG.filter(l=>/元服親政/.test(l)).join('\n') || (function(){
  // 親政訊息在歲末報告的 lines 裡,改抓 modal body
  return '(見歲末報告)'; })());
console.log('親政後:', S.retainers[0].name, S.retainers[0].role, '武'+S.retainers[0].bu,'政'+S.retainers[0].nai,'智'+S.retainers[0].chi);
