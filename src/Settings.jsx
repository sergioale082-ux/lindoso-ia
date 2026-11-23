import { useState } from 'react'
import { Icon } from './icons.jsx'
import logoUrl from './logo.png'

/* ------------------------------------------------------------------ */
/*  Configurações do LINDOSO IA                                         */
/*  Início > Configurações da IA > Chaves de API / Memória             */
/*  Início > Aparência · Voz · Imagens · Dados · Sobre                  */
/* ------------------------------------------------------------------ */

const TITULOS = {
  home: 'Configurações',
  ai: 'Configurações da IA',
  keys: 'Chaves de API',
  memory: 'Memória',
  appearance: 'Aparência',
  voice: 'Voz',
  images: 'Imagens',
  data: 'Dados e privacidade',
  about: 'Sobre',
}

// de onde cada página volta
const PAI = { ai: 'home', keys: 'ai', memory: 'ai', appearance: 'home', voice: 'home', images: 'home', data: 'home', about: 'home' }

const CORES = [
  ['turquesa', 'Turquesa', '45 212 191'],
  ['azul', 'Azul', '96 165 250'],
  ['roxo', 'Roxo', '167 139 250'],
  ['verde', 'Verde', '74 222 128'],
  ['rosa', 'Rosa', '244 114 182'],
  ['laranja', 'Laranja', '251 191 36'],
]

const ESTILOS_RESPOSTA = { conciso: 'Conciso', equilibrado: 'Equilibrado', detalhado: 'Detalhado' }

/* ------------------------------ peças ------------------------------ */

function Secao({ titulo, descricao, children }) {
  return (
    <section className="space-y-2">
      {titulo && (
        <h2 className="px-1 text-[0.72rem] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {titulo}
        </h2>
      )}
      {descricao && <p className="px-1 text-sm text-zinc-500 dark:text-zinc-400">{descricao}</p>}
      {children}
    </section>
  )
}

function Linha({ icone, titulo, valor, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-zinc-50 active:bg-zinc-100 dark:hover:bg-white/[0.04] dark:active:bg-white/[0.07]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accentd dark:text-accent">
        <Icon name={icone} className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.95rem] font-medium">{titulo}</span>
        {valor && <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{valor}</span>}
      </span>
      <Icon name="chevron" className="h-4 w-4 shrink-0 text-zinc-400" />
    </button>
  )
}

const Grupo = ({ children }) => (
  <div className="card divide-y divide-zinc-200/70 overflow-hidden dark:divide-white/[0.06]">{children}</div>
)

function Interruptor({ ligado, onChange, titulo, descricao }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="text-[0.95rem] font-medium">{titulo}</div>
        {descricao && <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{descricao}</div>}
      </div>
      <button
        role="switch"
        aria-checked={ligado}
        aria-label={titulo}
        onClick={() => onChange(!ligado)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          ligado ? 'bg-gradient-to-r from-accent to-accent2' : 'bg-zinc-300 dark:bg-ink-600'
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
            ligado ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  )
}

function Opcoes({ valor, opcoes, onChange, colunas }) {
  return (
    <div className={`grid gap-1.5 rounded-2xl bg-zinc-100 p-1 dark:bg-ink-900 ${colunas || ''}`} style={!colunas ? { gridTemplateColumns: `repeat(${opcoes.length}, minmax(0, 1fr))` } : undefined}>
      {opcoes.map(([v, rotulo]) => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          className={`rounded-xl px-2 py-2.5 text-[0.82rem] font-medium transition ${
            valor === v
              ? 'bg-gradient-to-r from-accent to-accent2 text-ink-950 shadow'
              : 'text-zinc-600 hover:bg-white/70 dark:text-zinc-300 dark:hover:bg-white/[0.06]'
          }`}
        >
          {rotulo}
        </button>
      ))}
    </div>
  )
}

