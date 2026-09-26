# LadderAirport OpenWrt

[LadderAirport](https://github.com/Jlan45/LadderAirport) 节点 Agent 的 OpenWrt 软件源（feed）。用官方 SDK 为常见路由架构编译 `ladder-agent` `.ipk`，默认以 **uplink** 模式接入 Panel（NAT 友好，对齐 Android 节点）。

需要 Panel **支持 agent enroll / uplink** 的版本（与主仓文档一致）。

## 仓库关系

本仓只包含 OpenWrt 包定义与 CI，**不** vendoring 主仓源码：

| 场景 | `LADDER_SRC` |
|------|----------------|
| 本地（与主仓并列） | 默认 `../LadderAirport` |
| CI | checkout 到 feed 内 `./LadderAirport`（recursive submodules） |

```bash
# 推荐布局
~/LadderAirport          # 主仓
~/LadderAirportOpenwrt   # 本仓
cd ~/LadderAirportOpenwrt && make check-src
```

## 安装（Release 软件源）

1. 在 [Releases](https://github.com/Jlan45/LadderAirportOpenwrt/releases) 找到对应架构（路由器 `opkg print-architecture` 或看固件 arch）。
2. 添加自定义源（示例用完整 feed 归档解压后的 HTTP 目录，或单架构包 URL）：

```bash
# 查看本机架构
opkg print-architecture

# 示例：把 release 里的 <arch>.tar.gz 解到某 HTTP 目录后
# /etc/opkg/customfeeds.conf
src/gz ladderairport https://example.com/ladderairport/x86_64

opkg update
opkg install ladder-agent
```

未签名软件源时，按 OpenWrt 文档允许未校验安装（生产环境建议配置 `KEY_BUILD` 签名，见下方 CI）。

## 配置与启动

UCI 节 `ladder-agent.main`（文件 `/etc/config/ladder-agent`）：

| 选项 | 默认 | 说明 |
|------|------|------|
| `enabled` | `0` | `1` 启用 |
| `panel_url` | 空 | Panel HTTPS 根 URL |
| `node_id` | 空 | Panel 节点 ID |
| `token` | 空 | 长期控制令牌（`LADDER_TOKEN`） |
| `enroll_token` | 空 | 一次性注册令牌；启动时若 `token` 为空则调用 enroll 后清除 |
| `listen` | `0.0.0.0:50051` | gRPC 监听（默认 uplink 不对外服务） |
| `data_dir` | `/var/lib/ladder-agent` | 数据目录 |
| `uplink` | `1` | 默认 uplink |
| `uplink_serve_grpc` | `0` | uplink 下仍监听 gRPC |
| `uplink_ws` | `1` | WebSocket 实时通道 |
| `report_address` | 空 | 上报地址覆盖 |
| `tls_sans` | 空 | 续签额外 SAN（push / serve_grpc） |
| `log_stderr` | `1` | procd 捕获 stderr |

在 Panel 创建 **uplink** 节点并复制注册信息后：

```bash
uci set ladder-agent.main.enabled='1'
uci set ladder-agent.main.panel_url='https://panel.example.com'
uci set ladder-agent.main.node_id='...'
uci set ladder-agent.main.enroll_token='...'   # 或直接 set token='...'
uci commit ladder-agent
/etc/init.d/ladder-agent enable
/etc/init.d/ladder-agent start
```

也可手动注册：

```bash
/usr/libexec/ladder-agent/enroll.sh
```

日志：`logread -e ladder-agent` 或 `logread -f`。

首期不包含 systemd 式远程升级助手与 BBR helper；升级请用 `opkg` 更新本 feed 中的包。

## 本地 / 固件集成

将本仓加入 `feeds.conf`：

```text
src-link ladderairport /home/you/LadderAirportOpenwrt
```

并保证 `LADDER_SRC` 能找到主仓（并列 clone 或 CI 式放在 feed 根目录 `LadderAirport/`）：

```bash
./scripts/feeds update ladderairport
./scripts/feeds install ladder-agent
make package/ladder-agent/compile V=s
```

## CI

- **分支目标**：OpenWrt `24.10`（`.ipk`）
- **工具**：[`openwrt/gh-action-sdk@v11`](https://github.com/openwrt/gh-action-sdk)
- **包名 / feed 名**：`ladder-agent` / `ladderairport`
- **架构**：全路由矩阵（aarch64 / arm / x86 / mips / loongarch64 / riscv64 / powerpc…），`fail-fast: false`，并发上限 8
- **触发**：push/PR → CI artifacts；推送 `v*` tag → 聚合 feed 并发布 GitHub Release
- **签名（可选）**：仓库 secret `KEY_BUILD`（usign）供 release workflow 使用

构建 tags 与主仓一致：`with_quic,with_utls`；`GOTOOLCHAIN=auto` 以匹配主仓 `go 1.26.x`。

### 已知可能失败的架构

部分冷门架构若 Go 官方 toolchains 不支持，对应 CI job 会失败（不影响其它 arch）。若需排除，可在 package `DEPENDS` 中加 `@!arch` 限制。

## 目录

```text
net/ladder-agent/
  Makefile                 OpenWrt 包定义（链接 LADDER_SRC）
  files/
    ladder-agent.init      procd
    ladder-agent.config    UCI 默认
    ladder-agent.keep      sysupgrade 保留路径
    enroll.sh              uplink 一次性注册
.github/workflows/
  ci.yml
  release.yml
```

## 许可证

包定义与脚本见本仓；Agent 运行时基于主仓及其 sing-box / frp 上游许可。
