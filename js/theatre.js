// ============================================================
// theatre.js — Renderiza o palco em tempo real
//
// Lê o estado de room.metadata e desenha retratos + caixa de
// diálogo na parte inferior da tela. Reage a qualquer mudança.
// ============================================================

import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3/+esm";
import { onStageChange, readStage } from "./state.js";

const stageEl     = document.getElementById("stage");
const portraitsEl = document.getElementById("portraits");
const dialogueBox = document.getElementById("dialogue-box");
const dialogueNameEl = document.getElementById("dialogue-name");
const dialogueTextEl = document.getElementById("dialogue-text");

// Cache dos elementos DOM dos retratos, por id
const portraitEls = new Map();
let typewriterTimer = null;
let lastRenderedDialogue = "";

OBR.onReady(async () => {
  // Renderiza estado inicial
  const initial = await readStage();
  render(initial);

  // Inscreve em mudanças
  onStageChange(render);
});

function render(stage) {
  const ids = stage.characterOrder.filter((id) => stage.characters[id]);

  // Palco vazio / fechado
  if (!stage.open || ids.length === 0) {
    stageEl.dataset.empty = "true";
    // Remove todos os retratos com animação de saída
    for (const [id, el] of portraitEls.entries()) {
      animateExit(el).then(() => el.remove());
      portraitEls.delete(id);
    }
    dialogueBox.classList.add("hidden");
    lastRenderedDialogue = "";
    return;
  }

  stageEl.dataset.empty = "false";

  // ---- Sincroniza retratos: adiciona novos, atualiza existentes, remove sumidos ----
  const presentIds = new Set(ids);

  // Remover retratos que não estão mais no palco
  for (const [id, el] of portraitEls.entries()) {
    if (!presentIds.has(id)) {
      animateExit(el).then(() => el.remove());
      portraitEls.delete(id);
    }
  }

  // Adicionar/atualizar retratos
  for (const id of ids) {
    const char = stage.characters[id];
    let el = portraitEls.get(id);
    if (!el) {
      el = createPortraitEl(char);
      portraitEls.set(id, el);
      portraitsEl.appendChild(el);
      // Animação de entrada
      requestAnimationFrame(() => {
        el.classList.add("entering");
        setTimeout(() => el.classList.remove("entering"), 750);
      });
    } else {
      updatePortraitEl(el, char);
    }

    // Marca quem está falando
    el.classList.toggle("speaking", id === stage.activeSpeakerId);
  }

  // ---- Caixa de diálogo ----
  const speaker = stage.activeSpeakerId ? stage.characters[stage.activeSpeakerId] : null;
  const dialogue = speaker?.dialogue || "";

  if (speaker && dialogue.trim()) {
    dialogueBox.classList.remove("hidden");
    dialogueBox.style.setProperty("--name-color", speaker.color || "#d4a85a");
    dialogueNameEl.textContent = speaker.name;

    // Só re-roda o efeito de digitação se o texto mudou
    if (dialogue !== lastRenderedDialogue) {
      lastRenderedDialogue = dialogue;
      typewrite(dialogueTextEl, dialogue);
    }
  } else {
    dialogueBox.classList.add("hidden");
    lastRenderedDialogue = "";
    if (typewriterTimer) { clearInterval(typewriterTimer); typewriterTimer = null; }
  }
}

function createPortraitEl(char) {
  const el = document.createElement("div");
  el.className = "portrait";
  el.dataset.id = char.id;
  el.dataset.position = char.position || "center";

  const img = document.createElement("img");
  img.className = "portrait-image";
  img.alt = char.name;
  img.draggable = false;
  img.src = resolveEmoteUrl(char);

  // Evita o ícone quebrado caso a URL falhe
  img.onerror = () => {
    img.style.display = "none";
    const fallback = document.createElement("div");
    fallback.style.cssText = `
      width: 200px; height: 350px;
      background: linear-gradient(135deg, #5c1a26, #251a1f);
      border: 2px solid #d4a85a;
      display: flex; align-items: center; justify-content: center;
      color: #d4a85a; font-family: 'Cormorant Garamond', serif;
      font-size: 24px; padding: 20px; text-align: center;
      border-radius: 8px;
    `;
    fallback.textContent = char.name;
    el.appendChild(fallback);
  };

  el.appendChild(img);
  return el;
}

function updatePortraitEl(el, char) {
  if (el.dataset.position !== char.position) {
    el.dataset.position = char.position;
  }
  const img = el.querySelector(".portrait-image");
  if (img) {
    const url = resolveEmoteUrl(char);
    if (img.src !== url) img.src = url;
    img.alt = char.name;
  }
}

function resolveEmoteUrl(char) {
  if (char.currentEmote && char.currentEmote !== "neutral" && char.emotes?.[char.currentEmote]) {
    return char.emotes[char.currentEmote];
  }
  return char.portrait;
}

async function animateExit(el) {
  return new Promise((resolve) => {
    el.classList.remove("entering", "speaking");
    el.classList.add("exiting");
    setTimeout(resolve, 500);
  });
}

// Efeito "máquina de escrever" para o diálogo
function typewrite(target, text) {
  if (typewriterTimer) clearInterval(typewriterTimer);
  target.textContent = "";
  target.classList.add("typing");

  const chars = [...text];
  let i = 0;
  const speed = Math.max(10, Math.min(35, 1200 / chars.length));

  typewriterTimer = setInterval(() => {
    if (i >= chars.length) {
      clearInterval(typewriterTimer);
      typewriterTimer = null;
      target.classList.remove("typing");
      return;
    }
    target.textContent += chars[i++];
  }, speed);
}
