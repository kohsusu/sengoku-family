const fs=require('fs'),path=require('path'),vm=require('vm');
const {doc,localStorage}=require('./shim');
const src=[...fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)][0][1];
const sb={document:doc,localStorage,console,Math,JSON,Date,performance:{now:()=>Date.now()},
 setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame:()=>0,Image:class{},
 navigator:{userAgent:'node'},alert:()=>{},confirm:()=>true,
 matchMedia:()=>({matches:false,addListener(){},addEventListener(){}}),location:{port:'5877',reload(){},replace(){}}};
sb.window=sb;sb.globalThis=sb;vm.createContext(sb);
vm.runInContext(src,sb,{filename:'game.js'});
vm.runInContext("render=function(){if(S){armySync();aptSync();}};drawMap=function(){};save=function(){};",sb);
const g=sb.window.__game,ev=c=>vm.runInContext(c,sb),$=id=>doc.getElementById(id);
$('modalBack').classList.add('hidden');
g.startGame(g.newState('地',0,'kokujin','gozoku'));
let gd=0;
while(!$('modalBack').classList.contains('hidden')&&gd++<20){
  const b=$('modalChoices').querySelectorAll('button'); if(!b.length){$('modalBack').classList.add('hidden');break;} b[0].click();}
const S=g.S;
console.log('=== 各家的鄰境 ===');
S.rivals.forEach(f=>{
  const nb=ev('neighborsOf')(f);
  console.log('  '+f.name.padEnd(4)+'('+f.gun+' '+f.seat+')  鄰境 '+nb.length+' 家:'+nb.map(x=>x.name+'('+Math.round(ev('rdist')(f,x))+')').join('、'));
});
console.log('\n=== 玩家(三河・岡崎近郊)的鄰境 ===');
const mine=ev('myNeighbors')();
console.log('  '+mine.map(x=>x.name+'('+Math.round(ev('pdist')(x))+'・'+ev('distLabel')(x)+')').join('\n  '));
console.log('  非鄰境:'+S.rivals.filter(f=>!mine.includes(f)).map(x=>x.name+'('+Math.round(ev('pdist')(x))+')').join('、'));
console.log('\n=== 永不相見的組合(距離 >150) ===');
const far=[];
S.rivals.forEach((a,i)=>S.rivals.forEach((b,j)=>{ if(i<j && ev('rdist')(a,b)>150) far.push(a.name+'⇄'+b.name+'('+Math.round(ev('rdist')(a,b))+')'); }));
console.log('  '+far.length+' 組:'+far.join('、'));
