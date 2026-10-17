// Verified table locations on the Chinese translation ROM (emcxyywq.gba):
//   weapons     0x4D1F48, 59 entries (itemId 32-90),  28 bytes each
//   armor       0x4D25BC, 25 entries (itemId 91-115), 20 bytes each
//   accessories 0x4D27B0, 20 entries (itemId 116-135), 20 bytes each
//   consumables 0x4D1D48, 32 entries (itemId 0-31),   16 bytes each
//   red souls   0xDFAF0,  55 entries (soulId 1-55),   16 bytes each

const WEAPON_TABLE = 0x4D1F48;
const WEAPON_COUNT = 59;
const WEAPON_SIZE = 28;

const ARMOR_TABLE = 0x4D25BC;
const ARMOR_COUNT = 25;
const ARMOR_SIZE = 20;

const ACCESSORY_TABLE = 0x4D27B0;
const ACCESSORY_COUNT = 20;
const ACCESSORY_SIZE = 20;

const CONSUMABLE_TABLE = 0x4D1D48;
const CONSUMABLE_COUNT = 32;
const CONSUMABLE_SIZE = 16;

const RED_SOUL_TABLE = 0xDFAF0;
const RED_SOUL_COUNT = 55;
const RED_SOUL_SIZE = 16;

const WEAPON_ATK_OFFSET = 10;
const WEAPON_ELEMENT_OFFSET = 16;
const ARMOR_DEF_OFFSET = 11;
const RED_SOUL_ATK_OFFSET = 10;
const RED_SOUL_ELEMENT_OFFSET = 12;

function read16(data, off) {
  return data[off] | (data[off + 1] << 8);
}

function write16(data, off, value) {
  data[off] = value & 0xFF;
  data[off + 1] = (value >> 8) & 0xFF;
}

function shuffleValues(data, base, count, size, offset, random) {
  const values = [];
  for (let i = 0; i < count; i++) {
    values.push(read16(data, base + i * size + offset));
  }
  const shuffled = random.shuffle(values);
  for (let i = 0; i < count; i++) {
    write16(data, base + i * size + offset, shuffled[i]);
  }
  return values;
}

/**
 * 把某个 16bit 字段批量重写为 [min, max] 内的随机值（自由度扩展的 *_min/*_max）。
 */
function rerangeValues(data, base, count, size, offset, random, min, max) {
  let changed = 0;
  for (let i = 0; i < count; i++) {
    const off = base + i * size + offset;
    const next = min + random.random_int(max - min + 1);
    if (next !== read16(data, off)) {
      write16(data, off, next);
      changed++;
    }
  }
  return changed;
}

/**
 * Shuffles weapon ATK values amongst all weapons.
 */
function randomizeWeaponAtk(data, random) {
  return shuffleValues(data, WEAPON_TABLE, WEAPON_COUNT, WEAPON_SIZE, WEAPON_ATK_OFFSET, random);
}

/**
 * Shuffles armor DEF values amongst all armor.
 */
function randomizeArmorDef(data, random) {
  return shuffleValues(data, ARMOR_TABLE, ARMOR_COUNT, ARMOR_SIZE, ARMOR_DEF_OFFSET, random);
}

/**
 * Shuffles weapon element attributes amongst all weapons.
 */
function randomizeWeaponAttr(data, random) {
  return shuffleValues(data, WEAPON_TABLE, WEAPON_COUNT, WEAPON_SIZE, WEAPON_ELEMENT_OFFSET, random);
}

/**
 * Shuffles red soul ATK values amongst all red souls.
 */
function randomizeRedSoulAtk(data, random) {
  return shuffleValues(data, RED_SOUL_TABLE, RED_SOUL_COUNT, RED_SOUL_SIZE, RED_SOUL_ATK_OFFSET, random);
}

/**
 * Shuffles red soul element attributes amongst all red souls.
 */
function randomizeRedSoulAttr(data, random) {
  return shuffleValues(data, RED_SOUL_TABLE, RED_SOUL_COUNT, RED_SOUL_SIZE, RED_SOUL_ELEMENT_OFFSET, random);
}

/**
 * Master function: applies all enabled item/weapon/soul stat options.
 */
function apply(data, params, random) {
  const changes = [];

  const weaponAtkMin = Number(params.weapon_atk_min);
  const weaponAtkMax = Number(params.weapon_atk_max);
  const useWeaponRange = weaponAtkMin > 0 && weaponAtkMax >= weaponAtkMin;
  if (params.random_item_stats_atk) {
    if (useWeaponRange) {
      const n = rerangeValues(data, WEAPON_TABLE, WEAPON_COUNT, WEAPON_SIZE, WEAPON_ATK_OFFSET, random, weaponAtkMin, weaponAtkMax);
      changes.push(`武器攻击随机 ${weaponAtkMin}~${weaponAtkMax} (${n} 件)`);
    } else {
      randomizeWeaponAtk(data, random);
      changes.push('武器攻击力随机');
    }
  }
  if (params.random_item_stats_def) {
    const armorDefMin = Number(params.armor_def_min);
    const armorDefMax = Number(params.armor_def_max);
    if (armorDefMin > 0 && armorDefMax >= armorDefMin) {
      const n = rerangeValues(data, ARMOR_TABLE, ARMOR_COUNT, ARMOR_SIZE, ARMOR_DEF_OFFSET, random, armorDefMin, armorDefMax);
      changes.push(`防具防御随机 ${armorDefMin}~${armorDefMax} (${n} 件)`);
    } else {
      randomizeArmorDef(data, random);
      changes.push('防具防御力随机');
    }
  }
  if (params.attr_weapon) {
    randomizeWeaponAttr(data, random);
    changes.push('武器属性随机');
  }
  if (params.random_soul_stats_red) {
    const soulAtkMin = Number(params.soul_atk_min);
    const soulAtkMax = Number(params.soul_atk_max);
    if (soulAtkMin > 0 && soulAtkMax >= soulAtkMin) {
      const n = rerangeValues(data, RED_SOUL_TABLE, RED_SOUL_COUNT, RED_SOUL_SIZE, RED_SOUL_ATK_OFFSET, random, soulAtkMin, soulAtkMax);
      changes.push(`红魂攻击随机 ${soulAtkMin}~${soulAtkMax} (${n} 个)`);
    } else {
      randomizeRedSoulAtk(data, random);
      changes.push('红魂攻击力随机');
    }
  }
  if (params.attr_soul_red) {
    randomizeRedSoulAttr(data, random);
    changes.push('红魂属性随机');
  }
  return {
    summary: changes.join('\n'),
  };
}

module.exports = {
  WEAPON_TABLE,
  WEAPON_COUNT,
  ARMOR_TABLE,
  ARMOR_COUNT,
  ACCESSORY_TABLE,
  ACCESSORY_COUNT,
  CONSUMABLE_TABLE,
  CONSUMABLE_COUNT,
  RED_SOUL_TABLE,
  RED_SOUL_COUNT,
  randomizeWeaponAtk,
  randomizeArmorDef,
  randomizeWeaponAttr,
  randomizeRedSoulAtk,
  randomizeRedSoulAttr,
  rerangeValues,
  apply,
};
