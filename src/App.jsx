import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import logoUrl from './logo.png'
import { askRelampago, askReserva, escolherModelo } from './rapido.js'
import { askDeepSeek } from './deepseek.js'
import { gerarImagem } from './flux.js'

/* ------------------------------------------------------------------ */
/*  Configuração                                                       */
/* ------------------------------------------------------------------ */

const SYSTEM_PROMPT =
  'You are LINDOSO IA, an AI assistant created by Lindoso, from Belém, Pará, Brazil. ' +
  'You are professional, courteous, clear and objective, with a warm and friendly tone. ' +
  'You never use slang or street talk (no "mano", "bora", "kkkk" and similar). ' +
  'You always answer in Brazilian Portuguese, unless the user writes in another language. ' +
  'You help with Honor of Kings (the user is Gold rank, wants to reach Platinum and plays Clash Lane / Mid), Vainglory, school, daily life and any other subject. ' +
  'You explain things simply and accurately, in short paragraphs, and you are never boring or robotic.'

const TRAINING = [
  'SPECIALTY - you are an expert in 3 things:',
  '1. Creating complete files (HTML, CSS, JS, TXT, MD, JSON and PDF).',
  '2. Creating perfect prompts for any AI (Claude, Gemini, ChatGPT, Midjourney, etc.).',
  '3. Reading and summarizing files sent by the user (images, PDFs and text files).',
  '',
  'TRAINING RULES:',
  '- Whenever the user asks for a file, deliver the COMPLETE content, never half of it, and explain briefly how to use it.',
  '- Whenever the user asks for a prompt, deliver exactly 1 single prompt, ready to copy, never 2 separate prompts.',
  '- Whenever the user asks to improve a prompt, merge everything into 1 single prompt and explain what you fixed.',
  '- When the user sends a file, read it carefully and, unless they ask for something else, reply with a clear summary: main idea, key points and anything that needs attention.',
  '- If the request is confusing, ask what the goal is before creating.',
  '- Keep a professional, courteous and objective tone. Never use slang.',
  '',
  'OUTPUT FORMAT (the app depends on this, always follow it):',
  '- Put every file inside its own fenced code block tagged with the language: html, css, js, json, md or txt. One block per file. Never split one file into several blocks. If the file content itself contains triple backticks, open and close that block with four backticks instead.',
  '- When the user asks for a text file ("cria um texto", "cria um arquivo de texto"), put the whole text inside ONE block tagged "txt".',
  '- When the user asks for a PDF ("cria um PDF", "gera um PDF", "faz um relatório em PDF"), put the whole document inside ONE fenced block tagged exactly "pdf". Inside it use simple Markdown only: "# Title" for the title, "## Section" for sections, "- " for bullet points and a blank line between paragraphs. No tables, no images, no code. The app turns this block into a real PDF with a download button. Outside the block write just one short sentence.',
  '- Put every prompt inside ONE fenced block tagged exactly "prompt" (three backticks followed by the word prompt). Only the prompt itself goes inside the block, with no explanations. Your explanation goes outside the block.',
  '- Never put normal conversation, tips or explanations inside code blocks.',
  '',
  'TRAINING EXAMPLES TO FOLLOW:',
  'User: "Cria um arquivo HTML de um site de HoK"',
  'LINDOSO IA: "Segue o arquivo completo. Salve como index.html e abra no navegador." followed by the complete code in one html block.',
  '',
  'User: "Faz um prompt pra criar um app de delivery"',
  'LINDOSO IA: "Segue um prompt único, já otimizado para o Claude:" followed by the single prompt in one prompt block.',
  '',
  'User: "Me ajuda a melhorar esse prompt"',
  'LINDOSO IA: "Seu prompt estava confuso em duas partes. Ajustei e reuni tudo em um só:" followed by the improved prompt in one prompt block, then a short explanation of what you fixed.',
  '',
  'User: "Cria um PDF com um plano de estudos de matemática"',
  'LINDOSO IA: "Segue o PDF com o plano de estudos." followed by the whole document in one pdf block that starts with "# Plano de estudos de Matemática".',
].join('\n')

const SYSTEM_INSTRUCTION = SYSTEM_PROMPT + '\n\n' + TRAINING

const MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite']
const streamUrl = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`

const ENV_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
const ENV_GROQ = import.meta.env.VITE_GROQ_API_KEY || ''
const ENV_DEEPSEEK = import.meta.env.VITE_DEEPSEEK_API_KEY || ''

const MODELOS_INFO = [
  ['1', 'Gemini 3.8 Flash', 'Principal'],
  ['2', 'Groq GPT-OSS 120b', 'Reserva'],
  ['3', 'DeepSeek V4 Flash', 'Arquivos'],
  ['4', 'FLUX', 'Imagem'],
  ['5', 'Groq GPT-OSS 20b', 'Relâmpago para respostas rápidas'],
]

const LS = {
  convs: 'lindoso_conversas',
  theme: 'lindoso_tema',
  key: 'lindoso_chave',
  model: 'lindoso_modelo',
  profile: 'lindoso_perfil',
  groqKey: 'lindoso_chave_groq',
  deepseekKey: 'lindoso_chave_deepseek',
}

const MAX_CONVS = 20
const MAX_FILES = 4
const MAX_FILE = 10 * 1024 * 1024
const MAX_TOTAL = 12 * 1024 * 1024
const MAX_TEXT = 120000

const SUGGESTIONS = [
  'Como subir de Gold para Platinum no Honor of Kings?',
  'Explique uma build para jogar de Mid / Clash Lane',
  'Crie um arquivo HTML de um site de HoK',
  'Faça um prompt para criar um app de delivery',
  'Qual a previsão do tempo para hoje em Belém?',
]

/* ------------------------------------------------------------------ */
/*  Utilidades                                                         */
/* ------------------------------------------------------------------ */

const load = (k, fallback) => {
  try {
    const v = localStorage.getItem(k)
    return v === null ? fallback : JSON.parse(v)
  } catch {
    return fallback
  }
}

const save = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* armazenamento cheio ou bloqueado */
  }
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

const fmtDate = (ts) =>
  new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

const fmtTime = (ts) =>
  new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const clip = (t, n) => {
  const s = String(t).replace(/\s+/g, ' ').replace(/"/g, "'").trim()
  return s.length > n ? s.slice(0, n) + '…' : s
}

const greeting = () => {
  const h = new Date().getHours()
  if (h < 5) return 'Boa noite'
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

const trimConvs = (list) =>
  [...list].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CONVS)

const cleanName = (s) =>
  String(s || '')
    .replace(/[^\p{L}\p{N} '’-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)

const NAME_RE = /(?:meu nome (?:é|e)|me chamo|pode me chamar de|chamo-me)\s+([\p{L}][\p{L}'’-]{1,29})/iu

const detectName = (text) => {
  const m = text.match(NAME_RE)
  if (!m) return ''
  const n = cleanName(m[1])
  return n ? n.charAt(0).toUpperCase() + n.slice(1) : ''
}

function buildMemory(convs, activeId) {
  const list = trimConvs(convs).filter((c) => c.id !== activeId && c.messages.length)
  if (!list.length) return ''
  const lines = list.map((c, i) => {
    const last = [...c.messages].reverse().find((m) => m.role === 'user' && m.text)
    const extra = i < 5 && last ? ` | last user message: "${clip(last.text, 100)}"` : '' return `- ${fmtDate(c.updatedAt)}: ${clip(c.title, 60)}${extra}`
  })
  return 'PAST CONVERSATIONS (memory, most recent first):\n' + lines.join('\n')
}

function buildInstruction({ name, memory, mode }) {
  const parts = [SYSTEM_INSTRUCTION]
  parts.push(
    "CURRENT DATE AND TIME (user's device): " +
      new Date().toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' }) +
      '.'
  )
  if (name)
    parts.push(
      `USER MEMORY: the user's name is ${name}. Use the name naturally (for example in the greeting of the first reply of a conversation), without repeating it in every message.`
    )
  if (memory)
    parts.push(
      memory +
        '\nUse these past conversations only when relevant, to show continuity. Never invent memories that are not listed.'
    )
  if (mode === 'on')
    parts.push(
      'WEB SEARCH: Google Search is enabled for this answer. Use it for current facts, base the answer on the results and mention the date or the source naturally (weather, news, prices, scores).'
    )
  else if (mode === 'failed')
    parts.push(
      'WEB SEARCH: it is NOT available for this answer. Do not invent current data (weather, news, prices, scores). Say briefly that you could not check it online and offer general guidance only.'
    )
  return parts.join('\n\n')
}

