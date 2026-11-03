#!/bin/sh
set -eu

CONTAINER_NAME="ysp-live-v9.6"
OLD_CONTAINER_NAME="ysp-live-v9.5"
INSTALL_DIR="/root/ysp-live"
STAGE_DIR="/root/ysp-live-update.$$"
ZIP_URL="https://github.com/tmxk2020/ysp-live/archive/refs/heads/main.zip"

cleanup() { rm -rf "$STAGE_DIR"; }
trap cleanup EXIT INT TERM

command -v docker >/dev/null 2>&1 || { echo "[错误] 未安装 Docker"; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "[错误] 当前 Docker 未安装 Compose 插件"; exit 1; }
command -v wget >/dev/null 2>&1 || { echo "[错误] 未安装 wget"; exit 1; }
command -v unzip >/dev/null 2>&1 || { echo "[错误] 未安装 unzip"; exit 1; }

if [ "$(docker ps -q -f "name=^/${CONTAINER_NAME}$")" ]; then
  echo "[提示] ysp-live v9.6 已在运行，无需重复部署。"
  exit 0
fi

mkdir -p "$STAGE_DIR" "$INSTALL_DIR"
echo "[1/4] 下载 GitHub 最新源码..."
wget -q --show-progress "$ZIP_URL" -O "$STAGE_DIR/source.zip"
unzip -q "$STAGE_DIR/source.zip" -d "$STAGE_DIR"
SOURCE_DIR="$STAGE_DIR/ysp-live-main"
[ -f "$SOURCE_DIR/ysp-live-v9.6.py" ] || { echo "[错误] 下载包中缺少 ysp-live-v9.6.py"; exit 1; }
[ -f "$SOURCE_DIR/Dockerfile" ] || { echo "[错误] 下载包中缺少 Dockerfile"; exit 1; }

# 先备份 data，再覆盖程序文件，防止升级清空设备身份和缓存状态。
if [ -d "$INSTALL_DIR/data" ]; then
  cp -a "$INSTALL_DIR/data" "$STAGE_DIR/data-backup"
fi
echo "[2/4] 更新程序文件（保留 data 数据）..."
cp -R "$SOURCE_DIR/." "$INSTALL_DIR/"
if [ -d "$STAGE_DIR/data-backup" ]; then
  rm -rf "$INSTALL_DIR/data"
  mv "$STAGE_DIR/data-backup" "$INSTALL_DIR/data"
else
  mkdir -p "$INSTALL_DIR/data"
fi

cd "$INSTALL_DIR"
echo "[3/4] 构建 v9.6 镜像..."
docker compose build

docker rm -f "$OLD_CONTAINER_NAME" >/dev/null 2>&1 || true
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker compose up -d --force-recreate

echo "[4/4] 部署完成！"
echo "访问地址: http://<服务器IP>:8767/all.m3u"
echo "诊断地址: http://<服务器IP>:8767/diag"
echo "数据目录: $INSTALL_DIR/data（升级时保留）"