function CampoChave({ titulo, descricao, link, linkTexto, placeholder, valor, onSalvar, envNome, envAtivo }) {
  const [rascunho, setRascunho] = useState(valor)
  const [ver, setVer] = useState(false)
  const [salvo, setSalvo] = useState('')
  const configurada = !!valor
  const status = configurada ? 'Configurada' : envAtivo ? 'Usando .env' : 'Não configurada'
  const ok = configurada || envAtivo

  const feito = (msg) => {
    setSalvo(msg)
    setTimeout(() => setSalvo(''), 2000)
  }

  return (
    <section className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold">{titulo}</h3>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${
            ok ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
          }`}
        >
          {status}
        </span>
      </div>
      <p className="mb-3 mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
        {descricao}{' '}
        <a href={link} target="_blank" rel="noreferrer" className="text-accentd underline dark:text-accent">
          {linkTexto}
        </a>
        .
      </p>
      <div className="flex gap-2">
        <input
          type={ver ? 'text' : 'password'}
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck="false"
          className="field min-w-0 flex-1"
        />
        <button onClick={() => setVer((v) => !v)} className="btn-soft px-4">
          {ver ? 'Ocultar' : 'Ver'}
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => {
            onSalvar(rascunho.trim())
            feito('Chave salva!')
          }}
          className="btn-accent flex-1 py-3 text-sm"
        >
          {salvo === 'Chave salva!' ? 'Chave salva!' : 'Salvar chave'}
        </button>
        {configurada && (
          <button
            onClick={() => {
              onSalvar('')
              setRascunho('')
              feito('Removida')
            }}
            className="btn-soft px-4 text-red-500 dark:text-red-400"
          >
            {salvo === 'Removida' ? 'Removida' : 'Remover'}
          </button>
        )}
      </div>
      {envAtivo && !configurada && (
        <p className="mt-2 text-xs text-zinc-500">Usando a chave do arquivo .env ({envNome}).</p>
      )}
    </section>
  )
}

/* ------------------------------ páginas ------------------------------ */

function PaginaInicio({ ir, nome, settings, keys, env }) {
  const configuradas = ['gemini', 'groq', 'deepseek'].filter((k) => keys[k] || env[k]).length
  return (
    <div className="space-y-6">
      <button
        onClick={() => ir('memory')}
        className="card flex w-full items-center gap-4 p-4 text-left transition active:scale-[0.99]"
      >
        <img src={logoUrl} alt="" className="h-14 w-14 rounded-2xl object-cover shadow-lg" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-semibold">{nome || 'Seu perfil'}</span>
          <span className="block text-sm text-zinc-500 dark:text-zinc-400">
            {nome ? 'Toque para editar seu nome' : 'Toque para dizer seu nome'}
          </span>
        </span>
        <Icon name="chevron" className="h-4 w-4 text-zinc-400" />
      </button>

      <Secao titulo="Inteligência artificial">
        <Grupo>
          <Linha
            icone="cpu"
            titulo="Configurações da IA"
            valor={`Estilo ${ESTILOS_RESPOSTA[settings.style].toLowerCase()} · ${configuradas} de 3 chaves · memória ${settings.memory ? 'ligada' : 'desligada'}`}
            onClick={() => ir('ai')}
          />
        </Grupo>
      </Secao>

      <Secao titulo="Experiência">
        <Grupo>
          <Linha icone="sparkle" titulo="Aparência" valor="Tema, cor de destaque e tamanho do texto" onClick={() => ir('appearance')} />
          <Linha icone="speaker" titulo="Voz" valor={settings.autoSpeak ? 'Leitura automática ligada' : 'Leitura e ditado'} onClick={() => ir('voice')} />
          <Linha icone="image" titulo="Imagens" valor="Formato, estilo e qualidade" onClick={() => ir('images')} />
        </Grupo>
      </Secao>

      <Secao titulo="Conta">
        <Grupo>
          <Linha icone="database" titulo="Dados e privacidade" valor="Exportar e limpar conversas" onClick={() => ir('data')} />
          <Linha icone="info" titulo="Sobre o LINDOSO IA" valor="Versão 2.0" onClick={() => ir('about')} />
        </Grupo>
      </Secao>
    </div>
  )
}

function PaginaIA({ ir, settings, set, keys, env, modelos }) {
  const [instr, setInstr] = useState(settings.customInstructions)
  const [salvo, setSalvo] = useState(false)
  const configuradas = ['gemini', 'groq', 'deepseek'].filter((k) => keys[k] || env[k]).length
  return (
    <div className="space-y-6">
      <Secao titulo="Estilo das respostas" descricao="Define o tamanho das respostas da IA.">
        <Opcoes
          valor={settings.style}
          opcoes={Object.entries(ESTILOS_RESPOSTA)}
          onChange={(v) => set('style', v)}
        />
      </Secao>

      <Secao
        titulo="Instruções personalizadas"
        descricao="Diga como a IA deve responder. Exemplo: “Explique com exemplos de jogos” ou “Responda sempre em tópicos”."
      >
        <div className="card p-3">
          <textarea
            value={instr}
            onChange={(e) => setInstr(e.target.value)}
            rows={4}
            maxLength={600}
            placeholder="Escreva aqui as suas instruções..."
            className="field resize-none"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-zinc-500">{instr.length}/600</span>
            <button
              onClick={() => {
                set('customInstructions', instr.trim())
                setSalvo(true)
                setTimeout(() => setSalvo(false), 2000)
              }}
              className="btn-accent px-5 py-2.5 text-sm"
            >
              {salvo ? 'Salvo!' : 'Salvar instruções'}
            </button>
          </div>
        </div>
      </Secao>

      <Secao titulo="Recursos">
        <Grupo>
          <Interruptor
            titulo="Pesquisar na internet"
            descricao="Usa o Google quando a pergunta precisa de informação atual, como clima, notícias e preços."
            ligado={settings.webSearch}
            onChange={(v) => set('webSearch', v)}
          />
        </Grupo>
      </Secao>

      <Secao titulo="Ajustes da IA">
        <Grupo>
          <Linha icone="key" titulo="Chaves de API" valor={`${configuradas} de 3 configuradas`} onClick={() => ir('keys')} />
          <Linha icone="brain" titulo="Memória" valor={settings.memory ? 'Ligada · lembra das últimas 20 conversas' : 'Desligada'} onClick={() => ir('memory')} />
        </Grupo>
      </Secao>

      <Secao titulo="Modelos em uso">
        <div className="card space-y-2.5 p-4 text-sm">
          {modelos.map(([n, nome, papel]) => (
            <div key={n} className="flex gap-2.5">
              <span className="font-semibold text-accentd dark:text-accent">{n}.</span>
              <span>
                {nome} <span className="text-zinc-500 dark:text-zinc-400">· {papel}</span>
              </span>
            </div>
          ))}
        </div>
      </Secao>
    </div>
  )
}

function PaginaChaves({ keys, setKeys, env }) {
  return (
    <div className="space-y-4">
      <p className="px-1 text-sm text-zinc-500 dark:text-zinc-400">
        As chaves ficam salvas só neste aparelho. A do Gemini é a principal; as outras são opcionais e
        deixam o app mais rápido e com mais recursos.
      </p>
      <CampoChave
        titulo="Google Gemini (principal)"
        descricao="Conversa, anexos, pesquisa na internet e imagens. Grátis em"
        link="https://aistudio.google.com/apikey"
        linkTexto="aistudio.google.com/apikey"
        placeholder="AIza..."
        valor={keys.gemini}
        onSalvar={setKeys.gemini}
        envNome="VITE_GEMINI_API_KEY"
        envAtivo={env.gemini}
      />
      <CampoChave
        titulo="Groq (rápido e reserva)"
        descricao="Usada pelo Relâmpago (respostas rápidas) e como reserva quando o Gemini atinge o limite. Grátis em"
        link="https://console.groq.com/keys"
        linkTexto="console.groq.com/keys"
        placeholder="gsk_..."
        valor={keys.groq}
        onSalvar={setKeys.groq}
        envNome="VITE_GROQ_API_KEY"
        envAtivo={env.groq}
      />
      <CampoChave
        titulo="DeepSeek (arquivos)"
        descricao="Cria arquivos (HTML, PDF, TXT...). É paga, mas muito barata. Sem a chave, o Gemini cria os arquivos. Pegue em"
        link="https://platform.deepseek.com/api_keys"
        linkTexto="platform.deepseek.com"
        placeholder="sk-..."
        valor={keys.deepseek}
        onSalvar={setKeys.deepseek}
        envNome="VITE_DEEPSEEK_API_KEY"
        envAtivo={env.deepseek}
      />
    </div>
  )
}

function PaginaMemoria({ nome, onSaveName, onForgetName, settings, set, convs, onClearHistory }) {
  const [rascunho, setRascunho] = useState(nome)
  const [salvo, setSalvo] = useState(false)
  const lista = [...convs].filter((c) => c.messages.length).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 20)
  return (
    <div className="space-y-6">
      <Secao>
        <Grupo>
          <Interruptor
            titulo="Lembrar das conversas"
            descricao="A IA usa um resumo das últimas 20 conversas para dar continuidade. Tudo fica salvo apenas neste aparelho."
            ligado={settings.memory}
            onChange={(v) => set('memory', v)}
          />
        </Grupo>
      </Secao>

      <Secao titulo="Seu nome" descricao="A IA usa o seu nome para cumprimentar você.">
        <div className="card p-3">
          <input
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            placeholder="Como posso chamar você?"
            maxLength={40}
            autoComplete="off"
            className="field"
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                onSaveName(rascunho)
                setSalvo(true)
                setTimeout(() => setSalvo(false), 2000)
              }}
              className="btn-accent flex-1 py-3 text-sm"
            >
              {salvo ? 'Nome salvo!' : 'Salvar nome'}
            </button>
            {nome && (
              <button
                onClick={() => {
                  onForgetName()
                  setRascunho('')
                }}
                className="btn-soft px-4 text-red-500 dark:text-red-400"
              >
                Esquecer
              </button>
            )}
          </div>
        </div>
      </Secao>

      <Secao titulo={`Conversas lembradas (${lista.length} de 20)`}>
        <div className="card overflow-hidden">
          {lista.length === 0 ? (
            <p className="p-4 text-sm text-zinc-500">Ainda não há conversas na memória.</p>
          ) : (
            <ul className="max-h-64 divide-y divide-zinc-200/70 overflow-y-auto thin-scroll dark:divide-white/[0.06]">
              {lista.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="truncate">{c.title}</span>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {new Date(c.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {lista.length > 0 && (
          <button
            onClick={onClearHistory}
            className="w-full rounded-full border border-red-500/40 py-3 text-sm font-medium text-red-500 transition hover:bg-red-500/10 dark:text-red-400"
          >
            Esquecer todas as conversas
          </button>
        )}
      </Secao>
    </div>
  )
}

function PaginaAparencia({ theme, setTheme, settings, set }) {
  return (
    <div className="space-y-6">
      <Secao titulo="Tema">
        <Opcoes
          valor={theme}
          opcoes={[
            ['dark', 'Escuro'],
            ['light', 'Claro'],
            ['auto', 'Automático'],
          ]}
          onChange={setTheme}
        />
      </Secao>

      <Secao titulo="Cor de destaque">
        <div className="card flex flex-wrap gap-3 p-4">
          {CORES.map(([id, nome, rgb]) => (
            <button
              key={id}
              onClick={() => set('accent', id)}
              aria-label={nome}
              className="flex flex-col items-center gap-1.5"
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
                  settings.accent === id ? 'ring-2 ring-offset-2 ring-zinc-400 ring-offset-white dark:ring-white dark:ring-offset-ink-800' : ''
                }`}
                style={{ background: `rgb(${rgb})` }}
              >
                {settings.accent === id && <Icon name="check" className="h-5 w-5 text-black/70" />}
              </span>
              <span className="text-[0.7rem] text-zinc-500 dark:text-zinc-400">{nome}</span>
            </button>
          ))}
        </div>
      </Secao>

      <Secao titulo="Tamanho do texto">
        <Opcoes
          valor={settings.fontSize}
          opcoes={[
            ['pequena', 'Pequeno'],
            ['media', 'Médio'],
            ['grande', 'Grande'],
          ]}
          onChange={(v) => set('fontSize', v)}
        />
      </Secao>

      <Secao titulo="Teclado">
        <Grupo>
          <Interruptor
            titulo="Enviar com Enter"
            descricao="Desligado, o Enter pula de linha e você envia pelo botão."
            ligado={settings.enterToSend}
            onChange={(v) => set('enterToSend', v)}
          />
        </Grupo>
      </Secao>
    </div>
  )
}

