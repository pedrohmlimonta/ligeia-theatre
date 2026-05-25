// ============================================================
// ligeia-bridge.js — Ponte de integração com o sistema Ligéia
//
// ⚠️  ESTE É O ARQUIVO QUE VOCÊ DEVE CUSTOMIZAR
//
// Aqui você ensina o Ligéia Theatre a "falar" com o seu módulo Ligéia.
// O contrato é simples: retornar uma lista de personagens no formato
// esperado pela extensão. Toda a sincronização com o palco e com os
// outros jogadores já é cuidada pela extensão automaticamente.
//
// FORMATO ESPERADO DE PERSONAGEM:
// {
//   id: string,                                  // identificador único e estável
//   name: string,                                // nome exibido
//   portrait: string,                            // URL do retrato "neutro" (corpo inteiro funciona melhor)
//   color?: string,                              // cor de destaque do nome (#hex)
//   emotes?: { [nomeDaEmocao: string]: string }  // URLs de outras expressões
// }
// ============================================================

/**
 * Estratégia 1 — Fetch HTTP de uma API do seu módulo Ligéia.
 *
 * Se o seu módulo Ligéia expõe um endpoint REST que devolve uma lista
 * de personagens (ou personagens da sessão atual), basta apontar a URL
 * na aba "Ligéia" do painel. Adapte o mapeamento se o formato do seu
 * módulo for diferente.
 */
async function fetchFromLigeiaApi(baseUrl) {
  // Garantia: sem barra dupla
  const url = baseUrl.replace(/\/+$/, "") + "/characters";

  const response = await fetch(url, {
    headers: { "Accept": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Ligéia respondeu ${response.status}`);
  }

  const data = await response.json();

  // ⚠️ Adapte abaixo conforme o JSON real do seu módulo.
  // Aqui assumimos: { characters: [{ id, name, image, emotes, accent }, ...] }
  const list = Array.isArray(data) ? data : (data.characters || []);

  return list.map((c) => ({
    id: String(c.id ?? c._id ?? c.slug ?? cryptoRandomId()),
    name: c.name ?? c.nome ?? "Sem nome",
    portrait: c.image ?? c.portrait ?? c.retrato ?? "",
    color: c.accent ?? c.color ?? c.cor ?? "#d4a85a",
    emotes: c.emotes ?? c.expressoes ?? {},
  })).filter((c) => c.portrait); // descarta sem retrato
}

/**
 * Estratégia 2 — Ler de um objeto global injetado pelo módulo Ligéia.
 *
 * Se o seu módulo Ligéia rodar no mesmo contexto do browser (improvável
 * em iframe, mas possível via postMessage), você pode usar:
 *
 *   window.Ligeia?.getCharacters()
 *
 * Mantenha esta função como fallback.
 */
async function fetchFromGlobal() {
  if (typeof window === "undefined") return null;
  const ligeia = window.Ligeia || window.ligeia;
  if (!ligeia || typeof ligeia.getCharacters !== "function") return null;
  const list = await Promise.resolve(ligeia.getCharacters());
  return list;
}

/**
 * Estratégia 3 — postMessage. Se o seu módulo Ligéia abre uma janela
 * pai/filha, você pode fazer um handshake. Por padrão isto está
 * desligado; descomente e adapte se necessário.
 */
// async function fetchFromPostMessage() {
//   return new Promise((resolve, reject) => {
//     const channel = new MessageChannel();
//     const timeout = setTimeout(() => reject(new Error("Timeout Ligéia")), 4000);
//     channel.port1.onmessage = (e) => { clearTimeout(timeout); resolve(e.data); };
//     window.parent.postMessage({ type: "LIGEIA_REQUEST_CHARACTERS" }, "*", [channel.port2]);
//   });
// }

// ---------- API PÚBLICA ----------

/**
 * Função principal que o painel chama para pegar personagens do Ligéia.
 * Tenta as estratégias na ordem; retorna a primeira que funcionar.
 *
 * @param {{ ligeiaUrl?: string }} config
 * @returns {Promise<{ ok: boolean, characters: Array, source: string, error?: string }>}
 */
export async function loadLigeiaCharacters(config = {}) {
  // 1) Variável global (mesma origem)
  try {
    const fromGlobal = await fetchFromGlobal();
    if (fromGlobal && fromGlobal.length) {
      return { ok: true, characters: fromGlobal, source: "global" };
    }
  } catch (e) { /* segue para próxima */ }

  // 2) API HTTP do Ligéia
  if (config.ligeiaUrl) {
    try {
      const chars = await fetchFromLigeiaApi(config.ligeiaUrl);
      return { ok: true, characters: chars, source: "api" };
    } catch (e) {
      return { ok: false, characters: [], source: "api", error: e.message };
    }
  }

  return {
    ok: false,
    characters: [],
    source: "none",
    error: "Nenhuma fonte Ligéia configurada. Informe a URL da API na aba Ligéia.",
  };
}

/**
 * Notificar o Ligéia que algo aconteceu no palco
 * (ex.: um personagem começou a falar). Implemente conforme seu módulo.
 */
export async function notifyLigeia(event, payload) {
  // Exemplo (descomente e adapte):
  //
  // if (window.Ligeia?.onTheatreEvent) {
  //   window.Ligeia.onTheatreEvent(event, payload);
  // }
  //
  // ou via fetch:
  //
  // await fetch(`${baseUrl}/events`, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ event, payload }),
  // });
}

function cryptoRandomId() {
  return "char-" + Math.random().toString(36).slice(2, 10);
}
