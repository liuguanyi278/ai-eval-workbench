import 'dotenv/config'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getProvider } from './providers/index.mjs'
import { runJudge } from './judge.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = join(root, 'dist')
const port = Number(process.env.PORT || 3001)
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'}

function json(res, status, body) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8'})
  res.end(JSON.stringify(body))
}

async function readJson(req) {
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (body.length > 1_000_000) throw Object.assign(new Error('请求内容过大。'), {statusCode:413})
  }
  try { return JSON.parse(body || '{}') } catch { throw Object.assign(new Error('请求体必须是合法 JSON。'), {statusCode:400}) }
}

function validateChat(body) {
  const required = ['provider','model','systemPrompt','userInput','temperature']
  for (const key of required) if (!(key in body)) throw Object.assign(new Error(`缺少请求字段：${key}`), {statusCode:400})
  if (typeof body.provider !== 'string' || typeof body.model !== 'string' || typeof body.systemPrompt !== 'string' || typeof body.userInput !== 'string') throw Object.assign(new Error('Chat 请求字段类型不正确。'), {statusCode:400})
  if (!body.userInput.trim()) throw Object.assign(new Error('userInput 不能为空。'), {statusCode:400})
  if (typeof body.temperature !== 'number' || body.temperature < 0 || body.temperature > 2) throw Object.assign(new Error('temperature 必须是 0 到 2 之间的数字。'), {statusCode:400})
  return body
}

function validateJudge(body) {
  if (typeof body.provider !== 'string' || !body.provider.trim()) throw Object.assign(new Error('provider 不能为空。'), {statusCode:400})
  if (body.provider.trim().toLowerCase() !== 'qwen') throw Object.assign(new Error('Judge Provider 暂未接入，当前仅支持 Qwen。'), {statusCode:400})
  const stringFields = ['judgeModel','judgeSystemPrompt','judgeUserPromptTemplate','testCaseTitle','userInput','expectedAnswer','evaluationCriteria','promptName','promptContent','modelProvider','actualModel','modelOutput']
  for (const key of stringFields) if (body[key] !== undefined && typeof body[key] !== 'string') throw Object.assign(new Error(`Judge 请求字段类型不正确：${key}`), {statusCode:400})
  if (!body.modelOutput?.trim()) throw Object.assign(new Error('modelOutput 不能为空。'), {statusCode:400})
  return body
}

async function serveStatic(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1)
  const safePath = normalize(join(dist, relative))
  if (!safePath.startsWith(dist)) return json(res, 403, {error:'禁止访问。'})
  let path = safePath
  try { if (!(await stat(path)).isFile()) path = join(dist, 'index.html') } catch { path = join(dist, 'index.html') }
  try {
    const content = await readFile(path)
    res.writeHead(200, {'Content-Type':types[extname(path)] || 'application/octet-stream'})
    res.end(content)
  } catch { json(res, 404, {error:'前端构建文件不存在，请先运行 npm run build。'}) }
}

createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/chat') {
      const input = validateChat(await readJson(req))
      return json(res, 200, await getProvider(input.provider).chat(input))
    }
    if (req.method === 'POST' && req.url === '/api/judge') {
      const input = validateJudge(await readJson(req))
      return json(res, 200, await runJudge(input))
    }
    if (req.method === 'GET' && (req.url === '/health' || req.url === '/api/health')) return json(res, 200, {status:'ok',providers:['qwen']})
    if (req.url?.startsWith('/api/')) return json(res, 404, {error:'API 路由不存在。'})
    await serveStatic(req, res)
  } catch (error) {
    console.error(error)
    json(res, error.statusCode || 500, {
      error:error.message || '服务器内部错误。',
      details:typeof error.details === 'string' ? error.details.slice(0, 500) : ''
    })
  }
}).listen(port, '127.0.0.1', () => console.log(`AI Eval API listening on http://127.0.0.1:${port}`))
