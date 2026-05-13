// ══════════════════════════════════════════════
//  PRECIFICAFLOW v2.0 — App Principal
// ══════════════════════════════════════════════

let currentUser = null;
let db = null;
let compareList = [];

// ── ACCESS CONTROL ───────────────────────────
const TRIAL_DAYS = 2;
const PRICE_MONTHLY = 19.90;
// Cupons: adicione/remova no Firebase em /coupons/{CODIGO}
// Cada documento: { type: 'lifetime' | 'trial', days: 30, active: true }

async function checkAccess(user){
  if(!db) return false;
  try{
    // 1. Verifica acesso no Firestore do usuário
    const userDoc = await db.collection('users').doc(user.uid).get();
    const data = userDoc.exists ? userDoc.data() : {};

    // Acesso vitalício por cupom
    if(data.access === 'lifetime') return true;

    // Assinatura ativa via Stripe
    if(data.stripeStatus === 'active') return true;

    // Período de teste
    if(data.trialStart){
      const start = data.trialStart.toDate ? data.trialStart.toDate() : new Date(data.trialStart);
      const diff = (new Date() - start) / (1000*60*60*24);
      if(diff < TRIAL_DAYS) return true;
    } else {
      // Primeiro acesso — inicia trial
      await db.collection('users').doc(user.uid).set({
        trialStart: new Date(),
        email: user.email,
        displayName: user.displayName,
        createdAt: new Date()
      }, {merge:true});
      return true;
    }
    return false;
  } catch(e){ console.error(e); return false; }
}

async function getTrialDaysLeft(user){
  try{
    const doc = await db.collection('users').doc(user.uid).get();
    const data = doc.exists ? doc.data() : {};
    if(!data.trialStart) return TRIAL_DAYS;
    const start = data.trialStart.toDate ? data.trialStart.toDate() : new Date(data.trialStart);
    const diff = (new Date() - start) / (1000*60*60*24);
    return Math.max(0, Math.ceil(TRIAL_DAYS - diff));
  } catch(e){ return 0; }
}

async function aplicarCupom(){
  const code = document.getElementById('coupon-input').value.trim().toUpperCase();
  const msg = document.getElementById('coupon-msg');
  if(!code){ msg.style.color='var(--red)'; msg.textContent='Digite um cupom.'; return; }
  msg.style.color='var(--text2)'; msg.textContent='Verificando...';
  try{
    const doc = await db.collection('coupons').doc(code).get();
    if(!doc.exists || !doc.data().active){
      msg.style.color='var(--red)'; msg.textContent='Cupom inválido ou expirado.'; return;
    }
    const coupon = doc.data();
    const update = {};
    if(coupon.type === 'lifetime'){
      update.access = 'lifetime';
      update.couponUsed = code;
      msg.style.color='var(--green)'; msg.textContent='✓ Acesso vitalício liberado!';
    } else if(coupon.type === 'trial'){
      const days = coupon.days || 30;
      const newStart = new Date(new Date() - (TRIAL_DAYS - days)*24*60*60*1000);
      update.trialStart = newStart;
      update.couponUsed = code;
      msg.style.color='var(--green)'; msg.textContent='✓ '+days+' dias grátis ativados!';
    }
    await db.collection('users').doc(currentUser.uid).set(update, {merge:true});
    // Marca cupom como usado (opcional — remova se quiser reutilizável)
    // await db.collection('coupons').doc(code).set({usedBy: currentUser.uid}, {merge:true});
    setTimeout(()=>iniciarApp(), 1200);
  } catch(e){ msg.style.color='var(--red)'; msg.textContent='Erro: '+e.message; }
}

function irParaStripe(){
  // Substitua pela URL do seu Payment Link do Stripe
  // Crie em: dashboard.stripe.com → Payment Links → + Create
  // Adicione ?client_reference_id=UID para identificar o usuário
  const stripeUrl = 'https://buy.stripe.com/28E00l6DO3F6b1E31q2ZO00';
  window.open(stripeUrl + '?client_reference_id=' + (currentUser ? currentUser.uid : ''), '_blank');
  showToast('Você será redirecionado ao pagamento seguro', 'success');
}

function mostrarPaywall(daysLeft){
  document.getElementById('screen-auth').classList.remove('active');
  document.getElementById('screen-app').classList.remove('active');
  document.getElementById('screen-paywall').classList.add('active');
  if(daysLeft === 0){
    const title = document.querySelector('#paywall-content .auth-sub');
    if(title) title.textContent = 'Seu período de teste encerrou — assine para continuar';
  }
}

