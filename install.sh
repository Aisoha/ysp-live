
#!/bin/sh
set -eu

# ==============================
# ysp-live 智能部署 / 版本升级脚本
# ==============================

INSTALL_DIR="/root/ysp-live"
STAGE_DIR="/root/ysp-live-update.$$"
ZIP_URL="https://github.com/tmxk2020/ysp-live/archive/refs/heads/main.zip"

DEFAULT_CONTAINER="ysp-live-v9.6"
OLD_CONTAINER="ysp-live-v9.5"

cleanup() {
    rm -rf "$STAGE_DIR"
}
trap cleanup EXIT INT TERM

echo "=========================================="
echo "       ysp-live 智能部署管理程序"
echo "=========================================="

# 检查依赖
for cmd in docker wget unzip grep sed awk; do
    command -v "$cmd" >/dev/null 2>&1 || {
        echo "[错误] 缺少命令: $cmd"
        exit 1
    }
done

docker compose version >/dev/null 2>&1 || {
    echo "[错误] Docker Compose 插件不可用"
    exit 1
}

# 从源码中识别版本号
get_version() {
    DIR="$1"

    PYFILE=$(find "$DIR" -maxdepth 1 -type f \
        \( -name 'ysp-live-v*.py' -o -name 'ysp-live.py' \) \
        | sort | head -n 1)

    [ -n "$PYFILE" ] || return 1

    VERSION=$(grep -Eo 'ysp-live v[0-9]+(\.[0-9]+){1,2}' "$PYFILE" \
        | head -n 1 | sed 's/.* v//')

    [ -n "$VERSION" ] || return 1

    echo "$VERSION"
}

# 从 compose 文件读取容器名称
get_container_name() {
    FILE="$1"

    NAME=$(sed -n \
        's/^[[:space:]]*container_name:[[:space:]]*//p' \
        "$FILE" 2>/dev/null | head -n 1 | tr -d "\"'")

    [ -n "$NAME" ] && echo "$NAME" || echo "$DEFAULT_CONTAINER"
}

# 检查本地安装版本
CURRENT_VERSION="未安装"

if [ -d "$INSTALL_DIR" ]; then
    CURRENT_VERSION=$(get_version "$INSTALL_DIR" 2>/dev/null || echo "未知")
fi

CURRENT_CONTAINER="$DEFAULT_CONTAINER"

if [ -f "$INSTALL_DIR/docker-compose.yml" ]; then
    CURRENT_CONTAINER=$(get_container_name "$INSTALL_DIR/docker-compose.yml")
elif [ -f "$INSTALL_DIR/compose.yml" ]; then
    CURRENT_CONTAINER=$(get_container_name "$INSTALL_DIR/compose.yml")
fi

echo "[信息] 当前安装版本: $CURRENT_VERSION"
echo "[信息] 当前容器名称: $CURRENT_CONTAINER"

# 下载 GitHub 最新源码
mkdir -p "$STAGE_DIR"

echo
echo "[1/4] 正在检查 GitHub 最新版本..."

if ! wget -q "$ZIP_URL" -O "$STAGE_DIR/source.zip"; then
    echo "[错误] GitHub 源码下载失败，未执行任何升级操作。"
    exit 1
fi

if ! unzip -q "$STAGE_DIR/source.zip" -d "$STAGE_DIR"; then
    echo "[错误] 源码解压失败。"
    exit 1
fi

SOURCE_DIR="$STAGE_DIR/ysp-live-main"

[ -d "$SOURCE_DIR" ] || {
    echo "[错误] 未找到源码目录。"
    exit 1
}

[ -f "$SOURCE_DIR/Dockerfile" ] || {
    echo "[错误] 下载包中缺少 Dockerfile。"
    exit 1
}

LATEST_VERSION=$(get_version "$SOURCE_DIR" 2>/dev/null || true)

if [ -z "$LATEST_VERSION" ]; then
    echo "[错误] 无法识别 GitHub 最新版本号。"
    echo "[提示] 为避免误升级，已停止操作。"
    exit 1
fi

echo "[信息] GitHub 最新版本: $LATEST_VERSION"
echo

# ==============================
# 版本一致：不升级
# ==============================

if [ "$CURRENT_VERSION" = "$LATEST_VERSION" ]; then
    echo "=========================================="
    echo "[状态] 当前已经是最新版本！"
    echo "[状态] 无需升级，不会修改现有容器。"
    echo "=========================================="

    echo
    echo "如需手动停止并重新部署，请执行："
    echo
    echo "1. 停止容器："
    echo "docker stop $CURRENT_CONTAINER"
    echo
    echo "2. 删除旧容器（保留 data 数据）："
    echo "docker rm $CURRENT_CONTAINER"
    echo
    echo "3. 重新构建并部署："
    echo "cd $INSTALL_DIR && docker compose up -d --build --force-recreate"
    echo
    echo "=========================================="
    exit 0
fi

# ==============================
# 版本不同：自动升级
# ==============================

echo "=========================================="
echo "[升级] 检测到新版本！"
echo "[升级] 当前版本: $CURRENT_VERSION"
echo "[升级] 最新版本: $LATEST_VERSION"
echo "[升级] 即将执行一键升级..."
echo "=========================================="

mkdir -p "$INSTALL_DIR"

# 获取新版本容器名称
NEW_CONTAINER="$DEFAULT_CONTAINER"

if [ -f "$SOURCE_DIR/docker-compose.yml" ]; then
    NEW_CONTAINER=$(get_container_name "$SOURCE_DIR/docker-compose.yml")
elif [ -f "$SOURCE_DIR/compose.yml" ]; then
    NEW_CONTAINER=$(get_container_name "$SOURCE_DIR/compose.yml")
fi

# 备份持久化数据
if [ -d "$INSTALL_DIR/data" ]; then
    echo "[2/4] 备份 data 持久化数据..."
    cp -a "$INSTALL_DIR/data" "$STAGE_DIR/data-backup"
fi

# 更新程序文件
echo "[3/4] 更新程序文件..."

cp -R "$SOURCE_DIR/." "$INSTALL_DIR/"

# 恢复 data，确保设备身份和持久化状态不丢失
if [ -d "$STAGE_DIR/data-backup" ]; then
    rm -rf "$INSTALL_DIR/data"
    mv "$STAGE_DIR/data-backup" "$INSTALL_DIR/data"
else
    mkdir -p "$INSTALL_DIR/data"
fi

cd "$INSTALL_DIR"

# 构建新镜像
echo "[4/4] 正在构建最新版 Docker 镜像..."
docker compose build

# 删除旧版本容器及目标同名容器
docker rm -f "$OLD_CONTAINER" >/dev/null 2>&1 || true
docker rm -f "$CURRENT_CONTAINER" >/dev/null 2>&1 || true

if [ "$NEW_CONTAINER" != "$CURRENT_CONTAINER" ]; then
    docker rm -f "$NEW_CONTAINER" >/dev/null 2>&1 || true
fi

# 启动新版本
docker compose up -d --force-recreate

echo
echo "=========================================="
echo "[成功] ysp-live 已完成升级！"
echo "[版本] $CURRENT_VERSION -> $LATEST_VERSION"
echo "[容器] $NEW_CONTAINER"
echo "=========================================="
echo "访问地址: http://<服务器IP>:8767/all.m3u"
echo "诊断地址: http://<服务器IP>:8767/diag"
echo "数据目录: $INSTALL_DIR/data（已保留）"
echo
echo "查看运行日志："
echo "docker logs -f $NEW_CONTAINER"
echo "=========================================="
