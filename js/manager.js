// ============================================================
// manager.js — Painel do Mestre
//
// Controla tudo que pode acontecer no palco: adicionar/remover
// personagens, mudar emoção, posição, diálogo e quem está falando.
// Para jogadores não-GM, mostra apenas um botão para abrir o palco
// em sua tela.
// ============================================================

import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3/+esm";
import {
  EXT_ID,
  readStage, readLibrary, readConfig,
  onStageChange, onLibraryChange,
  pushToStage, removeFromStage, setSpeaker, updateStageCharacter,
  setStageOpen, clearStage,
  saveLibraryCharacter, deleteLibraryCharacter,
  writeConfig,
} from "./state.js";
import { loadLigeiaCharacters } from "./ligeia-bridge.js";

// ---------- Elementos DOM ----------
const els = {
  warning:        document.getElementById("non-gm-warning"),
  mainContent:    document.getElementById("main-content"),
  toggleBtn:      document.getElementById("toggle-theatre-btn"),

  tabs:           document.querySelectorAll(".tab"),
  panels:         document.querySelectorAll(".tab-panel"),

  // Stage tab
  stageEmpty:     document.getElementById("stage-empty"),
  stageList:      document.getElementById("stage-list"),

  // Library tab
  addCharBtn:     document.getElementById("add-character-btn"),
  libraryList:    document.getElementById("library-list"),
  editor:         document.getElementById("character-editor"),
  editorTitle:    document.getElementById("editor-title"),
  charForm:       document.getElementById("character-form"),
  charId:         document.getElementById("char-id"),
  charName:       document.getElementById("char-name"),
  charPortrait:   document.getElementById("char-portrait"),
  charColor:      document.getElementById("char-color"),
  emotesList:     document.getElementById("emotes-list"),
  addEmoteBtn:    document.getElementById("add-emote-btn"),
  cancelBtn:      document.getElementById("cancel-editor-btn"),

  // Ligeia tab
  ligeiaStatus:   document.getElementById("ligeia-status-text"),
  ligeiaUrl:      document.getElementById("ligeia-url"),
  ligeiaConnect:  document.getElementById("ligeia-connect-btn"),
  ligeiaChars:    document.getElementById("ligeia-characters"),
};

const POSITIONS = ["far-left", "left", "center", "right", "far-right"];
const POSITION_LABELS = {
  "far-left":  "Extrema esq.",
  "left":      "Esquerda",
  "center":    "Centro",
  "right":     "Direita",
  "far-right": "Extrema dir.",
};

let isGM = false;
let cachedLibrary = { characters: {} };
let cachedStage = null;
let cachedLigeia = [];

// ============================================================
// Inicialização
// ============================================================

OBR.onReady(async () => {
  isGM = (await OBR.player.getRole()) === "GM";

  if (!isGM) {
    els.warning.classList.remove("hidden");
    // Para jogadores: troca o conteúdo principal por um botão de
    // abrir o palco na própria tela.
    renderPlayerView();
    return;
  }

  setupTabs();
  setupHeader();
  setupLibrary();
  setupEditor();
  setupLigeia();

  // Carrega estado inicial
  cachedStage = await readStage();
  cachedLibrary = await readLibrary();
  const config = await readConfig();
  els.ligeiaUrl.value = config.ligeiaUrl || "";

  renderStage(cachedStage);
  renderLibrary(cachedLibrary);
  updateToggleButton(cachedStage.open);

  // Inscreve mudanças
  onStageChange((s) => {
    cachedStage = s;
    renderStage(s);
    updateToggleButton(s.open);
  });
  onLibraryChange((l) => {
    cachedLibrary = l;
    renderLibrary(l);
  });

  // Atualiza badge da action quando o palco abrir/fechar
  OBR.action.setBadgeText(cachedStage.open ? "ON" : undefined);
});

// ============================================================
// View para jogadores não-GM
// ============================================================

