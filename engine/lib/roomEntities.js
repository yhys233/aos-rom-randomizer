'use strict';

/**
 * 怪物位置随机（CN/日版）。
 * 数据结构（DSVEdit 确认）：
 *   - 房间指针表 @ 0x4E52AC，共 355 个房间
 *   - 每个房间元数据 +20 处为实体列表指针（ROM 地址，文件偏移 = 地址 - 0x08000000）
 *   - 实体 12 字节：x(2) y(2) uid(1) type(1) subtype(1) byte8(1) varA(2) varB(2)
 *   - 列表以 x=0x7FFF && y=0x7FFF 结尾
 *   - type 01 = 敌人，subtype = 敌人 ID（0-112，与 Enemies.js 一致）
 */

const fs = require('fs');
const path = require('path');

const cnAreas = require('./cnAreas');

const ROM_PATH = path.join(__dirname, '..', 'rom', 'emcxyywq.gba');
const ROOM_TABLE = 0x4E52AC;
const ROOM_COUNT = 355;
const ENTITY_SIZE = 12;

const BOSS_IDS = [106, 107, 108, 109, 110, 111, 112];
const CHRONOMAGE_ID = 40;
const BALORE_ID = 109;
const JULIUS_ID = 110;
const CHAOS_ID = 112;

// 拾取物实体：type 04（普通模式）才生成物品/魂烛。
//  - subtype 02-04 = consumable/weapon/armor+accessory（varB = 物品 id）
//  - subtype 05-08 = 魂烛 red/blue/yellow/ability（varB = 该色系 1 基魂 ID）
// 原版魂烛实体（10 个）全部为 subtype 06-08；参考 ROM 注入的也是纯烛实体，
// 零代码补丁，玩家开局攻击烛体即掉魂球自动吸收。subtype 05(红) 原版无烛先例，
// 但 color 表（0x08031C78：color=0→7）有对应值，生成机制一致。
// type 05 是"困难模式"拾取物（0x0800E5DE 首道门要求 hard-mode 标志位，
// 普通模式下一律跳过，且没有魂烛分支），不能用于普通模式开局赠品。
const SOUL_CANDLE_SUBTYPE = { red: 5, blue: 6, yellow: 7 };
const ITEM_ENTITY_TYPE = 4;

// 起始房间（房间 0）实体列表紧邻后续房间无空隙，需整体搬迁到空闲区
const START_ROOM_INDEX = 0;
const FREE_SPACE_ADDR = 0x7F8B6C; // ROM 尾部 0x7F8B6C-0x7FFFFF 为全 0xFF 空闲区
const ROOM_META_ENTITYLIST_OFFSET = 20; // 房间元数据 +20 处为实体列表指针（ROM 地址）

// 物品拾取实体的 varA = memory_flag（防重生标记，与 aos_rando 一致）。
// 原版已用到 0x9D，aos_rando 用 0xA0-0xBF 作空闲区，我们复用该约定。
const FREE_MEMORY_FLAG_START = 0xA0;
const FREE_MEMORY_FLAG_END = 0xBF;

function read16(data, off) {
  return data[off] | (data[off + 1] << 8);
}

function read32(data, off) {
  return data[off] | (data[off + 1] << 8) | (data[off + 2] << 16) | (data[off + 3] << 24);
}

/**
 * 遍历所有房间的所有实体。
 * @param {Buffer} data
 * @param {Function} cb - cb({ off, room, type, subtype, x, y })；返回 false 可中断
 * @returns {number} 敌人实体（type 1）数量
 */
function forEachEntity(data, cb) {
  let enemies = 0;
  for (let i = 0; i < ROOM_COUNT; i++) {
    const p = read32(data, ROOM_TABLE + i * 4);
    if ((p & 0xFF000000) !== 0x08000000) {
      continue;
    }
    const el = read32(data, p - 0x08000000 + 20);
    if (el < 0x08000000 || el > 0x09000000) {
      continue;
    }
    const base = el - 0x08000000;
    for (let off = base; ; off += ENTITY_SIZE) {
      const x = read16(data, off);
      const y = read16(data, off + 2);
      if (x === 0x7FFF && y === 0x7FFF) {
        break;
      }
      const type = data[off + 5];
      const subtype = data[off + 6];
      if (type === 1) {
        enemies++;
      }
      if (cb({ off, room: i, type, subtype, x, y }) === false) {
        return enemies;
      }
    }
  }
  return enemies;
}

/**
 * 随机化怪物种类：把每个敌人实体的 subtype（敌人 ID）随机换成池内敌人。
 * @param {Buffer} data
 * @param {Random} random
 * @param {Array<number>} pool - 可选的敌人 ID 池
 * @returns {number} 改写数量
 */
function randomizeEnemyIds(data, random, pool) {
  const idPool = pool || [];
  let changed = 0;
  forEachEntity(data, e => {
    if (e.type !== 1) {
      return;
    }
    const next = idPool[random.random_int(idPool.length)];
    if (next !== e.subtype) {
      data[e.off + 6] = next;
      changed++;
    }
  });
  return changed;
}

