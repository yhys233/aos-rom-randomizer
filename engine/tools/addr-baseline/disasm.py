#!/usr/bin/env python3
"""AoS ROM 反汇编工具：给定起始地址与范围，用 capstone 反汇编 Thumb/ARM。"""
import sys
from capstone import *

ROM = "/home/Yhys/aos-rom-randomizer/engine/rom/emcxyywq.gba"
BASE = 0x08000000
data = open(ROM, "rb").read()

def disasm(start_addr, length, mode=CS_MODE_THUMB, show_addr=True, label=""):
    end = start_addr - BASE + length
    code = data[start_addr - BASE:end]
    md = Cs(CS_ARCH_ARM, mode)
    md.detail = True
    print(f"===== {label} 0x{start_addr:08X} ({length:#x} bytes, {'Thumb' if mode==CS_MODE_THUMB else 'ARM'}) =====")
    for insn in md.disasm(code, start_addr):
        ref = ""
        if insn.operands:
            for op in insn.operands:
                if op.type in (CS_OP_MEM, CS_OP_IMM):
                    ref = f"   ; ref={insn.address:#x}"
        print(f"  0x{insn.address:08X}: {insn.mnemonic:<8} {insn.op_str:<38} {ref}")

if __name__ == "__main__":
    start = int(sys.argv[1], 16)
    length = int(sys.argv[2], 16)
    mode = CS_MODE_THUMB
    if len(sys.argv) > 3 and sys.argv[3] == "arm":
        mode = CS_MODE_ARM
    label = sys.argv[4] if len(sys.argv) > 4 else ""
    disasm(start, length, mode, label=label)
