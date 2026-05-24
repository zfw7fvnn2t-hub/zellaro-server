require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function callClaude(messages, maxTokens = 2000) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, messages })
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.content.filter(b => b.type === 'text').map(b => b.text).join('');
}

function extractJSON(text) {
  // Remove markdown code blocks if present
  text = text.replace(/```json|```/g, '').trim();
  
  // Find the outermost JSON object
  const start = text.indexOf('{');
  if (start === -1) throw new Error('JSON not found');
  
  // Find matching closing brace
  let depth = 0;
  let end = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  
  if (end === -1) throw new Error('Malformed JSON');
  
  let jsonStr = text.slice(start, end + 1);
  
  // Fix common JSON issues
  // Remove trailing commas before } or ]
  jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
  // Fix unescaped newlines in strings
  jsonStr = jsonStr.replace(/([^\\])\n/g, '$1\\n');
  
  try {
    return JSON.parse(jsonStr);
  } catch(e) {
    // Last resort: try to extract just the products array
    const arrMatch = jsonStr.match(/"products"\s*:\s*\[[\s\S]*\]/);
    if (arrMatch) {
      try {
        return JSON.parse('{"products":' + arrMatch[0].replace(/^"products"\s*:\s*/, '') + '}');
      } catch(e2) {}
    }
    throw new Error('JSON parse failed: ' + e.message);
  }
}

