import React, { useState, useEffect, useRef } from 'react'

// ---- Util ----
const uid = () => Math.random().toString(36).slice(2, 10)
const LS = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } }
const saveLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

// ---- Baixar / Compartilhar ----
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

// ---- Imagem em HD ----
async function gerarImagemHD(texto) {
  const prompt = encodeURIComponent(texto + ', high quality, ultra detailed, sharp, 4k, professional lighting, no watermark, no text')
  const q = LS('lindoso_qualidade_imagem', 'hd')
  const sizes = { normal: '768x768', hd: '1024x1024', ultra: '1280x1280' }
  const [w, h] = (sizes[q] || '1024x1024').split('x')
  const url = `https://image.pollinations.ai/prompt/${prompt}?width=${w}&height=${h}&seed=${Date.now()}&model=flux&nologo=true&enhance=true`
  return { url }
}

// ---- Tela Cheia da Imagem ----
function ImageViewer({ src, onClose, onDownload, onShare }) {
  if (!src) return null
  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col" onClick={onClose}>
      <div className="flex justify-between items-center p-4 text-white">
        <button onClick={onClose} className="px-5 py-2.5 rounded-full bg-white/15 font-bold">✕ Fechar</button>
        <span className="text-xs opacity-70">Toque fora para fechar</span>
      </div>
      <div className="flex-1 flex items-center justify-center p-3" onClick={onClose}>
        <img src={src} className="max-w-full max-h-full rounded-2xl object-contain" alt="Ampliada" />
      </div>
      <div className="p-4 flex gap-2 pb-6">
        <button onClick={(e) => { e.stopPropagation(); onDownload() }} className="flex-1 py-4 rounded-2xl bg-teal-400 text-black font-bold">⬇ Baixar</button>
        <button onClick={(e) => { e.stopPropagation(); onShare() }} className="flex-1 py-4 rounded-2xl bg-white/15 text-white font-bold">↗ Compartilhar</button>
      </div>
    </div>
  )
}

