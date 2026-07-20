import { useMemo, useRef, useState } from 'react'
import { Activity, AlertTriangle, BarChart3, Beaker, Bot, Boxes, Check, ChevronRight, CircleGauge, Clock3, FileBarChart, FlaskConical, LayoutDashboard, Plus, RotateCcw, Search, Sparkles, Tag, Trash2, X } from 'lucide-react'
import { INITIAL } from './data'
import { requestChat } from './api/chat'
import { requestJudge } from './api/judge'
import { DEFAULT_JUDGE_SYSTEM_PROMPT, DEFAULT_JUDGE_USER_PROMPT_TEMPLATE } from './judgeDefaults'
import type { BadCaseType, DimensionScores, EvalResult, ModelUsage, PromptVersion, TestCase } from './types'

type Tab = 'overview'|'cases'|'prompts'|'runner'|'models'|'badcases'|'report'
const TABS: {id:Tab; label:string; icon:typeof Activity}[] = [
  {id:'overview',label:'项目概览',icon:LayoutDashboard},{id:'cases',label:'测试用例',icon:Beaker},{id:'prompts',label:'Prompt 版本',icon:Boxes},{id:'runner',label:'Prompt 测试台',icon:FlaskConical},{id:'models',label:'模型能力矩阵',icon:CircleGauge},{id:'badcases',label:'Bad Case',icon:AlertTriangle},{id:'report',label:'评测报告',icon:FileBarChart},
]
const STORE = 'ai-eval-workbench-v0'
const RECENT_MODELS_STORE = 'ai-eval-workbench-recent-models'
const PROVIDERS = [
  {id:'qwen',name:'Qwen',defaults:['qwen-plus','qwen-turbo','qwen-max','qwen-long']},
  {id:'deepseek',name:'DeepSeek',defaults:['deepseek-chat']},
  {id:'openai',name:'OpenAI',defaults:['gpt-4.1']},
  {id:'gemini',name:'Gemini',defaults:['gemini-2.5-pro']},
  {id:'claude',name:'Claude',defaults:['claude-sonnet-4']},
  {id:'kimi',name:'Kimi',defaults:['kimi-k2']}
] as const
const uid = (p:string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`
const fmt = (d:string) => new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(d))
const avg = (xs:number[]) => xs.length ? Math.round(xs.reduce((a,b)=>a+b,0)/xs.length) : 0
const scoreTone = (n:number) => n>=85?'good':n>=70?'warn':'bad'
const resultTitle = (r:EvalResult) => r.testCaseTitleSnapshot || '历史示例记录'
const resultPrompt = (r:EvalResult) => r.promptVersionNameSnapshot || '历史示例记录'
const resultModel = (r:EvalResult) => r.modelDisplayName || (r.actualModel ? `${r.providerName || r.modelName || r.provider || '未知供应商'} / ${r.actualModel}` : r.modelName || '未知模型')
const resultJudge = (r:EvalResult) => r.judgeMode === 'mock' ? 'Mock' : r.judgeMode === 'real' ? `${r.judgeProvider?.toLowerCase() === 'qwen' ? 'Qwen' : r.judgeProvider || '未知供应商'} / ${r.judgeModel || '未记录模型'}` : '未记录'
function normalizeData(raw:any){
  const testCaseById = new Map((raw.testCases || []).map((x:TestCase)=>[x.id,x]))
  const promptById = new Map((raw.promptVersions || []).map((x:PromptVersion)=>[x.id,x]))
  return {...INITIAL,...raw,results:(raw.results || []).map((r:any)=>{
    const tc = testCaseById.get(r.testCaseId) as TestCase | undefined
    const pv = promptById.get(r.promptVersionId) as PromptVersion | undefined
    const providerName = r.providerName || r.modelName || r.provider || ''
    const actualModel = r.actualModel || r.apiModel || ''
    return {...r,
      testCaseTitleSnapshot:r.testCaseTitleSnapshot || tc?.title || '历史示例记录',
      testCaseInputSnapshot:r.testCaseInputSnapshot || tc?.inputText || '',
      expectedAnswerSnapshot:r.expectedAnswerSnapshot || tc?.expectedAnswer || '',
      evaluationCriteriaSnapshot:r.evaluationCriteriaSnapshot || tc?.evaluationCriteria || '',
      promptVersionNameSnapshot:r.promptVersionNameSnapshot || pv?.name || '历史示例记录',
      promptContentSnapshot:r.promptContentSnapshot || pv?.content || '',
      providerName,
      actualModel,
      modelDisplayName:r.modelDisplayName || (actualModel ? `${providerName || '未知供应商'} / ${actualModel}` : r.modelName || '未知模型'),
      tokenUsage:r.tokenUsage || r.usage,
      temperature:typeof r.temperature === 'number'
        ? r.temperature
        : r.temperature !== undefined && r.temperature !== null && r.temperature !== '' && Number.isFinite(Number(r.temperature))
          ? Number(r.temperature)
          : undefined,
      runMode:r.runMode === 'real' ? 'real' : 'mock'
    }
  })}
}
function loadData(){ try { const x=localStorage.getItem(STORE); const normalized=normalizeData(x?JSON.parse(x):INITIAL); if(x)localStorage.setItem(STORE,JSON.stringify(normalized)); return normalized } catch{return normalizeData(INITIAL)} }

export default function App(){
  const [data,setData] = useState(loadData)
  const [tab,setTab] = useState<Tab>('overview')
  const [toast,setToast] = useState('')
  const update=(next:any)=>{setData(next);localStorage.setItem(STORE,JSON.stringify(next))}
  const notify=(s:string)=>{setToast(s);setTimeout(()=>setToast(''),2200)}
  const reset=()=>{if(confirm('确定要重置为初始示例数据吗？当前本地数据将被覆盖。')){update(INITIAL);notify('示例数据已重置')}}
  const counts={cases:data.testCases.length,prompts:data.promptVersions.length,results:data.results.length,bads:data.results.filter((r:EvalResult)=>r.score<70||r.badCaseType!=='无').length}
  return <div className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark"><Sparkles size={20}/></div><div><h1>AI 产品评测工作台</h1><p>AI EVAL WORKBENCH <span>V0</span></p></div></div><div className="top-actions"><div className="storage-status"><span/> 数据已保存在本机</div><button className="btn ghost" onClick={reset}><RotateCcw size={15}/>重置示例数据</button></div></header>
    <nav className="tabs" aria-label="功能模块">{TABS.map(t=><button key={t.id} className={tab===t.id?'active':''} onClick={()=>setTab(t.id)}><t.icon size={17}/>{t.label}{t.id==='badcases'&&counts.bads>0?<b>{counts.bads}</b>:null}</button>)}</nav>
    <main>
      {tab==='overview'&&<Overview data={data} counts={counts} go={setTab}/>} 
      {tab==='cases'&&<EditableCases items={data.testCases} results={data.results} setItems={(items:TestCase[])=>update({...data,testCases:items})} notify={notify}/>}
      {tab==='prompts'&&<EditablePrompts items={data.promptVersions} results={data.results} setItems={(items:PromptVersion[])=>update({...data,promptVersions:items})} notify={notify}/>}
      {tab==='runner'&&<Runner data={data} save={(r:EvalResult,silent=false)=>{setData((current:any)=>{const next={...current,results:[r,...current.results]};localStorage.setItem(STORE,JSON.stringify(next));return next});if(!silent)notify('评测记录已保存')}}/>}
      {tab==='models'&&<Models items={data.models}/>} 
      {tab==='badcases'&&<BadCases data={data} remove={(id:string)=>{update({...data,results:data.results.filter((r:EvalResult)=>r.id!==id)});notify('评测记录已删除')}}/>}
      {tab==='report'&&<ReportTable data={data}/>} 
    </main>{toast&&<div className="toast"><Check size={16}/>{toast}</div>}
  </div>
}

function PageHead({eyebrow,title,desc,action}:{eyebrow:string;title:string;desc:string;action?:any}){return <div className="page-head"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2><p>{desc}</p></div>{action}</div>}
function Overview({data,counts,go}:any){const recent=data.results.slice().sort((a:EvalResult,b:EvalResult)=>+new Date(b.createdAt)-+new Date(a.createdAt))[0];return <>
  <section className="hero"><div><div className="eyebrow">AI EVALUATION WORKBENCH</div><h2>AI 产品评测工作台</h2><p>用于测试 Prompt、记录模型输出、标注 Bad Case，并沉淀不同模型在具体任务中的能力边界。</p><div className="hero-project"><span>当前示例项目</span><h3>{data.project.name}</h3><p>用于验证事实提取、结构化整理、文学化生成和格式稳定性等评测流程。</p><div className="scenario"><Tag size={15}/>{data.project.scenario}</div></div></div><div className="hero-art"><div className="orb"><Bot size={38}/></div><i/><i/><i/></div></section>
  <div className="local-data-note"><AlertTriangle size={14}/><span>当前版本数据保存在本地浏览器，适合个人评测与作品集演示；清除浏览器缓存可能导致数据丢失。</span></div>
  <section className="metric-grid"><Metric label="测试用例" value={counts.cases} sub="覆盖 3 个难度等级" icon={Beaker} tone="cyan"/><Metric label="Prompt 版本" value={counts.prompts} sub="持续迭代提示策略" icon={Boxes} tone="violet"/><Metric label="评测记录" value={counts.results} sub={recent?`最近 ${fmt(recent.createdAt)}`:'尚未开始评测'} icon={Activity} tone="green"/><Metric label="Bad Case" value={counts.bads} sub={counts.bads?'等待分析和优化':'当前无异常记录'} icon={AlertTriangle} tone="orange"/></section>
  <section className="overview-grid"><div className="panel"><div className="panel-title"><div><h3>快速开始</h3><p>从测试用例到评测报告的标准流程</p></div></div><div className="flow">{[['01','准备测试用例','定义输入和预期结果','cases'],['02','选择 Prompt 与模型','在测试台运行模拟测试','runner'],['03','复盘评测结果','定位 Bad Case 并生成报告','report']].map((x,i)=><button key={x[0]} onClick={()=>go(x[3])}><span>{x[0]}</span><div><b>{x[1]}</b><small>{x[2]}</small></div><ChevronRight size={18}/>{i<2&&<em/>}</button>)}</div></div>
  <div className="panel"><div className="panel-title"><div><h3>最近一次评测</h3><p>最新保存的模型表现</p></div><button className="text-btn" onClick={()=>go('report')}>查看报告 <ChevronRight size={14}/></button></div>{recent?<div className="recent"><div className={`score-ring ${scoreTone(recent.score)}`}><b>{recent.score}</b><small>总分</small></div><div className="recent-info"><div><span className="model-dot"/> {resultModel(recent)}<span className="badge neutral">{resultPrompt(recent)}</span>{recent.runMode==='mock'?<MockBadge/>:<RealBadge/>}</div><h4>{resultTitle(recent)}</h4><p>{recent.judgeComment}</p><small><Clock3 size={13}/>{recent.latencyMs} ms · {fmt(recent.createdAt)}</small></div></div>:<Empty text="运行并保存一次评测后，这里会显示结果"/>}</div></section>
  </>}
function Metric({label,value,sub,icon:Icon,tone}:any){return <div className="metric"><div className={`metric-icon ${tone}`}><Icon size={21}/></div><div><p>{label}</p><b>{value}</b><small>{sub}</small></div></div>}

function Cases({items,results,setItems,notify}:any){const [open,setOpen]=useState(false);const [q,setQ]=useState('');const [form,setForm]=useState({title:'',modality:'text',inputText:'',expectedAnswer:'',evaluationCriteria:'',tags:'',difficulty:'medium'});const filtered=items.filter((x:TestCase)=>x.title.includes(q)||x.tags.join('').includes(q));const submit=(e:any)=>{e.preventDefault();if(!form.title||!form.inputText)return;setItems([{...form,id:uid('tc'),tags:form.tags.split(/[,，]/).map(x=>x.trim()).filter(Boolean)},...items]);setOpen(false);notify('测试用例已新增')};return <>
 <PageHead eyebrow="TEST CASE LIBRARY" title="测试用例" desc="构建可复用的评测输入、预期答案与评分标准。" action={<button className="btn primary" onClick={()=>setOpen(true)}><Plus size={16}/>新增测试用例</button>}/><div className="toolbar"><div className="search"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="搜索标题或标签"/></div><span>共 {items.length} 条用例</span></div>
 <div className="card-list">{filtered.map((x:TestCase)=><article className="case-card" key={x.id}><div className="card-top"><div><span className={`badge diff-${x.difficulty}`}>{x.difficulty.toUpperCase()}</span><span className="badge neutral">{x.modality}</span></div><button className="icon-btn danger" aria-label="删除" onClick={()=>{const linked=results.some((r:EvalResult)=>r.testCaseId===x.id);const message=linked?`删除“${x.title}”？\n\n删除后不会影响已经保存的历史评测记录，历史记录将继续使用当时保存的内容快照。`:`删除“${x.title}”？`;if(confirm(message)){setItems(items.filter((i:TestCase)=>i.id!==x.id));notify('测试用例已删除')}}}><Trash2 size={16}/></button></div><h3>{x.title}</h3><p className="clamp">{x.inputText}</p><div className="criteria"><b>评测重点</b><span>{x.evaluationCriteria}</span></div><div className="tag-row">{x.tags.map(t=><span key={t}>#{t}</span>)}</div></article>)}</div>{!filtered.length&&<Empty text="没有找到匹配的测试用例"/>}
 {open&&<Modal title="新增测试用例" close={()=>setOpen(false)}><form onSubmit={submit}><div className="form-grid"><Field label="标题 *"><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="例如：人物信息提取"/></Field><Field label="难度"><select value={form.difficulty} onChange={e=>setForm({...form,difficulty:e.target.value})}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></Field><Field label="输入类型"><select value={form.modality} onChange={e=>setForm({...form,modality:e.target.value})}>{['text','image','document','audio','video'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="标签"><input value={form.tags} onChange={e=>setForm({...form,tags:e.target.value})} placeholder="逗号分隔"/></Field></div><Field label="用户输入 *"><textarea value={form.inputText} onChange={e=>setForm({...form,inputText:e.target.value})} rows={4}/></Field><Field label="期望答案"><textarea value={form.expectedAnswer} onChange={e=>setForm({...form,expectedAnswer:e.target.value})} rows={3}/></Field><Field label="评分标准"><textarea value={form.evaluationCriteria} onChange={e=>setForm({...form,evaluationCriteria:e.target.value})} rows={3}/></Field><ModalActions close={()=>setOpen(false)}/></form></Modal>}</>}

function Prompts({items,results,setItems,notify}:any){const [open,setOpen]=useState(false);const [form,setForm]=useState({name:'',content:'',changelog:'',taskType:'信息抽取'});const submit=(e:any)=>{e.preventDefault();if(!form.name||!form.content)return;setItems([{...form,id:uid('pv'),createdAt:new Date().toISOString()},...items]);setOpen(false);notify('Prompt 版本已新增')};return <><PageHead eyebrow="PROMPT VERSION CONTROL" title="Prompt 版本" desc="保留每一次策略变化，让评测结果可比较、可追溯。" action={<button className="btn primary" onClick={()=>setOpen(true)}><Plus size={16}/>新增 Prompt 版本</button>}/>
 <div className="prompt-list">{items.map((x:PromptVersion,i:number)=><article className="prompt-card" key={x.id}><div className="version-rail"><span>{String(items.length-i).padStart(2,'0')}</span><i/></div><div className="prompt-main"><div className="card-top"><div><h3>{x.name}</h3><span className="badge purple">{x.taskType}</span></div><button className="icon-btn danger" onClick={()=>{const linked=results.some((r:EvalResult)=>r.promptVersionId===x.id);const message=linked?`删除“${x.name}”？\n\n删除后不会影响已经保存的历史评测记录，历史记录将继续使用当时保存的内容快照。`:`删除“${x.name}”？`;if(confirm(message)){setItems(items.filter((p:PromptVersion)=>p.id!==x.id));notify('Prompt 版本已删除')}}}><Trash2 size={16}/></button></div><pre>{x.content}</pre><div className="changelog"><b>修改说明</b>{x.changelog||'暂无说明'}</div><small>创建于 {fmt(x.createdAt)}</small></div></article>)}</div>{!items.length&&<Empty text="还没有 Prompt 版本，请先新增一个"/>}
 {open&&<Modal title="新增 Prompt 版本" close={()=>setOpen(false)}><form onSubmit={submit}><div className="form-grid"><Field label="版本名称 *"><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Prompt V3"/></Field><Field label="适用任务"><select value={form.taskType} onChange={e=>setForm({...form,taskType:e.target.value})}>{['信息抽取','内容生成','格式校验','问答'].map(x=><option key={x}>{x}</option>)}</select></Field></div><Field label="Prompt 内容 *"><textarea rows={7} value={form.content} onChange={e=>setForm({...form,content:e.target.value})}/></Field><Field label="修改说明"><textarea rows={3} value={form.changelog} onChange={e=>setForm({...form,changelog:e.target.value})}/></Field><ModalActions close={()=>setOpen(false)}/></form></Modal>}</>}

function EditableCases({items,results,setItems,notify}:any){
 const emptyForm={title:'',modality:'text',inputText:'',expectedAnswer:'',evaluationCriteria:'',tags:'',difficulty:'medium'}
 const [open,setOpen]=useState(false)
 const [editing,setEditing]=useState<TestCase|null>(null)
 const [q,setQ]=useState('')
 const [form,setForm]=useState(emptyForm)
 const [editForm,setEditForm]=useState(emptyForm)
 const filtered=items.filter((x:TestCase)=>x.title.includes(q)||x.tags.join('').includes(q))
 const parseTags=(value:string)=>value.split(/[,，]/).map(x=>x.trim()).filter(Boolean)
 const openEditor=(item:TestCase)=>{setEditing(item);setEditForm({...item,tags:item.tags.join(', ')})}
 const remove=(item:TestCase)=>{const linked=results.some((r:EvalResult)=>r.testCaseId===item.id);const message=linked?`删除“${item.title}”？\n\n删除后不会影响已经保存的历史评测记录，历史记录将继续使用当时保存的内容快照。`:`删除“${item.title}”？`;if(confirm(message)){setItems(items.filter((x:TestCase)=>x.id!==item.id));setEditing(null);notify('测试用例已删除')}}
 const create=(e:any)=>{e.preventDefault();if(!form.title.trim()||!form.inputText.trim())return;setItems([{...form,id:uid('tc'),tags:parseTags(form.tags)},...items]);setForm(emptyForm);setOpen(false);notify('测试用例已新增')}
 const saveEdit=(e:any)=>{e.preventDefault();if(!editing||!editForm.title.trim()||!editForm.inputText.trim())return;const next:TestCase={...editing,...editForm,modality:editForm.modality as TestCase['modality'],difficulty:editForm.difficulty as TestCase['difficulty'],tags:parseTags(editForm.tags)};setItems(items.map((item:TestCase)=>item.id===editing.id?next:item));setEditing(null);notify('已保存修改')}
 return <>
  <PageHead eyebrow="TEST CASE LIBRARY" title="测试用例" desc="构建可复用的评测输入、预期答案与评分标准。" action={<button className="btn primary" onClick={()=>setOpen(true)}><Plus size={16}/>新增测试用例</button>}/>
  <div className="toolbar"><div className="search"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="搜索标题或标签"/></div><span>共 {items.length} 条用例</span></div>
  <div className="card-list">{filtered.map((x:TestCase)=><article className="case-card editable-card" role="button" tabIndex={0} aria-label={`查看或编辑测试用例 ${x.title}`} key={x.id} onClick={()=>openEditor(x)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openEditor(x)}}}><div className="card-top"><div><span className={`badge diff-${x.difficulty}`}>{x.difficulty.toUpperCase()}</span><span className="badge neutral">{x.modality}</span></div><button className="icon-btn danger" aria-label={`删除测试用例 ${x.title}`} onClick={e=>{e.stopPropagation();remove(x)}}><Trash2 size={16}/></button></div><h3>{x.title}</h3><p className="clamp">{x.inputText}</p><div className="criteria"><b>评测重点</b><span>{x.evaluationCriteria}</span></div><div className="card-footer"><div className="tag-row">{x.tags.map(t=><span key={t}>#{t}</span>)}</div><span className="edit-hint">点击查看 / 编辑</span></div></article>)}</div>
  {!filtered.length&&<Empty text="没有找到匹配的测试用例"/>}
  {open&&<Modal title="新增测试用例" close={()=>setOpen(false)}><form onSubmit={create}><TestCaseFields form={form} setForm={setForm}/><ModalActions close={()=>setOpen(false)}/></form></Modal>}
  {editing&&<Modal title="测试用例详情" close={()=>setEditing(null)}><form onSubmit={saveEdit}><TestCaseFields form={editForm} setForm={setEditForm}/><EditActions cancel={()=>setEditing(null)} remove={()=>remove(editing)}/></form></Modal>}
 </>
}

function TestCaseFields({form,setForm}:any){return <><div className="form-grid"><Field label="标题 *"><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="例如：人物信息提取"/></Field><Field label="难度"><select value={form.difficulty} onChange={e=>setForm({...form,difficulty:e.target.value})}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></Field><Field label="输入类型"><select value={form.modality} onChange={e=>setForm({...form,modality:e.target.value})}>{['text','image','document','audio','video'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="标签"><input value={form.tags} onChange={e=>setForm({...form,tags:e.target.value})} placeholder="逗号分隔"/></Field></div><Field label="用户输入 *"><textarea value={form.inputText} onChange={e=>setForm({...form,inputText:e.target.value})} rows={4}/></Field><Field label="期望答案"><textarea value={form.expectedAnswer} onChange={e=>setForm({...form,expectedAnswer:e.target.value})} rows={3}/></Field><Field label="评分标准"><textarea value={form.evaluationCriteria} onChange={e=>setForm({...form,evaluationCriteria:e.target.value})} rows={3}/></Field></>}

function EditablePrompts({items,results,setItems,notify}:any){
 const emptyForm={name:'',content:'',changelog:'',taskType:'信息抽取'}
 const [open,setOpen]=useState(false)
 const [editing,setEditing]=useState<PromptVersion|null>(null)
 const [form,setForm]=useState(emptyForm)
 const [editForm,setEditForm]=useState(emptyForm)
 const taskTypes=['信息抽取','内容生成','格式校验','问答']
 const openEditor=(item:PromptVersion)=>{setEditing(item);setEditForm({name:item.name,content:item.content,changelog:item.changelog,taskType:item.taskType})}
 const remove=(item:PromptVersion)=>{const linked=results.some((r:EvalResult)=>r.promptVersionId===item.id);const message=linked?`删除“${item.name}”？\n\n删除后不会影响已经保存的历史评测记录，历史记录将继续使用当时保存的内容快照。`:`删除“${item.name}”？`;if(confirm(message)){setItems(items.filter((x:PromptVersion)=>x.id!==item.id));setEditing(null);notify('Prompt 版本已删除')}}
 const create=(e:any)=>{e.preventDefault();if(!form.name.trim()||!form.content.trim())return;setItems([{...form,id:uid('pv'),createdAt:new Date().toISOString()},...items]);setForm(emptyForm);setOpen(false);notify('Prompt 版本已新增')}
 const saveEdit=(e:any)=>{e.preventDefault();if(!editing||!editForm.name.trim()||!editForm.content.trim())return;const next:PromptVersion={...editing,...editForm};setItems(items.map((item:PromptVersion)=>item.id===editing.id?next:item));setEditing(null);notify('已保存修改')}
 return <>
  <PageHead eyebrow="PROMPT VERSION CONTROL" title="Prompt 版本" desc="保留每一次策略变化，让评测结果可比较、可追溯。" action={<button className="btn primary" onClick={()=>setOpen(true)}><Plus size={16}/>新增 Prompt 版本</button>}/>
  <div className="prompt-list">{items.map((x:PromptVersion,i:number)=><article className="prompt-card editable-card" role="button" tabIndex={0} aria-label={`查看或编辑 Prompt ${x.name}`} key={x.id} onClick={()=>openEditor(x)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openEditor(x)}}}><div className="version-rail"><span>{String(items.length-i).padStart(2,'0')}</span><i/></div><div className="prompt-main"><div className="card-top"><div><h3>{x.name}</h3><span className="badge purple">{x.taskType}</span></div><button className="icon-btn danger" aria-label={`删除 Prompt ${x.name}`} onClick={e=>{e.stopPropagation();remove(x)}}><Trash2 size={16}/></button></div><pre>{x.content}</pre><div className="changelog"><b>修改说明</b>{x.changelog||'暂无说明'}</div><div className="prompt-footer"><small>创建于 {fmt(x.createdAt)}</small><span className="edit-hint">点击查看 / 编辑</span></div></div></article>)}</div>
  {!items.length&&<Empty text="还没有 Prompt 版本，请先新增一个"/>}
  {open&&<Modal title="新增 Prompt 版本" close={()=>setOpen(false)}><form onSubmit={create}><PromptFields form={form} setForm={setForm} taskTypes={taskTypes}/><ModalActions close={()=>setOpen(false)}/></form></Modal>}
  {editing&&<Modal title="Prompt 版本详情" close={()=>setEditing(null)}><form onSubmit={saveEdit}><PromptFields form={editForm} setForm={setEditForm} taskTypes={taskTypes}/><div className="readonly-meta"><span>创建时间</span><b>{new Date(editing.createdAt).toLocaleString('zh-CN')}</b></div><EditActions cancel={()=>setEditing(null)} remove={()=>remove(editing)}/></form></Modal>}
 </>
}

function PromptFields({form,setForm,taskTypes}:any){return <><div className="form-grid"><Field label="版本名称 *"><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Prompt V3"/></Field><Field label="适用任务"><input list="prompt-task-types" value={form.taskType} onChange={e=>setForm({...form,taskType:e.target.value})}/><datalist id="prompt-task-types">{taskTypes.map((x:string)=><option value={x} key={x}/>)}</datalist></Field></div><Field label="Prompt 内容 *"><textarea rows={7} value={form.content} onChange={e=>setForm({...form,content:e.target.value})}/></Field><Field label="修改说明"><textarea rows={3} value={form.changelog} onChange={e=>setForm({...form,changelog:e.target.value})}/></Field></>}

function EditActions({cancel,remove}:any){return <div className="modal-actions edit-modal-actions"><button type="button" className="btn delete-record" onClick={remove}><Trash2 size={14}/>删除</button><button type="button" className="btn ghost" onClick={cancel}>取消</button><button className="btn primary" type="submit">保存修改</button></div>}

function Runner({data,save}:any){
 const [tcId,setTc]=useState(data.testCases[0]?.id||'')
 const [pvId,setPv]=useState(data.promptVersions[0]?.id||'')
 const [providerId,setProviderId]=useState('qwen')
 const [modelInput,setModelInput]=useState('qwen-plus')
 const [recentModels,setRecentModels]=useState<{provider:string;model:string}[]>(()=>{try{const value=JSON.parse(localStorage.getItem(RECENT_MODELS_STORE)||'[]');return Array.isArray(value)?value:[]}catch{return[]}})
 const [runMode,setRunMode]=useState<'mock'|'real'>('mock')
 const [temperature,setTemperature]=useState(.7)
 const [stage,setStage]=useState<'idle'|'running'|'output'|'judging'|'judged'|'saved'>('idle')
 const [output,setOutput]=useState('')
 const [latency,setLatency]=useState(0)
 const [usage,setUsage]=useState<ModelUsage|undefined>()
 const [apiIdentity,setApiIdentity]=useState<{provider:string;model:string}|undefined>()
 const [error,setError]=useState('')
 const [judgement,setJudgement]=useState<any>(null)
 const [judgeProvider,setJudgeProvider]=useState('qwen')
 const [judgeModel,setJudgeModel]=useState('qwen-plus')
 const [judgeSystemPrompt,setJudgeSystemPrompt]=useState(DEFAULT_JUDGE_SYSTEM_PROMPT)
 const [judgeUserPromptTemplate,setJudgeUserPromptTemplate]=useState(DEFAULT_JUDGE_USER_PROMPT_TEMPLATE)
 const [judgingMode,setJudgingMode]=useState<'mock'|'real'|null>(null)
 const tc=data.testCases.find((x:TestCase)=>x.id===tcId)
 const pv=data.promptVersions.find((x:PromptVersion)=>x.id===pvId)
 const provider=PROVIDERS.find(x=>x.id===providerId) || PROVIDERS[0]
 const realUnavailable=runMode==='real'&&providerId!=='qwen'
 const modelSuggestions=Array.from(new Set([...recentModels.filter(x=>x.provider===providerId).map(x=>x.model),...provider.defaults]))
 const displayedModel=apiIdentity?.model||modelInput.trim()||'未知模型'
 const modelDisplayName=`${provider.name} / ${displayedModel}`
 const resetRun=()=>{setStage('idle');setOutput('');setJudgement(null);setUsage(undefined);setApiIdentity(undefined);setJudgingMode(null);setError('')}
 const resetJudgeResult=()=>{setJudgement(null);setJudgingMode(null);setError('');if(output)setStage('output')}
 const rememberModel=(provider:string,model:string)=>{const next=[{provider,model},...recentModels.filter(x=>!(x.provider===provider&&x.model===model))].slice(0,10);setRecentModels(next);localStorage.setItem(RECENT_MODELS_STORE,JSON.stringify(next))}
 const changeProvider=(id:string)=>{const next=PROVIDERS.find(x=>x.id===id)||PROVIDERS[0];setProviderId(id);setModelInput(recentModels.find(x=>x.provider===id)?.model||next.defaults[0]||'');resetRun()}
 const run=async()=>{
   if(!tc||!pv||realUnavailable||!modelInput.trim())return
   setStage('running');setError('');setJudgement(null);setUsage(undefined);setApiIdentity(undefined)
   if(runMode==='mock'){
     setTimeout(()=>{const conflict=tc.id==='tc3';setOutput(conflict?`我注意到材料中存在一处时间矛盾：按 1952 年出生计算，1960 年应为 8 岁，而不是 15 岁。请问出生年份、1960 年这个事件年份，或“15 岁”的年龄描述，哪一项需要修正？确认后我再继续整理。`:`根据您提供的材料，${tc.inputText}\n\n这段经历勾勒出了一条清晰的人生轨迹。我会忠实保留其中的时间、人物和事件，并按照要求进行整理，不添加材料之外的细节。`);setLatency(850+Math.floor(Math.random()*1600));setStage('output')},1100)
     return
   }
   try{
     const response=await requestChat({provider:providerId,model:modelInput.trim(),systemPrompt:pv.content,userInput:tc.inputText,temperature})
     setOutput(response.output);setLatency(response.latencyMs);setUsage(response.usage);setApiIdentity({provider:response.provider,model:response.model});rememberModel(response.provider,response.model);setStage('output')
   }catch(err){setError(err instanceof Error?err.message:'真实模型请求失败。');setStage('idle')}
 }
 const judge=()=>{setStage('judging');setJudgingMode('mock');setError('');setTimeout(()=>{const base=76+Math.floor(Math.random()*18);const d={accuracy:Math.min(100,base+5),completeness:base,format:Math.min(100,base+3),usefulness:Math.min(100,base+2),safety:Math.min(100,base+10)};setJudgement({score:avg(Object.values(d) as number[]),dimensionScores:d,badCaseType:'无',judgeComment:'模型输出与任务目标一致，关键事实处理准确，整体表达清晰。',suggestion:'可进一步压缩冗余表述，并严格对齐期望答案中的字段结构。',judgeMode:'mock',judgeProvider:'mock',judgeModel:'前端模拟规则',judgeSystemPromptSnapshot:'',judgeUserPromptSnapshot:'',judgeLatencyMs:900,judgeTokenUsage:undefined});setJudgingMode(null);setStage('judged')},900)}
 const realJudge=async()=>{
   if(!output||!judgeModel.trim())return
   setStage('judging');setJudgingMode('real');setError('');setJudgement(null)
   try{
     const response=await requestJudge({provider:judgeProvider,judgeModel:judgeModel.trim(),judgeSystemPrompt,judgeUserPromptTemplate,testCaseTitle:tc.title,userInput:tc.inputText,expectedAnswer:tc.expectedAnswer,evaluationCriteria:tc.evaluationCriteria,promptName:pv.name,promptContent:pv.content,modelProvider:provider.name,actualModel:apiIdentity?.model||modelInput.trim(),modelOutput:output})
     setJudgement({score:response.score,dimensionScores:response.dimensionScores,badCaseType:response.badCaseType,judgeComment:response.judgeComment,suggestion:response.suggestion,judgeMode:'real',judgeProvider:response.judgeProvider,judgeModel:response.judgeModel,judgeSystemPromptSnapshot:response.judgeSystemPrompt,judgeUserPromptSnapshot:response.judgeUserPrompt,judgeLatencyMs:response.judgeLatencyMs,judgeTokenUsage:response.judgeTokenUsage})
     setJudgingMode(null);setStage('judged')
   }catch(err){setError(err instanceof Error?err.message:'AI Judge 请求失败。');setJudgingMode(null);setStage('output')}
 }
 const restoreJudgeDefaults=()=>{setJudgeProvider('qwen');setJudgeModel('qwen-plus');setJudgeSystemPrompt(DEFAULT_JUDGE_SYSTEM_PROMPT);setJudgeUserPromptTemplate(DEFAULT_JUDGE_USER_PROMPT_TEMPLATE);resetJudgeResult()}
 const doSave=()=>{const actualModel=apiIdentity?.model||modelInput.trim();save({id:uid('er'),testCaseId:tcId,promptVersionId:pvId,testCaseTitleSnapshot:tc.title,testCaseInputSnapshot:tc.inputText,expectedAnswerSnapshot:tc.expectedAnswer,evaluationCriteriaSnapshot:tc.evaluationCriteria,promptVersionNameSnapshot:pv.name,promptContentSnapshot:pv.content,modelId:providerId,modelName:provider.name,provider:providerId,providerName:provider.name,actualModel,modelDisplayName:`${provider.name} / ${actualModel}`,tokenUsage:usage,apiModel:actualModel,usage,modality:tc.modality,runMode,temperature,modelOutput:output,latencyMs:latency,...judgement,createdAt:new Date().toISOString()});setStage('saved')}
 if(!tc||!pv)return <><PageHead eyebrow="EVALUATION PLAYGROUND" title="Prompt 测试台" desc="组合用例、Prompt 和模型，运行 Mock 或真实 API 评测。"/><Empty text="请先准备至少一条测试用例和一个 Prompt 版本"/></>
 return <><PageHead eyebrow="EVALUATION PLAYGROUND" title="Prompt 测试台" desc="组合用例、Prompt 和模型，运行 Mock 或真实 API 评测。" action={<div className="mode-switch"><button className={runMode==='mock'?'active':''} onClick={()=>{setRunMode('mock');resetRun()}}>Mock 模式</button><button className={runMode==='real'?'active real':''} onClick={()=>{setRunMode('real');resetRun()}}>Real 真实调用</button></div>}/>
 <div className="runner-config model-config"><label><span>01 测试用例</span><select value={tcId} onChange={e=>{setTc(e.target.value);resetRun()}}>{data.testCases.map((x:TestCase)=><option value={x.id} key={x.id}>{x.title}</option>)}</select></label><label><span>02 Prompt 版本</span><select value={pvId} onChange={e=>{setPv(e.target.value);resetRun()}}>{data.promptVersions.map((x:PromptVersion)=><option value={x.id} key={x.id}>{x.name} · {x.taskType}</option>)}</select></label><label><span>03 PROVIDER / 供应商</span><select value={providerId} onChange={e=>changeProvider(e.target.value)}>{PROVIDERS.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label><label><span>04 MODEL / 具体模型</span><input list={`models-${providerId}`} value={modelInput} onChange={e=>{setModelInput(e.target.value);resetRun()}} placeholder="选择或输入模型名"/><datalist id={`models-${providerId}`}>{modelSuggestions.map(x=><option value={x} key={x}/>)}</datalist></label>{runMode==='real'&&<label><span>05 TEMPERATURE · {temperature.toFixed(1)}</span><input className="temperature" type="range" min="0" max="2" step="0.1" value={temperature} onChange={e=>{setTemperature(Number(e.target.value));resetRun()}}/></label>}</div>
 {realUnavailable&&<div className="real-warning"><AlertTriangle size={16}/><b>该供应商暂未接入真实 API，当前仅 Qwen 支持真实调用。</b></div>}{error&&<div className="real-error"><AlertTriangle size={16}/><span>{error}</span></div>}
 <div className="runner-grid"><div className="runner-col"><PanelTitle n="A" title="测试上下文" tag={tc.modality}/><InfoBlock label="用户输入" text={tc.inputText}/><InfoBlock label="期望答案" text={tc.expectedAnswer}/><InfoBlock label="评分标准" text={tc.evaluationCriteria}/></div><div className="runner-col"><PanelTitle n="B" title="当前 Prompt" tag={pv.name}/><pre className="prompt-view">{pv.content}</pre><div className="run-action"><button className="btn primary large" onClick={run} disabled={stage==='running'||stage==='judging'||realUnavailable||!modelInput.trim()}>{stage==='running'?<><Spinner/>{runMode==='real'?'Qwen 调用中...':'模型生成中...'}</>:<><Sparkles size={17}/>{runMode==='real'?'调用 Qwen 真实 API':'运行模拟测试'}</>}</button><small>{runMode==='real'?'请求由本地后端安全转发，API Key 不会发送到浏览器':'本次运行不会调用真实 AI API'}</small></div></div></div>
 <section className="output-panel"><PanelTitle n="C" title="模型输出与评测" tag={output?`${modelDisplayName} · ${latency} ms`:'等待运行'}/>{output&&(runMode==='mock'?<div className="mock-notice"><MockBadge/> 此输出由前端规则模拟生成，未调用 {modelDisplayName} 或任何真实模型 API。</div>:<div className="real-notice"><RealBadge/> 输出来自 {modelDisplayName} 真实调用；可选择 Mock 或 Real AI Judge 进行评分。{usage&&<span>Token：{usage.totalTokens}（输入 {usage.promptTokens} / 输出 {usage.completionTokens}）</span>}</div>)}{!output&&stage!=='running'?<Empty text={`选择配置并运行${runMode==='real'?'真实 API':'模拟'}测试，输出将在这里出现`}/>:stage==='running'?<LoadingLines/>:<><div className="model-output">{output}</div><div className="judge-settings"><div className="judge-settings-head"><div><b>AI Judge 设置</b><span>当前仅支持 Qwen，可编辑提示词以适配具体任务。</span></div><button className="btn ghost" onClick={restoreJudgeDefaults}>恢复默认 Judge Prompt</button></div><div className="judge-config-grid"><Field label="Judge Provider"><select value={judgeProvider} onChange={e=>{setJudgeProvider(e.target.value);resetJudgeResult()}}><option value="qwen">Qwen</option></select></Field><Field label="Judge Model"><input list="judge-models" value={judgeModel} onChange={e=>{setJudgeModel(e.target.value);resetJudgeResult()}}/><datalist id="judge-models">{PROVIDERS[0].defaults.map(x=><option value={x} key={x}/>)}</datalist></Field></div><Field label="Judge System Prompt"><textarea rows={4} value={judgeSystemPrompt} onChange={e=>{setJudgeSystemPrompt(e.target.value);resetJudgeResult()}}/></Field><Field label="Judge User Prompt Template"><textarea rows={10} value={judgeUserPromptTemplate} onChange={e=>{setJudgeUserPromptTemplate(e.target.value);resetJudgeResult()}}/></Field></div>{!judgement?<div className="judge-action judge-actions"><button className="btn secondary" onClick={judge} disabled={stage==='judging'}><CircleGauge size={17}/>AI 模拟评测</button><button className="btn primary" onClick={realJudge} disabled={stage==='judging'||!output||!judgeModel.trim()}>{stage==='judging'?<><Spinner/>AI Judge 评测中...</>:<><Sparkles size={17}/>AI 真实评测</>}</button></div>:<Judgement value={judgement} save={doSave} saved={stage==='saved'}/>}</>}</section>
 <BatchEvaluation data={data} save={save} initialPromptId={pvId} initialModel={providerId==='qwen'?modelInput:'qwen-plus'} initialTemperature={temperature} initialJudgeModel={judgeModel} initialJudgeSystemPrompt={judgeSystemPrompt} initialJudgeUserPrompt={judgeUserPromptTemplate}/></>
}

type BatchStatus='pending'|'chat'|'judge'|'completed'|'failed'
type BatchItem={id:string;title:string;status:BatchStatus;error?:string}
const defaultBatchName=()=>{const d=new Date(),pad=(n:number)=>String(n).padStart(2,'0');return `批量评测 ${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`}
function BatchEvaluation({data,save,initialPromptId,initialModel,initialTemperature,initialJudgeModel,initialJudgeSystemPrompt,initialJudgeUserPrompt}:any){
 const [batchName,setBatchName]=useState(defaultBatchName)
 const [selectedIds,setSelectedIds]=useState<string[]>([])
 const [promptId,setPromptId]=useState(initialPromptId)
 const [model,setModel]=useState(initialModel||'qwen-plus')
 const [temperature,setTemperature]=useState(initialTemperature??.7)
 const [judgeModel,setJudgeModel]=useState(initialJudgeModel||'qwen-plus')
 const [judgeSystemPrompt,setJudgeSystemPrompt]=useState(initialJudgeSystemPrompt||DEFAULT_JUDGE_SYSTEM_PROMPT)
 const [judgeUserPrompt,setJudgeUserPrompt]=useState(initialJudgeUserPrompt||DEFAULT_JUDGE_USER_PROMPT_TEMPLATE)
 const [items,setItems]=useState<BatchItem[]>([])
 const [running,setRunning]=useState(false)
 const [stopRequested,setStopRequested]=useState(false)
 const [currentIndex,setCurrentIndex]=useState(0)
 const [currentName,setCurrentName]=useState('')
 const [activeBatchId,setActiveBatchId]=useState('')
 const stopRef=useRef(false)
 const prompt=data.promptVersions.find((x:PromptVersion)=>x.id===promptId)||data.promptVersions[0]
 const selectedCases=data.testCases.filter((x:TestCase)=>selectedIds.includes(x.id))
 const statusText:Record<BatchStatus,string>={pending:'等待中',chat:'模型调用中',judge:'Judge 评测中',completed:'已完成',failed:'失败'}
 const success=items.filter(x=>x.status==='completed').length,failed=items.filter(x=>x.status==='failed').length
 const setItem=(id:string,patch:Partial<BatchItem>)=>setItems(current=>current.map(x=>x.id===id?{...x,...patch}:x))
 const toggle=(id:string)=>{if(running)return;setSelectedIds(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id])}
 const rememberModel=(actualModel:string)=>{try{const stored=JSON.parse(localStorage.getItem(RECENT_MODELS_STORE)||'[]');const current=Array.isArray(stored)?stored:[];localStorage.setItem(RECENT_MODELS_STORE,JSON.stringify([{provider:'qwen',model:actualModel},...current.filter((x:any)=>!(x.provider==='qwen'&&x.model===actualModel))].slice(0,10)))}catch{/* localStorage 不可用时不影响批量评测 */}}
 const start=async()=>{
  if(running||!selectedCases.length||!prompt||!model.trim()||!judgeModel.trim())return
  const cases=[...selectedCases],batchId=uid('batch'),name=batchName.trim()||defaultBatchName()
  stopRef.current=false;setStopRequested(false);setRunning(true);setActiveBatchId(batchId);setCurrentIndex(0);setCurrentName('')
  setItems(cases.map(tc=>({id:tc.id,title:tc.title,status:'pending'})))
  for(let index=0;index<cases.length;index++){
   if(stopRef.current)break
   const tc=cases[index]
   setCurrentIndex(index+1);setCurrentName(tc.title);setItem(tc.id,{status:'chat',error:undefined})
   try{
    const chat=await requestChat({provider:'qwen',model:model.trim(),systemPrompt:prompt.content,userInput:tc.inputText,temperature})
    rememberModel(chat.model)
    setItem(tc.id,{status:'judge'})
    const judged=await requestJudge({provider:'qwen',judgeModel:judgeModel.trim(),judgeSystemPrompt,judgeUserPromptTemplate:judgeUserPrompt,testCaseTitle:tc.title,userInput:tc.inputText,expectedAnswer:tc.expectedAnswer,evaluationCriteria:tc.evaluationCriteria,promptName:prompt.name,promptContent:prompt.content,modelProvider:'Qwen',actualModel:chat.model,modelOutput:chat.output})
    const result:EvalResult={id:uid('er'),testCaseId:tc.id,promptVersionId:prompt.id,testCaseTitleSnapshot:tc.title,testCaseInputSnapshot:tc.inputText,expectedAnswerSnapshot:tc.expectedAnswer,evaluationCriteriaSnapshot:tc.evaluationCriteria,promptVersionNameSnapshot:prompt.name,promptContentSnapshot:prompt.content,modelId:'qwen',modelName:'Qwen',provider:'qwen',providerName:'Qwen',actualModel:chat.model,modelDisplayName:`Qwen / ${chat.model}`,tokenUsage:chat.usage,apiModel:chat.model,usage:chat.usage,modality:tc.modality,runMode:'real',temperature,modelOutput:chat.output,latencyMs:chat.latencyMs,score:judged.score,dimensionScores:judged.dimensionScores,badCaseType:judged.badCaseType,judgeComment:judged.judgeComment,suggestion:judged.suggestion,judgeMode:'real',judgeProvider:judged.judgeProvider,judgeModel:judged.judgeModel,judgeSystemPromptSnapshot:judged.judgeSystemPrompt,judgeUserPromptSnapshot:judged.judgeUserPrompt,judgeLatencyMs:judged.judgeLatencyMs,judgeTokenUsage:judged.judgeTokenUsage,batchId,batchName:name,batchIndex:index+1,batchTotal:cases.length,createdAt:new Date().toISOString()}
    save(result,true);setItem(tc.id,{status:'completed'})
   }catch(err){setItem(tc.id,{status:'failed',error:err instanceof Error?err.message:'批量评测失败'})}
  }
  setRunning(false);setCurrentName(stopRef.current?'批量评测已停止':'批量评测已结束')
 }
 const stop=()=>{stopRef.current=true;setStopRequested(true)}
 const canStart=Boolean(selectedCases.length&&prompt&&model.trim()&&judgeModel.trim()&&!running)
 return <section className="panel batch-evaluation"><div className="panel-title"><div><h3>批量评测</h3><p>使用同一 Prompt、Qwen 模型和 AI Judge，按顺序评测多个测试用例。</p></div><span className="badge real-data">Real 串行评测</span></div>
  <div className="batch-config"><Field label="批量名称"><input value={batchName} onChange={e=>setBatchName(e.target.value)} disabled={running}/></Field><Field label="Prompt 版本"><select value={prompt?.id||''} onChange={e=>setPromptId(e.target.value)} disabled={running}>{data.promptVersions.map((x:PromptVersion)=><option value={x.id} key={x.id}>{x.name} · {x.taskType}</option>)}</select></Field><Field label="Provider"><select value="qwen" disabled><option value="qwen">Qwen</option></select></Field><Field label="Model"><input list="batch-qwen-models" value={model} onChange={e=>setModel(e.target.value)} disabled={running}/><datalist id="batch-qwen-models">{PROVIDERS[0].defaults.map(x=><option value={x} key={x}/>)}</datalist></Field><Field label={`Temperature · ${Number(temperature).toFixed(1)}`}><input className="temperature" type="range" min="0" max="2" step="0.1" value={temperature} onChange={e=>setTemperature(Number(e.target.value))} disabled={running}/></Field></div>
  <div className="batch-cases-head"><div><b>选择测试用例</b><span>已选择 {selectedIds.length} / {data.testCases.length}</span></div><div><button className="text-btn" disabled={running} onClick={()=>setSelectedIds(data.testCases.map((x:TestCase)=>x.id))}>全选</button><button className="text-btn" disabled={running} onClick={()=>setSelectedIds([])}>取消全选</button></div></div>
  <div className="batch-case-grid">{data.testCases.map((tc:TestCase)=><label className={selectedIds.includes(tc.id)?'selected':''} key={tc.id}><input type="checkbox" checked={selectedIds.includes(tc.id)} onChange={()=>toggle(tc.id)} disabled={running}/><span><b>{tc.title}</b><small>{tc.modality} · {tc.difficulty}</small></span></label>)}</div>
  <div className="batch-judge"><div className="judge-settings-head"><div><b>AI Judge 设置</b><span>每条模型输出都会自动使用以下 Qwen Judge 配置进行真实评测。</span></div><button className="btn ghost" disabled={running} onClick={()=>{setJudgeModel('qwen-plus');setJudgeSystemPrompt(DEFAULT_JUDGE_SYSTEM_PROMPT);setJudgeUserPrompt(DEFAULT_JUDGE_USER_PROMPT_TEMPLATE)}}>恢复默认 Judge Prompt</button></div><div className="judge-config-grid"><Field label="Judge Provider"><select value="qwen" disabled><option value="qwen">Qwen</option></select></Field><Field label="Judge Model"><input list="batch-judge-models" value={judgeModel} onChange={e=>setJudgeModel(e.target.value)} disabled={running}/><datalist id="batch-judge-models">{PROVIDERS[0].defaults.map(x=><option value={x} key={x}/>)}</datalist></Field></div><details><summary>编辑 Judge Prompt</summary><Field label="Judge System Prompt"><textarea rows={4} value={judgeSystemPrompt} onChange={e=>setJudgeSystemPrompt(e.target.value)} disabled={running}/></Field><Field label="Judge User Prompt Template"><textarea rows={8} value={judgeUserPrompt} onChange={e=>setJudgeUserPrompt(e.target.value)} disabled={running}/></Field></details></div>
  {items.length>0&&<div className="batch-progress"><div className="batch-progress-head"><div><b>当前进度：{currentIndex} / {items.length}</b><span>{currentName}</span>{activeBatchId&&<small>{activeBatchId}</small>}</div><div><span className="good">成功 {success}</span><span className="bad">失败 {failed}</span></div></div><div className="batch-progress-bar"><i style={{width:`${items.length?Math.round((success+failed)/items.length*100):0}%`}}/></div><div className="batch-status-list">{items.map(item=><div key={item.id}><span className={`batch-status-dot ${item.status}`}/><b>{item.title}</b><em className={item.status}>{statusText[item.status]}</em>{item.error&&<small title={item.error}>{item.error}</small>}</div>)}</div></div>}
  <div className="batch-actions">{running?<button className="btn delete-record" onClick={stop} disabled={stopRequested}><X size={15}/>{stopRequested?'将在当前任务完成后停止':'停止批量评测'}</button>:<button className="btn primary large" onClick={start} disabled={!canStart}><Sparkles size={17}/>开始批量评测</button>}<small>请求将逐条串行执行；单条失败不会中断后续测试用例。</small></div>
 </section>
}
function PanelTitle({n,title,tag}:any){return <div className="panel-title compact"><div><span className="section-n">{n}</span><h3>{title}</h3></div><span className="badge neutral">{tag}</span></div>}
function InfoBlock({label,text}:any){return <div className="info-block"><b>{label}</b><p>{text}</p></div>}
function Judgement({value,save,saved}:any){const isTwentyPoint=Object.values(value.dimensionScores).every(v=>Number(v)<=20);return <div className="judgement"><div className="judge-result-label">{value.judgeMode==='real'?<span className="badge judge-real">Real AI Judge</span>:<span className="badge judge-mock">Mock 模拟评测</span>}{value.judgeMode==='real'&&<span>{value.judgeProvider} / {value.judgeModel} · {value.judgeLatencyMs} ms</span>}</div><div className="judge-score"><div className={`score-ring ${scoreTone(value.score)}`}><b>{value.score}</b><small>总分</small></div><div className="dimensions">{Object.entries(value.dimensionScores).map(([k,v])=><div key={k}><span>{({accuracy:'准确性',completeness:'完整性',format:'格式合规',usefulness:'有用性',safety:'风险控制'} as any)[k]}</span><i><em style={{width:`${Number(v)*(isTwentyPoint?5:1)}%`}}/></i><b>{v as number}{isTwentyPoint?'/20':''}</b></div>)}</div></div><div className="judge-notes"><div><b>评审意见</b><p>{value.judgeComment}</p></div><div><b>优化建议</b><p>{value.suggestion}</p></div></div><div className="save-row"><span className="badge good">Bad Case：{value.badCaseType}</span><button className="btn primary" onClick={save} disabled={saved}>{saved?<><Check size={16}/>已保存</>:<>保存评测记录</>}</button></div></div>}

function Models({items}:any){const fields=[['text','文本'],['vision','图片'],['audio','音频'],['video','视频'],['longContext','长上下文'],['structuredOutput','结构化'],['toolUse','工具调用'],['reasoning','推理'],['chinese','中文']];return <><PageHead eyebrow="MODEL CAPABILITY MAP" title="模型能力矩阵" desc="以统一视角比较模型能力，星级为 V0 示例参考。"/><div className="matrix-wrap"><table className="matrix"><thead><tr><th>模型</th>{fields.map(x=><th key={x[0]}>{x[1]}</th>)}<th>成本</th><th>适合场景 / 注意事项</th></tr></thead><tbody>{items.map((m:any)=><tr key={m.id}><td><div className="model-name"><span>{m.name.slice(0,1)}</span><b>{m.name}</b></div></td>{fields.map(([k])=><td key={k}><Rating n={m[k]}/></td>)}<td><span className={`badge cost-${m.costLevel}`}>{m.costLevel}</span></td><td><b>{m.bestFor}</b><small>{m.limitations}</small></td></tr>)}</tbody></table></div></>}
function Rating({n}:{n:number}){return <div className="rating" title={`${n}/5`}>{Array.from({length:5},(_,i)=><i key={i} className={i<n?'on':''}/>)}</div>}
function BadCases({data,remove}:any){const bads=data.results.filter((r:EvalResult)=>r.score<70||r.badCaseType!=='无');return <><PageHead eyebrow="FAILURE ANALYSIS" title="Bad Case" desc="聚焦低分和异常输出，把失败样本转化为 Prompt 优化线索。"/><div className="bad-summary"><AlertTriangle size={18}/><b>{bads.length} 个待处理问题</b><span>判定规则：总分低于 70，或 Bad Case 类型不为“无”</span></div>{bads.length?<div className="bad-list">{bads.map((r:EvalResult)=><article key={r.id}><div className="bad-head"><div><div><span className="badge bad">{r.badCaseType}</span>{r.runMode==='mock'?<MockBadge/>:<RealBadge/>}</div><h3>{resultTitle(r)}</h3><small>{resultModel(r)} · {resultPrompt(r)} · {fmt(r.createdAt)}</small></div><div className="bad-actions"><div className={`score-box ${scoreTone(r.score)}`}><b>{r.score}</b><span>分</span></div><button className="btn delete-record" onClick={()=>{if(confirm('确定删除这条评测记录吗？删除后将从 Bad Case 和评测报告中移除。'))remove(r.id)}}><Trash2 size={14}/>删除记录</button></div></div><InfoBlock label="模型输出" text={r.modelOutput}/><div className="bad-notes"><div><b>评审意见</b><p>{r.judgeComment}</p></div><div><b>优化建议</b><p>{r.suggestion}</p></div></div></article>)}</div>:<Empty text="暂无 Bad Case，继续保持"/>}</>}
function ReportTable({data}:any){
 const [filter,setFilter]=useState<'all'|'mock'|'real'>('all')
 const [caseFilter,setCaseFilter]=useState('all')
 const [modelFilter,setModelFilter]=useState('all')
 const [promptFilter,setPromptFilter]=useState('all')
 const [tempFilter,setTempFilter]=useState('all')
 const [judgeFilter,setJudgeFilter]=useState('all')
 const [sourceFilter,setSourceFilter]=useState('all')
 const [badFilter,setBadFilter]=useState('all')
 const [scoreFilter,setScoreFilter]=useState('all')
 const [sortOrder,setSortOrder]=useState<'newest'|'oldest'>('newest')
 const [selected,setSelected]=useState<EvalResult|null>(null)
 const rs:EvalResult[]=data.results.filter((r:EvalResult)=>filter==='all'||r.runMode===filter)
 const dims=['accuracy','completeness','format','usefulness','safety'] as (keyof DimensionScores)[]
 const by=(getKey:(r:EvalResult)=>string)=>Object.entries(rs.reduce((a:any,r)=>{const key=getKey(r);(a[key]??=[]).push(r.score);return a},{})).map(([k,v])=>({key:k,score:avg(v as number[])})).sort((a,b)=>b.score-a.score)
 const isBad=(r:EvalResult)=>r.score<70||r.badCaseType!=='无'
 const bads=rs.filter(isBad).length
 const options=(get:(r:EvalResult)=>string)=>Array.from(new Set(rs.map(get))).sort((a,b)=>a.localeCompare(b,'zh-CN'))
 const tempLabel=(r:EvalResult)=>typeof r.temperature==='number'?String(r.temperature):'未记录'
 const tempOptions=Array.from(new Set(rs.map(tempLabel))).sort((a,b)=>a==='未记录'?1:b==='未记录'?-1:Number(a)-Number(b))
 const judgeModels=Array.from(new Set(rs.filter(r=>r.judgeMode==='real'&&r.judgeProvider&&r.judgeModel).map(resultJudge))).sort((a,b)=>a.localeCompare(b,'zh-CN'))
 const judgeChoices=[['mock','Mock'],['real','Real AI Judge'],['unrecorded','未记录'],...judgeModels.map(x=>[`model:${x}`,x])]
 const matchesJudge=(r:EvalResult)=>judgeFilter==='all'||(judgeFilter==='mock'&&r.judgeMode==='mock')||(judgeFilter==='real'&&r.judgeMode==='real')||(judgeFilter==='unrecorded'&&!r.judgeMode)||(judgeFilter.startsWith('model:')&&r.judgeMode==='real'&&resultJudge(r)===judgeFilter.slice(6))
 const recent=rs.filter(r=>caseFilter==='all'||resultTitle(r)===caseFilter).filter(r=>modelFilter==='all'||resultModel(r)===modelFilter).filter(r=>promptFilter==='all'||resultPrompt(r)===promptFilter).filter(r=>tempFilter==='all'||tempLabel(r)===tempFilter).filter(matchesJudge).filter(r=>sourceFilter==='all'||r.runMode===sourceFilter).filter(r=>badFilter==='all'||(badFilter==='bad'?isBad(r):!isBad(r))).filter(r=>scoreFilter==='all'||(scoreFilter==='low'?r.score<70:scoreFilter==='medium'?r.score>=70&&r.score<=84:r.score>=85)).sort((a,b)=>(sortOrder==='newest'?1:-1)*(+new Date(b.createdAt)-+new Date(a.createdAt)))
 return <><PageHead eyebrow="EVALUATION REPORT" title="评测报告" desc="汇总已保存记录，观察模型和 Prompt 版本的真实差异。" action={<div className="report-filter">{([['all','全部记录'],['mock','仅 Mock'],['real','仅真实']] as const).map(([id,label])=><button key={id} className={filter===id?'active':''} onClick={()=>setFilter(id)}>{label}</button>)}</div>}/>{!rs.length?<PromptComparison records={rs} openRecord={setSelected}/>:<><section className="report-metrics"><Metric label="平均分" value={avg(rs.map(r=>r.score))} sub="当前筛选范围" icon={CircleGauge} tone="cyan"/><Metric label="通过率" value={`${Math.round(rs.filter(r=>r.score>=70).length/rs.length*100)}%`} sub="通过线 ≥ 70 分" icon={Check} tone="green"/><Metric label="总测试次数" value={rs.length} sub="当前筛选记录" icon={FlaskConical} tone="violet"/><Metric label="Bad Case" value={bads} sub="需要持续优化" icon={AlertTriangle} tone="orange"/></section>
 <div className="report-grid"><div className="panel"><div className="panel-title"><div><h3>各维度平均分</h3><p>五项核心评测指标</p></div></div><div className="bar-chart">{dims.map(k=>{const n=avg(rs.map(r=>r.dimensionScores[k]));return <div key={k}><span>{({accuracy:'准确性',completeness:'完整性',format:'格式合规',usefulness:'有用性',safety:'风险控制'} as any)[k]}</span><i><em style={{width:`${n}%`}}/></i><b>{n}</b></div>})}</div></div><Rank title="按模型统计" items={by(resultModel)} name={(k:string)=>k}/><Rank title="按 Prompt 版本统计" items={by(resultPrompt)} name={(k:string)=>k}/></div>
 <PromptComparison records={rs} openRecord={setSelected}/>
 <div className="panel recent-table"><div className="panel-title"><div><h3>最近评测记录</h3><p>点击任意记录查看完整评测详情</p></div><span className="record-count">{recent.length} / {rs.length} 条</span></div><div className="table-wrap"><table><thead><tr><th>测试用例</th><th>模型</th><th>Prompt</th><th>Temp</th><th>数据来源</th><th>Judge</th><th>Bad Case</th><th>得分</th><th>时间</th></tr><tr className="table-filter-row"><th><TableFilter label="筛选测试用例" value={caseFilter} set={setCaseFilter} options={options(resultTitle)}/></th><th><TableFilter label="筛选模型" value={modelFilter} set={setModelFilter} options={options(resultModel)}/></th><th><TableFilter label="筛选 Prompt" value={promptFilter} set={setPromptFilter} options={options(resultPrompt)}/></th><th><TableFilter label="筛选 temperature" value={tempFilter} set={setTempFilter} options={tempOptions}/></th><th><TableFilter label="筛选数据来源" value={sourceFilter} set={setSourceFilter} choices={[["mock","Mock"],["real","Real"]]}/></th><th><TableFilter label="筛选 Judge" value={judgeFilter} set={setJudgeFilter} choices={judgeChoices}/></th><th><TableFilter label="筛选 Bad Case" value={badFilter} set={setBadFilter} choices={[["bad","仅 Bad Case"],["normal","非 Bad Case"]]}/></th><th><TableFilter label="筛选得分" value={scoreFilter} set={setScoreFilter} choices={[["low","< 70"],["medium","70–84"],["high","≥ 85"]]}/></th><th><TableFilter label="时间排序" value={sortOrder} set={setSortOrder} allLabel="" choices={[["newest","最新优先"],["oldest","最旧优先"]]}/></th></tr></thead><tbody>{recent.length?recent.map(r=><tr className="record-row" tabIndex={0} key={r.id} onClick={()=>setSelected(r)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(r)}}}><td><b>{resultTitle(r)}</b></td><td className="full-model-name">{resultModel(r)}</td><td>{resultPrompt(r)}</td><td className="temp-cell">{tempLabel(r)}</td><td>{r.runMode==='mock'?<MockBadge/>:<RealBadge/>}</td><td className="judge-cell">{resultJudge(r)}</td><td><span className={`badge ${r.badCaseType==='无'?'good':'bad'}`}>{r.badCaseType}</span></td><td><strong className={scoreTone(r.score)}>{r.score}</strong></td><td>{fmt(r.createdAt)}</td></tr>):<tr className="table-empty-row"><td colSpan={9}><Empty text="没有符合当前筛选条件的评测记录"/></td></tr>}</tbody></table></div></div></>}{selected&&<RecordDetail record={selected} close={()=>setSelected(null)}/>}</>
}

type ComparisonStats={count:number;score:number|null;dimensions:Record<keyof DimensionScores,number|null>;badCount:number;badRate:number|null;latency:number|null;tokens:number|null;latest:EvalResult|null}
const knownAverage=(values:(number|undefined|null)[])=>{const known=values.filter((x):x is number=>typeof x==='number'&&Number.isFinite(x));return known.length?Math.round(known.reduce((a,b)=>a+b,0)/known.length*10)/10:null}
const summarizePrompt=(records:EvalResult[]):ComparisonStats=>{
 const dimension=(key:keyof DimensionScores)=>knownAverage(records.map(r=>r.dimensionScores?.[key]))
 const badCount=records.filter(r=>r.score<70||Boolean(r.badCaseType&&r.badCaseType!=='无')).length
 const latest=records.slice().sort((a,b)=>+new Date(b.createdAt)-+new Date(a.createdAt))[0]||null
 return {count:records.length,score:knownAverage(records.map(r=>r.score)),dimensions:{accuracy:dimension('accuracy'),completeness:dimension('completeness'),format:dimension('format'),usefulness:dimension('usefulness'),safety:dimension('safety')},badCount,badRate:records.length?Math.round(badCount/records.length*1000)/10:null,latency:knownAverage(records.map(r=>r.latencyMs)),tokens:knownAverage(records.map(r=>r.tokenUsage?.totalTokens??r.usage?.totalTokens)),latest}
}
function PromptComparison({records,openRecord}:{records:EvalResult[];openRecord:(r:EvalResult)=>void}){
 const unique=(values:string[])=>Array.from(new Set(values)).sort((a,b)=>a.localeCompare(b,'zh-CN'))
 const cases=unique(records.map(resultTitle))
 const [caseName,setCaseName]=useState('')
 const activeCase=cases.includes(caseName)?caseName:cases[0]||''
 const caseRecords=records.filter(r=>resultTitle(r)===activeCase)
 const models=unique(caseRecords.map(resultModel))
 const [modelName,setModelName]=useState('')
 const activeModel=models.includes(modelName)?modelName:models[0]||''
 const modelRecords=caseRecords.filter(r=>resultModel(r)===activeModel)
 const judges=unique(modelRecords.map(resultJudge))
 const [judgeName,setJudgeName]=useState('')
 const activeJudge=judges.includes(judgeName)?judgeName:judges[0]||''
 const comparable=modelRecords.filter(r=>resultJudge(r)===activeJudge)
 const prompts=unique(comparable.map(resultPrompt))
 const [promptA,setPromptA]=useState('')
 const [promptB,setPromptB]=useState('')
 const activeA=prompts.includes(promptA)?promptA:prompts[0]||''
 const activeB=prompts.includes(promptB)?promptB:prompts.find(p=>p!==activeA)||prompts[0]||''
 const recordsA=comparable.filter(r=>resultPrompt(r)===activeA)
 const recordsB=comparable.filter(r=>resultPrompt(r)===activeB)
 const statsA=useMemo(()=>summarizePrompt(recordsA),[recordsA])
 const statsB=useMemo(()=>summarizePrompt(recordsB),[recordsB])
 const samePrompt=Boolean(activeA&&activeB&&activeA===activeB)
 const dimensions:[keyof DimensionScores,string][]=[['accuracy','准确性'],['completeness','完整性'],['format','格式合规'],['usefulness','有用性'],['safety','风险控制']]
 const number=(value:number|null,suffix='')=>value===null?'未记录':`${value}${suffix}`
 const signed=(a:number|null,b:number|null,suffix='')=>a===null||b===null?'-':`${b-a>0?'+':''}${Math.round((b-a)*10)/10}${suffix}`
 const diffClass=(a:number|null,b:number|null,lowerIsBetter=false)=>a===null||b===null||a===b?'':(lowerIsBetter?b<a:b>a)?'diff-good':'diff-bad'
 const rows=[
  {label:'记录数量',a:String(statsA.count),b:String(statsB.count),diff:signed(statsA.count,statsB.count),tone:''},
  {label:'平均总分',a:number(statsA.score),b:number(statsB.score),diff:signed(statsA.score,statsB.score),tone:diffClass(statsA.score,statsB.score)},
  ...dimensions.map(([key,label])=>({label,a:number(statsA.dimensions[key]),b:number(statsB.dimensions[key]),diff:signed(statsA.dimensions[key],statsB.dimensions[key]),tone:diffClass(statsA.dimensions[key],statsB.dimensions[key])})),
  {label:'Bad Case 数',a:String(statsA.badCount),b:String(statsB.badCount),diff:signed(statsA.badCount,statsB.badCount),tone:diffClass(statsA.badCount,statsB.badCount,true)},
  {label:'Bad Case 率',a:number(statsA.badRate,'%'),b:number(statsB.badRate,'%'),diff:signed(statsA.badRate,statsB.badRate,'%'),tone:diffClass(statsA.badRate,statsB.badRate,true)},
  {label:'平均耗时',a:number(statsA.latency,' ms'),b:number(statsB.latency,' ms'),diff:signed(statsA.latency,statsB.latency,' ms'),tone:diffClass(statsA.latency,statsB.latency,true)},
  {label:'平均 Token',a:number(statsA.tokens),b:number(statsB.tokens),diff:signed(statsA.tokens,statsB.tokens),tone:diffClass(statsA.tokens,statsB.tokens,true)},
  {label:'最近评测时间',a:statsA.latest?fmt(statsA.latest.createdAt):'未记录',b:statsB.latest?fmt(statsB.latest.createdAt):'未记录',diff:'-',tone:''}
 ]
 const conclusion=()=>{
  if(statsA.score===null||statsB.score===null)return '当前记录缺少可用总分，暂时无法生成结论。'
  const gap=statsB.score-statsA.score
  const close=Math.abs(gap)<5
  const higher=gap>=0?statsB:statsA,lower=gap>=0?statsA:statsB,higherName=gap>=0?activeB:activeA
  const tokenHigher=statsA.tokens!==null&&statsB.tokens!==null?(statsA.tokens>statsB.tokens*1.5?activeA:statsB.tokens>statsA.tokens*1.5?activeB:''):''
  const latencyHigher=statsA.latency!==null&&statsB.latency!==null?(statsA.latency>statsB.latency*1.5?activeA:statsB.latency>statsA.latency*1.5?activeB:''):''
  const higherUsesLess=gap!==0&&higher.tokens!==null&&lower.tokens!==null&&higher.latency!==null&&lower.latency!==null&&higher.tokens<lower.tokens&&higher.latency<lower.latency
  const higherCostsMore=gap!==0&&((higher.tokens!==null&&lower.tokens!==null&&higher.tokens>lower.tokens*1.5)||(higher.latency!==null&&lower.latency!==null&&higher.latency>lower.latency*1.5))
  const parts:string[]=[]
  if(close){
   parts.push('两个 Prompt 效果接近。')
   if(tokenHigher)parts.push(`${tokenHigher} 平均 Token 高出 50% 以上，效果接近，但成本更高。`)
   if(latencyHigher)parts.push(`${latencyHigher} 平均耗时高出 50% 以上，效果接近，但响应更慢。`)
   if(higherUsesLess)parts.push(`${higherName} 分数略高，且平均 Token 和耗时更低，效果和成本表现均更优。`)
   else if(higherCostsMore)parts.push(`从得分看 ${higherName} 效果更好，但需要结合成本和响应速度判断。`)
   else if(!tokenHigher&&!latencyHigher)parts.push('建议结合 Bad Case 和成本进一步判断。')
  }else if(higherUsesLess)parts.push(`${higherName} 分数更高，且平均 Token 和耗时更低，效果和成本表现均更优。`)
  else if(higherCostsMore)parts.push(`${higherName} 效果更好，但 Token 或耗时也明显更高，需要结合成本和响应速度判断。`)
  else parts.push(`${higherName} 平均分更高，建议优先使用 ${higherName}。`)
  const dimensionGaps=dimensions.map(([key,label])=>({label,gap:statsA.dimensions[key]===null||statsB.dimensions[key]===null?null:Math.abs((statsB.dimensions[key] as number)-(statsA.dimensions[key] as number))})).filter(x=>x.gap!==null).sort((a,b)=>(b.gap as number)-(a.gap as number))
  if(dimensionGaps[0]&&(dimensionGaps[0].gap as number)>0)parts.push(`主要差异来自“${dimensionGaps[0].label}”维度。`)
  return parts.join('')
 }
 const representative=(label:string,name:string,record:EvalResult|null)=><article className="comparison-record" role={record?'button':undefined} tabIndex={record?0:undefined} onClick={()=>record&&openRecord(record)} onKeyDown={e=>{if(record&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openRecord(record)}}}><div><span>{label}</span><b>{name||'未选择'}</b></div>{record?<><div className="comparison-record-meta"><span>{fmt(record.createdAt)}</span><strong className={scoreTone(record.score)}>{record.score} 分</strong><span className={`badge ${!record.badCaseType?'neutral':record.badCaseType==='无'?'good':'bad'}`}>{record.badCaseType||'未记录'}</span></div><p>{record.modelOutput?.slice(0,200)||'未记录模型输出'}{record.modelOutput?.length>200?'…':''}</p><small>{record.judgeComment?.slice(0,150)||'未记录 Judge 评审意见'}{record.judgeComment?.length>150?'…':''}</small></>:<p>暂无代表记录</p>}</article>
 return <section className="panel prompt-comparison">
  <div className="panel-title"><div><h3>Prompt 对比分析</h3><p>在相同测试用例、模型和 Judge 条件下比较两个 Prompt 版本</p></div></div>
  {records.length<2?<Empty text="暂无足够评测记录用于对比，请先保存至少两个不同 Prompt 的评测记录。"/>:<>
   <div className="comparison-filters"><FilterSelect label="测试用例" value={activeCase} set={setCaseName} options={cases} allLabel=""/><FilterSelect label="模型" value={activeModel} set={setModelName} options={models} allLabel=""/><FilterSelect label="Judge" value={activeJudge} set={setJudgeName} options={judges} allLabel=""/><FilterSelect label="Prompt A" value={activeA} set={setPromptA} options={prompts} allLabel=""/><FilterSelect label="Prompt B" value={activeB} set={setPromptB} options={prompts} allLabel=""/></div>
   {prompts.length<2?<Empty text="当前条件下只有一个 Prompt 版本，无法对比。"/>:samePrompt?<Empty text="请选择两个不同的 Prompt 版本。"/>:<>
    <div className="table-wrap comparison-table"><table><thead><tr><th>指标</th><th>{activeA}</th><th>{activeB}</th><th>差异</th></tr></thead><tbody>{rows.map(row=><tr key={row.label}><td><b>{row.label}</b></td><td>{row.a}</td><td>{row.b}</td><td className={row.tone}>{row.diff}</td></tr>)}</tbody></table></div>
    <div className="comparison-conclusion"><Sparkles size={16}/><div><b>自动结论</b><p>{conclusion()}</p></div></div>
    <div className="comparison-records">{representative('Prompt A',activeA,statsA.latest)}{representative('Prompt B',activeB,statsB.latest)}</div>
   </>}
  </>}
 </section>
}
function TableFilter({label,value,set,options=[],choices=[],allLabel='全部'}:any){return <select aria-label={label} value={value} onChange={e=>set(e.target.value)}>{allLabel&&<option value="all">{allLabel}</option>}{choices.map(([id,text]:string[])=><option value={id} key={id}>{text}</option>)}{options.map((x:string)=><option value={x} key={x}>{x}</option>)}</select>}

function Report({data}:any){
 const [filter,setFilter]=useState<'all'|'mock'|'real'>('all')
 const [caseFilter,setCaseFilter]=useState('all')
 const [modelFilter,setModelFilter]=useState('all')
 const [promptFilter,setPromptFilter]=useState('all')
 const [sourceFilter,setSourceFilter]=useState('all')
 const [badFilter,setBadFilter]=useState('all')
 const [scoreFilter,setScoreFilter]=useState('all')
 const [tempFilter,setTempFilter]=useState('all')
 const [judgeFilter,setJudgeFilter]=useState('all')
 const [sortOrder,setSortOrder]=useState<'newest'|'oldest'>('newest')
 const [selected,setSelected]=useState<EvalResult|null>(null)
 const rs:EvalResult[]=data.results.filter((r:EvalResult)=>filter==='all'||r.runMode===filter)
 const dims=['accuracy','completeness','format','usefulness','safety'] as (keyof DimensionScores)[]
 const by=(getKey:(r:EvalResult)=>string)=>Object.entries(rs.reduce((a:any,r)=>{const key=getKey(r);(a[key]??=[]).push(r.score);return a},{})).map(([k,v])=>({key:k,score:avg(v as number[])})).sort((a,b)=>b.score-a.score)
 const isBad=(r:EvalResult)=>r.score<70||r.badCaseType!=='无'
 const bads=rs.filter(isBad).length
 const options=(get:(r:EvalResult)=>string)=>Array.from(new Set(rs.map(get))).sort((a,b)=>a.localeCompare(b,'zh-CN'))
 const tempLabel=(r:EvalResult)=>typeof r.temperature==='number'?String(r.temperature):'未记录'
 const tempOptions=Array.from(new Set(rs.map(tempLabel))).sort((a,b)=>a==='未记录'?1:b==='未记录'?-1:Number(a)-Number(b))
 const judgeLabel=(r:EvalResult)=>r.judgeMode==='mock'?'Mock':r.judgeMode==='real'?`${r.judgeProvider?.toLowerCase()==='qwen'?'Qwen':r.judgeProvider||'未知供应商'} / ${r.judgeModel||'未记录模型'}`:'未记录'
 const judgeModels=Array.from(new Set(rs.filter(r=>r.judgeMode==='real'&&r.judgeProvider&&r.judgeModel).map(judgeLabel))).sort((a,b)=>a.localeCompare(b,'zh-CN'))
 const judgeChoices=[['mock','Mock'],['real','Real AI Judge'],['unrecorded','未记录'],...judgeModels.map(x=>[`model:${x}`,x])]
 const matchesJudge=(r:EvalResult)=>judgeFilter==='all'||(judgeFilter==='mock'&&r.judgeMode==='mock')||(judgeFilter==='real'&&r.judgeMode==='real')||(judgeFilter==='unrecorded'&&!r.judgeMode)||(judgeFilter.startsWith('model:')&&r.judgeMode==='real'&&judgeLabel(r)===judgeFilter.slice(6))
 const recent=rs.filter(r=>caseFilter==='all'||resultTitle(r)===caseFilter).filter(r=>modelFilter==='all'||resultModel(r)===modelFilter).filter(r=>promptFilter==='all'||resultPrompt(r)===promptFilter).filter(r=>tempFilter==='all'||tempLabel(r)===tempFilter).filter(r=>sourceFilter==='all'||r.runMode===sourceFilter).filter(matchesJudge).filter(r=>badFilter==='all'||(badFilter==='bad'?isBad(r):!isBad(r))).filter(r=>scoreFilter==='all'||(scoreFilter==='low'?r.score<70:scoreFilter==='medium'?r.score>=70&&r.score<=84:r.score>=85)).sort((a,b)=>(sortOrder==='newest'?1:-1)*(+new Date(b.createdAt)-+new Date(a.createdAt)))
 const emptyText=filter==='real'?'暂无真实 API 评测记录':'保存评测记录后即可生成报告'
 return <><PageHead eyebrow="EVALUATION REPORT" title="评测报告" desc="汇总已保存记录，观察模型和 Prompt 版本的真实差异。" action={<div className="report-filter">{([['all','全部记录'],['mock','仅 Mock'],['real','仅真实']] as const).map(([id,label])=><button key={id} className={filter===id?'active':''} onClick={()=>setFilter(id)}>{label}</button>)}</div>}/>{!rs.length?<Empty text={emptyText}/>:<><section className="report-metrics"><Metric label="平均分" value={avg(rs.map(r=>r.score))} sub="当前筛选范围" icon={CircleGauge} tone="cyan"/><Metric label="通过率" value={`${Math.round(rs.filter(r=>r.score>=70).length/rs.length*100)}%`} sub="通过线 ≥ 70 分" icon={Check} tone="green"/><Metric label="总测试次数" value={rs.length} sub="当前筛选记录" icon={FlaskConical} tone="violet"/><Metric label="Bad Case" value={bads} sub="需要持续优化" icon={AlertTriangle} tone="orange"/></section>
 <div className="report-grid"><div className="panel"><div className="panel-title"><div><h3>各维度平均分</h3><p>五项核心评测指标</p></div></div><div className="bar-chart">{dims.map(k=>{const n=avg(rs.map(r=>r.dimensionScores[k]));return <div key={k}><span>{({accuracy:'准确性',completeness:'完整性',format:'格式合规',usefulness:'有用性',safety:'风险控制'} as any)[k]}</span><i><em style={{width:`${n}%`}}/></i><b>{n}</b></div>})}</div></div><Rank title="按模型统计" items={by(resultModel)} name={(k:string)=>k}/><Rank title="按 Prompt 版本统计" items={by(resultPrompt)} name={(k:string)=>k}/></div>
 <div className="panel recent-table"><div className="panel-title"><div><h3>最近评测记录</h3><p>点击任意记录查看完整评测详情</p></div><span className="record-count">{recent.length} / {rs.length} 条</span></div><div className="record-filters"><FilterSelect label="测试用例" value={caseFilter} set={setCaseFilter} options={options(resultTitle)}/><FilterSelect label="模型" value={modelFilter} set={setModelFilter} options={options(resultModel)}/><FilterSelect label="Prompt" value={promptFilter} set={setPromptFilter} options={options(resultPrompt)}/><FilterSelect label="数据来源" value={sourceFilter} set={setSourceFilter} choices={[['mock','仅 Mock'],['real','仅真实 API']]}/><FilterSelect label="Bad Case" value={badFilter} set={setBadFilter} choices={[['bad','仅 Bad Case'],['normal','非 Bad Case']]}/><FilterSelect label="得分" value={scoreFilter} set={setScoreFilter} choices={[['low','低分 < 70'],['medium','中等 70–84'],['high','高分 ≥ 85']]}/><FilterSelect label="时间排序" value={sortOrder} set={setSortOrder} allLabel="" choices={[['newest','最新优先'],['oldest','最旧优先']]}/></div>{recent.length?<div className="table-wrap"><table><thead><tr><th>测试用例</th><th>模型</th><th>Prompt</th><th>数据来源</th><th>Bad Case</th><th>得分</th><th>时间</th></tr></thead><tbody>{recent.map(r=><tr className="record-row" tabIndex={0} key={r.id} onClick={()=>setSelected(r)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(r)}}}><td><b>{resultTitle(r)}</b></td><td className="full-model-name">{resultModel(r)}</td><td>{resultPrompt(r)}</td><td>{r.runMode==='mock'?<MockBadge/>:<RealBadge/>}</td><td><span className={`badge ${r.badCaseType==='无'?'good':'bad'}`}>{r.badCaseType}</span></td><td><strong className={scoreTone(r.score)}>{r.score}</strong></td><td>{fmt(r.createdAt)}</td></tr>)}</tbody></table></div>:<Empty text="没有符合当前筛选条件的评测记录"/>}</div></>}{selected&&<RecordDetail record={selected} close={()=>setSelected(null)}/>}</>
}
function FilterSelect({label,value,set,options=[],choices=[],allLabel='全部'}:any){return <label><span>{label}</span><select value={value} onChange={e=>set(e.target.value)}>{allLabel&&<option value="all">{allLabel}</option>}{choices.map(([id,text]:string[])=><option value={id} key={id}>{text}</option>)}{options.map((x:string)=><option value={x} key={x}>{x}</option>)}</select></label>}
function RecordDetail({record:r,close}:{record:EvalResult;close:()=>void}){
 const d=r.dimensionScores||{} as DimensionScores
 const usage=r.tokenUsage||r.usage
 const judgeUsage=r.judgeTokenUsage
 const value=(x?:string)=>x||'未记录'
 const usageText=(x?:ModelUsage)=>x?`输入 ${x.promptTokens} / 输出 ${x.completionTokens} / 总计 ${x.totalTokens}`:'未记录'
 return <Modal title="评测记录详情" close={close} wide>
  <div className="detail-section"><h4>基本信息</h4><div className="detail-grid"><DetailItem label="测试用例标题" value={resultTitle(r)}/><DetailItem label="Provider / Model" value={resultModel(r)}/><DetailItem label="Prompt 版本" value={resultPrompt(r)}/><DetailItem label="数据来源" value={r.runMode==='real'?'Real 真实 API':'Mock 模拟数据'}/><DetailItem label="得分" value={`${r.score ?? '—'} 分`}/><DetailItem label="Bad Case 类型" value={r.badCaseType||'无'}/><DetailItem label="创建时间" value={new Date(r.createdAt).toLocaleString('zh-CN')}/></div></div>
  {r.batchId&&<div className="detail-section"><h4>批量评测信息</h4><div className="detail-grid"><DetailItem label="batchId" value={r.batchId}/><DetailItem label="batchName" value={r.batchName||'未记录'}/><DetailItem label="批次序号" value={typeof r.batchIndex==='number'&&typeof r.batchTotal==='number'?`${r.batchIndex} / ${r.batchTotal}`:'未记录'}/></div></div>}
  <div className="detail-section"><h4>测试用例快照</h4><InfoBlock label="用户输入" text={value(r.testCaseInputSnapshot)}/><InfoBlock label="期望答案" text={value(r.expectedAnswerSnapshot)}/><InfoBlock label="评分标准" text={value(r.evaluationCriteriaSnapshot)}/></div>
  <div className="detail-section"><h4>Prompt 快照</h4><DetailItem label="Prompt 名称" value={resultPrompt(r)}/><InfoBlock label="Prompt 内容" text={value(r.promptContentSnapshot)}/></div>
  <div className="detail-section"><h4>模型输出</h4><div className="detail-output">{value(r.modelOutput)}</div></div>
  <div className="detail-section"><h4>评分结果</h4><div className="detail-grid score-details"><DetailItem label="总分" value={r.score??'—'}/><DetailItem label="准确性" value={d.accuracy??'—'}/><DetailItem label="完整性" value={d.completeness??'—'}/><DetailItem label="格式合规" value={d.format??'—'}/><DetailItem label="有用性" value={d.usefulness??'—'}/><DetailItem label="风险控制" value={d.safety??'—'}/></div><InfoBlock label="评审意见" text={value(r.judgeComment)}/><InfoBlock label="优化建议" text={value(r.suggestion)}/></div>
  <div className="detail-section"><h4>Judge 信息</h4><div className="detail-grid"><DetailItem label="Judge 类型" value={r.judgeMode==='real'?'Real AI Judge':r.judgeMode==='mock'?'Mock 模拟评测':'未记录'}/><DetailItem label="Judge Provider" value={value(r.judgeProvider)}/><DetailItem label="Judge Model" value={value(r.judgeModel)}/><DetailItem label="Judge latencyMs" value={typeof r.judgeLatencyMs==='number'?`${r.judgeLatencyMs} ms`:'未记录'}/><DetailItem label="Judge tokenUsage" value={usageText(judgeUsage)}/></div><details className="judge-snapshot"><summary>查看 Judge Prompt Snapshot</summary><InfoBlock label="Judge System Prompt Snapshot" text={value(r.judgeSystemPromptSnapshot)}/><InfoBlock label="Judge User Prompt Snapshot" text={value(r.judgeUserPromptSnapshot)}/></details></div>
  <div className="detail-section"><h4>调用元数据</h4><div className="detail-grid"><DetailItem label="temperature" value={typeof r.temperature==='number'?r.temperature:'未记录'}/><DetailItem label="latencyMs" value={`${r.latencyMs??'未记录'} ms`}/><DetailItem label="tokenUsage" value={usageText(usage)}/><DetailItem label="provider" value={r.provider||r.providerName||r.modelName||'未记录'}/><DetailItem label="actualModel" value={r.actualModel||r.apiModel||'未记录'}/></div></div>
 </Modal>
}
function DetailItem({label,value}:any){return <div className="detail-item"><span>{label}</span><b>{String(value)}</b></div>}
function Rank({title,items,name}:any){return <div className="panel rank"><div className="panel-title"><div><h3>{title}</h3><p>平均得分排名</p></div></div>{items.length?items.map((x:any,i:number)=><div className="rank-row" key={x.key}><span>{i+1}</span><b>{name(x.key)}</b><i><em style={{width:`${x.score}%`}}/></i><strong>{x.score}</strong></div>):<Empty text="暂无统计数据"/>}</div>}

function Field({label,children}:any){return <label className="field"><span>{label}</span>{children}</label>}
function Modal({title,close,children,wide=false}:any){return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><div className={`modal ${wide?'modal-wide':''}`}><div className="modal-head"><h3>{title}</h3><button className="icon-btn" aria-label="关闭" onClick={close}><X size={20}/></button></div>{children}</div></div>}
function ModalActions({close}:any){return <div className="modal-actions"><button type="button" className="btn ghost" onClick={close}>取消</button><button className="btn primary" type="submit">保存</button></div>}
function Empty({text}:any){return <div className="empty"><div><BarChart3 size={25}/></div><p>{text}</p></div>}
function MockBadge(){return <span className="badge mock">Mock 模拟数据</span>}
function RealBadge(){return <span className="badge real-data">Real 真实调用</span>}
function Spinner(){return <span className="spinner"/>}
function LoadingLines(){return <div className="loading-lines"><i/><i/><i/><i/></div>}
