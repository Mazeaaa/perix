# 罗技 Logitech 协议笔记

状态：**仅识别**。

## 两条路

罗技是这四家里唯一有**公开协议规范**的，但也最杂。

### 1. HID++ 2.0（设备直连）

VID `0x046D`。短报告 7 字节、长报告 20 字节，靠 feature index 寻址功能块（DPI、灯光、按键、板载配置各是一个 feature）。
有公开规范，也有成熟开源实现可对照。

难点在设备型号太多，且部分新设备加了校验；蓝牙连线下多数配置通道不可用。

### 2. G HUB 本地 API

G HUB 的 `lghub_agent.exe` 会在 `ws://localhost:9010` 起一个 JSON 接口，协议形如：

```json
{ "path": "/devices/list", "verb": "GET" }
```

能拿到设备列表、电量、充电状态。适合做**兜底**——当我们还读不了某台设备时，只要用户装了 G HUB，至少能显示电量和在线状态。

代价是要依赖官方软件在跑，且它能给的信息远少于 HID++ 直连（改不了 DPI、灯效、按键）。

## 取舍

优先走 HID++ 直连；直连不通的型号，退到 G HUB 本地 API 只做只读展示。不走"内嵌 G HUB 窗口"那条路——Electron 应用窗口没法干净地嵌进另一个应用。

## 待验证

- [ ] 0x0000 FeatureSet 探测与 feature index 缓存
- [ ] 0x2201 / 0x2202 ChangedDPI / AdjustableDPI
- [ ] 0x1814 ReportRate
- [ ] 0x8071 / 0x8081 灯光配置
- [ ] 0x8100 OnboardProfiles
- [ ] 需要额外校验的型号清单

## 参考

- OpenRGB — 罗技键鼠灯光实现齐全
- libratbag / ratbagd — DPI、回报率、按键的 profile 抽象，值得抄结构
- logiops、Solaar — HID++ 2.0 的两种完整实现，注释质量高
