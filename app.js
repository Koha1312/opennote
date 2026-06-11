/* =====================================================
   OpenNote — a zero-dependency Notion-style workspace
   Vanilla JS, localStorage persistence, no build step.
   ===================================================== */

"use strict";

// ---------- State ----------

const STORAGE_KEY = "opennote-state-v1";

const PAGE_ICONS = ["📄", "📝", "📚", "🌸", "💡", "🚀", "🎯", "🧠", "🔧", "🎮", "💙", "⭐"];

let state = {
  pages: {},          // id -> { id, title, icon, parentId, children: [ids], blocks: [...] }
  rootPages: [],      // ordered ids of top-level pages
  activePageId: null,
  theme: "light",
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function newBlock(type = "p", text = "") {
  return { id: uid(), type, text, checked: false };
}

function newPage(title = "", parentId = null) {
  return {
    id: uid(),
    title,
    icon: PAGE_ICONS[Math.floor(Math.random() * PAGE_ICONS.length)],
    parentId,
    children: [],
    open: true,
    blocks: [newBlock()],
  };
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, 250);
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = JSON.parse(raw);
      return;
    }
  } catch (e) { /* corrupted storage -> start fresh */ }
  seedDemo();
}

function seedDemo() {
  const welcome = newPage("Welcome to OpenNote");
  welcome.icon = "👋";
  welcome.blocks = [
    newBlock("h1", "Hello! 👋"),
    newBlock("p", "OpenNote is a tiny Notion-style workspace built with zero dependencies — just HTML, CSS and vanilla JavaScript."),
    newBlock("h2", "Try these"),
    newBlock("todo", "Type / on an empty line to open the block menu"),
    newBlock("todo", "Drag the ⠿ handle to reorder blocks"),
    newBlock("todo", "Use markdown shortcuts: # heading, - list, > quote"),
    newBlock("quote", "Everything is saved automatically in your browser."),
    newBlock("divider", ""),
    newBlock("code", "console.log(\"hello from OpenNote\");"),
  ];
  const ideas = newPage("Ideas");
  ideas.icon = "💡";
  ideas.blocks = [newBlock("bullet", "Build cool stuff"), newBlock("bullet", "Ship it")];

  state.pages[welcome.id] = welcome;
  state.pages[ideas.id] = ideas;
  state.rootPages = [welcome.id, ideas.id];
  state.activePageId = welcome.id;
}

// ---------- Block type registry ----------

const BLOCK_TYPES = [
  { type: "p",       name: "Text",            icon: "Aa", desc: "Plain text paragraph",        keywords: "text paragraph plain" },
  { type: "h1",      name: "Heading 1",       icon: "H1", desc: "Big section heading",         keywords: "heading h1 title big" },
  { type: "h2",      name: "Heading 2",       icon: "H2", desc: "Medium section heading",      keywords: "heading h2 medium" },
  { type: "h3",      name: "Heading 3",       icon: "H3", desc: "Small section heading",       keywords: "heading h3 small" },
  { type: "bullet",  name: "Bulleted list",   icon: "•",  desc: "Simple bulleted list",        keywords: "bullet list ul unordered" },
  { type: "numbered",name: "Numbered list",   icon: "1.", desc: "List with numbering",         keywords: "numbered list ol ordered" },
  { type: "todo",    name: "To-do list",      icon: "☑",  desc: "Track tasks with checkboxes", keywords: "todo task checkbox check" },
  { type: "quote",   name: "Quote",           icon: "❝",  desc: "Capture a quote",             keywords: "quote blockquote citation" },
  { type: "code",    name: "Code",            icon: "</>",desc: "Code snippet block",          keywords: "code snippet monospace" },
  { type: "divider", name: "Divider",         icon: "—",  desc: "Visual separator line",       keywords: "divider separator line hr" },
];

