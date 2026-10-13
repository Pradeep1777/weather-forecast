// Weather Intelligence Assistant: learnings deck (10 slides, white design, .pptx)
const path = require("path");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require(process.env.SKILL_DIR + "/scripts/apply_theme.js");

const ICONS = path.join(__dirname, "icons");
const OUT = process.argv[2] || path.join(__dirname, "Weather_Intelligence_Assistant.pptx");

const THEME = {
  name: "Monsoon Bulletin",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "14213D",      // deep monsoon navy: text, dark panels
    lt1: "FFFFFF",      // white background
    dk2: "4A5568",      // slate: secondary text
    lt2: "F1F4F8",      // cool tint: cards
    accent1: "E07A1F",  // IMD orange: highlights
    accent2: "2B7BB9",  // sky blue: second accent
    accent3: "3E8E4F",  // IMD green: "done"
    accent4: "E2B93B",  // IMD yellow
    accent5: "C0392B",  // IMD red
    accent6: "B4530F",  // dark orange: small accent text on white
    hlink: "2B7BB9",
    folHlink: "6B5B95",
  },
};

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";              // 13.333 x 7.5 in
pres.title = "Weather Intelligence Assistant: Learnings";
pres.author = "Weather Intelligence Assistant";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const S = pres.shapes;
const MONO = "Consolas";
const HEAD = "+mj-lt";                      // theme heading font (Cambria)

// ---------------------------------------------------------------- layouts
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: C.background1 },
  margin: [0.6, 0.6, 0.6, 0.6],
  objects: [
    { text: { text: "Weather Intelligence Assistant", options: { x: 0.6, y: 7.02, w: 6, h: 0.28, fontSize: 10, color: C.text2, margin: 0 } } },
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.38, w: 12.13, h: 0.82, fontSize: 34, bold: true, color: C.text1, valign: "middle", margin: 0 }, text: "" } },
  ],
  slideNumber: { x: 12.2, y: 7.02, w: 0.53, h: 0.28, fontSize: 10, color: C.text2, align: "right" },
});
pres.defineSlideMaster({ title: "COVER", background: { color: C.background1 } });

// ---------------------------------------------------------------- helpers
const shadow = () => ({ type: "outer", color: "14213D", blur: 8, offset: 2, angle: 90, opacity: 0.10 });

function T(slide, text, o = {}) {
  slide.addText(text, Object.assign({ isTextBox: true, margin: 0, fontSize: 14, color: C.text1, valign: "top" }, o));
}
function box(slide, x, y, w, h, o = {}) {
  slide.addShape(S.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: o.r ?? 0.08,
    fill: { color: o.fill ?? C.background2, transparency: o.tr ?? 0 },
    line: o.line ? { color: o.line, width: o.lw ?? 1, dashType: o.dash ?? "solid", transparency: o.ltr ?? 0 } : { type: "none" },
    shadow: o.shadow ? shadow() : undefined,
    objectName: o.name,
  });
}
function icon(slide, name, x, y, d, color) {
  slide.addShape(S.OVAL, { x, y, w: d, h: d, fill: { color }, line: { type: "none" }, objectName: `icon-${name}` });
  const s = d * 0.58;
  slide.addImage({ path: path.join(ICONS, name + ".png"), x: x + (d - s) / 2, y: y + (d - s) / 2, w: s, h: s, altText: "" });
}
function arrow(slide, x1, y1, x2, y2, o = {}) {
  const dx = x2 - x1, dy = y2 - y1;
  slide.addShape(S.LINE, {
    x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(dx), h: Math.abs(dy),
    flipH: dx < 0, flipV: dy < 0,
    line: { color: o.color ?? C.text2, width: o.w ?? 1.5, dashType: o.dash ?? "solid", endArrowType: o.head === false ? undefined : "triangle" },
  });
}
function numberDot(slide, n, x, y, d, color) {
  slide.addShape(S.OVAL, { x, y, w: d, h: d, fill: { color }, line: { type: "none" } });
  T(slide, String(n), { x, y, w: d, h: d, fontSize: 15, bold: true, color: C.background1, align: "center", valign: "middle" });
}

