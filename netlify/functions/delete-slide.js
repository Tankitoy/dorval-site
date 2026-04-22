/* ─────────────────────────────────────────────────────────────────────
   delete-slide.js  —  Netlify Function
   Supprime un slide de slides.json par son index (1-based).

   Body attendu (JSON) :
     { slideIndex }   ← numéro du slide (commence à 1)
   ───────────────────────────────────────────────────────────────────── */

const https = require('https');

const OWNER = 'Tankitoy';
const REPO  = 'dorval-site';

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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  if (event.headers['x-secret'] !== process.env.UPDATE_SECRET) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch (e) { return { statusCode: 400, body: 'Invalid JSON' }; }

  const slideIndex = parseInt(body.slideIndex, 10);
  const token = process.env.GITHUB_TOKEN;

  if (isNaN(slideIndex) || slideIndex < 1) {
    return { statusCode: 400, body: 'Invalid slideIndex' };
  }

  /* 1. Lire slides.json */
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

  if (slideIndex > slides.length) {
    return { statusCode: 400, body: `Slide ${slideIndex} n'existe pas (total: ${slides.length})` };
  }

  /* 2. Supprimer le slide (index 1-based → 0-based) */
  const removed = slides.splice(slideIndex - 1, 1)[0];

  /* 3. Mettre à jour slides.json */
  const updateRes = await githubRequest(
    'PUT',
    `/repos/${OWNER}/${REPO}/contents/slides.json`,
    {
      message: `delete slide ${slideIndex}: ${removed.caption[0]}`,
      content: Buffer.from(JSON.stringify(slides, null, 2)).toString('base64'),
      sha,
    },
    token
  );

  if (updateRes.status !== 200) {
    return { statusCode: 500, body: `Update failed (${updateRes.status})` };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, deleted: removed.caption[0], remaining: slides.length }),
  };
};
