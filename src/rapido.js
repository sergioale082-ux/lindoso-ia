/* ------------------------------------------------------------------ */
/*  LINDOSO IA · Modelo 5: RELÂMPAGO (respostas rápidas)               */
/*  Groq llama-3.1-8b-instant: o modelo mais rápido e gratuito do Groq */
/*  (centenas de tokens por segundo, a resposta começa em < 1 s).      */
/*  Este arquivo também tem o cliente Groq que serve ao Modelo 2       */
/*  (Llama 70b, reserva do Gemini) e as regras de escolha do modelo.   */
/* ------------------------------------------------------------------ */

export const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

// Modelo 5 – Relâmpago
export const MODELO_RELAMPAGO = 'llama-3.1-8b-instant'
// Modelo 2 – Reserva (quando o Gemini dá limite 429)
export const MODELO_RESERVA = 'llama-3.3-70b-versatile'

export const LIMITE_PALAVRAS_RAPIDO = 10

const NET_MSG = 'Sem conexão com a internet. Confira o sinal e tente novamente.'

/* ---------------------------- Regras de uso ---------------------------- */

const semAcento = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const contaPalavras = (t) => (String(t).trim().match(/\S+/g) || []).length

// pediu para CRIAR uma imagem  -> FLUX
const IMAGEM_RE =
  /\b(gera|gere|gerar|cria|crie|criar|faz|faca|fazer|desenha|desenhe|desenhar|monta|monte)\b.{0,40}\b(imagem|imagens|foto|fotos|desenho|ilustracao|logo|logotipo|wallpaper|papel de parede|arte)\b|\b(imagem|foto|desenho|ilustracao) (de|do|da|com)\b/

// pediu para CRIAR um arquivo -> DeepSeek
const ARQUIVO_RE =
  /\b(cria|crie|criar|gera|gere|gerar|faz|faca|fazer|monta|monte|escreve|escreva|escrever)\b.{0,40}\b(arquivo|html|css|js|json|pdf|txt|markdown|planilha|csv|site|pagina|codigo|script)\b/

