#!/bin/sh
set -e

# Sealos/Kubernetes 的 PVC 挂载到 /data 后，目录 owner 是 root，
# 而容器运行时以非 root 用户 (app) 运行，会导致 better-sqlite3 无法
# 创建/打开 /data/yuanqing.db。这里在启动时以 root 身份修正所有权，
# 再降权到 app 用户执行 node server.js。
if [ -d /data ]; then
  chown -R app:app /data 2>/dev/null || echo "[entrypoint] warning: cannot chown /data"
fi

# 从 root 降权到 app 用户后执行主命令
if [ "$(id -u)" = "0" ]; then
  exec runuser -u app -- "$@"
fi

exec "$@"
