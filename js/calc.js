// ══════════════════════════════════════════════
//  PRECIFICAFLOW v2.0 — Motor de Cálculo
// ══════════════════════════════════════════════

// ── Tabela ML custo operacional ──────────────
const ML_TABELA = {
  0.3:  [5.65,6.55,7.75,12.35,14.35,16.45,18.45,20.95],
  0.5:  [5.95,6.65,7.85,13.25,15.45,17.65,19.85,22.55],
  1.0:  [6.05,6.75,7.95,13.85,16.15,18.45,20.75,23.65],
  1.5:  [6.15,6.85,8.05,14.15,16.45,18.85,21.15,24.65],
  2.0:  [6.25,6.95,8.15,14.45,16.85,19.25,21.65,24.65],
  3.0:  [6.35,7.95,8.55,15.75,18.35,21.05,23.65,26.25],
  4.0:  [6.45,8.15,8.95,17.05,19.85,22.65,25.55,28.35],
  5.0:  [6.55,8.35,9.75,18.45,21.55,24.65,27.75,30.75],
  6.0:  [6.65,8.55,9.95,25.45,28.55,32.65,35.75,39.75],
  7.0:  [6.75,8.75,10.15,27.05,31.05,36.05,40.05,44.05],
  8.0:  [6.85,8.95,10.35,28.85,33.65,38.45,43.25,48.05],
  9.0:  [6.95,9.15,10.55,29.65,34.55,39.55,44.45,49.35],
  11.0: [7.05,9.55,10.95,41.25,48.05,54.95,61.75,68.65],
};
const ML_PESO_KEYS = [0.3,0.5,1.0,1.5,2.0,3.0,4.0,5.0,6.0,7.0,8.0,9.0,11.0];
const ML_FAIXAS   = [0,19,49,79,100,120,150,200];

function mlCustoOp(peso,preco){
  let pk = ML_PESO_KEYS[ML_PESO_KEYS.length-1];
  for(const k of ML_PESO_KEYS){if(peso<=k){pk=k;break;}}
  let col = ML_FAIXAS.length-1;
  for(let i=1;i<ML_FAIXAS.length;i++){if(preco<ML_FAIXAS[i]){col=i-1;break;}}
  return ML_TABELA[pk][Math.max(0,Math.min(col,7))];
}

// ── Shopee escalonada ─────────────────────────
const SHOPEE_FAIXAS=[
  {max:79.99, pct:0.20,fixo:4},
  {max:99.99, pct:0.14,fixo:16},
  {max:199.99,pct:0.14,fixo:20},
  {max:499.99,pct:0.14,fixo:26},
  {max:Infinity,pct:0.14,fixo:26},
];
function shopeeFaixa(v){return SHOPEE_FAIXAS.find(f=>v<=f.max)||SHOPEE_FAIXAS[4];}

function calcVendaShopee(custo,pBase,lucroP){
  let v=custo/(1-pBase-0.14-lucroP/100);
  for(let i=0;i<60;i++){
    const f=shopeeFaixa(v);
    const vn=(custo+f.fixo)/(1-pBase-f.pct-lucroP/100);
    if(Math.abs(vn-v)<0.001){v=vn;break;}
    v=vn;
  }
  return v;
}

// ── ML iterativo ──────────────────────────────
function calcVendaML(custo,pBase,lucroP,mlTaxa,peso){
  let v=(custo+15)/(1-pBase-mlTaxa-lucroP/100);
  for(let i=0;i<60;i++){
    const op=mlCustoOp(peso,v);
    const vn=(custo+op)/(1-pBase-mlTaxa-lucroP/100);
    if(Math.abs(vn-v)<0.001){v=vn;break;}
    v=vn;
  }
  return v;
}

// ── Magalu ────────────────────────────────────
function calcVendaMagalu(custo,pBase,lucroP){
  const denom=1-pBase-0.148-lucroP/100;
  if(denom<=0)return null;
  return (custo+5)/denom;
}

// ── Taxas maquininha ──────────────────────────
function getTaxaMaquininha(pagamento){
  const map={
    outros:0, debito:'debito', credito1:'cred1', credito2:'cred2',
    credito3:'cred3', credito4:'cred4', credito6:'cred6',
    credito10:'cred10', credito12:'cred12'
  };
  if(pagamento==='outros')return 0;
  const key=map[pagamento];
  if(!key)return 0;
  const el=document.getElementById(`cfg-${key}`);
  return el?(parseFloat(el.value)||0)/100:0;
}

