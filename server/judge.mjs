import { getProvider } from './providers/index.mjs'

export const DEFAULT_JUDGE_SYSTEM_PROMPT = '你是一个严谨的 AI 产品评测员，负责根据测试用例、期望答案和评分标准，对模型输出进行结构化评分。你必须只返回合法 JSON，不要输出 Markdown，不要输出解释性前言。'

export const DEFAULT_JUDGE_USER_PROMPT_TEMPLATE = `请评测以下 AI 模型输出。

测试用例标题：
{{testCaseTitle}}

用户输入：
{{userInput}}

期望答案：
{{expectedAnswer}}

评分标准：
{{evaluationCriteria}}

Prompt 名称：
{{promptName}}

Prompt 内容：
{{promptContent}}

被评测模型：
{{modelProvider}} / {{actualModel}}

被评测模型输出：
{{modelOutput}}

请只返回以下结构的合法 JSON，不要使用 Markdown 代码块：
{
  "score": 0-100,
  "dimensionScores": {
    "accuracy": 0-20,
    "completeness": 0-20,
    "format": 0-20,
    "usefulness": 0-20,
    "safety": 0-20
  },
  "badCaseType": "无 | 事实错误 | 遗漏关键信息 | 格式不合规 | 答非所问 | 幻觉 | 表达不清 | 风险话术",
  "judgeComment": "评审意见",
  "suggestion": "优化建议"
}`

const TEMPLATE_FIELDS = ['testCaseTitle','userInput','expectedAnswer','evaluationCriteria','promptName','promptContent','modelProvider','actualModel','modelOutput']
const BAD_CASE_TYPES = new Set(['无','事实错误','遗漏关键信息','格式不合规','答非所问','幻觉','表达不清','风险话术'])
const DIMENSIONS = ['accuracy','completeness','format','usefulness','safety']

export function renderJudgeTemplate(template, values) {
  const source = typeof template === 'string' && template.trim() ? template : DEFAULT_JUDGE_USER_PROMPT_TEMPLATE
  return TEMPLATE_FIELDS.reduce((result, field) => {
    const value = typeof values[field] === 'string' && values[field].trim() ? values[field] : '未提供'
    return result.replace(new RegExp(`{{\\s*${field}\\s*}}`, 'g'), () => value)
  }, source)
}

function parseCandidate(candidate) {
  try { return JSON.parse(candidate) } catch { return null }
}

export function parseJudgeOutput(output) {
  const raw = typeof output === 'string' ? output.trim() : ''
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim()
  const objectText = raw.includes('{') && raw.includes('}') ? raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1) : ''
  const parsed = [fenced, raw, objectText].filter(Boolean).map(parseCandidate).find(Boolean)
  if (!parsed || typeof parsed !== 'object') return null
  const score = Number(parsed.score)
  const dimensionScores = parsed.dimensionScores
  const validDimensions = dimensionScores && DIMENSIONS.every(key => Number.isFinite(Number(dimensionScores[key])) && Number(dimensionScores[key]) >= 0 && Number(dimensionScores[key]) <= 20)
  if (!Number.isFinite(score) || score < 0 || score > 100 || !validDimensions || !BAD_CASE_TYPES.has(parsed.badCaseType) || typeof parsed.judgeComment !== 'string' || typeof parsed.suggestion !== 'string') return null
  return {
    score:Math.round(score),
    dimensionScores:Object.fromEntries(DIMENSIONS.map(key => [key, Number(dimensionScores[key])])),
    badCaseType:parsed.badCaseType,
    judgeComment:parsed.judgeComment,
    suggestion:parsed.suggestion
  }
}

export async function runJudge(input) {
  const judgeProvider = input.provider.trim().toLowerCase()
  const judgeModel = (input.judgeModel || process.env.QWEN_JUDGE_MODEL || 'qwen-plus').trim()
  const judgeSystemPrompt = input.judgeSystemPrompt?.trim() || DEFAULT_JUDGE_SYSTEM_PROMPT
  const judgeUserPrompt = renderJudgeTemplate(input.judgeUserPromptTemplate, input)
  console.log('[AI Judge] judgeProvider:', judgeProvider)
  console.log('[AI Judge] judgeModel:', judgeModel)
  let parseSucceeded = false
  try {
    const response = await getProvider(judgeProvider).chat({
      provider:judgeProvider,
      model:judgeModel,
      systemPrompt:judgeSystemPrompt,
      userInput:judgeUserPrompt,
      temperature:0
    })
    const judgement = parseJudgeOutput(response.output)
    parseSucceeded = Boolean(judgement)
    console.log('[AI Judge] status:', judgement ? 200 : 502)
    console.log('[AI Judge] latencyMs:', response.latencyMs)
    console.log('[AI Judge] tokenUsage:', response.usage)
    console.log('[AI Judge] JSON parse success:', parseSucceeded)
    if (!judgement) {
      const error = new Error('AI Judge 返回格式解析失败，请重试或检查 Judge Prompt。')
      error.statusCode = 502
      error.details = response.output.slice(0, 500)
      throw error
    }
    return {
      ...judgement,
      judgeProvider:response.provider || judgeProvider,
      judgeModel:response.model || judgeModel,
      judgeLatencyMs:response.latencyMs,
      judgeTokenUsage:response.usage,
      judgeSystemPrompt,
      judgeUserPrompt
    }
  } catch (error) {
    if (!parseSucceeded) console.log('[AI Judge] JSON parse success:', false)
    console.log('[AI Judge] status:', error.statusCode || 500)
    throw error
  }
}
