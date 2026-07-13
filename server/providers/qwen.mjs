const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'

export function buildFinalURL(baseURL) {
  const normalizedBaseURL = baseURL.trim().replace(/\/+$/, '')
  return `${normalizedBaseURL}/chat/completions`
}

/**
 * Qwen provider adapter. It accepts the provider-neutral chat contract and
 * translates only at this boundary, so other providers can be added alongside it.
 */
export const qwenProvider = {
  id: 'qwen',
  async chat(request) {
    const apiKey = process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY
    if (!apiKey) {
      const error = new Error('服务端未配置 DASHSCOPE_API_KEY 或 QWEN_API_KEY，请先设置通义千问 API Key。')
      error.statusCode = 503
      throw error
    }

    const baseURL = (process.env.QWEN_BASE_URL || DEFAULT_BASE_URL).trim()
    const finalURL = buildFinalURL(baseURL)
    const model = (process.env.QWEN_MODEL || request.model).trim()
    if (!model) throw Object.assign(new Error('Qwen model 不能为空。'), { statusCode: 400 })

    // 调试日志只包含路由信息，不输出 Authorization 或 API Key。
    console.log('[Qwen] baseURL:', baseURL)
    console.log('[Qwen] finalURL:', finalURL)
    console.log('[Qwen] model:', model)

    const startedAt = performance.now()
    const response = await fetch(finalURL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userInput }
        ],
        temperature: request.temperature
      }),
      signal: AbortSignal.timeout(120_000)
    })

    console.log('[Qwen] status:', response.status)
    console.log('[Qwen] statusText:', response.statusText)

    const responseBody = await response.text()
    let payload = {}
    try { payload = responseBody ? JSON.parse(responseBody) : {} } catch { payload = { rawBody: responseBody } }

    if (!response.ok) {
      console.error('[Qwen] response body:', responseBody)
      const qwenCode = payload?.error?.code ?? payload?.code
      const qwenMessage = payload?.error?.message ?? payload?.message
      if (qwenCode !== undefined) console.error('[Qwen] error code:', qwenCode)
      if (qwenMessage !== undefined) console.error('[Qwen] error message:', qwenMessage)
      const error = new Error(payload?.error?.message || payload?.message || `Qwen API 请求失败（HTTP ${response.status}）`)
      error.statusCode = response.status
      error.details = responseBody.slice(0, 500)
      throw error
    }

    console.log('[Qwen] response body:', responseBody)

    const output = payload?.choices?.[0]?.message?.content
    if (typeof output !== 'string') throw new Error('Qwen API 返回了无法识别的响应格式。')
    return {
      provider: 'qwen',
      model: payload.model || model,
      output,
      latencyMs: Math.round(performance.now() - startedAt),
      usage: {
        promptTokens: payload.usage?.prompt_tokens ?? 0,
        completionTokens: payload.usage?.completion_tokens ?? 0,
        totalTokens: payload.usage?.total_tokens ?? 0
      }
    }
  }
}
