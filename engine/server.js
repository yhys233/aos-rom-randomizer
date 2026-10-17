'use strict';

/**
 * 本地随机化 HTTP 服务。
 * 兼容原脚本的 POST 格式：curl --data-raw "random_type=3&..." /ajax.php
 * 返回 ZIP（内含 ROM + 可选 Info/Enemy 文本），脚本解压即可。
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const zlib = require('zlib');

const runRandomizer = require('./lib/runRandomizer');

const PORT = Number(process.env.PORT) || 18688;

// ---------------------------------------------------------------------------
// 极简 ZIP 打包（无压缩 store 模式）
// ---------------------------------------------------------------------------

function dosTime() {
  const now = new Date();
  const t = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
  const d = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
  return { t, d };
}

function crc32(buf) {
  return zlib.crc32(buf) >>> 0;
}

function buildZip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;
  const { t, d } = dosTime();

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const data = entry.data;
    const crc = crc32(data);
    const size = data.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // flags: UTF-8
    local.writeUInt16LE(0, 8); // method: store
    local.writeUInt16LE(t, 10);
    local.writeUInt16LE(d, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // extra length

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // signature
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0x0800, 8); // flags
    centralHeader.writeUInt16LE(0, 10); // method
    centralHeader.writeUInt16LE(t, 12);
    centralHeader.writeUInt16LE(d, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(size, 20);
    centralHeader.writeUInt32LE(size, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra
    centralHeader.writeUInt16LE(0, 32); // comment
    centralHeader.writeUInt16LE(0, 34); // disk number
    centralHeader.writeUInt16LE(0, 36); // internal attrs
    centralHeader.writeUInt32LE(0, 38); // external attrs
    centralHeader.writeUInt32LE(offset, 42); // local header offset

    parts.push(local, name, data);
    central.push(Buffer.concat([centralHeader, name]));
    offset += local.length + name.length + data.length;
  }

  const centralDir = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk
  eocd.writeUInt16LE(0, 6); // central dir disk
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...parts, centralDir, eocd]);
}

// ---------------------------------------------------------------------------
// 参数解析
// ---------------------------------------------------------------------------

function parseUrlencoded(body) {
  const params = {};
  const decoded = decodeURIComponent(body.replace(/\+/g, '%20'));
  for (const pair of decoded.split('&')) {
    if (!pair) {
      continue;
    }
    const [k, v] = pair.split('=');
    params[k] = v === undefined ? '' : v;
  }
  return params;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// 处理请求
// ---------------------------------------------------------------------------

// 随机种子：8 位数字+大小写字母混用（必含至少 1 位数字与 1 位字母），
// 62^8 ≈ 2.2e14 种，远多于纯数字
const SEED_LENGTH = 8;

function generateRandomSeed() {
  const digits = '0123456789';
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const all = digits + letters;
  // 保证数字与英文字母混用：至少各 1 位，其余随机
  let s = digits[Math.floor(Math.random() * digits.length)] +
          letters[Math.floor(Math.random() * letters.length)];
  for (let i = 2; i < SEED_LENGTH; i++) {
    s += all[Math.floor(Math.random() * all.length)];
  }
  return s;
}

async function handleAjax(req, body) {
  const params = parseUrlencoded(body);

  if (!params.seed || Number(params.seed) === 0) {
    params.seed = generateRandomSeed();
  }

  const result = runRandomizer.run(params);

  const infoTxt = Buffer.from(
    `晓月圆舞曲（九柳汉化版）随机 ROM\n` +
    `Seed: ${result.seed}\n` +
    `随机内容：\n${result.summary}\n` +
    `变更字节数：${result.bytesChanged}\n`,
    'utf8',
  );

  const entries = [{ name: result.filename, data: result.data }];
  entries.push({ name: `Castlevania - Info - seed${result.seed}.txt`, data: infoTxt });

  const zip = buildZip(entries);
  return { zip, filename: `random_${result.seed}.zip`, seed: result.seed, summary: result.summary };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (req.method === 'GET' && url.pathname === '/') {
      const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    if (url.pathname === '/ajax.php') {
      let body = url.searchParams.toString();
      if (req.method === 'POST') {
        body = await readBody(req);
      }
      const { zip, filename, summary } = await handleAjax(req, body);
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': zip.length,
        'X-Random-Summary': encodeURIComponent(summary),
      });
      res.end(zip);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`生成失败：${err.message}`);
  }
});

server.listen(PORT, () => {
  fs.writeFileSync(path.join(__dirname, 'server.pid'), String(process.pid));
  console.log(`晓月圆舞曲 CN 随机化服务已启动: http://localhost:${PORT}`);
  console.log(`POST /ajax.php  (application/x-www-form-urlencoded)`);
});
