# 智弈 (ZhiYi) — AI 中国象棋桌面应用

基于 Electron + Next.js 构建的中国象棋桌面应用，集成 Pikafish UCI 象棋引擎，支持人机对战、AI 教练提示、棋谱复盘三种模式。

## 环境要求

| 依赖 | 版本要求 | 说明 |
|------|---------|------|
| Node.js | ≥ 18.17（推荐 20 LTS 或 22） | Next.js 14 最低要求 |
| npm | ≥ 9 | 随 Node.js 一起安装 |
| Git | 任意版本 | 克隆仓库 |
| C++ 编译工具链 | — | 编译 better-sqlite3 原生模块（见下方说明） |

### 各平台 C++ 编译工具安装

**Windows：**
```
以管理员身份运行 PowerShell，执行：
npm install --global windows-build-tools
```
或者安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)，勾选"使用 C++ 的桌面开发"工作负载。

**macOS：**
```bash
xcode-select --install
```

**Linux (Debian/Ubuntu)：**
```bash
sudo apt install build-essential python3
```

## 新电脑快速上手

```bash
# 1. 克隆仓库
git clone <你的仓库地址> ai-chess-coach
cd ai-chess-coach

# 2. 安装依赖（会自动执行 postinstall 编译原生模块）
npm install

# 3. 启动开发环境
npm run electron:dev
```

`npm install` 结束后会自动执行 `electron-builder install-app-deps`，将 `better-sqlite3` 重新编译为当前 Electron 版本可用的原生模块。如果这一步报错，通常是缺少 C++ 编译工具，参考上一节安装即可。

## 项目结构速览

```
├── main/                  # Electron 主进程 (TypeScript)
│   ├── main.ts            # 窗口创建、IPC 处理、引擎生命周期
│   ├── preload.ts         # contextBridge 暴露 API 给渲染进程
│   ├── engine.ts          # UCI 引擎封装（启动/通信/销毁 Pikafish）
│   └── db.ts              # SQLite 只读数据库（棋谱库）
├── src/                   # Next.js 渲染进程 (React/TypeScript)
│   ├── app/               # 页面入口 (layout + page)
│   ├── components/        # UI 组件
│   ├── core/              # 中国象棋规则引擎 + 类型定义
│   ├── hooks/             # React Hooks（游戏状态、Electron IPC、存档等）
│   └── lib/               # 工具函数（FEN、PGN、UCI、音频、设置持久化）
├── engine/                # Pikafish UCI 引擎二进制文件（跨平台）
├── data/                  # 原始 PGN 棋谱数据
├── scripts/               # 辅助脚本（PGN 导入 SQLite）
├── public/sounds/         # 音效文件
├── dist/                  # electron-builder 打包输出目录
├── main-dist/             # 主进程 TypeScript 编译产物
└── out/                   # Next.js 静态导出产物
```

## 日常开发

### 启动开发环境

```bash
npm run electron:dev
```

这条命令会并行执行三件事：
1. `tsc -p tsconfig.main.json` — 编译 Electron 主进程
2. `next dev` — 启动 Next.js 开发服务器（热更新）
3. 等开发服务器就绪后自动启动 Electron 窗口

修改 `src/` 下的前端代码会自动热更新，修改 `main/` 下的主进程代码需要手动重启 Electron。

### 修改主进程代码后

主进程代码不支持热更新，修改 `main/` 目录下的文件后：

```bash
# 重新编译主进程
npm run build:electron

# 然后重新启动 Electron（在已运行的开发环境中关闭窗口再执行）
npm run electron:dev
```

### 仅调试前端（浏览器中）

```bash
npm run dev
```

这只会启动 Next.js 开发服务器，可以在浏览器中 `http://localhost:3000` 访问。注意：依赖 Electron IPC 的功能（引擎对弈、存档管理等）在浏览器中不可用。

## 版本迭代流程

每次发布新版本时，按以下步骤操作：