function PaginaVoz({ settings, set, onTestVoice, temVoz, temMic }) {
  return (
    <div className="space-y-6">
      <Secao titulo="Leitura em voz alta" descricao="Toque no alto-falante de uma resposta para ouvi-la.">
        <Grupo>
          <Interruptor
            titulo="Ler respostas automaticamente"
            descricao="A IA lê cada resposta nova assim que ela chega."
            ligado={settings.autoSpeak}
            onChange={(v) => set('autoSpeak', v)}
          />
        </Grupo>
      </Secao>

      <Secao titulo="Velocidade da voz">
        <Opcoes
          valor={settings.speechRate}
          opcoes={[
            [0.85, 'Lenta'],
            [1, 'Normal'],
            [1.2, 'Rápida'],
            [1.4, 'Muito'],
          ]}
          onChange={(v) => set('speechRate', v)}
        />
        <button onClick={onTestVoice} disabled={!temVoz} className="btn-soft w-full py-3">
          <Icon name="speaker" className="h-4 w-4" />
          Testar voz
        </button>
      </Secao>

      <p className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
        {temVoz ? 'A leitura usa a voz em português do seu aparelho.' : 'Seu navegador não tem leitura em voz alta.'}{' '}
        {temMic
          ? 'O microfone do campo de mensagem digita o que você falar. Na primeira vez, o navegador pede permissão.'
          : 'Seu navegador não permite ditado por voz. Use o Chrome.'}
      </p>
    </div>
  )
}

