# APEX 反应测试 + 排行榜

这是电竞社 APEX 分部用于招新活动的“反应测试 + 排行榜”网站。

- 前端：React + TypeScript + Vite + Tailwind CSS
- 后端：Node.js + Express + TypeScript
- 数据存储：文本文件（每行 `rank,reactiountime,time,code,info`）

## 快速开始（开发）

```bash
# 第一次安装依赖（分别安装前后端）
npm install         # 安装根工具（concurrently）
npm run setup       # 安装 frontend/ 与 backend/ 依赖

# 启动前后端（并行）
npm run dev
```

- 前端开发地址：http://localhost:5173
- 后端开发地址：http://localhost:3000

## 生产构建与启动

```bash
# 构建前端和后端
npm run build

# 启动后端（会同时托管前端静态资源）
npm start
```

- 生产服务默认端口：3000（可通过环境变量 `PORT` 覆盖）

## 使用 Docker Compose 部署（静默运行）

项目包含一个 `docker-compose.yml`，可以将服务打包成容器并在宿主机上静默运行。

- Compose 会把容器内的 3000 端口映射到宿主机的 8081：
  - 访问地址： http://localhost:8081/
- 数据持久化：`./backend/backend/data` 已在 compose 中挂载为 volume 到容器内的 `/app/backend/data`，这样容器重建时排行榜数据不会丢失。

使用示例命令：

```bash
# 在项目根构建并后台启动
docker compose up --build -d

# 查看运行状态
docker compose ps

# 查看日志（实时）
docker compose logs -f

# 停止并移除容器
docker compose down
```

如果你只是想快速在本地测试构建产物（不使用 docker），也可以先运行 `npm run build` 然后 `cd backend && npm start`，服务仍然监听在 `PORT`（默认 3000）。

## 文件格式说明

- `backend/data/leaderboard.txt` 文本格式：
  - 每行：`rank,reactiountime,time,code,info`
  - `reactiountime` 单位毫秒（5 次有效测试的平均值，越低越好）
  - `time` 为完成测试提交的 ISO 时间戳
  - `code` 为唯一 6 位数字领取码
  - `info` 为用户额外信息（最长 32 字，内含英文逗号会被替换为中文逗号）

## API 摘要

- GET `/api/leaderboard` -> 返回排行榜数组（按 rank 升序）
- POST `/api/submit` { reactionTime:number, info?:string } -> 返回 { rank, code, entry, leaderboard }

## 注意

- 反应测试环节的颜色切换为瞬时切换，计时使用 `performance.now()`，避免动画影响。
