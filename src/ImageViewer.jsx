import { useEffect, useState } from 'react'
import { Icon } from './icons.jsx'

/* ------------------------------------------------------------------ */
/*  Ver, baixar e compartilhar imagens criadas pela IA                  */
/* ------------------------------------------------------------------ */

async function pegarImagem(url) {
  const res = await fetch(url, { mode: 'cors' })
  if (!res.ok) throw new Error('falhou')
  return res.blob()
}

const extensao = (blob) => (/png/.test(blob.type) ? 'png' : /webp/.test(blob.type) ? 'webp' : 'jpg')

/** Salva a imagem no aparelho (pasta Downloads). Se o navegador não deixar, abre em outra aba. */
export async function baixarImagem(url, aviso) {
  try {
    const blob = await pegarImagem(url)
    const obj = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = obj
    a.download = `lindoso-ia-${Date.now()}.${extensao(blob)}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(obj), 3000)
    aviso?.('Imagem salva em Downloads.')
  } catch {
    window.open(url, '_blank', 'noopener')
    aviso?.('Abri a imagem em outra aba. Toque e segure nela para salvar.')
  }
}

/** Abre o menu de compartilhar do celular (WhatsApp, Drive...). Sem ele, copia o link. */
export async function compartilharImagem(url, aviso) {
  try {
    const blob = await pegarImagem(url)
    const arquivo = new File([blob], `lindoso-ia.${extensao(blob)}`, { type: blob.type || 'image/jpeg' })
    if (navigator.canShare?.({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo], title: 'Imagem do LINDOSO IA' })
      return
    }
    throw new Error('sem arquivo')
  } catch (e) {
    if (e?.name === 'AbortError') return // a pessoa fechou o menu
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Imagem do LINDOSO IA', url })
      } else {
        await navigator.clipboard.writeText(url)
        aviso?.('Link da imagem copiado.')
      }
    } catch (e2) {
      if (e2?.name !== 'AbortError') aviso?.('Não foi possível compartilhar agora.')
    }
  }
}

export default function ImageViewer({ url, onClose, onToast }) {
  const [zoom, setZoom] = useState(false)
  const [busy, setBusy] = useState('')

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = antes
    }
  }, [onClose])

  const baixar = async () => {
    setBusy('baixar')
    await baixarImagem(url, onToast)
    setBusy('')
  }
  const compartilhar = async () => {
    setBusy('compartilhar')
    await compartilharImagem(url, onToast)
    setBusy('')
  }

  const botao =
    'flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50'

  return (
    <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col animate-fade-in" role="dialog" aria-modal="true">
      <div
        className="flex items-center justify-between gap-2 px-3 pb-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}
      >
        <button onClick={onClose} className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white" aria-label="Fechar">
          <Icon name="x" />
        </button>
        <div className="flex gap-2">
          <button onClick={baixar} disabled={busy !== ''} className={botao}>
            <Icon name="download" className="w-4 h-4" />
            {busy === 'baixar' ? 'Salvando...' : 'Baixar'}
          </button>
          <button onClick={compartilhar} disabled={busy !== ''} className={botao}>
            <Icon name="share" className="w-4 h-4" />
            Compartilhar
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto flex" onClick={() => setZoom((z) => !z)}>
        <img
          src={url}
          alt="Imagem criada pela IA"
          draggable="false"
          className={`m-auto select-none ${
            zoom ? 'max-w-none w-[230%] cursor-zoom-out' : 'max-w-full max-h-full object-contain cursor-zoom-in'
          }`}
        />
      </div>

      <p className="text-center text-xs text-white/50 pb-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)' }}>
        Toque na imagem para {zoom ? 'reduzir' : 'ampliar'}
      </p>
    </div>
  )
}
