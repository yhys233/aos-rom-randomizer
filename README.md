# aos-rom-randomizer
# 晓月圆舞曲 CN 随机化器

> Castlevania: Aria of Sorrow（九柳汉化版）GBA ROM 随机化工具

基于**九柳汉化版**《恶魔城 晓月圆舞曲》（CRC32 `22EFD2B9`）的本地随机化器。
提供网页界面与 HTTP 服务，支持 **65 个随机化选项**，可组合出几乎无限的玩法变体；
相同的随机种子可 100% 复现相同的随机结果，适合速通练习与联机同种子挑战。

> [!WARNING]
> 本随机器目前 **bug 较多**：部分选项或选项组合可能导致游戏出现**乱码、贴图异常甚至崩溃**等情况。
> 遇到异常时，建议更换随机种子、关闭部分选项后重新生成；欢迎在 Issues 中反馈（请附上种子与选项配置）。

---

## 功能特性

- **怪物随机**：怪物位置打乱、Boss/巴洛尔/尤利乌斯/混沌/时之法师加入小怪、万物皆为怪、双混沌、Boss 房追加时之试炼、原 Boss 随机成小怪、存档点快捷道路等。
- **房间随机**：全城堡跨区洗牌 / 区域内随机 / 房间完全随机三种强度；混沌区、未开发区域、BossRush 地图可单独保持原样。
- **道具随机**：武器 / 防具 / 饰品 / 消耗品位置打乱、魂灯补魂、武器攻击、防具防御、红魂攻击数值随机（支持自定义上下限）。
- **属性随机**：武器与红魂的攻击属性（斩/火/水/雷/暗/圣/毒/咒/石）、怪物弱点与抗性随机。
- **掉落随机**：红 / 蓝 / 黄魂与道具掉落归属随机、魂完全随机、掉率提高、魂掉率与道具掉率自定义倍率。
- **数值自由扩展**：敌人体力/魔力/攻击/防御按指定倍数区间缩放、经验统一倍率、Boss 体力倍率、开局指定武器/防具/饰品。
- **流程便利**：一周目跳过对话、Debug 模式、跳过剧情三魂检测、古文书三魂随机、开局混沌戒指 / 剧情魂 / 红蓝黄魂。
- **长按介绍**：页面上长按任意选项 0.5 秒，弹出该选项的详细说明。

## 快速开始

环境要求：**Linux**；批量脚本需 `curl` 与 `unzip`。

> [!IMPORTANT]
> 仓库**不附带 ROM 与 Node.js 运行时**，使用前请自行准备：
> 1. 将合法获得的九柳汉化版 ROM（CRC32 `22EFD2B9`）放入 `engine/rom/emcxyywq.gba`；
> 2. 自行安装 Node.js，并将 `node` 可执行文件放到 `runtime/node/bin/node`（或修改 `启动服务.sh` 中的 node 路径指向系统 Node）。

```bash
./启动服务.sh          # 启动本地服务（端口 18688）
```

浏览器打开 http://localhost:18688 ：

1. 顶部选择「随机类型」（0=不随机 / 1=仅怪物 / 2=仅房间 / 3=全部随机）；
2. 勾选需要的选项，可输入固定种子（留空则随机）；
3. 点击「生成」下载 ZIP，内含随机后的 `.gba` ROM 与随机说明文本；
4. 解压后用 GBA 模拟器（如 mGBA）运行即可。

停止服务：`./停止服务.sh`

### 批量生成（命令行脚本）

`晓月随机rom生成脚本.sh` 是兼容 fbigames 原脚本的批处理入口，在文件头部配置各选项与生成数量，脚本会自动 POST 到本地服务并解压收集 ROM、Info 文本。

```bash
./晓月随机rom生成脚本.sh
```

### 直接调用 HTTP API

```bash
curl -o out.zip "http://localhost:18688/ajax.php" \
  -H 'content-type: application/x-www-form-urlencoded' \
  --data-raw "random_type=3&random_map_type=3&random_map_no_chaos=1&seed=4242"
```

响应为 ZIP（ROM + `Castlevania - Info - seed<seed>.txt`），`X-Random-Summary` 响应头携带随机内容摘要。

## 随机类型说明

| 类型 | 含义 |
|---|---|
| 0 | 不随机（可单独勾选各项手动组合） |
| 1 | 仅怪物（数值/掉落/位置） |
| 2 | 仅房间（房间洗牌） |
| 3 | 全部随机 |

## 选项总览（按页面分组）

- **随机类型**：`random_type`
- **怪物随机**：`random_enemy` `boss_enemy` `balore_enemy` `julius_enemy` `chaos_enemy` `magician_enemy` `magician_secret` `enemy_boss_min` `enemy_everything` `double_chaos` `light_chaos` `shortcut`
- **房间随机**：`random_map` `random_map_type` `random_map_no_chaos` `random_map_no_use` `random_map_no_bossrush`
- **道具随机**：`random_item_weapon` `random_item_armor` `random_item_accessory` `random_item_item` `random_item_soul` `random_item_stats_atk` `random_item_stats_def` `random_soul_stats_red`
- **道具属性**：`attr_weapon` `attr_soul_red`
- **怪物属性**：`random_enemy_hp` `random_enemy_mp` `random_enemy_exp` `random_enemy_atk` `random_enemy_def` `attr_enemy`
- **怪物掉落**：`random_enemy_soul_all` `random_enemy_soul_red` `random_enemy_soul_blue` `random_enemy_soul_yellow` `random_enemy_item`
- **其他选项**：`soul_probability` `item_probability` `ringchaos` `soul_start` `mutil_exp` `mainsoul` `main_soul_random` `main_soul_pass`
- **高级选项**：`skipdialog` `opendebug`
- **自由度扩展**：`seed` `enemy_stat_min/max` `exp_multiplier` `soul_probability_scale` `item_probability_scale` `weapon_atk_min/max` `armor_def_min/max` `soul_atk_min/max` `boss_hp_scale` `start_weapon` `start_armor` `start_accessory`