// ================================================================ 1. COVER
pres.addSection({ title: "Introduction" });
{
  const s = pres.addSlide({ masterName: "COVER", sectionTitle: "Introduction" });
  T(s, "AI ENGINEERING CRASH COURSE  ·  FINAL PRESENTATION", { x: 0.75, y: 1.35, w: 7.2, h: 0.3, fontSize: 12, bold: true, color: C.accent6, charSpacing: 2 });
  T(s, "Weather Intelligence Assistant", { x: 0.75, y: 1.85, w: 7.0, h: 1.9, fontSize: 46, bold: true, fontFace: HEAD, color: C.text1, valign: "top" });
  T(s, "An assistant for Mumbai weather questions: a trained forecast model, answers grounded in official IMD documents, and an agent that picks its own tools.",
    { x: 0.75, y: 3.9, w: 6.7, h: 1.2, fontSize: 17, color: C.text2 });
  T(s, "[Your name]  ·  [Date]", { x: 0.75, y: 6.15, w: 6, h: 0.4, fontSize: 15, bold: true, color: C.text1 });

  box(s, 8.25, 0.6, 4.48, 6.3, { fill: C.text1, r: 0.12, name: "cover-panel" });
  const rows = [
    ["chart", "Forecast model", "Predicts the next hour's temperature"],
    ["search", "Document search (RAG)", "Answers from IMD documents, with sources"],
    ["hub", "Agent + tools", "Chooses live data, the model or the documents"],
  ];
  arrow(s, 9.2, 1.95, 9.2, 5.25, { color: C.background2, w: 1, dash: "dash", head: false });
  rows.forEach(([ic, title, sub], i) => {
    const y = 1.3 + i * 1.85;
    icon(s, ic, 8.75, y, 0.9, C.accent1);
    T(s, title, { x: 9.9, y: y + 0.08, w: 2.6, h: 0.35, fontSize: 16, bold: true, color: C.background1 });
    T(s, sub, { x: 9.9, y: y + 0.45, w: 2.6, h: 0.6, fontSize: 12, color: C.background2 });
  });
  s.addNotes("Introduce yourself. One sentence on the project: an assistant that answers Mumbai weather questions using live data, a model I trained, and official IMD documents. The talk has three parts: how it works, what I learned, and a live demo in the terminal.");
}

// ================================================================ 2. BRIEF & JOURNEY
{
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Introduction" });
  s.addText("From a brief to a working assistant", { placeholder: "title" });
  box(s, 0.6, 1.4, 12.13, 1.0, { fill: C.background2 });
  icon(s, "doc", 0.85, 1.57, 0.66, C.text1);
  T(s, [
    { text: "The brief:  ", options: { bold: true } },
    { text: "operations staff need quick, plain-language weather answers that come from a trained model and official documents, not from an LLM's guesses." },
  ], { x: 1.75, y: 1.5, w: 10.7, h: 0.8, fontSize: 16, valign: "middle" });

  const days = [
    ["chart", "Day 1", "Forecast model", "Gradient boosting trained on 45 years of hourly weather", "Done", C.accent3],
    ["search", "Day 2", "RAG + /ask", "IMD documents made searchable, one API endpoint", "Done", C.accent3],
    ["hub", "Day 3", "Agent", "LangGraph agent that picks between three tools", "Done", C.accent3],
    ["bulb", "Day 4", "Fine-tuning", "Severity classifier compared with a zero-shot prompt", "Next", C.accent1],
    ["box", "Day 5", "Ship", "Docker setup and basic MLflow tracking", "Done · tests next", C.accent3],
  ];
  arrow(s, 1.4, 3.35, 11.93, 3.35, { color: C.text2, w: 1.5, head: false });
  days.forEach(([ic, day, title, desc, status, col], i) => {
    const cx = 1.4 + i * 2.633;
    icon(s, ic, cx - 0.4, 2.95, 0.8, i === 3 ? C.accent1 : C.text1);
    T(s, day.toUpperCase(), { x: cx - 1.15, y: 3.95, w: 2.3, h: 0.28, fontSize: 11, bold: true, color: C.accent6, align: "center", charSpacing: 1 });
    T(s, title, { x: cx - 1.15, y: 4.25, w: 2.3, h: 0.38, fontSize: 17, bold: true, align: "center" });
    T(s, desc, { x: cx - 1.15, y: 4.7, w: 2.3, h: 0.9, fontSize: 13, color: C.text2, align: "center" });
    s.addShape(S.OVAL, { x: cx - 0.62, y: 5.49, w: 0.16, h: 0.16, fill: { color: col }, line: { type: "none" } });
    T(s, status, { x: cx - 0.4, y: 5.4, w: 1.6, h: 0.34, fontSize: 12, bold: true, color: C.text1, valign: "middle" });
  });
  s.addNotes("The PRD asked for a working assistant built end to end, solo, over five days. Days 1 to 3 and the Docker part of Day 5 are done. Fine-tuning (Day 4) and the automated tests (Day 5) are the next steps; I chose to go deeper on the agent and on making everything reproducible first.");
}

