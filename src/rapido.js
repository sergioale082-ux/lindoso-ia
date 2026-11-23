/* ------------------------------------------------------------------ */
/*  LINDOSO IA · Modelo 5: RELÂMPAGO (respostas rápidas)               */
/*  Groq openai/gpt-oss-20b: o mais rápido e gratuito do Groq (~1000   */
/*  tokens/s). Este arquivo também tem o cliente Groq do Modelo 2      */
/*  (openai/gpt-oss-120b, reserva do Gemini) e as regras de escolha.   */
/*  Se um modelo do Groq sair do ar ("does not exist"), o app pula     */
/*  sozinho para o próximo da lista, sem mostrar erro ao usuário.      */
/* ------------------------------------------------------------------ */

export const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

// Cada papel tem uma lista: se o 1º não existir mais, o app tenta o próximo.
// (Os modelos antigos Llama e Qwen foram desativados pelo Groq; estes são os atuais.)
// Modelo 5 – Relâmpago
export const MODELOS_RELAMPAGO = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b']
// Modelo 2 – Reserva (quando o Gemini dá limite 429)
export const MODELOS_RESERVA = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']

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
  /\b(gera|gere|gerar|cria|crie|criar|faz|faca|fazer|desenha|desenhe|desenhar|monta|monte)\b.{0,40}\b(imagem|imagens|foto|fotos|desenho|ilustracao|logo|logotipo|wallpaper|papel de parede|arte)\b|\b(imagem|foto|desenho|ilustracao) (de|do|da|com)\b|\b(desenha|desenhe|desenhar)\b/

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
 * Se o Gemini der limite 429, o app usa o Groq (GPT-OSS 120b) como reserva.
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

function erroApi(status, raw, provedor = 'Groq') {
  let err
  const modeloSumiu =
    status === 404 ||
    (status >= 400 &&
      status < 500 &&
      /does not exist|not exist|do not have access|not found|decommission|deprecated|no longer (?:available|supported)|model_not_found/i.test(
        raw
      ))
  if (modeloSumiu) {
    err = new Error(`O modelo do ${provedor} não está disponível.`)
    err.modelGone = true
  } else if (status === 401) err = new Error(`A chave do ${provedor} não é válida. Cole uma chave nova em Configurações.`)
  else if (status === 429) {
    err = new Error(`Limite de mensagens do ${provedor} atingido. Aguarde um minuto e tente novamente.`)
    err.rateLimited = true
  } else if (status === 503 || /overloaded|capacity/i.test(raw))
    err = new Error(`O ${provedor} está com muita demanda agora. Aguarde um minuto e tente novamente.`)
  else err = new Error(raw || `Ocorreu o erro ${status} na API do ${provedor}.`)
  err.status = status
  err.api = true
  return err
}

/** Chama o Groq com streaming. Devolve { text, interrupted }. */
export async function askGroq({
  apiKey,
  model,
  messages,
  onDelta,
  maxTokens = 1024,
  temperature = 0.7,
  url = GROQ_URL,
  provedor = 'Groq',
  campoMax = 'max_completion_tokens',
}) {
  const raciocinio = /gpt-oss/.test(model) ? { reasoning_effort: 'low' } : {}
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature,
        [campoMax]: maxTokens,
        ...raciocinio, // gpt-oss pensa antes de responder: 'low' = resposta bem mais rápida
      }),
    })
  } catch {
    throw new Error(NET_MSG)
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw erroApi(res.status, data?.error?.message || '', provedor)
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
    if (json.error) throw erroApi(json.error.code || 500, json.error.message || '', provedor)
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

// Tenta cada modelo da lista; se o modelo não existir mais, pula para o próximo.
// O último que funcionou fica guardado e é tentado primeiro da próxima vez.
export async function askGroqCadeia({ papel, modelos, ...resto }) {
  let guardado = ''
  try {
    guardado = localStorage.getItem('lindoso_groq_' + papel) || ''
  } catch {
    /* sem armazenamento */
  }
  const ordem = guardado && modelos.includes(guardado) ? [guardado, ...modelos.filter((m) => m !== guardado)] : modelos
  let ultimo
  for (const model of ordem) {
    try {
      const r = await askGroq({ ...resto, model })
      try {
        localStorage.setItem('lindoso_groq_' + papel, model)
      } catch {
        /* sem armazenamento */
      }
      return { ...r, model }
    } catch (err) {
      ultimo = err
      if (!err.modelGone) throw err
    }
  }
  const e = new Error('O modelo não está disponível agora.')
  e.api = true
  e.groqIndisponivel = true
  e.cause = ultimo
  throw e
}

/* ---------------------------- Modelo 5: Relâmpago ---------------------- */

/** Responde rápido e mede o tempo. Devolve { text, interrupted, segundos, rotulo }. */
export async function askRelampago({ apiKey, contents, system, onDelta }) {
  const inicio = performance.now()
  const r = await askGroqCadeia({
    papel: 'relampago',
    modelos: MODELOS_RELAMPAGO,
    apiKey,
    messages: paraMensagensGroq(contents, system),
    onDelta,
    maxTokens: 1024, // o gpt-oss gasta parte disso pensando; a resposta continua curta
    temperature: 0.7,
  })
  const segundos = (performance.now() - inicio) / 1000
  return { ...r, segundos, rotulo: rotuloRelampago(segundos) }
}

/** Texto que aparece embaixo da resposta: "Respondido em 0.8s pelo Relâmpago" */
export const rotuloRelampago = (segundos) => `Respondido em ${segundos.toFixed(1)}s pelo Relâmpago`

/* ------------------------- Modelo 2: GPT-OSS 120b (reserva) ------------ */

export async function askReserva({ apiKey, contents, system, onDelta }) {
  return askGroqCadeia({
    papel: 'reserva',
    modelos: MODELOS_RESERVA,
    apiKey,
    messages: paraMensagensGroq(contents, system),
    onDelta,
    maxTokens: 8192,
    temperature: 0.8,
  })
}

/* ----------- Ajuda para o FLUX: pedido em português -> prompt em inglês ----------- */

/** Traduz e melhora o pedido de imagem (o FLUX entende inglês bem melhor). Se falhar, devolve o original. */
export async function melhorarPromptImagem(apiKey, texto) {
  if (!apiKey) return texto
  try {
    const r = await askGroqCadeia({
      papel: 'relampago',
      modelos: MODELOS_RELAMPAGO,
      apiKey,
      messages: [
        {
          role: 'system',
          content:
            'You write prompts for the FLUX image model. Translate the user request to English and add a few vivid visual details (style, lighting, composition). Reply with ONLY the prompt, in one line, max 60 words.',
        },
        { role: 'user', content: texto },
      ],
      maxTokens: 400,
      temperature: 0.6,
    })
    const t = r.text.replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s+/g, ' ')
    return t.length > 3 ? t : texto
  } catch {
    return texto
  }
}
