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

function limparPrompt(texto) {
  let t = texto.toLowerCase()
  t = t.replace(/cria|criar|gera|gerar|me mostre|me mostra|faz|fazer|uma|um|de|foto|imagem|pra|para/g, ' ').trim()
  if (!t) t = 'beautiful landscape'
  return t
}

async function gerarImagemHD(texto) {
  const base = limparPrompt(texto)
  const traducao = {
    'pizza': 'delicious cheese pizza, close up photo, appetizing, restaurant',
    'praia': 'beautiful tropical beach, turquoise water, white sand',
    'gato': 'cute cat portrait, photorealistic',
    'cachorro': 'cute dog portrait, photorealistic',
    'logo de pizzaria': 'pizza restaurant logo, modern, red and yellow, vector',
    'carro': 'luxury sports car, studio photo',
    'casa': 'modern beautiful house, architecture photo'
  }
  let promptEn = traducao[base] || base
  if (texto.toLowerCase().includes('logo')) promptEn = promptEn + ', clean logo design, vector, white background'
  else promptEn = promptEn + ', high quality photo, detailed, sharp'
  const q = LS('lindoso_qualidade_imagem', 'hd')
  const sizes = { normal: '768x768', hd: '1024x1024', ultra: '1280x1280' }
  const [w, h] = (sizes[q] || '1024x1024').split('x')
  const seed = Date.now()
  const p = encodeURIComponent(promptEn)
  const urlTurbo = `https://image.pollinations.ai/prompt/${p}?width=${w}&height=${h}&seed=${seed}&model=turbo&nologo=true`
  return { url: urlTurbo, fallback: `https://image.pollinations.ai/prompt/${p}?width=${w}&height=${h}&seed=${seed + 1}&model=flux&nologo=true` }
}

async function falarComGemini(texto, historico, anexo) {
  const key = LS('lindoso_gemini_key', '')
  if (!key) return { error: 'sem-chave' }
  let parts = [{ text: texto || 'Descreva essa imagem / arquivo em detalhes.' }]
  if (anexo && anexo.base64 && anexo.type.startsWith('image/')) {
    parts.push({ inline_data: { mime_type: anexo.type, data: anexo.base64.split(',')[1] } })
  }
  const contents = [...historico.slice(-10).map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })), { role: 'user', parts }]
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, systemInstruction: { parts: [{ text: 'Você é o LINDOSO IA, assistente brasileiro, simpático, direto. Se o usuário mandar foto, descreva e responda sobre ela. Responda em português, curto e útil.' }] } })
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