function PaginaImagens({ settings, set }) {
  return (
    <div className="space-y-6">
      <Secao titulo="Formato">
        <Opcoes
          valor={settings.imgFormat}
          opcoes={[
            ['quadrado', 'Quadrado'],
            ['retrato', 'Retrato'],
            ['paisagem', 'Paisagem'],
          ]}
          onChange={(v) => set('imgFormat', v)}
        />
      </Secao>

      <Secao titulo="Estilo" descricao="No automático, a IA escolhe o melhor estilo para o seu pedido.">
        <Opcoes
          colunas="grid-cols-3"
          valor={settings.imgStyle}
          opcoes={[
            ['automatico', 'Automático'],
            ['realista', 'Realista'],
            ['ilustracao', 'Ilustração'],
            ['3d', '3D'],
            ['anime', 'Anime'],
            ['logo', 'Logo'],
          ]}
          onChange={(v) => set('imgStyle', v)}
        />
      </Secao>

      <Secao titulo="Qualidade">
        <Opcoes
          valor={settings.imgQuality}
          opcoes={[
            ['padrao', 'Padrão (mais rápida)'],
            ['alta', 'Alta (mais detalhes)'],
          ]}
          onChange={(v) => set('imgQuality', v)}
        />
      </Secao>

      <p className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
        As imagens são criadas pelo FLUX, por um serviço gratuito (Pollinations). Podem levar até um minuto e a marca do
        serviço pode aparecer no canto. Quanto mais detalhado o seu pedido, melhor o resultado.
      </p>
    </div>
  )
}

