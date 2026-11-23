import { useEffect, useMemo, useRef, useState } from 'react'
import logoUrl from './logo.png'

/* ------------------------------------------------------------------ */
/*  Configuração                                                       */
/* ------------------------------------------------------------------ */

const SYSTEM_PROMPT =
  "You are LINDOSO IA, created by Lindoso. You are friendly, funny, Brazilian from Belém, Pará. You speak like a friend on WhatsApp, use slang like 'mano', 'bora', 'brabo', 'kkkk'. You help with Honor of Kings (user is Gold, wants to reach Platinum, plays Clash Lane / Mid), Vainglory, school, life, and everything. You are intelligent like Meta AI, you explain simply, you never are formal or boring."

const TRAINING = [
  'SPECIALTY - you are an expert in 2 things:',
  '1. Creating complete files (HTML, CSS, JS, TXT, MD, JSON).',
  '2. Creating perfect prompts for any AI (Claude, Gemini, ChatGPT, Midjourney, etc.).',
  '',
  'TRAINING RULES:',
  '- Whenever the user asks for a file, deliver the COMPLETE code, never half of it, and explain how to use it.',
  '- Whenever the user asks for a prompt, deliver exactly 1 single prompt, ready to copy, never 2 separate prompts.',
  '- Whenever the user asks to improve a prompt, merge everything into 1 single prompt and explain what you fixed.',
  '- If the request is confusing, ask what the goal is before creating.',
  '- Talk like a mano from Belém, simple and direct.',
  '',
  'OUTPUT FORMAT (the app depends on this, always follow it):',
  '- Put every file inside its own fenced code block tagged with the language: html, css, js, json, md or txt. One block per file. Never split one file into several blocks. If the file content itself contains triple backticks, open and close that block with four backticks instead.',
  '- Put every prompt inside ONE fenced block tagged exactly "prompt" (three backticks followed by the word prompt). Only the prompt itself goes inside the block, with no explanations. Your explanation goes outside the block.',
  '- Never put normal conversation, tips or explanations inside code blocks.',
  '',
  'TRAINING EXAMPLES TO FOLLOW:',
  'User: "Cria um arquivo HTML de um site de HoK"',
  'LINDOSO IA: "Bora mano, já fiz completo. É só salvar como index.html e abrir no Chrome." followed by the complete code in one html block.',
  '',
  'User: "Faz um prompt pra criar um app de delivery"',
  'LINDOSO IA: "Toma, prompt único e brabo, já otimizado pro Claude:" followed by the single prompt in one prompt block.',
  '',
  'User: "Me ajuda a melhorar esse prompt"',
  'LINDOSO IA: "Boa, teu prompt tava confuso em 2 partes. Arrumei e juntei tudo em 1 só:" followed by the improved prompt in one prompt block, then a short explanation of what you fixed.',
].join('\n')

const SYSTEM_INSTRUCTION = SYSTEM_PROMPT + '\n\n' + TRAINING

// O Google aposenta modelos de tempos em tempos. O app testa na ordem e guarda o que funcionar.
const MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-2.0-flash']
const apiUrl = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

const ENV_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''

const LS = {
  convs: 'lindoso_conversas',
  active: 'lindoso_ativa',
  theme: 'lindoso_tema',
  key: 'lindoso_chave',
  model: 'lindoso_modelo',
}

