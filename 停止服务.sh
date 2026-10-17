#!/bin/bash
# 停止本地随机化服务
script_dir=$(cd "$(dirname "$0")"; pwd)
pidfile="$script_dir/engine/server.pid"
if [ -f "$pidfile" ]; then
  pid=$(cat "$pidfile")
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid"
    rm -f "$pidfile"
    echo "服务已停止 (PID $pid)"
  else
    rm -f "$pidfile"
    echo "服务未在运行（清理残留 pidfile）"
  fi
else
  echo "未找到 pidfile，服务可能未运行"
fi