async function iniciarApp(){
  db = firebase.firestore();
  const hasAccess = await checkAccess(currentUser);
  if(hasAccess){
    const daysLeft = await getTrialDaysLeft(currentUser);
    document.getElementById('screen-auth').classList.remove('active');
    document.getElementById('screen-paywall').classList.remove('active');
    document.getElementById('screen-app').classList.add('active');
    document.getElementById('user-info').textContent = currentUser.displayName || currentUser.email;
    document.getElementById('user-avatar').textContent = currentUser.displayName ? currentUser.displayName.split(' ')[0] : '👤';
    // Mostra dias restantes no trial
    if(daysLeft > 0 && daysLeft <= TRIAL_DAYS){
      const el = document.getElementById('user-info');
      el.textContent = (currentUser.displayName || currentUser.email) + ' · ' + daysLeft + 'd trial';
    }
    showPage('dashboard');
    loadDashboard();
  } else {
    mostrarPaywall(0);
  }
}

// ── AUTH ──────────────────────────────────────
function loginGoogle(){
  const cb = document.getElementById('terms-accept');
  if(cb && !cb.checked){
    const err = document.getElementById('terms-error');
    if(err) err.style.display='block';
    return;
  }
  const p=new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(p).then(function(result){
    if(result.user) registrarAceiteTermos(result.user);
  }).catch(function(e){ showToast('Erro no login: '+e.message,'error'); });
}
function logout(){firebase.auth().signOut();}

// ── NAVEGAÇÃO ─────────────────────────────────
function showPage(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const pg=document.getElementById(`page-${page}`);
  const nav=document.querySelector(`[data-page="${page}"]`);
  if(pg)pg.classList.add('active');
  if(nav)nav.classList.add('active');
  const titles={dashboard:'Dashboard',calc:'Calcular',products:'Meus Produtos',
    simulator:'Simulador',hubs:'Central Hubs',config:'Configurações'};
  document.getElementById('page-title').textContent=titles[page]||page;
  if(page==='products')loadProducts();
  if(page==='dashboard')loadDashboard();
  if(page==='simulator')simAtualizar();
  if(window.innerWidth<=700)closeSidebar();
}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');}

// ── FORM DATA ─────────────────────────────────
function getFormData(){
  return{
    nome:document.getElementById('f-nome').value.trim()||'Produto sem nome',
    sku:document.getElementById('f-sku').value.trim()||'',
    ean:document.getElementById('f-ean').value.trim()||'',
    fornecedor:document.getElementById('f-fornecedor').value.trim()||'',
    preco_ml:parseFloat(document.getElementById('f-preco-ml').value)||0,
    preco_shopee:parseFloat(document.getElementById('f-preco-shopee').value)||0,
    preco_tiktok:parseFloat(document.getElementById('f-preco-tiktok').value)||0,
    preco_magalu:parseFloat(document.getElementById('f-preco-magalu').value)||0,
    preco_direta:parseFloat(document.getElementById('f-preco-direta').value)||0,
    modo,
    custo:parseFloat(document.getElementById('f-custo').value)||0,
    embalagem:parseFloat(document.getElementById('f-embalagem').value)||0,
    comp:parseFloat(document.getElementById('f-comp').value)||0,
    alt:parseFloat(document.getElementById('f-alt').value)||0,
    larg:parseFloat(document.getElementById('f-larg').value)||0,
    peso:parseFloat(document.getElementById('f-peso').value)||0.3,
    categoria:document.getElementById('f-categoria').value||'',
    gramas:parseFloat(document.getElementById('f-gramas').value)||0,
    custo_fil:parseFloat(document.getElementById('f-custo-fil').value)||0,
    horas:parseFloat(document.getElementById('f-horas').value)||0,
    watts:parseFloat(document.getElementById('f-watts').value)||350,
    kwh:parseFloat(document.getElementById('f-kwh').value)||0.9,
    mao_hora:parseFloat(document.getElementById('f-mao-hora').value)||35,
    mao_min:parseFloat(document.getElementById('f-mao-min').value)||0,
    insumos:parseFloat(document.getElementById('f-insumos').value)||0,
    nf:parseFloat(document.getElementById('f-nf').value)||0,
    frete:parseFloat(document.getElementById('f-frete').value)||0,
    margem_min:parseFloat(document.getElementById('f-margem-min').value)||10,
    lucros:[1,2,3,4].map(i=>parseFloat(document.getElementById(`f-l${i}`).value)||0),
    ml_tipo:document.getElementById('ml-tipo').value,
    ml_taxa:parseFloat(document.getElementById('ml-taxa').value)||0,
    ml_envio:document.getElementById('ml-envio').value,
    tt_taxa:parseFloat(document.getElementById('tt-taxa').value)||0,
    tt_afil:parseFloat(document.getElementById('tt-afil').value)||0,
    vd_pagamento:document.getElementById('vd-pagamento').value,
    savedAt:new Date().toISOString(),
    updatedAt:new Date().toISOString(),
  };
}

