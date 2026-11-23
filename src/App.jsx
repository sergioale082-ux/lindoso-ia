import React, { useState, useEffect, useRef } from 'react'

const uid = () => Math.random().toString(36).slice(2, 10)
const LS = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } }
const saveLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

// ===== LOGO NOVO APROVADO - TURQUESA + L BRANCO + PROCESSADOR =====
function Logo({ size = 36, rounded = 12 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: rounded, background: 'linear-gradient(135deg,#00E5D4 0%,#00B8C9 55%,#00A8B5 100%)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 14px rgba(0,184,201,.35)' }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: .55 }} viewBox="0 0 100 100" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="1">
        <path d="M8 12h12M14 12v12M86 18h-10M81 18v10M10 82h14M17 82v-10M88 78h-12M82 78v-8" />
        <circle cx="14" cy="12" r="2" fill="#fff" stroke="none"/><circle cx="81" cy="18" r="2" fill="#fff" stroke="none"/><circle cx="17" cy="82" r="2" fill="#fff" stroke="none"/><circle cx="82" cy="78" r="2" fill="#fff" stroke="none"/>
        <rect x="68" y="62" width="12" height="12" rx="1" /><path d="M68 65h-6M68 68h-6M74 74v4M77 74v4" />
      </svg>
      <span style={{ color: '#fff', fontWeight: 900, fontSize: size * 0.62, lineHeight: 1, zIndex: 2, fontFamily: 'system-ui,sans-serif' }}>L</span>
    </div>
  )
}
// Ícones geométricos sem emoji
const IPlus = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
const IDown = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
const IShareI = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>
const IClose = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>

const downloadImage = async (url, name) => {
  try {
    const r = await fetch(url, { mode: 'cors' })
    const b = await r.blob()
    const u = URL.createObjectURL(b)
    const a = document.createElement('a')
    a.href = u; a.download = name || 'lindoso-imagem.png'
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(u), 3000)
  } catch {
    const a = document.createElement('a')
    a.href = url; a.download = name || 'lindoso-imagem.png'; a.target = '_blank'
    document.body.appendChild(a); a.click(); a.remove()
  }
}
const shareImage = async (url, text) => {
  try {
    const r = await fetch(url, { mode: 'cors' })
    const b = await r.blob()
    const file = new File([b], 'lindoso-imagem.png', { type: b.type || 'image/png' })
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ title: 'LINDOSO IA', text: text || 'Imagem criada no LINDOSO IA', files: [file] })
      return true
    }
    throw new Error('no-share')
  } catch {
    if (navigator.share) { try { await navigator.share({ title: 'LINDOSO IA', text: text || 'Imagem', url }); return true } catch {} }
    await navigator.clipboard.writeText(url).catch(()=>{})
    return false
  }
}

async function gerarImagemHD(texto) {
  const prompt = encodeURIComponent(texto + ', high quality, ultra detailed, sharp, 4k, professional lighting, no watermark, no text')
  const q = LS('lindoso_qualidade_imagem', 'hd')
  const sizes = { normal: '768x768', hd: '1024x1024', ultra: '1280x1280' }
  const [w, h] = (sizes[q] || '1024x1024').split('x')
  // CORREÇÃO 1: seed aleatório + sem enhance (enhance causava Free limit / Image refused)
  const url = `https://image.pollinations.ai/prompt/${prompt}?width=${w}&height=${h}&seed=${Math.floor(Math.random()*999999)}&model=flux&nologo=true`
  return { url }
}

async function falarComGemini(texto, historico) {
  const key = LS('lindoso_gemini_key', '')
  if (!key) return { error: 'sem-chave' }
  const contents = [...historico.slice(-10).map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })), { role: 'user', parts: [{ text: texto }] }]
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, systemInstruction: { parts: [{ text: 'Você é o LINDOSO IA, um assistente brasileiro, simpático, direto, que fala como um amigo. Responda em português, de forma curta e útil.' }] } })
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message || 'Erro Gemini')
  return { text: data.candidates?.[0]?.content?.parts?.[0]?.text || 'Não consegui responder agora.' }
}