const WEB_RE =
  /\b(hoje|agora|atualmente|atual|atuais|ultimas?|ultimos?|recentes?|noticias?|manchetes?|clima|previsao|temperatura|chover|chuva|cotacao|dolar|euro|bitcoin|placar|quem ganhou|resultado d[oae]s? (?:jogo|partida)|campeonato|eleicoes?|lancamento|nova versao|patch|atualizacao|esta semana|essa semana|amanha|ontem|mais recente|tempo em)\b/

const needsWeb = (text) =>
  WEB_RE.test(text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())

const IMG_OK = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']
const TEXT_EXT =
  /\.(txt|md|markdown|csv|tsv|json|html?|css|jsx?|tsx?|xml|svg|py|java|c|cpp|h|cs|php|rb|go|rs|sql|ya?ml|log|ini|sh)$/i

function fileKind(f) {
  const t = (f.type || '').toLowerCase()
  if (IMG_OK.includes(t) || /\.hei[cf]$/i.test(f.name)) return 'image'
  if (t === 'application/pdf' || /\.pdf$/i.test(f.name)) return 'pdf'
  if (t.startsWith('text/') || t === 'application/json' || t === 'application/xml' || TEXT_EXT.test(f.name))
    return 'text'
  return null
}

const mimeOf = (f, kind) => {
  if (kind === 'pdf') return 'application/pdf'
  if (kind === 'text') return 'text/plain'
  if (IMG_OK.includes(f.type)) return f.type
  return /\.hei[cf]$/i.test(f.name) ? 'image/heic' : 'image/jpeg'
}

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] || '')
    r.onerror = () => reject(new Error('read'))
    r.readAsDataURL(file)
  })

async function prepareFiles(items) {
  return Promise.all(
    items.map(async ({ file, kind }) => {
      const base = { name: file.name, size: file.size, kind }
      if (kind === 'text') {
        let t = await file.text()
        if (t.length > MAX_TEXT) t = t.slice(0, MAX_TEXT) + '\n[... arquivo cortado por ser muito grande ...]'
        return { ...base, mime: 'text/plain', text: t }
      }
      return { ...base, mime: mimeOf(file, kind), data: await toBase64(file) }
    })
  )
}

const DEFAULT_FILE_PROMPT =
  'Leia o(s) arquivo(s) anexado(s) e faça um resumo claro, com os pontos principais.'

function toContents(messages, filesMap) {
  const withFiles = messages.filter((m) => m.files?.length).map((m) => m.id)
  const fresh = new Set(withFiles.slice(-2))
  return messages.map((m) => {
    const parts = []
    let text = m.text || ''
    if (m.role === 'user' && m.files?.length) {
      const data = filesMap.get(m.id)
      if (data && fresh.has(m.id)) {
        for (const f of data) {
          if (f.kind === 'text')
            parts.push({ text: `[Início do arquivo: ${f.name}]\n${f.text}\n[Fim do arquivo:${f.name}]` })
          else {
            parts.push({ text: `[Arquivo anexado: ${f.name}]` })
            parts.push({ inlineData: { mimeType: f.mime, data: f.data } })
          }
        }
        if (!text) text = DEFAULT_FILE_PROMPT
      } else {
        text = `${text}\n[Anexos enviados antes:${m.files.map((f) => f.name).join(', ')}. O conteúdo não está mais disponível; baseie-se nas respostas anteriores.]`.trim()
      }
    }
    parts.push({ text: text || '...' })
    return { role: m.role, parts }
  })
}

/* ------------------------------------------------------------------ */
/*  API do Gemini                                                      */
/* ------------------------------------------------------------------ */

const NET_MSG = 'Sem conexão com a internet. Confira o sinal e tente novamente.'

function httpError(status, raw, web) {
  let err
  if (web && [400, 403, 404, 429].includes(status) && /google_search|grounding|search|tool/i.test(raw)) {
    err = new Error('A pesquisa na internet não está disponível agora.')
    err.searchUnavailable = true
    err.api = true
    return err
  }
  if (status === 400 && /api key/i.test(raw))
    err = new Error('Essa chave da API não é válida. Cole uma chave nova em Configurações.')
  else if (status === 403)
    err = new Error('A chave não tem permissão. Gere uma nova no Google AI Studio.')
  else if (status === 429)
    err = new Error('Limite de mensagens do Gemini atingido. Aguarde um minuto e tente novamente.')
  else if (status === 503 || /high demand|overloaded|try again later/i.test(raw)) {
    err = new Error('O Gemini está com muita demanda agora. Aguarde um minuto e tente novamente.')
    err.busy = true
  } else err = new Error(raw || `Ocorreu o erro ${status} na API do Gemini.`)
  err.modelGone =
    !!err.busy ||
    status === 404 ||
    /no longer available|not found|not supported|deprecated/i.test(raw)
  err.status = status
  err.rateLimited = status === 429
  err.api = true
  return err
}

async function callModelStream({ apiKey, model, contents, system, web, onDelta }) {
  let res
  try {
    res = await fetch(streamUrl(model), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { temperature: 0.9, maxOutputTokens: 8192 },
        ...(web ? { tools: [{ google_search: {} }] } : {}),
      }),
    })
  } catch {
    throw new Error(NET_MSG)
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    const e = Array.isArray(data) ? data[0] : data
    throw httpError(res.status, e?.error?.message || '', web)
  }

  let text = ''
  let block = ''
  let interrupted = false
  const sources = new Map()

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
    if (json.error) throw httpError(json.error.code || 500, json.error.message || '', false)
    const cand = json.candidates?.[0]
    const piece = (cand?.content?.parts || [])
      .filter((p) => !p.thought)
      .map((p) => p.text || '')
      .join('')
    if (piece) {
      text += piece
      onDelta?.(text)
    }
    for (const c of cand?.groundingMetadata?.groundingChunks || [])
      if (c.web?.uri && !sources.has(c.web.uri))
        sources.set(c.web.uri, { uri: c.web.uri, title: c.web.title || c.web.uri })
    if (json.promptFeedback?.blockReason) block = json.promptFeedback.blockReason
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

  if (!text)
    throw new Error(
      block
        ? 'O Gemini bloqueou essa mensagem. Tente falar de outro jeito.'
        : 'A IA não devolveu resposta. Tente novamente.'
    )
  return { text, sources: [...sources.values()], interrupted }
}

async function askGemini({ apiKey, contents, system, web, onDelta }) {
  const saved = load(LS.model, '')
  const order = saved && MODELS.includes(saved) ? [saved, ...MODELS.filter((m) => m !== saved)] : MODELS
  let lastErr
  let busyErr
  let useWeb = web
  let webFailed = false
  for (const model of order) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const mode = useWeb ? 'on' : webFailed ? 'failed' : 'off'
        const r = await callModelStream({
          apiKey,
          model,
          contents,
          system: system(mode),
          web: useWeb,
          onDelta,
        })
        save(LS.model, model)
        return { ...r, webFailed }
      } catch (err) {
        if (useWeb && err.searchUnavailable) {
          useWeb = false
          webFailed = true
          continue
        }
        lastErr = err
        if (err.busy) busyErr = err
        if (!err.modelGone) throw err
        break
      }
    }
  }
  throw busyErr || lastErr
}

/* ------------------------------------------------------------------ */
/*  Voz                                                                */
/* ------------------------------------------------------------------ */

const SR =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null
const canTTS = typeof window !== 'undefined' && 'speechSynthesis' in window

