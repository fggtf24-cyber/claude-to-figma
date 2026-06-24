// code.js — сторона песочницы Figma (без доступа к DOM).
// Получает из UI готовое дерево узлов (tree) и строит из него слои Figma.
// Построение отказоустойчивое: ошибка на отдельном узле не валит весь импорт.

figma.showUI(__html__, { width: 380, height: 560, title: "Claude → Figma" });

let skipped = 0;
let firstError = "";
let substituted = new Set(); // шрифты, которых нет в системе → заменены на Inter

figma.ui.onmessage = async (msg) => {
  if (msg.type === "render") {
    skipped = 0;
    firstError = "";
    substituted = new Set();
    try {
      const root = await renderTree(msg.tree, msg.name || "Claude Design");
      figma.currentPage.appendChild(root);
      placeInRow(root); // справа от уже существующих фреймов, а не поверх них
      figma.currentPage.selection = [root];
      figma.viewport.scrollAndZoomIntoView([root]);
      const count = countNodes(msg.tree);
      figma.ui.postMessage({ type: "render-done", ok: true, id: msg.id, nodeCount: count, skipped, firstError });
      let note = "Импортировано из Claude ✓ (" + count + " слоёв)";
      if (skipped) note += ", пропущено " + skipped + (firstError ? ": " + firstError : "");
      if (substituted.size) note += " · нет шрифтов (заменены на Inter): " + [...substituted].join(", ");
      figma.notify(note);
    } catch (e) {
      const err = String((e && e.message) || e);
      figma.ui.postMessage({ type: "render-done", ok: false, id: msg.id, error: err });
      figma.notify("Ошибка импорта: " + err, { error: true });
    }
  } else if (msg.type === "resize") {
    figma.ui.resize(Math.max(320, msg.width | 0), Math.max(320, msg.height | 0));
  }
};

function countNodes(t) {
  let n = 1;
  if (t && t.children) for (const c of t.children) n += countNodes(c);
  return n;
}

// Кладём новый фрейм справа от уже существующих верхнеуровневых нод (ряд, без наложения).
function placeInRow(root) {
  const sibs = figma.currentPage.children.filter((n) => n !== root);
  if (sibs.length === 0) {
    root.x = Math.round(figma.viewport.center.x - root.width / 2);
    root.y = Math.round(figma.viewport.center.y - root.height / 2);
    return;
  }
  let maxRight = -Infinity, minTop = Infinity;
  for (const n of sibs) {
    maxRight = Math.max(maxRight, n.x + n.width);
    minTop = Math.min(minTop, n.y);
  }
  root.x = Math.round(maxRight + 80); // отступ между фреймами
  root.y = Math.round(isFinite(minTop) ? minTop : 0);
}

// Безопасное число: NaN/Infinity → значение по умолчанию (Math.max(1, NaN) === NaN!).
function num(v, d) {
  v = Number(v);
  return isFinite(v) ? v : d;
}

/* ----------------------------- построение узлов ----------------------------- */

async function renderTree(node, name) {
  const root = await buildNode(node);
  if (!root) throw new Error("пустое дерево");
  root.name = name;
  root.x = 0;
  root.y = 0;
  return root;
}

// Создаёт узел БЕЗ установки позиции — координаты x/y ставит родитель после appendChild,
// потому что в Figma x/y трактуются относительно текущего родителя.
async function buildNode(node) {
  if (!node) return null;
  if (node.type === "TEXT") return await buildText(node);
  if (node.type === "IMAGE") return buildImage(node);
  if (node.type === "SVG") return buildSvg(node);

  // Лист без детей → нативный шейп (или пропуск, если он невидим)
  if (!node.children || node.children.length === 0) {
    const hasFill = (node.bg && node.bg.a > 0) || (node.bytes && node.bytes.length);
    const hasBorder = node.border && node.border.w > 0 && node.border.color;
    if (!hasFill && !hasBorder) return null; // невидимый пустой блок — не засоряем холст
    return buildShape(node);
  }

  const f = figma.createFrame();
  f.name = node.name || "Frame";
  f.resize(Math.max(1, num(node.w, 1)), Math.max(1, num(node.h, 1)));
  f.clipsContent = false;
  f.layoutMode = "NONE";
  applyBox(f, node);

  if (node.children) {
    for (const ch of node.children) {
      try {
        const cn = await buildNode(ch);
        if (cn) {
          f.appendChild(cn);
          cn.x = num(ch.x, 0);
          cn.y = num(ch.y, 0);
        }
      } catch (e) {
        skipped++;
        if (!firstError) firstError = String((e && e.message) || e);
      }
    }
  }
  return f;
}

