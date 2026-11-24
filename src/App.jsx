import React, { useState } from 'react';

// ÍCONES GEOMÉTRICOS - sem emoji, sem imagem
const Logo = () => (
  <div style={{ width: 34, height: 34, minWidth: 34, background: '#00C853', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 18 }}>L</div>
);

const IconTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6 H21 M8 6 V4 H16 V6 M6 6 L7 20 H17 L18 6 M10 11 V17 M14 11 V17" /></svg>
);

export default function App() {
  const [conversas, setConversas] = useState([
    { id: 1, titulo: 'Nova conversa', msgs: [] }
  ]);
  const [ativaId, setAtivaId] = useState(1);
  const [menuId, setMenuId] = useState(null);
  const [input, setInput] = useState('');
  const [mostraMenu, setMostraMenu] = useState(true);

  const ativa = conversas.find(c => c.id === ativaId) || conversas[0];

  function novaConversa() {
    const nova = { id: Date.now(), titulo: 'Nova conversa', msgs: [] };
    setConversas([nova, ...conversas]);
    setAtivaId(nova.id);
    setMenuId(null);
  }

  function apagarSoEssa(id) {
    const resto = conversas.filter(c => c.id !== id);
    if (resto.length === 0) {
      const nova = { id: Date.now(), titulo: 'Nova conversa', msgs: [] };
      setConversas([nova]);
      setAtivaId(nova.id);
    } else {
      setConversas(resto);
      if (ativaId === id) setAtivaId(resto[0].id);
    }
    setMenuId(null);
  }

  function enviar() {
    if (!input.trim()) return;
    const texto = input.trim();
    setConversas(conversas.map(c => {
      if (c.id !== ativa.id) return c;
      return {
        ...c,
        titulo: c.msgs.length === 0 ? texto.slice(0, 28) : c.titulo,
        msgs: [...c.msgs, { texto }]
      };
    }));
    setInput('');
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0B0F14', color: 'white', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      {mostraMenu && (
        <div style={{ width: 280, background: '#11161D', borderRight: '1px solid #1F2937', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Logo />
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>LINDOSO IA</div>
              <div style={{ fontSize: 11, color: '#9AA0A6' }}>v3 com Chat</div>
            </div>
          </div>

          <button onClick={novaConversa} style={{ margin: '0 14px 12px', background: '#00C853', border: 'none', color: 'white', padding: '11px', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }}>
            + Nova Conversa
          </button>

          <div style={{ padding: '0 14px 8px', fontSize: 11, color: '#9AA0A6' }}>CONVERSAS</div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
            {conversas.map(c => (
              <div key={c.id}>
                <div
                  onClick={() => { setAtivaId(c.id); setMenuId(menuId === c.id ? null : c.id); }}
                  style={{ padding: 12, borderRadius: 10, cursor: 'pointer', background: ativa.id === c.id ? '#1E293B' : 'transparent', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {c.titulo}
                </div>
                {menuId === c.id && (
                  <div style={{ margin: '0 4px 8px', background: '#1F2937', borderRadius: 10, overflow: 'hidden' }}>
                    <button onClick={() => setMenuId(null)} style={{ width: '100%', textAlign: 'left', background: 'transparent', color: 'white', border: 'none', padding: '10px 12px', cursor: 'pointer' }}>Abrir conversa</button>
                    <button onClick={() => apagarSoEssa(c.id)} style={{ width: '100%', textAlign: 'left', background: 'transparent', color: '#FF6B6B', border: 'none', padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <IconTrash /> Apagar só essa conversa
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #1F2937', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setMostraMenu(!mostraMenu)} style={{ background: '#1F2937', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>Menu</button>
          <Logo />
          <b>{ativa.titulo}</b>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {ativa.msgs.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: 60, color: '#9AA0A6' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Logo /></div>
              <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Como posso ajudar?</div>
            </div>
          )}
          {ativa.msgs.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
              <div style={{ background: '#00C853', padding: '10px 14px', borderRadius: 16, maxWidth: '70%', fontSize: 14 }}>{m.texto}</div>
            </div>
          ))}
        </div>

        {/* BARRA IGUAL A FOTO */}
        <div style={{ padding: '10px 12px 14px', background: '#0B0F14', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, background: '#2A2F36', borderRadius: 999, display: 'flex', alignItems: 'center', padding: '6px 14px', gap: 6 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && enviar()}
              placeholder="Mensagem"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: 16, padding: '10px 4px' }}
            />
          </div>
          <button onClick={enviar} style={{ width: 52, height: 52, minWidth: 52, borderRadius: '50%', background: '#00E676', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#0B0F14', fontWeight: 900 }}>
            {input.trim() ? '>' : 'MIC'}
          </button>
        </div>
      </div>
    </div>
  );
}