// ── SALVAR ────────────────────────────────────
async function salvarProduto(){
  if(!currentUser||!db){showToast('Faça login para salvar','error');return;}
  const data=getFormData();
  try{
    await db.collection('users').doc(currentUser.uid).collection('produtos').add(data);
    showToast('Produto salvo! 💾','success');
  }catch(e){showToast('Erro ao salvar: '+e.message,'error');}
}

// ── CARREGAR PRODUTO ──────────────────────────
async function carregarProduto(id){
  if(!currentUser||!db)return;
  try{
    const doc=await db.collection('users').doc(currentUser.uid).collection('produtos').doc(id).get();
    if(!doc.exists)return;
    const d=doc.data();
    const fields=[
      ['f-nome','nome',''],['f-sku','sku',''],['f-ean','ean',''],['f-fornecedor','fornecedor',''],
      ['f-preco-ml','preco_ml',0],['f-preco-shopee','preco_shopee',0],
      ['f-preco-tiktok','preco_tiktok',0],['f-preco-magalu','preco_magalu',0],['f-preco-direta','preco_direta',0],
      ['f-custo','custo',0],['f-embalagem','embalagem',0],
      ['f-comp','comp',0],['f-alt','alt',0],['f-larg','larg',0],
      ['f-peso','peso',0.3],['f-categoria','categoria',''],
      ['f-gramas','gramas',0],['f-custo-fil','custo_fil',0],
      ['f-horas','horas',0],['f-watts','watts',350],['f-kwh','kwh',0.9],
      ['f-mao-hora','mao_hora',35],['f-mao-min','mao_min',0],
      ['f-insumos','insumos',3],['f-nf','nf',8],['f-frete','frete',0],
      ['f-margem-min','margem_min',10],
      ['ml-tipo','ml_tipo','classico'],['ml-taxa','ml_taxa',14],
      ['ml-envio','ml_envio','proprio'],
      ['tt-taxa','tt_taxa',6],['tt-afil','tt_afil',5],
      ['vd-pagamento','vd_pagamento','outros'],
    ];
    fields.forEach(([elId,key,def])=>{
      const el=document.getElementById(elId);
      if(el)el.value=d[key]!==undefined?d[key]:def;
    });
    if(d.lucros)d.lucros.forEach((l,i)=>{const el=document.getElementById(`f-l${i+1}`);if(el)el.value=l;});
    setMode(d.modo||'normal');
    calcular();
    showPage('calc');
    showToast('Produto carregado!','success');
  }catch(e){showToast('Erro ao carregar','error');}
}

// ── DELETAR ───────────────────────────────────
async function deletarProduto(id){
  if(!confirm('Apagar este produto?'))return;
  if(!currentUser||!db)return;
  try{
    await db.collection('users').doc(currentUser.uid).collection('produtos').doc(id).delete();
    showToast('Produto apagado','success');
    loadProducts();
    loadDashboard();
  }catch(e){showToast('Erro ao apagar','error');}
}

