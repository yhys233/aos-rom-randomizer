# AoS(晓月圆舞曲)ROM 地址信息基准

> 基于 emcxyywq.gba(8MB)capstone 反汇编建立的地址/引用基准。
> 工具:`engine/tools/addr-baseline/`(pointer_map.py / ldr_scan.py / disasm.py / func.py / classify.py)

## 关键表基址与引用

| 目标 | 说明 | 引用方式 |
|---|---|---|
| `0x080E6E50` | 敌人 DNA 表(113 条 × 36 字节) | 32 处 LDR 直接加载,全部运行时直读 ROM |
| `0x084E52AC` | 房间指针表(表基址,roomIdx→roomHeader) | 经槽 `0x084E5808`(=0x084E52AC)间接访问,唯一 LDR 点 `0x0800198C` |
| `0x084E589C` | 房间 0 header | 仅 `0x08035F28` 处 LDR(当前房间 init);+0x14=entityList,+0x18=doorList |
| `0x084E591C` | 房间 1 header | 3 处 LDR |
| `0x087F8B6C` | 房间0 实体列表搬迁处(随机器注入区) | 无直接引用;只被 header+0x14 指向 |

## 敌人 DNA 记录布局(36 字节,已与游戏代码逐项核对)

| 偏移 | 引擎字段 | 游戏读取点(反汇编实证) |
|---|---|---|
| +0x08 u16 | item1 | 0x08066B52 `ldrh [r6,#8]` |
| +0x0a u16 | item2 | 0x08066B48 `ldrh [r6,#0xa]` |
| +0x0c u16 | 掉落/演出参数 | 0x0800E518,0x0804B160 |
| +0x10 u16 | **exp** | 0x08066A02 `ldrh r4,[r6,#0x10]`→累加玩家经验 |
| +0x12 u8 | **soulRarity** | 0x08066A56 `ldrb [r6,#0x12]`(0=不掉魂),双 roll |
| +0x15 u8 | **item1Rarity** | 0x08066B54 `ldrb [r6,#0x15]` |
| +0x16 u8 | **item2Rarity** | 0x08066B4A `ldrb [r6,#0x16]` |
| +0x17 u8 | soulType | 0x08066A64 随 roll 参数 |
| +0x18 u8 | soul(0=无魂) | 0x08066A5C `cmp #0`→无魂判定 |
| +0x1a/+0x1c u16 | 属性 flag | 0x0804B52C/0x0804B58C |
| +0x1e/+0x20 u16 | 出场位置 | 0x0804B17E/0x0804B186 |

## 关键函数反汇编定位

### 1. 死亡结算(经验/魂/道具掉落)—— `0x08066992`
```
r7=实体; r8=实体[+0x36]=敌人ID; r6=0x080E6E50 + id*36   ← 运行时直读 ROM
exp:     0x08066A02 ldrh r4,[r6,#0x10] → [player,#0x30]+=r4 (封顶)    ← 经验写入生效点
魂判定:  0x08066A56 ldrb [r6,#0x12] 若 0 → 无魂
         0x08066A5C ldrb [r6,#0x18] 若 0 → 无魂
         roll1: 0x08066A6A bl 0x0803181C(soulType, soul-1)
         roll2: 0x08066A94 soulRarity*8 - 幸运 → rng 对比(保底 3/6/7/11)
道具判定:0x08066B40 rng vs (0x40+mod) → 0x08066B48/0x08066B54 读 item2/item1 与稀有度
```
> 魂掉落有 保底计数 + 双 roll;降低 soulRarity 直接提高第二 roll 命中率。

### 2. 魂掉落判定(战斗内)—— `0x0804B1AC`
```
r3 = 0x080E6E50 + id*36
0x0804B1F0 ldrb [r3,#0x18](soul) cmp 0 → 无魂
0x0804B20A ldrb [r3,#0x17](soulType) / [r3,#0x18](soul) → bl 0x0803181C 概率
```

### 3. 敌人实体生成—— `0x0800E41E`
```
r5=房间实体描述;  [r5,#6]=敌人类型 → id*36 + 表 → 读 +0xc/+4 建实体
```

### 4. 房间 header 访问—— `0x0800197C`(getRoomHeader)
```
r0=roomIdx*4+0x084E5808 → * = 0x084E52AC(表基); +r1*4 → * = roomHeader
```

## 结论(逐功能)

| 功能 | 写入位置 | 游戏读取 | 判定 |
|---|---|---|---|
| exp_multiplier / mutil_exp | 表+0x10 (u16) | 0x08066A02 运行时直读 | ✅ 生效 |
| soul_probability / scale | 表+0x12 (u8) | 0x08066A56 运行时直读 | ✅ 生效 |
| item_probability / scale | 表+0x15/+0x16 (u8) | 0x08066B4A/B54 运行时直读 | ✅ 生效 |
| ringchaos/mainsoul/soul_start | 房间0 实体列表搬迁 + header+0x14 | 实体列表仅经 header+0x14 可达 | ✅ 应生效 |

**反汇编层面全部写点正确、全部被游戏运行时直读。** 若游戏内仍无效果,
问题不在字节注入,而在运行链路(加载的 ROM 文件 / 存档 / 参数传递)。

## 遗留待确认
- [ ] 0x080BFF6A / 0x080C00CA 两处大函数写 +0x12/+0x14 等字段——确认其基寄存器是
      ROM 表还是 RAM 结构(若是 RAM 结构,则存在敌方数据 RAM 镜像,但死亡结算仍读 ROM,不影响)
- [ ] 用户实际加载的 gba 文件与生成文件一致性(校验和)
- [ ] 存档已收集标记是否覆盖开局赠品