const MD_SHORTCUTS = [
  { prefix: "# ",   type: "h1" },
  { prefix: "## ",  type: "h2" },
  { prefix: "### ", type: "h3" },
  { prefix: "- ",   type: "bullet" },
  { prefix: "* ",   type: "bullet" },
  { prefix: "1. ",  type: "numbered" },
  { prefix: "[] ",  type: "todo" },
  { prefix: "> ",   type: "quote" },
  { prefix: "``` ", type: "code" },
  { prefix: "--- ", type: "divider" },
];

// ---------- DOM refs ----------

const $ = (sel) => document.querySelector(sel);
const treeEl = $("#page-tree");
const blocksEl = $("#blocks");
const titleEl = $("#page-title");
const iconEl = $("#page-icon");
const breadcrumbEl = $("#breadcrumb");
const slashMenuEl = $("#slash-menu");
const emptyStateEl = $("#empty-state");
const editorScrollEl = $("#editor-scroll");

function activePage() {
  return state.pages[state.activePageId] || null;
}

// ---------- Sidebar / page tree ----------

let searchQuery = "";

function renderTree() {
  treeEl.innerHTML = "";
  const ids = searchQuery
    ? Object.keys(state.pages).filter((id) =>
        (state.pages[id].title || "Untitled").toLowerCase().includes(searchQuery))
    : state.rootPages;

  if (ids.length === 0) {
    const empty = document.createElement("div");
    empty.className = "tree-empty";
    empty.textContent = searchQuery ? "No matching pages" : "No pages yet";
    treeEl.appendChild(empty);
    return;
  }
  ids.forEach((id) => treeEl.appendChild(renderTreeItem(id, !searchQuery)));
}

function renderTreeItem(id, withChildren) {
  const page = state.pages[id];
  const wrap = document.createElement("div");

  const item = document.createElement("div");
  item.className = "tree-item" + (id === state.activePageId ? " active" : "");
  item.dataset.id = id;

  const toggle = document.createElement("span");
  toggle.className = "tree-toggle" + (page.open ? " open" : "");
  toggle.textContent = page.children.length ? "▶" : "·";
  toggle.onclick = (e) => {
    e.stopPropagation();
    page.open = !page.open;
    save();
    renderTree();
  };

  const icon = document.createElement("span");
  icon.className = "tree-icon";
  icon.textContent = page.icon;

  const title = document.createElement("span");
  title.className = "tree-title";
  title.textContent = page.title || "Untitled";

  const actions = document.createElement("span");
  actions.className = "tree-actions";

  const addBtn = document.createElement("button");
  addBtn.textContent = "＋";
  addBtn.title = "Add sub-page";
  addBtn.onclick = (e) => {
    e.stopPropagation();
    const child = newPage("", id);
    state.pages[child.id] = child;
    page.children.push(child.id);
    page.open = true;
    openPage(child.id);
  };

  const delBtn = document.createElement("button");
  delBtn.textContent = "🗑";
  delBtn.title = "Delete page";
  delBtn.onclick = (e) => {
    e.stopPropagation();
    const count = countDescendants(id) + 1;
    const msg = count > 1
      ? `Delete "${page.title || "Untitled"}" and ${count - 1} sub-page(s)?`
      : `Delete "${page.title || "Untitled"}"?`;
    if (confirm(msg)) deletePage(id);
  };

  actions.append(addBtn, delBtn);
  item.append(toggle, icon, title, actions);
  item.onclick = () => openPage(id);
  wrap.appendChild(item);

  if (withChildren && page.open && page.children.length) {
    const childrenWrap = document.createElement("div");
    childrenWrap.className = "tree-children";
    page.children.forEach((cid) => childrenWrap.appendChild(renderTreeItem(cid, true)));
    wrap.appendChild(childrenWrap);
  }
  return wrap;
}

function countDescendants(id) {
  const page = state.pages[id];
  return page.children.reduce((sum, cid) => sum + 1 + countDescendants(cid), 0);
}

