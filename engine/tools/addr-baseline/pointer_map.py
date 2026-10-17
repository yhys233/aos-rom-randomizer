#!/usr/bin/env python3
"""AoS CN ROM 地址信息基准 v1：指针图谱

扫描整个 ROM，把所有落在已知地址空间内的 4 字节值收集成表：
  - 0x08000000-0x08FFFFFF  ROM (代码/数据)
  - 0x02000000-0x02FFFFFF  EWRAM
  - 0x03000000-0x03FFFFFF  IWRAM
  - 0x04000000-0x04FFFFFF  IO
  - 0x0E000000-0x0EFFFFFF  SRAM/Flash
输出每处引用位置（文件偏移+地址）+ 指向的目标地址，按目标聚合。
"""
import sys
from collections import defaultdict

ROM = "/home/Yhys/aos-rom-randomizer/engine/rom/emcxyywq.gba"
data = open(ROM, "rb").read()
BASE = 0x08000000

def addr(off):
    return BASE + off

# 目标地址空间
def space(v):
    if 0x08000000 <= v <= 0x08FFFFFF:
        return "rom"
    if 0x02000000 <= v <= 0x02FFFFFF:
        return "ewram"
    if 0x03000000 <= v <= 0x03FFFFFF:
        return "iwram"
    if 0x04000000 <= v <= 0x04FFFFFF:
        return "io"
    if 0x0E000000 <= v <= 0x0FFFFFFF:
        return "sram"
    return None

# refs: target -> list of (ref_off, ref_addr)
refs = defaultdict(list)
for off in range(0, len(data) - 3):
    v = int.from_bytes(data[off:off+4], "little")
    sp = space(v)
    if sp is None:
        continue
    refs[v].append(off)

def emit(target_hex, label=""):
    v = int(target_hex, 16)
    locs = refs.get(v, [])
    print(f"## 目标 {target_hex} ({label})  引用 {len(locs)} 处")
    for off in locs[:40]:
        print(f"    0x{addr(off):08X} (文件 0x{off:06X})")
    if len(locs) > 40:
        print(f"    ... 其余 {len(locs)-40} 处省略")
    print()

def main():
    which = sys.argv[1] if len(sys.argv) > 1 else ""
    if which == "all":
        # 全量：按目标地址排序打印（仅 ROM 目标，且出现次数>=2）
        rom_targets = sorted((v for v in refs if 0x08000000 <= v <= 0x08FFFFFF), key=lambda x: x)
        print(f"== 指向 ROM 的目标值 {len(rom_targets)} 个 ==")
        for v in rom_targets:
            locs = refs[v]
            if len(locs) < 2:
                continue
            print(f"0x{v:08X}  <- {len(locs)} 处: " + ", ".join(f"0x{addr(o):08X}" for o in locs[:12]))
        return
    # 默认：打印重点表
    emit("080E6E50", "敌人数据表基址 (exp/魂/掉落)")
    emit("084E52AC", "房间指针表基址")
    emit("084E589C", "房间0 header")
    emit("084E591C", "房间1 header")
    emit("084E5808", "房间表全局指针槽")

if __name__ == "__main__":
    main()