// ================================================================ 3. ARCHITECTURE
pres.addSection({ title: "How it works" });
{
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "How it works" });
  s.addText("Architecture: one agent, three tools", { placeholder: "title" });
  const lab = (t, x, w) => T(s, t, { x, y: 1.32, w, h: 0.26, fontSize: 11, bold: true, color: C.text2, charSpacing: 1.5 });
  lab("CLIENTS", 0.6, 2.2); lab("SERVICE  (DOCKER)", 3.35, 4); lab("TOOLS", 8.15, 3);

  // clients
  const client = (ic, title, sub, y, h) => {
    box(s, 0.6, y, 2.25, h, { fill: C.background1, line: C.text2, ltr: 60, shadow: true });
    icon(s, ic, 0.75, y + (h - 0.5) / 2, 0.5, C.accent2);
    T(s, title, { x: 1.35, y: y + 0.17, w: 1.45, h: 0.3, fontSize: 13, bold: true });
    T(s, sub, { x: 1.35, y: y + 0.47, w: 1.45, h: h - 0.55, fontSize: 11, color: C.text2 });
  };
  client("api", "HTTP client", "POST /ask, /docs page", 1.95, 0.95);
  client("terminal", "Terminal chat", "chat.py, remembers the chat", 3.45, 1.05);

  // service container
  box(s, 3.35, 1.65, 4.2, 3.4, { fill: C.background1, line: C.text2, dash: "dash", ltr: 30, r: 0.06 });
  box(s, 3.6, 1.95, 3.7, 0.95, { fill: C.background1, line: C.text1, lw: 1.25, shadow: true });
  icon(s, "check", 3.78, 2.17, 0.52, C.text1);
  T(s, "FastAPI  /ask", { x: 4.45, y: 2.07, w: 2.75, h: 0.3, fontSize: 14, bold: true });
  T(s, "Checks the input, returns clear errors", { x: 4.45, y: 2.4, w: 2.75, h: 0.4, fontSize: 11, color: C.text2 });
  box(s, 3.6, 3.35, 3.7, 1.25, { fill: C.text1, shadow: true });
  icon(s, "hub", 3.78, 3.68, 0.6, C.accent1);
  T(s, "LangGraph agent", { x: 4.55, y: 3.52, w: 2.65, h: 0.33, fontSize: 15, bold: true, color: C.background1 });
  T(s, "Gemini reads the question and decides which tools to call", { x: 4.55, y: 3.88, w: 2.65, h: 0.62, fontSize: 11, color: C.background2 });
  T(s, "LLM: Gemini 3.5 Flash-Lite, with a backup model", { x: 3.6, y: 4.68, w: 3.7, h: 0.28, fontSize: 10, color: C.text2 });

  arrow(s, 2.85, 2.425, 3.6, 2.425, { color: C.text2 });
  arrow(s, 2.85, 3.975, 3.6, 3.975, { color: C.text2 });
  arrow(s, 5.45, 2.9, 5.45, 3.35, { color: C.text2 });

  // tools
  const tools = [
    ["cloud", "Live weather", "get_live_weather", "Open-Meteo forecast API"],
    ["chart", "Forecast model", "predict_next_hour_temperature", "Trained model file (.joblib)"],
    ["search", "IMD document search", "search_imd_documents", "PostgreSQL + pgvector (Docker)"],
  ];
  arrow(s, 7.3, 3.975, 7.85, 3.975, { color: C.text2, head: false });
  arrow(s, 7.85, 2.15, 7.85, 4.75, { color: C.text2, head: false });
  tools.forEach(([ic, title, fn, src], i) => {
    const y = 1.65 + i * 1.3;
    arrow(s, 7.85, y + 0.5, 8.15, y + 0.5, { color: C.text2 });
    box(s, 8.15, y, 4.58, 1.0, { fill: C.background1, line: C.text2, ltr: 60, shadow: true });
    icon(s, ic, 8.32, y + 0.22, 0.56, C.accent1);
    T(s, title, { x: 9.05, y: y + 0.12, w: 3.55, h: 0.28, fontSize: 14, bold: true });
    T(s, fn, { x: 9.05, y: y + 0.42, w: 3.55, h: 0.24, fontSize: 11, fontFace: MONO, color: C.accent2 });
    T(s, src, { x: 9.05, y: y + 0.68, w: 3.55, h: 0.24, fontSize: 11, color: C.text2 });
  });

  // build-time band
  T(s, "BUILT ONCE BY SCRIPTS, BEFORE THE APP STARTS", { x: 0.6, y: 5.42, w: 8, h: 0.26, fontSize: 11, bold: true, color: C.text2, charSpacing: 1.5 });
  const pill = (t, x, y, mono) => {
    box(s, x, y, 2.0, 0.42, { fill: C.background2, r: 0.2 });
    T(s, t, { x, y, w: 2.0, h: 0.42, fontSize: 11, align: "center", valign: "middle", fontFace: mono ? MONO : undefined });
  };
  const row = (items, y, note) => {
    items.forEach(([t, mono], i) => {
      const x = 0.6 + i * 2.45;
      pill(t, x, y, mono);
      if (i < items.length - 1) arrow(s, x + 2.0, y + 0.21, x + 2.45, y + 0.21, { color: C.text2, w: 1.25 });
    });
    T(s, note, { x: 10.45, y, w: 2.28, h: 0.42, fontSize: 11, italic: true, color: C.text2, valign: "middle" });
  };
  row([["Open-Meteo archive"], ["download_weather.py", true], ["train.py", true], ["model file"]], 5.78, "feeds the forecast tool");
  row([["IMD PDFs"], ["build_kb.py", true], ["pgvector"]], 6.33, "feeds the IMD search tool");
  s.addNotes("Left to right: a client sends a question. In Docker, FastAPI checks the input and passes it to the LangGraph agent. Gemini, inside the agent, decides which of the three tools it needs: live weather from Open-Meteo, my trained forecast model, or a search over the IMD documents stored in pgvector. The bottom row is what runs once, before the app starts: the scripts that train the model and build the knowledge base. The terminal chat calls the agent directly and keeps the conversation.");
}