function deletePage(id) {
  const page = state.pages[id];
  // recursively remove descendants
  [...page.children].forEach(deletePage);
  if (page.parentId && state.pages[page.parentId]) {
    const siblings = state.pages[page.parentId].children;
    siblings.splice(siblings.indexOf(id), 1);
  } else {
    state.rootPages.splice(state.rootPages.indexOf(id), 1);
  }
  delete state.pages[id];
  if (state.activePageId === id) {
    state.activePageId = state.rootPages[0] || null;
  }
  save();
  renderAll();
}

function openPage(id) {
  state.activePageId = id;
  save();
  renderAll();
  titleEl.focus();
}

// ---------- Breadcrumb ----------

function renderBreadcrumb() {
  breadcrumbEl.innerHTML = "";
  const page = activePage();
  if (!page) return;
  const chain = [];
  let cur = page;
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentId ? state.pages[cur.parentId] : null;
  }
  chain.forEach((p, i) => {
    const crumb = document.createElement("span");
    crumb.className = "crumb";
    crumb.textContent = `${p.icon} ${p.title || "Untitled"}`;
    crumb.onclick = () => openPage(p.id);
    breadcrumbEl.appendChild(crumb);
    if (i < chain.length - 1) {
      const sep = document.createElement("span");
      sep.className = "crumb-sep";
      sep.textContent = "/";
      breadcrumbEl.appendChild(sep);
    }
  });
}

// ---------- Editor rendering ----------

function renderEditor() {
  const page = activePage();
  if (!page) {
    emptyStateEl.hidden = false;
    return;
  }
  emptyStateEl.hidden = true;
  iconEl.textContent = page.icon;
  titleEl.textContent = page.title;
  renderBlocks();
}

function renderBlocks() {
  const page = activePage();
  blocksEl.innerHTML = "";
  let number = 0;
  page.blocks.forEach((block) => {
    number = block.type === "numbered" ? number + 1 : 0;
    blocksEl.appendChild(renderBlock(block, number));
  });
}

function renderBlock(block, number) {
  const el = document.createElement("div");
  el.className = "block" + (block.checked ? " checked" : "");
  el.dataset.id = block.id;
  el.dataset.type = block.type;

  const handle = document.createElement("div");
  handle.className = "block-handle";
  handle.textContent = "⠿";
  handle.draggable = true;
  handle.title = "Drag to move";

  const body = document.createElement("div");
  body.className = "block-body";

  if (block.type === "divider") {
    const line = document.createElement("div");
    line.className = "block-divider-line";
    body.appendChild(line);
    el.tabIndex = 0; // focusable so Backspace can delete it
  } else {
    if (block.type === "bullet") {
      const dot = document.createElement("span");
      dot.className = "block-bullet";
      dot.textContent = "•";
      body.appendChild(dot);
    } else if (block.type === "numbered") {
      const num = document.createElement("span");
      num.className = "block-number";
      num.textContent = number + ".";
      body.appendChild(num);
    } else if (block.type === "todo") {
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "block-checkbox";
      cb.checked = block.checked;
      cb.onchange = () => {
        block.checked = cb.checked;
        el.classList.toggle("checked", cb.checked);
        save();
      };
      body.appendChild(cb);
    }

    const content = document.createElement("div");
    content.className = "block-content";
    content.contentEditable = "true";
    content.textContent = block.text;
    content.dataset.placeholder = block.type === "p" ? "Type / for commands" : placeholderFor(block.type);
    body.appendChild(content);
  }

  el.append(handle, body);
  return el;
}

function placeholderFor(type) {
  const map = { h1: "Heading 1", h2: "Heading 2", h3: "Heading 3", bullet: "List item", numbered: "List item", todo: "To-do", quote: "Quote", code: "Code" };
  return map[type] || "";
}

function renderAll() {
  renderTree();
  renderBreadcrumb();
  renderEditor();
}