/**
 * 把随机比例（默认 1/8）的普通怪物替换为指定敌人 ID。
 */
function injectEnemy(data, random, id, fraction = 8) {
  let changed = 0;
  forEachEntity(data, e => {
    if (e.type !== 1) {
      return;
    }
    if (random.random_int(fraction) !== 0) {
      return;
    }
    if (e.subtype !== id) {
      data[e.off + 6] = id;
      changed++;
    }
  });
  return changed;
}

/**
 * 魂灯：把随机一部分普通物品拾取点（type 04/05 的 consumable/weapon/armor，
 * subtype 02-04）改写为随机魂烛（subtype 05-07，varB = 魂 ID）。
 * @param {Buffer} data
 * @param {Random} random
 * @param {number} fraction - 每几个物品拾取点抽 1 个变成魂灯
 * @returns {number} 改写数量
 */
function addSoulLights(data, random, fraction = 5) {
  const Souls = require('../vendor/items/Souls');
  const pools = {
    5: Souls.Red,    // subtype 05 = 红魂烛
    6: Souls.Blue,   // subtype 06 = 蓝魂烛
    7: Souls.Yellow, // subtype 07 = 黄魂烛
  };
  let changed = 0;
  forEachEntity(data, e => {
    // 只处理物品类拾取点（consumable/weapon/armor），避开已有魂烛/金钱。
    // 只有 type 05 是拾取物实体；type 04 是脚本实体（varA 为脚本/动画索引），不能改写。
    if (e.type !== ITEM_ENTITY_TYPE) {
      return;
    }
    if (e.subtype < 2 || e.subtype > 4) {
      return;
    }
    if (random.random_int(fraction) !== 0) {
      return;
    }
    const colorSubtype = 5 + random.random_int(3); // 05/06/07
    const pool = pools[colorSubtype];
    const soul = pool[random.random_int(pool.length)];
    data[e.off + 6] = colorSubtype;
    data[e.off + 10] = soul.id & 0xFF;
    data[e.off + 11] = (soul.id >> 8) & 0xFF;
    changed++;
  });
  return changed;
}

/**
 * 读取指定房间的实体列表（不搬迁）。
 * @returns {Array<{off, x, y, uid, type, subtype, byte8, varA, varB}>} 实体数组
 */
function readRoomEntityList(data, roomIndex) {
  const roomPtr = read32(data, ROOM_TABLE + roomIndex * 4);
  if ((roomPtr & 0xFF000000) !== 0x08000000) {
    throw new Error(`房间 ${roomIndex} 指针异常: 0x${roomPtr.toString(16)}`);
  }
  const elPtr = read32(data, roomPtr - 0x08000000 + ROOM_META_ENTITYLIST_OFFSET);
  if (elPtr < 0x08000000 || elPtr > 0x09000000) {
    throw new Error(`房间 ${roomIndex} 实体列表指针异常: 0x${elPtr.toString(16)}`);
  }
  const base = elPtr - 0x08000000;
  const entities = [];
  for (let off = base; ; off += ENTITY_SIZE) {
    const x = read16(data, off);
    const y = read16(data, off + 2);
    if (x === 0x7FFF && y === 0x7FFF) {
      break;
    }
    entities.push({
      off,
      x, y,
      uid: data[off + 4],
      type: data[off + 5],
      subtype: data[off + 6],
      byte8: data[off + 7],
      varA: read16(data, off + 8),
      varB: read16(data, off + 10),
    });
  }
  return entities;
}

/**
 * 计算指定房间原实体列表的字节长度（含 12 字节结束标记）。
 */
function roomEntityListLength(data, roomIndex) {
  const entities = readRoomEntityList(data, roomIndex);
  if (!entities.length) {
    return ENTITY_SIZE;
  }
  const first = entities[0];
  const last = entities[entities.length - 1];
  return (last.off - first.off) + ENTITY_SIZE + ENTITY_SIZE;
}

/**
 * 从空闲区分配一块连续空间，并记录已用区域（避免多个搬迁互相覆盖）。
 */
function allocFreeSpace(data, size) {
  // 从 FREE_SPACE_ADDR 向后扫描，找一块连续的 0xFF 区域
  let start = FREE_SPACE_ADDR;
  while (start + size <= 0x800000) {
    let ok = true;
    for (let i = 0; i < size; i++) {
      if (data[start + i] !== 0xFF) {
        ok = false;
        break;
      }
    }
    if (ok) {
      return start;
    }
    start += ENTITY_SIZE;
  }
  throw new Error('ROM 尾部空闲区不足');
}

/**
 * 收集全图已用的 memory_flag（type 4/5 物品实体的 varA）。
 */
