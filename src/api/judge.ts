import type { JudgeRequest, JudgeResponse } from '../types'

export async function requestJudge(input: JudgeRequest): Promise<JudgeResponse> {
  const response = await fetch('/api/judge', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(input)
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `AI Judge 请求失败（HTTP ${response.status}）`)
  return payload as JudgeResponse
}