// ---------- Block helpers ----------

function blockIndex(id) {
  return activePage().blocks.findIndex((b) => b.id === id);
}

function blockElById(id) {
  return blocksEl.querySelector(`.block[data-id="${id}"]`);
}

function focusBlock(id, atEnd = true) {
  const el = blockElById(id);
  if (!el) return;
  const content = el.querySelector(".block-content");
  if (!content) { el.focus(); return; }
  content.focus();
  const range = document.createRange();
  range.selectNodeContents(content);
  range.collapse(!atEnd ? true : false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function caretAtStart(content) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return false;
  const range = sel.getRangeAt(0).cloneRange();
  range.setStart(content, 0);
  return range.toString().length === 0 && sel.isCollapsed;
}

function textAfterCaret(content) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return "";
  const range = sel.getRangeAt(0).cloneRange();
  range.setEnd(content, content.childNodes.length);
  return range.toString();
}

function insertBlockAfter(index, block) {
  activePage().blocks.splice(index + 1, 0, block);
  save();
  renderBlocks();
  focusBlock(block.id, false);
}

// ---------- Editor events (delegated) ----------

blocksEl.addEventListener("input", (e) => {
  const content = e.target.closest(".block-content");
  if (!content) return;
  const blockEl = content.closest(".block");
  const block = activePage().blocks[blockIndex(blockEl.dataset.id)];
  block.text = content.textContent;

  // markdown shortcuts (not inside code blocks)
  if (block.type !== "code") {
    for (const sc of MD_SHORTCUTS) {
      if (block.text.startsWith(sc.prefix)) {
        block.text = block.text.slice(sc.prefix.length);
        block.type = sc.type;
        if (sc.type === "divider") block.text = "";
        save();
        renderBlocks();
        focusBlock(block.id);
        return;
      }
    }
  }

  // slash menu
  if (block.text.startsWith("/")) {
    openSlashMenu(block, content, block.text.slice(1).toLowerCase());
  } else {
    closeSlashMenu();
  }
  save();
});

