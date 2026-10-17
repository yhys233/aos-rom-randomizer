'use strict';
// 直接调用引擎生成测试 ROM，绕过 HTTP 服务。
const fs = require('fs');
const path = require('path');
const runRandomizer = require('../lib/runRandomizer');

const SEED = 626994;
const OUT = process.argv[2] || path.join(__dirname, '..', '..', 'rom', `emcxyywq-test-${SEED}.gba`);
const params = {
  seed: String(SEED),
  random_type: '0',
  // 四项待验证功能
  exp_multiplier: '5',           // 经验 ×5
  soul_probability: '1',         // 魂掉率提高（官方补丁：阈值钳 0x10，≈37.5%-93.75% 必掉）
  item_probability: '1',         // 道具掉率提高（官方补丁：100% 必掉）
  ringchaos: '1',                // 混沌戒指
  soul_start: '1',               // 红蓝黄魂各一（不开 mainsoul，避免互斥）
};

const result = runRandomizer.run(params);
fs.writeFileSync(OUT, result.data);
console.log('OUT:', OUT);
console.log('SEED:', result.seed);
console.log('bytesChanged:', result.bytesChanged);
console.log('---------------- SUMMARY ----------------');
console.log(result.summary);
