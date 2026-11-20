# CanIMix · 一起吃安全吗？

**同服检测（Co-administration Safety Check）** —— 把任意 2～5 样药品、保健品、蔬果或饮品放上台面，几秒看清它们能不能一起用。

项目名：**CanIMix** · 中文名：**一起吃安全吗？**

---

## 它解决什么问题

药片、保健品、水果、咖啡每天在"一起吃"，但相互作用藏在成分表里：

| 常被忽略的组合 | 后果 |
| :--- | :--- |
| 藿香正气水 × 甲硝唑/头孢 | 双硫仑样反应（面红、心悸、血压下降） |
| 999感冒灵 × 布洛芬 | 复方药已含对乙酰氨基酚，叠加伤肝风险 |
| 钙片/牛奶 × 多西环素、左甲状腺素 | 多价金属螯合，药效打折（需错开 4 小时） |
| 西柚 × 降压药/他汀 | CYP3A4 抑制，血药浓度飙升 |
| 鱼油/大蒜 × 华法林、阿司匹林、氯吡格雷 | 出血风险叠加 |

本工具把这些规律做成可交互的即时判定：**挑东西 → 出结论 → 给行动建议**。

## 核心能力

- **94 种物品 · 12 个分类**：感冒过敏、抗感染、肠胃消化、心脑血管、降糖代谢、精神助眠、激素专科、维生素、保健中药、果蔬、饮品、餐食调味；每件物品自带成分（`ingredients`）与药理标签（`tags`）模型。
- **69 条交互规则**，六类匹配器：
  - `duplicate_ingredient`：同成分跨物品叠加（如两款含对乙酰氨基酚的药）
  - `exact_pair`：点名的一对（西柚 × 降压药）
  - `tag_pair` / `tag_stack`：标签落在两个/多个不同物品上（双硫仑、CYP3A4、QT 风险…）
  - `safe_clarification`：澄清"看起来危险其实安全"（头孢 × 不含酒精的藿香正气**口服液**）
  - `synergy`：正向搭配（维生素 D × 钙）
- **五级结论**：`danger 不建议同用` / `caution 需谨慎` / `spacing 需间隔服用` / `synergy 协同` / `safe 未发现已知冲突`，同对物品命中多条规则时按 `priority` 取最高。
- **间隔方案（Spacing Plan）**：多条"错峰"建议聚合为一张时间轴卡片，如"左甲状腺素 → 钙/奶/维D"聚合排序。
- **成分透视**：命中规则时自动点出"999感冒灵颗粒 含 对乙酰氨基酚"这类复方成分，解释结论怎么来的。
- **拼音搜索**：`pinyin-map.json` 预生成，输入 `bu luofen` 直接搜到"布洛芬"。
- **一键分享**：把结论、涉及物品、行动建议整理成文字复制到剪贴板。
- **评委引导模式**：默认开启起始页 + 8 步引导（`src/onboarding/`），可在舞台左上角开关或 `VITE_GUIDE=off` 构建时彻底关闭，状态存于 localStorage。
- **移动端体验**：手机竖屏（≤640px portrait）自动切到「Handset 模式」——去掉 iPhone 机身与假状态栏，App 铺满 `100dvh` 并按 `env(safe-area-inset-*)` 让开刘海；引导卡改为就近贴在目标旁边的浮动卡，文案同步精简。宽屏仍是 iPhone 框架舞台。另有点按托盘圆盘可移出、触觉反馈（`haptics.ts`）、尊重 `prefers-reduced-motion`。

> 免责声明：结果基于常见药理与饮食相互作用规律，仅供用药参考，不替代执业医师或药师的个体化诊断；孕产妇、儿童及慢病患者请遵医嘱。

## 快速开始

```bash
pnpm install
pnpm dev          # http://127.0.0.1:6001（strictPort）
```

| 命令 | 说明 |
| :--- | :--- |
| `pnpm dev` | 开发服务器，固定 6001 端口 |
| `pnpm build` | `tsc -b` 类型检查 + Vite 产物构建 |
| `pnpm test` | 引擎单测（`node --test`，17 用例全通过） |
| `pnpm lint` | oxlint |
| `pnpm generate:pinyin` | 由 `items.json` 重建拼音搜索映射 |

## 目录结构

```
src/
├─ App.tsx                    # 舞台：手机框架 / 竖屏全屏 + 漂浮标本 + 引导层接线
├─ onboarding/                # 起始页、8 步评委引导、引导开关
│  ├─ SplashScreen.tsx
│  ├─ TourLayer.tsx / tour-steps.ts
│  └─ config.ts               # VITE_GUIDE=off 总开关 + localStorage
├─ components/
│  ├─ pairing/                # 主交互
│  │  ├─ PairingApp.tsx       # 检测台 + 物品库 + 结果抽屉容器
│  │  ├─ Bench.tsx            # 检测托盘（5 槽位圆盘）
│  │  ├─ LibraryPanel.tsx     # 分类筛选 + 物品网格
│  │  ├─ ControlDeck.tsx      # 清空 / 开始检测
│  │  ├─ ResultSheet.tsx      # 结果抽屉（可下滑关闭、分享）
│  │  ├─ pairing-engine.ts    # ★ 核心判定引擎（纯函数）
│  │  ├─ pairing-data.ts      # 物品索引、拼音匹配、SVG 懒加载
│  │  ├─ pinyin.ts / pinyin-map.json
│  │  ├─ haptics.ts / motion.ts / use-scroll-mask.ts
│  │  ├─ result/             # 结论卡 / 冲突卡 / 安全折叠 / 错峰方案卡
│  │  └─ styles/             # 分模块 CSS
│  └─ ui/iphone.tsx           # iPhone 舞台外壳
├─ data/
│  ├─ items.json              # 94 物品：成分 + 标签 + 分类
│  └─ rules.json              # 69 规则 + 成分提示词表
└─ lib/                       # cn()、use-media-query（竖屏判定）

tools/                        # 拼音映射生成、物品素材清单（Windows bat）
```

## 引擎是怎么判的

`evaluatePairing(selected)` 是纯函数：

```
托盘内所有物品对 × 69 条规则
  → 匹配器命中（成分计数 / 标签分布 / 点名对）
  → 按 priority 去重合并（同对物品只留最高优先级）
  → 聚合 spacing 卡、合并 triggeredIngredients
```

- 匹配语义约束（标签必须落在**不同**物品上、`tag_stack` 跨物品计数等）写在 `rules.json` 的 `matching_notes`，并有数据一致性单测保证。
- `validateRulesData()` 在开发态校验 `rules.json` ↔ `items.json`：标签、成分、物品 id 完全对齐。

## 设计说明

- **浅色临床风格视觉**：舞台是浅灰绿「实验台」（`#f4f6f5` 画布 + 细十字坐标网格 + 手机背后的柔光与落地阴影），手机内 UI 为白瓷卡片、`color-scheme: light`，状态色用青绿（`#0e6b60`，安全/主色）与警示红（冲突）。
- **首屏图标零外部请求**：物品 SVG 在构建时以 data URI 内联进主包（`?inline`），弱网下不会因 90+ 张小图排队而逐个迟到。
- 舞台外环绕漂浮的物品"标本"是装饰层，窄屏自动收起，不遮挡手机操作区。

