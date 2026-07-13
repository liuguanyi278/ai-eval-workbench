import type { ChatRequest, ChatResponse } from '../types'

export async function requestChat(input: ChatRequest): Promise<ChatResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(input)
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `真实模型请求失败（HTTP ${response.status}）`)
  return payload as ChatResponse
}
