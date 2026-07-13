import { qwenProvider } from './qwen.mjs'

const providers = new Map([[qwenProvider.id, qwenProvider]])

export function getProvider(id) {
  const provider = providers.get(id)
  if (!provider) {
    const error = new Error(`Provider 暂未接入：${id}`)
    error.statusCode = 400
    throw error
  }
  return provider
}