// ================================================================ 4. FORECAST MODEL PIPELINE
{
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "How it works" });
  s.addText("Forecast model: raw data to a live tool", { placeholder: "title" });
  const steps = [
    ["cloud", "Download", "Open-Meteo Archive API: 45 years of hourly ERA5 weather for Mumbai"],
    ["check", "Clean", "Remove duplicate hours, fill short gaps, fix impossible values such as sunlight at night"],
    ["thermo", "Features", "Six simple inputs: temperature now, 3 hours ago, 24-hour average, sunlight, rain, hour"],
    ["split", "Split by time", "Train 1980–2021, check 2022–23, final test 2024–25. Never shuffled."],
    ["chart", "Train & compare", "Gradient boosting (scikit-learn) against the lazy guess: next hour = now"],
    ["hub", "Serve", "The saved model becomes the agent's forecast tool, using the same feature code"],
  ];
  steps.forEach(([ic, title, desc], i) => {
    const x = 0.6 + i * 2.05;
    box(s, x, 1.5, 1.86, 3.45, { fill: C.background2 });
    icon(s, ic, x + 0.2, 1.72, 0.7, i === 4 ? C.accent1 : C.text1);
    if (i < steps.length - 1) arrow(s, x + 0.98, 2.07, x + 2.17, 2.07, { color: C.text2, w: 1.25 });
    T(s, `STEP ${i + 1}`, { x: x + 0.2, y: 2.62, w: 1.5, h: 0.24, fontSize: 10, bold: true, color: C.accent6, charSpacing: 1 });
    T(s, title, { x: x + 0.2, y: 2.88, w: 1.55, h: 0.36, fontSize: 15, bold: true });
    T(s, desc, { x: x + 0.2, y: 3.3, w: 1.5, h: 1.55, fontSize: 12, color: C.text2 });
  });
  box(s, 0.6, 5.3, 12.13, 1.2, { fill: C.accent1, tr: 87 });
  icon(s, "bulb", 0.85, 5.55, 0.7, C.accent1);
  T(s, [
    { text: "What I learned:  ", options: { bold: true } },
    { text: "always compare with a simple baseline, and split time-series data by time. A random split would let the model peek at the future." },
  ], { x: 1.8, y: 5.4, w: 10.7, h: 1.0, fontSize: 16, valign: "middle" });
  s.addNotes("Day 1, step by step. I downloaded 45 years of hourly ERA5 data for Mumbai through the Open-Meteo Archive API, cleaned it, and built six simple features. The split is by time: the model never sees the future during training. I compared gradient boosting from scikit-learn with the simplest possible forecast, 'the next hour will be like now', and the model clearly beat it. The saved model is the agent's forecast tool, and both training and the tool use one shared feature file so they always compute the inputs the same way.");
}