function collectUsedFlags(data) {
  const usedFlags = new Set();
  const seen = new Set();
  for (let i = 0; i < ROOM_COUNT; i++) {
    const p = read32(data, ROOM_TABLE + i * 4);
    if ((p & 0xFF000000) !== 0x08000000) {
      continue;
    }
    const el = read32(data, p - 0x08000000 + ROOM_META_ENTITYLIST_OFFSET);
    if (el < 0x08000000 || el > 0x09000000) {
      continue;
    }
    if (seen.has(el)) {
      continue;
    }
    seen.add(el);
    const b = el - 0x08000000;
    for (let off = b; ; off += ENTITY_SIZE) {
      const x = read16(data, off);
      const y = read16(data, off + 2);
      if (x === 0x7FFF && y === 0x7FFF) {
        break;
      }
      const type = data[off + 5];
      if (type === 4 || type === 5) {
        usedFlags.add(read16(data, off + 8));
      }
    }
  }
  return usedFlags;
}

/**
 * 通用搬迁：把指定房间的实体列表整体搬到空闲区，并在结束标记前追加实体。
 * 物品实体（type 4/5）若未显式给 varA，自动从 0xA0-0xBF 分配唯一 memory_flag。
 * @param {Buffer} data
 * @param {number} roomIndex - 房间索引
 * @param {Array} extra - 追加实体 [{ x, y, type, subtype, byte8?, varA?, varB }]
 * @returns {{base: number, bytes: number, usedFlags: number[]}}
 */
function relocateAndInject(data, roomIndex, extra) {
  const roomPtr = read32(data, ROOM_TABLE + roomIndex * 4);
  if ((roomPtr & 0xFF000000) !== 0x08000000) {
    throw new Error(`房间 ${roomIndex} 指针异常: 0x${roomPtr.toString(16)}`);
  }
  const elPtr = read32(data, roomPtr - 0x08000000 + ROOM_META_ENTITYLIST_OFFSET);
  if (elPtr < 0x08000000 || elPtr > 0x09000000) {
    throw new Error(`房间 ${roomIndex} 实体列表指针异常: 0x${elPtr.toString(16)}`);
  }
  const base = elPtr - 0x08000000;

  // 收集全图已用的 memory_flag，避免新实体与现有物品拾取标记冲突
  const usedFlags = collectUsedFlags(data);
  let nextFlag = FREE_MEMORY_FLAG_START;
  const allocFlag = () => {
    while (usedFlags.has(nextFlag) && nextFlag <= FREE_MEMORY_FLAG_END) {
      nextFlag++;
    }
    if (nextFlag > FREE_MEMORY_FLAG_END) {
      throw new Error('空闲 memory_flag 0xA0-0xBF 已用尽');
    }
    const f = nextFlag;
    usedFlags.add(f);
    nextFlag++;
    return f;
  };

  const oldLen = roomEntityListLength(data, roomIndex);
  const newBase = allocFreeSpace(data, oldLen + extra.length * ENTITY_SIZE + ENTITY_SIZE);
  // 复制原列表
  data.copy(data, newBase, base, base + oldLen);
  // 在结束标记前插入新实体
  let writeOff = newBase + (oldLen - ENTITY_SIZE);
  const uidStart = 0x60; // 避开原有 uid
  for (let i = 0; i < extra.length; i++) {
    const e = extra[i];
    data.writeUInt16LE(e.x, writeOff);
    data.writeUInt16LE(e.y, writeOff + 2);
    data[writeOff + 4] = e.uid || (uidStart + i);
    data[writeOff + 5] = e.type;
    data[writeOff + 6] = e.subtype;
    data[writeOff + 7] = e.byte8 || 0;
    data.writeUInt16LE(e.varA !== undefined ? e.varA : allocFlag(), writeOff + 8);
    data.writeUInt16LE(e.varB !== undefined ? e.varB : 0, writeOff + 10);
    writeOff += ENTITY_SIZE;
  }
  // 追加结束标记
  data.writeUInt16LE(0x7FFF, writeOff);
  data.writeUInt16LE(0x7FFF, writeOff + 2);
  for (let i = 4; i < 12; i++) {
    data[writeOff + i] = 0;
  }
  const total = writeOff + ENTITY_SIZE - newBase;
  // 更新房间元数据里的实体列表指针
  data.writeUInt32LE(0x08000000 + newBase, roomPtr - 0x08000000 + ROOM_META_ENTITYLIST_OFFSET);
  return { base: newBase, bytes: total, usedFlags: [...usedFlags] };
}

/**
 * 把起始房间实体列表整体搬迁到空闲区，并在末尾（结束标记前）追加实体。
 * 兼容旧接口：返回写入空闲区的字节数。
 */
function relocateAndInjectStartRoom(data, extra) {
  return relocateAndInject(data, START_ROOM_INDEX, extra).bytes;
}

