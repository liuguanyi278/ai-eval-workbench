export type Modality = 'text' | 'image' | 'document' | 'audio' | 'video'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type BadCaseType = '无' | '事实错误' | '遗漏关键信息' | '格式不合规' | '答非所问' | '幻觉' | '表达不清' | '风险话术'

export interface EvalProject { id: string; name: string; description: string; scenario: string }
export interface TestCase { id: string; title: string; modality: Modality; inputText: string; expectedAnswer: string; evaluationCriteria: string; tags: string[]; difficulty: Difficulty }
export interface PromptVersion { id: string; name: string; content: string; changelog: string; taskType: string; createdAt: string }
export interface ModelProfile { id: string; name: string; text: number; vision: number; audio: number; video: number; longContext: number; structuredOutput: number; toolUse: number; reasoning: number; chinese: number; costLevel: '低' | '中' | '高'; bestFor: string; limitations: string }
export interface DimensionScores { accuracy: number; completeness: number; format: number; usefulness: number; safety: number }
export interface ModelUsage { promptTokens: number; completionTokens: number; totalTokens: number }
export interface ChatRequest { provider: string; model: string; systemPrompt: string; userInput: string; temperature: number }
export interface ChatResponse { provider: string; model: string; output: string; latencyMs: number; usage: ModelUsage }
export interface JudgeRequest {
  provider: string
  judgeModel: string
  judgeSystemPrompt: string
  judgeUserPromptTemplate: string
  testCaseTitle: string
  userInput: string
  expectedAnswer: string
  evaluationCriteria: string
  promptName: string
  promptContent: string
  modelProvider: string
  actualModel: string
  modelOutput: string
}
export interface JudgeResponse {
  score: number
  dimensionScores: DimensionScores
  badCaseType: BadCaseType
  judgeComment: string
  suggestion: string
  judgeProvider: string
  judgeModel: string
  judgeLatencyMs: number
  judgeTokenUsage: ModelUsage
  judgeSystemPrompt: string
  judgeUserPrompt: string
}
export interface EvalResult {
  id: string
  testCaseId: string
  promptVersionId: string
  testCaseTitleSnapshot: string
  testCaseInputSnapshot: string
  expectedAnswerSnapshot: string
  evaluationCriteriaSnapshot: string
  promptVersionNameSnapshot: string
  promptContentSnapshot: string
  modelId: string
  modelName: string
  provider?: string
  providerName?: string
  actualModel?: string
  modelDisplayName?: string
  tokenUsage?: ModelUsage
  /** @deprecated V1 compatibility alias */
  apiModel?: string
  /** @deprecated V1 compatibility alias */
  usage?: ModelUsage
  modality: Modality
  runMode: 'mock' | 'real'
  temperature?: number
  modelOutput: string
  latencyMs: number
  score: number
  dimensionScores: DimensionScores
  badCaseType: BadCaseType
  judgeComment: string
  suggestion: string
  judgeMode?: 'mock' | 'real'
  judgeProvider?: string
  judgeModel?: string
  judgeSystemPromptSnapshot?: string
  judgeUserPromptSnapshot?: string
  judgeLatencyMs?: number
  judgeTokenUsage?: ModelUsage
  batchId?: string
  batchName?: string
  batchIndex?: number
  batchTotal?: number
  createdAt: string
}