function ImagemComFallback({ url, fallback }) {
  const [src, setSrc] = useState(url)
  const [lb, setLb] = useState(false)
  return (
    <div className="mt-3">
      <button onClick={() => setLb(src)} className="block w-full">
        <img src={src} onError={() => { if (src !== fallback) setSrc(fallback) }} className="rounded-2xl w-full border border-white/10 bg-white" alt="Imagem gerada" />
      </button>
      <div className="flex gap-2 mt-2">
        <button onClick={() => setLb(src)} className="flex-1 py-2.5 rounded-xl bg-white/10 text-xs font-bold">🔍 Ampliar</button>
        <button onClick={() => downloadImage(src, 'lindoso-imagem.png')} className="flex-1 py-2.5 rounded-xl bg-teal-400 text-black text-xs font-bold">⬇ Baixar</button>
        <button onClick={() => shareImage(src, 'Imagem criada no LINDOSO IA')} className="flex-1 py-2.5 rounded-xl bg-white/10 text-xs font-bold">↗ Compartilhar</button>
      </div>
      <p className="text-[11px] opacity-50 mt-1">Toque na imagem para ver em tela cheia</p>
      {lb && <ImageViewer src={src} onClose={() => setLb(false)} onDownload={() => downloadImage(src, 'lindoso-imagem.png')} onShare={() => shareImage(src, 'Imagem criada no LINDOSO IA')} />}
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
  const [showAttach, setShowAttach] = useState(false)
  const [anexo, setAnexo] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const scrollRef = useRef(null)
  const fileRef = useRef(null)

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

  const onPickFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      setAnexo({ name: f.name, type: f.type, size: f.size, base64: reader.result })
      setShowAttach(false)
      setToast('Arquivo pronto! Agora escreva e envie.')
      setTimeout(() => setToast(''), 2500)
    }
    reader.readAsDataURL(f)
    e.target.value = ''
  }

  const openPicker = (accept) => {
    if (fileRef.current) {
      fileRef.current.setAttribute('accept', accept)
      fileRef.current.click()
    }
  }

  const send = async () => {
    if ((!input.trim() && !anexo) || loading) return
    const text = input.trim() || (anexo ? `Analise esse arquivo: ${anexo.name}` : '')
    const anexoAtual = anexo
    setInput(''); setAnexo(null)
    let chatId = activeId
    let historicoAtual = activeChat ? activeChat.messages : []
    if (!chatId) {
      const c = { id: uid(), title: text.slice(0, 30), messages: [], createdAt: Date.now() }
      setChats(prev => [c, ...prev]); setActiveId(c.id); chatId = c.id
    }
    const userMsg = { id: uid(), role: 'user', text, ts: Date.now(), anexo: anexoAtual ? { name: anexoAtual.name, type: anexoAtual.type, base64: anexoAtual.type.startsWith('image/') ? anexoAtual.base64 : null } : null }
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: c.messages.length === 0 ? text.slice(0, 30) : c.title, messages: [...c.messages, userMsg] } : c))
    setLoading(true)
    try {
      const isImage = !anexoAtual && /imagem|foto|logo|desenho|cria uma|gera uma|ilustra|criar imagem|pizza|praia|gato|cachorro/i.test(text)
      if (isImage) {
        const img = await gerarImagemHD(text)
        const modelMsg = { id: uid(), role: 'model', text: 'Aqui está sua imagem! Toque para ampliar, baixar ou compartilhar.', image: img.url, fallback: img.fallback, ts: Date.now() }
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, modelMsg] } : c))
      } else {
        const res = await falarComGemini(text, historicoAtual, anexoAtual)
        if (res.error === 'sem-chave') {
          const modelMsg = { id: uid(), role: 'model', text: '⚠️ Pra eu conversar e analisar foto/arquivo, coloca tua chave do Gemini nas Configurações (⚙️).', ts: Date.now() }
          setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, modelMsg] } : c))
        } else {
          const modelMsg = { id: uid(), role: 'model', text: res.text, ts: Date.now() }
          setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, modelMsg] } : c))
        }
      }
    } catch (e) {
      const modelMsg = { id: uid(), role: 'model', text: 'Deu erro: ' + e.message, ts: Date.now() }
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, modelMsg] } : c))
    }
    setLoading(false)
  }

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [activeChat?.messages?.length, loading])

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#0b0b0c] text-white' : 'bg-zinc-50 text-black'}`}>
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-[#0b0b0c]/90 backdrop-blur border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-violet-500 flex items-center justify-center font-black">L</div>
          <div><p className="font-bold leading-none">LINDOSO IA</p><p className="text-[11px] opacity-60">Online • v6 Arrumado</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={newChat} className="px-4 py-2 rounded-full bg-teal-400 text-black font-bold text-sm">+ Novo</button>
          <button onClick={() => setView(view === 'settings' ? 'chat' : 'settings')} className="px-4 py-2 rounded-full bg-white/10 font-bold text-sm">⚙️</button>
        </div>
      </header>

      {view === 'settings' ? (
        <div className="max-w-xl mx-auto p-4 space-y-4">
          <h2 className="text-xl font-bold">Configurações</h2>

          {/* 1 - CHAVES - SÓ CHAVE, NADA MAIS */}
          <section className="p-4 rounded-3xl bg-white/5 border border-white/10">
            <h3 className="font-bold mb-2">🔑 Chaves da IA</h3>
            <p className="text-sm opacity-70 mb-3">Cole sua chave do Gemini aqui 1 vez só. Ela fica salva só no seu celular.</p>
            <input value={geminiKey} onChange={e => setGeminiKey(e.target.value.trim())} placeholder="Cole sua chave AIza..." className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none" />
            <p className="text-xs opacity-50 mt-2">{geminiKey ? '✅ Chave salva! Pode voltar pro chat.' : '❌ Sem chave - o chat vai pedir pra colocar.'}</p>
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="block text-center mt-3 py-3 rounded-2xl bg-white/10 font-bold text-sm">Pegar chave grátis no Google AI Studio</a>
          </section>

          {/* 2 - CONFIGURAÇÃO */}
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

          {/* 3 - ZONA DE PERIGO - SEPARADO LONGE DAS CHAVES */}
          <section className="p-4 rounded-3xl bg-red-500/5 border border-red-500/20">
            <h3 className="font-bold mb-2">🗑️ Zona de Perigo</h3>
            <p className="text-sm opacity-70 mb-3">Isso apaga TODAS as conversas. Não apaga sua chave.</p>
            {!confirmClear ? (
              <button onClick={() => setConfirmClear(true)} className="w-full py-3 rounded-2xl bg-red-500/20 text-red-300 font-bold">🗑 Limpar todo histórico</button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-bold text-center">Tem certeza? Não tem volta!</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmClear(false)} className="flex-1 py-3 rounded-2xl bg-white/10 font-bold">Cancelar</button>
                  <button onClick={() => { localStorage.removeItem('lindoso_chats'); setChats([]); setActiveId(null); setConfirmClear(false); setToast('Histórico limpo!'); setTimeout(()=>setToast(''),2000) }} className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-bold">Sim, apagar tudo</button>
                </div>
              </div>
            )}
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
          <div ref={scrollRef} className="max-w-2xl mx-auto px-4 pb-40 pt-2 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 140px)' }}>
            {!activeChat || activeChat.messages.length === 0 ? (
              <div className="text-center pt-10">
                <div className="w-20 h-20 mx-auto rounded-[28px] bg-gradient-to-br from-teal-400 to-violet-500 flex items-center justify-center text-4xl font-black mb-4">L</div>
                <h1 className="text-2xl font-black">Olá, eu sou o LINDOSO IA</h1>
                <p className="opacity-60 text-sm mt-2">Manda foto, arquivo ou pede pra criar imagem.</p>
                <div className="grid grid-cols-2 gap-2 mt-6 text-left">
                  {['🎨 Cria uma logo de pizzaria', '🖼️ Cria uma imagem de praia', '📷 Manda uma foto pra eu analisar', '✍️ Me ajuda num texto'].map(s => (
                    <button key={s} onClick={() => setInput(s.replace(/^[🎨🖼️📷✍️] /,''))} className="p-3 rounded-2xl bg-white/5 border border-white/10 text-sm text-left">{s}</button>
                  ))}
                </div>
              </div>
            ) : activeChat.messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-4 py-3 rounded-[22px] shadow-md ${msg.role === 'user' ? 'bg-teal-400 text-black rounded-br-md' : 'bg-[#161617] border border-white/5 rounded-bl-md'}`}>
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  {msg.anexo && (
                    <div className="mt-2">
                      {msg.anexo.base64 ? <img src={msg.anexo.base64} className="rounded-xl w-full" alt="Anexo" /> : <div className="p-3 rounded-xl bg-black/20 text-sm font-bold">📄 {msg.anexo.name}</div>}
                    </div>
                  )}
                  {msg.image && <ImagemComFallback url={msg.image} fallback={msg.fallback} />}
                </div>
              </div>
            ))}
            {loading && <p className="text-center text-sm opacity-60 animate-pulse">LINDOSO está pensando...</p>}
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-3 bg-[#0b0b0c]/95 backdrop-blur border-t border-white/10">
            <div className="max-w-2xl mx-auto">
              {anexo && (
                <div className="flex items-center gap-2 mb-2 p-2 rounded-2xl bg-white/10">
                  {anexo.type.startsWith('image/') ? <img src={anexo.base64} className="w-10 h-10 rounded-lg object-cover" /> : <span className="text-xl">📄</span>}
                  <span className="flex-1 text-xs truncate">{anexo.name}</span>
                  <button onClick={() => setAnexo(null)} className="px-3 py-1 rounded-full bg-white/10 text-xs font-bold">✕ Remover</button>
                </div>
              )}
              {showAttach && (
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <button onClick={() => openPicker('image/*')} className="py-3 rounded-2xl bg-white/10 font-bold text-sm">🖼️ Galeria</button>
                  <button onClick={() => openPicker('image/*')} className="py-3 rounded-2xl bg-white/10 font-bold text-sm">📷 Câmera</button>
                  <button onClick={() => openPicker('*/*')} className="py-3 rounded-2xl bg-white/10 font-bold text-sm">📄 Arquivo</button>
                </div>
              )}
              <div className="flex gap-2 items-end">
                <button onClick={() => setShowAttach(!showAttach)} className="w-12 h-12 shrink-0 rounded-full bg-white/10 font-black text-2xl">+</button>
                <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder="Pergunte, mande foto ou peça imagem..." className="flex-1 bg-white/10 rounded-[22px] px-4 py-3 text-[15px] outline-none resize-none max-h-[120px]" rows={1} />
                <button onClick={send} className="w-12 h-12 shrink-0 rounded-full bg-teal-400 text-black font-black text-xl">↑</button>
              </div>
            </div>
          </div>
          <input ref={fileRef} type="file" className="hidden" onChange={onPickFile} />
        </>
      )}
      <ImageViewer src={lightbox} onClose={() => setLightbox(null)} onDownload={() => lightbox && downloadImage(lightbox, 'lindoso-imagem.png')} onShare={() => lightbox && shareImage(lightbox, 'Imagem criada no LINDOSO IA')} />
      {toast && <div className="fixed bottom-28 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-2 rounded-full text-sm z-[110]">{toast}</div>}
    </div>
  )
}