// ================================================================ 5. RAG CHUNKING
{
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "How it works" });
  s.addText("RAG: turning IMD documents into chunks", { placeholder: "title" });
  const stage = (n, ic, title, sub, y, h, style) => {
    const dark = style === "dark", warm = style === "warm";
    box(s, 0.6, y, 7.0, h, { fill: dark ? C.text1 : warm ? C.accent1 : C.background2, tr: warm ? 87 : 0 });
    icon(s, ic, 0.82, y + (h - 0.6) / 2, 0.6, dark || warm ? C.accent1 : C.text1);
    T(s, `${n}  ·  ${title}`, { x: 1.65, y: y + 0.13, w: 5.8, h: 0.32, fontSize: 15, bold: true, color: dark ? C.background1 : C.text1 });
    T(s, sub, { x: 1.65, y: y + 0.47, w: 5.8, h: h - 0.55, fontSize: 12, color: dark ? C.background2 : C.text2 });
  };
  stage(1, "doc", "Clean the PDF text", "Remove page headers and links, re-join broken words, fix °C symbols", 1.45, 0.92);
  arrow(s, 4.1, 2.37, 4.1, 2.67);
  stage(2, "split", "Cut by structure (main strategy)", "Each FAQ question, each SOP section number, small groups of glossary terms", 2.67, 0.92, "dark");
  arrow(s, 4.1, 3.59, 4.1, 3.89);
  stage(3, "check", "Recursive size check (fallback)", "Too long: split by paragraph, then by sentence, keeping the title and one sentence of overlap. Too short: merge with the neighbour.", 3.89, 1.15, "warm");
  arrow(s, 4.1, 5.04, 4.1, 5.34);
  stage(4, "db", "Embed and store", "Gemini embeddings, saved in PostgreSQL + pgvector: 219 chunks", 5.34, 0.92);

  T(s, "Why this strategy", { x: 8.0, y: 1.45, w: 4.73, h: 0.4, fontSize: 18, bold: true });
  const why = [
    "One chunk holds one complete answer, such as one FAQ question or one SOP section",
    "Search returns whole facts, not half sentences cut at a random length",
    "Every part keeps its title, so a split chunk still knows its topic",
  ];
  why.forEach((t, i) => {
    const y = 2.0 + i * 0.82;
    icon(s, "check", 8.0, y + 0.02, 0.36, C.accent3);
    T(s, t, { x: 8.5, y, w: 4.23, h: 0.72, fontSize: 13, color: C.text1 });
  });
  box(s, 8.0, 4.55, 4.73, 1.71, { fill: C.background2 });
  T(s, "EXAMPLE CHUNK  ·  heat_faq-004", { x: 8.2, y: 4.68, w: 4.4, h: 0.26, fontSize: 10, bold: true, color: C.accent6, charSpacing: 1 });
  T(s, "Q. What is a criterion for describing Heat Wave for coastal stations?\nWhen maximum temperature departure is 4.5°C or more from normal, Heat Wave may be described provided actual maximum temperature is 37°C or more.",
    { x: 8.2, y: 5.0, w: 4.38, h: 1.18, fontSize: 11, fontFace: MONO, color: C.text1 });
  s.addNotes("Most of the RAG work was preparing the documents. First I cleaned the PDF text. The main strategy is structure-based: I cut each document where it naturally starts a new topic, so one chunk is one FAQ question or one SOP section. A recursive fallback handles sizes: a section that is too long is split by paragraph, then by sentence, and every part keeps its title; a tiny piece is merged with its neighbour. Then each chunk is embedded with Gemini and stored in pgvector. The example on the right is a real chunk: one complete question and answer.");
}