// ── Formato ───────────────────────────────────
function fmt(v){
  if(v==null||!isFinite(v))return'—';
  return'R$ '+v.toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.');
}
function fmtPct(v){return(v*100).toFixed(1)+'%';}

// ── Estado atual ──────────────────────────────
let modo='normal';
let openCascades={};

function getCusto(){
  let base=parseFloat(document.getElementById('f-custo').value)||0;
  const emb=parseFloat(document.getElementById('f-embalagem').value)||0;
  let fil=0,energia=0,mao=0;
  if(modo==='3d'){
    const g=parseFloat(document.getElementById('f-gramas').value)||0;
    const cf=parseFloat(document.getElementById('f-custo-fil').value)||0;
    const h=parseFloat(document.getElementById('f-horas').value)||0;
    const w=parseFloat(document.getElementById('f-watts').value)||0;
    const kwh=parseFloat(document.getElementById('f-kwh').value)||0;
    const maoH=parseFloat(document.getElementById('f-mao-hora').value)||0;
    const maoMin=parseFloat(document.getElementById('f-mao-min').value)||0;
    fil=(g/1000)*cf;
    energia=h*(w/1000)*kwh;
    mao=maoH*(maoMin/60);
    const box=document.getElementById('box-3d');
    if(g||h||maoMin){
      box.style.display='block';
      document.getElementById('v-fil').textContent=fmt(fil);
      document.getElementById('v-energia').textContent=fmt(energia);
      document.getElementById('v-mao').textContent=fmt(mao);
      document.getElementById('v-3d-total').textContent=fmt(base+emb+fil+energia+mao);
    }else{box.style.display='none';}
  }
  return{total:base+emb+fil+energia+mao,emb,fil,energia,mao,base};
}

function getLucros(){return[1,2,3,4].map(i=>parseFloat(document.getElementById(`f-l${i}`).value)||0);}

function getPBase(){
  const pi=(parseFloat(document.getElementById('f-insumos').value)||0)/100;
  const pn=(parseFloat(document.getElementById('f-nf').value)||0)/100;
  const pf=(parseFloat(document.getElementById('f-frete').value)||0)/100;
  return{total:pi+pn+pf,insumos:pi,nf:pn,frete:pf};
}

function getPeso(){return parseFloat(document.getElementById('f-peso').value)||0.3;}

function toggleCascade(id){
  openCascades[id]=!openCascades[id];
  const el=document.getElementById(`cascade-${id}`);
  if(el)el.classList.toggle('open',openCascades[id]);
}

function buildResult(cid,label,venda,lucroRS,lucroP,rows,margemMin){
  const abaixo=lucroP<margemMin;
  const isOpen=openCascades[cid];
  const rowsHtml=rows.map(r=>{
    if(r===null)return`<div class="cascade-divider"></div>`;
    const[lbl,val,cls]=r;
    return`<div class="cascade-row"><span class="cascade-label">${lbl}</span><span class="cascade-val ${cls||''}">${fmt(val)}</span></div>`;
  }).join('');
  return`<div class="result-item${abaixo?' result-warning':''}">
    <div class="result-item-header" onclick="toggleCascade('${cid}')">
      <div><div class="result-meta">${label}${abaixo?'<span class="warn-badge">⚠️ Abaixo do mínimo</span>':''}</div></div>
      <div>
        <div class="result-price">${fmt(venda)}</div>
        <div class="result-lucro">lucro ${fmt(lucroRS)} · ${lucroP}%</div>
      </div>
    </div>
    <div class="result-cascade${isOpen?' open':''}" id="cascade-${cid}">
      ${rowsHtml}
    </div>
  </div>`;
}

function buildMPResults(containerId,results){
  const el=document.getElementById(containerId);
  if(!results||!results.length){el.innerHTML='<p class="no-result">—</p>';return;}
  el.innerHTML=results.map(r=>buildResult(r.cid,r.label,r.venda,r.lucroRS,r.lucroP,r.rows,r.margemMin)).join('');
}

