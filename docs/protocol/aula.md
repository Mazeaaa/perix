# 狼蛛 AULA 协议笔记

状态：**仅识别**。

## 设备与传输

狼蛛多数键盘走 Sonix 方案（VID `0x0C45`），协议分两条路：

| 模式 | 方式 | 帧长 | 证据 |
|---|---|---|---|
| 有线 | HID Feature Report **7** | 8 字节 | 社区文档 |
| 2.4G | HID output report | 65 字节，需套厂商标封（`00 BB AA 99 88 AA AA` + 载荷） | 社区文档 |

关键差异：**接收器没有 feature report**。所以同一份配置逻辑，有线走 feature、无线走 output + 信封，两条路径要分别实现。

写入节流是硬约束：官方软件同样限制有线写入间隔 ≥110ms，抄这个节奏最稳。`devices.json` 里的 `minWriteIntervalMs: 110` 就是从这里来的。

## 待验证

- [ ] 8 字节帧的命令表（目前只知道固定格式与 report id）
- [ ] 灯效模式枚举（社区资料里出现过 0~17 的编号表，需逐条核对）
- [ ] 每键 RGB 的下发方式：一次性全量还是分批
- [ ] 亮度与速度的取值范围
- [ ] 改键与宏的写入格式（宏是 XML，经 output report 下发）
- [ ] 2.4G 信封的字段布局

## 怎么抓

```bash
perix watch --vid 0x0C45 --page 0xFF13 --ms 10000
```

狼蛛的 RGB 集合常常落在 `0xFF13`，但不同型号不一致——先 `perix list` 看清楚这块键盘到底暴露了哪些用途页，再决定监哪个。

## 参考

- `shengengfun/MiaHUB` — Tauri + Rust，含 8 字节帧与 2.4G 信封格式，附带与官方抓包逐字节对照的断言
- `Punkster81/AULA-F108-Driver` — Sinowealth 8051 协议、per-key 图层系统
- `marcoslor/Aula-F87-Controller` — 17 种灯效的编号表、WebHID 与 Python CLI 双实现
