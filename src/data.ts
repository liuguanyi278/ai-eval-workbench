import type { EvalProject, TestCase, PromptVersion, ModelProfile, EvalResult } from './types'

export const project: EvalProject = { id: 'p1', name: '老人自传生成工作流评测', description: '用于测试老人自传生成流程中的事实提取、结构化整理、文学化生成和格式稳定性。', scenario: '事实提取 · 结构化整理 · 文学化生成 · 格式校验' }
export const testCases: TestCase[] = [
  { id:'tc1', title:'童年经历事实提取', modality:'text', inputText:'我叫李建国，1948 年出生在苏州。父亲是木匠，母亲在家照顾我们五个孩子。我八岁进入平江路小学，最喜欢语文课。', expectedAnswer:'姓名：李建国；出生年份：1948；出生地：苏州；父亲职业：木匠；兄弟姐妹共五人；入学年龄：8岁；学校：平江路小学；喜爱科目：语文。', evaluationCriteria:'事实完整、无虚构；使用清晰的结构化字段；年份与人数准确。', tags:['信息抽取','童年'], difficulty:'easy' },
  { id:'tc2', title:'职业生涯文学化改写', modality:'text', inputText:'1968年我进了上海纺织厂，从学徒做起。三年后成为技术员。1985年我负责的节能改造让车间用电降低了15%。1998年退休。', expectedAnswer:'以第一人称叙事，保留全部年份、职位变化和15%的节能成果，语言温暖克制，不虚构细节。', evaluationCriteria:'时间线准确；语言自然有感染力；不添加原文没有的人物或事件；字数 180 字以内。', tags:['内容生成','职业'], difficulty:'medium' },
  { id:'tc3', title:'矛盾信息识别与澄清', modality:'text', inputText:'我1952年出生。记得1960年，十五岁的我第一次离开家乡。后来我在1968年高中毕业。', expectedAnswer:'指出1960年时按出生年份应为8岁，而非15岁；在继续写作前请求确认出生年份或事件年份。', evaluationCriteria:'识别年龄与年份冲突；不得自行修正；提出明确、友好的澄清问题。', tags:['事实校验','边界测试'], difficulty:'hard' }
]
export const promptVersions: PromptVersion[] = [
  { id:'pv1', name:'Prompt V1', content:'你是一名严谨的口述史整理助手。请根据用户材料完成任务，忠实保留事实，不补充未提供的信息。输出应清晰、简洁。', changelog:'初始版本，强调事实忠实。', taskType:'信息抽取', createdAt:'2026-07-01T09:00:00.000Z' },
  { id:'pv2', name:'Prompt V2', content:'你是一名资深自传编辑。先检查材料中的时间、人物与事件是否一致；若有矛盾先提出澄清。内容生成时使用温暖克制的第一人称表达，并严格遵循用户给出的格式与字数要求。', changelog:'增加冲突检查、写作风格和格式约束。', taskType:'内容生成', createdAt:'2026-07-06T10:30:00.000Z' }
]
export const models: ModelProfile[] = [
  {id:'deepseek',name:'DeepSeek',text:5,vision:3,audio:1,video:1,longContext:4,structuredOutput:4,toolUse:4,reasoning:5,chinese:5,costLevel:'低',bestFor:'中文推理、复杂分析、成本敏感任务',limitations:'多模态覆盖有限，长任务需关注格式漂移'},
  {id:'gpt',name:'GPT',text:5,vision:5,audio:5,video:3,longContext:4,structuredOutput:5,toolUse:5,reasoning:5,chinese:4,costLevel:'高',bestFor:'通用复杂任务、多模态与工具调用',limitations:'高频调用成本较高'},
  {id:'gemini',name:'Gemini',text:5,vision:5,audio:4,video:5,longContext:5,structuredOutput:4,toolUse:4,reasoning:4,chinese:4,costLevel:'中',bestFor:'超长上下文、视频与多模态理解',limitations:'复杂格式输出需加强约束'},
  {id:'claude',name:'Claude',text:5,vision:4,audio:1,video:1,longContext:5,structuredOutput:4,toolUse:4,reasoning:5,chinese:4,costLevel:'高',bestFor:'长文分析、写作与安全敏感任务',limitations:'原生音视频能力有限'},
  {id:'qwen',name:'Qwen',text:5,vision:4,audio:4,video:4,longContext:4,structuredOutput:4,toolUse:4,reasoning:4,chinese:5,costLevel:'低',bestFor:'中文业务、多模态与本地化场景',limitations:'不同型号能力差异较大'},
  {id:'kimi',name:'Kimi',text:5,vision:4,audio:2,video:2,longContext:5,structuredOutput:4,toolUse:3,reasoning:4,chinese:5,costLevel:'中',bestFor:'中文长文档阅读与资料整理',limitations:'复杂工具编排场景需验证'}
]
export const results: EvalResult[] = [
 {id:'er1',testCaseId:'tc1',promptVersionId:'pv1',testCaseTitleSnapshot:testCases[0].title,testCaseInputSnapshot:testCases[0].inputText,expectedAnswerSnapshot:testCases[0].expectedAnswer,evaluationCriteriaSnapshot:testCases[0].evaluationCriteria,promptVersionNameSnapshot:promptVersions[0].name,promptContentSnapshot:promptVersions[0].content,modelId:'qwen',modelName:'Qwen',modality:'text',runMode:'mock',modelOutput:'姓名：李建国\n出生：1948年，苏州\n家庭：父亲为木匠，母亲照顾五个孩子\n教育：8岁就读平江路小学，喜爱语文。',latencyMs:1280,score:92,dimensionScores:{accuracy:95,completeness:90,format:94,usefulness:91,safety:100},badCaseType:'无',judgeComment:'关键事实提取完整，结构清晰。',suggestion:'可将家庭成员数量表述得更严谨。',createdAt:'2026-07-10T08:20:00.000Z'},
 {id:'er2',testCaseId:'tc3',promptVersionId:'pv1',testCaseTitleSnapshot:testCases[2].title,testCaseInputSnapshot:testCases[2].inputText,expectedAnswerSnapshot:testCases[2].expectedAnswer,evaluationCriteriaSnapshot:testCases[2].evaluationCriteria,promptVersionNameSnapshot:promptVersions[0].name,promptContentSnapshot:promptVersions[0].content,modelId:'deepseek',modelName:'DeepSeek',modality:'text',runMode:'mock',modelOutput:'1960年，十五岁的我第一次离开家乡；八年后，我顺利高中毕业。',latencyMs:1640,score:58,dimensionScores:{accuracy:42,completeness:55,format:85,usefulness:48,safety:80},badCaseType:'事实错误',judgeComment:'未识别年龄与出生年份的明显冲突，直接延续了错误叙事。',suggestion:'增加时间线一致性检查，遇到冲突时暂停生成并向用户澄清。',createdAt:'2026-07-11T13:45:00.000Z'}
]
export const INITIAL = { project, testCases, promptVersions, models, results }
