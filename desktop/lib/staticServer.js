'use strict';
// 멀티뷰 웹 빌드(desktop/web)를 앱 안에서 http://localhost:<port>로 띄우는 정적 서버.
// file://가 아닌 이유: 트위치 임베드는 parent에 일반 도메인(localhost)을 요구한다.
// 127.0.0.1에서만 대기하고, root 밖의 파일은 내주지 않는다.
const http = require('http');
const fs = require('fs');
const path = require('path');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function resolveSafe(root, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  const rel = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const file = path.resolve(root, rel);
  return file === root || file.startsWith(root + path.sep) ? file : null;
}

function startStaticServer(rootDir) {
  const root = path.resolve(rootDir);
  const server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
      return;
    }
    const file = resolveSafe(root, req.url || '/');
    if (!file) {
      res.writeHead(400).end();
      return;
    }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      if (req.method === 'HEAD') res.end();
      else fs.createReadStream(file).pipe(res);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve({
        host: '127.0.0.1',
        port: server.address().port,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

module.exports = { startStaticServer };
