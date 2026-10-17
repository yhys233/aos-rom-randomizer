#!/usr/bin/env python3
"""AoS 函数定位 + 反汇编：给定 ldr 字面量加载地址，回找函数起点并打印整个函数。

函数起点启发式：从 ldr 地址往回每 2 字节试一次，从候选点向前 Thumb 解码，
要求：解码无异常、恰好覆盖到 ldr 指令、且窗口内以 push(0xb4/0xb5) 开头或
前一函数以 bx/pop 收尾。取最近的合法起点。
"""
import sys
from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB

ROM = "/home/Yhys/aos-rom-randomizer/engine/rom/emcxyywq.gba"
BASE = 0x08000000
data = open(ROM, "rb").read()

md = Cs(CS_ARCH_ARM, CS_MODE_THUMB)
md.detail = True

def decode_ok(start_off, end_off):
    """返回 (ok, [insn])：Thumb 解码区间，无 32 位前缀非法即 ok"""
    code = data[start_off:end_off]
    if not code:
        return False, []
    ins = []
    try:
        for i in md.disasm(code, BASE + start_off):
            ins.append(i)
    except Exception:
        return False, []
    return True, ins

def find_func(ldr_off, max_back=0x800):
    ldr_addr = BASE + ldr_off
    for back in range(2, max_back, 2):
        c = ldr_off - back
        if c < 0:
            break
        if c % 2 != 0:
            continue
        ok, ins = decode_ok(c, ldr_off + 0x10)
        if not ok:
            continue
        # 必须覆盖 ldr 指令地址
        addrs = [i.address for i in ins]
        if ldr_addr not in addrs:
            continue
        # 函数起点偏好：以 push 开头（0xb4*/0xb5*）或前面是 0x47 (bx)/0xbd (pop) 填充
        hw = data[c] | (data[c+1] << 8)
        starts_push = (hw & 0xF000) == 0xB000
        if starts_push:
            return c
    return None

def print_func(ldr_off, max_len=0x200):
    start_off = find_func(ldr_off)
    if start_off is None:
        print(f"  [无法定位函数起点 for ldr@{BASE+ldr_off:08X}]")
        return
    ok, ins = decode_ok(start_off, start_off + max_len)
    if not ok:
        print(f"  [解码失败]")
        return
    print(f"===== 函数起点 0x{BASE+start_off:08X} (ldr@{BASE+ldr_off:08X}) =====")
    stop = False
    for i in ins:
        mark = " <<<" if i.address == BASE + ldr_off else ""
        print(f"  0x{i.address:08X}: {i.mnemonic:<8} {i.op_str}{mark}")
        if i.mnemonic in ("bx",) or (i.mnemonic == "pop" and "pc" in i.op_str):
            if i.mnemonic == "bx" or True:
                # 继续打印下一个函数（连打），共打印到窗口结束
                pass
    print()

if __name__ == "__main__":
    for a in sys.argv[1:]:
        print_func(int(a, 16) - BASE)