// pergunta que parece curta, mas é complexa: vai para o Gemini
const COMPLEXA_RE =
  /\b(explique|explica|analise|analisa|compare|compara|resuma|resume|traduza|ensina|ensine|detalhad[oa]|passo a passo|build|prompt|codigo|programa|redacao|resumo|como (?:fazer|faco|funciona|criar|posso|subir|jogar|ganhar))\b|```|https?:\/\//

// perguntas de data e hora o Relâmpago responde (a data vai no prompt do sistema)
const DATA_HORA_RE = /\b(que dia (?:e|eh) hoje|data de hoje|que horas|que dia da semana)\b/

export const pedeImagem = (texto) => IMAGEM_RE.test(semAcento(texto))
export const pedeArquivo = (texto) => ARQUIVO_RE.test(semAcento(texto))

/** Mensagem curta e simples? (até 10 palavras, sem anexo, sem pedir pesquisa na internet) */
export function mensagemRapida(texto, { temAnexo = false, precisaWeb = false } = {}) {
  if (temAnexo) return false
  const t = semAcento(texto).trim()
  if (!t || contaPalavras(t) > LIMITE_PALAVRAS_RAPIDO) return false
  if (COMPLEXA_RE.test(t)) return false
  if (precisaWeb && !DATA_HORA_RE.test(t)) return false
  return true
}

/**
 * Escolhe o modelo inicial de cada mensagem:
 *  'flux'      -> pediu imagem
 *  'deepseek'  -> pediu arquivo
 *  'relampago' -> mensagem curta e simples
 *  'gemini'    -> todo o resto (mensagem longa ou complexa)
 * Se o Gemini der limite 429, o app usa o Groq Llama como reserva.
 */
export function escolherModelo(texto, { temAnexo = false, precisaWeb = false } = {}) {
  if (!temAnexo && pedeImagem(texto)) return 'flux'
  if (!temAnexo && pedeArquivo(texto)) return 'deepseek'
  if (mensagemRapida(texto, { temAnexo, precisaWeb })) return 'relampago'
  return 'gemini'
}

/* ------------------------------ Cliente Groq --------------------------- */

// converte o formato de mensagens do Gemini (contents) para o formato OpenAI/Groq
export function paraMensagensGroq(contents, system) {
  const msgs = [{ role: 'system', content: system }]
  for (const c of contents) {
    const texto = (c.parts || [])
      .map((p) => p.text || '')
      .filter(Boolean)
      .join('\n')
      .trim()
    if (!texto) continue
    msgs.push({ role: c.role === 'model' ? 'assistant' : 'user', content: texto })
  }
  return msgs
}

function erroGroq(status, raw) {
  let err
  if (status === 401) err = new Error('A chave do Groq não é válida. Cole uma chave nova em Configurações.')
  else if (status === 429) {
    err = new Error('Limite de mensagens do Groq atingido. Aguarde um minuto e tente novamente.')
    err.rateLimited = true
  } else if (status === 503 || /overloaded|capacity/i.test(raw))
    err = new Error('O Groq está com muita demanda agora. Aguarde um minuto e tente novamente.')
  else err = new Error(raw || `Ocorreu o erro ${status} na API do Groq.`)
  err.status = status
  err.api = true
  return err
}

/** Chama o Groq com streaming. Devolve { text, interrupted }. */
export async function askGroq({ apiKey, model, messages, onDelta, maxTokens = 1024, temperature = 0.7 }) {
  let res
  try {
    res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature,
        max_tokens: maxTokens,
      }),
    })
  } catch {
    throw new Error(NET_MSG)
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw erroGroq(res.status, data?.error?.message || '')
  }

  let text = ''
  let interrupted = false

  const handle = (evt) => {
    const data = evt
      .split(/\r?\n/)
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
      .join('')
    if (!data || data === '[DONE]') return
    let json
    try {
      json = JSON.parse(data)
    } catch {
      return
    }
    if (json.error) throw erroGroq(json.error.code || 500, json.error.message || '')
    const piece = json.choices?.[0]?.delta?.content || ''
    if (piece) {
      text += piece
      onDelta?.(text)
    }
  }

  try {
    if (res.body?.getReader) {
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const events = buf.split(/\r?\n\r?\n/)
        buf = events.pop()
        events.forEach(handle)
      }
      if (buf.trim()) handle(buf)
    } else {
      ;(await res.text()).split(/\r?\n\r?\n/).forEach(handle)
    }
  } catch (e) {
    if (!text) throw e.api ? e : new Error(NET_MSG)
    interrupted = true
  }

  if (!text) throw new Error('A IA não devolveu resposta. Tente novamente.')
  return { text, interrupted }
}

/* ---------------------------- Modelo 5: Relâmpago ---------------------- */

/** Responde rápido e mede o tempo. Devolve { text, interrupted, segundos, rotulo }. */
export async function askRelampago({ apiKey, contents, system, onDelta }) {
  const inicio = performance.now()
  const r = await askGroq({
    apiKey,
    model: MODELO_RELAMPAGO,
    messages: paraMensagensGroq(contents, system),
    onDelta,
    maxTokens: 512, // respostas curtas = mais rápido
    temperature: 0.7,
  })
  const segundos = (performance.now() - inicio) / 1000
  return { ...r, segundos, rotulo: rotuloRelampago(segundos) }
}

/** Texto que aparece embaixo da resposta: "Respondido em 0.8s pelo Relâmpago" */
export const rotuloRelampago = (segundos) => `Respondido em ${segundos.toFixed(1)}s pelo Relâmpago`

/* ------------------------- Modelo 2: Llama 70b (reserva) --------------- */

export async function askReserva({ apiKey, contents, system, onDelta }) {
  return askGroq({
    apiKey,
    model: MODELO_RESERVA,
    messages: paraMensagensGroq(contents, system),
    onDelta,
    maxTokens: 4096,
    temperature: 0.8,
  })
}
