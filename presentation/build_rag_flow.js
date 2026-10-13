// RAG flow, detailed: Lane A (build once) + Lane B (every question), joined at the pgvector database.
const path = require("path");
const pptxgen = require("pptxgenjs");

const ICONS = path.join(__dirname, "icons");
const OUT = process.argv[2] || path.join(__dirname, "content_rag.pptx");
const BLUE = "366B9D", SLATE = "44546A", ORANGE = "E77817", GREY = "A5A5A5";
const LIGHT = "EEEEF0", WHITE = "FFFFFF";
const HEAD = "Poppins", BODY = "Lato";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.title = "RAG flow: from documents to answer";
const S = pres.shapes;
const s = pres.addSlide();

const T = (text, o = {}) => s.addText(text, Object.assign({ isTextBox: true, margin: 0, fontFace: BODY, fontSize: 11, color: SLATE, valign: "top" }, o));
const rbox = (x, y, w, h, o = {}) => s.addShape(S.ROUNDED_RECTANGLE, {
  x, y, w, h, rectRadius: o.r ?? 0.09,
  fill: { color: o.fill ?? LIGHT, transparency: o.tr ?? 0 },
  line: o.line ? { color: o.line, width: o.lw ?? 1, dashType: o.dash ?? "solid" } : { type: "none" },
});
const icon = (name, x, y, d, color) => {
  s.addShape(S.OVAL, { x, y, w: d, h: d, fill: { color }, line: { type: "none" } });
  const k = d * 0.58;
  s.addImage({ path: path.join(ICONS, name + ".png"), x: x + (d - k) / 2, y: y + (d - k) / 2, w: k, h: k, altText: "" });
};
const seg = (x1, y1, x2, y2, o = {}) => {
  const dx = x2 - x1, dy = y2 - y1;
  s.addShape(S.LINE, {
    x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(dx), h: Math.abs(dy), flipH: dx < 0, flipV: dy < 0,
    line: { color: o.color ?? SLATE, width: o.w ?? 1.5, dashType: o.dash ?? "solid", endArrowType: o.head ? "triangle" : undefined },
  });
};

T("RAG flow: from documents to answer", { objectName: "SLIDE_TITLE", x: 0.4, y: 0.25, w: 11.6, h: 0.63 });

// kind: "db" (blue box), "gem" (orange tint, orange icon), "code" (grey box)
function step(x, y, w, h, kind, ic, title, desc) {
  const db = kind === "db", gem = kind === "gem";
  rbox(x, y, w, h, db ? { fill: BLUE } : gem ? { fill: ORANGE, tr: 88 } : { fill: LIGHT });
  icon(ic, x + w / 2 - 0.23, y + 0.12, 0.46, db || gem ? ORANGE : BLUE);
  T(title, { x: x + 0.1, y: y + 0.62, w: w - 0.2, h: 0.42, fontFace: HEAD, fontSize: 10.5, bold: true, color: db ? WHITE : BLUE, align: "center", valign: "middle" });
  T(desc, { x: x + 0.12, y: y + 1.1, w: w - 0.24, h: 0.52, fontSize: 10.5, color: db ? WHITE : SLATE, align: "center" });
}

// ================= Lane A: build once
T("A.  BUILD ONCE  ·  before the app starts  (build_kb.py)", { x: 0.5, y: 1.0, w: 8, h: 0.25, fontFace: HEAD, fontSize: 9, bold: true, charSpacing: 1.2 });
[["Gemini", ORANGE, 9.55], ["Database", BLUE, 10.6], ["Our code", GREY, 11.85]].forEach(([t, col, x]) => {
  s.addShape(S.OVAL, { x, y: 1.05, w: 0.15, h: 0.15, fill: { color: col }, line: { type: "none" } });
  T(t, { x: x + 0.22, y: 1.0, w: 0.9, h: 0.25, fontSize: 10.5, valign: "middle" });
});
const AW = 2.1, AG = 0.46, AY = 1.3, AH = 1.65;
[
  ["code", "doc", "1 · IMD PDFs", "4 official documents: heat wave, monsoon, cyclone terms, forecasting SOP"],
  ["code", "terminal", "2 · pypdf", "Reads the text of every page"],
  ["code", "split", "3 · Clean + chunk", "Our own code: cut by structure, recursive fallback for size"],
  ["gem", "hub", "4 · Gemini embeddings", "Each chunk becomes 768 numbers (document mode)"],
  ["db", "db", "5 · PostgreSQL + pgvector", "Chunks, vectors and page info: 219 rows"],
].forEach(([kind, ic, t, d], i) => {
  const x = 0.5 + i * (AW + AG);
  step(x, AY, AW, AH, kind, ic, t, d);
  if (i < 4) seg(x + AW + 0.03, AY + AH / 2, x + AW + AG - 0.03, AY + AH / 2, { head: true });
});

