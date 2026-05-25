// ============================================================
// state.js — Gerenciamento de estado compartilhado via OBR room metadata
//
// Este módulo é a "verdade" sobre o que está no palco em qualquer
// momento. Tanto o painel do Mestre quanto o display do palco leem
// daqui. Mudanças se propagam automaticamente para todos os jogadores
// porque o Owlbear Rodeo replica room.metadata em tempo real.
// ============================================================

import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3/+esm";

// ID único da extensão (convenção de domínio reverso).
// Troque para o domínio onde você vai hospedar (ex.: "io.github.seuuser.ligeia-theatre").
export const EXT_ID = "io.github.ligeia.theatre";

// Chaves usadas no room.metadata
export const KEY_STAGE   = `${EXT_ID}/stage`;     // estado do palco (quem está em cena)
export const KEY_LIBRARY = `${EXT_ID}/library`;   // biblioteca de personagens cadastrados manualmente
export const KEY_CONFIG  = `${EXT_ID}/config`;    // configurações (URL Ligéia etc.)

/**
 * Estrutura do estado do palco:
 * {
 *   open: boolean,                        // se o palco está visível para todos
 *   activeSpeakerId: string | null,       // quem está falando
 *   characterOrder: string[],             // ordem dos IDs no palco
 *   characters: {
 *     [id]: {
 *       id: string,
 *       name: string,
 *       color: string,                    // cor de destaque do nome
 *       portrait: string,                 // URL do retrato neutro
 *       emotes: { [emoteName]: string },  // outras expressões
 *       currentEmote: string,             // emoção atual (ou "neutral")
 *       position: "far-left"|"left"|"center"|"right"|"far-right",
 *       dialogue: string                  // fala atual
 *     }
 *   }
 * }
 */
export const DEFAULT_STAGE = Object.freeze({
  open: false,
  activeSpeakerId: null,
  characterOrder: [],
  characters: {},
});

export const DEFAULT_LIBRARY = Object.freeze({
  characters: {},  // { [id]: { id, name, portrait, color, emotes } }
});

export const DEFAULT_CONFIG = Object.freeze({
  ligeiaUrl: "",
});

// ---------- LEITURA ----------

export async function readStage() {
  const md = await OBR.room.getMetadata();
  return { ...DEFAULT_STAGE, ...(md[KEY_STAGE] || {}) };
}

export async function readLibrary() {
  const md = await OBR.room.getMetadata();
  return { ...DEFAULT_LIBRARY, ...(md[KEY_LIBRARY] || {}) };
}

export async function readConfig() {
  const md = await OBR.room.getMetadata();
  return { ...DEFAULT_CONFIG, ...(md[KEY_CONFIG] || {}) };
}

// ---------- ESCRITA ----------

export async function writeStage(stage) {
  await OBR.room.setMetadata({ [KEY_STAGE]: stage });
}

export async function writeLibrary(library) {
  await OBR.room.setMetadata({ [KEY_LIBRARY]: library });
}

export async function writeConfig(config) {
  await OBR.room.setMetadata({ [KEY_CONFIG]: config });
}

// ---------- OBSERVADORES ----------

/**
 * Inscreve um callback que recebe o estado do palco sempre que mudar.
 * Retorna função para cancelar a inscrição.
 */
export function onStageChange(callback) {
  return OBR.room.onMetadataChange((metadata) => {
    const stage = { ...DEFAULT_STAGE, ...(metadata[KEY_STAGE] || {}) };
    callback(stage);
  });
}

export function onLibraryChange(callback) {
  return OBR.room.onMetadataChange((metadata) => {
    const lib = { ...DEFAULT_LIBRARY, ...(metadata[KEY_LIBRARY] || {}) };
    callback(lib);
  });
}

// ---------- HELPERS DE MUTAÇÃO ----------

/**
 * Adiciona personagem ao palco. Se já estiver, mantém posição/diálogo atuais.
 */
export async function pushToStage(character, position = "center") {
  const stage = await readStage();
  const existing = stage.characters[character.id];

  stage.characters[character.id] = {
    id: character.id,
    name: character.name,
    color: character.color || "#d4a85a",
    portrait: character.portrait,
    emotes: character.emotes || {},
    currentEmote: existing?.currentEmote || "neutral",
    position: existing?.position || position,
    dialogue: existing?.dialogue || "",
  };

  if (!stage.characterOrder.includes(character.id)) {
    stage.characterOrder.push(character.id);
  }

  stage.open = true;
  await writeStage(stage);
}

export async function removeFromStage(characterId) {
  const stage = await readStage();
  delete stage.characters[characterId];
  stage.characterOrder = stage.characterOrder.filter((id) => id !== characterId);
  if (stage.activeSpeakerId === characterId) {
    stage.activeSpeakerId = null;
  }
  await writeStage(stage);
}

export async function setSpeaker(characterId, dialogue = null) {
  const stage = await readStage();
  if (characterId && !stage.characters[characterId]) return;
  stage.activeSpeakerId = characterId;
  if (characterId && dialogue !== null) {
    stage.characters[characterId].dialogue = dialogue;
  }
  await writeStage(stage);
}

export async function updateStageCharacter(characterId, patch) {
  const stage = await readStage();
  if (!stage.characters[characterId]) return;
  stage.characters[characterId] = { ...stage.characters[characterId], ...patch };
  await writeStage(stage);
}

export async function setStageOpen(open) {
  const stage = await readStage();
  stage.open = open;
  await writeStage(stage);
}

export async function clearStage() {
  await writeStage({ ...DEFAULT_STAGE });
}

// ---------- BIBLIOTECA ----------

export async function saveLibraryCharacter(character) {
  const lib = await readLibrary();
  lib.characters[character.id] = character;
  await writeLibrary(lib);
}

export async function deleteLibraryCharacter(characterId) {
  const lib = await readLibrary();
  delete lib.characters[characterId];
  await writeLibrary(lib);
}
