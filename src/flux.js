/* ------------------------------------------------------------------ */
/*  LINDOSO IA · Modelo 4: FLUX (imagem)                              */
/*  Melhora o prompt (quando há chave Groq) e tenta gerar a imagem    */
/*  com nova tentativa automática se o servidor engasgar.             */
/* ------------------------------------------------------------------ */

import { melhorarPromptImagem } from './rapido.js'

const ENDPOINTS = [
  (prompt, seed) =>
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?model=flux&width=768&height=768&nologo=true&enhance=true&seed=${seed}`,
  (prompt, seed) =>
    `https://pollinations.ai/p/${encodeURIComponent(prompt)}?width=768&height=768&nologo=true&seed=${seed}`,
]

const COMANDO_RE =
  /^\s*(?:por favor[, ]*)?(?:gera|gere|gerar|cria|crie|criar|faz|faça|faca|fazer|desenha|desenhe|desenhar|monta|monte)\s+(?:uma?|as?|os?)?\s*(?:imagem|foto|desenho|ilustra[cç][aã]o|arte|logo|logotipo|wallpaper)\s*(?:de|do|da|com)?\s*/i

export const descricaoDaImagem = (texto) =>
  texto.replace(COMANDO_RE, '').trim() || texto.trim()

const carregarImagem = (url, ms = 45000) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const timer = setTimeout(() => {
      img.src = ''
      reject(new Error('timeout'))
    }, ms)

    img.onload = () => {
      clearTimeout(timer)
      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new Error('empty'))
        return
      }
      // Tenta converter para Blob URL para evitar bloqueio posterior ou falhas de cache
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob))
          } else {
            resolve(url)
          }
        }, 'image/png')
      } catch {
        resolve(url)
      }
    }

    img.onerror = () => {
      clearTimeout(timer)
      reject(new Error('error'))
    }

    img.src = url
  })

/** Gera a imagem. Devolve { url }. Lança erro amigável se não conseguir. */
export async function gerarImagem({ texto, groqKey }) {
  const baseDesc = descricaoDaImagem(texto)
  let promptFinal = baseDesc
  try {
    promptFinal = await melhorarPromptImagem(groqKey, baseDesc)
  } catch {
    promptFinal = baseDesc
  }

  const limpo = String(promptFinal || baseDesc)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500)

  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const seed = Math.floor(Math.random() * 1e7) + tentativa * 137
    for (const buildUrl of ENDPOINTS) {
      const url = buildUrl(limpo, seed)
      try {
        const resolvedUrl = await carregarImagem(url)
        return { url: resolvedUrl }
      } catch {
        // tenta próximo endpoint / próxima seed
      }
    }
  }

  throw new Error(
    'O gerador de imagens está com limite temporário ou instável agora. Tente novamente em alguns instantes.'
  )
}