选项定义集中维护在 `engine/options.js`，前端页面自动渲染、后端自动映射，新增选项只需改动一处。

## 技术架构

```
浏览器 (engine/public/index.html)  ── GET /options ──►  选项定义
      │ 勾选/输入种子                 GET /ajax.php?…      │
      ▼                                                    ▼
  engine/lib/runRandomizer.js ◄── 参数解析 ◄── engine/server.js (Node, 端口 18688)
      │  规划 + 编排
      ├─ engine/vendor/engine/RandomizerEngine.js  房间随机核心
      │     └─ vendor/logic/entrance/…              三种洗牌器（FirstDraft / Global / Total）
      │           支持 keepFlags：混沌区 / 未开发区 / BossRush 地图保护
      ├─ engine/lib/enemyTables.js                 怪物数值 / 掉落 / 经验
      ├─ engine/lib/itemTables.js                  装备数值 / 属性
      ├─ engine/lib/roomEntities.js                怪物位置 / Boss / 快捷道路 / 魂灯 / 开局道具
      ├─ engine/lib/shop.js                        商店物品随机
      ├─ engine/lib/misc.js                        跳过对话 / Debug / 三魂
      └─ engine/lib/cnAreas.js                     九柳汉化版房间表解析（偏移 0x4E52AC，355 房间）
              │
              ▼  确定性随机（Mersenne-Twister，seed 驱动）
         生成随机 ROM  → ZIP 返回浏览器
```

- **种子确定性**：全程使用种子驱动的 PRNG，同一 `seed` + 相同参数必定产出逐字节相同的 ROM。
- **房间保护机制**：混沌区房间与门收集为保护区，三种洗牌器统一过滤；未开发区域（12 房，不在房间表内）与 BossRush（独立第 13 区）天然不参与洗牌，选项提供显式保证。

## 目录结构

```
aos-rom-randomizer/
├── README.md                    项目介绍（本文件）
├── 启动服务.sh / 停止服务.sh     服务启停脚本
├── 晓月随机rom生成脚本.sh         批量生成脚本（兼容 fbigames 原版）
├── engine/                      Node 服务与随机化引擎
│   ├── server.js                HTTP 服务（18688）与 ZIP 打包
│   ├── options.js               65 个选项的唯一定义（驱动前后端）
│   ├── lib/                     CN 功能模块与编排器
│   ├── public/index.html        网页界面（含长按介绍弹窗）
│   ├── rom/                     【自行准备】随机化输入 ROM（不在仓库内）
│   └── vendor/                  随机化引擎（源自 AoSRando，本地化适配）
├── tests/                       回归测试脚本（Node）
└── runtime/                     【自行准备】Node.js 运行时（不在仓库内）

其他目录：../晓月圆舞曲随机ROM/ 保留参考材料（refs/ 参考项目源码 + ROM 偏移总结文档）
```

## 回归测试

`tests/` 下为 Node 回归脚本，覆盖：

- `regress*.js`：12 组专项回归（随机类型 / 房间三档 / 混沌保护区 / 快捷道路 / 数值选项 / 双混沌 / Boss 化小怪 / 时之试炼 / 光明混沌 等）。
- `full-regress.js`：全功能综合回归（约 50 个选项逐项 + FULL 大组合 × 5 种子 + 确定性断言）。
- `e2e-http.js`：HTTP 端到端（页面与 12 组关键参数请求均返回 200）。

运行（服务需已启动）：

```bash
runtime/node/bin/node tests/full-regress.js
```

## 参考与致谢

- 随机化引擎源自 **AoSRando**（`refs/AoSRando`、`refs/aos_rando`、`refs/aros`，MIT 协议）。
- 随机数生成使用 **mersenne-twister**（MT19937，松本行真/西村拓士，BSD 风格协议）。
- 基于**九柳汉化版**《恶魔城：晓月圆舞曲》ROM（CRC32 `22EFD2B9`）。
- ROM 结构偏移参考项目内两篇总结文档：
  - `恶魔城晓月圆舞曲_ROM偏移总结.txt`
  - `恶魔城晓月圆舞曲_CRC32_22EFD2B9_偏移总结.txt`

## 免责声明

本仓库不包含任何游戏 ROM、游戏数据文件或汉化内容，仅提供随机化工具本身；使用者需自备通过合法渠道获得的正版 ROM，并自行承担使用过程中的合规责任。
本工具仅供学习与研究，随机化后的 ROM 请勿用于任何商业用途或非法传播。
游戏版权归原作者（Konami）所有，汉化版权归九柳汉化组所有。本项目与 Konami 及九柳汉化组无任何官方关联。请自备正版 ROM。