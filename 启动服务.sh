#!/bin/bash
# 启动本地随机化服务（后台运行，端口 18688）
script_dir=$(cd "$(dirname "$0")"; pwd)
node="$script_dir/runtime/node/bin/node"
if [ -f "$script_dir/engine/server.pid" ] && kill -0 "$(cat "$script_dir/engine/server.pid")" 2>/dev/null; then
  echo "服务已在运行 (PID $(cat "$script_dir/engine/server.pid"))"
  exit 0
fi
cd "$script_dir/engine"
setsid "$node" server.js > server.log 2>&1 < /dev/null &
sleep 1
if [ -f server.pid ] && kill -0 "$(cat server.pid)" 2>/dev/null; then
  echo "服务已启动: http://localhost:18688  (PID $(cat server.pid))"
else
  echo "启动失败，请查看 engine/server.log"
fi
