'use strict';

/**
 * 杂项选项实现（CN/日版 ROM 地址均已实证确认）。
 * 地址来源：refs/aos_rando/tables/tables_list_jp.txt（日版偏移表）
 */

const FileUtils = require('../vendor/utils/FileUtils');
const Random = require('../vendor/utils/Random');

const { writeData } = FileUtils;

// 日版/CN 地址（文件偏移）
const CN_ADDRESSES = {
  cutsceneSkip: 0x59B30,   // 跳过对话补丁（美版 0x5B56C）
  opendebug: 0x7A2,         // 调试菜单（美版同）
  draculaRed: 0xD32C8,      // 古文书红魂（美版 0xD4CF0）
  draculaBlue: 0xD32CE,     // 古文书蓝魂（美版 0xD4CF6）
  draculaYellow: 0xD32D4,   // 古文书黄魂（美版 0xD4CFC）
  // CheckDraculaSoulsEquipped (0x080D3270) 中三处失败跳转 BNE→0xD32E6
  mainSoulPass1: 0xD32CA,   // 红魂检查失败分支（现为 d1 0c）
  mainSoulPass2: 0xD32D0,   // 蓝魂检查失败分支（现为 d1 09）
  mainSoulPass3: 0xD32DC,   // 黄魂检查失败分支（现为 d1 03）
};

/** 一周目允许跳过对话：把读取"已通关"标志的指令改为 MOV R0, #3 */
function enableCutsceneSkip(data) {
  writeData(data, CN_ADDRESSES.cutsceneSkip, 2, 0x2003);
  return true;
}

/** 开启 Debug 模式菜单 */
function enableDebugMode(data) {
  writeData(data, CN_ADDRESSES.opendebug, 2, 0x200E);
  return true;
}

/**
 * 随机古文书所需三魂，并写入 CN ROM。
 * 返回写下的三魂（NA soul id，与 CN 一致）。
 */
function randomizeDraculaSouls(data, random) {
  const Souls = require('../vendor/items/Souls');
  const pool = {
    red: Souls.Red,
    blue: Souls.Blue,
    yellow: Souls.Yellow,
  };
  const chosen = {};
  for (const color of ['red', 'blue', 'yellow']) {
    const candidates = pool[color].filter(s => !s.isProgression && !s.isKindaProgression);
    chosen[color] = random.pickFromArray(candidates).value;
  }
  writeData(data, CN_ADDRESSES.draculaRed, 1, chosen.red.id);
  writeData(data, CN_ADDRESSES.draculaBlue, 1, chosen.blue.id);
  writeData(data, CN_ADDRESSES.draculaYellow, 1, chosen.yellow.id);
  return chosen;
}

/**
 * 取消古文书三魂检测：把 CheckDraculaSoulsEquipped 的三处失败跳转改为 NOP。
 * 每处都是 2 字节 Thumb 条件分支（BNE），改写为 NOP（0x46C0 = MOV R8, R8）。
 */
function enableMainSoulPass(data) {
  for (const addr of [
    CN_ADDRESSES.mainSoulPass1,
    CN_ADDRESSES.mainSoulPass2,
    CN_ADDRESSES.mainSoulPass3,
  ]) {
    writeData(data, addr, 2, 0x46C0);
  }
  return true;
}

/**
 * 应用所有已支持的杂项选项。
 * @param {Buffer} data
 * @param {Object} params
 * @param {Random} random
 */
function apply(data, params, random) {
  const lines = [];
  if (params.skipdialog) {
    enableCutsceneSkip(data);
    lines.push('一周目可跳过对话');
  }
  if (params.opendebug) {
    enableDebugMode(data);
    lines.push('开启 Debug 模式');
  }
  if (params.main_soul_pass) {
    enableMainSoulPass(data);
    lines.push('取消古文书三魂检测');
  }
  let draculaSouls = null;
  if (params.main_soul_random) {
    draculaSouls = randomizeDraculaSouls(data, random);
    lines.push(`古文书三魂随机（红=${draculaSouls.red.name} 蓝=${draculaSouls.blue.name} 黄=${draculaSouls.yellow.name}）`);
  }
  return {
    summary: lines.join('\n'),
    draculaSouls,
  };
}

module.exports = {
  CN_ADDRESSES,
  enableCutsceneSkip,
  enableDebugMode,
  enableMainSoulPass,
  randomizeDraculaSouls,
  apply,
};
