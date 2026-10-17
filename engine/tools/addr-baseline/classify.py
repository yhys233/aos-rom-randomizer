#!/usr/bin/env python3
"""对 all_funcs.txt 每个函数块，统计它读/写了 DNA 表哪些字段偏移(+0x08~+0x23)。"""
import re, sys

blocks = {}
cur = None
for line in open("/tmp/opencode/aos_baseline/all_funcs.txt"):
    m = re.match(r"^===== 函数起点 (0x[0-9A-F]+) \(ldr@([0-9A-F]+)\) =====", line)
    if m:
        cur = m.group(2)
        blocks[cur] = {"reads": set(), "writes": set()}
        continue
    if cur is None:
        continue
    m = re.match(r"\s*0x[0-9A-F]+: (ldr[bhs]?|ldrsh|ldrsb|str[bh]?)\s+r[0-7],\s*\[r[0-7],\s*#0x([0-9A-Fa-f]+)\]", line)
    if m:
        op, off = m.group(1), int(m.group(2), 16)
        tgt = "writes" if op.startswith("str") else "reads"
        blocks[cur][tgt].add(off)

fields = {0x08: "item1", 0x0a: "item2", 0x0c: "?c", 0x0e: "?e",
          0x10: "EXP", 0x12: "SoulRarity", 0x14: "?14", 0x15: "Item1R", 0x16: "Item2R",
          0x17: "SoulType", 0x18: "Soul", 0x19: "Atk?", 0x1a: "flaga", 0x1c: "flagb", 0x1e: "pos?x",
          0x20: "pos?y", 0x22: "?22"}
def fmt(offs):
    out = []
    for o in sorted(offs):
        out.append(f"+{o:02x}={fields.get(o, '?')}")
    return " ".join(out)

for ldr in sorted(blocks, key=lambda a: int(a,16)):
    r = blocks[ldr]["reads"]; w = blocks[ldr]["writes"]
    print(f"0x{ldr}: R[{fmt(r)}]  W[{fmt(w)}]")
