// Zero-dependency static server for the production web build (web-build/).
//
//   npm run web:build      # compile to web-build/ (do this on every deploy)
//   node serve-web.js       # serve it   (PORT env, default 3001)
//
// Serves hashed assets with a long immutable cache, gzips text responses, and
// falls back to index.html for client-side routes (deep links like
// /product/:id). This replaces running `webpack serve` in production — no
// bundler resident in memory, instant start, low RAM.

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, 'web-build');
const PORT = parseInt(process.env.PORT, 10) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.map', '.svg', '.txt']);

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error(`\n✖ ${ROOT}/index.html not found. Run "npm run web:build" first.\n`);
  process.exit(1);
}

const send = (req, res, filePath, statusCode) => {
  const ext = path.extname(filePath).toLowerCase();
  const body = fs.readFileSync(filePath);
  const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };

  // Hashed build assets never change under the same name → cache hard.
  // index.html and anything unhashed must always be revalidated.
  if (filePath.startsWith(path.join(ROOT, 'static'))) {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  } else {
    headers['Cache-Control'] = 'no-cache';
  }

  const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  if (acceptsGzip && COMPRESSIBLE.has(ext) && body.length > 1024) {
    const gz = zlib.gzipSync(body);
    res.writeHead(statusCode || 200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': gz.length });
    res.end(req.method === 'HEAD' ? undefined : gz);
    return;
  }
  res.writeHead(statusCode || 200, { ...headers, 'Content-Length': body.length });
  res.end(req.method === 'HEAD' ? undefined : body);
};

const server = http.createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    // Resolve inside ROOT, blocking any ../ traversal.
    const resolved = path.normalize(path.join(ROOT, urlPath));
    if (!resolved.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    let filePath = resolved;
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      send(req, res, filePath);
      return;
    }

    // Unknown path with a file extension → genuinely missing asset.
    if (path.extname(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not Found');
      return;
    }

    // Client-side route → hand back the SPA shell.
    send(req, res, path.join(ROOT, 'index.html'), 200);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' }).end('Internal Server Error');
    console.error(err);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n✅ dpp-app web serving ${ROOT}`);
  console.log(`📍 http://${HOST}:${PORT}\n`);
});
