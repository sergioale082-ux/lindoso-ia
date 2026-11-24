import { useState, useEffect } from 'react'

// Monograma Geométrico - sem foto, sem <img>, sem emoji, sem ícone quebrado
const Geo = ({ type }) => {
  const s = { display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }
  if (type === 'key') return <span style={s}><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="8" cy="8" r="5" stroke="#00E5C0" strokeWidth="2.5"/><path d="M12 12 L20 20 M16 16 L20 12" stroke="#00E5C0" strokeWidth="2.5"/></svg></span>
  if (type === 'gear') return <span style={s}><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="6" y="6" width="12" height="12" transform="rotate(45 12 12)" stroke="#00E5C0" strokeWidth="2.5"/><circle cx="12" cy="12" r="3" fill="#00E5C0"/></svg></span>
  if (type === 'moon') return <span style={s}><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 4 L12 12 L4 20 Z" fill="#000"/><path d="M12 4 L20 12 L12 20 Z" fill="#00E5C0"/></svg></span>
  if (type === 'sun') return <span style={s}><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" fill="#FFC107"/><path d="M12 2 L12 6 M12 18 L12 22 M2 12 L6 12 M18 12 L22 12" stroke="#FFC107" strokeWidth="2.5"/></svg></span>
  if (type === 'trash') return <span style={s}><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 7 L19 7 L17 21 L7 21 Z" stroke="#FF6B6B" strokeWidth="2"/><path d="M9 7 L12 3 L15 7" stroke="#FF6B6B" strokeWidth="2"/></svg></span>
  if (type === 'logo') return <span style={{ display: 'inline-flex', width: 44, height: 44, borderRadius: 14, background: '#00E5C0', alignItems: 'center', justifyContent: 'center' }}><svg width="30" height="30" viewBox="0 0 48 48"><path d="M12 10 L12 38 L36 38" stroke="#000" strokeWidth="7" fill="none" strokeLinecap="square" /><path d="M28 10 L38 20 L28 30 L18 20 Z" fill="#000" /></svg></span>
  return null
}

