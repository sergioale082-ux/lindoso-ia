/* ------------------------------------------------------------------ */
/*  LINDOSO IA · Modelo 4: FLUX (imagem, único)                        */
/*  Usa o FLUX pelo endpoint gratuito do Pollinations (sem chave).     */
/*  Se o Groq estiver ligado, o pedido é traduzido para inglês e       */
/*  melhorado antes (o FLUX entende inglês bem melhor).                */
/* ------------------------------------------------------------------ */

import { melhorarPromptImagem } from './rapido.js'

export const FLUX_URL = 'https://image.pollinations.ai/prompt/'

// tira "gera uma imagem de" e deixa só a descrição
const COMANDO_RE =
  /^\s*(?:por favor[, ]*)?(?:gera|gere|gerar|cria|crie|criar|faz|faça|faca|fazer|desenha|desenhe|desenhar|monta|monte)\s+(?:uma?|as?|os?)?\s*(?:imagem|foto|desenho|ilustra[cç][aã]o|arte|logo|logotipo|wallpaper)\s*(?:de|do|da|com)?\s*/i

export const descricaoDaImagem = (texto) => texto.replace(COMANDO_RE, '').trim() || texto.trim()

// espera a imagem carregar de verdade (para avisar se falhar)
const carregar = (url, ms = 70000) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    const t = setTimeout(() => reject(new Error('demorou')), ms)
    img.onload = () => {
      clearTimeout(t)
      resolve(url)
    }
    img.onerror = () => {
      clearTimeout(t)
      reject(new Error('falhou'))
    }
    img.src = url
  })

/** Gera a imagem. Devolve { url }. Lança erro amigável se não conseguir. */
export async function gerarImagem({ texto, groqKey }) {
  const descricao = await melhorarPromptImagem(groqKey, descricaoDaImagem(texto))
  const seed = Math.floor(Math.random() * 1e6)
  const url =
    FLUX_URL + encodeURIComponent(descricao.slice(0, 600)) + `?model=flux&width=768&height=768&nologo=true&seed=${seed}`
  try {
    await carregar(url)
  } catch {
    throw new Error('Não consegui criar a imagem agora. Tente de novo em instantes.')
  }
  return { url }
}
