/* ------------------------------------------------------------------ */
/*  LINDOSO IA · Modelo 3: DeepSeek (criação de arquivos)              */
/*  Modelos atuais da API: deepseek-v4-flash e deepseek-v4-pro (os    */
/*  nomes antigos foram desativados em julho de 2026).                 */
/*  Se um sumir, o app pula sozinho para o próximo da lista.           */
/* ------------------------------------------------------------------ */

import { askGroqCadeia, paraMensagensGroq } from './rapido.js'

export const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'
export const MODELOS_DEEPSEEK = ['deepseek-v4-flash', 'deepseek-v4-pro']

export async function askDeepSeek({ apiKey, contents, system, onDelta }) {
  return askGroqCadeia({
    papel: 'deepseek',
    modelos: MODELOS_DEEPSEEK,
    url: DEEPSEEK_URL,
    provedor: 'DeepSeek',
    campoMax: 'max_tokens',
    apiKey,
    messages: paraMensagensGroq(contents, system),
    onDelta,
    maxTokens: 8192,
    temperature: 0.7,
  })
}