// ── LOAD PRODUCTS ─────────────────────────────
async function loadProducts(){
  if(!currentUser||!db)return;
  const el=document.getElementById('products-list');
  el.innerHTML='<p style="color:var(--text2);font-size:13px;padding:8px">Carregando...</p>';
  const catFiltroEl=document.getElementById('filtro-cat');const catFiltro=catFiltroEl?catFiltroEl.value:'';
  try{
    let query=db.collection('users').doc(currentUser.uid).collection('produtos').orderBy('savedAt','desc');
    const snap=await query.get();
    let docs=snap.docs;
    if(catFiltro)docs=docs.filter(d=>d.data().categoria===catFiltro);
    if(!docs.length){
      el.innerHTML=`<div class="empty-state"><div class="empty-icon">📦</div><p>Nenhum produto encontrado.<br/>Faça seu primeiro cálculo!</p><button class="btn-primary" onclick="showPage('calc')" style="margin-top:16px">+ Novo Cálculo</button></div>`;
      return;
    }
    el.innerHTML=docs.map(doc=>{
      const d=doc.data();
      const data=d.savedAt?new Date(d.savedAt).toLocaleDateString('pt-BR'):'—';
      const catLabel={eletronicos:'Eletrônicos',acessorios:'Acessórios',casa:'Casa',
        moda:'Moda','3d':'3D',brinquedos:'Brinquedos',outros:'Outros'}[d.categoria]||'';
      const checked=compareList.includes(doc.id);
      const dims=d.comp&&d.alt&&d.larg?`${d.comp}×${d.alt}×${d.larg}cm · `:'';
      return`<div class="product-card" id="pc-${doc.id}">
        <input type="checkbox" class="compare-check" ${checked?'checked':''} onchange="toggleCompare('${doc.id}',this.checked)" title="Selecionar para comparar"/>
        <div class="product-icon">${d.modo==='3d'?'🖨️':'📦'}</div>
        <div class="product-info">
          <div class="product-name">${d.nome}
            ${d.modo==='3d'?'<span class="product-tag tag-3d">3D</span>':''}
            ${catLabel?`<span class="product-tag tag-cat">${catLabel}</span>`:''}
          </div>
          <div class="product-meta">${dims}${d.peso||''}kg · Custo: ${fmt(d.custo)} · ${data}</div>
        </div>
        <div class="product-actions">
          <button class="btn-icon" onclick="carregarProduto('${doc.id}')">✏️ Carregar</button>
          <button class="btn-icon danger" onclick="deletarProduto('${doc.id}')">✕</button>
        </div>
      </div>`;
    }).join('');
  }catch(e){el.innerHTML=`<p style="color:var(--red)">Erro: ${e.message}</p>`;}
}

// ── COMPARAR ──────────────────────────────────
function toggleCompare(id,checked){
  if(checked&&compareList.length>=3){showToast('Máximo 3 produtos para comparar','error');
    const cb=document.getElementById(`pc-${id}`);if(cb){const chk=cb.querySelector('.compare-check');if(chk)chk.checked=false;}return;}
  if(checked)compareList.push(id);
  else compareList=compareList.filter(x=>x!==id);
  const bar=document.getElementById('compare-bar');
  const count=document.getElementById('compare-count');
  bar.style.display=compareList.length>1?'flex':'none';
  count.textContent=`${compareList.length} selecionado${compareList.length>1?'s':''}`;
}
function limparComparacao(){
  compareList=[];
  document.querySelectorAll('.compare-check').forEach(c=>c.checked=false);
  document.getElementById('compare-bar').style.display='none';
}