```bash
# 1. 拉取最新代码
git pull

# 2. 安装可能新增的依赖
npm install

# 3. 确认开发环境正常运行
npm run electron:dev

# 4. 修改 package.json 中的版本号
#    将 "version": "1.0.0" 改为新版本号，如 "1.1.0"

# 5. 提交版本号变更
git add package.json
git commit -m "chore: bump version to 1.1.0"

# 6. 生成安装包
npm run dist

# 7. 安装包在 dist/ 目录下，推送版本标签
git tag v1.1.0
git push origin main --tags
```

## 生成安装包

### 生成当前平台的安装包

```bash
npm run dist
```

这条命令会依次执行：
1. `next build` — 将前端编译为静态文件输出到 `out/`
2. `tsc -p tsconfig.main.json` — 编译主进程到 `main-dist/`
3. `electron-builder` — 打包为平台安装包

产物位置：
- **Windows**：`dist/智弈 Setup X.X.X.exe`（NSIS 安装程序）
- **macOS**：`dist/智弈-X.X.X.dmg`
- **Linux**：`dist/智弈-X.X.X.AppImage`

### 仅打包到目录（不生成安装包，用于调试）

```bash
npm run pack
```

产物在 `dist/win-unpacked/`（Windows），可直接双击运行，检查打包是否正常。

### 跨平台打包

electron-builder 只支持在当前平台打包对应平台的安装包：
- 在 Windows 上只能打 Windows 包（`.exe`）
- 在 macOS 上只能打 macOS 包（`.dmg`）
- 在 Linux 上只能打 Linux 包（`.AppImage`）

如果需要同时发布多平台安装包，推荐使用 GitHub Actions 分别在 Windows/macOS/Linux 的 CI 环境中构建。

## Pikafish 引擎说明

引擎二进制文件位于 `engine/皮卡鱼 20260131/` 目录，已按平台分好：

| 平台 | 目录 | 默认二进制 |
|------|------|-----------|
| Windows | `engine/皮卡鱼 20260131/` | `pikafish-bmi2.exe` |
| Linux | `engine/皮卡鱼 20260131/Linux/` | `pikafish` |
| macOS | `engine/皮卡鱼 20260131/MacOS/` | `pikafish` |

程序启动时会自动检测操作系统，加载对应的引擎二进制。`main/engine.ts` 第 71 行会根据 `process.platform` 自动拼接 `.exe` 后缀。

**更新引擎版本：**
1. 从 [Pikafish 官方发布页](https://github.com/official-pikafish/Pikafish/releases) 下载新版本
2. 替换 `engine/` 下对应平台的二进制文件和 `pikafish.nnue` 权重文件
3. 修改 `main/main.ts` 中的引擎路径常量

## 棋谱数据库

项目附带约 40,000 局历史棋谱，存储在 `chess_records.db`（SQLite，约 27 MB），已在 git 仓库中跟踪。

如需重新生成数据库（例如从新的 PGN 数据源导入）：

```bash
node scripts/import_pgn.js
```

脚本会读取 `data/` 目录下的 `.pgns` 文件并写入 `chess_records.db`。

## 常见问题

### `npm install` 报 better-sqlite3 编译错误

最常见的原因是缺少 C++ 编译工具。请参考上方"各平台 C++ 编译工具安装"一节。

### Electron 窗口打开后白屏

检查 `npm run dev` 能否在浏览器中正常打开 `http://localhost:3000`。如果浏览器也不行，检查 Next.js 编译是否有报错。

### 引擎加载失败

确认 `engine/皮卡鱼 20260131/` 目录下的二进制文件存在且与当前操作系统匹配。在资源管理器中检查文件大小是否正常（不应为 0 字节）。

### 安装包体积较大（~187 MB）

安装包体积主要由以下部分构成：
- Electron 运行时（~70 MB）
- Pikafish 引擎二进制（~50 MB，含神经网络权重文件）
- 棋谱数据库（~27 MB）
- 应用代码（~5 MB）
