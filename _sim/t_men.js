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
const LOG=[]; sb.__L=LOG;
vm.runInContext("(function(){const o=log; log=function(m,k){ __L.push(String(m)); return o(m,k); };})();",sb);
const hid=()=>$('modalBack').classList.contains('hidden');
const drain=()=>{let n=0;while(!hid()&&n++<60){const b=$('modalChoices').querySelectorAll('button');if(!b.length){$('modalBack').classList.add('hidden');break;}b[0].click();}};
g.startGame(g.newState('臣',0,'kokujin','gozoku')); drain();
const S=g.S;
console.log('=== ① 開局各家家臣 ===');
S.rivals.forEach(f=>console.log('  '+f.name.padEnd(4), (f.men||[]).map(m=>`${m.name}(武${m.bu}政${m.nai}智${m.chi}・${m.apt||'?'})`).join('、')||'無'));
console.log('\n=== ② 敵將=首席武人 ===');
const kira=S.rivals.find(f=>f.id==='kira');
console.log('  吉良之將:', JSON.stringify(ev('rivalGeneral')(kira).name), '武'+ev('rivalGeneral')(kira).bu);
console.log('\n=== ③ 30年後:延攬/老病/名浪人流向 ===');
S.money=3000; S.rice=9999;
for(let i=0;i<30*4;i++){ g.endSeason(); drain(); if(S.gameOver) break; }
S.rivals.filter(f=>f.alive).forEach(f=>console.log('  '+f.name.padEnd(4)+' 家臣'+(f.men||[]).length+'/'+ev('manCap')(f)+':', (f.men||[]).map(m=>(m.fame?'⭐':'')+m.name+'(武'+m.bu+')').join('、')||'無'));
console.log('\n  延攬記錄:', LOG.filter(l=>/延攬浪人/.test(l)).length, '件');
console.log('  名浪人出仕鄰家:', LOG.filter(l=>/出仕.*帳下為將/.test(l)).join(' / ')||'無');
console.log('  老臣病歿:', LOG.filter(l=>/老臣.*病歿/.test(l)).length, '件');
console.log('  遺臣來投視窗:', LOG.filter(l=>/入幕|轉而出仕/.test(l)).join(' / ')||'(此局無滅家)');