/**
 * 原地替换起始房间（房间 0）实体列表中指定 uid 的实体，不搬迁、不打代码补丁。
 * 完全复刻参考 ROM 的生成方式：直接覆盖原 type2 sub15 占位实体（uid3/5/6/7），
 * 复用原版 memory_flag（3/7/8）与 sub6/7/8 魂烛，玩家开局攻击即掉魂球自动吸收。
 * @param {Buffer} data
 * @param {Array} replacements - [{ uid, x, y, type, subtype, byte8?, varA, varB }]
 * @returns {number} 实际替换的实体数
 */
function replaceStartRoomEntities(data, replacements) {
  const roomPtr = read32(data, ROOM_TABLE + START_ROOM_INDEX * 4);
  const elPtr = read32(data, roomPtr - 0x08000000 + ROOM_META_ENTITYLIST_OFFSET);
  const base = elPtr - 0x08000000;
  let replaced = 0;
  for (let off = base; ; off += ENTITY_SIZE) {
    const x = read16(data, off);
    const y = read16(data, off + 2);
    if (x === 0x7FFF && y === 0x7FFF) {
      break;
    }
    const uid = data[off + 4];
    const r = replacements.find(t => t.uid === uid);
    if (r) {
      data.writeUInt16LE(r.x, off);
      data.writeUInt16LE(r.y, off + 2);
      data[off + 5] = r.type;
      data[off + 6] = r.subtype;
      data[off + 7] = r.byte8 !== undefined ? r.byte8 : 0;
      data.writeUInt16LE(r.varA !== undefined ? r.varA : 0, off + 8);
      data.writeUInt16LE(r.varB !== undefined ? r.varB : 0, off + 10);
      replaced++;
    }
  }
  return replaced;
}

/**
 * 混沌房列表：room322 与 room324 各有一只最终混沌（subtype 112）。
 */
const CHAOS_ROOM_INDEXES = [322, 324];

/**
 * 通用重写：把指定房间的实体列表整体重写（删除/修改实体），搬到空闲区并更新指针。
 * @param {Buffer} data
 * @param {number} roomIndex - 房间索引
 * @param {Array} entities - 新实体数组 [{ x, y, uid?, type, subtype, byte8?, varA?, varB? }]
 * @returns {{base: number, bytes: number}}
 */
function rewriteRoomEntityList(data, roomIndex, entities) {
  const roomPtr = read32(data, ROOM_TABLE + roomIndex * 4);
  if ((roomPtr & 0xFF000000) !== 0x08000000) {
    throw new Error(`房间 ${roomIndex} 指针异常: 0x${roomPtr.toString(16)}`);
  }
  const newBase = allocFreeSpace(data, entities.length * ENTITY_SIZE + ENTITY_SIZE);
  let writeOff = newBase;
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    data.writeUInt16LE(e.x, writeOff);
    data.writeUInt16LE(e.y, writeOff + 2);
    data[writeOff + 4] = e.uid || 0;
    data[writeOff + 5] = e.type;
    data[writeOff + 6] = e.subtype;
    data[writeOff + 7] = e.byte8 || 0;
    data.writeUInt16LE(e.varA || 0, writeOff + 8);
    data.writeUInt16LE(e.varB || 0, writeOff + 10);
    writeOff += ENTITY_SIZE;
  }
  data.writeUInt16LE(0x7FFF, writeOff);
  data.writeUInt16LE(0x7FFF, writeOff + 2);
  for (let i = 4; i < 12; i++) {
    data[writeOff + i] = 0;
  }
  const total = writeOff + ENTITY_SIZE - newBase;
  data.writeUInt32LE(0x08000000 + newBase, roomPtr - 0x08000000 + ROOM_META_ENTITYLIST_OFFSET);
  return { base: newBase, bytes: total };
}

// 可被 enemy_boss_min 替换的 Boss 房（排除混沌房 322/324，最终 Boss 不能移除）。
const CONVERT_BOSS_ROOMS = [124, 141, 157, 222, 242, 268];
// 各 Boss 房经由门相连的房间（门实体所在，含 Boss 房本体）。
const BOSS_ROOM_NEIGHBORS = {
  124: [119, 127],
  141: [149, 142],
  157: [167, 169],
  222: [221, 237],
  242: [241, 246],
  268: [264, 265],
};
// Boss 门实体：type2、subtype 2/4/10、varB = Boss flag（0/1/2/4/5/6 = 可移除的六个 Boss）
const BOSS_DOOR_SUBTYPES = new Set([2, 4, 10]);
const BOSS_DOOR_FLAGS = new Set([0, 1, 2, 4, 5, 6]);

/**
 * 原 Boss 随机成小怪：把六个非最终 Boss（房间 124/141/157/222/242/268）换成随机小怪，
 * 并删除对应 Boss 门实体（type2/subtype 2/4/10 + Boss flag），避免 Boss 移除后门永久锁死。
 * @param {Buffer} data
 * @param {Random} random
 * @returns {{bosses: number, doors: number, bytes: number}}
 */
