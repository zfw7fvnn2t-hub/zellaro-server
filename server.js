require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// ─── HELPER: Call Claude API ────────────────────────────────────────────────
async function callClaude(messages, maxTokens = 1500) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20251001',
      max_tokens: maxTokens,
      messages
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.content.filter(b => b.type === 'text').map(b => b.text).join('');
}

// ─── HELPER: Extract JSON safely ────────────────────────────────────────────
function extractJSON(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('JSON not found in response');
  return JSON.parse(match[0]);
}

// ─── ROUTE 1: Generate Copy ─────────────────────────────────────────────────
app.post('/gerar-copy', upload.single('imagem'), async (req, res) => {
  try {
    const { nome_produto, mercado = 'Netherlands' } = req.body;
    const content = [];

    // Add image if uploaded
    if (req.file) {
      const b64 = req.file.buffer.toString('base64');
      const mime = req.file.mimetype;
      content.push({ type: 'image', source: { type: 'base64', media_type: mime, data: b64 } });
    }

    content.push({
      type: 'text',
      text: `You are a luxury e-commerce copywriter. Analyse this product${req.file ? ' image' : ''} ${nome_produto ? `(Product: ${nome_produto})` : ''} for a dropshipping store targeting ${mercado}.

Return ONLY raw JSON, no markdown:
{
  "productName": "elegant product name in English",
  "shopifyTitle": "concise Shopify title",
  "shopifyDescription": "3 paragraphs, refined aspirational tone, no bullet points",
  "instagramCaption": "caption max 100 words, aspirational, no hashtags",
  "hashtags": "15 relevant hashtags",
  "suggestedPrice": "suggested retail price in EUR for ${mercado} market",
  "targetAudience": "who buys this product",
  "adAngle": "best angle to advertise this product"
}`
    });

    const raw = await callClaude([{ role: 'user', content }], 1500);
    const result = extractJSON(raw);
    res.json({ success: true, data: result });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── ROUTE 2: Mine Products ─────────────────────────────────────────────────
app.post('/minerar', async (req, res) => {
  try {
    const { nicho, mercado = 'Netherlands', preco_max = 10 } = req.body;

    if (!nicho) return res.status(400).json({ success: false, error: 'nicho is required' });

    const prompt = `You are an expert dropshipping product researcher specialising in the ${mercado} market.

Find 5 winning products in the "${nicho}" niche that:
- Cost under $${preco_max} on AliExpress
- Have strong profit margins when sold in ${mercado}
- Appeal to Dutch consumers (minimalist, quality-conscious, design-oriented)
- Are easy to brand and position as premium
- Have high visual appeal for Instagram/social media

Return ONLY raw JSON, no markdown:
{
  "products": [
    {
      "name": "product name in English",
      "description": "what it is and why it sells",
      "aliexpressSearch": "exact search term to find it on AliExpress",
      "estimatedCostUSD": "estimated cost on AliExpress in USD",
      "suggestedPriceEUR": "suggested retail price in EUR for ${mercado}",
      "estimatedMargin": "estimated profit margin percentage",
      "whyItWins": "why this product wins in ${mercado}",
      "targetCustomer": "who buys this",
      "bestAdChannel": "Instagram / TikTok / Google / Facebook",
      "adHook": "best ad hook / angle to sell this product"
    }
  ]
}`;

    const raw = await callClaude([{ role: 'user', content: [{ type: 'text', text: prompt }] }], 2000);
    const result = extractJSON(raw);
    res.json({ success: true, data: result });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── ROUTE 3: Health check ──────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', apiKey: API_KEY ? 'configured' : 'MISSING' });
});

// ─── FRONTEND ────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Zellaro Intelligence</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Montserrat:wght@300;400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  :root{--bg:#F5F2EE;--surface:#fff;--accent:#1A1A1A;--gold:#B8985A;--muted:#8A8580;--border:#E8E2DA;--text:#2C2825;--success:#4A7C59;--error:#C0392B}
  body{background:var(--bg);font-family:'Montserrat',sans-serif;color:var(--text);min-height:100vh}
  header{background:var(--accent);padding:18px 32px;display:flex;justify-content:space-between;align-items:center}
  .logo-title{font-family:'Cormorant Garamond',serif;font-size:26px;color:#fff;font-style:italic}
  .logo-sub{font-size:9px;color:var(--gold);letter-spacing:.2em;text-transform:uppercase;margin-top:2px}
  .tabs{display:flex;gap:8px}
  .tab{padding:8px 18px;background:none;border:1px solid #ffffff33;color:#ffffff88;font-family:'Montserrat',sans-serif;font-size:10px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;border-radius:2px;transition:all .2s}
  .tab.active{border-color:var(--gold);color:var(--gold)}
  main{max-width:800px;margin:32px auto;padding:0 20px}
  .panel{display:none}.panel.active{display:block}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:28px;margin-bottom:20px}
  .card-title{font-family:'Cormorant Garamond',serif;font-size:22px;font-style:italic;margin-bottom:6px}
  .card-sub{font-size:11px;color:var(--muted);margin-bottom:24px;line-height:1.6}
  label{display:block;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);font-weight:600;margin-bottom:8px}
  input,textarea,select{width:100%;padding:12px 14px;border:1px solid var(--border);border-radius:3px;font-family:'Montserrat',sans-serif;font-size:12px;color:var(--text);background:var(--surface);margin-bottom:16px;outline:none;transition:border .2s}
  input:focus,textarea:focus{border-color:var(--gold)}
  textarea{resize:vertical;min-height:80px}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .upload-area{border:1.5px dashed var(--border);border-radius:4px;padding:24px;text-align:center;cursor:pointer;margin-bottom:16px;transition:all .2s}
  .upload-area:hover{border-color:var(--gold);background:#fdf9f3}
  .upload-area p{font-size:11px;color:var(--muted);margin-top:8px}
  .btn{width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:3px;font-family:'Montserrat',sans-serif;font-size:11px;letter-spacing:.15em;text-transform:uppercase;font-weight:600;cursor:pointer;transition:opacity .2s}
  .btn:hover{opacity:.85}
  .btn:disabled{background:var(--border);color:var(--muted);cursor:not-allowed}
  .result-grid{display:grid;gap:12px;margin-top:20px}
  .result-card{background:var(--surface);border:1px solid var(--border);border-radius:4px;overflow:hidden}
  .result-header{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#fafaf8;border-bottom:1px solid var(--border)}
  .result-label{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);font-weight:600}
  .copy-btn{font-size:10px;color:var(--muted);background:none;border:none;cursor:pointer;font-weight:600;font-family:'Montserrat',sans-serif}
  .copy-btn:hover{color:var(--success)}
  .result-body{padding:14px;font-size:12px;line-height:1.8;white-space:pre-wrap}
  .product-card{background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:20px;margin-bottom:12px}
  .product-name{font-family:'Cormorant Garamond',serif;font-size:18px;font-style:italic;margin-bottom:8px}
  .product-meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:12px 0}
  .meta-item{background:var(--bg);border-radius:3px;padding:8px 12px;text-align:center}
  .meta-value{font-size:15px;font-weight:600;color:var(--accent)}
  .meta-label{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-top:2px}
  .product-detail{font-size:11px;color:var(--muted);line-height:1.7;margin-top:10px}
  .tag{display:inline-block;background:var(--accent);color:#fff;font-size:9px;padding:3px 8px;border-radius:2px;letter-spacing:.08em;text-transform:uppercase;margin-right:6px;margin-top:4px}
  .tag.gold{background:var(--gold)}
  .error{background:#fdf2f2;border:1px solid #f5c6c6;border-radius:3px;padding:12px 16px;color:var(--error);font-size:11px;margin-top:12px}
  .loading{text-align:center;padding:40px;color:var(--muted);font-style:italic;font-family:'Cormorant Garamond',serif;font-size:18px}
  .spinner{width:28px;height:28px;border:2px solid var(--border);border-top:2px solid var(--gold);border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px}
  @keyframes spin{to{transform:rotate(360deg)}}
  .search-link{display:inline-block;margin-top:8px;font-size:10px;color:var(--gold);text-decoration:none;letter-spacing:.08em}
  .search-link:hover{text-decoration:underline}
</style>
</head>
<body>
<header>
  <div>
    <div class="logo-title">Zellaro</div>
    <div class="logo-sub">Product Intelligence</div>
  </div>
  <div class="tabs">
    <button class="tab active" onclick="switchTab('copy')">Gerar Copy</button>
    <button class="tab" onclick="switchTab('minerar')">Minerar Produtos</button>
  </div>
</header>

<main>
  <!-- COPY PANEL -->
  <div class="panel active" id="panel-copy">
    <div class="card">
      <div class="card-title">Gerar Copy de Produto</div>
      <div class="card-sub">Carregue uma foto ou escreva o nome do produto. O servidor gera título Shopify, descrição, caption Instagram e hashtags automaticamente.</div>

      <label>Foto do Produto (opcional)</label>
      <div class="upload-area" onclick="document.getElementById('fileInput').click()" id="uploadArea">
        <div style="font-size:28px;opacity:.3">↑</div>
        <p>Clique para carregar uma imagem</p>
      </div>
      <input type="file" id="fileInput" accept="image/*" style="display:none" onchange="handleFile(this)">

      <label>Nome / Descrição do Produto</label>
      <input type="text" id="nomeProduto" placeholder="ex: vaso cerâmica minimalista bege 20cm">

      <div class="row">
        <div>
          <label>Mercado Alvo</label>
          <select id="mercadoCopy">
            <option value="Netherlands">Holanda 🇳🇱</option>
            <option value="United Kingdom">Reino Unido 🇬🇧</option>
            <option value="Germany">Alemanha 🇩🇪</option>
            <option value="France">França 🇫🇷</option>
          </select>
        </div>
      </div>

      <button class="btn" onclick="gerarCopy()" id="btnCopy">Gerar Copy →</button>
      <div id="copyError"></div>
    </div>
    <div id="copyResult"></div>
  </div>

  <!-- MINERAR PANEL -->
  <div class="panel" id="panel-minerar">
    <div class="card">
      <div class="card-title">Minerar Produtos Vencedores</div>
      <div class="card-sub">Digite o nicho e o servidor encontra os 5 melhores produtos para dropshipping com preço AliExpress, preço sugerido e margem estimada.</div>

      <label>Nicho</label>
      <input type="text" id="nicho" placeholder="ex: casa e jardim minimalista, pet accessories, skincare...">

      <div class="row">
        <div>
          <label>Mercado Alvo</label>
          <select id="mercadoMinerar">
            <option value="Netherlands">Holanda 🇳🇱</option>
            <option value="United Kingdom">Reino Unido 🇬🇧</option>
            <option value="Germany">Alemanha 🇩🇪</option>
            <option value="France">França 🇫🇷</option>
          </select>
        </div>
        <div>
          <label>Preço Máx AliExpress (USD)</label>
          <input type="number" id="precoMax" value="10" min="1" max="50">
        </div>
      </div>

      <button class="btn" onclick="minerarProdutos()" id="btnMinerar">Minerar Produtos →</button>
      <div id="minerarError"></div>
    </div>
    <div id="minerarResult"></div>
  </div>
</main>

<script>
let selectedFile = null;

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('panel-' + tab).classList.add('active');
}

function handleFile(input) {
  const file = input.files[0];
  if (!file) return;
  selectedFile = file;
  const area = document.getElementById('uploadArea');
  area.innerHTML = '<div style="font-size:11px;color:var(--success);font-weight:600">✓ ' + file.name + '</div>';
}

function copyText(text, btn) {
  navigator.clipboard.writeText(text);
  btn.textContent = '✓ Copiado';
  setTimeout(() => btn.textContent = 'Copiar', 2000);
}

function resultCard(label, content) {
  return \`<div class="result-card">
    <div class="result-header">
      <span class="result-label">\${label}</span>
      <button class="copy-btn" onclick="copyText(\\\`\${content.replace(/\`/g,'')}\\\`, this)">Copiar</button>
    </div>
    <div class="result-body">\${content}</div>
  </div>\`;
}

async function gerarCopy() {
  const nome = document.getElementById('nomeProduto').value.trim();
  const mercado = document.getElementById('mercadoCopy').value;
  const btn = document.getElementById('btnCopy');
  const errorDiv = document.getElementById('copyError');
  const resultDiv = document.getElementById('copyResult');

  if (!nome && !selectedFile) {
    errorDiv.innerHTML = '<div class="error">Adicione uma foto ou nome do produto.</div>';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'A gerar...';
  errorDiv.innerHTML = '';
  resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div>A analisar o produto...</div>';

  try {
    const formData = new FormData();
    if (selectedFile) formData.append('imagem', selectedFile);
    formData.append('nome_produto', nome);
    formData.append('mercado', mercado);

    const res = await fetch('/gerar-copy', { method: 'POST', body: formData });
    const json = await res.json();

    if (!json.success) throw new Error(json.error);
    const d = json.data;

    resultDiv.innerHTML = \`
      <div style="margin-bottom:8px">
        <span class="tag gold">\${d.targetAudience || ''}</span>
        <span class="tag">\${d.suggestedPrice || ''}</span>
      </div>
      <div class="result-grid">
        \${resultCard('Título Shopify', d.shopifyTitle || '')}
        \${resultCard('Descrição Shopify', d.shopifyDescription || '')}
        \${resultCard('Caption Instagram', d.instagramCaption || '')}
        \${resultCard('Hashtags', d.hashtags || '')}
        \${resultCard('Ângulo de Anúncio', d.adAngle || '')}
      </div>\`;
  } catch (err) {
    errorDiv.innerHTML = \`<div class="error">Erro: \${err.message}</div>\`;
    resultDiv.innerHTML = '';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Gerar Copy →';
  }
}

async function minerarProdutos() {
  const nicho = document.getElementById('nicho').value.trim();
  const mercado = document.getElementById('mercadoMinerar').value;
  const precoMax = document.getElementById('precoMax').value;
  const btn = document.getElementById('btnMinerar');
  const errorDiv = document.getElementById('minerarError');
  const resultDiv = document.getElementById('minerarResult');

  if (!nicho) {
    errorDiv.innerHTML = '<div class="error">Digite o nicho.</div>';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'A minerar...';
  errorDiv.innerHTML = '';
  resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div>A garimpar produtos vencedores...</div>';

  try {
    const res = await fetch('/minerar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nicho, mercado, preco_max: precoMax })
    });
    const json = await res.json();

    if (!json.success) throw new Error(json.error);
    const products = json.data.products || [];

    resultDiv.innerHTML = products.map((p, i) => \`
      <div class="product-card">
        <div style="font-size:10px;color:var(--gold);letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">Produto \${i+1}</div>
        <div class="product-name">\${p.name}</div>
        <div class="product-meta">
          <div class="meta-item">
            <div class="meta-value">\${p.estimatedCostUSD || '-'}</div>
            <div class="meta-label">Custo AliExpress</div>
          </div>
          <div class="meta-item">
            <div class="meta-value">\${p.suggestedPriceEUR || '-'}</div>
            <div class="meta-label">Preço Venda</div>
          </div>
          <div class="meta-item">
            <div class="meta-value" style="color:var(--success)">\${p.estimatedMargin || '-'}</div>
            <div class="meta-label">Margem</div>
          </div>
        </div>
        <div class="product-detail">
          <strong>Por que vende:</strong> \${p.whyItWins || ''}<br>
          <strong>Cliente:</strong> \${p.targetCustomer || ''}<br>
          <strong>Melhor canal:</strong> \${p.bestAdChannel || ''}<br>
          <strong>Hook do anúncio:</strong> \${p.adHook || ''}
        </div>
        <a class="search-link" href="https://www.aliexpress.com/w/wholesale-\${encodeURIComponent(p.aliexpressSearch || p.name)}.html" target="_blank">
          → Buscar no AliExpress: "\${p.aliexpressSearch || p.name}"
        </a>
      </div>\`).join('');
  } catch (err) {
    errorDiv.innerHTML = \`<div class="error">Erro: \${err.message}</div>\`;
    resultDiv.innerHTML = '';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Minerar Produtos →';
  }
}
</script>
</body>
</html>`);
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Zellaro Intelligence Server running on port ${PORT}`);
  console.log(`🔑 API Key: ${API_KEY ? 'Configured' : '⚠️  MISSING - set ANTHROPIC_API_KEY'}`);
});
