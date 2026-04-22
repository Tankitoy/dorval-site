/* ─────────────────────────────────────────────────────────────────────
   add-slide.js  —  Netlify Function
   Reçoit une image + légende depuis Make.com et met à jour le site.

   Variables d'environnement requises (Netlify dashboard) :
     GITHUB_TOKEN   — Personal Access Token GitHub (scope: repo)
     UPDATE_SECRET  — Clé secrète partagée avec Make.com
   ───────────────────────────────────────────────────────────────────── */

const https = require('https');

const OWNER = 'Tankitoy';
const REPO  = 'dorval-site';

/* ─── Appel GitHub API ────────────────────────────────────────────────── */
function githubRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: 'api.github.com',
        path,
        method,
        headers: {
          Authorization:   `token ${token}`,
          'User-Agent':    'dorval-site-function',
          Accept:          'application/vnd.github.v3+json',
          'Content-Type':  'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
          catch { resolve({ status: res.statusCode, data: raw }); }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

/* ─── Handler principal ────────────────────────────────────────────────── */
exports.handler = async (event) => {
  /* Méthode */
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  /* Authentification simple */
  if (event.headers['x-secret'] !== process.env.UPDATE_SECRET) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  /* Parsing du corps */
  let body;
  try { body = JSON.parse(event.body); }
  catch (e) {
    return { statusCode: 400, body: `Invalid JSON: ${e.message} — raw: ${String(event.body).slice(0, 200)}` };
  }

  const { caption1, caption2, image, filename } = body;
  const token = process.env.GITHUB_TOKEN;

  if (!image) {
    return { statusCode: 400, body: `No image provided — keys received: ${Object.keys(body).join(', ')} — caption1: ${caption1}` };
  }

  /* 1. Upload de l'image dans /images/ */
  const ext       = ((filename || 'jpg').split('.').pop() || 'jpg').toLowerCase();
  const imagePath = `images/${Date.now()}.${ext}`;

  const uploadRes = await githubRequest(
    'PUT',
    `/repos/${OWNER}/${REPO}/contents/${imagePath}`,
    { message: `add: ${filename || 'image'}`, content: image },
    token
  );

  if (uploadRes.status !== 201) {
    return { statusCode: 500, body: `Image upload failed (${uploadRes.status})` };
  }

  /* 2. Lire slides.json actuel */
  const getRes = await githubRequest(
    'GET',
    `/repos/${OWNER}/${REPO}/contents/slides.json`,
    null,
    token
  );

  if (getRes.status !== 200) {
    return { statusCode: 500, body: 'Could not read slides.json' };
  }

  const slides = JSON.parse(
    Buffer.from(getRes.data.content, 'base64').toString('utf8')
  );
  const sha = getRes.data.sha;

  /* 3. Ajouter le nouveau slide */
  slides.push({
    image:   imagePath,
    caption: [caption1 || '', caption2 || ''],
  });

  /* 4. Mettre à jour slides.json */
  const updateRes = await githubRequest(
    'PUT',
    `/repos/${OWNER}/${REPO}/contents/slides.json`,
    {
      message: `add slide: ${caption1 || 'new slide'}`,
      content: Buffer.from(JSON.stringify(slides, null, 2)).toString('base64'),
      sha,
    },
    token
  );

  if (updateRes.status !== 200) {
    return { statusCode: 500, body: `slides.json update failed (${updateRes.status})` };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, image: imagePath, total: slides.length }),
  };
};