function enemyBossMin(data, random) {
  const smallPool = [];
  for (let i = 0; i < 106; i++) {
    smallPool.push(i);
  }
  let bosses = 0;
  let doors = 0;
  let bytes = 0;
  const roomsToModify = new Set();
  for (const bossRoom of CONVERT_BOSS_ROOMS) {
    roomsToModify.add(bossRoom);
    for (const nb of BOSS_ROOM_NEIGHBORS[bossRoom]) {
      roomsToModify.add(nb);
    }
  }
  for (const roomIndex of roomsToModify) {
    const ents = readRoomEntityList(data, roomIndex);
    const next = [];
    let changed = false;
    for (const e of ents) {
      if (e.type === 2 && BOSS_DOOR_SUBTYPES.has(e.subtype) && BOSS_DOOR_FLAGS.has(e.varB)) {
        doors++;
        changed = true;
        continue;
      }
      if (e.type === 1 && e.subtype >= 106 && e.subtype <= 112) {
        const nextEnt = {
          x: e.x, y: e.y, uid: e.uid, type: 1,
          subtype: smallPool[random.random_int(smallPool.length)],
          byte8: 0, varA: 0, varB: 0,
        };
        next.push(nextEnt);
        bosses++;
        changed = true;
        continue;
      }
      next.push({
        x: e.x, y: e.y, uid: e.uid, type: e.type, subtype: e.subtype,
        byte8: e.byte8, varA: e.varA, varB: e.varB,
      });
    }
    if (changed) {
      const r = rewriteRoomEntityList(data, roomIndex, next);
      bytes += r.bytes;
    }
  }
  return { bosses, doors, bytes };
}

/**
 * 混沌地图明亮：把混沌域（混沌地图所有房间）的调色板复制到空闲区并提亮，
 * 然后只把混沌房间的调色板页指针改指向提亮副本（其它区域共用同一调色板的房间不受影响）。
 * 调色板页格式：0x0400 + count(16) + count×32 字节颜色（16 色子调色板）。
 * 提亮：每个 5bit 通道 +8 并钳位到 31（BGR555）。
 * @param {Buffer} data
 * @returns {number} 被改指针的混沌房间数
 */
function lightChaos(data) {
  const isChaosRoom = (mx, my) => ((mx >= 128 && mx <= 141) || (mx >= 1 && mx <= 14)) && my >= 18 && my <= 22;
  const PALETTE_DATA_START = 0x080E0000;
  const PALETTE_DATA_END = 0x08100000;
  const brighten = (c) => {
    const r = Math.min(31, (c & 31) + 8);
    const g = Math.min(31, ((c >> 5) & 31) + 8);
    const b = Math.min(31, ((c >> 10) & 31) + 8);
    return r | (g << 5) | (b << 10);
  };
  // 已提亮副本缓存：原页指针 -> 新页指针（共用同一页的房间复用同一副本）
  const copies = new Map();
  let changedRooms = 0;
  for (let i = 0; i < ROOM_COUNT; i++) {
    const roomPtr = read32(data, ROOM_TABLE + i * 4);
    if ((roomPtr & 0xFF000000) !== 0x08000000) {
      continue;
    }
    const meta = roomPtr - 0x08000000;
    if (!isChaosRoom(data[meta + 34], data[meta + 35])) {
      continue;
    }
    const palList = read32(data, meta + 16);
    if (palList < 0x08000000 || palList > 0x09000000) {
      continue;
    }
    const po = palList - 0x08000000;
    let roomChanged = false;
    for (let k = 0; k < 4; k += 2) {
      const pagePtr = read32(data, po + k * 4);
      if (pagePtr < PALETTE_DATA_START || pagePtr >= PALETTE_DATA_END) {
        continue;
      }
      const pageOff = pagePtr - 0x08000000;
      if (read16(data, pageOff) !== 0x0400) {
        continue;
      }
      const count = read16(data, pageOff + 2);
      const pageLen = 4 + count * 32;
      let newPtr = copies.get(pagePtr);
      if (newPtr === undefined) {
        const newOff = allocFreeSpace(data, pageLen);
        data.copy(data, newOff, pageOff, pageOff + pageLen);
        for (let o = newOff + 4; o < newOff + pageLen; o += 2) {
          data.writeUInt16LE(brighten(read16(data, o)), o);
        }
        newPtr = 0x08000000 + newOff;
        copies.set(pagePtr, newPtr);
      }
      if (newPtr !== pagePtr) {
        data.writeUInt32LE(newPtr, po + k * 4);
        roomChanged = true;
      }
    }
    if (roomChanged) {
      changedRooms++;
    }
  }
  return changedRooms;
}

/**
 * 双混沌：在两个混沌房各追加一只混沌，放在原混沌右侧 48px，避免重叠。
 * 混沌是 Boss 类实体，varA/varB 沿用原实体的值，避免破坏战斗脚本。
 * @returns {number} 追加的房间数
 */
