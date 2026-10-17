const FirstDraft = require('./FirstDraftEntranceShuffle');

// 全城堡跨区洗牌：把整个城堡当作一个“区域”运行 FirstDraft 贪心算法，
// 所有房间（含跨区域过渡门）一起参与，区域边界被打破。
// 保留逻辑关键房间（Graham/Julius/Chaos 等）与逻辑关键门的连接不变。
function GlobalEntranceShuffle(areas, random, startingRoom, keepFlags) {
  const allRooms = areas.flatMap(area => area.rooms);

  // Garden 单向门修复所需的反向门（与 FirstDraft 相同）
  const gardenPartnerDoor = allRooms
    .flatMap(room => room.doors)
    .find(door => door.address === 0x084EDF20);

  // getRealRooms 会过滤 isWeirdChaoticRealmRoomDoNotModify 与 ROOMS_TO_SKIP_RANDOMIZATION，
  // doorsToSkip 保留 Graham/Julius/Chaos 等逻辑关键门不参与。
  let rooms = FirstDraft.getRealRooms(allRooms);
  let doorsToSkip = FirstDraft.DOORS_TO_SKIP.slice();

  // random_map_no_*：受保护区域（混沌区等）整体保持原样，不参与洗牌
  if (keepFlags) {
    const protected = FirstDraft.getProtectedRegions(areas, keepFlags);
    const protectedAddrs = new Set(protected.rooms.map(room => room.address));
    rooms = rooms.filter(room => !protectedAddrs.has(room.address));
    doorsToSkip = doorsToSkip.concat(protected.doors);
  }

  return FirstDraft.randomizeRoomList(rooms, random, doorsToSkip, gardenPartnerDoor);
}

GlobalEntranceShuffle.displayName = 'Global Entrance Shuffle';
GlobalEntranceShuffle.desc = 'Shuffles every door in the castle at once, across area boundaries. '
  + 'Keeps the connections around Graham, Julius, and Chaos intact for logic.';

module.exports = GlobalEntranceShuffle;