const SUGGESTIONS = [
  'Bora subir de Gold pra Platinum no Honor of Kings?',
  'Me explica uma build pra jogar de Mid / Clash Lane',
  'Cria um arquivo HTML de um site de HoK',
  'Faz um prompt pra criar um app de delivery',
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

async function callModel(apiKey, model, messages) {
  let res
  try {
    res = await fetch(apiUrl(model), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
        generationConfig: { temperature: 0.9, maxOutputTokens: 8192 },
      }),
    })
  } catch {
    throw new Error('Sem conexão com a internet, mano. Confere o sinal e tenta de novo.')
  }

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    const raw = data?.error?.message || ''
    let err
    if (res.status === 400 && /api key/i.test(raw))
      err = new Error('Essa chave da API não tá valendo. Cola uma chave nova em Configurações.')
    else if (res.status === 403)
      err = new Error('A chave não tem permissão. Gera uma nova no Google AI Studio.')
    else if (res.status === 429)
      err = new Error('Muita mensagem de uma vez (limite do Gemini). Espera um minutinho e manda de novo.')
    else if (res.status === 503 || /high demand|overloaded|try again later/i.test(raw)) {
      err = new Error('O Gemini tá lotado agora (muita gente usando). Espera um minutinho e manda de novo.')
      err.busy = true
    } else err = new Error(raw || `Deu erro ${res.status} na API do Gemini.`)
    // modelo aposentado ou inexistente: o app tenta o próximo da lista
    err.modelGone =
      !!err.busy ||
      res.status === 404 ||
      /no longer available|not found|not supported|deprecated/i.test(raw)
    throw err
  }

  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('')
  if (!text) {
    throw new Error(
      data?.promptFeedback?.blockReason
        ? 'O Gemini bloqueou essa mensagem. Tenta falar de outro jeito.'
        : 'A IA não devolveu resposta. Tenta de novo.'
    )
  }
  return text
}