async function compararProdutos(){
  if(compareList.length<2){showToast('Selecione ao menos 2 produtos','error');return;}
  if(!currentUser||!db)return;
  try{
    const produtos=await Promise.all(compareList.map(id=>
      db.collection('users').doc(currentUser.uid).collection('produtos').doc(id).get()
    ));
    const dados=produtos.map(d=>({id:d.id,...d.data()}));
    const modal=document.getElementById('modal-compare');
    const body=document.getElementById('modal-compare-body');
    const mps=['ML','Shopee','TikTok','Magalu','Direta'];
    body.innerHTML=`
      <div style="overflow-x:auto">
        <table class="compare-table">
          <thead>
            <tr>
              <th>Campo</th>
              ${dados.map(d=>`<th>${d.nome}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr><td>Custo</td>${dados.map(d=>`<td>${fmt(d.custo)}</td>`).join('')}</tr>
            <tr><td>Peso</td>${dados.map(d=>`<td>${d.peso||'—'}kg</td>`).join('')}</tr>
            <tr><td>Embalagem</td>${dados.map(d=>`<td>${fmt(d.embalagem)}</td>`).join('')}</tr>
            <tr><td>Modo</td>${dados.map(d=>`<td>${d.modo==='3d'?'🖨️ 3D':'📦 Normal'}</td>`).join('')}</tr>
            <tr><td>Margem mínima</td>${dados.map(d=>`<td>${d.margem_min||10}%</td>`).join('')}</tr>
            <tr class="compare-section"><td colspan="${dados.length+1}">Preços de venda (meta 10%)</td></tr>
            ${dados.map(d=>{
              const pb=(d.insumos+d.nf+d.frete)/100;
              const mlV=calcVendaML(d.custo+(d.embalagem||0),pb,10,(d.ml_taxa||14)/100,d.peso||0.3);
              const shV=calcVendaShopee(d.custo+(d.embalagem||0),pb,10);
              const ttV=(()=>{const dn=1-pb-(d.tt_taxa||6)/100-(d.tt_afil||5)/100-0.1;return dn>0?(d.custo+(d.embalagem||0))/dn:null;})();
              const mgV=calcVendaMagalu(d.custo+(d.embalagem||0),pb,10);
              return{mlV,shV,ttV,mgV,d};
            }).reduce((acc,{mlV,shV,ttV,mgV,d},_,arr)=>{
              if(acc.length===0){
                acc.push(`<tr><td>Mercado Livre</td>${arr.map(x=>`<td class="compare-price">${fmt(x.mlV)}</td>`).join('')}</tr>`);
                acc.push(`<tr><td>Shopee</td>${arr.map(x=>`<td class="compare-price">${fmt(x.shV)}</td>`).join('')}</tr>`);
                acc.push(`<tr><td>TikTok</td>${arr.map(x=>`<td class="compare-price">${fmt(x.ttV)}</td>`).join('')}</tr>`);
                acc.push(`<tr><td>Magalu</td>${arr.map(x=>`<td class="compare-price">${fmt(x.mgV)}</td>`).join('')}</tr>`);
              }
              return acc;
            },[])}
          </tbody>
        </table>
      </div>`;
    modal.style.display='flex';
  }catch(e){showToast('Erro ao comparar','error');}
}

// ── DASHBOARD ─────────────────────────────────
async function loadDashboard(){
  if(!currentUser||!db)return;
  try{
    const snap=await db.collection('users').doc(currentUser.uid)
      .collection('produtos').orderBy('savedAt','desc').limit(20).get();

    if(snap.empty){
      document.getElementById('dash-empty').style.display='block';
      document.getElementById('dash-content').style.display='none';
      return;
    }
    document.getElementById('dash-empty').style.display='none';
    document.getElementById('dash-content').style.display='block';

    const produtos=snap.docs.map(d=>({id:d.id,...d.data()}));

    // Stats
    const stats=document.getElementById('dash-stats');
    const total=produtos.length;
    const total3d=produtos.filter(p=>p.modo==='3d').length;
    const custoMedio=produtos.reduce((s,p)=>s+(p.custo||0),0)/total;
    stats.innerHTML=`
      <div class="stat-card"><div class="stat-num">${total}</div><div class="stat-label">Produtos salvos</div></div>
      <div class="stat-card"><div class="stat-num">${total3d}</div><div class="stat-label">Impressão 3D</div></div>
      <div class="stat-card"><div class="stat-num">${total-total3d}</div><div class="stat-label">Normais</div></div>
      <div class="stat-card"><div class="stat-num">${fmt(custoMedio)}</div><div class="stat-label">Custo médio</div></div>`;

    // Últimos produtos
    const dashProd=document.getElementById('dash-produtos');
    dashProd.innerHTML=produtos.slice(0,5).map(p=>`
      <div class="dash-prod-row" onclick="carregarProduto('${p.id}')">
        <span>${p.modo==='3d'?'🖨️':'📦'} ${p.nome}</span>
        <span class="mono" style="color:var(--text2)">${fmt(p.custo)}</span>
      </div>`).join('');

    // Melhores margens (calcula preço ML com 10% lucro e mostra lucro/custo)
    const margens=produtos.map(p=>{
      const pb=((p.insumos||0)+(p.nf||0)+(p.frete||0))/100;
      const custo=(p.custo||0)+(p.embalagem||0);
      const vml=calcVendaML(custo,pb,10,(p.ml_taxa||14)/100,p.peso||0.3);
      const lucroRS=vml?vml*0.1:0;
      return{...p,lucroRS,vml};
    }).sort((a,b)=>b.lucroRS-a.lucroRS);

    const dashMarg=document.getElementById('dash-margens');
    dashMarg.innerHTML=margens.slice(0,5).map(p=>`
      <div class="dash-marg-row">
        <span>${p.nome}</span>
        <div>
          <span class="mono green" style="font-weight:700">${fmt(p.lucroRS)}</span>
          <span style="color:var(--text2);font-size:11px;margin-left:6px">ML ${fmt(p.vml)}</span>
        </div>
      </div>`).join('');

    // Alertas baseados nos precos reais praticados
    const alertasCard=document.getElementById('dash-alertas-card');
    const alertas=[];
    produtos.forEach(p=>{
      const pb=((p.insumos||0)+(p.nf||0)+(p.frete||0))/100;
      const custo=(p.custo||0)+(p.embalagem||0);
      const min=p.margem_min||10;
      const precos=[
        {mp:'Mercado Livre',preco:p.preco_ml||0,getTaxa:function(v){return v*(p.ml_taxa||14)/100+mlCustoOp(p.peso||0.3,v);}},
        {mp:'Shopee',preco:p.preco_shopee||0,getTaxa:function(v){var f=shopeeFaixa(v);return v*f.pct+f.fixo;}},
        {mp:'TikTok',preco:p.preco_tiktok||0,getTaxa:function(v){return v*((p.tt_taxa||6)+(p.tt_afil||5))/100;}},
        {mp:'Magalu',preco:p.preco_magalu||0,getTaxa:function(v){return v*0.148+5;}},
        {mp:'Venda Direta',preco:p.preco_direta||0,getTaxa:function(){return 0;}},
      ].filter(function(x){return x.preco>0;});
      precos.forEach(function(m){
        var lucroRS=m.preco-custo-m.getTaxa(m.preco)-m.preco*pb;
        var lucroP=(lucroRS/m.preco)*100;
        if(lucroP<min) alertas.push({nome:p.nome,mp:m.mp,preco:m.preco,lucroP:lucroP,id:p.id});
      });
    });
    if(alertas.length){
      alertasCard.style.display='block';
      document.getElementById('dash-alertas').innerHTML=alertas.map(function(a){
        return '<div class="alert-row">⚠️ <strong>'+a.nome+'</strong> no '+a.mp+': '+fmt(a.preco)+' · margem '+a.lucroP.toFixed(1)+'%<button class="btn-icon" style="margin-left:auto" onclick="carregarProduto(\'' +a.id+ '\')">Ver</button></div>';
      }).join('');
    }else{alertasCard.style.display='none';}
  }catch(e){console.error(e);}
}

// ── CONFIG ────────────────────────────────────
async function saveConfig(){
  const cfg={
    tt_taxa:document.getElementById('cfg-tt-taxa').value,
    tt_afil:document.getElementById('cfg-tt-afil').value,
    insumos:document.getElementById('cfg-insumos').value,
    nf:document.getElementById('cfg-nf').value,
    kwh:document.getElementById('cfg-kwh').value,
    mao:document.getElementById('cfg-mao').value,
    margem_min:document.getElementById('cfg-margem-min').value,
    lucros:[1,2,3,4].map(i=>document.getElementById(`cfg-l${i}`).value),
    maquininha:{
      debito:document.getElementById('cfg-debito').value,
      cred1:document.getElementById('cfg-cred1').value,
      cred2:document.getElementById('cfg-cred2').value,
      cred3:document.getElementById('cfg-cred3').value,
      cred4:document.getElementById('cfg-cred4').value,
      cred6:document.getElementById('cfg-cred6').value,
      cred10:document.getElementById('cfg-cred10').value,
      cred12:document.getElementById('cfg-cred12').value,
    }
  };
  localStorage.setItem('mgf_config_v1',JSON.stringify(cfg));
  if(currentUser&&db){
    try{await db.collection('users').doc(currentUser.uid).set({config:cfg},{merge:true});}catch(e){}
  }
  applyConfig(cfg);
  const msg=document.getElementById('config-msg');
  msg.textContent='✓ Configurações salvas!';
  setTimeout(()=>msg.textContent='',2500);
}

function applyConfig(cfg){
  if(!cfg)return;
  const map=[
    ['tt-taxa','tt_taxa'],['tt-afil','tt_afil'],['f-insumos','insumos'],
    ['f-nf','nf'],['f-kwh','kwh'],['f-mao-hora','mao'],['f-margem-min','margem_min'],
  ];
  map.forEach(([elId,key])=>{const el=document.getElementById(elId);if(el&&cfg[key])el.value=cfg[key];});
  if(cfg.lucros)cfg.lucros.forEach((l,i)=>{const el=document.getElementById(`f-l${i+1}`);if(el)el.value=l;});
  if(cfg.maquininha){
    Object.entries(cfg.maquininha).forEach(([k,v])=>{
      const el=document.getElementById(`cfg-${k}`);if(el)el.value=v;
    });
  }
  // config page
  const cfgMap=[
    ['cfg-tt-taxa','tt_taxa'],['cfg-tt-afil','tt_afil'],['cfg-insumos','insumos'],
    ['cfg-nf','nf'],['cfg-kwh','kwh'],['cfg-mao','mao'],['cfg-margem-min','margem_min'],
  ];
  cfgMap.forEach(([elId,key])=>{const el=document.getElementById(elId);if(el&&cfg[key])el.value=cfg[key];});
  if(cfg.lucros)cfg.lucros.forEach((l,i)=>{const el=document.getElementById(`cfg-l${i+1}`);if(el)el.value=l;});
}

function loadConfig(){
  const saved=localStorage.getItem('mgf_config_v1');
  if(saved){try{applyConfig(JSON.parse(saved));}catch(e){}}
}

// ── TOAST ─────────────────────────────────────
function showToast(msg,type='success'){
  const t=document.getElementById('toast');
  t.textContent=msg;t.className=`toast show ${type}`;
  setTimeout(()=>t.classList.remove('show'),2800);
}

// ── INIT ──────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  loadConfig();
  firebase.auth().onAuthStateChanged(function(user){
    currentUser=user;
    if(user){
      iniciarApp();
    }else{
      document.getElementById('screen-auth').classList.add('active');
      document.getElementById('screen-app').classList.remove('active');
      document.getElementById('screen-paywall').classList.remove('active');
    }
  });
});

// ── TERMOS E LEGAL ────────────────────────────
function toggleLoginBtn(){
  const checked = document.getElementById('terms-accept').checked;
  const btn = document.getElementById('btn-google-login');
  if(btn){
    btn.style.opacity = checked ? '1' : '0.5';
    btn.style.pointerEvents = checked ? 'auto' : 'none';
  }
}

function showLegal(type){
  const modal = document.getElementById('modal-legal');
  const title = document.getElementById('legal-title');
  const body  = document.getElementById('legal-body');
  if(!modal) return;

  if(type === 'terms'){
    title.textContent = 'Termos de Uso — Margify';
    body.innerHTML = `
      <p class="legal-date">Última atualização: ${new Date().toLocaleDateString('pt-BR')}</p>

      <h4>1. Sobre a Margify</h4>
      <p>A Margify é uma ferramenta de precificação para vendedores de marketplaces (Mercado Livre, Shopee, TikTok Shop, Magalu e outros). O serviço é operado por pessoa física, doravante denominado "Margify" ou "nós".</p>

      <h4>2. Aceitação dos Termos</h4>
      <p>Ao criar uma conta e utilizar a Margify, você declara ter lido, compreendido e concordado com estes Termos de Uso. Caso não concorde, não utilize o serviço.</p>

      <h4>3. Natureza do Serviço</h4>
      <p>A Margify fornece <strong>estimativas e cálculos orientativos</strong> de precificação. Os resultados apresentados são baseados nas informações inseridas pelo usuário e nas taxas conhecidas dos marketplaces, podendo não refletir com exatidão todas as variáveis envolvidas em cada venda.</p>
      <p><strong>A Margify não é uma consultoria financeira, contábil ou jurídica.</strong> As decisões de precificação são de responsabilidade exclusiva do usuário.</p>

      <h4>4. Limitação de Responsabilidade</h4>
      <p>A Margify não se responsabiliza por:</p>
      <ul>
        <li>Prejuízos decorrentes de precificações incorretas realizadas pelo usuário</li>
        <li>Mudanças nas taxas dos marketplaces não refletidas imediatamente na plataforma</li>
        <li>Interrupções temporárias do serviço por manutenção ou falhas técnicas</li>
        <li>Decisões comerciais tomadas com base nos cálculos da plataforma</li>
      </ul>

      <h4>5. Conta e Acesso</h4>
      <p>O acesso é feito via conta Google. Você é responsável pela segurança da sua conta. Cada conta é pessoal e intransferível.</p>

      <h4>6. Assinatura e Pagamento</h4>
      <p>O plano pago custa R$ 19,90/mês, cobrado mensalmente via cartão de crédito. O período de teste gratuito é de 2 (dois) dias a partir do primeiro acesso. Após o período de teste, o acesso requer assinatura ativa.</p>

      <h4>7. Cancelamento e Reembolso</h4>
      <p><strong>Direito de arrependimento:</strong> nos primeiros 7 (sete) dias corridos após a primeira cobrança, você tem direito a reembolso total, conforme o Art. 49 do Código de Defesa do Consumidor.</p>
      <p><strong>Após 7 dias:</strong> o cancelamento encerra as cobranças futuras. O acesso permanece ativo até o fim do período já pago. Não há reembolso proporcional após esse prazo.</p>
      <p>Para cancelar, basta cancelar a assinatura diretamente pelo painel do Stripe ou entrar em contato conosco.</p>

      <h4>8. Propriedade Intelectual</h4>
      <p>Todo o conteúdo da plataforma (código, design, textos, marca Margify) é propriedade do operador. É proibida a reprodução ou comercialização sem autorização.</p>

      <h4>9. Modificações</h4>
      <p>Podemos atualizar estes termos a qualquer momento. Usuários serão notificados por e-mail ou aviso na plataforma. O uso continuado após a notificação implica aceitação.</p>

      <h4>10. Legislação Aplicável</h4>
      <p>Estes termos são regidos pelas leis brasileiras. Fica eleito o foro da comarca do operador para dirimir quaisquer controvérsias.</p>

      <h4>11. Contato</h4>
      <p>Dúvidas sobre estes termos: <strong>contato@margify.com.br</strong></p>`;
  } else {
    title.textContent = 'Política de Privacidade — Margify';
    body.innerHTML = `
      <p class="legal-date">Última atualização: ${new Date().toLocaleDateString('pt-BR')} · Em conformidade com a LGPD (Lei 13.709/2018)</p>

      <h4>1. Responsável pelo Tratamento</h4>
      <p>Os dados coletados pela Margify são tratados por pessoa física, operador da plataforma Margify, com contato disponível em <strong>contato@margify.com.br</strong>.</p>

      <h4>2. Dados que Coletamos</h4>
      <ul>
        <li><strong>Dados de autenticação:</strong> nome e e-mail fornecidos pela sua conta Google no momento do login</li>
        <li><strong>Dados de uso:</strong> produtos cadastrados, custos, preços e configurações que você insere na plataforma</li>
        <li><strong>Dados de acesso:</strong> data do primeiro acesso e início do período de teste</li>
        <li><strong>Dados de pagamento:</strong> processados exclusivamente pelo Stripe — não armazenamos dados de cartão</li>
      </ul>

      <h4>3. Para que Usamos seus Dados</h4>
      <ul>
        <li>Autenticar e identificar sua conta</li>
        <li>Armazenar seus produtos e configurações na nuvem</li>
        <li>Gerenciar seu período de teste e assinatura</li>
        <li>Enviar comunicações sobre o serviço (apenas quando necessário)</li>
      </ul>

      <h4>4. Não Vendemos nem Compartilhamos</h4>
      <p>Seus dados <strong>nunca são vendidos, alugados ou compartilhados com terceiros</strong> para fins comerciais. Os únicos serviços que acessam seus dados são:</p>
      <ul>
        <li><strong>Google Firebase</strong> — armazenamento seguro na nuvem (Google LLC)</li>
        <li><strong>Stripe</strong> — processamento de pagamentos (Stripe Inc.)</li>
      </ul>
      <p>Ambos possuem certificações de segurança internacionais e políticas de privacidade próprias.</p>

      <h4>5. Seus Direitos (LGPD)</h4>
      <p>Conforme a Lei Geral de Proteção de Dados, você tem direito a:</p>
      <ul>
        <li><strong>Acesso:</strong> saber quais dados temos sobre você</li>
        <li><strong>Correção:</strong> corrigir dados incorretos</li>
        <li><strong>Exclusão:</strong> solicitar a exclusão de todos os seus dados</li>
        <li><strong>Portabilidade:</strong> receber seus dados em formato estruturado</li>
        <li><strong>Revogação:</strong> retirar seu consentimento a qualquer momento</li>
      </ul>
      <p>Para exercer qualquer direito: <strong>contato@margify.com.br</strong> — respondemos em até 15 dias úteis.</p>

      <h4>6. Segurança</h4>
      <p>Seus dados são armazenados no Google Firebase com criptografia em trânsito (TLS) e em repouso. As regras de segurança garantem que cada usuário acessa apenas seus próprios dados.</p>

      <h4>7. Retenção de Dados</h4>
      <p>Seus dados são mantidos enquanto sua conta estiver ativa. Após solicitação de exclusão, os dados são removidos em até 30 dias.</p>

      <h4>8. Cookies</h4>
      <p>Utilizamos apenas cookies essenciais para autenticação (Google Firebase Auth). Não utilizamos cookies de rastreamento ou publicidade.</p>

      <h4>9. Contato e DPO</h4>
      <p>Para questões de privacidade e proteção de dados: <strong>contato@margify.com.br</strong></p>`;
  }
  modal.style.display = 'flex';
}

// Registra aceite dos termos no Firebase
async function registrarAceiteTermos(user){
  if(!db||!user) return;
  try{
    await db.collection('users').doc(user.uid).set({
      termsAcceptedAt: new Date(),
      termsVersion: '1.0',
      email: user.email,
    },{merge:true});
  }catch(e){ console.error('Erro ao registrar aceite:', e); }
}