// ── CALCULAR PRINCIPAL ────────────────────────
function calcular(){
  const custoObj=getCusto();
  const custo=custoObj.total;
  const pb=getPBase();
  const lucros=getLucros();
  const peso=getPeso();
  const margemMin=parseFloat(document.getElementById('f-margem-min').value)||10;
  const alertEl=document.getElementById('alert-custo');
  const btnSalvar=document.getElementById('btn-salvar');
  const btnExport=document.getElementById('btn-export');

  if(!custo){
    alertEl.style.display='block';
    btnSalvar.style.display='none';
    btnExport.style.display='none';
    ['ml-results','shopee-results','tiktok-results','magalu-results','direta-results']
      .forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML='';});
    document.getElementById('ml-custo-op').textContent='';
    document.getElementById('vd-taxa-info').textContent='';
    return;
  }
  alertEl.style.display='none';
  btnSalvar.style.display='block';
  btnExport.style.display='block';

  // ─ ML ─
  const mlTaxa=(parseFloat(document.getElementById('ml-taxa').value)||0)/100;
  const mlResults=lucros.map((l,i)=>{
    const venda=calcVendaML(custo,pb.total,l,mlTaxa,peso);
    if(!venda||!isFinite(venda)||venda<=0)return null;
    const op=mlCustoOp(peso,venda);
    const taxaRS=venda*mlTaxa;
    const lucroRS=venda*(l/100);
    return{cid:`ml-${i}`,label:`${l}% de lucro`,venda,lucroRS,lucroP:l,margemMin,rows:[
      [`Taxa ML ${(mlTaxa*100).toFixed(1)}%`,taxaRS,'cascade-neg'],
      [`Custo operacional (${peso}kg)`,op,'cascade-neg'],
      [`Insumos ${(pb.insumos*100).toFixed(0)}%`,venda*pb.insumos,'cascade-neg'],
      [`Nota fiscal ${(pb.nf*100).toFixed(0)}%`,venda*pb.nf,'cascade-neg'],
      pb.frete?[`Frete ${(pb.frete*100).toFixed(0)}%`,venda*pb.frete,'cascade-neg']:null,
      custoObj.emb?['Embalagem',custoObj.emb,'cascade-neg']:null,
      custoObj.energia?['Energia elétrica',custoObj.energia,'cascade-neg']:null,
      custoObj.fil?['Filamento',custoObj.fil,'cascade-neg']:null,
      custoObj.mao?['Mão de obra',custoObj.mao,'cascade-neg']:null,
      custoObj.base?['Custo produto',custoObj.base,'cascade-neg']:null,
      null,
      ['Lucro líquido',lucroRS,'cascade-pos'],
    ].filter(r=>r===null||r)};
  }).filter(Boolean);
  if(mlResults.length){
    const op0=mlCustoOp(peso,mlResults[0].venda);
    document.getElementById('ml-custo-op').textContent=
      `Custo operacional estimado: ${fmt(op0)} (${peso}kg)`;
  }
  buildMPResults('ml-results',mlResults);

  // ─ Shopee ─
  const shopeeResults=lucros.map((l,i)=>{
    const venda=calcVendaShopee(custo,pb.total,l);
    if(!venda||!isFinite(venda)||venda<=0)return null;
    const f=shopeeFaixa(venda);
    const taxaRS=venda*f.pct+f.fixo;
    const lucroRS=venda*(l/100);
    return{cid:`sh-${i}`,label:`${l}% de lucro`,venda,lucroRS,lucroP:l,margemMin,rows:[
      [`Comissão Shopee (${(f.pct*100).toFixed(0)}%+R$${f.fixo})`,taxaRS,'cascade-neg'],
      [`Insumos ${(pb.insumos*100).toFixed(0)}%`,venda*pb.insumos,'cascade-neg'],
      [`Nota fiscal ${(pb.nf*100).toFixed(0)}%`,venda*pb.nf,'cascade-neg'],
      pb.frete?[`Frete ${(pb.frete*100).toFixed(0)}%`,venda*pb.frete,'cascade-neg']:null,
      custoObj.emb?['Embalagem',custoObj.emb,'cascade-neg']:null,
      custoObj.energia?['Energia elétrica',custoObj.energia,'cascade-neg']:null,
      custoObj.fil?['Filamento',custoObj.fil,'cascade-neg']:null,
      custoObj.mao?['Mão de obra',custoObj.mao,'cascade-neg']:null,
      custoObj.base?['Custo produto',custoObj.base,'cascade-neg']:null,
      null,
      ['Lucro líquido',lucroRS,'cascade-pos'],
    ].filter(r=>r===null||r)};
  }).filter(Boolean);
  buildMPResults('shopee-results',shopeeResults);

  // ─ TikTok ─
  const ttTaxa=(parseFloat(document.getElementById('tt-taxa').value)||0)/100;
  const ttAfil=(parseFloat(document.getElementById('tt-afil').value)||0)/100;
  const ttResults=lucros.map((l,i)=>{
    const denom=1-pb.total-ttTaxa-ttAfil-l/100;
    if(denom<=0)return null;
    const venda=custo/denom;
    const lucroRS=venda*(l/100);
    return{cid:`tt-${i}`,label:`${l}% de lucro`,venda,lucroRS,lucroP:l,margemMin,rows:[
      [`Taxa TikTok ${(ttTaxa*100).toFixed(0)}%`,venda*ttTaxa,'cascade-neg'],
      [`Afiliado ${(ttAfil*100).toFixed(0)}%`,venda*ttAfil,'cascade-neg'],
      [`Insumos ${(pb.insumos*100).toFixed(0)}%`,venda*pb.insumos,'cascade-neg'],
      [`Nota fiscal ${(pb.nf*100).toFixed(0)}%`,venda*pb.nf,'cascade-neg'],
      pb.frete?[`Frete ${(pb.frete*100).toFixed(0)}%`,venda*pb.frete,'cascade-neg']:null,
      custoObj.emb?['Embalagem',custoObj.emb,'cascade-neg']:null,
      custoObj.energia?['Energia elétrica',custoObj.energia,'cascade-neg']:null,
      custoObj.fil?['Filamento',custoObj.fil,'cascade-neg']:null,
      custoObj.mao?['Mão de obra',custoObj.mao,'cascade-neg']:null,
      custoObj.base?['Custo produto',custoObj.base,'cascade-neg']:null,
      null,
      ['Lucro líquido',lucroRS,'cascade-pos'],
    ].filter(r=>r===null||r)};
  }).filter(Boolean);
  buildMPResults('tiktok-results',ttResults);

  // ─ Magalu ─
  const mgResults=lucros.map((l,i)=>{
    const venda=calcVendaMagalu(custo,pb.total,l);
    if(!venda||!isFinite(venda)||venda<=0)return null;
    const lucroRS=venda*(l/100);
    return{cid:`mg-${i}`,label:`${l}% de lucro`,venda,lucroRS,lucroP:l,margemMin,rows:[
      ['Taxa Magalu 14,8%',venda*0.148,'cascade-neg'],
      ['Custo fixo por unidade',5,'cascade-neg'],
      [`Insumos ${(pb.insumos*100).toFixed(0)}%`,venda*pb.insumos,'cascade-neg'],
      [`Nota fiscal ${(pb.nf*100).toFixed(0)}%`,venda*pb.nf,'cascade-neg'],
      pb.frete?[`Frete ${(pb.frete*100).toFixed(0)}%`,venda*pb.frete,'cascade-neg']:null,
      custoObj.emb?['Embalagem',custoObj.emb,'cascade-neg']:null,
      custoObj.energia?['Energia elétrica',custoObj.energia,'cascade-neg']:null,
      custoObj.fil?['Filamento',custoObj.fil,'cascade-neg']:null,
      custoObj.mao?['Mão de obra',custoObj.mao,'cascade-neg']:null,
      custoObj.base?['Custo produto',custoObj.base,'cascade-neg']:null,
      null,
      ['Lucro líquido',lucroRS,'cascade-pos'],
    ].filter(r=>r===null||r)};
  }).filter(Boolean);
  buildMPResults('magalu-results',mgResults);

  // ─ Venda Direta ─
  const pagamento=document.getElementById('vd-pagamento').value;
  const taxaMaq=getTaxaMaquininha(pagamento);
  const vdInfoEl=document.getElementById('vd-taxa-info');
  if(taxaMaq>0){
    const labels={debito:'Débito',credito1:'Crédito 1x',credito2:'Crédito 2x',
      credito3:'Crédito 3x',credito4:'Crédito 4x',credito6:'Crédito 6x',
      credito10:'Crédito 10x',credito12:'Crédito 12x'};
    vdInfoEl.textContent=`Taxa maquininha (${labels[pagamento]||pagamento}): ${(taxaMaq*100).toFixed(1)}%`;
  }else{vdInfoEl.textContent='';}

  const vdResults=lucros.map((l,i)=>{
    const denom=1-pb.total-taxaMaq-l/100;
    if(denom<=0)return null;
    const venda=custo/denom;
    const lucroRS=venda*(l/100);
    return{cid:`vd-${i}`,label:`${l}% de lucro`,venda,lucroRS,lucroP:l,margemMin,rows:[
      taxaMaq?[`Maquininha ${(taxaMaq*100).toFixed(1)}%`,venda*taxaMaq,'cascade-neg']:null,
      [`Insumos ${(pb.insumos*100).toFixed(0)}%`,venda*pb.insumos,'cascade-neg'],
      [`Nota fiscal ${(pb.nf*100).toFixed(0)}%`,venda*pb.nf,'cascade-neg'],
      pb.frete?[`Frete ${(pb.frete*100).toFixed(0)}%`,venda*pb.frete,'cascade-neg']:null,
      custoObj.emb?['Embalagem',custoObj.emb,'cascade-neg']:null,
      custoObj.energia?['Energia elétrica',custoObj.energia,'cascade-neg']:null,
      custoObj.fil?['Filamento',custoObj.fil,'cascade-neg']:null,
      custoObj.mao?['Mão de obra',custoObj.mao,'cascade-neg']:null,
      custoObj.base?['Custo produto',custoObj.base,'cascade-neg']:null,
      null,
      ['Lucro líquido',lucroRS,'cascade-pos'],
    ].filter(r=>r===null||r)};
  }).filter(Boolean);
  buildMPResults('direta-results',vdResults);
}

