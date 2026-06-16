// ══════════════════════════════════════════════

// ── XSS PROTECTION ───────────────────────────
function esc(s){
  if(s===null||s===undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}
//  PRECIFICAFLOW v2.0 — App Principal
// ══════════════════════════════════════════════

let currentUser = null;
let db = null;
let compareList = [];

var _currentProductId = null;

// ── ACCESS CONTROL ───────────────────────────
const TRIAL_DAYS = 10;
const PRICE_MONTHLY = 19.90;
// Cupons: adicione/remova no Firebase em /coupons/{CODIGO}
// Cada documento: { type: 'lifetime' | 'trial', days: 30, active: true }

const TRIAL_PRODUCT_LIMIT = 5; // Limite de produtos no trial

async function checkAccess(user){
  if(!db) return {ok:false, reason:'noauth'};
  try{
    const userDoc = await db.collection('users').doc(user.uid).get();
    const data = userDoc.exists ? userDoc.data() : {};

    // Acesso vitalício por cupom
    if(data.access === 'lifetime') return {ok:true, plan:'lifetime'};

    // Assinatura ativa via Stripe
    if(data.stripeStatus === 'active') return {ok:true, plan:'paid'};

    // Calcula dias e produtos usados
    var trialStart = data.trialStart;
    if(!trialStart){
      // Primeiro acesso — inicia trial
      await db.collection('users').doc(user.uid).set({
        trialStart: new Date(),
        email: user.email,
        displayName: user.displayName,
        createdAt: new Date()
      }, {merge:true});
      return {ok:true, plan:'trial', daysLeft:TRIAL_DAYS, productsLeft:TRIAL_PRODUCT_LIMIT, productsUsed:0};
    }

    const start = trialStart.toDate ? trialStart.toDate() : new Date(trialStart);
    const daysUsed = (new Date() - start) / (1000*60*60*24);
    const daysLeft = Math.max(0, TRIAL_DAYS - daysUsed);

    const snap = await db.collection('users').doc(user.uid).collection('produtos').get();
    const productsUsed = snap.size;
    const productsLeft = Math.max(0, TRIAL_PRODUCT_LIMIT - productsUsed);

    // Bloqueia se passou 10 dias OU atingiu 5 produtos
    if(daysLeft <= 0){
      return {ok:false, reason:'trial_expired', daysLeft:0, productsUsed, productsLeft};
    }
    if(productsUsed >= TRIAL_PRODUCT_LIMIT){
      return {ok:false, reason:'trial_limit', daysLeft, productsUsed, productsLeft:0};
    }

    return {ok:true, plan:'trial', daysLeft, productsUsed, productsLeft};

  } catch(e){ console.error(e); return {ok:false, reason:'error'}; }
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

function mostrarPaywall(reason){
  document.getElementById('screen-auth').classList.remove('active');
  document.getElementById('screen-app').classList.remove('active');
  document.getElementById('screen-paywall').classList.add('active');
  const title = document.querySelector('#paywall-content .auth-sub');
  if(title){
    if(reason==='trial_limit'){
      title.textContent = 'Você atingiu o limite de 5 produtos no período de teste — assine para continuar';
    } else {
      title.textContent = 'Seu período de teste de 10 dias encerrou — assine para continuar';
    }
  }
}

// ── ATUALIZA CONTADOR TRIAL ──────────────────
async function atualizarContadorTrial(){
  if(!currentUser||!db) return;
  try{
    const access = await checkAccess(currentUser);
    if(access.plan==='trial'){
      const pLeft = access.productsLeft!==undefined ? access.productsLeft : TRIAL_PRODUCT_LIMIT;
      const dLeft = access.daysLeft!==undefined ? Math.ceil(access.daysLeft) : TRIAL_DAYS;
      window._trialProductsLeft = pLeft;
      window._trialDaysLeft = dLeft;
      // Update sidebar
      const infoEl = document.getElementById('user-info');
      if(infoEl) infoEl.textContent = (currentUser.displayName||currentUser.email) + ' · 🆓 Trial (' + dLeft + 'd · ' + pLeft + ' prod.)';
      // Update banner
      var banner = document.getElementById('trial-banner');
      var bannerText = document.getElementById('trial-banner-text');
      if(banner && bannerText){
        banner.style.display='flex';
        if(pLeft <= 0){
          bannerText.innerHTML='🚫 Limite de produtos atingido — <strong>assine para continuar!</strong>';
        } else if(dLeft <= 1){
          bannerText.innerHTML='⏰ Último dia de trial — <strong>'+pLeft+' produto'+(pLeft!==1?'s':'')+' restante'+(pLeft!==1?'s':'')+' · assine para não perder o acesso!</strong>';
        } else {
          bannerText.innerHTML='🆓 Trial: <strong>'+dLeft+' dia'+(dLeft!==1?'s':'')+' e '+pLeft+' produto'+(pLeft!==1?'s':'')+' restante'+(pLeft!==1?'s':'')+' gratuitos</strong>. Assine para produtos ilimitados!';
        }
      }
    } else if(!access.ok){
      // Trial expirou — mostra paywall
      mostrarPaywall(access.reason);
    } else {
      window._trialProductsLeft = undefined;
      var banner = document.getElementById('trial-banner');
      if(banner) banner.style.display='none';
    }
  } catch(e){ console.error(e); }
}

async function iniciarApp(){
  db = firebase.firestore();
  const access = await checkAccess(currentUser);
  if(access.ok){
    document.getElementById('screen-auth').classList.remove('active');
    document.getElementById('screen-paywall').classList.remove('active');
    document.getElementById('screen-app').classList.add('active');
    document.getElementById('user-info').textContent = currentUser.displayName || currentUser.email;
    document.getElementById('user-avatar').textContent = currentUser.displayName ? currentUser.displayName.split(' ')[0] : '👤';

    // Mostra info do plano na sidebar
    const infoEl = document.getElementById('user-info');
    if(access.plan === 'lifetime'){
      infoEl.textContent = (currentUser.displayName||currentUser.email) + ' · ♾️ Vitalício';
      window._trialProductsLeft = undefined;
    } else if(access.plan === 'paid'){
      infoEl.textContent = (currentUser.displayName||currentUser.email) + ' · ✅ Assinante';
      window._trialProductsLeft = undefined;
    } else if(access.plan === 'trial'){
      const dLeft = access.daysLeft !== undefined ? Math.ceil(access.daysLeft) : TRIAL_DAYS;
      const pLeft = access.productsLeft !== undefined ? access.productsLeft : TRIAL_PRODUCT_LIMIT;
      infoEl.textContent = (currentUser.displayName||currentUser.email) + ' · 🆓 Trial (' + dLeft + 'd · ' + pLeft + ' prod.)';
      window._trialProductsLeft = pLeft;
      window._trialDaysLeft = dLeft;
    }

    showPage('dashboard');
    loadDashboard();
    setTimeout(checkOnboarding, 800);
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
var _currentPage='dashboard';
function showPage(page){
  // Auto-limpa o formulário ao sair do Calcular
  if(_currentPage==='calc' && page!=='calc') limparFormulario();
  _currentPage=page;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const pg=document.getElementById(`page-${page}`);
  const nav=document.querySelector(`[data-page="${page}"]`);
  if(pg)pg.classList.add('active');
  if(nav)nav.classList.add('active');
  const titles={dashboard:'Dashboard',calc:'Calcular',products:'Meus Produtos',
    simulator:'Simulador',hubs:'Central Hubs',config:'Configurações'};
  document.getElementById('page-title').textContent=titles[page]||page;
  var btnLimpar=document.getElementById('btn-limpar');
  if(btnLimpar) btnLimpar.style.display=page==='calc'?'block':'none';
  if(page==='products')loadProducts();
  if(page==='dashboard')loadDashboard();
  if(page==='simulator')simAtualizar();
  if(page==='suppliers')loadSuppliers();
  if(window.innerWidth<=700)closeSidebar();
}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');}

// ── FORM DATA ─────────────────────────────────
function getFormData(){
  return{
    nome:document.getElementById('f-nome')?document.getElementById('f-nome').value.trim():''||'Produto sem nome',
    sku:document.getElementById('f-sku')?document.getElementById('f-sku').value.trim():''||'',
    ean:document.getElementById('f-ean')?document.getElementById('f-ean').value.trim():''||'',
    fornecedor:document.getElementById('f-fornecedor')?document.getElementById('f-fornecedor').value.trim():''||'',
    preco_ml:parseFloat(document.getElementById('f-preco-ml')?document.getElementById('f-preco-ml').value:'')||0,
    preco_shopee:parseFloat(document.getElementById('f-preco-shopee')?document.getElementById('f-preco-shopee').value:'')||0,
    preco_tiktok:parseFloat(document.getElementById('f-preco-tiktok')?document.getElementById('f-preco-tiktok').value:'')||0,
    preco_magalu:parseFloat(document.getElementById('f-preco-magalu')?document.getElementById('f-preco-magalu').value:'')||0,
    preco_direta:parseFloat(document.getElementById('f-preco-direta')?document.getElementById('f-preco-direta').value:'')||0,
    preco_amazon:parseFloat(document.getElementById('f-preco-amazon')?document.getElementById('f-preco-amazon').value:0)||0,
    preco_site:parseFloat(document.getElementById('f-preco-site')?document.getElementById('f-preco-site').value:0)||0,
    az_taxa:parseFloat(document.getElementById('az-taxa')?document.getElementById('az-taxa').value:15)||15,
    st_plat:parseFloat(document.getElementById('st-plat')?document.getElementById('st-plat').value:0)||0,
    st_frete:parseFloat(document.getElementById('st-frete')?document.getElementById('st-frete').value:0)||0,
    st_gateway:document.getElementById('st-gateway')?document.getElementById('st-gateway').value:'pix',
    modo,
    custo:parseFloat(document.getElementById('f-custo')?document.getElementById('f-custo').value:'')||0,
    embalagem:parseFloat(document.getElementById('f-embalagem')?document.getElementById('f-embalagem').value:'')||0,
    comp:parseFloat(document.getElementById('f-comp')?document.getElementById('f-comp').value:'')||0,
    alt:parseFloat(document.getElementById('f-alt')?document.getElementById('f-alt').value:'')||0,
    larg:parseFloat(document.getElementById('f-larg')?document.getElementById('f-larg').value:'')||0,
    peso:parseFloat(document.getElementById('f-peso')?document.getElementById('f-peso').value:'')||0.3,
    categoria:document.getElementById('f-categoria')?document.getElementById('f-categoria').value:''||'',
    gramas:parseFloat(document.getElementById('f-gramas')?document.getElementById('f-gramas').value:'')||0,
    custo_fil:parseFloat(document.getElementById('f-custo-fil')?document.getElementById('f-custo-fil').value:'')||0,
    horas:parseFloat(document.getElementById('f-horas')?document.getElementById('f-horas').value:'')||0,
    watts:parseFloat(document.getElementById('f-watts')?document.getElementById('f-watts').value:'')||350,
    kwh:parseFloat(document.getElementById('f-kwh')?document.getElementById('f-kwh').value:'')||0.9,
    mao_hora:parseFloat(document.getElementById('f-mao-hora')?document.getElementById('f-mao-hora').value:'')||35,
    mao_min:parseFloat(document.getElementById('f-mao-min')?document.getElementById('f-mao-min').value:'')||0,
    insumos:parseFloat(document.getElementById('f-insumos')?document.getElementById('f-insumos').value:'')||0,
    nf:parseFloat(document.getElementById('f-nf')?document.getElementById('f-nf').value:'')||0,
    frete:parseFloat(document.getElementById('f-frete')?document.getElementById('f-frete').value:'')||0,
    margem_min:parseFloat(document.getElementById('f-margem-min')?document.getElementById('f-margem-min').value:'')||10,
    lucros:[1,2,3,4].map(i=>parseFloat(document.getElementById(`f-l${i}`).value)||0),
    ml_tipo:document.getElementById('ml-tipo')?document.getElementById('ml-tipo').value:'',
    ml_taxa:parseFloat(document.getElementById('ml-taxa')?document.getElementById('ml-taxa').value:'')||0,
    ml_envio:document.getElementById('ml-envio')?document.getElementById('ml-envio').value:'',
    tt_taxa:parseFloat(document.getElementById('tt-taxa')?document.getElementById('tt-taxa').value:'')||0,
    tt_afil:parseFloat(document.getElementById('tt-afil')?document.getElementById('tt-afil').value:'')||0,
    vd_pagamento:document.getElementById('vd-pagamento')?document.getElementById('vd-pagamento').value:'',
    obs:document.getElementById('f-obs')?document.getElementById('f-obs').value.trim():'',
    savedAt:new Date().toISOString(),
    updatedAt:new Date().toISOString(),
  };
}

// ── SALVAR ────────────────────────────────────
async function salvarProduto(){
  if(!currentUser||!db){showToast('Faça login para salvar','error');return;}
  const data=getFormData();
  try{
    // Check product limit for trial users
    const access = await checkAccess(currentUser);
    if(!access.ok){
      mostrarPaywall(access.reason);
      return;
    }
    if(access.plan==='trial' && access.productsLeft<=0){
      showToast('Limite de '+TRIAL_PRODUCT_LIMIT+' produtos gratuitos atingido. Assine para continuar!','error');
      setTimeout(function(){ mostrarPaywall('trial_limit'); }, 1500);
      return;
    }
    // Build history snapshot safely
    var pb2=((parseFloat(data.insumos)||0)+(parseFloat(data.nf)||0)+(parseFloat(data.frete)||0))/100;
    var custo2=(parseFloat(data.custo)||0)+(parseFloat(data.embalagem)||0);
    var lucro2=Array.isArray(data.lucros)&&data.lucros[1]?parseFloat(data.lucros[1]):10;
    var mlTaxa2=(parseFloat(data.ml_taxa)||14)/100;
    var peso2=parseFloat(data.peso)||0.3;
    var vml2=0;
    try{ vml2=calcVendaML(custo2,pb2,lucro2,mlTaxa2,peso2)||0; }catch(e2){ vml2=0; }
    var snapshot={
      date:new Date().toISOString(),
      custo:parseFloat(data.custo)||0,
      preco_ml:parseFloat(data.preco_ml)||0,
      vml_calculado:vml2,
    };

    // Clean data - remove undefined/NaN that Firestore rejects
    var cleanData={};
    Object.keys(data).forEach(function(k){
      var v=data[k];
      if(v===undefined||v===null) return;
      if(typeof v==='number'&&isNaN(v)) return;
      cleanData[k]=v;
    });
    // Ensure lucros is always a valid array
    if(!Array.isArray(cleanData.lucros)||cleanData.lucros.length===0){
      cleanData.lucros=[5,10,15,20];
    }

    // Save or Update Firestore
    if(_currentProductId){
      var existDoc=await db.collection('users').doc(currentUser.uid).collection('produtos').doc(_currentProductId).get();
      var existHist=existDoc.exists?(existDoc.data().historico||[]).slice(-29):[];
      existHist.push(snapshot);
      await db.collection('users').doc(currentUser.uid).collection('produtos').doc(_currentProductId)
        .update(Object.assign({},cleanData,{historico:existHist,updatedAt:new Date().toISOString()}));
      showToast('Produto atualizado! 💾','success');
    } else {
      await db.collection('users').doc(currentUser.uid).collection('produtos')
        .add(Object.assign({},cleanData,{historico:[snapshot]}));
      showToast('Produto salvo! 💾','success');
    }
    _currentProductId=null;
    limparFormulario();
    atualizarContadorTrial();
  }catch(e){console.error('Erro salvar completo:',e);showToast('Erro: '+e.code+' — '+e.message,'error');}
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
      ['f-preco-amazon','preco_amazon',0],['f-preco-site','preco_site',0],
      ['az-taxa','az_taxa',15],['st-plat','st_plat',0],['st-frete','st_frete',0],['st-gateway','st_gateway','pix'],
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
      ['f-obs','obs',''],
    ];
    fields.forEach(([elId,key,def])=>{
      const el=document.getElementById(elId);
      if(el)el.value=d[key]!==undefined?d[key]:def;
    });
    if(d.lucros)d.lucros.forEach((l,i)=>{const el=document.getElementById(`f-l${i+1}`);if(el)el.value=l;});
    setMode(d.modo||'normal');
    _currentProductId=id;
    calcular();
    showPage('calc');
    showToast('Produto carregado! Edite e salve para atualizar.','success');
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
    atualizarContadorTrial();
  }catch(e){showToast('Erro ao apagar','error');}
}

// ── FILTRAR COBERTURA (atalho do dashboard) ──────
function filtrarCobertura(valor){
  showPage('products');
  setTimeout(function(){
    var el=document.getElementById('filtro-cobertura');
    if(el){el.value=valor;loadProducts();}
  },300);
}

// ── ANÁLISE RÁPIDA ────────────────────────────
async function analisarProduto(id){
  if(!currentUser||!db)return;
  try{
    const doc=await db.collection('users').doc(currentUser.uid).collection('produtos').doc(id).get();
    if(!doc.exists)return;
    const d=doc.data();
    const pb=((d.insumos||0)+(d.nf||0)+(d.frete||0))/100;
    const custo=(d.custo||0)+(d.embalagem||0);
    const lucros=[d.lucros?d.lucros[0]:5, d.lucros?d.lucros[1]:10, d.lucros?d.lucros[2]:15, d.lucros?d.lucros[3]:20];

    const mps=[
      {name:'Mercado Livre',badge:'ML',bg:'#FFE600',fg:'#000',
        calc:function(l){return calcVendaML(custo,pb,l,(d.ml_taxa||14)/100,d.peso||0.3);},
        taxa:function(v){return v*(d.ml_taxa||14)/100+mlCustoOp(d.peso||0.3,v);}},
      {name:'Shopee',badge:'SP',bg:'#EE4D2D',fg:'#fff',
        calc:function(l){return calcVendaShopee(custo,pb,l);},
        taxa:function(v){var f=shopeeFaixa(v);return v*f.pct+f.fixo;}},
      {name:'TikTok',badge:'TT',bg:'#111',fg:'#00c87a',
        calc:function(l){var dn=1-pb-(d.tt_taxa||6)/100-(d.tt_afil||5)/100-l/100;return dn>0?custo/dn:null;},
        taxa:function(v){return v*((d.tt_taxa||6)+(d.tt_afil||5))/100;}},
      {name:'Magalu',badge:'MG',bg:'#0086FF',fg:'#fff',
        calc:function(l){return calcVendaMagalu(custo,pb,l);},
        taxa:function(v){return v*0.148+5;}},
      {name:'Venda Direta',badge:'VD',bg:'#00c87a',fg:'#000',
        calc:function(l){var dn=1-pb-l/100;return dn>0?custo/dn:null;},
        taxa:function(){return 0;}},
    ];

    var data=d.savedAt?new Date(d.savedAt).toLocaleDateString('pt-BR'):'—';
    var html='<div style="margin-bottom:16px">';
    html+='<div style="font-size:13px;color:var(--text2);margin-bottom:4px">'+
      (d.modo==='3d'?'🖨️ Impressão 3D':'📦 Produto Normal')+' · Salvo em '+data+'</div>';
    html+='<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px">';
    html+='<span>💰 Custo: <strong>'+fmt(d.custo)+'</strong></span>';
    if(d.embalagem) html+='<span>📦 Embalagem: <strong>'+fmt(d.embalagem)+'</strong></span>';
    if(d.peso) html+='<span>⚖️ Peso: <strong>'+d.peso+'kg</strong></span>';
    if(d.sku) html+='<span>SKU: <strong>'+d.sku+'</strong></span>';
    if(d.fornecedor) html+='<span>🏭 '+esc(d.fornecedor)+'</span>';
    html+='</div>';
    if(d.obs) html+='<div style="margin-top:8px;font-size:12px;color:var(--text2);background:var(--bg3);padding:8px 10px;border-radius:6px">📝 '+esc(d.obs)+'</div>';
    html+='</div>';

    // Table
    html+='<div style="overflow-x:auto"><table class="analise-table">';
    html+='<thead><tr><th>Marketplace</th>';
    lucros.forEach(function(l){html+='<th>'+l+'% lucro</th>';});
    html+='</tr></thead><tbody>';

    mps.forEach(function(mp){
      html+='<tr>';
      html+='<td><div style="display:flex;align-items:center;gap:8px">';
      html+='<div style="width:24px;height:24px;border-radius:5px;background:'+mp.bg+';color:'+mp.fg+
        ';display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;flex-shrink:0">'+mp.badge+'</div>';
      html+=mp.name+'</div></td>';
      lucros.forEach(function(l){
        var v=mp.calc(l);
        var lucroRS=v?v*(l/100):null;
        var min=d.margem_min||10;
        var cor=l<min?'var(--yellow)':'var(--green)';
        if(!v||!isFinite(v)){html+='<td style="color:var(--text3)">—</td>';}
        else{html+='<td><div class="analise-price" style="color:'+cor+'">'+fmt(v)+'</div><div style="font-size:11px;color:var(--text2)">lucro '+fmt(lucroRS)+'</div></td>';}
      });
      html+='</tr>';
    });
    html+='</tbody></table></div>';

    // History chart
    if(d.historico&&d.historico.length>1){
      html+='<div style="margin-top:16px">';
      html+='<div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">📈 Histórico de custo e preço ML</div>';
      var hist=d.historico.slice(-10);
      var maxV=Math.max.apply(null,hist.map(function(h){return Math.max(h.custo||0,h.vml_calculado||0);}));
      html+='<div class="hist-chart">';
      hist.forEach(function(h){
        var hDate=new Date(h.date).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
        var custoH=Math.round((h.custo||0)/maxV*80);
        var vmlH=Math.round((h.vml_calculado||0)/maxV*80);
        html+='<div class="hist-col">';
        html+='<div class="hist-bars">';
        html+='<div class="hist-bar" style="height:'+custoH+'px;background:var(--red)" title="Custo: '+fmt(h.custo)+'"></div>';
        html+='<div class="hist-bar" style="height:'+vmlH+'px;background:var(--green)" title="Preço ML: '+fmt(h.vml_calculado)+'"></div>';
        html+='</div>';
        html+='<div class="hist-label">'+hDate+'</div>';
        html+='</div>';
      });
      html+='</div>';
      html+='<div style="display:flex;gap:12px;font-size:11px;color:var(--text2);margin-top:6px">';
      html+='<span><span style="display:inline-block;width:10px;height:10px;background:var(--red);border-radius:2px;margin-right:4px"></span>Custo</span>';
      html+='<span><span style="display:inline-block;width:10px;height:10px;background:var(--green);border-radius:2px;margin-right:4px"></span>Preço ML (10% lucro)</span>';
      html+='</div></div>';
    }

    document.getElementById('analise-title').textContent=d.nome;
    document.getElementById('analise-body').innerHTML=html;
    document.getElementById('analise-carregar').setAttribute('onclick','carregarProduto("'+id+'");document.getElementById("modal-analise").style.display="none"');
    document.getElementById('modal-analise').style.display='flex';
  }catch(e){showToast('Erro ao carregar análise','error');}
}

// ── DUPLICAR PRODUTO ─────────────────────────
async function duplicarProduto(id){
  if(!currentUser||!db)return;
  try{
    const doc=await db.collection('users').doc(currentUser.uid).collection('produtos').doc(id).get();
    if(!doc.exists)return;
    const d=doc.data();
    const novo=Object.assign({},d,{
      nome:d.nome+' (cópia)',
      savedAt:new Date().toISOString(),
      updatedAt:new Date().toISOString(),
    });
    await db.collection('users').doc(currentUser.uid).collection('produtos').add(novo);
    showToast('Produto duplicado! ⧉','success');
    loadProducts();
  }catch(e){showToast('Erro ao duplicar','error');}
}

// ── LOAD PRODUCTS ─────────────────────────────
async function loadProducts(){
  if(!currentUser||!db)return;
  const el=document.getElementById('products-list');
  el.innerHTML='<p style="color:var(--text2);font-size:13px;padding:8px">Carregando...</p>';
  const catFiltroEl=document.getElementById('filtro-cat');
  const catFiltro=catFiltroEl?catFiltroEl.value:'';
  const searchInput=document.getElementById('search-input');
  const searchField=document.getElementById('search-field');
  const searchTerm=(searchInput?searchInput.value.trim().toLowerCase():'');
  const searchBy=(searchField?searchField.value:'nome');
  const ordemEl=document.getElementById('filtro-ordem');
  const ordem=ordemEl?ordemEl.value:'recente';
  const covFiltroEl=document.getElementById('filtro-cobertura');
  const covFiltro=covFiltroEl?covFiltroEl.value:'';

  try{
    const snap=await db.collection('users').doc(currentUser.uid)
      .collection('produtos').orderBy('savedAt','desc').get();
    let docs=snap.docs;
    if(catFiltro) docs=docs.filter(function(d){return d.data().categoria===catFiltro;});
    if(covFiltro!==''){
      docs=docs.filter(function(doc){
        var cov=calcCobertura(doc.data());
        if(covFiltro==='0')   return cov.ativos===0;
        if(covFiltro==='25')  return cov.ativos===1;
        if(covFiltro==='50')  return cov.ativos>=2&&cov.ativos<=3;
        if(covFiltro==='75')  return cov.ativos===4||cov.ativos===5;
        if(covFiltro==='100') return cov.ativos===6;
        return true;
      });
    }
    // Sort
    docs=docs.slice().sort(function(a,b){
      var da=a.data(), db=b.data();
      if(ordem==='nome') return (da.nome||'').localeCompare(db.nome||'');
      if(ordem==='custo_asc') return (da.custo||0)-(db.custo||0);
      if(ordem==='custo_desc') return (db.custo||0)-(da.custo||0);
      if(ordem==='cobertura'){
        var ca=calcCobertura(da), cb=calcCobertura(db);
        return ca.ativos-cb.ativos;
      }
      if(ordem==='margem'){
        var pbA=((da.insumos||0)+(da.nf||0)+(da.frete||0))/100;
        var pbB=((db.insumos||0)+(db.nf||0)+(db.frete||0))/100;
        var cA=(da.custo||0)+(da.embalagem||0);
        var cB=(db.custo||0)+(db.embalagem||0);
        var vA=calcVendaML(cA,pbA,10,(da.ml_taxa||14)/100,da.peso||0.3);
        var vB=calcVendaML(cB,pbB,10,(db.ml_taxa||14)/100,db.peso||0.3);
        var mA=vA?(vA-cA-vA*pbA-mlCustoOp(da.peso||0.3,vA))/vA*100:999;
        var mB=vB?(vB-cB-vB*pbB-mlCustoOp(db.peso||0.3,vB))/vB*100:999;
        return mA-mB;
      }
      // recente: já vem ordenado do Firestore
      return 0;
    });

    if(searchTerm) docs=docs.filter(function(d){
      const val=(d.data()[searchBy]||'').toString().toLowerCase();
      return val.indexOf(searchTerm)>-1;
    });
    if(!docs.length){
      el.innerHTML='<div class="empty-state"><div class="empty-icon">📦</div><p>Nenhum produto encontrado.</p><button class="btn-primary" onclick="showPage(&quot;calc&quot;)" style="margin-top:16px">+ Novo Cálculo</button></div>';
      return;
    }
    el.innerHTML=docs.map(function(doc){
      var d=doc.data();
      var data=d.savedAt?new Date(d.savedAt).toLocaleDateString('pt-BR'):'—';
      var catLabels={eletronicos:'Eletrônicos',acessorios:'Acessórios',casa:'Casa',
        moda:'Moda','3d':'3D',brinquedos:'Brinquedos',outros:'Outros'};
      var catLabel=catLabels[d.categoria]||'';
      var checked=compareList.includes(doc.id);
      var dims=d.comp&&d.alt&&d.larg?(d.comp+'×'+d.alt+'×'+d.larg+'cm · '):'';
      var pb=((d.insumos||0)+(d.nf||0)+(d.frete||0))/100;
      var custo=(d.custo||0)+(d.embalagem||0);
      var id=doc.id;

      function margemBadge(mp,preco,getTaxa){
        if(!preco) return '';
        var taxaRS=getTaxa(preco);
        var lucroRS=preco-custo-taxaRS-preco*pb;
        var lucroP=(lucroRS/preco)*100;
        var min=d.margem_min||10;
        var cor=lucroP<0?'#ff4d6d':lucroP<min?'#ffd60a':'#00c87a';
        return '<div class="pc-mp-row"><span class="pc-mp-name">'+mp+'</span>'
          +'<span class="pc-mp-price">'+fmt(preco)+'</span>'
          +'<span class="pc-mp-lucro" style="color:'+cor+'">'+lucroP.toFixed(1)+'% · '+fmt(lucroRS)+'</span></div>';
      }
      var mpRows='';
      if(d.preco_ml)     mpRows+=margemBadge('ML',     d.preco_ml,     function(v){return v*(d.ml_taxa||14)/100+mlCustoOp(d.peso||0.3,v);});
      if(d.preco_shopee) mpRows+=margemBadge('Shopee',  d.preco_shopee, function(v){var f=shopeeFaixa(v);return v*f.pct+f.fixo;});
      if(d.preco_tiktok) mpRows+=margemBadge('TikTok',  d.preco_tiktok, function(v){return v*((d.tt_taxa||6)+(d.tt_afil||5))/100;});
      if(d.preco_magalu) mpRows+=margemBadge('Magalu',  d.preco_magalu, function(v){return v*0.148+5;});
      if(d.preco_amazon) mpRows+=margemBadge('Amazon',  d.preco_amazon, function(v){return v*(d.az_taxa||15)/100+azDBAFixo(v,d.peso||0.3,d.az_regiao||2);});
      if(d.preco_site)   mpRows+=margemBadge('Site',    d.preco_site,   function(v){return v*(d.st_plat||0)/100;});
      if(d.preco_direta) mpRows+=margemBadge('Direta',  d.preco_direta, function(){return 0;});

      var identInfo='';
      if(d.sku)        identInfo+='<span class="pc-tag">SKU: '+esc(d.sku)+'</span>';
      if(d.ean)        identInfo+='<span class="pc-tag">EAN: '+esc(d.ean)+'</span>';
      if(d.fornecedor) identInfo+='<span class="pc-tag">'+esc(d.fornecedor)+'</span>';

      var cov=calcCobertura(d);
      var html='<div class="product-card '+cov.bgClass+'" id="pc-'+id+'">';
      html+='<input type="checkbox" class="compare-check" '+(checked?'checked':'')+' onchange="toggleCompare(this.dataset.id,this.checked)" data-id="'+id+'" title="Comparar"/>';
      html+='<div class="product-icon">'+(d.modo==='3d'?'🖨️':'📦')+'</div>';
      html+='<div class="product-info">';
      html+='<div class="product-name">'+esc(d.nome);
      if(d.modo==='3d') html+='<span class="product-tag tag-3d">3D</span>';
      if(catLabel) html+='<span class="product-tag tag-cat">'+catLabel+'</span>';
      html+='</div>';
      html+='<div class="product-meta">'+dims+(d.peso||'')+'kg · Custo: '+fmt(d.custo)+' · '+data+'</div>';
      if(identInfo) html+='<div class="pc-ident">'+identInfo+'</div>';
      html+='<div class="pc-coverage"><div class="mp-dots">'+mpIcons(d)+'</div><span class="cov-label" style="color:'+cov.cor+'">'+cov.label+' ('+cov.ativos+'/6)</span></div>';
      if(mpRows) html+='<div class="pc-mp-list">'+mpRows+'</div>';
      if(d.obs) html+='<div class="pc-obs">📝 '+esc(d.obs)+'</div>';
      html+='</div>';
      html+='<div class="product-actions">';
      html+='<button class="btn-icon" data-id="'+id+'" onclick="analisarProduto(this.dataset.id)">👁 Análise</button>';
      html+='<button class="btn-icon" data-id="'+id+'" onclick="carregarProduto(this.dataset.id)">✏️ Carregar</button>';
      html+='<button class="btn-icon" data-id="'+id+'" onclick="duplicarProduto(this.dataset.id)" title="Duplicar produto">⧉ Duplicar</button>';
      html+='<button class="btn-icon danger" data-id="'+id+'" onclick="deletarProduto(this.dataset.id)">✕</button>';
      html+='</div></div>';
      return html;
    }).join('');
  }catch(e){el.innerHTML='<p style="color:var(--red)">Erro: '+e.message+'</p>';}
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

    // Trial banner — atualiza em tempo real
    atualizarContadorTrial();

    const produtos=snap.docs.map(d=>({id:d.id,...d.data()}));

    // Coverage stats
    var covStats={0:0,1:0,2:0,3:0,4:0,5:0,6:0};
    var mpCount={'preco_ml':0,'preco_shopee':0,'preco_tiktok':0,'preco_magalu':0,'preco_amazon':0,'preco_site':0};
    produtos.forEach(function(p){
      var cov=calcCobertura(p);
      covStats[cov.ativos]=(covStats[cov.ativos]||0)+1;
      Object.keys(mpCount).forEach(function(k){if(p[k]&&p[k]>0)mpCount[k]++;});
    });
    var semAnuncio=covStats[0]||0;
    var cobTotal=covStats[6]||0;

    // Stats
    const stats=document.getElementById('dash-stats');
    const total=produtos.length;
    const total3d=produtos.filter(p=>p.modo==='3d').length;
    const custoMedio=produtos.reduce((s,p)=>s+(p.custo||0),0)/total;
    stats.innerHTML=
      '<div class="stat-card" onclick="showPage(&quot;products&quot;)" style="cursor:pointer"><div class="stat-num">'+total+'</div><div class="stat-label">Produtos salvos</div></div>'+
      '<div class="stat-card" onclick="filtrarCobertura(&quot;100&quot;)" style="cursor:pointer"><div class="stat-num" style="color:var(--green)">'+cobTotal+'</div><div class="stat-label">Cobertura total ✅</div></div>'+
      '<div class="stat-card" onclick="filtrarCobertura(&quot;0&quot;)" style="cursor:pointer"><div class="stat-num" style="color:var(--red)">'+semAnuncio+'</div><div class="stat-label">Sem anúncio 🔴</div></div>'+
      '<div class="stat-card"><div class="stat-num">'+fmt(custoMedio)+'</div><div class="stat-label">Custo médio</div></div>';

    // Coverage donut chart
    var donutCard=document.getElementById('dash-donut-card');
    if(donutCard) donutCard.style.display='block';
    var mpRankCard=document.getElementById('dash-mp-rank-card');
    if(mpRankCard) mpRankCard.style.display='block';
    var donutEl=document.getElementById('dash-donut');
    if(donutEl&&total>0){
      var groups=[
        {label:'Sem anúncio',count:covStats[0]||0,cor:'#ff4d6d'},
        {label:'Baixa',count:(covStats[1]||0),cor:'#ff8c42'},
        {label:'Parcial',count:(covStats[2]||0)+(covStats[3]||0),cor:'#ffd60a'},
        {label:'Boa',count:(covStats[4]||0)+(covStats[5]||0),cor:'#4fa3f7'},
        {label:'Total',count:covStats[6]||0,cor:'#00c87a'},
      ].filter(function(g){return g.count>0;});
      var total_cov=groups.reduce(function(s,g){return s+g.count;},0)||1;
      var offset=0;
      var slices=groups.map(function(g){
        var pct=g.count/total_cov;
        var dash=pct*283;
        var s='<circle cx="50" cy="50" r="45" fill="none" stroke="'+g.cor+'" stroke-width="10" '
          +'stroke-dasharray="'+dash.toFixed(1)+' '+(283-dash).toFixed(1)+'" '
          +'stroke-dashoffset="'+(-(offset*283)).toFixed(1)+'" '
          +'transform="rotate(-90 50 50)"><title>'+g.label+': '+g.count+'</title></circle>';
        offset+=pct;
        return s;
      }).join('');
      var legend=groups.map(function(g){
        return '<div class="donut-legend-item"><span style="background:'+g.cor+'" class="legend-dot"></span>'+g.label+' <strong>'+g.count+'</strong></div>';
      }).join('');
      donutEl.innerHTML='<div class="donut-wrap">'
        +'<svg viewBox="0 0 100 100" width="120" height="120">'+slices
        +'<text x="50" y="54" text-anchor="middle" fill="var(--text)" font-size="14" font-weight="bold">'+total+'</text>'
        +'<text x="50" y="65" text-anchor="middle" fill="var(--text2)" font-size="7">produtos</text>'
        +'</svg>'
        +'<div class="donut-legend">'+legend+'</div>'
        +'</div>';

      // MP ranking
      var mpRankEl=document.getElementById('dash-mp-rank');
      if(mpRankEl){
        var mps=[
          {name:'Mercado Livre',key:'preco_ml',bg:'#FFE600',fg:'#000',badge:'ML'},
          {name:'Shopee',key:'preco_shopee',bg:'#EE4D2D',fg:'#fff',badge:'SP'},
          {name:'TikTok Shop',key:'preco_tiktok',bg:'#111',fg:'#00c87a',badge:'TT'},
          {name:'Magalu',key:'preco_magalu',bg:'#0086FF',fg:'#fff',badge:'MG'},
          {name:'Amazon',key:'preco_amazon',bg:'#FF9900',fg:'#000',badge:'AZ'},
          {name:'Site Próprio',key:'preco_site',bg:'#6C5CE7',fg:'#fff',badge:'ST'},
        ].sort(function(a,b){return (mpCount[b.key]||0)-(mpCount[a.key]||0);});
        mpRankEl.innerHTML=mps.map(function(mp){
          var cnt=mpCount[mp.key]||0;
          var pct=Math.round((cnt/total)*100);
          return '<div class="mp-rank-row">'
            +'<div class="mp-dot" style="background:'+mp.bg+';color:'+mp.fg+'">'+mp.badge+'</div>'
            +'<span class="mp-rank-name">'+mp.name+'</span>'
            +'<div class="mp-rank-bar-wrap"><div class="mp-rank-bar" style="width:'+pct+'%;background:'+mp.bg+'"></div></div>'
            +'<span class="mp-rank-count">'+cnt+'</span>'
            +'</div>';
        }).join('');
      }
    }

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

    // Chart — evolução de margem por mês
    renderDashChart(produtos);

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
        return '<div class="alert-row">⚠️ <strong>'+esc(a.nome)+'</strong> no '+esc(a.mp)+': '+fmt(a.preco)+' · margem '+a.lucroP.toFixed(1)+'%<button class="btn-icon" style="margin-left:auto" onclick="carregarProduto(\'' +a.id+ '\')">Ver</button></div>';
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
  loadTheme();
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

// ── ONBOARDING ───────────────────────────────
var _onboardStep = 1;
var _totalSteps = 5;

function mostrarOnboarding(){
  document.getElementById('modal-onboarding').style.display='flex';
  goStep(1);
}

function fecharOnboarding(){
  document.getElementById('modal-onboarding').style.display='none';
  // Mark as seen in localStorage
  localStorage.setItem('mgf_onboarded','1');
  showPage('calc');
}

function goStep(n){
  _onboardStep = n;
  // Hide all steps
  for(var i=1;i<=_totalSteps;i++){
    var el=document.getElementById('step-'+i);
    if(el) el.classList.toggle('active', i===n);
  }
  // Update dots
  document.querySelectorAll('#onboarding-dots .dot').forEach(function(d,i){
    d.classList.toggle('active', i===n-1);
  });
  // Update button
  var btn=document.getElementById('btn-onboard-next');
  var skip=document.getElementById('btn-onboard-skip');
  if(n===_totalSteps){
    btn.textContent='Começar agora! 🚀';
    if(skip) skip.style.display='none';
  } else {
    btn.textContent='Próximo →';
    if(skip) skip.style.display='block';
  }
}

function nextStep(){
  if(_onboardStep >= _totalSteps){
    fecharOnboarding();
  } else {
    goStep(_onboardStep + 1);
  }
}

function checkOnboarding(){
  const seen = localStorage.getItem('mgf_onboarded');
  if(!seen) mostrarOnboarding();
}


// ── TEMA CLARO/ESCURO ─────────────────────────
function toggleTheme(){
  var isLight=document.body.classList.toggle('light-mode');
  localStorage.setItem('mgf_theme',isLight?'light':'dark');
  document.getElementById('btn-theme').textContent=isLight?'☀️':'🌙';
}
function loadTheme(){
  var saved=localStorage.getItem('mgf_theme');
  if(saved==='light'){
    document.body.classList.add('light-mode');
    var btn=document.getElementById('btn-theme');
    if(btn) btn.textContent='☀️';
  }
}

// ── FORNECEDORES ──────────────────────────────
var compareSupList=[];

function abrirModalFornecedor(id){
  var modal=document.getElementById('modal-fornecedor');
  var title=document.getElementById('modal-sup-title');
  document.getElementById('sup-edit-id').value=id||'';
  if(id){
    title.textContent='Editar Fornecedor';
    // Load data
    if(!currentUser||!db)return;
    db.collection('users').doc(currentUser.uid).collection('fornecedores').doc(id).get().then(function(doc){
      if(!doc.exists)return;
      var d=doc.data();
      document.getElementById('sup-nome').value=d.nome||'';
      document.getElementById('sup-produto').value=d.produto||'';
      document.getElementById('sup-custo').value=d.custo||'';
      document.getElementById('sup-frete').value=d.frete||'';
      document.getElementById('sup-minimo').value=d.minimo||'';
      document.getElementById('sup-prazo').value=d.prazo||'';
      document.getElementById('sup-contato').value=d.contato||'';
      document.getElementById('sup-obs').value=d.obs||'';
    });
  } else {
    title.textContent='Novo Fornecedor';
    ['sup-nome','sup-produto','sup-custo','sup-frete','sup-minimo','sup-prazo','sup-contato','sup-obs']
      .forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
  }
  modal.style.display='flex';
}

async function salvarFornecedor(){
  if(!currentUser||!db){showToast('Faça login para salvar','error');return;}
  var nome=document.getElementById('sup-nome').value.trim();
  if(!nome){showToast('Nome do fornecedor é obrigatório','error');return;}
  var data={
    nome:nome,
    produto:document.getElementById('sup-produto').value.trim()||'',
    custo:parseFloat(document.getElementById('sup-custo').value)||0,
    frete:parseFloat(document.getElementById('sup-frete').value)||0,
    minimo:parseInt(document.getElementById('sup-minimo').value)||1,
    prazo:parseInt(document.getElementById('sup-prazo').value)||0,
    contato:document.getElementById('sup-contato').value.trim()||'',
    obs:document.getElementById('sup-obs').value.trim()||'',
    savedAt:new Date().toISOString(),
  };
  try{
    var editId=document.getElementById('sup-edit-id').value;
    if(editId){
      await db.collection('users').doc(currentUser.uid).collection('fornecedores').doc(editId).update(data);
      showToast('Fornecedor atualizado! ✅','success');
    } else {
      await db.collection('users').doc(currentUser.uid).collection('fornecedores').add(data);
      showToast('Fornecedor salvo! 🏭','success');
    }
    document.getElementById('modal-fornecedor').style.display='none';
    loadSuppliers();
  }catch(e){showToast('Erro: '+e.message,'error');}
}

async function loadSuppliers(){
  if(!currentUser||!db)return;
  var el=document.getElementById('suppliers-list');
  if(!el)return;
  el.innerHTML='<p style="color:var(--text2);font-size:13px;padding:8px">Carregando...</p>';
  var search=(document.getElementById('supplier-search')||{value:''}).value.trim().toLowerCase();
  try{
    var snap=await db.collection('users').doc(currentUser.uid)
      .collection('fornecedores').orderBy('savedAt','desc').get();
    var docs=snap.docs;
    if(search) docs=docs.filter(function(d){
      var data=d.data();
      return (data.nome||'').toLowerCase().includes(search)||(data.produto||'').toLowerCase().includes(search);
    });
    if(!docs.length){
      el.innerHTML='<div class="empty-state"><div class="empty-icon">🏭</div><p>Nenhum fornecedor cadastrado ainda.<br/>Clique em "+ Novo Fornecedor" para começar!</p></div>';
      return;
    }
    el.innerHTML=docs.map(function(doc){
      var d=doc.data();
      var id=doc.id;
      var checked=compareSupList.includes(id);
      var custoTotal=d.custo+(d.frete||0)/(d.minimo||1);
      return '<div class="supplier-card" id="sc-'+id+'">'
        +'<input type="checkbox" class="compare-check" '+(checked?'checked':'')+' data-id="'+id+'" onchange="toggleCompareSup(this.dataset.id,this.checked)"/>'
        +'<div class="supplier-icon">🏭</div>'
        +'<div class="supplier-info">'
          +'<div class="supplier-name">'+esc(d.nome)+(d.produto?'<span class="product-tag tag-cat">'+esc(d.produto)+'</span>':'')+'</div>'
          +'<div class="supplier-meta">'
            +(d.custo?'Custo: <strong>'+fmt(d.custo)+'</strong>':'')
            +(d.frete?' · Frete: '+fmt(d.frete):'')
            +(d.minimo?' · Mín: '+d.minimo+' un':'')
            +(d.prazo?' · Prazo: '+d.prazo+'d':'')
          +'</div>'
          +(d.obs?'<div class="pc-obs">📝 '+esc(d.obs)+'</div>':'')
        +'</div>'
        +'<div class="supplier-right">'
          +'<div class="supplier-total">'+fmt(custoTotal)+'<span style="font-size:11px;color:var(--text2)">/un c/frete</span></div>'
          +(d.contato?'<a href="'+(d.contato.startsWith('http')?d.contato:'https://'+d.contato)+'" target="_blank" class="btn-icon" style="font-size:11px">🔗 Site</a>':'')
        +'</div>'
        +'<div class="product-actions">'
          +'<button class="btn-icon" data-id="'+id+'" onclick="usarFornecedor(this.dataset.id)">✔ Usar</button>'
          +'<button class="btn-icon" data-id="'+id+'" onclick="abrirModalFornecedor(this.dataset.id)">✏️</button>'
          +'<button class="btn-icon danger" data-id="'+id+'" onclick="deletarFornecedor(this.dataset.id)">✕</button>'
        +'</div>'
      +'</div>';
    }).join('');
  }catch(e){el.innerHTML='<p style="color:var(--red)">Erro: '+e.message+'</p>';}
}

async function deletarFornecedor(id){
  if(!confirm('Apagar este fornecedor?'))return;
  if(!currentUser||!db)return;
  try{
    await db.collection('users').doc(currentUser.uid).collection('fornecedores').doc(id).delete();
    showToast('Fornecedor apagado','success');
    loadSuppliers();
  }catch(e){showToast('Erro ao apagar','error');}
}

function usarFornecedor(id){
  if(!currentUser||!db)return;
  db.collection('users').doc(currentUser.uid).collection('fornecedores').doc(id).get().then(function(doc){
    if(!doc.exists)return;
    var d=doc.data();
    var custoEl=document.getElementById('f-custo');
    var fornEl=document.getElementById('f-fornecedor');
    if(custoEl&&d.custo) custoEl.value=d.custo;
    if(fornEl&&d.nome) fornEl.value=d.nome;
    if(typeof calcular==='function') calcular();
    showPage('calc');
    showToast('Fornecedor "'+d.nome+'" aplicado ao cálculo! ✅','success');
  });
}

function toggleCompareSup(id,checked){
  if(checked&&compareSupList.length>=3){
    showToast('Máximo 3 fornecedores para comparar','error');
    var cb=document.querySelector('[data-id="'+id+'"].compare-check');
    if(cb) cb.checked=false;
    return;
  }
  if(checked) compareSupList.push(id);
  else compareSupList=compareSupList.filter(function(x){return x!==id;});
  var bar=document.getElementById('compare-suppliers-bar');
  var cnt=document.getElementById('compare-sup-count');
  bar.style.display=compareSupList.length>1?'flex':'none';
  cnt.textContent=compareSupList.length+' selecionado'+(compareSupList.length!==1?'s':'');
}

function limparComparacaoFornecedores(){
  compareSupList=[];
  document.querySelectorAll('#suppliers-list .compare-check').forEach(function(c){c.checked=false;});
  document.getElementById('compare-suppliers-bar').style.display='none';
}

async function compararFornecedores(){
  if(compareSupList.length<2){showToast('Selecione ao menos 2 fornecedores','error');return;}
  if(!currentUser||!db)return;
  try{
    var docs=await Promise.all(compareSupList.map(function(id){
      return db.collection('users').doc(currentUser.uid).collection('fornecedores').doc(id).get();
    }));
    var sups=docs.map(function(d){return Object.assign({id:d.id},d.data());});
    var fields=[
      {label:'Custo unitário',key:'custo',fmt:fmt},
      {label:'Frete',key:'frete',fmt:fmt},
      {label:'Pedido mínimo',key:'minimo',fmt:function(v){return v+' un';}},
      {label:'Prazo de entrega',key:'prazo',fmt:function(v){return v+' dias';}},
      {label:'Custo c/ frete/un',key:'_total',fmt:fmt},
    ];
    sups.forEach(function(s){s._total=s.custo+(s.frete||0)/(s.minimo||1);});
    var body=document.getElementById('modal-compare-sup-body');
    var html='<div style="overflow-x:auto"><table class="compare-table">'
      +'<thead><tr><th>Campo</th>'+sups.map(function(s){return '<th>'+s.nome+'</th>';}).join('')+'</tr></thead>'
      +'<tbody>';
    fields.forEach(function(f){
      var vals=sups.map(function(s){return s[f.key]||0;});
      var best=f.key==='prazo'||f.key==='custo'||f.key==='_total'?Math.min.apply(null,vals):null;
      html+='<tr><td>'+f.label+'</td>'+sups.map(function(s){
        var v=s[f.key]||0;
        var isBest=best!==null&&v===best&&best>0;
        return '<td class="'+(isBest?'compare-price':'')+'">'+f.fmt(v)+(isBest?' ⭐':'')+'</td>';
      }).join('')+'</tr>';
    });
    if(sups[0]&&sups[0].obs!==undefined){
      html+='<tr class="compare-section"><td colspan="'+(sups.length+1)+'">Observações</td></tr>';
      html+='<tr><td>Obs</td>'+sups.map(function(s){return '<td style="font-size:12px;color:var(--text2)">'+(s.obs||'—')+'</td>';}).join('')+'</tr>';
    }
    html+='</tbody></table></div>';
    body.innerHTML=html;
    document.getElementById('modal-compare-sup').style.display='flex';
  }catch(e){showToast('Erro ao comparar','error');}
}

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
      <p>Dúvidas sobre estes termos: <strong>suporte.margify@gmail.com</strong></p>`;
  } else {
    title.textContent = 'Política de Privacidade — Margify';
    body.innerHTML = `
      <p class="legal-date">Última atualização: ${new Date().toLocaleDateString('pt-BR')} · Em conformidade com a LGPD (Lei 13.709/2018)</p>

      <h4>1. Responsável pelo Tratamento</h4>
      <p>Os dados coletados pela Margify são tratados por pessoa física, operador da plataforma Margify, com contato disponível em <strong>suporte.margify@gmail.com</strong>.</p>

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
      <p>Para exercer qualquer direito: <strong>suporte.margify@gmail.com</strong> — respondemos em até 15 dias úteis.</p>

      <h4>6. Segurança</h4>
      <p>Seus dados são armazenados no Google Firebase com criptografia em trânsito (TLS) e em repouso. As regras de segurança garantem que cada usuário acessa apenas seus próprios dados.</p>

      <h4>7. Retenção de Dados</h4>
      <p>Seus dados são mantidos enquanto sua conta estiver ativa. Após solicitação de exclusão, os dados são removidos em até 30 dias.</p>

      <h4>8. Cookies</h4>
      <p>Utilizamos apenas cookies essenciais para autenticação (Google Firebase Auth). Não utilizamos cookies de rastreamento ou publicidade.</p>

      <h4>9. Contato e DPO</h4>
      <p>Para questões de privacidade e proteção de dados: <strong>suporte.margify@gmail.com</strong></p>`;
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