const loadedFonts = new Set();
let lastFontError = "";

async function tryLoad(family, style) {
  const key = family + "|" + style;
  if (loadedFonts.has(key)) return true;
  try {
    await figma.loadFontAsync({ family, style }); // правильный метод Figma API
    loadedFonts.add(key);
    return true;
  } catch (e) {
    lastFontError = String((e && e.message) || e);
    return false;
  }
}

// Пытается вернуть загруженный шрифт: запрошенный → Inter нужного начертания → Inter Regular.
async function ensureFont(family, style) {
  if (await tryLoad(family, style)) return { family, style };
  if (family && family !== "Inter") substituted.add(family);
  const interStyle = pickInterStyle(style);
  if (await tryLoad("Inter", interStyle)) return { family: "Inter", style: interStyle };
  if (await tryLoad("Inter", "Regular")) return { family: "Inter", style: "Regular" };
  throw new Error("шрифты недоступны: " + (lastFontError || "?"));
}

function pickInterStyle(style) {
  const s = (style || "").toLowerCase();
  if (s.includes("black")) return "Black";
  if (s.includes("extra bold") || s.includes("extrabold")) return "Extra Bold";
  if (s.includes("semi")) return "Semi Bold";
  if (s.includes("bold")) return "Bold";
  if (s.includes("medium")) return "Medium";
  if (s.includes("light")) return "Light";
  return "Regular";
}

async function buildText(node) {
  const font = node.font || {};
  const t = figma.createText();
  try {
    const fn = await ensureFont(font.family || "Inter", font.style || "Regular");
    t.fontName = fn;
    t.fontSize = Math.max(1, Math.round(num(font.size, 16)));
    t.textAlignHorizontal = mapAlign(font.align);
    t.textAlignVertical = node.valign === "center" ? "CENTER" : "TOP";
    t.characters = node.text || "";
    const lh = num(font.lineHeight, 0);
    if (lh > 0 && lh >= t.fontSize) t.lineHeight = { value: lh, unit: "PIXELS" };
    const ls = num(font.letter, 0);
    if (ls !== 0) t.letterSpacing = { value: ls, unit: "PIXELS" };
    if (font.color) t.fills = [solid(font.color)];

    // авторазмер: WIDTH_AND_HEIGHT (одна строка, тесно) | HEIGHT (многострока) | NONE
    const w = Math.max(1, num(node.w, 1));
    const h = Math.max(1, num(node.h, 1));
    if (node.autoResize === "WIDTH_AND_HEIGHT") {
      t.textAutoResize = "WIDTH_AND_HEIGHT";
    } else if (node.autoResize === "HEIGHT") {
      t.textAutoResize = "NONE";
      t.resize(w, h);
      t.textAutoResize = "HEIGHT"; // ширина фикс., высота растёт
    } else {
      t.textAutoResize = "NONE";
      t.resize(w, h);
    }

    t.name = (node.text || "Text").slice(0, 40);
    return t;
  } catch (e) {
    try { t.remove(); } catch (_) {} // не оставляем пустой текст на странице
    skipped++;
    if (!firstError) firstError = String((e && e.message) || e);
    return null;
  }
}