// ── SIMULADOR ─────────────────────────────────
function simAtualizar(){
  const custo=parseFloat(document.getElementById('sim-custo').value)||50;
  const lucro=parseFloat(document.getElementById('sim-lucro').value)||15;
  const desp=(parseFloat(document.getElementById('sim-desp').value)||11)/100;
  const peso=parseFloat(document.getElementById('sim-peso').value)||0.3;
  document.getElementById('sim-custo-val').textContent=fmt(custo);
  document.getElementById('sim-lucro-val').textContent=lucro+'%';
  document.getElementById('sim-desp-val').textContent=(desp*100).toFixed(1)+'%';
  document.getElementById('sim-peso-val').textContent=peso.toFixed(1)+' kg';

  const mps=[
    {id:'ml',name:'Mercado Livre',badge:'ML',bg:'#FFE600',fg:'#000',
      calc:()=>calcVendaML(custo,desp,lucro,0.14,peso)},
    {id:'sh',name:'Shopee',badge:'SP',bg:'#EE4D2D',fg:'#fff',
      calc:()=>calcVendaShopee(custo,desp,lucro)},
    {id:'tt',name:'TikTok Shop',badge:'TT',bg:'#111',fg:'#00c87a',
      calc:()=>{const d=1-desp-0.11-lucro/100;return d>0?custo/d:null;}},
    {id:'mg',name:'Magalu',badge:'MG',bg:'#0086FF',fg:'#fff',
      calc:()=>calcVendaMagalu(custo,desp,lucro)},
    {id:'vd',name:'Venda Direta',badge:'VD',bg:'#00c87a',fg:'#000',
      calc:()=>{const d=1-desp-lucro/100;return d>0?custo/d:null;}},
  ];
  const el=document.getElementById('sim-results');
  el.innerHTML=mps.map(mp=>{
    const v=mp.calc();
    const lucroRS=v?v*(lucro/100):null;
    return`<div class="sim-row">
      <div class="mp-badge" style="background:${mp.bg};color:${mp.fg};width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex-shrink:0">${mp.badge}</div>
      <span class="sim-mp-name">${mp.name}</span>
      <span class="sim-price">${v?fmt(v):'—'}</span>
      <span class="sim-lucro">${lucroRS?fmt(lucroRS):''}</span>
    </div>`;
  }).join('');
}

