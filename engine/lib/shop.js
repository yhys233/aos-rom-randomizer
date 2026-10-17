'use strict';

/**
 * 商店物品随机（CN/日版地址实证确认）。
 * ShopIndex 表：0x4FD2EC，130 条 × 4 字节（item_type, item_index, 0, 0）。
 *   type 2 = 消耗品，3 = 武器，4 = 防具/饰品。
 * 商店列表（hammer1/2/3）引用 ShopIndex 条目，保持不动；只重填表内物品。
 * 地址来源：refs/aos_rando/tables/tables_list_jp.txt
 */

const {
  CONSUMABLE_TABLE,
  CONSUMABLE_COUNT,
  WEAPON_TABLE,
  WEAPON_COUNT,
  ARMOR_TABLE,
  ARMOR_COUNT,
  ACCESSORY_TABLE,
  ACCESSORY_COUNT,
} = require('./itemTables');

const SHOP_INDEX_TABLE = 0x4FD2EC;
const SHOP_INDEX_COUNT = 130;
const SHOP_INDEX_SIZE = 4;

function read16(data, off) {
  return data[off] | (data[off + 1] << 8);
}

function read32(data, off) {
  return data[off] | (data[off + 1] << 8) | (data[off + 2] << 16) | (data[off + 3] << 24);
}

function write8(data, off, value) {
  data[off] = value & 0xFF;
}

/**
 * 解析商店索引表。
 * @returns {Array<{type:number, index:number, offset:number}>}
 */
function parseShopIndex(data) {
  const entries = [];
  for (let i = 0; i < SHOP_INDEX_COUNT; i++) {
    const off = SHOP_INDEX_TABLE + i * SHOP_INDEX_SIZE;
    entries.push({
      type: data[off],
      index: data[off + 1],
      offset: off,
    });
  }
  return entries;
}

/** 构建每个 item_type 的候选物品池（价格>0 的代码）。 */
function buildPools(data) {
  const pools = { 2: [], 3: [], 4: [] };

  for (let i = 0; i < CONSUMABLE_COUNT; i++) {
    const off = CONSUMABLE_TABLE + i * 16;
    const code = read16(data, off);
    const price = read32(data, off + 4);
    if (price > 0) {
      pools[2].push(code);
    }
  }

  for (let i = 0; i < WEAPON_COUNT; i++) {
    const off = WEAPON_TABLE + i * 28;
    const code = read16(data, off);
    const price = read32(data, off + 4);
    if (price > 0) {
      pools[3].push(code);
    }
  }

  for (let i = 0; i < ARMOR_COUNT; i++) {
    const off = ARMOR_TABLE + i * 20;
    const code = read16(data, off);
    const price = read32(data, off + 4);
    if (price > 0) {
      pools[4].push(code);
    }
  }

  for (let i = 0; i < ACCESSORY_COUNT; i++) {
    const off = ACCESSORY_TABLE + i * 20;
    const code = read16(data, off);
    const price = read32(data, off + 4);
    if (price > 0) {
      pools[4].push(code);
    }
  }

  return pools;
}

/**
 * 随机化商店物品。
 * @param {Buffer} data
 * @param {Random} random
 */
function randomizeShop(data, random) {
  const entries = parseShopIndex(data);
  const pools = buildPools(data);

  const assigned = { 2: 0, 3: 0, 4: 0 };
  for (const type of [2, 3, 4]) {
    const pool = pools[type];
    if (!pool.length) {
      continue;
    }
    const shuffled = random.shuffle(pool);
    const typeEntries = entries.filter(e => e.type === type);
    typeEntries.forEach((entry, i) => {
      write8(data, entry.offset + 1, shuffled[i % shuffled.length]);
      assigned[type]++;
    });
  }

  return assigned;
}

/**
 * 商店随机入口。params.random_shop 或 random_type 为 3 时启用。
 */
function apply(data, params, random) {
  const enabled = params.random_shop || params.random_type === 3;
  if (!enabled) {
    return { summary: '', changed: false };
  }
  const assigned = randomizeShop(data, random);
  const total = assigned[2] + assigned[3] + assigned[4];
  return {
    summary: `商店物品随机（消耗品${assigned[2]} 武器${assigned[3]} 防具/饰品${assigned[4]}，共${total}）`,
    changed: total > 0,
  };
}

module.exports = {
  SHOP_INDEX_TABLE,
  parseShopIndex,
  buildPools,
  randomizeShop,
  apply,
};