function renderPlayerView() {
  els.mainContent.innerHTML = `
    <div style="padding: 24px; text-align: center;">
      <p style="margin-bottom: 14px; color: var(--text-dim); font-size: 13px;">
        Quando o Mestre abrir uma cena teatral, clique abaixo para exibi-la em sua tela.
      </p>
      <button id="player-open-theatre" class="btn btn-primary">Abrir Palco em Minha Tela</button>
    </div>
  `;
  els.toggleBtn.classList.add("hidden");
  document.getElementById("player-open-theatre").addEventListener("click", openTheatreModal);
}

// ============================================================
// Tabs
// ============================================================

function setupTabs() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      els.tabs.forEach((t) => t.classList.toggle("active", t === tab));
      els.panels.forEach((p) => {
        p.classList.toggle("active", p.id === `tab-${target}`);
      });
    });
  });
}

// ============================================================
// Header — toggle Abrir/Fechar palco
// ============================================================

function setupHeader() {
  els.toggleBtn.addEventListener("click", async () => {
    const stage = await readStage();
    const willOpen = !stage.open;
    await setStageOpen(willOpen);

    if (willOpen) {
      // Notifica jogadores e abre o palco também na tela do Mestre
      await OBR.notification.show(
        "🎭 O Mestre abriu o palco. Clique no botão da extensão para visualizar.",
        "DEFAULT"
      );
      openTheatreModal();
      await OBR.action.setBadgeText("ON");
    } else {
      await OBR.action.setBadgeText(undefined);
    }
  });
}

function updateToggleButton(open) {
  els.toggleBtn.dataset.state = open ? "open" : "closed";
}

async function openTheatreModal() {
  try {
    await OBR.modal.open({
      id: `${EXT_ID}/theatre-modal`,
      url: "/theatre.html",
      fullScreen: true,
      hideBackdrop: true,
      hidePaper: true,
    });
  } catch (err) {
    console.error("Falha ao abrir o palco em modal:", err);
    // Fallback: abre em popover grande
    await OBR.popover.open({
      id: `${EXT_ID}/theatre-popover`,
      url: "/theatre.html",
      width: window.innerWidth || 1200,
      height: Math.floor((window.innerHeight || 800) * 0.6),
    });
  }
}

// ============================================================
// Aba PALCO
// ============================================================

function renderStage(stage) {
  const ids = stage.characterOrder.filter((id) => stage.characters[id]);

  if (ids.length === 0) {
    els.stageEmpty.classList.remove("hidden");
    els.stageList.innerHTML = "";
    return;
  }

  els.stageEmpty.classList.add("hidden");
  els.stageList.innerHTML = "";

  ids.forEach((id) => {
    const char = stage.characters[id];
    const card = renderStageCard(char, stage.activeSpeakerId === id);
    els.stageList.appendChild(card);
  });
}