// ================================================================ 6. AGENT & ORCHESTRATION
{
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "How it works" });
  s.addText("Agent: one orchestrator, three tools", { placeholder: "title" });
  box(s, 0.6, 1.38, 5.4, 0.5, { fill: C.background2, r: 0.25 });
  T(s, [{ text: "Question:  ", options: { bold: true } }, { text: "Is it a heat wave in Mumbai now?" }], { x: 0.85, y: 1.38, w: 5.0, h: 0.5, fontSize: 14, valign: "middle" });
  arrow(s, 4.4, 1.88, 4.4, 2.5, { color: C.text2 });

  box(s, 0.6, 2.1, 7.6, 1.75, { fill: C.background1, line: C.text2, dash: "dash", ltr: 30, r: 0.06 });
  T(s, "LANGGRAPH ORCHESTRATOR  ·  RUNS THE LOOP", { x: 0.8, y: 2.18, w: 4, h: 0.26, fontSize: 10, bold: true, color: C.text2, charSpacing: 1 });
  box(s, 2.3, 2.5, 4.2, 1.1, { fill: C.text1, shadow: true });
  icon(s, "hub", 2.48, 2.73, 0.64, C.accent1);
  T(s, "Main agent  (Gemini)", { x: 3.3, y: 2.62, w: 3.1, h: 0.32, fontSize: 15, bold: true, color: C.background1 });
  T(s, "Reads the question and rules, decides which tools to call", { x: 3.3, y: 2.97, w: 3.1, h: 0.55, fontSize: 11, color: C.background2 });

  const tools = [["cloud", "Live weather", "Open-Meteo API"], ["chart", "Forecast model", "My trained model"], ["search", "IMD search", "pgvector"]];
  const ax = [3.0, 4.4, 5.8];
  tools.forEach(([ic, title, src], i) => {
    const x = 0.6 + i * 2.625, tc = x + 1.175;
    arrow(s, ax[i] - 0.12, 3.6, tc - 0.15, 4.55, { color: C.accent1, w: 1.75 });
    arrow(s, tc + 0.15, 4.55, ax[i] + 0.12, 3.6, { color: C.accent2, w: 1.75 });
    box(s, x, 4.55, 2.35, 1.0, { fill: C.background1, line: C.text2, ltr: 60, shadow: true });
    icon(s, ic, x + 0.15, 4.77, 0.56, C.text1);
    T(s, title, { x: x + 0.82, y: 4.75, w: 1.45, h: 0.3, fontSize: 13, bold: true });
    T(s, src, { x: x + 0.82, y: 5.07, w: 1.45, h: 0.3, fontSize: 11, color: C.text2 });
  });
  // legend + final step
  arrow(s, 0.6, 5.86, 1.1, 5.86, { color: C.accent1, w: 1.75 });
  T(s, "calls a tool", { x: 1.2, y: 5.73, w: 1.5, h: 0.26, fontSize: 11, color: C.text2 });
  arrow(s, 2.7, 5.86, 3.2, 5.86, { color: C.accent2, w: 1.75 });
  T(s, "returns the result", { x: 3.3, y: 5.73, w: 2, h: 0.26, fontSize: 11, color: C.text2 });
  box(s, 0.6, 6.15, 7.6, 0.55, { fill: C.background2, r: 0.1 });
  T(s, "Then the agent writes the answer and cites the IMD sources it used", { x: 0.8, y: 6.15, w: 7.3, h: 0.55, fontSize: 13, valign: "middle" });

  const cards = [
    ["search", "Descriptions decide routing", "Gemini chooses a tool from its name and description, so I wrote each one with care."],
    ["doc", "A short rulebook", "Rules say when to use each tool, to cite sources, and to say when data is missing."],
    ["lock", "Safe limits", "At most 8 steps per question. Greetings and other cities need no tool at all."],
  ];
  cards.forEach(([ic, title, text], i) => {
    const y = 1.38 + i * 1.8;
    box(s, 8.55, y, 4.18, 1.6, { fill: C.background2 });
    icon(s, ic, 8.75, y + 0.2, 0.55, C.accent1);
    T(s, title, { x: 9.45, y: y + 0.22, w: 3.15, h: 0.32, fontSize: 15, bold: true });
    T(s, text, { x: 9.45, y: y + 0.62, w: 3.15, h: 0.9, fontSize: 14, color: C.text2 });
  });
  s.addNotes("This is the orchestration. LangGraph runs the loop; inside it, the main agent is Gemini. It reads the question and a short rulebook, then calls the tools it needs. Each tool returns its result to the agent, and the loop repeats until the agent can answer. Then it writes the answer and cites its sources. What I learned: the tool descriptions are what Gemini uses to choose, the rulebook controls behaviour, and a step limit keeps it safe. Questions that need no tool, like greetings or other cities, are answered directly.");
}

// ================================================================ 7. ONE QUESTION STEP BY STEP
{
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "How it works" });
  s.addText("One question, step by step", { placeholder: "title" });
  box(s, 0.6, 1.38, 6.9, 0.62, { fill: C.text1, r: 0.31 });
  T(s, "“Is it a heat wave in Mumbai right now?”", { x: 0.85, y: 1.38, w: 6.5, h: 0.62, fontSize: 17, bold: true, color: C.background1, valign: "middle" });
  const steps = [
    "/ask checks the input. Empty or too long: a friendly message, no crash.",
    "The agent reads its rules and decides it needs two tools.",
    "The tools run: live weather (now and today's maximum) and IMD search (the heat wave rule).",
    "Gemini writes a short answer and cites the IMD chunk it used.",
    "Citations are checked: only chunks the search really returned are kept.",
  ];
  arrow(s, 0.87, 2.5, 0.87, 5.8, { color: C.text2, w: 1, head: false, dash: "dash" });
  steps.forEach((t, i) => {
    const y = 2.25 + i * 0.82;
    numberDot(s, i + 1, 0.62, y, 0.5, i === 2 ? C.accent1 : C.text1);
    T(s, t, { x: 1.35, y: y - 0.04, w: 6.1, h: 0.62, fontSize: 14, valign: "middle" });
  });
  box(s, 7.9, 1.38, 4.83, 5.0, { fill: C.background2 });
  T(s, "THE REAL ANSWER, FROM THE RUNNING APP", { x: 8.15, y: 1.58, w: 4.4, h: 0.26, fontSize: 10, bold: true, color: C.accent6, charSpacing: 1 });
  T(s, "“Mumbai's current temperature is 35.6°C with a maximum of 36°C expected today. According to IMD criteria for coastal stations, a heat wave requires an actual maximum temperature of 37°C or more alongside a temperature departure of 4.5°C or more from normal [heat_faq-004]. Therefore, it is not currently a heat wave.”",
    { x: 8.15, y: 1.95, w: 4.35, h: 3.0, fontSize: 15, italic: true });
  T(s, [
    { text: "tools_used: get_live_weather, search_imd_documents", options: { breakLine: true } },
    { text: "source: IMD FAQ on Heat Wave, page 2" },
  ], { x: 8.15, y: 4.85, w: 4.4, h: 0.6, fontSize: 10, fontFace: MONO, color: C.text2 });
  T(s, "Live numbers change with the weather.", { x: 8.15, y: 5.75, w: 4.4, h: 0.3, fontSize: 11, italic: true, color: C.text2 });
  s.addNotes("A real example. The question needs two things: today's live temperature, and the official IMD rule for coastal stations. The agent asks for both tools at once, then combines them: Mumbai is below 37 degrees, so it is not a heat wave. The answer cites chunk heat_faq-004, and the code checks that this chunk was really returned by the search, so the model cannot invent a source.");
}