// ── ML tipo changed ───────────────────────────
function mlTipoChanged(){
  const tipo=document.getElementById('ml-tipo').value;
  const taxaEl=document.getElementById('ml-taxa');
  if(tipo==='classico'&&parseFloat(taxaEl.value)>16)taxaEl.value=14;
  if(tipo==='premium'&&parseFloat(taxaEl.value)<15)taxaEl.value=19;
  calcular();
}

function setMode(m){
  modo=m;
  document.getElementById('mode-normal').classList.toggle('active',m==='normal');
  document.getElementById('mode-3d').classList.toggle('active',m==='3d');
  document.getElementById('card-3d').style.display=m==='3d'?'block':'none';
  calcular();
}

function aplicarPreset(){
  const v=document.getElementById('f-impressora').value;
  if(v&&v!=='custom'){document.getElementById('f-watts').value=v;calcular();}
}

// ── Export PDF básico ─────────────────────────
function exportarPDF(){
  const nome=document.getElementById('f-nome').value||'Produto';
  window.print();
}

// ── MARGEM ATUAL ──────────────────────────────
function calcularMargemAtual(){
  const custo = getCusto().total;
  const pb = getPBase();
  const margemMin = parseFloat(document.getElementById('f-margem-min').value)||10;
  const box = document.getElementById('box-margens-atuais');
  if(!custo){box.style.display='none';return;}

  const mps = [
    {id:'ml',    label:'Mercado Livre', preco: parseFloat(document.getElementById('f-preco-ml').value)||0,
      getTaxa: (v)=>{ const t=(parseFloat(document.getElementById('ml-taxa').value)||0)/100; const op=mlCustoOp(parseFloat(document.getElementById('f-peso').value)||0.3,v); return v*t+op; }},
    {id:'shopee',label:'Shopee',        preco: parseFloat(document.getElementById('f-preco-shopee').value)||0,
      getTaxa: (v)=>{ const f=shopeeFaixa(v); return v*f.pct+f.fixo; }},
    {id:'tiktok',label:'TikTok Shop',   preco: parseFloat(document.getElementById('f-preco-tiktok').value)||0,
      getTaxa: (v)=>{ const tt=(parseFloat(document.getElementById('tt-taxa').value)||0)/100; const ta=(parseFloat(document.getElementById('tt-afil').value)||0)/100; return v*(tt+ta); }},
    {id:'magalu',label:'Magalu',        preco: parseFloat(document.getElementById('f-preco-magalu').value)||0,
      getTaxa: (v)=>v*0.148+5},
    {id:'direta',label:'Venda Direta',  preco: parseFloat(document.getElementById('f-preco-direta').value)||0,
      getTaxa: (v)=>{ const tm=getTaxaMaquininha(document.getElementById('vd-pagamento').value); return v*tm; }},
  ].filter(m=>m.preco>0);

  if(!mps.length){box.style.display='none';return;}
  box.style.display='block';

  let html='<div class="margens-atuais">';
  html+='<div class="margens-title">📊 Margem real nos seus preços atuais</div>';
  mps.forEach(m=>{
    const v=m.preco;
    const taxaRS=m.getTaxa(v);
    const despRS=v*pb.total;
    const lucroRS=v-custo-taxaRS-despRS;
    const lucroP=(lucroRS/v)*100;
    const abaixo=lucroP<margemMin;
    const cor=lucroP<0?'var(--red)':abaixo?'var(--yellow)':'var(--green)';
    html+=`<div class="margem-row ${abaixo?'margem-warn':''}">
      <span class="margem-mp">${m.label}</span>
      <span class="margem-preco">${fmt(v)}</span>
      <span class="margem-lucro" style="color:${cor}">${lucroP.toFixed(1)}% · ${fmt(lucroRS)}</span>
      ${abaixo?'<span class="margem-alert">⚠️</span>':'<span class="margem-ok">✓</span>'}
    </div>`;
  });
  html+='</div>';
  box.innerHTML=html;
}