// Tenta o último modelo que funcionou e, se ele sumir, passa pro próximo da lista
async function askGemini(apiKey, messages) {
  const saved = load(LS.model, '')
  const order = saved ? [saved, ...MODELS.filter((m) => m !== saved)] : MODELS
  let lastErr
  let busyErr
  for (const model of order) {
    try {
      const text = await callModel(apiKey, model, messages)
      save(LS.model, model)
      return text
    } catch (err) {
      lastErr = err
      if (err.busy) busyErr = err
      if (!err.modelGone) throw err
    }
  }
  // se algum modelo estava só lotado, mostra esse aviso (mais útil que o do modelo aposentado)
  throw busyErr || lastErr
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
/*  Componentes pequenos                                               */
/* ------------------------------------------------------------------ */

// Logo do LINDOSO IA (imagem src/logo.png)
function LogoMark({ size = 36 }) {
  return (
    <img
      src={logoUrl}
      alt="LINDOSO IA"
      width={size}
      height={size}
      draggable="false"
      style={{ width: size, height: size }}
      className="shrink-0 rounded-[26%] object-cover shadow-lg shadow-violet-900/40 select-none"
    />
  )
}

function Typing() {
  return (
    <div className="flex items-end gap-2 max-w-[88%]">
      <LogoMark size={30} />
      <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-white dark:bg-[#25252f] shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            LINDOSO IA está digitando...
          </span>
        </div>
      </div>
    </div>
  )
}

// Texto simples com **negrito**, `código`, listas e blocos ```
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

/* ---- arquivos e prompts dentro das respostas ---- */

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
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
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

// Separa o texto da resposta em trechos de texto e blocos de código (``` ou ````)
function parseBlocks(text) {
  const blocks = []
  let buf = []
  let open = null // { fence, lang, lines }
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
  if (open) blocks.push({ type: 'code', lang: open.lang, code: open.lines.join('\n') })
  flushText()
  return blocks
}

function CodeBlock({ lang, code }) {
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
      <div className="rounded-xl overflow-hidden border border-violet-400/40 bg-violet-50 dark:bg-violet-500/10">
        <div className="px-3 py-1.5 text-xs font-semibold text-violet-600 dark:text-violet-300">
          Prompt pronto
        </div>
        <div className="px-3 pb-3 text-sm whitespace-pre-wrap break-words max-h-80 overflow-y-auto thin-scroll">
          {code}
        </div>
        <button
          onClick={onCopy}
          className="w-full py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 active:opacity-80"
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
          className="flex-1 rounded-lg py-2 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 active:opacity-80"
        >
          {done === 'down' ? 'Baixado!' : 'Baixar como arquivo'}
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

function RichText({ text }) {
  return (
    <div className="space-y-2 break-words">
      {parseBlocks(text).map((b, i) =>
        b.type === 'code' ? (
          <CodeBlock key={i} lang={b.lang} code={b.code} />
        ) : (
          <TextLines key={i} text={b.text} />
        )
      )}
    </div>
  )
}

function Message({ msg, onOpenSettings }) {
  const isUser = msg.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-violet-600 text-white px-4 py-2.5 shadow-sm">
          <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
            {msg.text}
          </div>
          <div className="text-[10px] text-violet-200 text-right mt-1">{fmtTime(msg.ts)}</div>
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
            ? 'bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-200 border border-red-300/50 dark:border-red-500/30'
            : 'bg-white text-zinc-900 dark:bg-[#25252f] dark:text-zinc-100'
        }`}
      >
        <div className="text-[15px] leading-relaxed">
          <RichText text={msg.text} />
        </div>
        {msg.action === 'settings' && (
          <button
            onClick={onOpenSettings}
            className="mt-2 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-1.5"
          >
            Abrir configurações
          </button>
        )}
        <div className="text-[10px] text-zinc-400 mt-1">{fmtTime(msg.ts)}</div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Tela de configurações                                              */
/* ------------------------------------------------------------------ */

function SettingsScreen({ theme, setTheme, userKey, onSaveKey, onClearHistory, onBack }) {
  const [draft, setDraft] = useState(userKey)
  const [show, setShow] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    onSaveKey(draft.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const card =
    'rounded-2xl bg-white dark:bg-[#17171f] border border-zinc-200 dark:border-white/5 p-4'

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header
        className="flex items-center gap-3 px-3 pb-3 bg-white/90 dark:bg-[#12121a]/95 backdrop-blur border-b border-zinc-200 dark:border-white/5"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
      >
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-white/10"
          aria-label="Voltar"
        >
          <Icon name="back" />
        </button>
        <h1 className="text-lg font-semibold">Configurações</h1>
      </header>

      <div className="flex-1 overflow-y-auto thin-scroll p-4 space-y-4">
        <section className={card}>
          <h2 className="font-semibold mb-3">Tema</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['dark', 'Escuro', 'moon'],
              ['light', 'Claro', 'sun'],
            ].map(([val, label, icon]) => (
              <button
                key={val}
                onClick={() => setTheme(val)}
                className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium border transition-colors ${
                  theme === val
                    ? 'bg-violet-600 text-white border-violet-600'
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
          <h2 className="font-semibold">Chave da API (Google Gemini)</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-3">
            Cola aqui a tua chave. Ela fica salva só neste aparelho. Pega uma grátis em{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-violet-500 underline"
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
              className="flex-1 min-w-0 rounded-xl bg-zinc-100 dark:bg-[#0b0b12] border border-zinc-300 dark:border-white/10 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            />
            <button
              onClick={() => setShow((s) => !s)}
              className="rounded-xl px-3 text-sm border border-zinc-300 dark:border-white/10"
            >
              {show ? 'Ocultar' : 'Ver'}
            </button>
          </div>
          <button
            onClick={handleSave}
            className="mt-3 w-full rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white font-medium py-3"
          >
            {saved ? 'Chave salva!' : 'Salvar chave'}
          </button>
          {ENV_KEY && !userKey && (
            <p className="text-xs text-zinc-500 mt-2">
              Usando a chave do arquivo .env (VITE_GEMINI_API_KEY).
            </p>
          )}
        </section>

        <section className={card}>
          <h2 className="font-semibold">Dados</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-3">
            Apaga todas as conversas deste aparelho. Não dá pra desfazer.
          </p>
          <button
            onClick={onClearHistory}
            className="w-full rounded-xl border border-red-500/50 text-red-500 font-medium py-3 hover:bg-red-500/10"
          >
            Limpar histórico
          </button>
        </section>

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
  const [convs, setConvs] = useState(() => load(LS.convs, []))
  const [activeId, setActiveId] = useState(() => load(LS.active, null))
  const [theme, setTheme] = useState(() => load(LS.theme, 'dark'))
  const [userKey, setUserKey] = useState(() => load(LS.key, ''))
  const [view, setView] = useState('chat') // 'chat' | 'settings'
  const [sidebar, setSidebar] = useState(false)
  const [query, setQuery] = useState('')
  const [input, setInput] = useState('')
  const [loadingId, setLoadingId] = useState(null)

  const endRef = useRef(null)
  const taRef = useRef(null)

  const current = convs.find((c) => c.id === activeId) || null
  const apiKey = userKey || ENV_KEY

  /* ---- persistência ---- */
  useEffect(() => save(LS.convs, convs), [convs])
  useEffect(() => save(LS.active, activeId), [activeId])
  useEffect(() => save(LS.key, userKey), [userKey])
  useEffect(() => {
    save(LS.theme, theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b0b12' : '#ffffff')
  }, [theme])

  /* ---- auto-scroll ---- */
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [current?.messages.length, loadingId, activeId, view])

  /* ---- textarea cresce com o texto ---- */
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'
  }, [input])

  /* ---- lista de conversas filtrada ---- */
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

  /* ---- ações ---- */
  const newChat = () => {
    setActiveId(null)
    setView('chat')
    setSidebar(false)
    setInput('')
    setTimeout(() => taRef.current?.focus(), 50)
  }

  const openConv = (id) => {
    setActiveId(id)
    setView('chat')
    setSidebar(false)
  }

  const deleteConv = (id) => {
    if (!window.confirm('Excluir essa conversa?')) return
    setConvs((p) => p.filter((c) => c.id !== id))
    if (id === activeId) setActiveId(null)
  }

  const clearHistory = () => {
    if (!window.confirm('Apagar TODAS as conversas? Não dá pra desfazer.')) return
    setConvs([])
    setActiveId(null)
    setView('chat')
  }

  const saveKey = (k) => setUserKey(k)

  const send = async (raw) => {
    const content = (raw ?? input).trim()
    if (!content || loadingId) return

    const now = Date.now()
    const userMsg = { id: uid(), role: 'user', text: content, ts: now }
    let convId = activeId
    let history

    if (!current) {
      convId = uid()
      const title = content.length > 40 ? content.slice(0, 40) + '…' : content
      setConvs((p) => [
        { id: convId, title, messages: [userMsg], createdAt: now, updatedAt: now },
        ...p,
      ])
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
    setView('chat')

    const push = (msg) =>
      setConvs((p) =>
        p.map((c) =>
          c.id === convId ? { ...c, messages: [...c.messages, msg], updatedAt: Date.now() } : c
        )
      )

    if (!apiKey) {
      push({
        id: uid(),
        role: 'model',
        ts: Date.now(),
        error: true,
        action: 'settings',
        text: 'Mano, ainda falta a chave da API do Gemini! Vai em Configurações e cola ela lá. É grátis, bora.',
      })
      return
    }

    setLoadingId(convId)
    try {
      const reply = await askGemini(apiKey, history)
      push({ id: uid(), role: 'model', text: reply, ts: Date.now() })
    } catch (err) {
      push({ id: uid(), role: 'model', text: err.message, ts: Date.now(), error: true })
    } finally {
      setLoadingId(null)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  const typing = loadingId !== null && loadingId === activeId

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="h-[100dvh] flex bg-zinc-100 dark:bg-[#0b0b12] text-zinc-900 dark:text-zinc-100 overflow-hidden">
      {/* Fundo escuro do menu (celular) */}
      {sidebar && (
        <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setSidebar(false)} />
      )}

      {/* Menu lateral */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-[85%] max-w-sm md:w-80 md:max-w-none flex flex-col bg-white dark:bg-[#12121a] border-r border-zinc-200 dark:border-white/5 transition-transform duration-200 ${
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
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Teu parceiro de Belém</div>
          </div>
          <button
            onClick={() => setSidebar(false)}
            className="md:hidden p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-white/10"
            aria-label="Fechar menu"
          >
            <Icon name="x" />
          </button>
        </div>

        <div className="px-4 space-y-3">
          <button
            onClick={newChat}
            className="w-full flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-blue-600 text-white font-medium py-3 shadow-lg shadow-violet-900/20 active:scale-[0.98] transition-transform"
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
              className="w-full rounded-full bg-zinc-100 dark:bg-[#1c1c27] pl-9 pr-3 py-2.5 text-sm outline-none border border-transparent focus:border-violet-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto thin-scroll mt-3 px-2 pb-2">
          {filtered.length === 0 && (
            <p className="text-center text-sm text-zinc-500 mt-10 px-6">
              {convs.length === 0
                ? 'Nenhuma conversa ainda. Manda um "e aí" pra começar!'
                : 'Nada encontrado com essa busca.'}
            </p>
          )}
          {filtered.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-1 rounded-xl pl-3 pr-1 mb-1 ${
                c.id === activeId
                  ? 'bg-violet-100 dark:bg-violet-500/15'
                  : 'hover:bg-zinc-100 dark:hover:bg-white/5'
              }`}
            >
              <button onClick={() => openConv(c.id)} className="flex-1 min-w-0 text-left py-3">
                <div className="truncate text-sm font-medium">{c.title}</div>
                <div className="text-xs text-zinc-500">{fmtDate(c.updatedAt)}</div>
              </button>
              <button
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
          className="p-3 border-t border-zinc-200 dark:border-white/5"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
        >
          <button
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

      {/* Área principal */}
      <main className="flex-1 min-w-0 flex flex-col">
        {view === 'settings' ? (
          <SettingsScreen
            theme={theme}
            setTheme={setTheme}
            userKey={userKey}
            onSaveKey={saveKey}
            onClearHistory={clearHistory}
            onBack={() => setView('chat')}
          />
        ) : (
          <>
            {/* Cabeçalho */}
            <header
              className="flex items-center gap-3 px-3 pb-3 bg-white/90 dark:bg-[#12121a]/95 backdrop-blur border-b border-zinc-200 dark:border-white/5"
              style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
            >
              <button
                onClick={() => setSidebar(true)}
                className="md:hidden p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-white/10"
                aria-label="Abrir menu"
              >
                <Icon name="menu" />
              </button>
              <LogoMark size={38} />
              <div className="flex-1 min-w-0">
                <div className="font-bold leading-tight truncate">LINDOSO IA</div>
                <div className="text-xs text-emerald-500 truncate">
                  {typing ? 'digitando...' : 'Teu parceiro de Belém'}
                </div>
              </div>
              <button
                onClick={() => setView('settings')}
                className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-white/10"
                aria-label="Configurações"
              >
                <Icon name="sliders" />
              </button>
            </header>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto thin-scroll px-3 py-4 bg-[#eceef5] dark:bg-[#0b0b12]">
              {!current || current.messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <LogoMark size={84} />
                  <h2 className="mt-5 text-2xl font-extrabold bg-gradient-to-r from-violet-500 to-blue-500 bg-clip-text text-transparent">
                    LINDOSO IA
                  </h2>
                  <p className="text-zinc-500 dark:text-zinc-400 mt-1">Teu parceiro de Belém</p>
                  <div className="mt-8 w-full max-w-md space-y-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="w-full text-left text-sm rounded-2xl px-4 py-3 bg-white dark:bg-[#17171f] border border-zinc-200 dark:border-white/5 hover:border-violet-500 active:scale-[0.99] transition"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto space-y-3">
                  {current.messages.map((m) => (
                    <Message key={m.id} msg={m} onOpenSettings={() => setView('settings')} />
                  ))}
                  {typing && <Typing />}
                  <div ref={endRef} />
                </div>
              )}
            </div>

            {/* Campo de envio */}
            <div
              className="px-3 pt-2 bg-white dark:bg-[#12121a] border-t border-zinc-200 dark:border-white/5"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}
            >
              <div className="max-w-3xl mx-auto flex items-end gap-2">
                <textarea
                  ref={taRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Manda uma mensagem..."
                  enterKeyHint="send"
                  className="flex-1 resize-none rounded-3xl bg-zinc-100 dark:bg-[#1c1c27] px-4 py-3 text-[15px] outline-none border border-transparent focus:border-violet-500 max-h-36 leading-snug"
                />
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || loadingId !== null}
                  className="shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-violet-900/30 disabled:opacity-40 active:scale-95 transition"
                  aria-label="Enviar"
                >
                  <Icon name="send" className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
