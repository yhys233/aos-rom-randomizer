const fs = require('fs');

const AoSParsingUtils = require('../vendor/processing/AoSParsingUtils');
const getFreshNAAreas = require('../vendor/progression/Areas');

const {
  parseRoom,
} = AoSParsingUtils;

// Room pointer table for the Chinese translation ROM (verified against emcxyywq.gba)
const ROOM_TABLE_OFFSET = 0x4E52AC;
const ROOM_TABLE_COUNT = 355;

function readData(data, address, size) {
  const out = Buffer.alloc(size);
  data.copy(out, 0, address, address + size);
  return out;
}

function readDataNumber(data, address, size) {
  let out = 0;
  for (let i = size - 1; i >= 0; i--) {
    out = out * 0x100 + data[address + i];
  }
  return out;
}

function parseCNRooms(data) {
  const rooms = [];
  for (let i = 0; i < ROOM_TABLE_COUNT; i++) {
    const p = readDataNumber(data, ROOM_TABLE_OFFSET + i * 4, 4);
    if ((p & 0xFF000000) !== 0x08000000) {
      continue;
    }
    try {
      rooms.push(parseRoom(data, p));
    } catch (e) {
      // ignore unparseable rooms
    }
  }

  // Second pass: populate door complements now that we know all doors
  const allDoors = [];
  rooms.forEach(room => {
    room.doors.forEach(door => {
      allDoors.push({
        address: door.address,
        sourceRoom: door.sourceRoom,
        destination: door.destination,
      });
    });
  });

  const complemented = rooms.map(room => parseRoom(data, room.address, allDoors));
  return complemented;
}

/**
 * Returns a fresh list of areas with all room/door/entity addresses mapped to the
 * Chinese translation ROM, while keeping the (NA) access logic data intact.
 */
