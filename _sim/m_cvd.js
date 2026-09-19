// 色覺多樣性:以實際渲染的樣子(alpha .52 疊在和紙底色)量 ΔE,比較一般色覺與紅綠色盲
'use strict';
const fs=require('fs'),path=require('path');
const H=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const blk=H.slice(H.indexOf('const LORDC = {'), H.indexOf('};', H.indexOf('const LORDC = {')));
const C={}; for(const m of blk.matchAll(/(\w+):'(#[0-9a-f]{6})'/g)) C[m[1]]=m[2];
const PAPER=(H.match(/const MAP_PAPER = '(#[0-9a-f]{6})'/)||[])[1];
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
const lin=v=>v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);
const blend=(c,a)=>{const p=hex(PAPER),q=hex(c);return q.map((v,i)=>v*a+p[i]*(1-a));};
// Machado 2009,嚴重度 1.0
const M={normal:[[1,0,0],[0,1,0],[0,0,1]],
  deutan:[[0.367322,0.860646,-0.227968],[0.280085,0.672501,0.047413],[-0.011820,0.042940,0.968881]],
  protan:[[0.152286,1.052583,-0.204868],[0.114503,0.786281,0.099216],[-0.003882,-0.048116,1.051998]]};
const toLab=(rgbLin)=>{
  const [r,g,b]=rgbLin;
  const X=(0.4124*r+0.3576*g+0.1805*b)/0.95047, Y=0.2126*r+0.7152*g+0.0722*b, Z=(0.0193*r+0.1192*g+0.9505*b)/1.08883;
  const f=t=>t>0.008856?Math.cbrt(t):7.787*t+16/116;
  return [116*f(Y)-16, 500*(f(X)-f(Y)), 200*(f(Y)-f(Z))];
};
const lab=(h,mode)=>{
  const s=blend(h,0.52).map(lin);
  const m=M[mode]; const t=m.map(row=>Math.max(0,Math.min(1,row[0]*s[0]+row[1]*s[1]+row[2]*s[2])));
  return toLab(t);
};
const dE=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
// 開局就相鄰、且同一時代並存的陣營(東海道核心)
const CORE=['imagawa','oda','takeda','saito','player','tokugawa','nagao','hojo','asakura','rokkaku','azai','kitabatake'];
const rows=[];
for(let i=0;i<CORE.length;i++) for(let j=i+1;j<CORE.length;j++){
  const a=CORE[i],b=CORE[j]; if(!C[a]||!C[b]) continue;
  rows.push({p:a+'↔'+b, n:dE(lab(C[a],'normal'),lab(C[b],'normal')),
    d:dE(lab(C[a],'deutan'),lab(C[b],'deutan')), pr:dE(lab(C[a],'protan'),lab(C[b],'protan'))});
}
const lt=(k,v)=>rows.filter(r=>r[k]<v).length;
console.log('和紙底色', PAPER, '· 核心陣營', CORE.length, '家 ·', rows.length, '對');
console.log('ΔE<10(難辨)  一般色覺', lt('n',10), '對  紅綠色盲(deutan)', lt('d',10), '對  (protan)', lt('pr',10), '對');
console.log('\n紅綠色盲下最難分的八對:');
rows.sort((a,b)=>a.d-b.d).slice(0,8).forEach(r=>console.log('  '+r.p.padEnd(22)+' 一般 '+r.n.toFixed(1).padStart(5)+'  →  deutan '+r.d.toFixed(1).padStart(5)+'  protan '+r.pr.toFixed(1).padStart(5)));
