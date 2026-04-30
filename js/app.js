// ── TABELA ML: custo operacional [peso][faixa_preço] ──────────────────────
const ML_TABELA = {
  // formato: [max_peso_kg]: [faixa0-18.99, 19-48.99, 49-78.99, 79-99.99, 100-119.99, 120-149.99, 150-199.99, 200+]
  0.3:  [5.65, 6.55, 7.75, 12.35, 14.35, 16.45, 18.45, 20.95],
  0.5:  [5.95, 6.65, 7.85, 13.25, 15.45, 17.65, 19.85, 22.55],
  1.0:  [6.05, 6.75, 7.95, 13.85, 16.15, 18.45, 20.75, 23.65],
  1.5:  [6.15, 6.85, 8.05, 14.15, 16.45, 18.85, 21.15, 24.65],
  2.0:  [6.25, 6.95, 8.15, 14.45, 16.85, 19.25, 21.65, 24.65],
  3.0:  [6.35, 7.95, 8.55, 15.75, 18.35, 21.05, 23.65, 26.25],
  4.0:  [6.45, 8.15, 8.95, 17.05, 19.85, 22.65, 25.55, 28.35],
  5.0:  [6.55, 8.35, 9.75, 18.45, 21.55, 24.65, 27.75, 30.75],
  6.0:  [6.65, 8.55, 9.95, 25.45, 28.55, 32.65, 35.75, 39.75],
  7.0:  [6.75, 8.75, 10.15,27.05, 31.05, 36.05, 40.05, 44.05],
  8.0:  [6.85, 8.95, 10.35,28.85, 33.65, 38.45, 43.25, 48.05],
  9.0:  [6.95, 9.15, 10.55,29.65, 34.55, 39.55, 44.45, 49.35],
  11.0: [7.05, 9.55, 10.95,41.25, 48.05, 54.95, 61.75, 68.65],
};
const ML_PESO_KEYS = [0.3,0.5,1.0,1.5,2.0,3.0,4.0,5.0,6.0,7.0,8.0,9.0,11.0];
const ML_FAIXAS_PREÇO = [0,19,49,79,100,120,150,200];

function mlCustoOp(peso, preco) {
  // Encontra linha de peso
  let pesoKey = ML_PESO_KEYS[ML_PESO_KEYS.length - 1];
  for (const k of ML_PESO_KEYS) { if (peso <= k) { pesoKey = k; break; } }
  // Encontra coluna de preço
  let col = ML_FAIXAS_PREÇO.length - 1;
  for (let i = 0; i < ML_FAIXAS_PREÇO.length; i++) {
    if (preco < ML_FAIXAS_PREÇO[i]) { col = i - 1; break; }
  }
  col = Math.max(0, Math.min(col, 7));
  return ML_TABELA[pesoKey][col];
}

// ── SHOPEE escalonada ──────────────────────────────────────────────────────
const SHOPEE_FAIXAS = [
  {max: 79.99,  pct: 0.20, fixo: 4},
  {max: 99.99,  pct: 0.14, fixo: 16},
  {max: 199.99, pct: 0.14, fixo: 20},
  {max: 499.99, pct: 0.14, fixo: 26},
  {max: Infinity,pct:0.14, fixo: 26},
];
function shopeeFaixa(v) {
  return SHOPEE_FAIXAS.find(f => v <= f.max) || SHOPEE_FAIXAS[4];
}
function calcVendaShopee(custo, pBase, lucroP) {
  let v = custo / (1 - pBase - 0.14 - lucroP / 100);
  for (let i = 0; i < 60; i++) {
    const f = shopeeFaixa(v);
    const vn = (custo + f.fixo) / (1 - pBase - f.pct - lucroP / 100);
    if (Math.abs(vn - v) < 0.001) { v = vn; break; }
    v = vn;
  }
  return v;
}