blocksEl.addEventListener("keydown", (e) => {
  // slash menu navigation steals arrows/enter/escape
  if (!slashMenuEl.hidden && handleSlashKeydown(e)) return;

  const content = e.target.closest(".block-content");
  const blockEl = e.target.closest(".block");
  if (!blockEl) return;
  const page = activePage();
  const idx = blockIndex(blockEl.dataset.id);
  const block = page.blocks[idx];

  // divider block (no content): Backspace/Delete removes it
  if (block.type === "divider" && (e.key === "Backspace" || e.key === "Delete")) {
    e.preventDefault();
    page.blocks.splice(idx, 1);
    if (page.blocks.length === 0) page.blocks.push(newBlock());
    save();
    renderBlocks();
    focusBlock(page.blocks[Math.max(0, idx - 1)].id);
    return;
  }
  if (!content) return;

  if (e.key === "Enter" && !e.shiftKey && block.type !== "code") {
    e.preventDefault();
    // split text at caret
    const after = textAfterCaret(content);
    block.text = content.textContent.slice(0, content.textContent.length - after.length);
    // empty list/todo/quote item -> turn back into paragraph instead of new item
    if (!block.text && !after && ["bullet", "numbered", "todo", "quote"].includes(block.type)) {
      block.type = "p";
      save();
      renderBlocks();
      focusBlock(block.id);
      return;
    }
    const keepType = ["bullet", "numbered", "todo"].includes(block.type) ? block.type : "p";
    insertBlockAfter(idx, newBlock(keepType, after));
    return;
  }

  if (e.key === "Backspace" && caretAtStart(content)) {
    if (block.type !== "p") {
      // first Backspace at start: demote to paragraph
      e.preventDefault();
      block.type = "p";
      block.checked = false;
      save();
      renderBlocks();
      focusBlock(block.id, false);
      return;
    }
    if (idx > 0) {
      e.preventDefault();
      const prev = page.blocks[idx - 1];
      if (prev.type === "divider") {
        page.blocks.splice(idx - 1, 1);
        save();
        renderBlocks();
        focusBlock(block.id, false);
        return;
      }
      const prevLen = prev.text.length;
      prev.text += block.text;
      page.blocks.splice(idx, 1);
      save();
      renderBlocks();
      // place caret at merge point
      const prevContent = blockElById(prev.id).querySelector(".block-content");
      prevContent.focus();
      const sel = window.getSelection();
      const range = document.createRange();
      const node = prevContent.firstChild || prevContent;
      range.setStart(node, Math.min(prevLen, node.textContent ? node.textContent.length : 0));
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
  }

  if (e.key === "ArrowUp" && idx > 0 && caretAtStart(content)) {
    e.preventDefault();
    focusBlock(page.blocks[idx - 1].id);
  }
  if (e.key === "ArrowDown" && idx < page.blocks.length - 1) {
    const after = textAfterCaret(content);
    if (after === "") {
      e.preventDefault();
      focusBlock(page.blocks[idx + 1].id, false);
    }
  }
});

// ---------- Slash menu ----------

let slashState = null; // { blockId, items, selected }

function openSlashMenu(block, content, query) {
  const items = BLOCK_TYPES.filter(
    (t) => !query || t.name.toLowerCase().includes(query) || t.keywords.includes(query)
  );
  slashState = { blockId: block.id, items, selected: 0 };

  slashMenuEl.innerHTML = "";
  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "slash-empty";
    empty.textContent = "No results";
    slashMenuEl.appendChild(empty);
  }
  items.forEach((t, i) => {
    const item = document.createElement("div");
    item.className = "slash-item" + (i === 0 ? " selected" : "");
    item.dataset.index = i;
    item.innerHTML = `
      <div class="slash-item-icon">${t.icon}</div>
      <div>
        <div class="slash-item-name">${t.name}</div>
        <div class="slash-item-desc">${t.desc}</div>
      </div>`;
    item.onmousedown = (e) => { e.preventDefault(); applySlashChoice(i); };
    slashMenuEl.appendChild(item);
  });

  const rect = content.getBoundingClientRect();
  slashMenuEl.hidden = false;
  const menuH = Math.min(320, slashMenuEl.scrollHeight);
  const below = rect.bottom + 6 + menuH < window.innerHeight;
  slashMenuEl.style.left = rect.left + "px";
  slashMenuEl.style.top = (below ? rect.bottom + 6 : rect.top - menuH - 6) + "px";
}

function closeSlashMenu() {
  slashMenuEl.hidden = true;
  slashState = null;
}

function handleSlashKeydown(e) {
  if (!slashState) return false;
  const { items } = slashState;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const dir = e.key === "ArrowDown" ? 1 : -1;
    slashState.selected = (slashState.selected + dir + items.length) % items.length;
    slashMenuEl.querySelectorAll(".slash-item").forEach((el, i) =>
      el.classList.toggle("selected", i === slashState.selected));
    return true;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    applySlashChoice(slashState.selected);
    return true;
  }
  if (e.key === "Escape") {
    e.preventDefault();
    closeSlashMenu();
    return true;
  }
  return false;
}

function applySlashChoice(index) {
  if (!slashState || !slashState.items[index]) { closeSlashMenu(); return; }
  const block = activePage().blocks[blockIndex(slashState.blockId)];
  block.type = slashState.items[index].type;
  block.text = "";
  closeSlashMenu();
  save();
  renderBlocks();
  if (block.type === "divider") {
    const idx = blockIndex(block.id);
    insertBlockAfter(idx, newBlock());
  } else {
    focusBlock(block.id);
  }
}

document.addEventListener("click", (e) => {
  if (!slashMenuEl.hidden && !slashMenuEl.contains(e.target)) closeSlashMenu();
});