// ── LIMPAR FORMULÁRIO ────────────────────────
function limparFormulario(){
  var textFields=['f-nome','f-custo','f-embalagem','f-comp','f-alt','f-larg',
    'f-sku','f-ean','f-fornecedor','f-obs',
    'f-gramas','f-custo-fil','f-horas','f-mao-min',
    'f-preco-ml','f-preco-shopee','f-preco-tiktok','f-preco-magalu','f-preco-direta'];
  textFields.forEach(function(id){
    var el=document.getElementById(id);
    if(el) el.value='';
  });
  // Reset numeric defaults
  var defaults={'f-peso':'0.3','f-watts':'350','f-kwh':'0.90','f-mao-hora':'35','f-embalagem':'0',
    'f-insumos':'3','f-nf':'8','f-frete':'0','f-margem-min':'10',
    'f-l1':'5','f-l2':'10','f-l3':'15','f-l4':'20','ml-taxa':'14','tt-taxa':'6','tt-afil':'5'};
  Object.keys(defaults).forEach(function(id){
    var el=document.getElementById(id);
    if(el) el.value=defaults[id];
  });
  // Reset selects
  var selects={'f-categoria':'','ml-tipo':'classico','ml-envio':'proprio',
    'vd-pagamento':'outros','f-impressora':''};
  Object.keys(selects).forEach(function(id){
    var el=document.getElementById(id);
    if(el) el.value=selects[id];
  });
  // Reset mode
  if(typeof setMode==='function') setMode('normal');
  // Clear results
  ['ml-results','shopee-results','tiktok-results','magalu-results','direta-results']
    .forEach(function(id){var el=document.getElementById(id);if(el)el.innerHTML='';});
  var els={
    'ml-custo-op':'textContent','vd-taxa-info':'textContent'
  };
  Object.keys(els).forEach(function(id){
    var el=document.getElementById(id);
    if(el) el[els[id]]='';
  });
  var boxMarg=document.getElementById('box-margens-atuais');
  if(boxMarg){boxMarg.style.display='none';boxMarg.innerHTML='';}
  var box3d=document.getElementById('box-3d');
  if(box3d) box3d.style.display='none';
  var alertEl=document.getElementById('alert-custo');
  if(alertEl) alertEl.style.display='block';
  var btnSalvar=document.getElementById('btn-salvar');
  var btnExport=document.getElementById('btn-export');
  if(btnSalvar) btnSalvar.style.display='none';
  if(btnExport) btnExport.style.display='none';
}

