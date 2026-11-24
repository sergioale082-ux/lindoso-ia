import React, { useState, useEffect, useRef } from 'react'

const uid = () => Math.random().toString(36).slice(2, 10)
const LS = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } }
const saveLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

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
  const url = `https://image.pollinations.ai/prompt/${prompt}?width=${w}&height=${h}&seed=${Date.now()}&model=flux&nologo=true&enhance=true`
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
  const scrollRef = useRef(null)

  useEffect(() => { document.documentElement.style.overscrollBehavior = 'none'; document.body.style.overscrollBehavior = 'none' }, [])
  useEffect(() => { saveLS('lindoso_chats', chats) }, [chats])
  useEffect(() => { sessionStorage.setItem('lindoso_view', view); sessionStorage.setItem('lindoso_active', activeId || '') }, [view, activeId])
  useEffect(() => { saveLS('lindoso_qualidade_imagem', imgQ); saveLS('lindoso_memoria_limite', memLimit); saveLS('lindoso_tema', theme); saveLS('lindoso_gemini_key', geminiKey) }, [imgQ, memLimit, theme, geminiKey])

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
        const modelMsg = { id: uid(), role: 'model', text: 'Aqui está sua imagem! Toque para ampliar, baixar ou compartilhar.', image: img.url, ts: Date.now() }
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, modelMsg] } : c))
      } else {
        const res = await falarComGemini(text, historicoAtual)
        if (res.error === 'sem-chave') {
          const modelMsg = { id: uid(), role: 'model', text: '⚠️ Pra eu voltar a conversar, coloca tua chave do Gemini nas Configurações (⚙️). É só 1 vez. Clica no ⚙️ lá em cima > cola a chave > Voltar pro Chat.', ts: Date.now() }
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

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [activeChat?.messages?.length, loading])

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#0b0b0c] text-white' : 'bg-zinc-50 text-black'}`}>
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-[#0b0b0c]/90 backdrop-blur border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full overflow-hidden bg-[#14B8A6] flex items-center justify-center shrink-0"><img src="/logo.png" className="w-full h-full object-cover" alt="LINDOSO IA" /></div>
          <div><p className="font-bold leading-none">LINDOSO IA</p><p className="text-[11px] opacity-60">Online • v3 com Chat</p></div>
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
            <h3 className="font-bold mb-2">🔑 Chave do Gemini - REATIVAR CHAT</h3>
            <p className="text-sm opacity-70 mb-3">Cole sua chave aqui 1 vez só. Ela fica salva no seu celular.</p>
            <input value={geminiKey} onChange={e => setGeminiKey(e.target.value.trim())} placeholder="Cole sua chave AIza..." className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none" />
            <p className="text-xs opacity-50 mt-2">{geminiKey ? '✅ Chave salva! Pode voltar pro chat.' : '❌ Sem chave - o chat vai pedir pra colocar.'}</p>
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="block text-center mt-3 py-3 rounded-2xl bg-white/10 font-bold text-sm">Pegar chave grátis no Google AI Studio</a>
          </section>
          <section className="p-4 rounded-3xl bg-white/5 border border-white/10">
            <h3 className="font-bold mb-3">⚙️ Configuração da IA</h3>
            <p className="text-sm opacity-70 mb-2">Qualidade da imagem</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {['normal','hd','ultra'].map(q => (
                <button key={q} onClick={() => setImgQ(q)} className={`py-3 rounded-2xl border font-bold text-sm ${imgQ===q ? 'bg-teal-400 text-black' : 'bg-white/5'}`}>{q.toUpperCase()}</button>
              ))}
            </div>
            <p className="text-sm opacity-70 mb-2">Memória</p>
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
          <button onClick={() => { localStorage.removeItem('lindoso_chats'); setChats([]); setToast('Histórico limpo!'); setTimeout(()=>setToast(''),2000) }} className="w-full py-3 rounded-2xl bg-red-500/20 text-red-300 font-bold">🗑 Limpar todo histórico</button>
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
                <div className="w-20 h-20 mx-auto rounded-[28px] overflow-hidden bg-[#14B8A6] flex items-center justify-center mb-4"><img src="/logo.png" className="w-full h-full object-cover" alt="LINDOSO IA" /></div>
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