function renderStageCard(char, isSpeaking) {
  const card = document.createElement("div");
  card.className = "stage-card" + (isSpeaking ? " speaking" : "");

  const emoteOptions = [
    `<option value="neutral" ${char.currentEmote === "neutral" ? "selected" : ""}>Neutro</option>`,
    ...Object.keys(char.emotes || {}).map((name) =>
      `<option value="${escapeAttr(name)}" ${char.currentEmote === name ? "selected" : ""}>${escapeHtml(name)}</option>`
    ),
  ].join("");

  const positionOptions = POSITIONS.map((p) =>
    `<option value="${p}" ${char.position === p ? "selected" : ""}>${POSITION_LABELS[p]}</option>`
  ).join("");

  card.innerHTML = `
    <div class="stage-card-header">
      <div class="stage-card-avatar" style="background-image: url('${escapeAttr(char.portrait)}')"></div>
      <div class="stage-card-name">${escapeHtml(char.name)}</div>
    </div>

    <div class="stage-card-controls">
      <label>
        Posição
        <select data-action="position">${positionOptions}</select>
      </label>
      <label>
        Emoção
        <select data-action="emote">${emoteOptions}</select>
      </label>
    </div>

    <div class="stage-card-dialogue">
      <label for="dlg-${char.id}">Diálogo</label>
      <textarea id="dlg-${char.id}" data-action="dialogue" rows="2" placeholder="O que ${escapeAttr(char.name)} diz...">${escapeHtml(char.dialogue || "")}</textarea>
    </div>

    <div class="stage-card-actions">
      <button class="btn ${isSpeaking ? "btn-primary" : "btn-secondary"} btn-small" data-action="speak">
        ${isSpeaking ? "★ Falando" : "Falar"}
      </button>
      <button class="btn btn-danger btn-small" data-action="remove">Remover</button>
    </div>
  `;

  // Handlers
  card.querySelector('[data-action="position"]').addEventListener("change", (e) => {
    updateStageCharacter(char.id, { position: e.target.value });
  });
  card.querySelector('[data-action="emote"]').addEventListener("change", (e) => {
    updateStageCharacter(char.id, { currentEmote: e.target.value });
  });
  // Diálogo: debounce para não bombar o metadata
  let dlgTimer = null;
  card.querySelector('[data-action="dialogue"]').addEventListener("input", (e) => {
    const value = e.target.value;
    clearTimeout(dlgTimer);
    dlgTimer = setTimeout(() => {
      updateStageCharacter(char.id, { dialogue: value });
    }, 250);
  });
  card.querySelector('[data-action="speak"]').addEventListener("click", () => {
    setSpeaker(isSpeaking ? null : char.id);
  });
  card.querySelector('[data-action="remove"]').addEventListener("click", () => {
    if (confirm(`Remover ${char.name} do palco?`)) removeFromStage(char.id);
  });

  return card;
}

// ============================================================
// Aba BIBLIOTECA
// ============================================================

function setupLibrary() {
  els.addCharBtn.addEventListener("click", () => openEditor());
}

