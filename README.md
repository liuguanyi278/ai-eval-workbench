# AI 产品评测工作台

AI 产品评测工作台（`ai-eval-workbench`）面向 AI 产品经理、Prompt 工程师和 AI 应用开发者，用于管理测试用例、迭代 Prompt、调用模型、记录 Bad Case，并生成可追溯的评测报告。

## 核心功能

- 测试用例与 Prompt 版本管理
- Qwen 单条真实模型调用
- 可配置 Qwen AI Judge
- Mock / Real 数据区分和评测快照追溯
- 模型能力矩阵、Bad Case 管理和评测报告
- Prompt 对比分析
- 串行批量评测、进度展示和失败续跑
- localStorage 本地持久化

## 技术栈

- 前端：React、Vite、TypeScript、普通 CSS
- 后端：Node.js HTTP API、Qwen Provider Adapter
- 数据：浏览器 localStorage

## 本地启动

要求 Node.js 18 或更高版本。

```bash
npm install
copy .env.example .env
npm run dev
```

`npm run dev` 会同时启动：

- 前端：`http://localhost:5173`
- 后端：`http://127.0.0.1:3001`

本地未配置 `VITE_API_BASE_URL` 时，前端通过 Vite 的 `/api` proxy 访问后端。

生产构建：

```bash
npm run build
```

仅启动后端及已构建的静态文件：

```bash
npm start
```

## 环境变量

| 变量 | 使用位置 | 说明 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 前端 | 线上后端 Origin，例如 `https://api.example.com`；本地留空使用 `/api` proxy |
| `DASHSCOPE_API_KEY` | 后端 | Qwen API Key，优先于 `QWEN_API_KEY` |
| `QWEN_API_KEY` | 后端 | Qwen API Key 的兼容变量 |
| `QWEN_BASE_URL` | 后端 | OpenAI 兼容接口基础地址，不包含 `/chat/completions` |
| `QWEN_MODEL` | 后端 | 未指定模型时的默认 Qwen 模型 |
| `QWEN_JUDGE_MODEL` | 后端 | 默认 Judge 模型 |
| `CORS_ORIGIN` | 后端 | 允许的线上前端 Origin；多个地址可用英文逗号分隔，不要包含路径或末尾 `/` |
| `PORT` | 后端 | 服务端口，默认 `3001` |
| `HOST` | 后端 | 监听地址，默认 `0.0.0.0` |

所有带 `VITE_` 前缀的变量都会进入前端构建产物，因此绝对不要把 API Key 写入 `VITE_*` 环境变量。

## 前后端分开部署

### 前端部署到 Vercel

1. 导入仓库并选择 Vite 项目。
2. Build Command 使用 `npm run build`。
3. Output Directory 使用 `dist`。
4. 配置 `VITE_API_BASE_URL=https://你的后端域名`。
5. 重新部署，使环境变量写入前端构建产物。

### 后端部署到 Render / Railway / Zeabur

1. Build Command 使用 `npm install && npm run build`。
2. Start Command 使用 `npm start`。
3. 配置 `DASHSCOPE_API_KEY`、`QWEN_BASE_URL`、`QWEN_MODEL` 和 `QWEN_JUDGE_MODEL`。
4. 配置 `CORS_ORIGIN` 为 Vercel 前端的完整 Origin，例如 `https://your-app.vercel.app`。
5. 平台通常会自动注入 `PORT`；服务默认监听 `0.0.0.0`。

部署完成后访问：

```text
https://你的后端域名/api/health
```

预期返回：

```json
{"ok":true,"service":"ai-eval-api"}
```

## 数据与安全说明

当前版本不包含登录、数据库或云端同步。测试用例、Prompt 和评测记录均保存在当前浏览器的 localStorage，适合个人评测和作品集演示；清除浏览器缓存或更换设备会导致数据不可用。

Qwen API Key 只能配置在后端环境变量中。前端只向自己的后端发送评测请求，不应接触或保存 API Key。CORS 仅允许本地开发地址和 `CORS_ORIGIN` 配置的线上前端，不启用跨域凭据。