function ImageViewer({ src, onClose, onDownload, onShare }) {
  if (!src) return null
  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col" onClick={onClose}>
      <div className="flex justify-between items-center p-4 text-white">
        <button onClick={onClose} className="px-5 py-2.5 rounded-full bg-white/15 font-bold flex items-center gap-2"><IClose /> Fechar</button>
        {/* CORREÇÃO 7: Baixar e Compartilhar no topo da tela cheia, FUNCIONANDO */}
        <div className="flex gap-2">
          <button onClick={(e) => { e.stopPropagation(); onDownload() }} className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center" title="Baixar"><IDown /></button>
          <button onClick={(e) => { e.stopPropagation(); onShare() }} className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center" title="Compartilhar"><IShareI /></button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-3" onClick={onClose}>
        <img src={src} className="max-w-full max-h-full rounded-2xl object-contain" alt="Ampliada" />
      </div>
      <div className="p-4 flex gap-2 pb-6">
        <button onClick={(e) => { e.stopPropagation(); onDownload() }} className="flex-1 py-4 rounded-2xl bg-teal-400 text-black font-bold flex items-center justify-center gap-2"><IDown /> Baixar</button>
        <button onClick={(e) => { e.stopPropagation(); onShare() }} className="flex-1 py-4 rounded-2xl bg-white/15 text-white font-bold flex items-center justify-center gap-2"><IShareI /> Compartilhar</button>
      </div>
    </div>
  )
}