function doubleChaos(data) {
  let added = 0;
  for (const roomIndex of CHAOS_ROOM_INDEXES) {
    const ents = readRoomEntityList(data, roomIndex);
    const orig = ents.find(e => e.type === 1 && e.subtype === CHAOS_ID);
    if (!orig) {
      continue;
    }
    const second = {
      x: orig.x + 48,
      y: orig.y,
      type: 1,
      subtype: CHAOS_ID,
      byte8: orig.byte8,
      varA: orig.varA,
      varB: orig.varB,
    };
    relocateAndInject(data, roomIndex, [second]);
    added++;
  }
  return added;
}

/**
 * 时之试炼：在六个非最终 Boss 房与两个混沌房各追加 3 只时之法师（兔子 id 40），
 * 放在 Boss 右侧，让 Boss 战变成被时停兔子群骚扰的"时间试炼"。
 * 若该房 Boss 已被 enemy_boss_min 移除（房间已无 106-112 敌人实体）则跳过。
 * @returns {{rooms: number, added: number, bytes: number}}
 */
function chronomageTrial(data, random) {
  const trialRooms = CONVERT_BOSS_ROOMS.concat(CHAOS_ROOM_INDEXES);
  let rooms = 0;
  let added = 0;
  let bytes = 0;
  for (const roomIndex of trialRooms) {
    const ents = readRoomEntityList(data, roomIndex);
    const boss = ents.find(e => e.type === 1 && e.subtype >= 106 && e.subtype <= 112);
    if (!boss) {
      continue;
    }
    const extras = [];
    for (let i = 0; i < 3; i++) {
      extras.push({
        x: boss.x + 24 + i * 24,
        y: boss.y + 8,
        type: 1,
        subtype: CHRONOMAGE_ID,
        byte8: 0,
        varA: 0,
        varB: 0,
      });
    }
    const r = relocateAndInject(data, roomIndex, extras);
    rooms++;
    added += extras.length;
    bytes += r.bytes;
  }
  return { rooms, added, bytes };
}

/**
 * 读取原版 ROM 中某个房间门列表里指向指定目的地的门数据。
 * @param {Buffer} pristine - 未修改的 ROM 数据
 * @param {number} roomAddr - 房间元数据地址（ROM 地址）
 * @param {number} [dest] - 可选：只要 destination === dest 的那扇门
 * @returns {Object|null} { address, dest, destXOffset, destYOffset, destXPos, destYPos }
 */
function readPristineDoor(pristine, roomAddr, dest) {
  const meta = roomAddr - 0x08000000;
  const dl = read32(pristine, meta + 24);
  if (dl < 0x08000000 || dl > 0x09000000) {
    return null;
  }
  const base = dl - 0x08000000;
  for (let off = base; read32(pristine, off + 1) !== 0xFFFF1F; off += 16) {
    const d = read32(pristine, off);
    if (dest !== undefined && d !== dest) {
      continue;
    }
    return {
      address: dl + (off - base),
      dest: d,
      destXOffset: read16(pristine, off + 6),
      destYOffset: read16(pristine, off + 8),
      destXPos: read16(pristine, off + 10),
      destYPos: read16(pristine, off + 12),
    };
  }
  return null;
}

/**
 * 存档点快捷道路：每个存档房的门改接到城堡另一端的区域房，
 * 且该区域房的门反向接回该存档房，形成双向快捷通道。
 *
 * 配对规则：20 个存档房按方位角（相对城堡中心）排序后，i 与 i+10 配对，
 * 平均跨越约 122 格地图坐标，每个存档点都通向城堡远端。
 *
 * 实现要点：
 *   - 门地址在流水线中稳定（引擎不搬迁门列表），可直接按原版地址写入；
 *   - 落地位置（destXOffset/destYOffset/destXPos/destYPos）取自原版 ROM 原始字节，
 *     保证到达位置是各目标房已验证过的合法落点；
 *   - 只改写 destination 与落地字段，门的物理位置（xPos/yPos）不变。
 *
 * @param {Buffer} data - 工作缓冲区（可能已含其他随机化结果）
 * @returns {Object} { pairs, doors }
 */