export default function App() {
  const [view, setView] = useState('chat')
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_key') || '')
  const [quality, setQuality] = useState('ULTRA')
  const [memory, setMemory] = useState(50)
  const [theme, setTheme] = useState('Escuro')
  const [msg, setMsg] = useState('')
  const [chats, setChats] = useState(() => JSON.parse(localStorage.getItem('chats') || '[]'))
  const [selected, setSelected] = useState(null)
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => { localStorage.setItem('gemini_key', apiKey) }, [apiKey])
  useEffect(() => { localStorage.setItem('chats', JSON.stringify(chats)) }, [chats])

  const dark = theme === 'Escuro'
  const bg = dark ? '#0A0A0A' : '#FFFFFF'
  const card = dark ? '#1A1A1A' : '#F2F2F2'
  const text = dark ? '#FFF' : '#000'
  const sub = dark ? '#AAA' : '#666'

  const btn = (active) => ({
    flex: 1, padding: '12px 0', borderRadius: 20, border: `1px solid ${active ? '#00E5C0' : sub}`,
    background: active ? '#00E5C0' : 'transparent', color: active ? '#000' : text,
    fontWeight: 800, cursor: 'pointer', fontSize: 15
  })

  const openChat = (index) => {
    setSelected(index)
    setShowDelete(true)
  }

  const deleteOne = () => {
    const nova = chats.filter((_, i) => i !== selected)
    setChats(nova)
    setShowDelete(false)
    setSelected(null)
  }

  return (
    <div style={{ background: bg, color: text, minHeight: '100vh', fontFamily: 'sans-serif', paddingBottom: 40 }}>
      {/* HEADER - LOGO ARRUMADA, SÓ SVG */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 10 }}>
        <Geo type="logo" />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 20 }}>LINDOSO IA</div>
          <div style={{ color: sub, fontSize: 13 }}>Online • v3 com Chat</div>
        </div>
        <button onClick={() => { setView('chat'); setShowDelete(false) }} style={{ background: '#00E5C0', border: 'none', padding: '10px 18px', borderRadius: 20, fontWeight: 800 }}>+ Novo</button>
        <button onClick={() => setView(view === 'settings' ? 'chat' : 'settings')} style={{ background: card, border: 'none', width: 44, height: 44, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Geo type="gear" /></button>
      </div>

      {view === 'settings' ? (
        <div style={{ padding: '0 16px' }}>
          <h2 style={{ fontSize: 26, fontWeight: 900 }}>Configurações</h2>

          <div style={{ background: card, borderRadius: 24, padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}><Geo type="key" />Chave do Gemini - REATIVAR CHAT</div>
            <p style={{ color: sub }}>Cole sua chave aqui 1 vez só. Ela fica salva no seu celular.</p>
            <input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Cole sua chave aqui" style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: dark ? '#2A2A2A' : '#DDD', color: text, boxSizing: 'border-box' }} />
            {apiKey && <p style={{ color: '#00E5C0', fontSize: 14 }}>Chave salva! Pode voltar pro chat.</p>}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ display: 'block', textAlign: 'center', background: dark ? '#333' : '#DDD', color: text, padding: 12, borderRadius: 14, textDecoration: 'none', fontWeight: 700, marginTop: 10 }}>Pegar chave grátis no Google AI Studio</a>
          </div>

          <div style={{ background: card, borderRadius: 24, padding: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}><Geo type="gear" />Configuração da IA</div>
            <p style={{ color: sub }}>Qualidade da imagem</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {['NORMAL','HD','ULTRA'].map(q => <button key={q} onClick={() => setQuality(q)} style={btn(quality===q)}>{q}</button>)}
            </div>
            <p style={{ color: sub, marginTop: 18 }}>Memória</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {[10,20,50].map(m => <button key={m} onClick={() => setMemory(m)} style={btn(memory===m)}>{m}</button>)}
            </div>
            <p style={{ color: sub, marginTop: 18 }}>Tema</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setTheme('Escuro')} style={btn(theme==='Escuro')}><Geo type="moon" />Escuro</button>
              <button onClick={() => setTheme('Claro')} style={btn(theme==='Claro')}><Geo type="sun" />Claro</button>
            </div>
          </div>

          {/* SEM BOTÃO DE LIMPAR TUDO - REMOVIDO COMO TU PEDIU */}
        </div>
      ) : (
        <div style={{ padding: '0 16px' }}>
          <p style={{ color: sub }}>Olá! Sou o LINDOSO IA, teu parceiro de Belém. O que vamos criar hoje?</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Pergunte qualquer coisa..." style={{ flex: 1, padding: 14, borderRadius: 20, border: 'none', background: card, color: text }} />
            <button onClick={() => { if(msg.trim()){ setChats([...chats, msg]); setMsg('') } }} style={{ background: '#00E5C0', border: 'none', padding: '0 20px', borderRadius: 20, fontWeight: 800 }}>Enviar</button>
          </div>

          <p style={{ color: sub, marginTop: 20, fontSize: 14 }}>Toque em uma conversa para abrir / apagar só ela:</p>
          {chats.map((c,i) => (
            <div key={i} onClick={() => openChat(i)} style={{ background: selected === i ? '#00E5C0' : card, color: selected === i ? '#000' : text, padding: 14, borderRadius: 14, marginTop: 10, cursor: 'pointer', fontWeight: selected === i ? 700 : 400 }}>
              {c}
            </div>
          ))}

          {/* CAIXINHA DE APAGAR SÓ AQUELA CONVERSA */}
          {showDelete && selected !== null && (
            <div style={{ background: card, borderRadius: 20, padding: 16, marginTop: 16, border: '1px solid #333' }}>
              <p style={{ fontWeight: 800, margin: '0 0 6px 0' }}>Conversa selecionada:</p>
              <p style={{ color: sub, margin: '0 0 14px 0' }}>{chats[selected]}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowDelete(false)} style={{ flex: 1, padding: 12, borderRadius: 14, border: 'none', background: dark ? '#333' : '#DDD', color: text, fontWeight: 700 }}>Cancelar</button>
                <button onClick={deleteOne} style={{ flex: 1, padding: 12, borderRadius: 14, border: 'none', background: '#4A1A1A', color: '#FF8A8A', fontWeight: 800 }}><Geo type="trash" />Apagar só essa</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