// ── ML iterativo (inclui custo fixo operacional) ──────────────────────────
function calcVendaML(custo, pBase, lucroP, mlTaxa, peso) {
  let v = (custo + 15) / (1 - pBase - mlTaxa - lucroP / 100);
  for (let i = 0; i < 60; i++) {
    const op = mlCustoOp(peso, v);
    const vn = (custo + op) / (1 - pBase - mlTaxa - lucroP / 100);
    if (Math.abs(vn - v) < 0.001) { v = vn; break; }
    v = vn;
  }
  return v;
}

// ── Magalu ────────────────────────────────────────────────────────────────
function calcVendaMagalu(custo, pBase, lucroP) {
  // 14.8% + R$5 fixo
  const taxa = 0.148;
  const fixo = 5;
  const denom = 1 - pBase - taxa - lucroP / 100;
  if (denom <= 0) return null;
  return (custo + fixo) / denom;
}

// ── Formato ───────────────────────────────────────────────────────────────
function fmt(v) {
  if (v == null || !isFinite(v)) return '—';
  return 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function fmtPct(v) { return (v * 100).toFixed(1) + '%'; }

// ── Estado ────────────────────────────────────────────────────────────────
let modo = 'normal';
let currentUser = null;
let db = null;
let openCascades = {};

function getCusto() {
  let base = parseFloat(document.getElementById('f-custo').value) || 0;
  const emb = parseFloat(document.getElementById('f-embalagem').value) || 0;
  let fil = 0, energia = 0;
  if (modo === '3d') {
    const g = parseFloat(document.getElementById('f-gramas').value) || 0;
    const cf = parseFloat(document.getElementById('f-custo-fil').value) || 0;
    const h = parseFloat(document.getElementById('f-horas').value) || 0;
    const w = parseFloat(document.getElementById('f-watts').value) || 0;
    const kwh = parseFloat(document.getElementById('f-kwh').value) || 0;
    fil = (g / 1000) * cf;
    energia = h * (w / 1000) * kwh;
    const box = document.getElementById('box-3d');
    if (g || h) {
      box.style.display = 'block';
      document.getElementById('v-fil').textContent = fmt(fil);
      document.getElementById('v-energia').textContent = fmt(energia);
      document.getElementById('v-3d-total').textContent = fmt(base + emb + fil + energia);
    } else {
      box.style.display = 'none';
    }
  }
  return { total: base + emb + fil + energia, emb, fil, energia, base };
}

function getLucros() {
  return [1, 2, 3, 4].map(i => parseFloat(document.getElementById(`f-l${i}`).value) || 0);
}

function getPBase() {
  const pi = (parseFloat(document.getElementById('f-insumos').value) || 0) / 100;
  const pn = (parseFloat(document.getElementById('f-nf').value) || 0) / 100;
  const pf = (parseFloat(document.getElementById('f-frete').value) || 0) / 100;
  return { total: pi + pn + pf, insumos: pi, nf: pn, frete: pf };
}

function buildCascade(id, venda, lucroP, rows) {
  const isOpen = openCascades[id];
  let html = rows.map(([label, val, cls]) =>
    `<div class="cascade-row"><span class="cascade-label">${label}</span><span class="cascade-val ${cls||''}">${fmt(val)}</span></div>`
  ).join('');
  return `
    <div class="result-cascade ${isOpen ? 'open' : ''}" id="cascade-${id}">
      ${html}
    </div>`;
}

function toggleCascade(id) {
  openCascades[id] = !openCascades[id];
  const el = document.getElementById(`cascade-${id}`);
  if (el) el.classList.toggle('open', openCascades[id]);
}

function buildMPResults(containerId, results, prefix) {
  const container = document.getElementById(containerId);
  if (!results || !results.length) { container.innerHTML = '<p style="color:var(--text3);font-size:12px">—</p>'; return; }
  container.innerHTML = results.map((r, i) => {
    const cid = `${prefix}-${i}`;
    return `
      <div class="result-item">
        <div class="result-item-header" onclick="toggleCascade('${cid}')">
          <div>
            <div class="result-meta">${r.label}</div>
          </div>
          <div>
            <div class="result-price">${fmt(r.venda)}</div>
            <div class="result-lucro">lucro: ${fmt(r.lucroRS)} (${r.lucroP}%)</div>
          </div>
        </div>
        ${buildCascade(cid, r.venda, r.lucroP, r.rows)}
      </div>`;
  }).join('');
}

function calcular() {
  const custoObj = getCusto();
  const custo = custoObj.total;
  const pb = getPBase();
  const lucros = getLucros();

  const alertEl = document.getElementById('alert-custo');
  const btnSalvar = document.getElementById('btn-salvar');

  if (!custo) {
    alertEl.style.display = 'block';
    btnSalvar.style.display = 'none';
    ['ml-results','shopee-results','tiktok-results','magalu-results','direta-results'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
    document.getElementById('ml-custo-op').textContent = '';
    return;
  }
  alertEl.style.display = 'none';
  btnSalvar.style.display = 'block';

  // ── ML ──
  const mlTipo = document.getElementById('ml-tipo').value;
  const mlTaxaVal = (parseFloat(document.getElementById('ml-taxa').value) || 0) / 100;
  const mlPeso = parseFloat(document.getElementById('ml-peso').value) || 0.3;

  const mlResults = lucros.map((l, i) => {
    const venda = calcVendaML(custo, pb.total, l, mlTaxaVal, mlPeso);
    if (!venda || !isFinite(venda) || venda <= 0) return null;
    const op = mlCustoOp(mlPeso, venda);
    const taxaRS = venda * mlTaxaVal;
    const lucroRS = venda * (l / 100);
    return {
      label: `${l}% de lucro`, venda, lucroRS, lucroP: l,
      rows: [
        [`Taxa ML (${mlTipo}) ${(mlTaxaVal*100).toFixed(1)}%`, taxaRS, 'cascade-neg'],
        [`Custo operacional (${mlPeso}kg)`, op, 'cascade-neg'],
        [`Insumos ${(pb.insumos*100).toFixed(0)}%`, venda*pb.insumos, 'cascade-neg'],
        [`Nota fiscal ${(pb.nf*100).toFixed(0)}%`, venda*pb.nf, 'cascade-neg'],
        pb.frete ? [`Frete ${(pb.frete*100).toFixed(0)}%`, venda*pb.frete, 'cascade-neg'] : null,
        custoObj.emb ? ['Embalagem', custoObj.emb, 'cascade-neg'] : null,
        custoObj.energia ? ['Energia elétrica', custoObj.energia, 'cascade-neg'] : null,
        custoObj.fil ? ['Filamento', custoObj.fil, 'cascade-neg'] : null,
        ['Custo produto', custoObj.base, 'cascade-neg'],
        null, // divider placeholder
        ['Lucro líquido', lucroRS, 'cascade-pos'],
      ].filter(Boolean),
    };
  }).filter(Boolean);

  // Show ML custo op estimate for first lucro
  if (mlResults.length) {
    const op0 = mlCustoOp(mlPeso, mlResults[0].venda);
    document.getElementById('ml-custo-op').textContent =
      `Custo operacional estimado: ${fmt(op0)} (${mlPeso}kg, ${mlTipo})`;
  }
  buildMPResults('ml-results', mlResults, 'ml');

  // ── SHOPEE ──
  const shopeeResults = lucros.map((l, i) => {
    const venda = calcVendaShopee(custo, pb.total, l);
    if (!venda || !isFinite(venda) || venda <= 0) return null;
    const f = shopeeFaixa(venda);
    const taxaRS = venda * f.pct + f.fixo;
    const lucroRS = venda * (l / 100);
    return {
      label: `${l}% de lucro`, venda, lucroRS, lucroP: l,
      rows: [
        [`Comissão Shopee (${(f.pct*100).toFixed(0)}%+R$${f.fixo})`, taxaRS, 'cascade-neg'],
        [`Insumos ${(pb.insumos*100).toFixed(0)}%`, venda*pb.insumos, 'cascade-neg'],
        [`Nota fiscal ${(pb.nf*100).toFixed(0)}%`, venda*pb.nf, 'cascade-neg'],
        pb.frete ? [`Frete ${(pb.frete*100).toFixed(0)}%`, venda*pb.frete, 'cascade-neg'] : null,
        custoObj.emb ? ['Embalagem', custoObj.emb, 'cascade-neg'] : null,
        custoObj.energia ? ['Energia elétrica', custoObj.energia, 'cascade-neg'] : null,
        custoObj.fil ? ['Filamento', custoObj.fil, 'cascade-neg'] : null,
        ['Custo produto', custoObj.base, 'cascade-neg'],
        ['Lucro líquido', lucroRS, 'cascade-pos'],
      ].filter(Boolean),
    };
  }).filter(Boolean);
  buildMPResults('shopee-results', shopeeResults, 'sh');

  // ── TIKTOK ──
  const ttTaxa = (parseFloat(document.getElementById('tt-taxa').value) || 0) / 100;
  const ttAfil = (parseFloat(document.getElementById('tt-afil').value) || 0) / 100;
  const ttResults = lucros.map((l, i) => {
    const denom = 1 - pb.total - ttTaxa - ttAfil - l / 100;
    if (denom <= 0) return null;
    const venda = custo / denom;
    const taxaRS = venda * (ttTaxa + ttAfil);
    const lucroRS = venda * (l / 100);
    return {
      label: `${l}% de lucro`, venda, lucroRS, lucroP: l,
      rows: [
        [`Taxa TikTok ${(ttTaxa*100).toFixed(0)}%`, venda*ttTaxa, 'cascade-neg'],
        [`Afiliado ${(ttAfil*100).toFixed(0)}%`, venda*ttAfil, 'cascade-neg'],
        [`Insumos ${(pb.insumos*100).toFixed(0)}%`, venda*pb.insumos, 'cascade-neg'],
        [`Nota fiscal ${(pb.nf*100).toFixed(0)}%`, venda*pb.nf, 'cascade-neg'],
        pb.frete ? [`Frete ${(pb.frete*100).toFixed(0)}%`, venda*pb.frete, 'cascade-neg'] : null,
        custoObj.emb ? ['Embalagem', custoObj.emb, 'cascade-neg'] : null,
        custoObj.energia ? ['Energia elétrica', custoObj.energia, 'cascade-neg'] : null,
        custoObj.fil ? ['Filamento', custoObj.fil, 'cascade-neg'] : null,
        ['Custo produto', custoObj.base, 'cascade-neg'],
        ['Lucro líquido', lucroRS, 'cascade-pos'],
      ].filter(Boolean),
    };
  }).filter(Boolean);
  buildMPResults('tiktok-results', ttResults, 'tt');

  // ── MAGALU ──
  const mgResults = lucros.map((l, i) => {
    const venda = calcVendaMagalu(custo, pb.total, l);
    if (!venda || !isFinite(venda) || venda <= 0) return null;
    const taxaRS = venda * 0.148 + 5;
    const lucroRS = venda * (l / 100);
    return {
      label: `${l}% de lucro`, venda, lucroRS, lucroP: l,
      rows: [
        ['Taxa Magalu 14,8%', venda * 0.148, 'cascade-neg'],
        ['Custo fixo por unidade', 5, 'cascade-neg'],
        [`Insumos ${(pb.insumos*100).toFixed(0)}%`, venda*pb.insumos, 'cascade-neg'],
        [`Nota fiscal ${(pb.nf*100).toFixed(0)}%`, venda*pb.nf, 'cascade-neg'],
        pb.frete ? [`Frete ${(pb.frete*100).toFixed(0)}%`, venda*pb.frete, 'cascade-neg'] : null,
        custoObj.emb ? ['Embalagem', custoObj.emb, 'cascade-neg'] : null,
        custoObj.energia ? ['Energia elétrica', custoObj.energia, 'cascade-neg'] : null,
        custoObj.fil ? ['Filamento', custoObj.fil, 'cascade-neg'] : null,
        ['Custo produto', custoObj.base, 'cascade-neg'],
        ['Lucro líquido', lucroRS, 'cascade-pos'],
      ].filter(Boolean),
    };
  }).filter(Boolean);
  buildMPResults('magalu-results', mgResults, 'mg');

  // ── VENDA DIRETA ──
  const vdTaxa = (parseFloat(document.getElementById('vd-taxa').value) || 0) / 100;
  const vdResults = lucros.map((l, i) => {
    const denom = 1 - pb.total - vdTaxa - l / 100;
    if (denom <= 0) return null;
    const venda = custo / denom;
    const lucroRS = venda * (l / 100);
    return {
      label: `${l}% de lucro`, venda, lucroRS, lucroP: l,
      rows: [
        vdTaxa ? [`Taxa ${(vdTaxa*100).toFixed(0)}%`, venda*vdTaxa, 'cascade-neg'] : null,
        [`Insumos ${(pb.insumos*100).toFixed(0)}%`, venda*pb.insumos, 'cascade-neg'],
        [`Nota fiscal ${(pb.nf*100).toFixed(0)}%`, venda*pb.nf, 'cascade-neg'],
        pb.frete ? [`Frete ${(pb.frete*100).toFixed(0)}%`, venda*pb.frete, 'cascade-neg'] : null,
        custoObj.emb ? ['Embalagem', custoObj.emb, 'cascade-neg'] : null,
        custoObj.energia ? ['Energia elétrica', custoObj.energia, 'cascade-neg'] : null,
        custoObj.fil ? ['Filamento', custoObj.fil, 'cascade-neg'] : null,
        ['Custo produto', custoObj.base, 'cascade-neg'],
        ['Lucro líquido', lucroRS, 'cascade-pos'],
      ].filter(Boolean),
    };
  }).filter(Boolean);
  buildMPResults('direta-results', vdResults, 'vd');
}

// ── PROMOÇÃO ──────────────────────────────────────────────────────────────
function calcPromo() {
  const preco = parseFloat(document.getElementById('promo-preco').value) || 0;
  const pct = (parseFloat(document.getElementById('promo-pct').value) || 0) / 100;
  const result = document.getElementById('promo-result');
  if (!preco || !pct) { result.style.display = 'none'; return; }
  const anunciar = preco / (1 - pct);
  const desconto = anunciar - preco;
  result.style.display = 'block';
  document.getElementById('promo-anunciar').textContent = fmt(anunciar);
  document.getElementById('promo-cliente').textContent = fmt(preco);
  document.getElementById('promo-desconto').textContent = `- ${fmt(desconto)}`;
  document.getElementById('promo-recebe').textContent = fmt(preco);
  document.getElementById('promo-explicacao').textContent =
    `Anuncie por ${fmt(anunciar)}. Quando o cliente aplicar ${(pct*100).toFixed(0)}% de desconto, pagará ${fmt(preco)}. Seu lucro permanece intacto.`;
}

// ── MODO ──────────────────────────────────────────────────────────────────
function setMode(m) {
  modo = m;
  document.getElementById('mode-normal').classList.toggle('active', m === 'normal');
  document.getElementById('mode-3d').classList.toggle('active', m === '3d');
  document.getElementById('card-3d').style.display = m === '3d' ? 'block' : 'none';
  calcular();
}

function aplicarPreset() {
  const v = document.getElementById('f-impressora').value;
  if (v && v !== 'custom') {
    document.getElementById('f-watts').value = v;
    calcular();
  }
}

// ── NAVEGAÇÃO ─────────────────────────────────────────────────────────────
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  document.querySelector(`[data-page="${page}"]`).classList.add('active');
  document.getElementById('page-title').textContent = {
    calc: 'Calcular', products: 'Meus Produtos', promo: 'Promoção', config: 'Configurações'
  }[page];
  if (page === 'products') loadProducts();
  if (window.innerWidth <= 700) closeSidebar();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
}

// ── SALVAR PRODUTO ────────────────────────────────────────────────────────
function getFormData() {
  return {
    nome: document.getElementById('f-nome').value.trim() || 'Produto sem nome',
    modo,
    custo: parseFloat(document.getElementById('f-custo').value) || 0,
    embalagem: parseFloat(document.getElementById('f-embalagem').value) || 0,
    gramas: parseFloat(document.getElementById('f-gramas').value) || 0,
    custo_fil: parseFloat(document.getElementById('f-custo-fil').value) || 0,
    horas: parseFloat(document.getElementById('f-horas').value) || 0,
    watts: parseFloat(document.getElementById('f-watts').value) || 350,
    kwh: parseFloat(document.getElementById('f-kwh').value) || 0.9,
    insumos: parseFloat(document.getElementById('f-insumos').value) || 0,
    nf: parseFloat(document.getElementById('f-nf').value) || 0,
    frete: parseFloat(document.getElementById('f-frete').value) || 0,
    lucros: [1,2,3,4].map(i => parseFloat(document.getElementById(`f-l${i}`).value) || 0),
    ml_tipo: document.getElementById('ml-tipo').value,
    ml_taxa: parseFloat(document.getElementById('ml-taxa').value) || 0,
    ml_peso: parseFloat(document.getElementById('ml-peso').value) || 0.3,
    ml_envio: document.getElementById('ml-envio').value,
    tt_taxa: parseFloat(document.getElementById('tt-taxa').value) || 0,
    tt_afil: parseFloat(document.getElementById('tt-afil').value) || 0,
    vd_taxa: parseFloat(document.getElementById('vd-taxa').value) || 0,
    savedAt: new Date().toISOString(),
  };
}

async function salvarProduto() {
  if (!currentUser || !db) { showToast('Faça login para salvar', 'error'); return; }
  const data = getFormData();
  try {
    await db.collection('users').doc(currentUser.uid).collection('produtos').add(data);
    showToast('Produto salvo! 💾', 'success');
  } catch (e) {
    showToast('Erro ao salvar: ' + e.message, 'error');
  }
}

// ── CARREGAR PRODUTOS ─────────────────────────────────────────────────────
async function loadProducts() {
  if (!currentUser || !db) return;
  const el = document.getElementById('products-list');
  el.innerHTML = '<p style="color:var(--text2);font-size:13px">Carregando...</p>';
  try {
    const snap = await db.collection('users').doc(currentUser.uid)
      .collection('produtos').orderBy('savedAt','desc').get();
    if (snap.empty) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><p>Nenhum produto salvo ainda.<br>Calcule e clique em "Salvar Produto"!</p></div>`;
      return;
    }
    el.innerHTML = snap.docs.map(doc => {
      const d = doc.data();
      const data = d.savedAt ? new Date(d.savedAt).toLocaleDateString('pt-BR') : '—';
      return `<div class="product-card">
        <div class="product-icon">${d.modo === '3d' ? '🖨️' : '📦'}</div>
        <div class="product-info">
          <div class="product-name">${d.nome}<span class="product-tag ${d.modo==='3d'?'tag-3d':'tag-normal'}">${d.modo==='3d'?'3D':'Normal'}</span></div>
          <div class="product-meta">Custo: ${fmt(d.custo)} · Salvo em ${data}</div>
        </div>
        <div class="product-actions">
          <button class="btn-icon" onclick="carregarProduto('${doc.id}')">Carregar</button>
          <button class="btn-icon danger" onclick="deletarProduto('${doc.id}')">✕</button>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    el.innerHTML = `<p style="color:var(--red)">Erro ao carregar: ${e.message}</p>`;
  }
}

async function carregarProduto(id) {
  if (!currentUser || !db) return;
  try {
    const doc = await db.collection('users').doc(currentUser.uid).collection('produtos').doc(id).get();
    if (!doc.exists) return;
    const d = doc.data();
    document.getElementById('f-nome').value = d.nome || '';
    document.getElementById('f-custo').value = d.custo || 0;
    document.getElementById('f-embalagem').value = d.embalagem || 0;
    document.getElementById('f-gramas').value = d.gramas || 0;
    document.getElementById('f-custo-fil').value = d.custo_fil || 0;
    document.getElementById('f-horas').value = d.horas || 0;
    document.getElementById('f-watts').value = d.watts || 350;
    document.getElementById('f-kwh').value = d.kwh || 0.9;
    document.getElementById('f-insumos').value = d.insumos || 3;
    document.getElementById('f-nf').value = d.nf || 8;
    document.getElementById('f-frete').value = d.frete || 0;
    if (d.lucros) d.lucros.forEach((l, i) => { document.getElementById(`f-l${i+1}`).value = l; });
    document.getElementById('ml-tipo').value = d.ml_tipo || 'classico';
    document.getElementById('ml-taxa').value = d.ml_taxa || 14;
    document.getElementById('ml-peso').value = d.ml_peso || 0.3;
    document.getElementById('ml-envio').value = d.ml_envio || 'proprio';
    document.getElementById('tt-taxa').value = d.tt_taxa || 6;
    document.getElementById('tt-afil').value = d.tt_afil || 5;
    document.getElementById('vd-taxa').value = d.vd_taxa || 0;
    setMode(d.modo || 'normal');
    calcular();
    showPage('calc');
    showToast('Produto carregado!', 'success');
  } catch (e) {
    showToast('Erro ao carregar', 'error');
  }
}

async function deletarProduto(id) {
  if (!confirm('Apagar este produto?')) return;
  if (!currentUser || !db) return;
  try {
    await db.collection('users').doc(currentUser.uid).collection('produtos').doc(id).delete();
    showToast('Produto apagado', 'success');
    loadProducts();
  } catch (e) {
    showToast('Erro ao apagar', 'error');
  }
}

// ── CONFIG ────────────────────────────────────────────────────────────────
async function saveConfig() {
  const cfg = {
    tt_taxa: document.getElementById('cfg-tt-taxa').value,
    tt_afil: document.getElementById('cfg-tt-afil').value,
    insumos: document.getElementById('cfg-insumos').value,
    nf: document.getElementById('cfg-nf').value,
    lucros: [1,2,3,4].map(i => document.getElementById(`cfg-l${i}`).value),
    kwh: document.getElementById('cfg-kwh').value,
  };
  localStorage.setItem('pf_config', JSON.stringify(cfg));
  if (currentUser && db) {
    try { await db.collection('users').doc(currentUser.uid).set({ config: cfg }, { merge: true }); } catch(e){}
  }
  applyConfig(cfg);
  document.getElementById('config-msg').textContent = '✓ Configurações salvas!';
  setTimeout(() => document.getElementById('config-msg').textContent = '', 2000);
}

function applyConfig(cfg) {
  if (!cfg) return;
  if (cfg.tt_taxa) document.getElementById('tt-taxa').value = cfg.tt_taxa;
  if (cfg.tt_afil) document.getElementById('tt-afil').value = cfg.tt_afil;
  if (cfg.insumos) document.getElementById('f-insumos').value = cfg.insumos;
  if (cfg.nf) document.getElementById('f-nf').value = cfg.nf;
  if (cfg.lucros) cfg.lucros.forEach((l, i) => { document.getElementById(`f-l${i+1}`).value = l; });
  if (cfg.kwh) document.getElementById('f-kwh').value = cfg.kwh;
}

function loadConfig() {
  const saved = localStorage.getItem('pf_config');
  if (saved) { try { applyConfig(JSON.parse(saved)); } catch(e){} }
}

// ── TOAST ─────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── AUTH ──────────────────────────────────────────────────────────────────
function loginGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider).catch(e => showToast('Erro no login: ' + e.message, 'error'));
}

function logout() {
  firebase.auth().signOut();
}

function closeModal() {
  document.getElementById('modal-produto').style.display = 'none';
}

// ── INIT ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadConfig();

  firebase.auth().onAuthStateChanged(user => {
    currentUser = user;
    if (user) {
      db = firebase.firestore();
      document.getElementById('screen-auth').classList.remove('active');
      document.getElementById('screen-app').classList.add('active');
      document.getElementById('user-info').textContent = user.displayName || user.email;
      document.getElementById('user-avatar').textContent = user.displayName ? user.displayName.split(' ')[0] : '👤';
      calcular();
    } else {
      document.getElementById('screen-auth').classList.add('active');
      document.getElementById('screen-app').classList.remove('active');
    }
  });
});