function PaginaDados({ onExport, onClearHistory, onReset }) {
  return (
    <div className="space-y-6">
      <Secao titulo="Exportar conversas" descricao="Baixa todas as conversas salvas neste aparelho.">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onExport('json')} className="btn-soft py-3">
            <Icon name="download" className="h-4 w-4" />
            JSON
          </button>
          <button onClick={() => onExport('txt')} className="btn-soft py-3">
            <Icon name="download" className="h-4 w-4" />
            Texto
          </button>
        </div>
      </Secao>

      <Secao titulo="Apagar">
        <div className="space-y-2">
          <button
            onClick={onClearHistory}
            className="w-full rounded-full border border-red-500/40 py-3 text-sm font-medium text-red-500 transition hover:bg-red-500/10 dark:text-red-400"
          >
            Limpar histórico de conversas
          </button>
          <button onClick={onReset} className="btn-soft w-full py-3">
            Restaurar configurações padrão
          </button>
        </div>
      </Secao>

      <p className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
        As conversas e as chaves ficam salvas somente neste aparelho. Os textos que você envia à IA são processados
        pelos serviços escolhidos (Google Gemini, Groq e DeepSeek).
      </p>
    </div>
  )
}

function PaginaSobre() {
  return (
    <div className="flex flex-col items-center px-4 pt-6 text-center">
      <img src={logoUrl} alt="LINDOSO IA" className="h-24 w-24 rounded-3xl object-cover shadow-2xl" />
      <h2 className="mt-5 text-2xl font-semibold tracking-tight">LINDOSO IA</h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Teu parceiro de Belém</p>
      <p className="mt-1 text-xs text-zinc-400">Versão 2.0</p>
      <p className="mt-6 max-w-sm text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
        Assistente de IA criado por Lindoso. Conversa, lê arquivos, pesquisa na internet, cria PDFs, textos e imagens, e
        lembra de você.
      </p>
      <p className="mt-6 max-w-sm text-xs text-zinc-500">
        Para instalar no celular, abra o menu do Chrome e toque em “Instalar app”.
      </p>
    </div>
  )
}