function speechText(md) {
  return md
    .replace(/````[\s\S]*?````|```[\s\S]*?```/g, ' (bloco de código omitido). ')
    .replace(/https?:\/\/\S+/g, ' link ')
    .replace(/[*`#>]+/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function chunkSpeech(text, max = 200) {
  const out = []
  let cur = ''
  for (const s of text.match(/[^.!?;:]+[.!?;:]*\s*/g) || []) {
    if (cur && (cur + s).length > max) {
      out.push(cur.trim())
      cur = ''
    }
    cur += s
    while (cur.length > max) {
      let cut = cur.lastIndexOf(' ', max)
      if (cut < 40) cut = max
      out.push(cur.slice(0, cut).trim())
      cur = cur.slice(cut)
    }
  }
  if (cur.trim()) out.push(cur.trim())
  return out.filter(Boolean)
}

function pickVoice() {
  const vs = window.speechSynthesis.getVoices()
  return (
    vs.find((v) => v.lang === 'pt-BR') ||
    vs.find((v) => (v.lang || '').toLowerCase().startsWith('pt')) ||
    null
  )
}

/* ------------------------------------------------------------------ */
/*  Ícones                                                             */
/* ------------------------------------------------------------------ */

const PATHS = {
  menu: 'M4 6h16M4 12h16M4 18h16',
  plus: 'M12 5v14M5 12h14',
  search: 'M21 21l-4.3-4.3M11 18a7 7 0 100-14 7 7 0 000 14z',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  back: 'M15 18l-6-6 6-6',
  x: 'M18 6L6 18M6 6l12 12',
  sun: 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  mic: 'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8',
  speaker: 'M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07',
  stop: 'M6 6h12v12H6z',
  file: 'M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9zM13 2v7h7',
  download: 'M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2',
  share: 'M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7M16 6l-4-4-4 4M12 2v13',
}

const Icon = ({ name, className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={PATHS[name]} />
  </svg>
)

/* ------------------------------------------------------------------ */
/*  Componentes                                                        */
/* ------------------------------------------------------------------ */

function LogoMark({ size = 36 }) {
  return (
    <img
      src={logoUrl}
      alt="LINDOSO IA"
      width={size}
      height={size}
      draggable="false"
      style={{ width: size, height: size }}
      className="shrink-0 rounded-[26%] object-cover shadow-lg shadow-teal-900/40 select-none"
    />
  )
}

function Typing({ label = 'LINDOSO IA está digitando...' }) {
  return (
    <div className="flex items-end gap-2 max-w-[88%]">
      <LogoMark size={30} />
      <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-zinc-100 text-zinc-900 dark:bg-[#0a0a0a] dark:text-zinc-100 border border-zinc-200 dark:border-teal-500/20 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">{label}</span>
        </div>
      </div>
    </div>
  )
}

function InlineText({ text }) {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return tokens.map((t, i) => {
    if (t.startsWith('**') && t.endsWith('**') && t.length > 4)
      return (
        <strong key={i} className="font-semibold">
          {t.slice(2, -2)}
        </strong>
      )
    if (t.startsWith('`') && t.endsWith('`') && t.length > 2)
      return (
        <code
          key={i}
          className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 text-[0.9em] font-mono"
        >
          {t.slice(1, -1)}
        </code>
      )
    return <span key={i}>{t}</span>
  })
}

const EXT = {
  html: 'html', htm: 'html', css: 'css', js: 'js', javascript: 'js', jsx: 'js',
  json: 'json', md: 'md', markdown: 'md', txt: 'txt', text: 'txt', plaintext: 'txt',
  xml: 'xml', svg: 'svg', csv: 'csv', py: 'py', python: 'py',
}
const MIME = {
  html: 'text/html', css: 'text/css', js: 'text/javascript', json: 'application/json',
  md: 'text/markdown', txt: 'text/plain', xml: 'application/xml', svg: 'image/svg+xml',
  csv: 'text/csv', py: 'text/x-python',
}
const BASE_NAME = { html: 'index', css: 'style', js: 'script', json: 'dados', md: 'LEIAME', txt: 'texto' }

function fileInfo(lang, code) {
  let l = (lang || '').toLowerCase()
  if (!l && /^\s*<(!doctype|html)/i.test(code)) l = 'html'
  const ext = EXT[l] || 'txt'
  return { ext, name: `${BASE_NAME[ext] || 'arquivo'}.${ext}`, mime: MIME[ext] || 'text/plain' }
}

function downloadFile(name, mime, content) {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

const HELV = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
  278, 278, 584, 584, 584, 556, 1015,
  667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
  278, 278, 278, 469, 556, 333,
  556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500,
  334, 260, 334, 584,
]
const WIDE = { '…': 1000, '—': 1000, '–': 556, '•': 350, '“': 333, '”': 333, '‘': 222, '’': 222 }
const CP1252 = {
  '€': 0x80, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99,
}

const charW = (ch) => {
  let c = ch.charCodeAt(0)
  if (c < 32 || c > 126) {
    if (WIDE[ch]) return WIDE[ch]
    c = ch.normalize('NFD').charCodeAt(0)
    if (c < 32 || c > 126) return 556
  }
  return HELV[c - 32]
}

const pdfEsc = (s) => {
  let out = ''
  for (const ch of s) {
    const c = ch.charCodeAt(0)
    let b = 63
    if ((c >= 32 && c <= 126) || (c >= 160 && c <= 255)) b = c
    else if (CP1252[ch]) b = CP1252[ch]
    if (b === 40 || b === 41 || b === 92) out += '\\' + String.fromCharCode(b)
    else if (b < 32 || b > 126) out += '\\' + b.toString(8).padStart(3, '0')
    else out += String.fromCharCode(b)
  }
  return out
}

function buildPdf(markdown) {
  const PW = 595.28
  const PH = 841.89
  const M = 56
  const pages = [[]]
  let y = PH - M

  const width = (s, size, bold) => {
    let w = 0
    for (const ch of s) w += charW(ch)
    return (w / 1000) * size * (bold ? 1.08 : 1)
  }

  const wrap = (text, size, bold, max) => {
    const out = []
    let cur = ''
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const test = cur ? cur + ' ' + word : word
      if (width(test, size, bold) <= max) {
        cur = test
        continue
      }
      if (cur) out.push(cur)
      let w = word
      while (width(w, size, bold) > max && w.length > 1) {
        let n = w.length - 1
        while (n > 1 && width(w.slice(0, n), size, bold) > max) n--
        out.push(w.slice(0, n))
        w = w.slice(n)
      }
      cur = w
    }
    if (cur) out.push(cur)
    return out
  }

  const draw = (text, size, bold, x, max, before = 0, label = '') => {
    y -= before
    wrap(text.replace(/\*([^*]+)\*/g, '$1'), size, bold, max).forEach((ln, i) => {
      const lead = size * 1.4
      if (y - lead < M) {
        pages.push([])
        y = PH - M
      }
      y -= lead
      const ops = pages[pages.length - 1]
      if (i === 0 && label)
        ops.push(`BT /F1 ${size} Tf ${(M + 4).toFixed(2)} ${y.toFixed(2)} Td (${pdfEsc(label)}) Tj ET`)
      ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${pdfEsc(ln)}) Tj ET`)
    })
  }

  const full = PW - 2 * M
  for (const raw of markdown.replace(/\r/g, '').split('\n')) {
    const line = raw.replace(/\*\*|__/g, '').replace(/`/g, '').replace(/\s+$/, '')
    let m
    if (!line.trim()) y -= 6
    else if (/^\s*([-*_])\1{2,}\s*$/.test(line)) y -= 8
    else if ((m = line.match(/^#\s+(.*)$/))) draw(m[1], 20, true, M, full, 8)
    else if ((m = line.match(/^##\s+(.*)$/))) draw(m[1], 15, true, M, full, 6)
    else if ((m = line.match(/^#{3,}\s+(.*)$/))) draw(m[1], 12.5, true, M, full, 4)
    else if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) draw(m[1], 11, false, M + 22, full - 22, 0, '•')
    else if ((m = line.match(/^\s*(\d+[.)])\s+(.*)$/))) draw(m[2], 11, false, M + 22, full - 22, 0, m[1])
    else draw(line, 11, false, M, full)
  }

  const objs = []
  const kids = []
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
  pages.forEach((ops, i) => {
    const stream = ops.join('\n')
    const c = 5 + i * 2
    objs[c] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
    objs[c + 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${c} 0 R >>`
    kids.push(`${c + 1} 0 R`)
  })
  objs[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`

  let pdf = '%PDF-1.4\n'
  const offsets = []
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = pdf.length
    pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`
  }
  const xref = pdf.length
  pdf += `xref\n0 ${objs.length}\n0000000000 65535 f \n`
  for (let i = 1; i < objs.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new Blob([pdf], { type: 'application/pdf' })
}

function pdfName(md) {
  const m = md.match(/^\s*#{1,3}\s+(.+)$/m)
  const base = (m ? m[1] : 'documento')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50)
  return (base || 'documento') + '.pdf'
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
    } catch {
      /* sem suporte */
    }
    ta.remove()
  }
}

function parseBlocks(text) {
  const blocks = []
  let buf = []
  let open = null
  const flushText = () => {
    const t = buf.join('\n')
    if (t.trim()) blocks.push({ type: 'text', text: t })
    buf = []
  }
  for (const line of text.split('\n')) {
    if (!open) {
      const m = line.match(/^\s*(`{3,})([\w+-]*)\s*$/)
      if (m) {
        flushText()
        open = { fence: m[1].length, lang: m[2], lines: [] }
      } else buf.push(line)
    } else {
      const m = line.match(/^\s*(`{3,})\s*$/)
      if (m && m[1].length >= open.fence) {
        blocks.push({ type: 'code', lang: open.lang, code: open.lines.join('\n') })
        open = null
      } else open.lines.push(line)
    }
  }
  if (open) blocks.push({ type: 'code', lang: open.lang, code: open.lines.join('\n'), open: true })
  flushText()
  return blocks
}