// ---------- Drag & drop reordering ----------

let dragId = null;

blocksEl.addEventListener("dragstart", (e) => {
  const handle = e.target.closest(".block-handle");
  if (!handle) { e.preventDefault(); return; }
  const blockEl = handle.closest(".block");
  dragId = blockEl.dataset.id;
  blockEl.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", dragId);
  e.dataTransfer.setDragImage(blockEl, 0, 0);
});

blocksEl.addEventListener("dragover", (e) => {
  if (!dragId) return;
  e.preventDefault();
  const over = e.target.closest(".block");
  clearDropIndicators();
  if (!over || over.dataset.id === dragId) return;
  const rect = over.getBoundingClientRect();
  const before = e.clientY < rect.top + rect.height / 2;
  over.classList.add(before ? "drag-over-top" : "drag-over-bottom");
});

blocksEl.addEventListener("drop", (e) => {
  if (!dragId) return;
  e.preventDefault();
  const over = e.target.closest(".block");
  if (over && over.dataset.id !== dragId) {
    const page = activePage();
    const from = blockIndex(dragId);
    const [moved] = page.blocks.splice(from, 1);
    let to = blockIndex(over.dataset.id);
    const rect = over.getBoundingClientRect();
    if (e.clientY >= rect.top + rect.height / 2) to += 1;
    page.blocks.splice(to, 0, moved);
    save();
    renderBlocks();
  }
  endDrag();
});

blocksEl.addEventListener("dragend", endDrag);

function endDrag() {
  clearDropIndicators();
  const dragging = blocksEl.querySelector(".dragging");
  if (dragging) dragging.classList.remove("dragging");
  dragId = null;
}

function clearDropIndicators() {
  blocksEl.querySelectorAll(".drag-over-top, .drag-over-bottom")
    .forEach((el) => el.classList.remove("drag-over-top", "drag-over-bottom"));
}

// ---------- Title & icon ----------

titleEl.addEventListener("input", () => {
  const page = activePage();
  if (!page) return;
  page.title = titleEl.textContent;
  save();
  renderTree();
  renderBreadcrumb();
});

titleEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const page = activePage();
    if (page.blocks.length) focusBlock(page.blocks[0].id, false);
  }
});

iconEl.addEventListener("click", () => {
  const page = activePage();
  if (!page) return;
  const next = (PAGE_ICONS.indexOf(page.icon) + 1) % PAGE_ICONS.length;
  page.icon = PAGE_ICONS[next];
  save();
  renderAll();
});

// click below last block -> focus / append paragraph
editorScrollEl.addEventListener("click", (e) => {
  if (e.target !== editorScrollEl && e.target !== $("#editor")) return;
  const page = activePage();
  if (!page) return;
  const last = page.blocks[page.blocks.length - 1];
  if (last && last.type === "p" && !last.text) {
    focusBlock(last.id);
  } else {
    const block = newBlock();
    page.blocks.push(block);
    save();
    renderBlocks();
    focusBlock(block.id);
  }
});

// ---------- Sidebar controls ----------

$("#add-root-page").addEventListener("click", () => {
  const page = newPage();
  state.pages[page.id] = page;
  state.rootPages.push(page.id);
  openPage(page.id);
});

$("#empty-new-page").addEventListener("click", () => {
  const page = newPage();
  state.pages[page.id] = page;
  state.rootPages.push(page.id);
  openPage(page.id);
});

$("#search-input").addEventListener("input", (e) => {
  searchQuery = e.target.value.trim().toLowerCase();
  renderTree();
});

$("#sidebar-toggle").addEventListener("click", () => {
  $("#sidebar").classList.toggle("collapsed");
});

$("#theme-toggle").addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme();
  save();
});

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  $("#theme-toggle").textContent = state.theme === "dark" ? "☀️" : "🌙";
}

// ---------- Init ----------

load();
applyTheme();
renderAll();