// ================================================================ 8. SHIPPING, MLOPS, LESSONS
pres.addSection({ title: "Shipping and MLOps" });
{
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Shipping and MLOps" });
  s.addText("Shipping it: Docker, MLOps and lessons", { placeholder: "title" });
  const cols = [
    ["box", "Shipping", C.text1, null, [
      "One command starts everything: docker compose up",
      "Bad input gets a clear message; outages are logged",
      "Secrets stay in .env, never in git",
    ]],
    ["flask", "MLOps so far", C.accent1, "warm", [
      "Scripts rebuild the model and the knowledge base",
      "Pinned package versions",
      "One shared feature file for training and live use",
      "Model saved with its features and library version",
      "MLflow: basic tracking of each training run (settings, scores, model)",
    ]],
    ["warn", "Problems that taught me", C.text1, null, [
      "A Gemini model was retired: keep a backup model",
      "Free-tier rate limits: wait and retry",
      "Company laptop blocked a library: pin versions that work",
      "Hidden PDF characters: compare outputs after every change",
    ]],
  ];
  cols.forEach(([ic, title, iconCol, style, items], i) => {
    const x = 0.6 + i * 4.115;
    box(s, x, 1.45, 3.9, 4.75, { fill: style === "warm" ? C.accent1 : C.background2, tr: style === "warm" ? 87 : 0 });
    icon(s, ic, x + 0.25, 1.68, 0.62, iconCol);
    T(s, title, { x: x + 1.05, y: 1.68, w: 2.7, h: 0.62, fontSize: 17, bold: true, valign: "middle" });
    s.addText(items.map((t, j) => ({ text: t, options: { bullet: { indent: 14 }, breakLine: j < items.length - 1 } })),
      { isTextBox: true, x: x + 0.25, y: 2.6, w: 3.45, h: 3.45, fontSize: 15, color: C.text1, valign: "top", margin: 0, paraSpaceAfter: 14 });
  });
  s.addNotes("Shipping: one Docker command starts the database and the API, bad input gets a friendly message, and secrets stay in the .env file. MLOps so far is basic but real: scripts rebuild everything, versions are pinned, training and the live tool share one feature file, and MLflow tracks each training run with its settings and scores. Right: the problems that taught me the most, each with the habit it gave me.");
}