function saveRoomShortcut(data) {
  const pristine = fs.readFileSync(ROM_PATH);
  const { areas } = cnAreas.getFreshAreas(pristine);
  const allRooms = areas.flatMap(a => a.rooms);

  // 收集每个存档房：其门(DS)、其区域房(A)、区域房里指向存档房的门(DA)
  const saves = allRooms
    .filter(r => r.isSaveRoom)
    .map(s => {
      const ds = readPristineDoor(pristine, s.address);
      if (!ds) {
        return null;
      }
      const area = allRooms.find(r => r.address === ds.dest);
      if (!area) {
        return null;
      }
      const da = readPristineDoor(pristine, area.address, s.address);
      if (!da) {
        return null;
      }
      return { s, area, ds, da };
    })
    .filter(Boolean);

  // 区域房必须唯一（每扇区域房门只能接一个存档房）
  const areaSeen = new Set();
  const dedup = saves.filter(rec => {
    if (areaSeen.has(rec.area.address)) {
      return false;
    }
    areaSeen.add(rec.area.address);
    return true;
  });
  const list = dedup;
  if (list.length < 2) {
    return { pairs: 0, doors: 0 };
  }

  // 按方位角排序（城堡中心为原点），i 与 i+10 配对
  const xs = allRooms.map(r => r.mapX);
  const ys = allRooms.map(r => r.mapY);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  list.sort((a, b) =>
    Math.atan2(a.s.mapY - cy, a.s.mapX - cx) - Math.atan2(b.s.mapY - cy, b.s.mapX - cx)
  );

  const n = list.length;
  const half = Math.floor(n / 2);

  const writeDoor = (door, dest, fields) => {
    const off = door.address - 0x08000000;
    data.writeUInt32LE(dest, off);
    data.writeUInt16LE(fields.destXOffset, off + 6);
    data.writeUInt16LE(fields.destYOffset, off + 8);
    data.writeUInt16LE(fields.destXPos, off + 10);
    data.writeUInt16LE(fields.destYPos, off + 12);
  };

  let doors = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + half) % n;
    const rec = list[i];
    const other = list[j];
    // 存档房 S_i 的门 → 区域房 A_j，落地位置 = 原版 S_j 进入 A_j 的落点
    writeDoor(rec.ds, other.area.address, other.ds);
    // 区域房 A_j 的门 → 存档房 S_i，落地位置 = 原版 A_i 进入 S_i 的落点
    writeDoor(other.da, rec.s.address, rec.da);
    doors += 2;
  }

  return { pairs: n, doors };
}

/**
 * 应用怪物位置随机相关的全部子选项。
 * @param {Buffer} data
 * @param {Object} params
 * @param {Random} random
 * @param {Object} [draculaSouls] - main_soul_random 随机出的三魂 {red, blue, yellow}，
 *   由 runRandomizer 先把 misc 跑完后传入；未开启时默认用原版古文书三魂
 */