// ================= Lane B: every question
T("B.  EVERY QUESTION  ·  at run time", { x: 0.5, y: 3.45, w: 4, h: 0.25, fontFace: HEAD, fontSize: 9, bold: true, charSpacing: 1.2 });
const BW = 1.8, BG = 0.306, BY = 3.8, BH = 1.65;
const lane = [
  ["code", "terminal", "1 · User question", "Typed in the chat or sent to /ask"],
  ["gem", "hub", "2 · Embed the question", "Same Gemini model, query mode: 768 numbers"],
  ["db", "search", "3 · Cosine similarity", "pgvector compares with every chunk: top 3, best first"],
  ["code", "check", "4 · Score gate", "Best score below 0.6 means “not covered”"],
  ["gem", "bulb", "5 · Gemini answers", "Writes from only those chunks and cites their ids"],
  ["code", "doc", "6 · Answer + sources", "Invented citations are removed first"],
];
lane.forEach(([kind, ic, t, d], i) => {
  const x = 0.5 + i * (BW + BG);
  step(x, BY, BW, BH, kind, ic, t, d);
  if (i < 5) seg(x + BW + 0.03, BY + BH / 2, x + BW + BG - 0.03, BY + BH / 2, { head: true });
});

// link: the stored chunks (A5) are what the question is compared with (B3)
const aCx = 0.5 + 4 * (AW + AG) + AW / 2, bCx = 0.5 + 2 * (BW + BG) + BW / 2, LY = 3.3;
seg(aCx, AY + AH, aCx, LY, { color: BLUE, w: 2, dash: "dash" });
seg(aCx, LY, bCx, LY, { color: BLUE, w: 2, dash: "dash" });
seg(bCx, LY, bCx, BY - 0.02, { color: BLUE, w: 2, dash: "dash", head: true });
T("the stored chunks and vectors", { x: (aCx + bCx) / 2 - 1.6, y: LY - 0.29, w: 3.2, h: 0.24, fontSize: 10.5, italic: true, color: BLUE, align: "center" });

// bracket: which steps run inside the agent's search tool
const bx1 = 0.5 + (BW + BG), bx2 = 0.5 + 3 * (BW + BG) + BW, BR = 5.55;
seg(bx1, BR, bx2, BR, { color: GREY, w: 1.5 });
seg(bx1, BR - 0.1, bx1, BR, { color: GREY, w: 1.5 });
seg(bx2, BR - 0.1, bx2, BR, { color: GREY, w: 1.5 });
T("steps 2–4 run inside the search_imd_documents tool", { x: bx1, y: BR + 0.04, w: bx2 - bx1, h: 0.25, fontSize: 10.5, italic: true, align: "center" });

// key numbers: number and label side by side, the pair centred in each chip
[["219", "chunks", 0.62, 0.72], ["768", "numbers per vector", 0.62, 1.55], ["Top 3", "chunks, best first", 0.95, 1.45], ["0.6", "minimum score", 0.55, 1.35]].forEach(([big, label, bw, lw], i) => {
  const w = (12.33 - 3 * 0.25) / 4, x = 0.5 + i * (w + 0.25), gap = 0.12, x0 = x + (w - (bw + gap + lw)) / 2;
  rbox(x, 6.0, w, 0.68, { fill: LIGHT });
  T(big, { x: x0, y: 6.0, w: bw, h: 0.68, fontFace: HEAD, fontSize: 18, bold: true, color: BLUE, valign: "middle" });
  T(label, { x: x0 + bw + gap, y: 6.0, w: lw, h: 0.68, fontSize: 12, valign: "middle" });
});

s.addNotes("Two phases, joined at the database. A is done once, before the app starts: the IMD PDFs are read page by page with pypdf, which only extracts the text; my own code cleans it and cuts it into chunks, by structure first, with a recursive fallback for size; Gemini turns each chunk into 768 numbers in document mode; and the chunks, vectors and page info go into PostgreSQL with pgvector: 219 rows. B happens for every question, at run time, not at the same time as A: the question is embedded with the same Gemini model in query mode; pgvector compares it with every stored chunk by cosine similarity (score is one minus the cosine distance) and returns the top 3, already sorted best first; if the best score is below 0.6 the answer is 'not covered'; otherwise Gemini writes a short answer from only those chunks and cites their ids; the code removes any citation that was not really retrieved, and the user sees the answer plus its sources: document, page and link. In the agent, steps 2 to 4 run inside the search_imd_documents tool, and the agent's Gemini writes the final answer. Colours: orange is Gemini, blue is the database, grey is our own code.");

pres.writeFile({ fileName: OUT }).then(() => console.log("written", OUT));