function renderLibrary(library) {
  const ids = Object.keys(library.characters || {});

  if (ids.length === 0) {
    els.libraryList.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <p>Sua biblioteca está vazia.</p>
        <p class="hint">Clique em <strong>+ Novo Personagem</strong> para começar.</p>
      </div>`;
    return;
  }

  els.libraryList.innerHTML = "";
  ids.forEach((id) => {
    const char = library.characters[id];
    els.libraryList.appendChild(renderLibraryCard(char, "library"));
  });
}

function renderLibraryCard(char, source) {
  const card = document.createElement("div");
  card.className = "library-card";
  const emoteCount = Object.keys(char.emotes || {}).length;
  const meta = emoteCount ? `${emoteCount} emoç${emoteCount === 1 ? "ão" : "ões"}` : "1 retrato";

  card.innerHTML = `
    <div class="library-card-portrait" style="background-image: url('${escapeAttr(char.portrait)}')"></div>
    <div>
      <div class="library-card-name">${escapeHtml(char.name)}</div>
      <div class="library-card-meta">${meta}</div>
    </div>
    <div class="library-card-actions">
      <button class="btn btn-primary btn-small" data-action="stage">Para o Palco</button>
      ${source === "library" ? `
        <button class="btn btn-ghost btn-small" data-action="edit">Editar</button>
        <button class="btn btn-danger btn-small" data-action="delete">Excluir</button>
      ` : `
        <button class="btn btn-secondary btn-small" data-action="import">Salvar na Biblioteca</button>
      `}
    </div>
  `;

  card.querySelector('[data-action="stage"]').addEventListener("click", () => pushToStage(char));

  if (source === "library") {
    card.querySelector('[data-action="edit"]').addEventListener("click", () => openEditor(char));
    card.querySelector('[data-action="delete"]').addEventListener("click", () => {
      if (confirm(`Excluir ${char.name} da biblioteca?`)) deleteLibraryCharacter(char.id);
    });
  } else {
    card.querySelector('[data-action="import"]').addEventListener("click", () => {
      saveLibraryCharacter(char);
      OBR.notification.show(`${char.name} salvo na biblioteca.`, "SUCCESS");
    });
  }

  return card;
}

// ============================================================
// Editor de personagem (modal)
// ============================================================

function setupEditor() {
  els.cancelBtn.addEventListener("click", closeEditor);
  els.addEmoteBtn.addEventListener("click", () => addEmoteRow());

  els.charForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Coleta emoções
    const emotes = {};
    els.emotesList.querySelectorAll(".emote-row").forEach((row) => {
      const name = row.querySelector("[data-emote-name]").value.trim();
      const url  = row.querySelector("[data-emote-url]").value.trim();
      if (name && url && name !== "neutral") emotes[name] = url;
    });

    const char = {
      id: els.charId.value || ("char-" + Date.now().toString(36)),
      name: els.charName.value.trim(),
      portrait: els.charPortrait.value.trim(),
      color: els.charColor.value || "#d4a85a",
      emotes,
    };

    await saveLibraryCharacter(char);
    closeEditor();
  });
}

function openEditor(char) {
  els.editor.classList.remove("hidden");
  els.emotesList.innerHTML = "";

  if (char) {
    els.editorTitle.textContent = "Editar Personagem";
    els.charId.value = char.id;
    els.charName.value = char.name;
    els.charPortrait.value = char.portrait;
    els.charColor.value = char.color || "#d4a85a";
    Object.entries(char.emotes || {}).forEach(([name, url]) => addEmoteRow(name, url));
  } else {
    els.editorTitle.textContent = "Novo Personagem";
    els.charForm.reset();
    els.charId.value = "";
    els.charColor.value = "#d4a85a";
  }
}

function closeEditor() {
  els.editor.classList.add("hidden");
}

function addEmoteRow(name = "", url = "") {
  const row = document.createElement("div");
  row.className = "emote-row";
  row.innerHTML = `
    <input type="text" data-emote-name placeholder="Ex: feliz" value="${escapeAttr(name)}" />
    <input type="url" data-emote-url placeholder="https://..." value="${escapeAttr(url)}" />
    <button type="button" title="Remover">×</button>
  `;
  row.querySelector("button").addEventListener("click", () => row.remove());
  els.emotesList.appendChild(row);
}

// ============================================================
// Aba LIGÉIA
// ============================================================

function setupLigeia() {
  els.ligeiaConnect.addEventListener("click", async () => {
    const url = els.ligeiaUrl.value.trim();
    await writeConfig({ ligeiaUrl: url });
    await loadAndRenderLigeia();
  });

  // Carrega automaticamente ao entrar
  loadAndRenderLigeia();
}

async function loadAndRenderLigeia() {
  els.ligeiaStatus.textContent = "Buscando personagens no Ligéia...";
  els.ligeiaChars.innerHTML = "";

  const config = await readConfig();
  const result = await loadLigeiaCharacters(config);

  if (!result.ok) {
    els.ligeiaStatus.innerHTML = `<span style="color: var(--danger)">⚠ ${escapeHtml(result.error || "Não foi possível carregar.")}</span>`;
    return;
  }

  cachedLigeia = result.characters;
  els.ligeiaStatus.innerHTML = `✓ Conectado via <strong>${result.source}</strong>. ${result.characters.length} personagem(ns) encontrado(s).`;

  if (result.characters.length === 0) {
    els.ligeiaChars.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><p>Nenhum personagem retornado pelo Ligéia.</p></div>`;
    return;
  }

  result.characters.forEach((char) => {
    els.ligeiaChars.appendChild(renderLibraryCard(char, "ligeia"));
  });
}

// ============================================================
// Utilitários
// ============================================================

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function escapeAttr(str) {
  return String(str ?? "").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