/* ------------------------------ tela principal ------------------------------ */

export default function SettingsScreen({
  initialPage = 'home',
  onBack,
  theme,
  setTheme,
  settings,
  set,
  keys,
  setKeys,
  env,
  name,
  onSaveName,
  onForgetName,
  convs,
  modelos,
  onExport,
  onClearHistory,
  onReset,
  onTestVoice,
  temVoz,
  temMic,
}) {
  const [page, setPage] = useState(initialPage)

  const voltar = () => (page === 'home' ? onBack() : setPage(PAI[page] || 'home'))

  return (
    <div className="flex min-h-0 flex-1 flex-col animate-fade-in">
      <header
        className="flex items-center gap-2 bg-white/80 px-3 pb-3 backdrop-blur-xl dark:bg-ink-950/80"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
      >
        <button onClick={voltar} className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-white/10" aria-label="Voltar">
          <Icon name="back" />
        </button>
        <h1 className="text-lg font-semibold tracking-tight">{TITULOS[page]}</h1>
      </header>

      <div className="thin-scroll flex-1 overflow-y-auto px-4 pb-10 pt-2">
        <div className="mx-auto max-w-xl">
          {page === 'home' && <PaginaInicio ir={setPage} nome={name} settings={settings} keys={keys} env={env} />}
          {page === 'ai' && <PaginaIA ir={setPage} settings={settings} set={set} keys={keys} env={env} modelos={modelos} />}
          {page === 'keys' && <PaginaChaves keys={keys} setKeys={setKeys} env={env} />}
          {page === 'memory' && (
            <PaginaMemoria
              nome={name}
              onSaveName={onSaveName}
              onForgetName={onForgetName}
              settings={settings}
              set={set}
              convs={convs}
              onClearHistory={onClearHistory}
            />
          )}
          {page === 'appearance' && <PaginaAparencia theme={theme} setTheme={setTheme} settings={settings} set={set} />}
          {page === 'voice' && <PaginaVoz settings={settings} set={set} onTestVoice={onTestVoice} temVoz={temVoz} temMic={temMic} />}
          {page === 'images' && <PaginaImagens settings={settings} set={set} />}
          {page === 'data' && <PaginaDados onExport={onExport} onClearHistory={onClearHistory} onReset={onReset} />}
          {page === 'about' && <PaginaSobre />}
        </div>
      </div>
    </div>
  )
}