// ================================================================ 9. LIVE DEMO
pres.addSection({ title: "Demo" });
{
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Demo" });
  s.addText("Live demo: the agent picks its tools", { placeholder: "title" });
  box(s, 0.6, 1.4, 6.9, 4.95, { fill: C.text1, r: 0.1, shadow: true });
  [C.accent5, C.accent4, C.accent3].forEach((col, i) =>
    s.addShape(S.OVAL, { x: 0.85 + i * 0.28, y: 1.62, w: 0.16, h: 0.16, fill: { color: col }, line: { type: "none" } }));
  const lines = [
    ["$ ", "docker compose up -d --wait", "cmd"],
    ["$ ", "docker exec -it weather-api python chat.py", "cmd"],
    ["", " ", "cmd"],
    ["You: ", "How hot is it in Mumbai right now?", "cmd"],
    ["", "     tools: get_live_weather", "tool"],
    ["You: ", "And in one hour?", "cmd"],
    ["", "     tools: predict_next_hour_temperature", "tool"],
    ["You: ", "Is that a heat wave by IMD rules?", "cmd"],
    ["", "     tools: get_live_weather, search_imd_documents", "tool"],
    ["You: ", "What's the weather in Delhi?", "cmd"],
    ["", "     tools: none", "tool"],
  ];
  const runs = [];
  lines.forEach(([p, t, kind], i) => {
    const last = i === lines.length - 1;
    const tool = kind === "tool";
    if (p) runs.push({ text: p, options: { color: C.accent1, bold: true, fontSize: 14 } });
    runs.push({ text: t, options: { color: C.background2, fontSize: tool ? 12 : 14, breakLine: !last, transparency: tool ? 35 : 0 } });
  });
  s.addText(runs, { isTextBox: true, x: 0.9, y: 2.0, w: 6.4, h: 4.15, fontSize: 14, fontFace: MONO, valign: "top", margin: 0, paraSpaceAfter: 3 });

  const hdr = (t) => ({ text: t, options: { bold: true, color: C.text1, fill: { color: C.background2 } } });
  const mono = (t) => ({ text: t, options: { fontFace: MONO, color: C.accent2 } });
  s.addTable([
    [hdr("Question type"), hdr("Tool the agent picks")],
    [{ text: "Current weather" }, mono("get_live_weather")],
    [{ text: "Next-hour temperature" }, mono("predict_next_hour_temperature")],
    [{ text: "IMD rules or definitions" }, mono("search_imd_documents")],
    [{ text: "Heat wave right now?" }, { text: "live weather + IMD search" }],
    [{ text: "Other city or greeting" }, { text: "no tool" }],
  ], { x: 7.85, y: 1.4, w: 4.88, colW: [1.78, 3.1], fontSize: 12, color: C.text1, valign: "middle", rowH: 0.48,
       border: { type: "solid", pt: 0.75, color: "D5DCE5" }, margin: [0.06, 0.1, 0.06, 0.1] });
  box(s, 7.85, 4.75, 4.88, 1.6, { fill: C.accent1, tr: 87 });
  T(s, "What to watch for", { x: 8.05, y: 4.88, w: 4.5, h: 0.3, fontSize: 14, bold: true });
  s.addText([
    { text: "The grey tools: line under each answer", options: { bullet: { indent: 14 }, breakLine: true } },
    { text: "IMD sources shown in [brackets]", options: { bullet: { indent: 14 }, breakLine: true } },
    { text: "Follow-up questions are remembered", options: { bullet: { indent: 14 } } },
  ], { isTextBox: true, x: 8.05, y: 5.25, w: 4.5, h: 1.0, fontSize: 13, color: C.text1, valign: "top", margin: 0, paraSpaceAfter: 4 });
  s.addNotes("Demo in the terminal. 1) Start everything with one command; --wait returns when both containers are healthy. 2) Open the chat inside the API container. Ask: current temperature (live weather tool), then 'and in one hour?' (the model tool, and it remembers the topic), then 'is that a heat wave?' (two tools plus an IMD source), then Delhi (no tool, polite answer). Point at the grey tools line each time. If the network is slow, use the table on this slide to explain the routing.");
}

// ================================================================ 10. NEXT & THANK YOU
pres.addSection({ title: "Close" });
{
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Close" });
  s.addText("What's next", { placeholder: "title" });
  const next = [
    ["bulb", "Fine-tuning (F5)", "A small text classifier for weather severity, compared with a zero-shot prompt"],
    ["check", "Automated tests (F7)", "pytest for /ask: a valid question, empty input and a service outage"],
    ["chart", "Monitoring", "Save each live forecast and check it against what really happened"],
  ];
  next.forEach(([ic, title, text], i) => {
    const y = 1.5 + i * 1.75;
    box(s, 0.6, y, 7.3, 1.5, { fill: C.background2 });
    icon(s, ic, 0.85, y + 0.38, 0.74, C.accent1);
    T(s, title, { x: 1.85, y: y + 0.28, w: 5.9, h: 0.36, fontSize: 17, bold: true });
    T(s, text, { x: 1.85, y: y + 0.7, w: 5.9, h: 0.65, fontSize: 14, color: C.text2 });
  });
  box(s, 8.3, 1.5, 4.43, 5.0, { fill: C.text1, r: 0.12 });
  T(s, "KEY TAKEAWAY", { x: 8.65, y: 1.85, w: 3.8, h: 0.28, fontSize: 11, bold: true, color: C.accent1, charSpacing: 1.5 });
  T(s, "Most of an AI system is data preparation, retrieval and careful wiring. The LLM call is the smallest part.",
    { x: 8.65, y: 2.25, w: 3.75, h: 2.4, fontSize: 21, fontFace: HEAD, color: C.background1 });
  T(s, "Thank you", { x: 8.65, y: 5.05, w: 3.8, h: 0.5, fontSize: 28, bold: true, fontFace: HEAD, color: C.background1 });
  T(s, "Questions?", { x: 8.65, y: 5.6, w: 3.8, h: 0.4, fontSize: 16, color: C.background2 });
  s.addNotes("Next steps: fine-tuning a small severity classifier and comparing it with a zero-shot prompt, automated tests for /ask, and monitoring the live forecasts. Takeaway: building every layer myself showed that most of the work is preparing data, retrieval and wiring the parts together; calling the LLM is the easy part. Thank you, happy to take questions.");
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("written", OUT);
})();
