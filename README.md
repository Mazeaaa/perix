# PeriX · 外设中枢

> 一个软件管所有外设。把 ATK / 迈从 / 罗技 / 狼蛛 的驱动合并成一个控制台。

你桌上有四家的设备，就得装四个全家桶：438MB 安装包、四份开机自启、四个后台服务、四套互不相通的灯效同步。
PeriX 的目标是让这些设备回到它们本该有的样子——**一支程序，一套配置，一份灯效**。

## 现在能做什么

```bash
$ perix list
VID:PID    用途页  接口  品牌       型号                            进度    状态
─────────  ──────  ────  ─────────  ──────────────────────────────  ──────  ────────
048D:8353  FF83    1     未知厂商   HIDI2C Device                   —       未知
04F3:31AD  FF00    4     未知厂商   HIDI2C Device                   —       未知
3554:F58A  FF05    8     ATK / VXE  Compx 方案接收器（型号待识别）  仅识别  已识别
```

- `perix list` — 枚举全部 HID 接口，按物理设备合并，标注品牌与识别状态
- `perix info` — 对 Compx 方案设备发只读命令，读电量 / 固件 / CID，并打印原始报文
- `perix watch` — 被动监听某个接口的输入报告（**只读，不发送任何报文**），用于补协议
- `perix doctor` — 环境体检：原生模块、官方驱动进程是否抢占设备
- `perix devices` — 已收录设备与实现进度
- `perix raw` — 发送原始报文，必须显式加 `--yes`

**明确说明：当前还是"只认不控"阶段。** 设备能被正确识别、接口能被打开、报文能被读取，但配置写入的协议尚未接入——见[支持矩阵](#支持矩阵)。这个仓库先把架构和识别层做实，再逐个把协议填进去。

## 支持矩阵

| 品牌 | 安装包 | 技术形态 | 通信方式 | 证据 | 进度 |
|---|---|---|---|---|---|
| ATK / VXE | 143MB · NSIS | Web 前端 + WebHID | `0xFF05` 63 字节帧；Compx `0xFF04` 16 字节帧 | 社区文档 | 仅识别 |
| 迈从 MCHOSE | 161MB · NSIS | Web 前端 + WebHID | Sinowealth `0x41E4`，Feature Report 9（519 字节） | 社区文档 + 官网前端未混淆 | 仅识别 |
| 罗技 Logitech | 71MB · WiX | Electron + agent | HID++ 2.0；另有本地 `ws://localhost:9010` | 公开规范 | 仅识别 |
| 狼蛛 AULA | 63MB · Inno Setup | 原生 Qt/Delphi | Feature Report 7（8 字节）；2.4G 走 65 字节信封 | 社区文档 | 仅识别 |

## 快速开始

```bash
git clone https://github.com/Mazeaaa/perix.git
cd perix
npm install
npm run dev list        # 或用 npm run dev -- list
npm run dev doctor
npm run dev watch -- --vid 0x3554 --pid 0xF58A --page 0xFF05 --ms 8000
```

要求 Node ≥ 20.11。`node-hid` 是原生模块，Windows / macOS / Linux 都有预编译包；若加载失败，`perix doctor` 会给出原因。

## 架构

```
UI 层            （待接入）设备墙 / 灯效画布 / 改键 / 宏
   ↓
Perix 门面       枚举 → 识别 → 打开会话
   ↓
统一能力模型     Capability：DPI / 回报率 / 灯效帧 / 键位 / 宏 / 触发行程
   ↓
Provider 插件    atk · mchose · aula · logitech
   ↓
HidTransport     node-hid / mock /（后续 WebHID）
```

```
src/
├── core/         类型、能力模型、Provider 接口、门面
├── devices/      devices.json —— 设备描述符，加新型号只改这里
├── providers/    分品牌实现，目前只有 ATK 的分帧规则
├── transport/    node-hid 与 mock 两套实现
└── cli/          命令行
```

### 三个设计决定

**1. UI 不认品牌。** 每个控件由 `descriptor.capabilities` 动态渲染。加一个品牌 = 加一个 Provider + 一条 `devices.json`，UI 零改动。

**2. 协议层只收"每键 RGB 帧"，不做灯效。** 呼吸、波浪、音频律动全部在应用层用统一时间轴合成，30fps 广播给所有设备。只有这样四个品牌的灯才可能真正同步——各跑各的厂商原生模式永远对不齐。

**3. 证据分级，不猜字节。** 每条设备记录都带 `evidence`：

| 等级 | 含义 |
|---|---|
| `verified` | 真机验证过 |
| `community` | 有公开的逆向文档或开源实现 |
| `family` | 只按 VID / 厂商家族推断，型号未知 |

同理，**本仓库不填猜测的命令字**。写错一个字节可能让设备进异常状态，所以未验证的协议一律留空并抛出 `NOT_IMPLEMENTED`，而不是"先跑跑看"。

## 路线图

- [x] **P0** 设备枚举、接口合并、品牌识别、被动抓包、环境体检
- [ ] **P0.5** ATK Compx 方案：电量 / 固件 / CID 只读 — 代码与单测已就绪，卡在硬件验证（手上的 `3554:F58A` 不接受 feature report，见[协议笔记](docs/protocol/atk.md#实测记录)）
- [ ] **P1** 灯效帧模型 + 合成引擎（跨设备同步）
- [ ] **P2** 写入通道：DPI、回报率、灯效（逐型号真机校验后才标 `verified`）
- [ ] **P3** 迈从 / 狼蛛接入
- [ ] **P4** 罗技 HID++ 2.0
- [ ] **P5** 桌面壳（托盘、按程序自动切换配置）

## 协议文档

`docs/protocol/` 下按品牌记录已确证的内容和待验证项：

- [ATK / VXE](docs/protocol/atk.md)
- [迈从 MCHOSE](docs/protocol/mchose.md)
- [狼蛛 AULA](docs/protocol/aula.md)
- [罗技 Logitech](docs/protocol/logitech.md)

设计方案与取舍见 [docs/设计方案.md](docs/设计方案.md)。

## 免责声明

- 本项目与 ATK、VXE、迈从、罗技、狼蛛**均无关联**，未获其授权或认可。品牌名仅用于说明兼容范围，商标归各自所有者。
- 只通过 HID 报文与设备通信，**不修改系统、不安装驱动、不注入输入、不常驻内核态**。
- **不做固件更新**。签名与校验复杂且失败即变砖，请交给官方软件。
- 写入类操作存在风险。仓库里的代码按"未验证即拒绝执行"的原则编写，但你仍需为自己的设备负责。

## 贡献

最需要的贡献是**抓包**，不是代码：

1. 关掉官方驱动，跑 `perix doctor` 确认没有进程抢占
2. 跑 `perix watch --vid 0x… --pid 0x… --page 0x…`，同时在官方软件里只做一个动作
3. 把输出贴到 issue，注明品牌、型号、固件版本、你做的那个动作

一条干净的抓包记录，比十行没有出处的协议猜测有用得多。

## License

[MIT](LICENSE)