function getFreshAreas(data) {
  const cnRooms = parseCNRooms(data);

  const coordMap = new Map();
  cnRooms.forEach(room => {
    const key = `${room.mapX},${room.mapY}`;
    if (!coordMap.has(key)) {
      coordMap.set(key, []);
    }
    coordMap.get(key).push(room);
  });

  const naAreas = getFreshNAAreas();

  // Map every NA (US-ROM) real door address to its Chinese-ROM counterpart using
  // the same coordinate + door-index pairing used below. The NA door data carries
  // hand-curated complement/complement2 addresses; the CN parser can only derive
  // them computationally (producing arrays or empty values for ambiguous/one-way
  // doors), so we translate the NA complements instead. The -4 sentinel
  // (UNMATCHED_GARDEN_DOOR) is preserved as-is since the updater special-cases it.
  const naDoorToCN = new Map();
  naAreas.forEach(naArea => naArea.rooms.forEach(naRoom => {
    const key = `${naRoom.mapX},${naRoom.mapY}`;
    const candidates = (coordMap.get(key) || []).filter(c => c.doors.length >= naRoom.doors.filter(d => !d.isFakeDoor).length);
    const cnRoom = candidates[0];
    if (!cnRoom) {
      return;
    }
    const realNADoors = naRoom.doors.filter(d => !d.isFakeDoor);
    realNADoors.forEach((naDoor, i) => {
      if (cnRoom.doors[i]) {
        naDoorToCN.set(naDoor.address, cnRoom.doors[i].address);
      }
    });
  }));

  const translateComplement = (naComplement, cnComplement) => {
    if (naComplement === undefined || naComplement === -4) {
      return naComplement === undefined ? cnComplement : -4;
    }
    return naDoorToCN.get(naComplement) ?? cnComplement;
  };

  // Map NA room addresses to their CN counterparts (by coordinate). Fake doors
  // keep their NA sourceRoom/destination which the solvability walk resolves
  // against the CN room set, so they need to be translated too.
  const naRoomToCN = new Map();
  naAreas.forEach(naArea => naArea.rooms.forEach(naRoom => {
    const key = `${naRoom.mapX},${naRoom.mapY}`;
    const candidates = (coordMap.get(key) || []).filter(c => c.doors.length >= naRoom.doors.filter(d => !d.isFakeDoor).length);
    const cnRoom = candidates[0];
    if (cnRoom) {
      naRoomToCN.set(naRoom.address, cnRoom.address);
    }
  }));

  const stats = {
    total: 0,
    matched: 0,
    unmatched: [],
  };

  const newAreas = naAreas.map((naArea, areaIdx) => {
    const rooms = naArea.rooms.map((naRoom, roomIdx) => {
      stats.total++;
      const key = `${naRoom.mapX},${naRoom.mapY}`;
      const candidates = (coordMap.get(key) || []).filter(c => c.doors.length >= naRoom.doors.filter(d => !d.isFakeDoor).length);
      const cnRoom = candidates[0] || (coordMap.get(key) || [])[0];

      if (!cnRoom) {
        stats.unmatched.push(`${naArea.area} room ${roomIdx} (${key})`);
        return naRoom;
      }
      stats.matched++;

      const fakeDoorCount = naRoom.doors.filter(d => d.isFakeDoor).length;
      const realNADoors = naRoom.doors.filter(d => !d.isFakeDoor);

      const doors = realNADoors.map((naDoor, i) => {
        const cnDoor = cnRoom.doors[i];
        if (!cnDoor) {
          return naDoor;
        }
        return {
          ...naDoor,
          address: cnDoor.address,
          destination: cnDoor.destination,
          sourceRoom: cnRoom.address,
          complement: translateComplement(naDoor.complement, cnDoor.complement),
          complement2: translateComplement(naDoor.complement2, cnDoor.complement2),
        };
      });

      // Keep NA fake doors (isFakeDoor, address -3/-1 etc.) as-is. They are
      // excluded from shuffling and their writes are no-ops. Their room
      // references are translated so the solvability walk can resolve them.
      const fakeDoors = naRoom.doors.filter(d => d.isFakeDoor).map(d => ({
        ...d,
        destination: naRoomToCN.get(d.destination) || d.destination,
        sourceRoom: naRoomToCN.get(d.sourceRoom) || d.sourceRoom,
      }));
      if (fakeDoors.length !== fakeDoorCount) {
        stats.unmatched.push(`fake door mismatch in ${naArea.area} room ${roomIdx} (${key})`);
      }

      return {
        ...naRoom,
        _area: areaIdx,
        _room: roomIdx,
        address: cnRoom.address,
        mapX: cnRoom.mapX,
        mapY: cnRoom.mapY,
        mapWidth: cnRoom.mapWidth,
        mapHeight: cnRoom.mapHeight,
        doorList: cnRoom.doorList,
        doors: doors.concat(fakeDoors),
        items: cnRoom.items.map((cnItem, i) => {
          const naItem = naRoom.items[i];
          return {
            ...(naItem || {}),
            address: cnItem.address,
            xPos: cnItem.xPos,
            yPos: cnItem.yPos,
            uniqueId: cnItem.uniqueId,
            type: cnItem.type,
            subtype: cnItem.subtype,
            instaload: cnItem.instaload,
            varA: cnItem.varA,
            varB: cnItem.varB,
            isHardMode: cnItem.isHardMode,
            // NA 的 flag 指向 NA 实体文件偏移+5，必须按 CN 实体地址重算，
            // 否则 writeItem 会把物品数据写进 NA 偏移区域损坏 ROM。
            flag: cnItem.address - 0x08000000 + 5,
          };
        }),
      };
    });
    return {
      ...naArea,
      rooms,
    };
  });

  return {
    areas: newAreas,
    stats,
  };
}

module.exports = {
  getFreshAreas,
  ROOM_TABLE_OFFSET,
  ROOM_TABLE_COUNT,
  readDataNumber,
};