function apply(data, params, random, draculaSouls) {
  const lines = [];
  const allIds = [];
  for (let i = 0; i < 113; i++) {
    allIds.push(i);
  }

  // 大类主开关：把每个怪物换成随机怪物
  if (params.random_enemy) {
    const n = randomizeEnemyIds(data, random, allIds);
    lines.push(`怪物种类随机 (${n} 个敌人)`);
  }

  // 特殊怪物加入小怪（默认 1/8 的怪物被替换）
  if (params.boss_enemy) {
    const n = injectEnemy(data, random, BOSS_IDS[random.random_int(BOSS_IDS.length)]);
    lines.push(`Boss 加入小怪 (${n} 处)`);
  }
  if (params.balore_enemy) {
    const n = injectEnemy(data, random, BALORE_ID);
    lines.push(`巴洛尔加入小怪 (${n} 处)`);
  }
  if (params.julius_enemy) {
    const n = injectEnemy(data, random, JULIUS_ID);
    lines.push(`尤利乌斯加入小怪 (${n} 处)`);
  }
  if (params.chaos_enemy) {
    const n = injectEnemy(data, random, CHAOS_ID);
    lines.push(`混沌加入小怪 (${n} 处)`);
  }
  if (params.magician_enemy) {
    const n = injectEnemy(data, random, CHRONOMAGE_ID);
    lines.push(`时之法师加入小怪 (${n} 处)`);
  }

  // 万物皆为怪：所有敌人全部换成完全随机敌人
  if (params.enemy_everything) {
    const n = randomizeEnemyIds(data, random, allIds);
    lines.push(`万物皆为怪 (${n} 个敌人全部随机)`);
  }

  // 双混沌：两个混沌房各追加一只混沌
  if (params.double_chaos) {
    const n = doubleChaos(data);
    lines.push(`挑战双混沌 (${n} 个房间追加混沌)`);
  }

  // 原 Boss 随机成小怪：换掉六个非最终 Boss 并删除对应 Boss 门
  if (params.enemy_boss_min) {
    const r = enemyBossMin(data, random);
    lines.push(`原 Boss 随机成小怪 (${r.bosses} 只 Boss 替换，删除 ${r.doors} 扇 Boss 门，搬迁 ${r.bytes} 字节)`);
  }

  // 混沌地图明亮：提亮混沌域房间的调色板（复制+改指针）
  if (params.light_chaos) {
    const n = lightChaos(data);
    lines.push(`混沌地图明亮 (${n} 个混沌房间调色板提亮)`);
  }

  // 时之试炼：Boss/混沌房追加时之法师（兔子）群
  if (params.magician_secret) {
    const r = chronomageTrial(data, random);
    lines.push(`时之试炼 (${r.added} 只时之法师加入 ${r.rooms} 个 Boss/混沌房)`);
  }

  // 存档点快捷道路：存档房 ↔ 城堡远端区域房 双向配对
  if (params.shortcut) {
    const r = saveRoomShortcut(data);
    lines.push(`存档点快捷道路 (${r.pairs} 个存档点接入双向快捷通道，改写 ${r.doors} 扇门)`);
  }

  // 魂灯：把部分物品拾取点变成随机魂烛
  if (params.random_item_soul) {
    const n = addSoulLights(data, random);
    lines.push(`加入魂灯 (${n} 处改为魂烛)`);
  }

  // 开局赠品：完全复刻参考 ROM 的生成方式——原地替换起始房间（房间 0）实体列表
  // 中 uid3/5/6/7（原为 4 个 type2 sub15 占位实体），不搬迁、零代码补丁。
  // 魂烛复用原版 sub6/7/8 与原版 flag(3/7/8)，三烛位于出生点下方一行 (y=656)，
  // 与参考 ROM 逐字节一致；玩家开局攻击烛体即掉魂球并自动吸收。
  const GIFT_RING = { uid: 3, x: 160, y: 640, type: ITEM_ENTITY_TYPE, subtype: 4, byte8: 0, varA: 76, varB: 44 }; // 混沌戒指
  const GIFT_SOULS = [
    { uid: 5, x: 352, y: 656, type: ITEM_ENTITY_TYPE, subtype: 8, byte8: 0, varA: 3, varB: 3 }, // Ability=Malphas
    { uid: 6, x: 384, y: 656, type: ITEM_ENTITY_TYPE, subtype: 7, byte8: 0, varA: 7, varB: 2 }, // 黄=Skula
    { uid: 7, x: 416, y: 656, type: ITEM_ENTITY_TYPE, subtype: 6, byte8: 0, varA: 8, varB: 2 }, // 蓝=Giant Bat
  ];
  const giftReplacements = [];
  if (params.ringchaos) {
    giftReplacements.push(GIFT_RING);
    lines.push('开局赠送混沌戒指');
  }
  if (params.soul_start) {
    giftReplacements.push(...GIFT_SOULS);
    lines.push('开局赠送剧情三魂 (Malphas/Skula/Giant Bat)');
  }
  if (params.mainsoul) {
    // 古文书三魂：默认红44/蓝2/黄7；main_soul_random 开启时用随机出的三魂
    const s = draculaSouls || { red: { id: 44 }, blue: { id: 2 }, yellow: { id: 7 } };
    giftReplacements.push(
      { uid: 5, x: 352, y: 656, type: ITEM_ENTITY_TYPE, subtype: 5, byte8: 0, varA: 3, varB: s.red.id },   // 红=Flame Demon
      { uid: 6, x: 384, y: 656, type: ITEM_ENTITY_TYPE, subtype: 6, byte8: 0, varA: 7, varB: s.blue.id },  // 蓝=Giant Bat
      { uid: 7, x: 416, y: 656, type: ITEM_ENTITY_TYPE, subtype: 7, byte8: 0, varA: 8, varB: s.yellow.id }, // 黄=Succubus
    );
    lines.push('开局赠送古文书三魂 (红/蓝/黄)');
  }
  if (giftReplacements.length > 0) {
    const n = replaceStartRoomEntities(data, giftReplacements);
    lines.push(`起始房间原地替换 ${n} 个实体 (复刻参考 ROM，无搬迁无补丁)`);
  }
  // 开局装备：type 5 物品实体，subtype 3=武器/4=防具饰品，varB=Equipment id
  const extras = [];
  if (params.start_weapon) {
    const id = Number(params.start_weapon);
    if (id > 0) {
      extras.push({
        x: 16 + extras.length * 32, y: 16, type: ITEM_ENTITY_TYPE, subtype: 3, varB: id,
      });
      lines.push(`开局获得武器 ${id}`);
    }
  }
  if (params.start_armor) {
    const id = Number(params.start_armor);
    if (id > 0) {
      extras.push({
        x: 16 + extras.length * 32, y: 16, type: ITEM_ENTITY_TYPE, subtype: 4, varB: id,
      });
      lines.push(`开局获得防具 ${id}`);
    }
  }
  if (params.start_accessory) {
    const id = Number(params.start_accessory);
    if (id > 0) {
      extras.push({
        x: 16 + extras.length * 32, y: 16, type: ITEM_ENTITY_TYPE, subtype: 4, varB: id,
      });
      lines.push(`开局获得饰品 ${id}`);
    }
  }
  if (extras.length > 0) {
    const bytes = relocateAndInjectStartRoom(data, extras);
    lines.push(`起始房间实体列表搬迁到空闲区 (${bytes} 字节)`);
  }

  return {
    summary: lines.join('\n'),
  };
}

module.exports = {
  ROOM_TABLE,
  ROOM_COUNT,
  BOSS_IDS,
  CHRONOMAGE_ID,
  FREE_SPACE_ADDR,
  forEachEntity,
  readRoomEntityList,
  roomEntityListLength,
  collectUsedFlags,
  relocateAndInject,
  relocateAndInjectStartRoom,
  doubleChaos,
  enemyBossMin,
  chronomageTrial,
  saveRoomShortcut,
  lightChaos,
  apply,
};
