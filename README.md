# 🚀 ysp-live-docker (软路由优化版)

一个基于 Docker 与 Python 构建的轻量级流媒体代理与直播源处理工具。针对软路由（OpenWrt）环境深度优化，完美解决复杂的 NAT/网桥痛点，实现开箱即用与一键智能化部署。

---

## ✨ 核心亮点

- **🌐 极致网络兼容（Host 模式）**：放弃传统的 Bridge 桥接网络，直接复用宿主机网络栈，彻底告别“无视频、连接超时、组播不通”等玄学问题。
- **🛡️ 稳定 DNS 容灾**：内置多线公共 DNS 强制指定，彻底解决软路由环境下常见的域名解析抖动与 `[Errno -3]` 报错。
- **⚡ V8 内存深度调优**：针对 Node.js 运行时进行垃圾回收（GC）与老生代内存限制，长期运行不溢出、切台丝滑。
- **🤖 智能一键部署**：内置智能检测脚本，自动识别运行状态，避免重复部署，让小白也能秒级上手。
- **📦 极简轻量化**：基于 Alpine Linux 基础镜像构建，资源占用极低，稳定运行不卡顿。
- **💾 数据持久化**：支持挂载本地存储，配置与核心数据实时保存，容器更新升级不丢数据。

---

## ⚡ 一键智能部署（推荐）

在你的 OpenWrt 软路由或其他 Linux 终端中，直接复制并运行以下一行命令即可完成自动化检测、下载与部署：

```bash
sh -c "$(wget -O- https://raw.githubusercontent.com/tmxk2020/ysp-live/main/install.sh)"
```

> *注：脚本会自动检测容器运行状态。若已运行会友好提示；若未部署或需更新，会自动拉取最新源码并完成清理重建。*

---

## 🛠 手动部署指南（Docker Compose）

如果你喜欢手动管理，也可以使用 `docker-compose` 进行部署：

1. **编写 `docker-compose.yml`**：

```yaml
services:
  ysp-live:
    image: ysp-live:9.5
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ysp-live-v9.5
    restart: unless-stopped
    network_mode: host
    dns:
      - 223.5.5.5     # 阿里 DNS（国内解析极快）
      - 119.29.29.29  # 腾讯 DNS
      - 1.1.1.1       # 国际备用
    volumes:
      - ./data:/app/data
    environment:
      - TZ=Asia/Shanghai
      - PYTHONUNBUFFERED=1
      - YSP_DATA_DIR=/app/data
      - NODE_OPTIONS="--max-old-space-size=256 --optimize-for-size"  # 优化 V8 内存与垃圾回收
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

2. **构建并后台启动**：

```bash
docker compose up -d --build
```

---

## ❓ 常见问题与解决办法

### 1. 启动时提示容器名冲突 (`Conflict. The container name is already in use`)
- **原因**：本地已经存在同名的旧容器未清理。
- **解决办法**：
  ```bash
  docker rm -f ysp-live-v9.5
  docker compose up -d
  ```

### 2. 访问端口冲突或无法访问
- **原因**：默认端口 `8767` 可能已被软路由上的其他服务占用。
- **解决办法**：因为采用了 `network_mode: host`，服务直接绑定在宿主机端口。如需修改，请调整代码中的服务监听逻辑或避开该端口。

---

## 🔗 相关链接与社区

- **官方网站**：[tmxk.pp.ua](https://tmxk.pp.ua)
- **联系我们 / 交流反馈**：[tmxk.pp.ua/d/10-lian-xi-wo-men](https://tmxk.pp.ua/d/10-lian-xi-wo-men)

---

## 📢 首发地址

- **频道**：[TMXKの分享](https://t.me/tmxktg)

---

## 🎉 原代码地址

- **频道**：[Gary's Club Channel](https://t.me/garysclubchannel)


