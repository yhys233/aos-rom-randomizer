#!/usr/bin/env python3
"""AoS ROM 地址基准 v2：全 ROM PC-relative 字面量加载图谱。

- Thumb: 半字 `0100 1RRR IIII IIII` = ldr rX,[pc,#imm8*4]，target=(pc+4)&~3 + imm8*4
- ARM:   字   `1110 1001 1111 RRRR imm12` = ldr rX,[pc,#imm12]，target=pc+8+imm12
输出 map: pool字值(小端) -> 加载点列表。用于定位每个表指针被哪些函数加载。
"""
import sys
from collections import defaultdict

ROM = "/home/Yhys/aos-rom-randomizer/engine/rom/emcxyywq.gba"
BASE = 0x08000000
data = open(ROM, "rb").read()

def resolve(pool_addr):
    return int.from_bytes(data[pool_addr-BASE:pool_addr-BASE+4], "little")

# target_word -> list of (ldr_addr, reg, mode)
sites = defaultdict(list)
pool_of = {}

# --- Thumb scan (all even offsets) ---
for o in range(0, len(data)-3, 2):
    hw = data[o] | (data[o+1] << 8)
    if (hw >> 11) == 0b01001:  # ldr literal
        rn = (hw >> 8) & 7
        imm8 = hw & 0xFF
        ldr_addr = BASE + o
        target = ((ldr_addr + 4) & ~3) + (imm8 << 2)
        t_off = target - BASE
        if 0 <= t_off <= len(data)-4:
            word = resolve(target)
            sites[word].append((ldr_addr, rn, "t"))
            pool_of[ldr_addr] = target

# --- ARM scan (aligned 4) ---
for o in range(0, len(data)-3, 4):
    w = int.from_bytes(data[o:o+4], "little")
    if (w >> 24) == 0xE5 and ((w >> 16) & 0xF) == 0xF and ((w >> 20) & 0xF) == 0b0001:
        # e5 1? 1f?? wait: bits: cond=E5, then 0001 (LDR), Rn=1111(pc)
        rn = (w >> 12) & 0xF
        imm12 = w & 0xFFF
        ldr_addr = BASE + o
        target = ldr_addr + 8 + imm12
        t_off = target - BASE
        if 0 <= t_off <= len(data)-4:
            word = resolve(target)
            sites[word].append((ldr_addr, rn, "a"))
            pool_of[ldr_addr] = target

def show(target_hex, label=""):
    v = int(target_hex, 16)
    locs = sites.get(v, [])
    print(f"== 表 {target_hex} ({label}) 被 {len(locs)} 条 LDR 指令加载 ==")
    for a, rn, mode in sorted(locs):
        print(f"    0x{a:08X} ({mode} r{rn})  <- 池字 0x{pool_of[a]:08X}")
    print()

if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else ""
    if which == "count":
        cnt = defaultdict(int)
        for w, locs in sites.items():
            if 0x08000000 <= w <= 0x08FFFFFF:
                cnt[hex(w)] = len(locs)
        for w in sorted(cnt, key=lambda x: cnt[x], reverse=True):
            print(f"0x{w} <- {cnt[w]}")
        sys.exit(0)
    show("080E6E50", "敌人表")
    show("084E52AC", "房间表")
    show("084E589C", "房间0")
    show("084E591C", "房间1")
