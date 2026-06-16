<div align="center">

<img src="favicon.svg" width="80" height="80" alt="Margify Logo"/>

# Margify

### 🇧🇷 Precifique certo, lucre mais.
### 🌎 Price right, profit more.

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-equipegs.github.io/precificadora-00c87a?style=for-the-badge)](https://equipegs.github.io/precificadora/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![Built with Claude](https://img.shields.io/badge/Built_with-Claude_AI-blueviolet?style=for-the-badge)](https://claude.ai)

**A precificadora inteligente para vendedores brasileiros de e-commerce.**

</div>

---

## 🇧🇷 Português

> **Chega de vender no prejuízo. Sua margem, sob controle.**

O **Margify** é uma ferramenta web que calcula automaticamente o preço de venda ideal para os principais marketplaces brasileiros — considerando todas as taxas, comissões, impostos e a margem de lucro desejada. Oferece 10 dias de teste gratuito, com plano mensal a partir de R$19,90.

---

### 📸 Screenshots

**Calculadora Multi-Marketplace**

![Calcular](https://raw.githubusercontent.com/equipegs/precificadora/main/screenshots/calcular.png)

*Preenche o custo e vê instantaneamente o preço correto em todos os marketplaces com alertas de margem baixa*

---

**Resultados com Detalhamento por Marketplace**

![Resultados](https://raw.githubusercontent.com/equipegs/precificadora/main/screenshots/resultados.png)

*ML, Shopee, TikTok, Magalu e Venda Direta — cada um com 4 metas de lucro e alerta "Abaixo do mínimo"*

---

**Análise Rápida de Produto**

![Análise](https://raw.githubusercontent.com/equipegs/precificadora/main/screenshots/analise.png)

*Painel de análise completo sem sair da lista — preços por marketplace × meta de lucro em uma tabela*

---

**Simulador "E se?"**

![Simulador](https://raw.githubusercontent.com/equipegs/precificadora/main/screenshots/simulador.png)

*Sliders interativos — arraste e veja todos os preços atualizando em tempo real*

---

### 🧠 O problema que resolve

O Brasil tem mais de **10 milhões de vendedores ativos** em marketplaces. A maioria precifica no "feeling" — sem considerar a complexidade real das taxas:

| Marketplace | Complexidade das taxas |
|---|---|
| 🛒 **Mercado Livre** | Comissão variável + custo operacional por **peso × faixa de preço** (matriz 13×8 atualizada 2026) |
| 🛍️ **Shopee** | Comissão **escalonada** com até 4 faixas diferentes (20%+R$4 até 14%+R$26) |
| 🎵 **TikTok Shop** | Taxa de plataforma + comissão de afiliado separados |
| 🏬 **Magalu** | 14,8% + R$5,00 fixo por unidade vendida |
| 💳 **Maquininha** | Taxas diferentes para débito, crédito 1x até 12x |

O resultado? Vendedores que faturam bem mas **não sobra nada no fim do mês**.

---

### ⚡ Funcionalidades

| | Funcionalidade | Descrição |
|---|---|---|
| 🧮 | **Calculadora multi-marketplace** | Preço correto para 5 marketplaces simultaneamente |
| 💰 | **Preços praticados hoje** | Vê a margem real dos seus preços atuais em tempo real |
| ⚠️ | **Alertas de margem baixa** | Destaque vermelho quando abaixo do mínimo definido |
| 📊 | **Dashboard com gráfico** | Evolução de margem e custo ao longo dos meses |
| 🖨️ | **Modo Impressão 3D** | Filamento, energia elétrica e mão de obra no cálculo |
| 🎛️ | **Simulador "E se?"** | Sliders interativos com preços em tempo real |
| 👁️ | **Análise rápida** | Tabela completa sem sair da lista de produtos |
| 📈 | **Histórico de preços** | Registra a evolução de custo e margem automaticamente |
| ⧉ | **Duplicar produto** | Cria cópias para variações do mesmo item |
| 🔍 | **Busca avançada** | Pesquisa por nome, SKU, EAN ou fornecedor |
| 🔗 | **Central Hubs** | Links diretos para ML, Shopee, TikTok, Magalu, Bling, Tiny |
| 📄 | **Exportar PDF** | Ficha completa do produto para impressão |
| 🔐 | **Login com Google** | Dados salvos na nuvem, acessíveis em qualquer dispositivo |
| 📱 | **PWA** | Instalável como app no celular (Android e iOS) |

---

### 🔬 Sofisticação técnica

#### Algoritmo iterativo para Shopee e ML

O Margify resolve um problema matemático circular — a taxa depende do preço de venda, que por sua vez depende da taxa:

```
Preço de Venda = Custo ÷ (1 − % despesas − % taxa marketplace − % lucro)
```

Para Shopee (comissão escalonada) e ML (custo operacional por peso), o sistema usa **iteração numérica convergente** — testa e refina o preço até atingir precisão de R$0,001:

```javascript
function calcVendaShopee(custo, pBase, lucroP) {
  let v = custo / (1 - pBase - 0.14 - lucroP / 100); // estimativa inicial
  for (let i = 0; i < 60; i++) {
    const f = shopeeFaixa(v);                         // identifica faixa
    const vn = (custo + f.fixo) / (1 - pBase - f.pct - lucroP / 100);
    if (Math.abs(vn - v) < 0.001) { v = vn; break; } // convergiu
    v = vn;
  }
  return v;
}
```

#### Matriz de custos operacionais ML (2026)

13 faixas de peso × 8 faixas de preço = 104 combinações possíveis, todas mapeadas com os valores oficiais do Mercado Livre:

```
Peso ↓  | R$0-18  | R$19-48 | R$49-78 | R$79-99 | R$100-119 | ...
até 0,3kg| R$5,65  | R$6,55  | R$7,75  | R$12,35 | R$14,35   | ...
0,3-0,5kg| R$5,95  | R$6,65  | R$7,85  | R$13,25 | R$15,45   | ...
...
```

---

### 🏗️ Stack técnica

```
Frontend:       HTML5 + CSS3 + JavaScript puro (sem frameworks)
Hospedagem:     GitHub Pages (gratuito, deploy automático)
Banco de dados: Firebase Firestore (NoSQL, tempo real, por usuário)
Autenticação:   Firebase Auth (Google OAuth)
Pagamentos:     Stripe (assinatura mensal, trial 10 dias)
PWA:            Web App Manifest + ícones multi-resolução
Desenvolvido:   Claude AI (Anthropic) — co-desenvolvedor e arquiteto
```

---

### 🔐 Privacidade e segurança

- Dados de cada usuário isolados no Firebase (regras de segurança por UID)
- Dados de pagamento processados exclusivamente pelo Stripe — não armazenamos cartões
- Política de Privacidade completa em conformidade com a **LGPD (Lei 13.709/2018)**
- Termos de Uso com limitação de responsabilidade e política de reembolso

---

### 🌱 Roadmap

- [ ] API pública para integração com Bling e Tiny ERP
- [ ] App mobile nativo (React Native)
- [ ] Suporte a outros marketplaces: Shopee Ads, Amazon BR, Shein
- [ ] Expansão para outros países da América Latina
- [ ] Relatório mensal em PDF
- [ ] Calculadora de ponto de equilíbrio

---

### 📄 Licença

MIT — use, modifique e distribua livremente.

---

## 🌎 English

> **Stop selling at a loss. Your margin, under control.**

**Margify** is a free web tool that automatically calculates the ideal selling price for major Brazilian marketplaces — factoring in all fees, commissions, taxes, and desired profit margins.

---

### 🧠 The problem

Brazil has over **10 million active marketplace sellers**. Most price their products by guesswork, ignoring the real complexity:

| Marketplace | Fee complexity |
|---|---|
| 🛒 **Mercado Livre** | Variable commission + weight-based operational cost (**13×8 matrix**, updated 2026) |
| 🛍️ **Shopee** | **Tiered commission** with up to 4 price brackets (20%+R$4 up to 14%+R$26) |
| 🎵 **TikTok Shop** | Platform fee + separate affiliate commission |
| 🏬 **Magalu** | 14.8% + R$5.00 fixed fee per unit |
| 💳 **Card machines** | Different rates for debit, credit 1x to 12x installments |

---

### 🔬 Technical highlights

- **Convergent numerical iteration** for circular pricing problems (Shopee tiered fees, ML weight-based costs)
- **104-cell fee lookup table** for Mercado Livre operational costs (13 weight ranges × 8 price brackets)
- **Real-time margin analysis** comparing current prices against minimum acceptable margin
- **Price history tracking** with automatic snapshots on every product update
- **PWA** — installable as a native app on Android and iOS

---

### 🏗️ Tech stack

```
Frontend:    Vanilla HTML5 + CSS3 + JavaScript (zero dependencies)
Hosting:     GitHub Pages (free, auto-deploy)
Database:    Firebase Firestore (NoSQL, real-time, per-user isolation)
Auth:        Firebase Auth (Google OAuth)
Payments:    Stripe (monthly subscription, 10-day trial)
Built with:  Claude AI (Anthropic)
```

---

### 📄 License

MIT — free to use, modify, and distribute.

---

<div align="center">

**Built with ❤️ in Brazil · Feito com ❤️ no Brasil**

[🚀 Acessar o Margify](https://equipegs.github.io/precificadora/) · [📧 suporte.margify@gmail.com](mailto:suporte.margify@gmail.com)

*Precifique certo, lucre mais.*

</div>