function PdfCard({ code, open }) {
  const [state, setState] = useState('')
  const name = pdfName(code)
  const preview = code
    .replace(/[#*`]/g, '')
    .split('\n')
    .filter((l) => l.trim())
    .slice(0, 6)
    .join('\n')

  const onDownload = () => {
    try {
      downloadFile(name, 'application/pdf', buildPdf(code))
      setState('ok')
    } catch {
      setState('erro')
    }
    setTimeout(() => setState(''), 2000)
  }

  return (
    <div className="rounded-xl overflow-hidden border border-teal-400/40 bg-teal-50 dark:bg-teal-500/10">
      <div className="flex items-center gap-3 px-3 py-3">
        <div className="shrink-0 w-10 h-10 rounded-lg bg-red-500 text-white flex items-center justify-center text-[11px] font-bold">
          PDF
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{name}</div>
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            {open ? 'Gerando o documento...' : 'Documento pronto'}
          </div>
        </div>
      </div>
      <div className="px-3 pb-3 text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words max-h-28 overflow-hidden">
        {preview}
      </div>
      <button
        onClick={onDownload}
        disabled={open}
        className="w-full py-2.5 text-sm font-semibold text-black bg-gradient-to-r from-teal-400 to-cyan-500 active:opacity-80 disabled:opacity-50"
      >
        {state === 'ok' ? 'Baixado!' : state === 'erro' ? 'Não foi possível gerar o PDF' : 'Baixar PDF'}
      </button>
    </div>
  )
}

function NameCard({ onSave }) {
  const [v, setV] = useState('')
  const submit = () => {
    if (v.trim()) onSave(v)
  }
  return (
    <div className="mt-6 w-full max-w-md rounded-2xl bg-zinc-100 dark:bg-[#0a0a0a] border border-zinc-200 dark:border-teal-500/20 p-3 text-left">
      <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-2">
        Como posso chamar você? Vou lembrar do seu nome nas próximas conversas.
      </p>
      <div className="flex gap-2">
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Seu nome"
          maxLength={40}
          className="flex-1 min-w-0 rounded-xl bg-white dark:bg-[#000000] text-zinc-900 dark:text-white border border-zinc-300 dark:border-transparent focus:border-teal-500 px-3 py-2.5 text-sm outline-none"
        />
        <button
          onClick={submit}
          disabled={!v.trim()}
          className="rounded-xl px-4 text-sm font-medium text-black bg-gradient-to-r from-teal-400 to-cyan-500 disabled:opacity-40"
        >
          Salvar
        </button>
      </div>
    </div>
  )
}

function CodeBlock({ lang, code, open = false }) {
  const [done, setDone] = useState('')
  const isPrompt = lang.toLowerCase() === 'prompt'
  const info = fileInfo(lang, code)

  const flash = (k) => {
    setDone(k)
    setTimeout(() => setDone(''), 1800)
  }
  const onCopy = async () => {
    await copyText(code)
    flash('copy')
  }
  const onDownload = () => {
    downloadFile(info.name, info.mime, code)
    flash('down')
  }

  if (isPrompt) {
    return (
      <div className="rounded-xl overflow-hidden border border-teal-400/40 bg-teal-50 dark:bg-teal-500/10">
        <div className="px-3 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300">
          Prompt pronto
        </div>
        <div className="px-3 pb-3 text-sm text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap break-words max-h-80 overflow-y-auto thin-scroll">
          {code}
        </div>
        <button
          onClick={onCopy}
          className="w-full py-2.5 text-sm font-semibold text-black bg-gradient-to-r from-teal-400 to-cyan-500 active:opacity-80"
        >
          {done === 'copy' ? 'Copiado!' : 'Copiar prompt'}
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden bg-zinc-900 text-zinc-100 border border-white/10">
      <div className="flex items-center justify-between px-3 py-1.5 bg-black/40 text-xs text-zinc-400">
        <span>{lang || info.ext}</span>
        <span>{info.name}</span>
      </div>
      <pre className="overflow-x-auto p-3 text-xs font-mono max-h-96 thin-scroll">
        <code>{code}</code>
      </pre>
      <div className="flex gap-2 p-2 bg-black/30">
        <button
          onClick={onDownload}
          disabled={open}
          className="flex-1 rounded-lg py-2 text-sm font-semibold text-black bg-gradient-to-r from-teal-400 to-cyan-500 active:opacity-80 disabled:opacity-50"
        >
          {open ? 'Gerando...' : done === 'down' ? 'Baixado!' : 'Baixar como arquivo'}
        </button>
        <button
          onClick={onCopy}
          className="rounded-lg px-4 py-2 text-sm font-medium border border-white/15 hover:bg-white/10"
        >
          {done === 'copy' ? 'Copiado!' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}

function TextLines({ text }) {
  return (
    <div className="space-y-1.5">
      {text.split('\n').map((line, j) => {
        if (line.trim() === '') return <div key={j} className="h-1" />
        const bullet = line.match(/^\s*[-*]\s+(.*)$/)
        if (bullet)
          return (
            <div key={j} className="flex gap-2 pl-1">
              <span>•</span>
              <span>
                <InlineText text={bullet[1]} />
              </span>
            </div>
          )
        const head = line.match(/^#{1,3}\s+(.*)$/)
        if (head)
          return (
            <div key={j} className="font-bold">
              <InlineText text={head[1]} />
            </div>
          )
        return (
          <div key={j}>
            <InlineText text={line} />
          </div>
        )
      })}
    </div>
  )
}

function RichText({ text, streaming = false }) {
  return (
    <div className="space-y-2 break-words">
      {parseBlocks(text).map((b, i) =>
        b.type === 'code' ? (
          b.lang.toLowerCase() === 'pdf' ? (
            <PdfCard key={i} code={b.code} open={streaming && !!b.open} />
          ) : (
            <CodeBlock key={i} lang={b.lang} code={b.code} open={streaming && !!b.open} />
          )
        ) : (
          <TextLines key={i} text={b.text} />
        )
      )}
    </div>
  )
}

const Message = memo(function Message({
  msg,
  onOpenSettings,
  onSpeak,
  speaking = false,
  onOpenImage,
}) {
  const isUser = msg.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-teal-700 text-white px-4 py-2.5 shadow-sm">
          {msg.files?.length > 0 && (
            <div className={`flex flex-wrap gap-1.5 ${msg.text ? 'mb-2' : ''}`}>
              {msg.files.map((f, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 max-w-full rounded-lg bg-white/15 px-2 py-1 text-xs"
                >
                  <Icon name="file" className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate max-w-[200px]">{f.name}</span>
                </span>
              ))}
            </div>
          )}
          {msg.text && (
            <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
              {msg.text}
            </div>
          )}
          <div className="text-[10px] text-teal-100/80 text-right mt-1">{fmtTime(msg.ts)}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-end gap-2 max-w-[94%]">
      <LogoMark size={30} />
      <div
        className={`rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm min-w-0 max-w-full ${
          msg.error
            ? 'bg-red-50 text-red-900 dark:bg-red-950/70 dark:text-red-200 border border-red-300 dark:border-red-500/30'
            : 'bg-zinc-100 text-zinc-950 border border-zinc-200 dark:bg-[#0a0a0a] dark:text-zinc-100 dark:border-teal-500/25'
        }`}
      >
        {msg.text && (
          <div className="text-[15px] leading-relaxed">
            <RichText text={msg.text} streaming={!!msg.streaming} />
          </div>
        )}
        {msg.image && (
          <button
            type="button"
            onClick={() => onOpenImage?.(msg.image)}
            className="mt-2 block text-left rounded-xl overflow-hidden border border-teal-500/30 focus:outline-none"
            aria-label="Abrir imagem em tela cheia"
          >
            <img
              src={msg.image}
              alt="Imagem criada pelo FLUX"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
              className="w-full max-w-[320px] block object-cover"
            />
          </button>
        )}
        {msg.footer && (
          <div className="mt-1 text-[10px] text-teal-700 dark:text-teal-400/80">{msg.footer}</div>
        )}
        {msg.notice && (
          <div className="mt-2 rounded-lg px-2.5 py-1.5 text-xs bg-amber-100 text-amber-950 dark:bg-amber-500/15 dark:text-amber-200">
            {msg.notice}
          </div>
        )}
        {msg.sources?.length > 0 && (
          <div className="mt-2">
            <div className="text-[11px] text-zinc-600 dark:text-zinc-400 mb-1">
              Fontes da pesquisa
            </div>
            <div className="flex flex-wrap gap-1.5">
              {msg.sources.map((s) => (
                <a
                  key={s.uri}
                  href={s.uri}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="max-w-[200px] truncate rounded-full border border-zinc-300 dark:border-white/15 px-2.5 py-1 text-xs text-teal-700 dark:text-teal-300 hover:bg-teal-500/10"
                >
                  {s.title}
                </a>
              ))}
            </div>
          </div>
        )}
        {msg.action === 'settings' && (
          <button
            onClick={onOpenSettings}
            className="mt-2 rounded-full bg-teal-400 hover:bg-teal-300 text-black text-sm font-medium px-4 py-1.5"
          >
            Abrir configurações
          </button>
        )}
        {!msg.streaming && (
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{fmtTime(msg.ts)}</span>
            {canTTS && !msg.error && onSpeak && (
              <button
                onClick={() => onSpeak(msg)}
                className={`-mr-2 p-2 rounded-full hover:bg-teal-500/10 ${
                  speaking ? 'text-teal-600 dark:text-teal-400' : 'text-zinc-500 hover:text-teal-600'
                }`}
                aria-label={speaking ? 'Parar a leitura' : 'Ouvir a resposta'}
              >
                <Icon name={speaking ? 'stop' : 'speaker'} className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
})

/* ------------------------------------------------------------------ */
/*  Modal de imagem em tela cheia (Baixar e Compartilhar)              */
/* ------------------------------------------------------------------ */

function FullscreenImageModal({ imageUrl, onClose, onNotify }) {
  const [busy, setBusy] = useState('')

  useEffect(() => {
    if (!imageUrl) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [imageUrl, onClose])

  if (!imageUrl) return null

  const getBlob = async () => {
    const res = await fetch(imageUrl)
    return await res.blob()
  }

  const handleDownload = async () => {
    if (busy) return
    setBusy('down')
    try {
      const blob = await getBlob()
      downloadFile(`lindoso-ia-${Date.now()}.png`, blob.type || 'image/png', blob)
      onNotify?.('Imagem baixada.')
    } catch {
      downloadFile(`lindoso-ia-${Date.now()}.png`, 'image/png', imageUrl)
      onNotify?.('Download iniciado.')
    } finally {
      setBusy('')
    }
  }

  const handleShare = async () => {
    if (busy) return
    setBusy('share')
    try {
      const blob = await getBlob()
      const file = new File([blob], 'lindoso-ia.png', { type: blob.type || 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: 'LINDOSO IA',
          files: [file],
        })
        onNotify?.('Imagem compartilhada.')
      } else if (navigator.share) {
        await navigator.share({
          title: 'LINDOSO IA',
          url: imageUrl,
        })
      } else {
        await copyText(imageUrl)
        onNotify?.('Link copiado para compartilhar.')
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        await copyText(imageUrl)
        onNotify?.('Link copiado.')
      }
    } finally {
      setBusy('')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Visualização da imagem"
    >
      <div
        className="flex items-center justify-between px-4 pb-3 bg-black/80 border-b border-white/10"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="p-2.5 rounded-full text-white hover:bg-white/10"
          aria-label="Fechar"
        >
          <Icon name="x" />
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!!busy}
            className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium bg-white/10 text-white hover:bg-white/20 disabled:opacity-50"
            aria-label="Baixar imagem"
          >
            <Icon name="download" className="w-4 h-4" />
            <span>{busy === 'down' ? 'Baixando...' : 'Baixar'}</span>
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={!!busy}
            className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium bg-teal-400 text-black hover:bg-teal-300 disabled:opacity-50"
            aria-label="Compartilhar imagem"
          >
            <Icon name="share" className="w-4 h-4" />
            <span>{busy === 'share' ? 'Enviando...' : 'Compartilhar'}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center p-4" onClick={onClose}>
        <img
          src={imageUrl}
          alt="Imagem em tela cheia"
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full object-contain rounded-lg select-none"
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Tela de configurações                                              */
/* ------------------------------------------------------------------ */

function KeyCard({ titulo, descricao, link, linkTexto, placeholder, valor, onSalvar, envNome, envAtivo }) {
  const [draft, setDraft] = useState(valor)
  const [show, setShow] = useState(false)
  const [ok, setOk] = useState(false)
  return (
    <section className="rounded-2xl bg-zinc-50 dark:bg-[#0a0a0a] border border-zinc-200 dark:border-teal-500/20 p-4">
      <h2 className="font-semibold">{titulo}</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 mb-3">
        {descricao}{' '}
        <a href={link} target="_blank" rel="noreferrer" className="text-teal-600 dark:text-teal-400 underline">
          {linkTexto}
        </a>
        .
      </p>
      <div className="flex gap-2">
        <input
          type={show ? 'text' : 'password'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck="false"
          className="flex-1 min-w-0 rounded-xl bg-white dark:bg-[#000000] border border-zinc-300 dark:border-white/10 px-3 py-2.5 text-sm outline-none focus:border-teal-500"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="rounded-xl px-3 text-sm border border-zinc-300 dark:border-white/10"
        >
          {show ? 'Ocultar' : 'Ver'}
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          onSalvar(draft.trim())
          setOk(true)
          setTimeout(() => setOk(false), 2000)
        }}
        className="mt-3 w-full rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 text-black font-medium py-3"
      >
        {ok ? 'Chave salva!' : 'Salvar chave'}
      </button>
      {envAtivo && !valor && (
        <p className="text-xs text-zinc-500 mt-2">Usando a chave do arquivo .env ({envNome}).</p>
      )}
    </section>
  )
}

function SettingsScreen({
  theme,
  setTheme,
  userKey,
  onSaveKey,
  groqKey,
  onSaveGroqKey,
  deepseekKey,
  onSaveDeepseekKey,
  name,
  onSaveName,
  onClearHistory,
  onBack,
}) {
  const [draft, setDraft] = useState(userKey)
  const [nameDraft, setNameDraft] = useState(name)
  const [nameSaved, setNameSaved] = useState(false)
  const [show, setShow] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    onSaveKey(draft.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const card =
    'rounded-2xl bg-zinc-50 dark:bg-[#0a0a0a] border border-zinc-200 dark:border-teal-500/20 p-4'

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header
        className="flex items-center gap-3 px-3 pb-3 bg-white dark:bg-[#000000] border-b border-zinc-200 dark:border-teal-500/20"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
      >
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-white/10"
          aria-label="Voltar"
        >
          <Icon name="back" />
        </button>
        <h1 className="text-lg font-semibold">Configurações</h1>
      </header>

      <div className="flex-1 overflow-y-auto thin-scroll p-4 space-y-4 bg-white dark:bg-[#000000]">
        <section className={card}>
          <h2 className="font-semibold mb-3">Tema</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['dark', 'Escuro', 'moon'],
              ['light', 'Claro', 'sun'],
            ].map(([val, label, icon]) => (
              <button
                key={val}
                type="button"
                onClick={() => setTheme(val)}
                className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium border transition-colors ${
                  theme === val
                    ? 'bg-teal-400 text-black border-teal-400'
                    : 'border-zinc-300 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5'
                }`}
              >
                <Icon name={icon} className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className={card}>
          <h2 className="font-semibold">Memória</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 mb-3">
            O LINDOSO IA lembra do seu nome e das últimas 20 conversas. Tudo fica salvo apenas neste
            aparelho.
          </p>
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder="Seu nome"
            maxLength={40}
            autoComplete="off"
            className="w-full rounded-xl bg-white dark:bg-[#000000] border border-zinc-300 dark:border-white/10 px-3 py-2.5 text-sm outline-none focus:border-teal-500"
          />
          <button
            type="button"
            onClick={() => {
              onSaveName(nameDraft)
              setNameSaved(true)
              setTimeout(() => setNameSaved(false), 2000)
            }}
            className="mt-3 w-full rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 text-black font-medium py-3"
          >
            {nameSaved ? 'Nome salvo!' : 'Salvar nome'}
          </button>
        </section>

        <div className="pt-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 px-1">
            Chaves da IA
          </div>
          <div className="space-y-4">
            <section className={card}>
              <h2 className="font-semibold">Chave da API (Google Gemini)</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 mb-3">
                Cola aqui a tua chave. Ela fica salva só neste aparelho. Pega uma grátis em{' '}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-teal-600 dark:text-teal-400 underline"
                >
                  aistudio.google.com/apikey
                </a>
                .
              </p>
              <div className="flex gap-2">
                <input
                  type={show ? 'text' : 'password'}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="AIza..."
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  className="flex-1 min-w-0 rounded-xl bg-white dark:bg-[#000000] border border-zinc-300 dark:border-white/10 px-3 py-2.5 text-sm outline-none focus:border-teal-500"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="rounded-xl px-3 text-sm border border-zinc-300 dark:border-white/10"
                >
                  {show ? 'Ocultar' : 'Ver'}
                </button>
              </div>
              <button
                type="button"
                onClick={handleSave}
                className="mt-3 w-full rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 text-black font-medium py-3"
              >
                {saved ? 'Chave salva!' : 'Salvar chave'}
              </button>
              {ENV_KEY && !userKey && (
                <p className="text-xs text-zinc-500 mt-2">
                  Usando a chave do arquivo .env (VITE_GEMINI_API_KEY).
                </p>
              )}
            </section>

            <KeyCard
              titulo="Chave da API (Groq)"
              descricao="Usada pelo Relâmpago (respostas rápidas) e pela reserva do Gemini. Fica salva só neste aparelho. Grátis em"
              link="https://console.groq.com/keys"
              linkTexto="console.groq.com/keys"
              placeholder="gsk_..."
              valor={groqKey}
              onSalvar={onSaveGroqKey}
              envNome="VITE_GROQ_API_KEY"
              envAtivo={!!ENV_GROQ}
            />

            <KeyCard
              titulo="Chave da API (DeepSeek)"
              descricao="Usada para criar arquivos (HTML, PDF, TXT...). É paga, mas muito barata. Sem a chave, o Gemini cria os arquivos. Pegue em"
              link="https://platform.deepseek.com/api_keys"
              linkTexto="platform.deepseek.com"
              placeholder="sk-..."
              valor={deepseekKey}
              onSalvar={onSaveDeepseekKey}
              envNome="VITE_DEEPSEEK_API_KEY"
              envAtivo={!!ENV_DEEPSEEK}
            />
          </div>
        </div>

        <section className={card}>
          <h2 className="font-semibold mb-2">Modelos</h2>
          <ul className="space-y-1.5 text-sm">
            {MODELOS_INFO.map(([n, nome, papel]) => (
              <li key={n} className="flex gap-2">
                <span className="text-teal-600 dark:text-teal-400 font-semibold">{n}.</span>
                <span>
                  {nome} <span className="text-zinc-600 dark:text-zinc-400">· {papel}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="pt-4 mt-2 border-t border-zinc-200 dark:border-white/10">
          <section className="rounded-2xl bg-red-50/70 dark:bg-red-950/20 border border-red-300 dark:border-red-500/30 p-4">
            <h2 className="font-semibold text-red-700 dark:text-red-400">Limpar histórico</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 mb-3">
              Apaga todas as conversas deste aparelho. Não dá pra desfazer.
            </p>
            <button
              type="button"
              onClick={onClearHistory}
              className="w-full rounded-xl border border-red-500 text-red-600 dark:text-red-400 font-medium py-3 hover:bg-red-500/10"
            >
              Limpar todo histórico
            </button>
          </section>
        </div>

        <p className="text-center text-xs text-zinc-500 pb-6">
          LINDOSO IA · Teu parceiro de Belém
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  App principal                                                      */
/* ------------------------------------------------------------------ */

export default function App() {
  const [convs, setConvs] = useState(() => trimConvs(load(LS.convs, [])))
  const [activeId, setActiveId] = useState(null)
  const [theme, setTheme] = useState(() => load(LS.theme, 'dark'))
  const [userKey, setUserKey] = useState(() => load(LS.key, ''))
  const [groqKey, setGroqKey] = useState(() => load(LS.groqKey, ''))
  const [deepseekKey, setDeepseekKey] = useState(() => load(LS.deepseekKey, ''))
  const [loadingImg, setLoadingImg] = useState(false)
  const [profile, setProfile] = useState(() => ({ name: cleanName(load(LS.profile, {})?.name) }))
  const [view, setView] = useState('chat')
  const [sidebar, setSidebar] = useState(false)
  const [query, setQuery] = useState('')
  const [input, setInput] = useState('')
  const [loadingId, setLoadingId] = useState(null)
  const [loadingWeb, setLoadingWeb] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [pending, setPending] = useState([])
  const [listening, setListening] = useState(false)
  const [speakingId, setSpeakingId] = useState(null)
  const [fullscreenImg, setFullscreenImg] = useState('')
  const [toast, setToast] = useState('')

  const endRef = useRef(null)
  const taRef = useRef(null)
  const scrollRef = useRef(null)
  const fileRef = useRef(null)
  const recRef = useRef(null)
  const toastTimer = useRef(null)
  const speechToken = useRef(0)
  const speakingRef = useRef(null)
  const sendingRef = useRef(false)
  const filesRef = useRef(null)
  if (filesRef.current === null) filesRef.current = new Map()

  const current = convs.find((c) => c.id === activeId) || null
  const apiKey = userKey || ENV_KEY

  useEffect(() => save(LS.convs, convs), [convs])
  useEffect(() => save(LS.key, userKey), [userKey])
  useEffect(() => save(LS.groqKey, groqKey), [groqKey])
  useEffect(() => save(LS.deepseekKey, deepseekKey), [deepseekKey])
  useEffect(() => save(LS.profile, profile), [profile])
  useEffect(() => {
    save(LS.theme, theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#000000' : '#ffffff')
  }, [theme])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [current?.messages.length, loadingId, activeId, view])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight
  }, [streamText])

  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'
  }, [input])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...convs].sort((a, b) => b.updatedAt - a.updatedAt)
    if (!q) return sorted
    return sorted.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.text.toLowerCase().includes(q))
    )
  }, [convs, query])

  const lastConv = useMemo(
    () =>
      [...convs]
        .filter((c) => c.messages.length)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0] || null,
    [convs]
  )

  const showToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 3500)
  }, [])

  const openSettings = useCallback(() => setView('settings'), [])

  const stopSpeech = useCallback(() => {
    if (!canTTS) return
    speechToken.current += 1
    window.speechSynthesis.cancel()
    speakingRef.current = null
    setSpeakingId(null)
  }, [])

  const toggleSpeak = useCallback(
    (msg) => {
      if (!canTTS) return
      const was = speakingRef.current
      stopSpeech()
      if (was === msg.id) return
      const chunks = chunkSpeech(speechText(msg.text))
      if (!chunks.length) return
      const token = speechToken.current
      const voice = pickVoice()
      speakingRef.current = msg.id
      setSpeakingId(msg.id)
      chunks.forEach((c, i) => {
        const u = new SpeechSynthesisUtterance(c)
        u.lang = 'pt-BR'
        if (voice) u.voice = voice
        u.onend = () => {
          if (speechToken.current === token && i === chunks.length - 1) {
            speakingRef.current = null
            setSpeakingId(null)
          }
        }
        u.onerror = () => {
          if (speechToken.current === token) {
            speakingRef.current = null
            setSpeakingId(null)
          }
        }
        window.speechSynthesis.speak(u)
      })
    },
    [stopSpeech]
  )

  useEffect(() => {
    stopSpeech()
  }, [activeId, stopSpeech])
  useEffect(
    () => () => {
      if (canTTS) window.speechSynthesis.cancel()
      recRef.current?.abort?.()
    },
    []
  )

  const toggleMic = () => {
    if (!SR) {
      showToast('Seu navegador não permite ditado por voz. Use o Chrome, Edge ou Safari.')
      return
    }
    if (recRef.current) {
      recRef.current.stop()
      return
    }
    stopSpeech()
    const rec = new SR()
    rec.lang = 'pt-BR'
    rec.interimResults = true
    rec.continuous = false
    const base = input.trim() ? input.trimEnd() + ' ' : ''
    rec.onresult = (e) => {
      let t = ''
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript
      setInput(base + t)
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed')
        showToast('Permissão do microfone negada. Libere o acesso nas configurações do navegador.')
      else if (e.error === 'no-speech') showToast('Não consegui ouvir nada. Tente falar novamente.')
      else if (e.error !== 'aborted') showToast('Não foi possível usar o microfone agora.')
    }
    rec.onend = () => {
      recRef.current = null
      setListening(false)
    }
    recRef.current = rec
    setListening(true)
    try {
      rec.start()
    } catch {
      recRef.current = null
      setListening(false)
    }
  }

  const clearPending = () => {
    pending.forEach((p) => p.preview && URL.revokeObjectURL(p.preview))
    setPending([])
  }

  const removePending = (id) =>
    setPending((p) => {
      const x = p.find((i) => i.id === id)
      if (x?.preview) URL.revokeObjectURL(x.preview)
      return p.filter((i) => i.id !== id)
    })

  const onPickFiles = (e) => {
    const list = Array.from(e.target.files || [])
    e.target.value = ''
    if (!list.length) return
    const next = [...pending]
    for (const f of list) {
      const kind = fileKind(f)
      if (!kind) {
        showToast(`"${f.name}" não é compatível. Envie imagem (PNG, JPG, WEBP), PDF ou texto.`)
        continue
      }
      if (f.size > MAX_FILE) {
        showToast(`"${f.name}" passa de 10 MB.`)
        continue
      }
      if (next.length >= MAX_FILES) {
        showToast(`Máximo de ${MAX_FILES} arquivos por mensagem.`)
        break
      }
      if (next.reduce((s, p) => s + p.file.size, 0) + f.size > MAX_TOTAL) {
        showToast('Os anexos passam de 12 MB no total.')
        continue
      }
      next.push({
        id: uid(),
        file: f,
        kind,
        preview: kind === 'image' ? URL.createObjectURL(f) : '',
      })
    }
    setPending(next)
  }

  const newChat = () => {
    setActiveId(null)
    setView('chat')
    setSidebar(false)
    setInput('')
    clearPending()
    stopSpeech()
    setTimeout(() => taRef.current?.focus(), 50)
  }

  const openConv = (id) => {
    setActiveId(id)
    setView('chat')
    setSidebar(false)
  }

  const deleteConv = (id) => {
    if (!window.confirm('Excluir essa conversa?')) return
    convs.find((c) => c.id === id)?.messages.forEach((m) => filesRef.current.delete(m.id))
    setConvs((p) => p.filter((c) => c.id !== id))
    if (id === activeId) setActiveId(null)
  }

  const clearHistory = () => {
    if (!window.confirm('Apagar TODAS as conversas? Não dá pra desfazer.')) return
    filesRef.current.clear()
    setConvs([])
    setActiveId(null)
    setView('chat')
  }

  const saveKey = (k) => setUserKey(k)
  const saveGroqKey = (k) => setGroqKey(k)
  const saveDeepseekKey = (k) => setDeepseekKey(k)
  const saveName = (n) => setProfile({ name: cleanName(n) })

  const send = async (raw) => {
    const text = (raw ?? input).trim()
    const items = raw === undefined ? pending : []
    if ((!text && items.length === 0) || loadingId || sendingRef.current) return

    sendingRef.current = true
    let raf = 0
    try {
      recRef.current?.stop()
      stopSpeech()

      let files = []
      if (items.length) {
        try {
          files = await prepareFiles(items)
        } catch {
          showToast('Não foi possível ler o arquivo. Tente anexar novamente.')
          return
        }
      }

      const now = Date.now()
      const userMsg = { id: uid(), role: 'user', text, ts: now }
      if (files.length) {
        userMsg.files = files.map(({ name, size, kind, mime }) => ({ name, size, kind, mime }))
        filesRef.current.set(userMsg.id, files)
      }

      const detected = detectName(text)
      if (detected && detected !== profile.name) setProfile({ name: detected })
      const name = detected || profile.name

      let convId = activeId
      let history

      if (!current) {
        convId = uid()
        const title = text
          ? text.length > 40
            ? text.slice(0, 40) + '…'
            : text
          : clip(files[0].name, 40)
        setConvs((p) =>
          trimConvs([{ id: convId, title, messages: [userMsg], createdAt: now, updatedAt: now }, ...p])
        )
        setActiveId(convId)
        history = [userMsg]
      } else {
        history = [...current.messages.filter((m) => !m.error), userMsg]
        setConvs((p) =>
          p.map((c) =>
            c.id === convId ? { ...c, messages: [...c.messages, userMsg], updatedAt: now } : c
          )
        )
      }

      setInput('')
      clearPending()
      setView('chat')

      const push = (msg) =>
        setConvs((p) =>
          p.map((c) =>
            c.id === convId ? { ...c, messages: [...c.messages, msg], updatedAt: Date.now() } : c
          )
        )

      const web = files.length === 0 && needsWeb(text)
      const memory = buildMemory(convs, convId)
      const contents = toContents(history, filesRef.current)
      const system = (mode) => buildInstruction({ name, memory, mode })
      const groqAtual = groqKey || ENV_GROQ

      const deepAtual = deepseekKey || ENV_DEEPSEEK
      let rota = escolherModelo(text, { temAnexo: files.length > 0, precisaWeb: needsWeb(text) })
      if (rota === 'deepseek' && !deepAtual) rota = 'gemini'
      const usaRelampago = rota === 'relampago' && !!groqAtual
      const usaDeepSeek = rota === 'deepseek'
      const usaFlux = rota === 'flux'

      if (!apiKey && !usaRelampago && !usaDeepSeek && !usaFlux) {
        push({
          id: uid(),
          role: 'model',
          ts: Date.now(),
          error: true,
          action: 'settings',
          text: 'Ainda falta a chave da API do Gemini. Abra Configurações e cole a chave. Ela é gratuita.',
        })
        return
      }

      setLoadingId(convId)
      setLoadingWeb(web && !usaRelampago && !usaDeepSeek && !usaFlux)
      setLoadingImg(usaFlux)
      setStreamText('')

      let latest = ''
      const onDelta = (t) => {
        latest = t
        if (!raf)
          raf = requestAnimationFrame(() => {
            raf = 0
            setStreamText(latest)
          })
      }
      const limpaStream = () => {
        cancelAnimationFrame(raf)
        raf = 0
        latest = ''
        setStreamText('')
      }

      try {
        let r = null

        if (usaFlux) {
          const img = await gerarImagem({ texto: text, groqKey: groqAtual })
          push({ id: uid(), role: 'model', text: 'Aqui está a sua imagem.', image: img.url, ts: Date.now() })
          return
        }

        if (usaDeepSeek) {
          try {
            r = await askDeepSeek({ apiKey: deepAtual, contents, system: system('off'), onDelta })
          } catch {
            r = null
            limpaStream()
          }
        }

        if (usaRelampago) {
          try {
            r = await askRelampago({ apiKey: groqAtual, contents, system: system('off'), onDelta })
          } catch {
            r = null
            limpaStream()
          }
        }

        if (!r) {
          if (!apiKey)
            throw new Error(
              'O modelo escolhido não respondeu e falta a chave do Gemini. Abra Configurações.'
            )
          try {
            r = await askGemini({ apiKey, contents, web, onDelta, system })
          } catch (err) {
            if (err.rateLimited && groqAtual) {
              limpaStream()
              try {
                const g = await askReserva({
                  apiKey: groqAtual,
                  contents,
                  onDelta,
                  system: system(web ? 'failed' : 'off'),
                })
                r = { ...g, sources: [], webFailed: web, reserva: true }
              } catch {
                limpaStream()
                throw err
              }
            } else throw err
          }
        }

        const notices = []
        if (r.reserva) notices.push('O Gemini atingiu o limite agora. Respondi com o Groq (reserva).')
        if (r.webFailed && !r.reserva)
          notices.push('Não consegui pesquisar na internet agora. Esta informação pode estar desatualizada.')
        if (r.interrupted) notices.push('A resposta foi interrompida por uma falha de conexão.')
        push({
          id: uid(),
          role: 'model',
          text: r.text,
          ts: Date.now(),
          ...(r.sources?.length ? { sources: r.sources.slice(0, 6) } : {}),
          ...(notices.length ? { notice: notices.join(' ') } : {}),
          ...(r.rotulo ? { footer: r.rotulo } : {}),
        })
      } catch (err) {
        push({ id: uid(), role: 'model', text: err.message, ts: Date.now(), error: true })
      } finally {
        cancelAnimationFrame(raf)
        raf = 0
        setStreamText('')
        setLoadingId(null)
        setLoadingWeb(false)
        setLoadingImg(false)
      }
    } finally {
      cancelAnimationFrame(raf)
      sendingRef.current = false
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  const typing = loadingId !== null && loadingId === activeId

  const subtitle = profile.name
    ? lastConv
      ? `Da última vez conversamos sobre “${lastConv.title}”.`
      : 'Em que posso ajudar hoje?'
    : 'Teu parceiro de Belém'

  return (
    <div className="h-[100dvh] flex bg-white dark:bg-[#000000] text-zinc-950 dark:text-zinc-100 overflow-hidden">
      {sidebar && (
        <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setSidebar(false)} />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-[85%] max-w-sm md:w-80 md:max-w-none flex flex-col bg-white dark:bg-[#000000] border-r border-zinc-200 dark:border-teal-500/20 transition-transform duration-200 ${
          sidebar ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        <div
          className="flex items-center gap-3 px-4 pb-3"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}
        >
          <LogoMark size={38} />
          <div className="flex-1 min-w-0">
            <div className="font-bold leading-tight">LINDOSO IA</div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400">Teu parceiro de Belém</div>
          </div>
          <button
            type="button"
            onClick={() => setSidebar(false)}
            className="md:hidden p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-white/10"
            aria-label="Fechar menu"
          >
            <Icon name="x" />
          </button>
        </div>

        <div className="px-4 space-y-3">
          <button
            type="button"
            onClick={newChat}
            className="w-full flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-teal-400 to-cyan-500 text-black font-medium py-3 shadow-lg shadow-teal-900/20 active:scale-[0.98] transition-transform"
          >
            <Icon name="plus" className="w-5 h-5" />
            Nova conversa
          </button>

          <div className="relative">
            <Icon
              name="search"
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar conversas"
              className="w-full rounded-full bg-zinc-100 dark:bg-[#111111] pl-9 pr-3 py-2.5 text-sm outline-none border border-transparent focus:border-teal-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto thin-scroll mt-3 px-2 pb-2">
          {filtered.length === 0 && (
            <p className="text-center text-sm text-zinc-500 mt-10 px-6">
              {convs.length === 0
                ? 'Nenhuma conversa ainda. Envie uma mensagem para começar.'
                : 'Nada encontrado com essa busca.'}
            </p>
          )}
          {filtered.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-1 rounded-xl pl-3 pr-1 mb-1 ${
                c.id === activeId
                  ? 'bg-teal-100/80 dark:bg-teal-500/15'
                  : 'hover:bg-zinc-100 dark:hover:bg-white/5'
              }`}
            >
              <button
                type="button"
                onClick={() => openConv(c.id)}
                className="flex-1 min-w-0 text-left py-3"
              >
                <div className="truncate text-sm font-medium">{c.title}</div>
                <div className="text-xs text-zinc-500">{fmtDate(c.updatedAt)}</div>
              </button>
              <button
                type="button"
                onClick={() => deleteConv(c.id)}
                className="p-2.5 rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-500/10"
                aria-label="Excluir conversa"
              >
                <Icon name="trash" className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div
          className="p-3 border-t border-zinc-200 dark:border-teal-500/20"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
        >
          <button
            type="button"
            onClick={() => {
              setView('settings')
              setSidebar(false)
            }}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-zinc-100 dark:hover:bg-white/5 text-sm font-medium"
          >
            <Icon name="sliders" />
            Configurações
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        {view === 'settings' ? (
          <SettingsScreen
            theme={theme}
            setTheme={setTheme}
            userKey={userKey}
            onSaveKey={saveKey}
            groqKey={groqKey}
            onSaveGroqKey={saveGroqKey}
            deepseekKey={deepseekKey}
            onSaveDeepseekKey={saveDeepseekKey}
            name={profile.name}
            onSaveName={saveName}
            onClearHistory={clearHistory}
            onBack={() => setView('chat')}
          />
        ) : (
          <>
            <header
              className="flex items-center gap-3 px-3 pb-3 bg-white dark:bg-[#000000] border-b border-zinc-200 dark:border-teal-500/20"
              style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
            >
              <button
                type="button"
                onClick={() => setSidebar(true)}
                className="md:hidden p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-white/10"
                aria-label="Abrir menu"
              >
                <Icon name="menu" />
              </button>
              <LogoMark size={38} />
              <div className="flex-1 min-w-0">
                <div className="font-bold leading-tight truncate">LINDOSO IA</div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400 truncate">
                  {typing
                    ? loadingWeb
                      ? 'pesquisando na internet...'
                      : 'digitando...'
                    : 'Teu parceiro de Belém'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setView('settings')}
                className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-white/10"
                aria-label="Configurações"
              >
                <Icon name="sliders" />
              </button>
            </header>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto thin-scroll px-3 py-4 bg-white dark:bg-[#000000]"
            >
              {!current || current.messages.length === 0 ? (
                <div className="min-h-full flex flex-col items-center justify-center text-center px-4">
                  <LogoMark size={84} />
                  <h2 className="mt-5 text-2xl font-extrabold bg-gradient-to-r from-teal-500 to-cyan-500 dark:from-teal-300 dark:to-cyan-400 bg-clip-text text-transparent">
                    {profile.name ? `${greeting()}, ${profile.name}!` : 'LINDOSO IA'}
                  </h2>
                  <p className="text-zinc-600 dark:text-zinc-400 mt-1">{subtitle}</p>
                  {lastConv && (
                    <button
                      type="button"
                      onClick={() => openConv(lastConv.id)}
                      className="mt-4 rounded-full border border-teal-500/50 text-teal-700 dark:text-teal-300 px-4 py-2 text-sm font-medium hover:bg-teal-500/10 active:scale-[0.98] transition"
                    >
                      Continuar a conversa anterior
                    </button>
                  )}
                  {!profile.name && <NameCard onSave={saveName} />}
                  <div className="mt-8 w-full max-w-md space-y-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => send(s)}
                        className="w-full text-left text-sm rounded-2xl px-4 py-3 bg-zinc-100 dark:bg-[#0a0a0a] text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-teal-500/20 hover:border-teal-500 active:scale-[0.99] transition"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto space-y-3">
                  {current.messages.map((m) => (
                    <Message
                      key={m.id}
                      msg={m}
                      onOpenSettings={openSettings}
                      onSpeak={toggleSpeak}
                      speaking={speakingId === m.id}
                      onOpenImage={setFullscreenImg}
                    />
                  ))}
                  {typing && streamText === '' && (
                    <Typing
                      label={
                        loadingImg
                          ? 'Criando a imagem...'
                          : loadingWeb
                            ? 'Pesquisando na internet...'
                            : undefined
                      }
                    />
                  )}
                  {typing && streamText !== '' && (
                    <Message
                      msg={{ id: 'stream', role: 'model', text: streamText, ts: 0, streaming: true }}
                      onOpenSettings={openSettings}
                      onOpenImage={setFullscreenImg}
                    />
                  )}
                  <div ref={endRef} />
                </div>
              )}
            </div>

            <div
              className="px-3 pt-2 bg-white dark:bg-[#000000] border-t border-zinc-200 dark:border-teal-500/20"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}
            >
              <div className="max-w-3xl mx-auto">
                {pending.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto thin-scroll pb-2">
                    {pending.map((p) => (
                      <div
                        key={p.id}
                        className="shrink-0 flex items-center gap-2 max-w-[220px] rounded-xl bg-zinc-100 dark:bg-[#111111] pl-2 pr-1 py-1.5 text-xs"
                      >
                        {p.preview ? (
                          <img src={p.preview} alt="" className="w-8 h-8 rounded-lg object-cover" />
                        ) : (
                          <span className="w-8 h-8 rounded-lg bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                            <Icon name="file" className="w-4 h-4" />
                          </span>
                        )}
                        <span className="truncate">{p.file.name}</span>
                        <button
                          type="button"
                          onClick={() => removePending(p.id)}
                          className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                          aria-label="Remover anexo"
                        >
                          <Icon name="x" className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-1.5">
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept="image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf,text/*,.txt,.md,.csv,.json,.html,.css,.js,.jsx,.xml"
                    onChange={onPickFiles}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={loadingId !== null}
                    className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-zinc-100 dark:bg-[#111111] text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-white/10 disabled:opacity-40 transition"
                    aria-label="Enviar imagem ou arquivo"
                  >
                    <Icon name="plus" className="w-5 h-5" />
                  </button>
                  <textarea
                    ref={taRef}
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={listening ? 'Ouvindo...' : 'Digite sua mensagem...'}
                    enterKeyHint="send"
                    className="flex-1 min-w-0 resize-none rounded-3xl bg-zinc-100 dark:bg-[#111111] text-zinc-950 dark:text-white px-3.5 py-2.5 text-[15px] outline-none border border-transparent focus:border-teal-500 max-h-36 leading-snug"
                  />
                  <button
                    type="button"
                    onClick={toggleMic}
                    className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition ${
                      listening
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10'
                    }`}
                    aria-label={listening ? 'Parar de ouvir' : 'Falar'}
                  >
                    <Icon name="mic" className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => send()}
                    disabled={(!input.trim() && pending.length === 0) || loadingId !== null}
                    className="shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 text-black flex items-center justify-center shadow-lg shadow-teal-900/30 disabled:opacity-40 active:scale-95 transition"
                    aria-label="Enviar"
                  >
                    <Icon name="send" className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <FullscreenImageModal
        imageUrl={fullscreenImg}
        onClose={() => setFullscreenImg('')}
        onNotify={showToast}
      />

      {toast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[60] max-w-[90%] rounded-full bg-[#0a0a0a] border border-teal-500/40 text-white text-sm px-4 py-2 shadow-lg text-center"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 84px)' }}
          role="status"
        >
          {toast}
        </div>
      )}
    </div>
  )
}
