// 極簡 DOM/Canvas/localStorage 墊片——只為了讓 index.html 的遊戲腳本能在 Node 跑完整模擬
'use strict';

const CTX_METHODS = ['save','restore','beginPath','closePath','moveTo','lineTo','arc','arcTo',
  'quadraticCurveTo','bezierCurveTo','rect','fill','stroke','clip','translate','rotate','scale',
  'setTransform','transform','fillRect','strokeRect','clearRect','fillText','strokeText',
  'drawImage','createLinearGradient','createRadialGradient','createPattern','setLineDash',
  'ellipse','putImageData','getImageData','measureText'];

function makeCtx(){
  const c = {};
  for(const m of CTX_METHODS) c[m] = () => grad;
  const grad = { addColorStop(){} };
  c.createLinearGradient = c.createRadialGradient = () => grad;
  c.measureText = t => ({width: (t||'').length * 6});
  c.getImageData = (x,y,w,h) => ({data:new Uint8ClampedArray(Math.max(4,(w|0)*(h|0)*4))});
  c.canvas = null;
  return c;
}

let idSeq = 0;
class El {
  constructor(tag){
    this.tagName = (tag||'div').toUpperCase();
    this.children = [];
    this.style = new Proxy({}, {get:()=> '', set:()=>true});
    this.dataset = {};
    this._cls = new Set();
    this._text = '';
    this._html = '';
    this.disabled = false;
    this.value = '';
    this.options = [];
    this.width = 0; this.height = 0;
    this.onclick = null; this.onchange = null; this.onfocus = null;
    this._id = ++idSeq;
    this.classList = {
      add: (...c)=> c.forEach(x=>this._cls.add(x)),
      remove: (...c)=> c.forEach(x=>this._cls.delete(x)),
      contains: c => this._cls.has(c),
      toggle: c => this._cls.has(c) ? (this._cls.delete(c), false) : (this._cls.add(c), true)
    };
  }
  get className(){ return [...this._cls].join(' '); }
  set className(v){ this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent(){
    if(this._html) return stripTags(this._html);
    return this._text || this.children.map(c=>c.textContent).join('');
  }
  set textContent(v){ this._text = String(v); this._html = ''; this.children = []; }
  get innerHTML(){ return this._html || this.children.map(c=>c.outerHTML).join(''); }
  set innerHTML(v){
    this._html = String(v); this._text = '';
    // 只解析出 <button> 供 querySelectorAll 用(遊戲的選項按鈕都是 createElement 建的,這裡多半用不到)
    this.children = [];
  }
  get outerHTML(){ return `<${this.tagName.toLowerCase()}>${this.innerHTML}</${this.tagName.toLowerCase()}>`; }
  appendChild(c){ this.children.push(c); c.parentNode = this; return c; }
  insertBefore(c, ref){ const i = this.children.indexOf(ref); this.children.splice(i<0?0:i, 0, c); c.parentNode = this; return c; }
  removeChild(c){ const i = this.children.indexOf(c); if(i>=0) this.children.splice(i,1); return c; }
  remove(){ if(this.parentNode) this.parentNode.removeChild(this); }
  addEventListener(){}
  removeEventListener(){}
  click(){ if(typeof this.onclick === 'function') this.onclick({preventDefault(){}, stopPropagation(){}, isTrusted:true}); }
  focus(){}
  getContext(){ if(!this._ctx){ this._ctx = makeCtx(); this._ctx.canvas = this; } return this._ctx; }
  toDataURL(){ return 'data:,'; }
  getBoundingClientRect(){ return {left:0,top:0,width:this.width||300,height:this.height||150,right:300,bottom:150}; }
  querySelectorAll(sel){ return collect(this, sel); }
  querySelector(sel){ return collect(this, sel)[0] || null; }
  appendTo(p){ p.appendChild(this); return this; }
}
function stripTags(h){ return String(h).replace(/<br\s*\/?>/gi,'').replace(/<[^>]*>/g,''); }
function matches(el, sel){
  sel = sel.trim();
  if(sel === '*') return true;
  if(sel.startsWith('.')) return el._cls.has(sel.slice(1));
  if(sel.startsWith('[')){                                   // [data-x] / [data-x=y]
    const m = sel.match(/^\[([\w-]+)(?:=["']?([^\]"']*)["']?)?\]$/);
    if(!m) return false;
    const key = m[1].replace(/^data-/, '').replace(/-([a-z])/g, (_,c)=>c.toUpperCase());
    return m[2] === undefined ? el.dataset[key] !== undefined : el.dataset[key] === m[2];
  }
  // tag[attr] 組合
  const cm = sel.match(/^([\w-]+)?(\.[\w-]+)?(\[[^\]]+\])?$/);
  if(cm){
    if(cm[1] && el.tagName !== cm[1].toUpperCase()) return false;
    if(cm[2] && !el._cls.has(cm[2].slice(1))) return false;
    if(cm[3] && !matches(el, cm[3])) return false;
    return true;
  }
  return false;
}
function collect(root, sel){
  const parts = sel.split(',').map(s=>s.trim()).filter(Boolean);
  const out = [];
  const walk = n => { for(const c of n.children){ if(parts.some(p=>matches(c,p))) out.push(c); walk(c); } };
  walk(root);
  return out;
}

const byId = new Map();
const doc = {
  createElement: t => new El(t),
  createElementNS: (ns,t) => new El(t),
  getElementById(id){
    if(!byId.has(id)){ const e = new El('div'); e.id = id; byId.set(id, e); }
    return byId.get(id);
  },
  querySelectorAll(sel){ return collect(doc.body, sel); },
  querySelector(sel){ return collect(doc.body, sel)[0] || null; },
  addEventListener(){}, removeEventListener(){},
  documentElement: new El('html'),
  head: new El('head')
};
doc.body = new El('body');
doc.documentElement.appendChild(doc.body);

const store = new Map();
const localStorage = {
  getItem: k => store.has(k) ? store.get(k) : null,
  setItem: (k,v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
  clear: () => store.clear(),
  key: i => [...store.keys()][i],
  get length(){ return store.size; }
};

module.exports = { doc, localStorage, El, makeCtx, byId };