// ─── ROUTE: Generate Copy ────────────────────────────────────────────────────
app.post('/gerar-copy', upload.single('imagem'), async (req, res) => {
  try {
    const { nome_produto, mercado = 'Netherlands' } = req.body;
    const content = [];

    if (req.file) {
      content.push({ type: 'image', source: { type: 'base64', media_type: req.file.mimetype, data: req.file.buffer.toString('base64') } });
    }

    content.push({
      type: 'text',
      text: `You are a luxury e-commerce copywriter for a dropshipping store targeting ${mercado}.
Product: ${nome_produto || 'shown in image'}

Return ONLY raw JSON:
{
  "productName": "elegant product name in English",
  "shopifyTitle": "concise Shopify title",
  "shopifyDescription": "3 paragraphs, refined aspirational tone, no bullet points",
  "instagramCaption": "caption max 100 words, aspirational, no hashtags",
  "hashtags": "15 relevant hashtags",
  "suggestedPrice": "suggested retail price in EUR",
  "targetAudience": "who buys this",
  "adAngle": "best angle to advertise this product"
}`
    });

    const raw = await callClaude([{ role: 'user', content }]);
    const result = extractJSON(raw);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── ROUTE: Mine Products ────────────────────────────────────────────────────
app.post('/minerar', async (req, res) => {
  try {
    const { nicho, mercado = 'Netherlands', preco_max = 10 } = req.body;
    if (!nicho) return res.status(400).json({ success: false, error: 'nicho is required' });

    const prompt = `You are an expert dropshipping product researcher for the ${mercado} market.

Find 5 winning products in the "${nicho}" niche under $${preco_max} on AliExpress.

For each product, generate a REAL AliExpress search URL in this format:
https://www.aliexpress.com/w/wholesale-[search-terms-with-hyphens].html

Also research real competitors in ${mercado} — actual Dutch/local webshops or marketplaces (bol.com, coolblue, local Shopify stores) that sell similar products. Include their approximate pricing and weaknesses.

Return ONLY raw JSON:
{
  "products": [
    {
      "name": "product name",
      "description": "what it is and why it sells",
      "aliexpressUrl": "https://www.aliexpress.com/w/wholesale-[terms].html",
      "aliexpressSearch": "search terms to use on AliExpress",
      "estimatedCostUSD": "$X - $Y",
      "suggestedPriceEUR": "€X - €Y",
      "estimatedMargin": "X% - Y%",
      "whyItWins": "why this product wins in ${mercado}",
      "targetCustomer": "who buys this",
      "bestAdChannel": "Instagram / TikTok / Google / Facebook",
      "adHook": "best ad hook to sell this product",
      "competitors": [
        {
          "name": "competitor store or marketplace name",
          "url": "their website URL",
          "price": "their price in EUR",
          "weakness": "their main weakness you can exploit"
        }
      ]
    }
  ]
}`;

    const raw = await callClaude([{ role: 'user', content: [{ type: 'text', text: prompt }] }], 4000);
    const result = extractJSON(raw);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', apiKey: API_KEY ? 'configured' : 'MISSING' });
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
  body{background:#F5F2EE;font-family:'Montserrat',sans-serif;color:#2C2825;min-height:100vh}
  header{background:#1A1A1A;padding:16px 24px;display:flex;justify-content:space-between;align-items:center}
  .logo{font-family:'Cormorant Garamond',serif;font-size:24px;color:#fff;font-style:italic}
  .logo-sub{font-size:9px;color:#B8985A;letter-spacing:.2em;text-transform:uppercase;margin-top:2px}
  .tabs{display:flex;gap:8px}
  .tab{padding:8px 16px;background:none;border:1px solid #ffffff22;color:#ffffff66;font-family:'Montserrat',sans-serif;font-size:10px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;border-radius:2px;transition:all .2s}
  .tab.active{border-color:#B8985A;color:#B8985A}
  main{max-width:760px;margin:28px auto;padding:0 16px}
  .panel{display:none}.panel.active{display:block}
  .card{background:#fff;border:1px solid #E8E2DA;border-radius:4px;padding:24px;margin-bottom:18px}
  .card-title{font-family:'Cormorant Garamond',serif;font-size:22px;font-style:italic;margin-bottom:6px}
  .card-sub{font-size:11px;color:#8A8580;margin-bottom:22px;line-height:1.6}
  label{display:block;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#B8985A;font-weight:600;margin-bottom:8px}
  input,select{width:100%;padding:11px 13px;border:1px solid #E8E2DA;border-radius:3px;font-family:'Montserrat',sans-serif;font-size:12px;color:#2C2825;background:#fff;margin-bottom:15px;outline:none}
  input:focus{border-color:#B8985A}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .btn{width:100%;padding:13px;background:#1A1A1A;color:#fff;border:none;border-radius:3px;font-family:'Montserrat',sans-serif;font-size:11px;letter-spacing:.15em;text-transform:uppercase;font-weight:600;cursor:pointer}
  .btn:disabled{background:#E8E2DA;color:#8A8580;cursor:not-allowed}
  .result-card{background:#fff;border:1px solid #E8E2DA;border-radius:4px;overflow:hidden;margin-bottom:12px}
  .result-header{display:flex;justify-content:space-between;align-items:center;padding:9px 13px;background:#FAFAF8;border-bottom:1px solid #E8E2DA}
  .result-label{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#B8985A;font-weight:600}
  .copy-btn{font-size:10px;color:#8A8580;background:none;border:none;cursor:pointer;font-weight:600;font-family:'Montserrat',sans-serif}
  .result-body{padding:13px;font-size:12px;line-height:1.8;white-space:pre-wrap}
  .product-card{background:#fff;border:1px solid #E8E2DA;border-radius:4px;padding:18px;margin-bottom:14px}
  .product-num{font-size:10px;color:#B8985A;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px}
  .product-name{font-family:'Cormorant Garamond',serif;font-size:20px;font-style:italic;margin-bottom:12px}
  .product-meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px}
  .meta-item{background:#F5F2EE;border-radius:3px;padding:8px;text-align:center}
  .meta-value{font-size:14px;font-weight:600;color:#1A1A1A}
  .meta-label{font-size:9px;color:#8A8580;text-transform:uppercase;letter-spacing:.08em;margin-top:2px}
  .product-detail{font-size:11px;color:#8A8580;line-height:1.8;margin-bottom:12px}
  .product-detail strong{color:#2C2825}
  .ali-link{display:inline-block;margin:8px 0 14px;padding:9px 16px;background:#FF6600;color:#fff;border-radius:3px;text-decoration:none;font-size:11px;font-weight:600;letter-spacing:.08em}
  .competitors-title{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#B8985A;font-weight:600;margin-bottom:10px;padding-top:12px;border-top:1px solid #E8E2DA}
  .competitor{background:#F5F2EE;border-radius:3px;padding:10px 12px;margin-bottom:8px}
  .competitor-name{font-size:12px;font-weight:600;color:#1A1A1A;margin-bottom:2px}
  .competitor-url{font-size:10px;color:#B8985A;text-decoration:none;display:block;margin-bottom:4px}
  .competitor-url:hover{text-decoration:underline}
  .competitor-detail{font-size:11px;color:#8A8580;line-height:1.6}
  .competitor-weakness{display:inline-block;background:#fff;border:1px solid #E8E2DA;border-radius:2px;padding:2px 8px;font-size:10px;color:#C0392B;margin-top:4px}
  .error{background:#fdf2f2;border:1px solid #f5c6c6;border-radius:3px;padding:11px 14px;color:#C0392B;font-size:11px;margin-top:10px}
  .loading{text-align:center;padding:40px;color:#8A8580;font-style:italic;font-family:'Cormorant Garamond',serif;font-size:18px}
  .spinner{width:28px;height:28px;border:2px solid #E8E2DA;border-top:2px solid #B8985A;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 14px}
  @keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<header>
  <div>
    <div class="logo">Zellaro</div>
    <div class="logo-sub">Product Intelligence</div>
  </div>
  <div class="tabs">
    <button class="tab active" onclick="switchTab('copy', this)">Gerar Copy</button>
    <button class="tab" onclick="switchTab('minerar', this)">Minerar Produtos</button>
  </div>
</header>

<main>
  <!-- COPY PANEL -->
  <div class="panel active" id="panel-copy">
    <div class="card">
      <div class="card-title">Gerar Copy de Produto</div>
      <div class="card-sub">Nome do produto → título Shopify, descrição, caption Instagram e hashtags prontos.</div>
      <label>Nome / Descrição do Produto</label>
      <input type="text" id="nomeProduto" placeholder="ex: vaso cerâmica minimalista bege 20cm">
      <label>Mercado Alvo</label>
      <select id="mercadoCopy">
        <option value="Netherlands">Holanda 🇳🇱</option>
        <option value="Australia">Austrália 🇦🇺</option>
        <option value="United Kingdom">Reino Unido 🇬🇧</option>
        <option value="Germany">Alemanha 🇩🇪</option>
      </select>
      <button class="btn" onclick="gerarCopy()" id="btnCopy">Gerar Copy →</button>
      <div id="copyError"></div>
    </div>
    <div id="copyResult"></div>
  </div>

  <!-- MINERAR PANEL -->
  <div class="panel" id="panel-minerar">
    <div class="card">
      <div class="card-title">Minerar Produtos Vencedores</div>
      <div class="card-sub">Nicho → 5 produtos com link AliExpress, preço, margem e análise de concorrentes locais.</div>
      <label>Nicho</label>
      <input type="text" id="nicho" placeholder="ex: casa e jardim minimalista, pet accessories...">
      <div class="row">
        <div>
          <label>Mercado Alvo</label>
          <select id="mercadoMinerar">
            <option value="Netherlands">Holanda 🇳🇱</option>
            <option value="Australia">Austrália 🇦🇺</option>
            <option value="United Kingdom">Reino Unido 🇬🇧</option>
            <option value="Germany">Alemanha 🇩🇪</option>
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
function switchTab(tab, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('panel-' + tab).classList.add('active');
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
  if (!nome) { errorDiv.innerHTML = '<div class="error">Digite o nome do produto.</div>'; return; }
  btn.disabled = true; btn.textContent = 'A gerar...';
  errorDiv.innerHTML = '';
  resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div>A analisar o produto...</div>';
  try {
    const formData = new FormData();
    formData.append('nome_produto', nome);
    formData.append('mercado', mercado);
    const res = await fetch('/gerar-copy', { method: 'POST', body: formData });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    const d = json.data;
    resultDiv.innerHTML = \`
      <div class="result-card" style="padding:14px;background:#fff;border:1px solid #E8E2DA;border-radius:4px;margin-bottom:12px">
        <span style="font-size:10px;color:#B8985A;text-transform:uppercase;letter-spacing:.1em;font-weight:600">\${d.targetAudience || ''}</span>
        <span style="font-size:12px;font-weight:700;color:#4A7C59;margin-left:12px">\${d.suggestedPrice || ''}</span>
      </div>
      \${resultCard('Título Shopify', d.shopifyTitle || '')}
      \${resultCard('Descrição Shopify', d.shopifyDescription || '')}
      \${resultCard('Caption Instagram', d.instagramCaption || '')}
      \${resultCard('Hashtags', d.hashtags || '')}
      \${resultCard('Ângulo de Anúncio', d.adAngle || '')}\`;
  } catch (err) {
    errorDiv.innerHTML = \`<div class="error">Erro: \${err.message}</div>\`;
    resultDiv.innerHTML = '';
  } finally {
    btn.disabled = false; btn.textContent = 'Gerar Copy →';
  }
}

async function minerarProdutos() {
  const nicho = document.getElementById('nicho').value.trim();
  const mercado = document.getElementById('mercadoMinerar').value;
  const precoMax = document.getElementById('precoMax').value;
  const btn = document.getElementById('btnMinerar');
  const errorDiv = document.getElementById('minerarError');
  const resultDiv = document.getElementById('minerarResult');
  if (!nicho) { errorDiv.innerHTML = '<div class="error">Digite o nicho.</div>'; return; }
  btn.disabled = true; btn.textContent = 'A minerar...';
  errorDiv.innerHTML = '';
  resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div>A garimpar produtos e analisar concorrentes...</div>';
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
        <div class="product-num">Produto \${i+1}</div>
        <div class="product-name">\${p.name}</div>
        <div class="product-meta">
          <div class="meta-item"><div class="meta-value">\${p.estimatedCostUSD||'-'}</div><div class="meta-label">Custo Ali</div></div>
          <div class="meta-item"><div class="meta-value">\${p.suggestedPriceEUR||'-'}</div><div class="meta-label">Preço Venda</div></div>
          <div class="meta-item"><div class="meta-value" style="color:#4A7C59">\${p.estimatedMargin||'-'}</div><div class="meta-label">Margem</div></div>
        </div>
        <div class="product-detail">
          <strong>Por que vende:</strong> \${p.whyItWins||''}<br>
          <strong>Cliente:</strong> \${p.targetCustomer||''}<br>
          <strong>Melhor canal:</strong> \${p.bestAdChannel||''}<br>
          <strong>Hook:</strong> \${p.adHook||''}
        </div>
        <a class="ali-link" href="\${p.aliexpressUrl}" target="_blank">🛒 Ver no AliExpress</a>
        \${p.competitors && p.competitors.length > 0 ? \`
        <div class="competitors-title">🏪 Concorrentes Locais</div>
        \${p.competitors.map(c => \`
          <div class="competitor">
            <div class="competitor-name">\${c.name}</div>
            <a class="competitor-url" href="\${c.url}" target="_blank">\${c.url}</a>
            <div class="competitor-detail"><strong>Preço deles:</strong> \${c.price}</div>
            <span class="competitor-weakness">⚠ \${c.weakness}</span>
          </div>\`).join('')}\` : ''}
      </div>\`).join('');
  } catch (err) {
    errorDiv.innerHTML = \`<div class="error">Erro: \${err.message}</div>\`;
    resultDiv.innerHTML = '';
  } finally {
    btn.disabled = false; btn.textContent = 'Minerar Produtos →';
  }
}
</script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`✅ Zellaro Intelligence running on port ${PORT}`);
  console.log(`🔑 API Key: ${API_KEY ? 'OK' : 'MISSING'}`);
});
