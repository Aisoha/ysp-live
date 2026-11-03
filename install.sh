#!/bin/sh

CONTAINER_NAME="ysp-live-v9.5"
INSTALL_DIR="/root/ysp-live"

echo "========================================="
echo "  开始检查 ysp-live 部署状态..."
echo "========================================="

# 1. 智能检测：如果容器已经在运行，直接提示并退出
if [ "$(docker ps -q -f name=${CONTAINER_NAME})" ]; then
    echo "[提示] 检测到 ysp-live 容器已经在运行中，无需重复部署！"
    echo "[信息] 如需强制重新部署，请先执行: docker rm -f ${CONTAINER_NAME}"
    exit 0
fi

# 2. 如果容器曾经存在但停止了，或者目录不存在，开始全新部署
echo "[提示] 未检测到正在运行的 ysp-live 实例，开始自动部署..."

# 清理并创建工作目录
rm -rf ${INSTALL_DIR}
mkdir -p ${INSTALL_DIR} && cd ${INSTALL_DIR}

# 下载最新源码
echo "[1/3] 正在从 GitHub 下载最新源码..."
wget --no-check-certificate https://github.com/tmxk2020/ysp-live/archive/refs/heads/main.zip -O ysp-live.zip
unzip -q ysp-live.zip
cd ysp-live-main

#清理旧容器残留（防冲突）
docker rm -f ${CONTAINER_NAME} 2>/dev/null

# 构建并后台启动
echo "[2/3] 正在构建 Docker 镜像并启动容器..."
docker compose up -d --build

echo "========================================="
echo "[3/3] ysp-live 部署成功！"
echo "访问地址: http://<你的软路由IP>:8767/all.m3u"
echo "========================================="