export default function App() {
  const [view, setView] = useState(() => sessionStorage.getItem('lindoso_view') || 'chat')
  const [chats, setChats] = useState(() => LS('lindoso_chats', []))
  const [activeId, setActiveId] = useState(() => sessionStorage.getItem('lindoso_active') || null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [toast, setToast] = useState('')
  const [imgQ, setImgQ] = useState(() => LS('lindoso_qualidade_imagem', 'hd'))
  const [memLimit, setMemLimit] = useState(() => LS('lindoso_memoria_limite', 20))
  const [theme, setTheme] = useState(() => LS('lindoso_tema', 'dark'))
  const [geminiKey, setGeminiKey] = useState(() => LS('lindoso_gemini_key', ''))
  const [imgError, setImgError] = useState({})
  const fileRef = useRef(null)
  const scrollRef = useRef(null)

  useEffect(() => { document.documentElement.style.overscrollBehavior = 'none'; document.body.style.overscrollBehavior = 'none' }, [])
  useEffect(() => { saveLS('lindoso_chats', chats) }, [chats])
  useEffect(() => { sessionStorage.setItem('lindoso_view', view); sessionStorage.setItem('lindoso_active', activeId || '') }, [view, activeId])
  useEffect(() => { saveLS('lindoso_qualidade_imagem', imgQ); saveLS('lindoso_memoria_limite', memLimit); saveLS('lindoso_tema', theme); saveLS('lindoso_gemini_key', geminiKey) }, [imgQ, memLimit, theme, geminiKey])

  const isLight = theme === 'light'
  const activeChat = chats.find(c => c.id === activeId) || null

  const newChat = () => {
    const c = { id: uid(), title: 'Nova conversa', messages: [], createdAt: Date.now() }
    setChats(prev => [c, ...prev].slice(0, memLimit))
    setActiveId(c.id); setView('chat')
  }

  const send = async () => {
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput('')
    let chatId = activeId
    let historicoAtual = activeChat ? activeChat.messages : []
    if (!chatId) {
      const c = { id: uid(), title: text.slice(0, 30), messages: [], createdAt: Date.now() }
      setChats(prev => [c, ...prev]); setActiveId(c.id); chatId = c.id
    }
    const userMsg = { id: uid(), role: 'user', text, ts: Date.now() }
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: c.messages.length === 0 ? text.slice(0, 30) : c.title, messages: [...c.messages, userMsg] } : c))
    setLoading(true)
    try {
      const isImage = /imagem|foto|logo|desenho|cria uma|gera uma|ilustra|criar imagem/i.test(text)
      if (isImage) {
        const img = await gerarImagemHD(text)
        const modelMsg = { id: uid(), role: 'model', text: 'Aqui está sua imagem! Clique nela para ver em tela cheia.', image: img.url, ts: Date.now() }
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, modelMsg] } : c))
      } else {
        const res = await falarComGemini(text, historicoAtual)
        if (res.error === 'sem-chave') {
          const modelMsg = { id: uid(), role: 'model', text: 'Para eu voltar a conversar, coloca tua chave do Gemini nas Configurações. É só 1 vez. Clica no ícone de engrenagem lá em cima > cola a chave > Voltar pro Chat.', ts: Date.now() }
          setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, modelMsg] } : c))
        } else {
          const modelMsg = { id: uid(), role: 'model', text: res.text, ts: Date.now() }
          setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, modelMsg] } : c))
        }
      }
    } catch (e) {
      const modelMsg = { id: uid(), role: 'model', text: 'Deu erro no Gemini: ' + e.message + '. Confere se a chave tá certa nas Configurações.', ts: Date.now() }
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, modelMsg] } : c))
    }
    setLoading(false)
  }

  // CORREÇÃO 2: Botão + volta - enviar imagem / arquivo
  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const isImg = f.type.startsWith('image/')
    const url = isImg ? URL.createObjectURL(f) : null
    let chatId = activeId
    if (!chatId) {
      const c = { id: uid(), title: f.name.slice(0, 30), messages: [], createdAt: Date.now() }
      setChats(prev => [c, ...prev]); setActiveId(c.id); chatId = c.id
    }
    const userMsg = { id: uid(), role: 'user', text: `Enviei um arquivo: ${f.name}`, image: url, ts: Date.now() }
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, userMsg] } : c))
    setTimeout(() => {
      const modelMsg = { id: uid(), role: 'model', text: 'Recebi seu arquivo! O que você quer que eu faça com ele?', ts: Date.now() }
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, modelMsg] } : c))
    }, 500)
    e.target.value = ''
  }

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [activeChat?.messages?.length, loading])

  return (
    <div className={`min-h-screen ${isLight ? 'bg-zinc-50 text-zinc-900' : 'bg-[#0b0b0c] text-white'}`}>
      {/* CORREÇÃO 8: Header agora respeita modo claro - não fica mais preto no modo claro */}
      <header className={`sticky top-0 z-40 flex items-center justify-between px-4 py-3 backdrop-blur border-b ${isLight ? 'bg-white/90 border-zinc-200' : 'bg-[#0b0b0c]/90 border-white/10'}`}>
        <div className="flex items-center gap-3">
          <Logo size={36} rounded={11} />
          <div><p className="font-bold leading-none">LINDOSO IA</p><p className="text-[11px] opacity-60">Online • v3 com Chat</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={newChat} className="px-4 py-2 rounded-full bg-teal-400 text-black font-bold text-sm">+ Novo</button>
          <button onClick={() => setView(view === 'settings' ? 'chat' : 'settings')} className={`px-4 py-2 rounded-full font-bold text-sm ${isLight ? 'bg-zinc-100' : 'bg-white/10'}`}>Config</button>
        </div>
      </header>

      {view === 'settings' ? (
        <div className="max-w-xl mx-auto p-4 space-y-4">
          <h2 className="text-xl font-bold">Configurações</h2>
          {/* CAIXA 1: Chaves - separada */}
          <section className={`p-4 rounded-3xl border ${isLight ? 'bg-white border-zinc-200' : 'bg-white/5 border-white/10'}`}>
            <h3 className="font-bold mb-2">Chave do Gemini - REATIVAR CHAT</h3>
            <p className="text-sm opacity-70 mb-3">Cole sua chave aqui 1 vez só. Ela fica salva no seu celular.</p>
            <input value={geminiKey} onChange={e => setGeminiKey(e.target.value.trim())} placeholder="Cole sua chave AIza..." className={`w-full rounded-2xl px-4 py-3 text-sm outline-none border ${isLight ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-black/40 border-white/10 text-white'}`} />
            <p className="text-xs opacity-50 mt-2">{geminiKey ? 'Chave salva! Pode voltar pro chat.' : 'Sem chave - o chat vai pedir pra colocar.'}</p>
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className={`block text-center mt-3 py-3 rounded-2xl font-bold text-sm ${isLight ? 'bg-zinc-100' : 'bg-white/10'}`}>Pegar chave grátis no Google AI Studio</a>
          </section>
          <section className={`p-4 rounded-3xl border ${isLight ? 'bg-white border-zinc-200' : 'bg-white/5 border-white/10'}`}>
            <h3 className="font-bold mb-3">Configuração da IA</h3>
            <p className="text-sm opacity-70 mb-2">Qualidade da imagem</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {['normal','hd','ultra'].map(q => (
                <button key={q} onClick={() => setImgQ(q)} className={`py-3 rounded-2xl border font-bold text-sm ${imgQ===q ? 'bg-teal-400 text-black' : isLight ? 'bg-zinc-50' : 'bg-white/5'}`}>{q.toUpperCase()}</button>
              ))}
            </div>
            <p className="text-sm opacity-70 mb-2">Memória</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[10,20,50].map(n => (
                <button key={n} onClick={() => setMemLimit(n)} className={`py-3 rounded-2xl border font-bold text-sm ${memLimit===n ? 'bg-teal-400 text-black' : isLight ? 'bg-zinc-50' : 'bg-white/5'}`}>{n}</button>
              ))}
            </div>
            <p className="text-sm opacity-70 mb-2">Tema</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setTheme('dark')} className={`py-3 rounded-2xl border font-bold ${theme==='dark' ? 'bg-teal-400 text-black' : isLight ? 'bg-zinc-50' : 'bg-white/5'}`}>Escuro</button>
              <button onClick={() => setTheme('light')} className={`py-3 rounded-2xl border font-bold ${theme==='light' ? 'bg-teal-400 text-black' : isLight ? 'bg-zinc-50' : 'bg-white/5'}`}>Claro</button>
            </div>
          </section>
          {/* CORREÇÃO 3: Limpar histórico SEPARADO, em caixa própria vermelha, fora da caixa de Chaves */}
          <section className={`p-4 rounded-3xl border border-red-300 ${isLight ? 'bg-red-50' : 'bg-red-500/10'}`}>
            <h3 className="font-bold mb-2 text-red-500">Histórico</h3>
            <p className="text-sm opacity-70 mb-3">Isso apaga todas as conversas. Não tem volta.</p>
            <button onClick={() => { localStorage.removeItem('lindoso_chats'); setChats([]); setToast('Histórico limpo!'); setTimeout(()=>setToast(''),2000) }} className="w-full py-3 rounded-2xl bg-red-500 text-white font-bold">Limpar todo histórico</button>
          </section>
          <button onClick={() => setView('chat')} className="w-full py-4 rounded-2xl bg-teal-400 text-black font-bold">Voltar pro Chat</button>
        </div>
      ) : (
        <>
          {chats.length > 0 && (
            <div className="flex gap-2 overflow-x-auto px-4 py-3">
              {chats.map(c => (
                <button key={c.id} onClick={() => { setActiveId(c.id); setView('chat') }} className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium ${c.id===activeId ? 'bg-teal-400 text-black' : isLight ? 'bg-zinc-200' : 'bg-white/10'}`}>{c.title || 'Conversa'}</button>
              ))}
            </div>
          )}
          <div ref={scrollRef} className="max-w-2xl mx-auto px-4 pb-32 pt-2 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 140px)' }}>
            {!activeChat || activeChat.messages.length === 0 ? (
              <div className="text-center pt-10">
                <div className="flex justify-center mb-4"><Logo size={80} rounded={24} /></div>
                <h1 className="text-2xl font-black">Olá, eu sou o LINDOSO IA</h1>
                <p className="opacity-60 text-sm mt-2">Peça para criar imagens, logos, textos e muito mais.</p>
                <div className="grid grid-cols-2 gap-2 mt-6 text-left">
                  {['Cria uma logo de pizzaria', 'Cria uma imagem de praia', 'Me ajuda num texto', 'Me dá uma ideia de negócio'].map(s => (
                    <button key={s} onClick={() => setInput(s)} className={`p-3 rounded-2xl border text-sm text-left ${isLight ? 'bg-white border-zinc-200' : 'bg-white/5 border-white/10'}`}>{s}</button>
                  ))}
                </div>
              </div>
            ) : activeChat.messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {/* CORREÇÃO 8: Bolha da IA no modo claro agora é cinza clarinho com texto preto - não some mais */}
                <div className={`max-w-[85%] px-4 py-3 rounded-[22px] shadow-md ${msg.role === 'user' ? 'bg-teal-400 text-black rounded-br-md' : isLight ? 'bg-white border border-zinc-200 text-zinc-900 rounded-bl-md' : 'bg-[#161617] border border-white/5 text-white rounded-bl-md'}`}>
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  {msg.image && (
                    <div className="mt-3">
                      {imgError[msg.id] ? (
                        <div className={`p-3 rounded-2xl border text-center ${isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-white/5 border-white/10'}`}>
                          <p className="font-bold text-sm">A imagem demorou ou bateu o limite gratuito.</p>
                          <p className="text-xs opacity-60 mt-1 mb-2">Espera 45 segundos e tenta de novo.</p>
                          <button onClick={() => { setImgError(s => ({...s, [msg.id]: false})); setInput('Cria uma imagem de praia'); }} className="px-4 py-2 rounded-full bg-teal-400 text-black font-bold text-sm">Tentar de novo</button>
                        </div>
                      ) : (
                        <button onClick={() => setLightbox(msg.image)} className="block w-full">
                          <img src={msg.image} onError={() => setImgError(s => ({...s, [msg.id]: true}))} className={`rounded-2xl w-full border ${isLight ? 'border-zinc-200' : 'border-white/10'}`} alt="Imagem gerada" />
                        </button>
                      )}
                      {/* CORREÇÃO 6: REMOVIDO barra Ampliar / Baixar / Compartilhar + texto "Toque na imagem" daqui. Agora é só clicar na foto. */}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && <p className="text-center text-sm opacity-60 animate-pulse">LINDOSO está pensando...</p>}
          </div>
          {/* CORREÇÃO 8: Barra de digitar também respeita modo claro */}
          <div className={`fixed bottom-0 left-0 right-0 p-3 backdrop-blur border-t ${isLight ? 'bg-white/95 border-zinc-200' : 'bg-[#0b0b0c]/95 border-white/10'}`}>
            <div className="max-w-2xl mx-auto flex gap-2 items-end">
              <input type="file" ref={fileRef} onChange={handleFile} accept="image/*,.pdf,.doc,.docx,.txt" style={{ display: 'none' }} />
              <button onClick={() => fileRef.current?.click()} title="Enviar imagem ou arquivo" className={`w-12 h-12 shrink-0 rounded-full font-black text-xl flex items-center justify-center ${isLight ? 'bg-zinc-100 text-zinc-900' : 'bg-white/10 text-white'}`}><IPlus /></button>
              <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder="Pergunte ou peça uma imagem..." className={`flex-1 rounded-[22px] px-4 py-3 text-[15px] outline-none resize-none max-h-[120px] ${isLight ? 'bg-zinc-100 text-zinc-900 placeholder:text-zinc-400' : 'bg-white/10 text-white placeholder:text-zinc-400'}`} rows={1} />
              <button onClick={send} className="w-12 h-12 shrink-0 rounded-full bg-teal-400 text-black font-black text-xl">↑</button>
            </div>
          </div>
        </>
      )}
      <ImageViewer src={lightbox} onClose={() => setLightbox(null)} onDownload={() => lightbox && downloadImage(lightbox, 'lindoso-imagem.png')} onShare={() => lightbox && shareImage(lightbox, 'Imagem criada no LINDOSO IA')} />
      {toast && <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-2 rounded-full text-sm z-[110]">{toast}</div>}
    </div>
  )
}