// ── DASHBOARD CHART ──────────────────────────
function renderDashChart(produtos){
  var card=document.getElementById('dash-chart-card');
  var el=document.getElementById('dash-chart');
  if(!card||!el||!produtos.length){if(card)card.style.display='none';return;}

  var months={};
  produtos.forEach(function(p){
    if(!p.savedAt)return;
    var d=new Date(p.savedAt);
    var key=d.getFullYear()+'-'+(d.getMonth()+1).toString().padStart(2,'0');
    var label=d.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'});
    if(!months[key])months[key]={label:label,margens:[],custos:[]};
    var pb=((p.insumos||0)+(p.nf||0)+(p.frete||0))/100;
    var custo=(p.custo||0)+(p.embalagem||0);
    var vml=calcVendaML(custo,pb,10,(p.ml_taxa||14)/100,p.peso||0.3);
    if(vml&&isFinite(vml)){
      var marg=(vml-custo-vml*pb-mlCustoOp(p.peso||0.3,vml))/vml*100;
      months[key].margens.push(marg);
    }
    months[key].custos.push(custo);
  });

  var keys=Object.keys(months).sort().slice(-6);
  if(keys.length<2){card.style.display='none';return;}
  card.style.display='block';

  var avgMargens=keys.map(function(k){
    var m=months[k].margens;
    return m.length?m.reduce(function(a,b){return a+b;},0)/m.length:0;
  });
  var avgCustos=keys.map(function(k){
    var c=months[k].custos;
    return c.length?c.reduce(function(a,b){return a+b;},0)/c.length:0;
  });
  var labels=keys.map(function(k){return months[k].label;});
  var maxMarg=Math.max.apply(null,avgMargens)||1;
  var maxCusto=Math.max.apply(null,avgCustos)||1;

  var html='<div class="dchart"><div class="dchart-bars">';
  keys.forEach(function(k,i){
    var mH=Math.round((avgMargens[i]/maxMarg)*120);
    var cH=Math.round((avgCustos[i]/maxCusto)*120);
    var mColor=avgMargens[i]<10?'var(--yellow)':'var(--green)';
    html+='<div class="dchart-col">';
    html+='<div class="dchart-vals"><span style="font-size:10px;color:'+mColor+';font-weight:700">'+avgMargens[i].toFixed(1)+'%</span></div>';
    html+='<div class="dchart-bar-wrap">';
    html+='<div class="dchart-bar" style="height:'+mH+'px;background:'+mColor+'" title="Margem: '+avgMargens[i].toFixed(1)+'%"></div>';
    html+='<div class="dchart-bar" style="height:'+cH+'px;background:var(--blue);opacity:0.6" title="Custo: '+fmt(avgCustos[i])+'"></div>';
    html+='</div>';
    html+='<div class="dchart-label">'+labels[i]+'</div>';
    html+='</div>';
  });
  html+='</div></div>';
  el.innerHTML=html;
}

