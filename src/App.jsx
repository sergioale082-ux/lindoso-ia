import React, { useState, useEffect, useRef } from 'react';

// --- ÍCONES GEOMÉTRICOS (sem emoji, sem imagem externa) ---
const IconLogo = () => (
  <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
    <rect width="34" height="34" rx="9" fill="#00C853" />
    <path d="M12 8 L12 24 L22 24" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M25 10 L21 14 L25 18" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconSmile = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9AA0A6" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <circle cx="9" cy="10" r="1" fill="#9AA0A6" stroke="none" />
    <circle cx="15" cy="10" r="1" fill="#9AA0A6" stroke="none" />
    <path d="M8.5 14.5 C10 16.5 14 16.5 15.5 14.5" />
  </svg>
);

const IconClip = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9AA0A6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 12 L16 4 C17.5 2.5 19.8 2.5 21 4 C22.2 5.5 22.2 7.8 21 9.2 L11 19.2 C9.8 20.4 7.8 20.4 6.5 19.2 C5.2 18 5.2 16 6.5 14.8 L15 6.2" />
  </svg>
);

const IconCamera = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9AA0A6" strokeWidth="1.8">
    <rect x="3" y="7" width="18" height="13" rx="3" />
    <circle cx="12" cy="13.5" r="3.2" />
    <path d="M8 7 L9.5 4.5 L14.5 4.5 L16 7" />
  </svg>
);

const IconMic = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0B0F14" strokeWidth="2.2" strokeLinecap="round">
    <rect x="9" y="2" width="6" height="11" rx="3" fill="#0B0F14" stroke="none" />
    <path d="M5 11 C5 15 8.2 18 12 18 C15.8 18 19 15 19 11" />
    <path d="M12 18 L12 22" />
  </svg>
);

const IconSend = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2 L11 13" /><path d="M22 2 L15 22 L11 13 L2 9 L22 2 Z" />
  </svg>
);

const IconTrash = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M3 6 H21 M8 6 V4 H16 V6 M6 6 L7 20 H17 L18 6 M10 11 V17 M14 11 V17" />
  </svg>
);

const IconPlus = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5 V19 M5 12 H19" /></svg>
);

export default function App() {
  const [conversas, setConversas] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lindoso_conversas')) || [{ id: Date.now(), titulo: 'Nova conversa', msgs: [] }]; } catch { return [{ id: Date.now(), titulo: 'Nova conversa', msgs: [] }]; }
  });
  const [ativaId, setAtivaId] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [input, setInput] = useState('');
  const [showHistorico, setShowHistorico] = useState(true);
  const endRef = useRef(null);

  useEffect(() => { localStorage.setItem('lindoso_conversas', JSON.stringify(conversas)); }, [conversas]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [conversas, ativaId]);

  const ativa = conversas.find(c => c.id === ativaId) || conversas[0];

  const novaConversa = () => {
    const nova = { id: Date.now(), titulo: 'Nova conversa', msgs: [] };
    setConversas([nova, ...conversas]);
    setAtivaId(nova.id);
    setMenuId(null);
  };

  const apagarSoEssa = (id) => {
    const resto = conversas.filter(c => c.id !== id);
    if (resto.length === 0) {
      const nova = { id: Date.now(), titulo: 'Nova conversa', msgs: [] };
      setConversas([nova]); setAtivaId(nova.id);
    } else {
      setConversas(resto);
      if (ativaId === id) setAtivaId(resto[0].id);
    }
    setMenuId(null);
  };

  const enviar = () => {
    if (!input.trim() || !ativa) return;
    const texto = input.trim();
    setConversas(conversas.map(c => c.id === ativa.id ? {
      ...c,
      titulo: c.msgs.length === 0 ? texto.slice(0, 28) : c.titulo,
      msgs: [...c.msgs, { de: 'eu', texto }]
    } : c));
    setInput('');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0B0F14', color: 'white', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      {showHistorico && (
        <div style={{ width: 280, background: '#11161D', borderRight: '1px solid #1F2937', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconLogo />
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: 0.5 }}>LINDOSO IA</div>
              <div style={{ fontSize: 11, color: '#9AA0A6' }}>v3 com Chat</div>
            </div>
          </div>

          <button onClick={novaConversa} style={{ margin: '0 14px 12px', background: '#00C853', border: 'none', color: 'white', padding: '11px', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontWeight: 700 }}>
            <IconPlus /> Nova Conversa
          </button>

          <div style={{ padding: '0 14px 8px', fontSize: 11, color: '#9AA0A6', letterSpacing: 1 }}>CONVERSAS</div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
            {conversas.map(c => (
              <div key={c.id} style={{ position: 'relative' }}>
                <div
                  onClick={() => { setAtivaId(c.id); setMenuId(menuId === c.id ? null : c.id); }}
                  style={{ padding: '12px 12px', borderRadius: 10, cursor: 'pointer', background: ativa?.id === c.id ? '#1E293B' : 'transparent', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {c.titulo}
                </div>
                {menuId === c.id && (
                  <div style={{ margin: '0 4px 8px', background: '#1F2937', borderRadius: 10, overflow: 'hidden', border: '1px solid #2D3748' }}>
                    <button onClick={() => setMenuId(null)} style={{ width: '100%', textAlign: 'left', background: 'transparent', color: 'white', border: 'none', padding: '10px 12px', cursor: 'pointer', fontSize: 13 }}>Abrir conversa</button>
                    <button onClick={() => apagarSoEssa(c.id)} style={{ width: '100%', textAlign: 'left', background: 'transparent', color: '#FF6B6B', border: 'none', padding: '10px 12px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid #2D3748' }}>
                      <IconTrash /> Apagar só essa conversa
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #1F2937', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setShowHistorico(!showHistorico)} style={{ background: '#1F2937', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>Menu</button>
          <IconLogo />
          <b>{ativa?.titulo || 'LINDOSO IA'}</b>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {(!ativa || ativa.msgs.length === 0) && (
            <div style={{ textAlign: 'center', marginTop: 60, color: '#9AA0A6' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><IconLogo /></div>
              <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Como posso ajudar?</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Escolha uma conversa ou crie uma nova.</div>
            </div>
          )}
          {ativa?.msgs.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.de === 'eu' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
              <div style={{ background: m.de === 'eu' ? '#00C853' : '#1F2937', padding: '10px 14px', borderRadius: 16, maxWidth: '70%', fontSize: 14 }}>{m.texto}</div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div style={{ padding: '10px 12px 14px', background: '#0B0F14', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, background: '#2A2F36', borderRadius: 999, display: 'flex', alignItems: 'center', padding: '6px 6px 6px 14px', gap: 6 }}>
            <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}><IconSmile /></button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && enviar()}
              placeholder="Mensagem"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: 16, padding: '10px 4px' }}
            />
            <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: 6 }}><IconClip /></button>
            <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: 6 }}><IconCamera /></button>
          </div>

          <button
            onClick={enviar}
            style={{ width: 52, height: 52, minWidth: 52, borderRadius: '50%', background: input.trim() ? '#00C853' : '#00E676', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,200,83,0.35)' }}
          >
            {input.trim() ? <IconSend /> : <IconMic />}
          </button>
        </div>
      </div>
    </div>
  );
}
