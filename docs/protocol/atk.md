# ATK / VXE 协议笔记

状态：**仅识别**。下面每条都标注了来源，没有来源的一律不写。

## 设备与传输

ATK 旗下（含 VXE）用的是两套国产方案，靠自定义用途页区分：

| 方案 | 用途页 | 帧长 | 通信方式 | 证据 |
|---|---|---|---|---|
| BitMouse | `0xFF05` | 63 字节 | output report 8，应答走 input report 8 | 社区文档 |
| Compx | `0xFF04` | 16 字节 | output report | 社区文档 |
| ATK 私有键盘 | `0xFF60` / `0xFF61` | — | VIA / QMK 兼容 | 社区文档 |

VT 系列接收器会转发所有**寻址到鼠标**的报文，因此有线与 2.4G 可以复用同一套帧格式——这是这套方案最好写的地方。

实测到的一块 Compx 接收器（`3554:F58A`）同时暴露了 `0xFF02`、`0xFF03`、`0xFF04`、`0xFF05` 四个厂商集合，外加一个标准键盘集合。**不要用 PID 判断型号**，同一 PID 下可能挂不同产品。

## 本仓库已有的实现

`src/providers/atk.ts`：

- `encodeFrame(payload)` — 首字节写 report id 8，其余补齐到 63 字节
- `decodeFrame(data)` — 去掉 report id
- 常量 `ATK_FRAME_LEN`、`ATK_REPORT_ID`

只有分帧，没有命令表。故意如此：命令字未验证前不写进代码。

## 待验证

- [ ] 设备信息（型号 / 固件 / 序列号）的请求-应答格式
- [ ] 电量读取
- [ ] DPI 档位表：档数、单档 x/y、当前档
- [ ] 回报率设置与生效方式
- [ ] 灯效：模式表、亮度/速度参数、每键颜色下发
- [ ] 板载配置档切换与写入
- [ ] Compx 16 字节帧与 BitMouse 63 字节帧在字段布局上的差异

## 怎么抓

```bash
# 1. 关掉 ATK HUB，确认没被独占
perix doctor

# 2. 监听配置集合
perix watch --vid 0x3554 --pid 0xF58A --page 0xFF05 --ms 10000

# 3. 期间在 ATK HUB 里只做一件事（比如把 DPI 从 800 改到 1600）
# 4. 把输出贴到 issue，并写明型号 + 固件版本 + 你改了什么
```

注意：`0xFF05` 只在"配置交互"时有流量，鼠标移动落在标准鼠标集合上（用途页 `0x01`），所以别拿移动鼠标去测配置集合——会一直是 0 帧。

## 参考

- `cobanov/atkctl` — 含 PROTOCOL.md，63 字节帧、命令表、Compx 传输
- `Tubatools.AtkHub`（NuGet）— 反编译 KeyLinker 库，覆盖 BitMouse / Compx / 私有键盘的 PID 目录
