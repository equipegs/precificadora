<div align="center">

<img src="favicon.svg" width="80" height="80" alt="Margify Logo"/>

# Margify

### 🇧🇷 Precifique certo, lucre mais. &nbsp;|&nbsp; 🌎 Price right, profit more.

[![GitHub Pages](https://img.shields.io/badge/Live-equipegs.github.io%2Fprecificadora-00c87a?style=flat-square&logo=github)](https://equipegs.github.io/precificadora/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-orange?style=flat-square&logo=firebase)](https://firebase.google.com/)
[![Built with Claude](https://img.shields.io/badge/Built%20with-Claude%20AI-blueviolet?style=flat-square)](https://claude.ai)

</div>

---

## 🇧🇷 Português

### O que é o Margify?

O **Margify** é uma precificadora inteligente e gratuita para vendedores de e-commerce brasileiros. Calcula automaticamente o preço de venda ideal para **Mercado Livre, Shopee, TikTok Shop, Magalu e Venda Direta** — considerando todas as taxas, comissões, impostos e a margem de lucro desejada.

> **Chega de vender no prejuízo. Sua margem, sob controle.**

### O problema que resolve

O Brasil tem mais de 10 milhões de vendedores ativos em marketplaces. A maioria precifica "no feeling" — sem considerar a complexidade real das taxas:

- 🛒 **Mercado Livre** cobra comissão variável + custo operacional por peso × faixa de preço (matriz 13×8)
- 🛍️ **Shopee** tem comissão escalonada por faixa de valor (até 4 faixas diferentes)
- 🎵 **TikTok Shop** cobra taxa de plataforma + comissão de afiliado
- 🏬 **Magalu** cobra 14,8% + R$5,00 fixo por unidade
- 💳 **Maquininha** tem taxas diferentes para débito, crédito e parcelamento

O resultado? Vendedores que faturam bem mas não sobra nada no fim do mês.

### Funcionalidades

| Funcionalidade | Descrição |
|---|---|
| 🧮 **Calculadora multi-marketplace** | Preço de venda correto para 5 marketplaces simultaneamente |
| 📊 **Dashboard com alertas** | Visão geral dos produtos e alertas de margem baixa |
| 💰 **Preços praticados hoje** | Compara o preço atual com a margem real em tempo real |
| 🖨️ **Modo Impressão 3D** | Calcula custo de filamento, energia e mão de obra |
| 🎛️ **Simulador "E se?"** | Sliders interativos para simular cenários |
| 👁️ **Análise rápida** | Painel de análise sem sair da lista de produtos |
| 📈 **Histórico de preços** | Registra a evolução de custo e margem ao longo do tempo |
| ⧉ **Duplicar produto** | Cria cópias de produtos para variações |
| 🔍 **Busca avançada** | Pesquisa por nome, SKU, EAN ou fornecedor |
| 🔗 **Central Hubs** | Links diretos para ML, Shopee, TikTok, Magalu, Bling, Tiny |
| 📄 **Exportar PDF** | Ficha completa do produto para impressão |
| 🔐 **Login com Google** | Dados salvos na nuvem, acessíveis em qualquer dispositivo |

### Como a fórmula funciona

O cálculo resolve um problema circular — as despesas dependem do preço de venda, que por sua vez depende das despesas:

```
Preço de Venda = Custo ÷ (1 − % despesas gerais − % taxa marketplace − % lucro)
```

Para Shopee e Mercado Livre, onde a taxa depende do valor final, o sistema usa **iteração numérica convergente** para encontrar o preço exato com precisão de R$0,001.

### Stack técnica

- **Frontend:** HTML5, CSS3, JavaScript puro (sem frameworks)
- **Hospedagem:** GitHub Pages (gratuito)
- **Banco de dados:** Firebase Firestore (NoSQL, tempo real)
- **Autenticação:** Firebase Auth (Google OAuth)
- **Pagamentos:** Stripe (assinatura mensal)
- **PWA:** Manifest + Service Worker (instalável no celular)
- **Desenvolvido com:** Claude AI (Anthropic)

### Instalação e uso local

```bash
# Clone o repositório
git clone https://github.com/equipegs/precificadora.git
cd precificadora

# Configure o Firebase
# Edite js/firebase-config.js com suas credenciais

# Abra no navegador
open index.html
```

### Configuração do Firebase

1. Crie um projeto em [console.firebase.google.com](https://console.firebase.google.com)
2. Ative **Authentication → Google**
3. Crie um banco **Firestore Database**
4. Configure as regras de segurança:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /coupons/{couponId} {
      allow read: if request.auth != null;
      allow write: if false;
    }
  }
}
```

5. Cole suas credenciais em `js/firebase-config.js`

### Licença

MIT — use, modifique e distribua livremente.

---

## 🌎 English

### What is Margify?

**Margify** is a free, intelligent pricing tool for Brazilian e-commerce sellers. It automatically calculates the ideal selling price for **Mercado Livre, Shopee, TikTok Shop, Magalu, and Direct Sales** — factoring in all fees, commissions, taxes, and desired profit margins.

> **Stop selling at a loss. Your margin, under control.**

### The problem it solves

Brazil has over 10 million active marketplace sellers. Most price their products by guesswork — without accounting for the real complexity of marketplace fees:

- 🛒 **Mercado Livre** charges variable commission + weight-based operational cost (13×8 fee matrix)
- 🛍️ **Shopee** has a tiered commission structure with up to 4 different price brackets
- 🎵 **TikTok Shop** charges platform fee + affiliate commission
- 🏬 **Magalu** charges 14.8% + R$5.00 fixed fee per unit
- 💳 **Card machines** have different rates for debit, credit, and installments

The result? Sellers with good revenue but nothing left at the end of the month.

### Features

| Feature | Description |
|---|---|
| 🧮 **Multi-marketplace calculator** | Correct selling price for 5 marketplaces simultaneously |
| 📊 **Dashboard with alerts** | Product overview and low-margin alerts |
| 💰 **Current prices tracker** | Compares actual prices with real-time margin analysis |
| 🖨️ **3D Printing mode** | Calculates filament, energy, and labor costs |
| 🎛️ **"What if?" Simulator** | Interactive sliders for scenario simulation |
| 👁️ **Quick analysis** | Analysis panel without leaving the product list |
| 📈 **Price history** | Tracks cost and margin evolution over time |
| ⧉ **Duplicate product** | Clone products for variations |
| 🔍 **Advanced search** | Search by name, SKU, EAN, or supplier |
| 🔗 **Central Hubs** | Direct links to ML, Shopee, TikTok, Magalu, Bling, Tiny |
| 📄 **PDF export** | Complete product sheet for printing |
| 🔐 **Google login** | Cloud-saved data, accessible from any device |

### How the pricing formula works

The calculation solves a circular problem — expenses depend on the selling price, which in turn depends on the expenses:

```
Selling Price = Cost ÷ (1 − % general expenses − % marketplace fee − % profit)
```

For Shopee and Mercado Livre, where fees depend on the final value, the system uses **convergent numerical iteration** to find the exact price with R$0.001 precision.

### Tech stack

- **Frontend:** Vanilla HTML5, CSS3, JavaScript (no frameworks)
- **Hosting:** GitHub Pages (free)
- **Database:** Firebase Firestore (NoSQL, real-time)
- **Authentication:** Firebase Auth (Google OAuth)
- **Payments:** Stripe (monthly subscription)
- **PWA:** Manifest + icons (installable on mobile)
- **Built with:** Claude AI (Anthropic)

### Local setup

```bash
# Clone the repository
git clone https://github.com/equipegs/precificadora.git
cd precificadora

# Configure Firebase
# Edit js/firebase-config.js with your credentials

# Open in browser
open index.html
```

### License

MIT — free to use, modify, and distribute.

---

<div align="center">

**Built with ❤️ in Brazil**

[🚀 Try Margify](https://equipegs.github.io/precificadora/) · [📧 Support](mailto:suporte.margify@gmail.com)

*Precifique certo, lucre mais.*

</div>