// Инлайновый SVG → редактируемые вектора Figma.
function buildSvg(node) {
  if (!node.svg) { skipped++; return null; }
  try {
    const n = figma.createNodeFromSvg(node.svg);
    const tw = Math.max(1, num(node.w, 1));
    if (n.width && Math.abs(n.width - tw) > 1) {
      try { n.rescale(tw / n.width); } catch (e) {}
    }
    n.name = "icon";
    return n;
  } catch (e) {
    skipped++;
    if (!firstError) firstError = "svg: " + String((e && e.message) || e);
    return null;
  }
}

function buildImage(node) {
  const r = figma.createRectangle();
  r.resize(Math.max(1, num(node.w, 1)), Math.max(1, num(node.h, 1)));
  applyRadius(r, node.radius);
  r.name = "Image";
  try {
    if (node.bytes && node.bytes.length) {
      const img = figma.createImage(new Uint8Array(node.bytes));
      r.fills = [{ type: "IMAGE", scaleMode: "FILL", imageHash: img.hash }];
    } else {
      r.fills = [solid({ r: 0.9, g: 0.9, b: 0.9, a: 1 })];
    }
  } catch (e) {
    r.fills = [solid({ r: 0.9, g: 0.9, b: 0.9, a: 1 })];
  }
  return r;
}

function paintFills(n) {
  const fills = [];
  if (n.bg && n.bg.a > 0) fills.push(solid(n.bg));
  if (n.bytes && n.bytes.length) {
    try {
      const img = figma.createImage(new Uint8Array(n.bytes));
      fills.push({ type: "IMAGE", scaleMode: "FILL", imageHash: img.hash });
    } catch (e) {}
  }
  return fills;
}

function applyStrokeAndOpacity(node, n) {
  if (n.border && n.border.w > 0 && n.border.color) {
    node.strokes = [solid(n.border.color)];
    node.strokeWeight = Math.max(0.1, num(n.border.w, 1));
    node.strokeAlign = "INSIDE";
  } else {
    node.strokes = [];
  }
  const op = num(n.opacity, 1);
  if (op < 1) node.opacity = Math.max(0, op);
}

function applyBox(f, n) {
  f.fills = paintFills(n);
  applyStrokeAndOpacity(f, n);
  applyRadius(f, n.radius);
}

// Листовой блок без детей → нативный шейп: Ellipse (если круглый) или Rectangle.
function buildShape(n) {
  const w = Math.max(1, num(n.w, 1));
  const h = Math.max(1, num(n.h, 1));
  const r = n.radius || [0, 0, 0, 0];
  const uniform = r[0] === r[1] && r[1] === r[2] && r[2] === r[3];
  const circular = uniform && Math.abs(w - h) <= 2 && r[0] >= Math.min(w, h) / 2 - 1;
  let s;
  if (circular) {
    s = figma.createEllipse();
    s.resize(w, h);
  } else {
    s = figma.createRectangle();
    s.resize(w, h);
    applyRadius(s, n.radius);
  }
  s.fills = paintFills(n);
  applyStrokeAndOpacity(s, n);
  s.name = n.name || "Shape";
  return s;
}

function applyRadius(node, radius) {
  if (!radius) return;
  try {
    node.topLeftRadius = Math.max(0, num(radius[0], 0));
    node.topRightRadius = Math.max(0, num(radius[1], 0));
    node.bottomRightRadius = Math.max(0, num(radius[2], 0));
    node.bottomLeftRadius = Math.max(0, num(radius[3], 0));
  } catch (e) {}
}

function solid(c) {
  return {
    type: "SOLID",
    color: { r: num(c.r, 0), g: num(c.g, 0), b: num(c.b, 0) },
    opacity: c.a == null ? 1 : num(c.a, 1),
  };
}

function mapAlign(a) {
  if (a === "center") return "CENTER";
  if (a === "right" || a === "end") return "RIGHT";
  if (a === "justify") return "JUSTIFIED";
  return "LEFT";
}