// ---- APP PRINCIPAL ----
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
  const scrollRef = useRef(null)

  useEffect(() => {
    document.documentElement.style.overscrollBehavior = 'none'
    document.body.style.overscrollBehavior = 'none'
  }, [])

  useEffect(() => { saveLS('lindoso_chats', chats) }, [chats])
  useEffect(() => { sessionStorage.setItem('lindoso_view', view); sessionStorage.setItem('lindoso_active', activeId || '') }, [view, activeId])
  useEffect(() => { saveLS('lindoso_qualidade_imagem', imgQ); saveLS('lindoso_memoria_limite', memLimit); saveLS('lindoso_tema', theme) }, [imgQ, memLimit, theme])

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
    if (!chatId) {
      const c = { id: uid(), title: text.slice(0, 30), messages: [], createdAt: Date.now() }
      setChats(prev => [c, ...prev]); setActiveId(c.id); chatId = c.id
    }
    const userMsg = { id: uid(), role: 'user', text, ts: Date.now() }
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: c.messages.length === 0 ? text.slice(0, 30) : c.title, messages: [...c.messages, userMsg] } : c))
    setLoading(true)
    try {
      const isImage = /imagem|foto|logo|desenho|cria uma|gera uma|ilustra/i.test(text)
      if (isImage) {
        const img = await gerarImagemHD(text)
        const modelMsg = { id: uid(), role: 'model', text: 'Aqui está sua imagem! Toque para ampliar, baixar ou compartilhar.', image: img.url, ts: Date.now() }
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, modelMsg] } : c))
      } else {
        const modelMsg = { id: uid(), role: 'model', text: 'Oi! Sou o LINDOSO IA. Me pede para criar uma imagem ou conversar. Ex: "Cria uma logo de pizzaria"', ts: Date.now() }
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, modelMsg] } : c))
      }
    } catch (e) {
      setToast('Erro ao gerar. Tente novamente.')
      setTimeout(() => setToast(''), 3000)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [activeChat?.messages?.length, loading])

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#0b0b0c] text-white' : 'bg-zinc-50 text-black'}`}>
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-[#0b0b0c]/90 backdrop-blur border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-violet-500 flex items-center justify-center font-black">L</div>
          <div><p className="font-bold leading-none">LINDOSO IA</p><p className="text-[11px] opacity-60">Online • v2 Moderno</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={newChat} className="px-4 py-2 rounded-full bg-teal-400 text-black font-bold text-sm">+ Novo</button>
          <button onClick={() => setView(view === 'settings' ? 'chat' : 'settings')} className="px-4 py-2 rounded-full bg-white/10 font-bold text-sm">⚙️</button>
        </div>
      </header>

      {view === 'settings' ? (
        <div className="max-w-xl mx-auto p-4 space-y-4">
          <h2 className="text-xl font-bold">Configurações</h2>
          <section className="p-4 rounded-3xl bg-white/5 border border-white/10">
            <h3 className="font-bold mb-3">⚙️ Configuração da IA</h3>
            <p className="text-sm opacity-70 mb-2">Qualidade da imagem</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {['normal','hd','ultra'].map(q => (
                <button key={q} onClick={() => setImgQ(q)} className={`py-3 rounded-2xl border font-bold text-sm ${imgQ===q ? 'bg-teal-400 text-black' : 'bg-white/5'}`}>{q.toUpperCase()}</button>
              ))}
            </div>
            <p className="text-sm opacity-70 mb-2">Memória - quantas conversas lembrar</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[10,20,50].map(n => (
                <button key={n} onClick={() => setMemLimit(n)} className={`py-3 rounded-2xl border font-bold text-sm ${memLimit===n ? 'bg-teal-400 text-black' : 'bg-white/5'}`}>{n}</button>
              ))}
            </div>
            <p className="text-sm opacity-70 mb-2">Tema</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setTheme('dark')} className={`py-3 rounded-2xl border font-bold ${theme==='dark' ? 'bg-teal-400 text-black' : 'bg-white/5'}`}>🌙 Escuro</button>
              <button onClick={() => setTheme('light')} className={`py-3 rounded-2xl border font-bold ${theme==='light' ? 'bg-teal-400 text-black' : 'bg-white/5'}`}>☀️ Claro</button>
            </div>
          </section>
          <section className="p-4 rounded-3xl bg-white/5 border border-white/10">
            <h3 className="font-bold mb-2">🔑 Chaves da IA</h3>
            <p className="text-sm opacity-70">Suas chaves ficam salvas só no seu celular.</p>
            <button onClick={() => { localStorage.removeItem('lindoso_chats'); setChats([]); setToast('Histórico limpo!'); setTimeout(()=>setToast(''),2000) }} className="mt-3 w-full py-3 rounded-2xl bg-red-500/20 text-red-300 font-bold">🗑 Limpar todo histórico</button>
          </section>
          <button onClick={() => setView('chat')} className="w-full py-4 rounded-2xl bg-teal-400 text-black font-bold">Voltar pro Chat</button>
        </div>
      ) : (
        <>
          {chats.length > 0 && (
            <div className="flex gap-2 overflow-x-auto px-4 py-3">
              {chats.map(c => (
                <button key={c.id} onClick={() => { setActiveId(c.id); setView('chat') }} className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium ${c.id===activeId ? 'bg-teal-400 text-black' : 'bg-white/10'}`}>{c.title || 'Conversa'}</button>
              ))}
            </div>
          )}
          <div ref={scrollRef} className="max-w-2xl mx-auto px-4 pb-32 pt-2 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 140px)' }}>
            {!activeChat || activeChat.messages.length === 0 ? (
              <div className="text-center pt-10">
                <div className="w-20 h-20 mx-auto rounded-[28px] bg-gradient-to-br from-teal-400 to-violet-500 flex items-center justify-center text-4xl font-black mb-4">L</div>
                <h1 className="text-2xl font-black">Olá, eu sou o LINDOSO IA</h1>
                <p className="opacity-60 text-sm mt-2">Peça para criar imagens, logos, textos e muito mais.</p>
                <div className="grid grid-cols-2 gap-2 mt-6 text-left">
                  {['🎨 Cria uma logo de pizzaria', '🖼️ Cria uma imagem de praia', '✍️ Me ajuda num texto', '💡 Me dá uma ideia de negócio'].map(s => (
                    <button key={s} onClick={() => setInput(s.replace(/^[🎨🖼️✍️💡] /,''))} className="p-3 rounded-2xl bg-white/5 border border-white/10 text-sm text-left">{s}</button>
                  ))}
                </div>
              </div>
            ) : activeChat.messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-4 py-3 rounded-[22px] shadow-md ${msg.role === 'user' ? 'bg-teal-400 text-black rounded-br-md' : 'bg-[#161617] border border-white/5 rounded-bl-md'}`}>
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  {msg.image && (
                    <div className="mt-3">
                      <button onClick={() => setLightbox(msg.image)} className="block w-full">
                        <img src={msg.image} className="rounded-2xl w-full border border-white/10" alt="Imagem gerada" />
                      </button>
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => setLightbox(msg.image)} className="flex-1 py-2.5 rounded-xl bg-white/10 text-xs font-bold">🔍 Ampliar</button>
                        <button onClick={() => downloadImage(msg.image, 'lindoso-imagem.png')} className="flex-1 py-2.5 rounded-xl bg-teal-400 text-black text-xs font-bold">⬇ Baixar</button>
                        <button onClick={() => shareImage(msg.image, 'Imagem criada no LINDOSO IA')} className="flex-1 py-2.5 rounded-xl bg-white/10 text-xs font-bold">↗ Compartilhar</button>
                      </div>
                      <p className="text-[11px] opacity-50 mt-1">Toque na imagem para ver em tela cheia</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && <p className="text-center text-sm opacity-60 animate-pulse">LINDOSO está pensando...</p>}
          </div>
          <div className="fixed bottom-0 left-0 right-0 p-3 bg-[#0b0b0c]/95 backdrop-blur border-t border-white/10">
            <div className="max-w-2xl mx-auto flex gap-2 items-end">
              <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder="Pergunte ou peça uma imagem..." className="flex-1 bg-white/10 rounded-[22px] px-4 py-3 text-[15px] outline-none resize-none max-h-[120px]" rows={1} />
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
