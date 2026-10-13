// Weather Intelligence Assistant: slide CONTENT for the company template (merged into the template by merge.py).
// Palette and fonts are the template's own: Poppins (headings) + Lato (body).
const path = require("path");
const pptxgen = require("pptxgenjs");

const ICONS = path.join(__dirname, "icons");
const OUT = process.argv[2] || path.join(__dirname, "content.pptx");

// template colours (theme + layouts)
const BLUE = "366B9D", BLUE2 = "166FA9", SKY = "5B9BD5", SLATE = "44546A", ORANGE = "E77817", GREY = "A5A5A5";
const LIGHT = "EEEEF0", LIGHT2 = "E7E6E6", GREEN = "70AD47", WHITE = "FFFFFF", BLACK = "000000";
const HEAD = "Poppins", BODY = "Lato";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.title = "Weather Intelligence Assistant";
pres.author = "Weather Intelligence Assistant";
const S = pres.shapes;

const shadow = () => ({ type: "outer", color: "000000", blur: 6, offset: 2, angle: 90, opacity: 0.12 });

function T(slide, text, o = {}) {
  slide.addText(text, Object.assign({ isTextBox: true, margin: 0, fontFace: BODY, fontSize: 14, color: SLATE, valign: "top" }, o));
}
function title(slide, text) { T(slide, text, { objectName: "SLIDE_TITLE", x: 0.4, y: 0.25, w: 11.6, h: 0.63, fontFace: HEAD, fontSize: 20, color: BLUE }); }
function box(slide, x, y, w, h, o = {}) {
  slide.addShape(S.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: o.r ?? 0.08,
    fill: { color: o.fill ?? LIGHT, transparency: o.tr ?? 0 },
    line: o.line ? { color: o.line, width: o.lw ?? 1, dashType: o.dash ?? "solid", transparency: o.ltr ?? 0 } : { type: "none" },
    shadow: o.shadow ? shadow() : undefined,
  });
}
function icon(slide, name, x, y, d, color) {
  slide.addShape(S.OVAL, { x, y, w: d, h: d, fill: { color }, line: { type: "none" } });
  const s = d * 0.58;
  slide.addImage({ path: path.join(ICONS, name + ".png"), x: x + (d - s) / 2, y: y + (d - s) / 2, w: s, h: s, altText: "" });
}
function arrow(slide, x1, y1, x2, y2, o = {}) {
  const dx = x2 - x1, dy = y2 - y1;
  slide.addShape(S.LINE, {
    x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(dx), h: Math.abs(dy), flipH: dx < 0, flipV: dy < 0,
    line: { color: o.color ?? SLATE, width: o.w ?? 1.5, dashType: o.dash ?? "solid", endArrowType: o.head === false ? undefined : "triangle" },
  });
}
function numberDot(slide, n, x, y, d, color) {
  slide.addShape(S.OVAL, { x, y, w: d, h: d, fill: { color }, line: { type: "none" } });
  T(slide, String(n), { x, y, w: d, h: d, fontFace: HEAD, fontSize: 13, bold: true, color: WHITE, align: "center", valign: "middle" });
}
const H = (slide, text, x, y, w, size, o = {}) => T(slide, text, Object.assign({ x, y, w, h: size / 72 * 1.6, fontFace: HEAD, fontSize: size, bold: true, color: BLUE }, o));
const code = (extra = {}) => Object.assign({ bold: true, color: BLUE2 }, extra);   // code names: Lato bold, blue

// ================================================================ 1. COVER
{
  const s = pres.addSlide();
  T(s, "Weather Intelligence Assistant", { objectName: "SLIDE_TITLE", x: 1.67, y: 2.71, w: 10, h: 0.71 });
  T(s, "AI Engineering Crash Course", { objectName: "SLIDE_SUBTITLE", x: 1.67, y: 3.46, w: 10, h: 0.69 });
  T(s, "[Your name]  ·  [Date]", { x: 1.67, y: 4.2, w: 10, h: 0.35, fontFace: HEAD, fontSize: 14, bold: true, align: "center" });
  T(s, "An assistant for Mumbai weather questions: trained forecast models, answers grounded in official IMD documents, and an agent that picks its own tools.",
    { x: 2.4, y: 4.65, w: 8.5, h: 0.62, fontSize: 14, align: "center" });
  [["chart", "Forecast model", "Predicts the next hour's temperature"],
   ["search", "Document search (RAG)", "Answers from IMD documents, with sources"],
   ["hub", "Agent + four tools", "Picks live data, the models or the documents"]].forEach(([ic, t, sub], i) => {
    const x = 1.27 + i * 3.7;
    box(s, x, 5.4, 3.4, 0.9, { fill: LIGHT });
    icon(s, ic, x + 0.15, 5.55, 0.6, i === 2 ? ORANGE : BLUE);
    H(s, t, x + 0.9, 5.5, 2.4, 11);
    T(s, sub, { x: x + 0.9, y: 5.8, w: 2.4, h: 0.42, fontSize: 11 });
  });
  s.addNotes("Introduce yourself. One sentence on the project: an assistant that answers Mumbai weather questions using live data, models I trained, and official IMD documents. The talk has three parts: how it works, what I learned, and a live demo in the terminal.");
}

// ================================================================ 2. BRIEF & JOURNEY
{
  const s = pres.addSlide();
  title(s, "From a brief to a working assistant");
  box(s, 0.5, 1.25, 12.33, 1.0, { fill: LIGHT });
  icon(s, "doc", 0.75, 1.42, 0.66, BLUE);
  T(s, [
    { text: "The brief:  ", options: { bold: true, color: BLUE, fontFace: HEAD } },
    { text: "operations staff need quick, plain-language weather answers that come from trained models and official documents, not from an LLM's guesses." },
  ], { x: 1.7, y: 1.3, w: 10.9, h: 0.9, fontSize: 15, valign: "middle" });

  const days = [
    ["chart", "Day 1", "Forecast model", "Gradient boosting trained on 45 years of hourly weather", "Done", GREEN],
    ["search", "Day 2", "RAG + /ask", "IMD documents made searchable, one API endpoint", "Done", GREEN],
    ["hub", "Day 3", "Agent", "LangGraph agent that picks between four tools", "Done", GREEN],
    ["bulb", "Day 4", "Fine-tuning", "Severity classifier compared with a zero-shot prompt", "Next", ORANGE],
    ["box", "Day 5", "Ship", "Docker setup and basic MLflow tracking", "Done · tests next", GREEN],
  ];
  arrow(s, 1.65, 3.35, 11.65, 3.35, { color: GREY, w: 1.5, head: false });
  days.forEach(([ic, day, t, desc, status, col], i) => {
    const cx = 1.65 + i * 2.5;
    icon(s, ic, cx - 0.4, 2.95, 0.8, i === 3 ? ORANGE : BLUE);
    T(s, day.toUpperCase(), { x: cx - 1.1, y: 3.95, w: 2.2, h: 0.25, fontFace: HEAD, fontSize: 10, bold: true, color: SLATE, align: "center", charSpacing: 1 });
    H(s, t, cx - 1.1, 4.22, 2.2, 14, { align: "center" });
    T(s, desc, { x: cx - 1.05, y: 4.78, w: 2.1, h: 0.8, fontSize: 12.5, align: "center" });
    s.addShape(S.OVAL, { x: cx - 0.7, y: 5.77, w: 0.16, h: 0.16, fill: { color: col }, line: { type: "none" } });
    T(s, status, { x: cx - 0.46, y: 5.68, w: 1.6, h: 0.34, fontSize: 12, bold: true, valign: "middle" });
  });
  s.addNotes("The PRD asked for a working assistant built end to end, solo, over five days. Days 1 to 3 and the Docker part of Day 5 are done. Fine-tuning (Day 4) and the automated tests (Day 5) are the next steps; I chose to go deeper on the agent and on making everything reproducible first.");
}

// ================================================================ 3. ARCHITECTURE
{
  const s = pres.addSlide();
  title(s, "Architecture: one agent, four tools");
  const lab = (t, x, w) => T(s, t, { x, y: 1.15, w, h: 0.26, fontFace: HEAD, fontSize: 9, bold: true, charSpacing: 1.5 });
  lab("CLIENTS", 0.5, 2.2); lab("SERVICE  (DOCKER)", 3.3, 4); lab("TOOLS", 8.05, 3);

  const client = (ic, t, sub, y, h) => {
    box(s, 0.5, y, 2.25, h, { fill: WHITE, line: GREY, shadow: true });
    icon(s, ic, 0.65, y + (h - 0.5) / 2, 0.5, SKY);
    H(s, t, 1.25, y + 0.15, 1.5, 11.5);
    T(s, sub, { x: 1.25, y: y + 0.45, w: 1.45, h: h - 0.5, fontSize: 10.5 });
  };
  client("api", "HTTP client", "POST /ask, /docs page", 1.85, 0.95);
  client("terminal", "Terminal chat", "chat.py, remembers the chat", 3.4, 1.05);

  box(s, 3.3, 1.55, 4.2, 3.58, { fill: WHITE, line: GREY, dash: "dash", r: 0.06 });
  box(s, 3.55, 1.85, 3.7, 0.95, { fill: WHITE, line: BLUE, lw: 1.25, shadow: true });
  icon(s, "check", 3.72, 2.07, 0.52, BLUE);
  H(s, "FastAPI  /ask", 4.4, 1.98, 2.8, 12);
  T(s, "Checks the input, returns clear errors", { x: 4.4, y: 2.4, w: 2.8, h: 0.36, fontSize: 10.5 });
  box(s, 3.55, 3.3, 3.7, 1.3, { fill: BLUE, shadow: true });
  icon(s, "hub", 3.72, 3.65, 0.6, ORANGE);
  H(s, "LangGraph agent", 4.5, 3.46, 2.7, 12.5, { color: WHITE });
  T(s, "Gemini reads the question and decides which tools to call", { x: 4.5, y: 3.84, w: 2.65, h: 0.66, fontSize: 10.5, color: WHITE });
  T(s, "LLM: Gemini 3.5 Flash-Lite, with a backup model", { x: 3.55, y: 4.7, w: 3.7, h: 0.28, fontSize: 10 });
  arrow(s, 2.75, 2.325, 3.55, 2.325, { color: SLATE });
  arrow(s, 2.75, 3.925, 3.55, 3.925, { color: SLATE });
  arrow(s, 5.4, 2.8, 5.4, 3.3, { color: SLATE });

  const tools = [
    ["cloud", "Live weather", "get_live_weather", "Open-Meteo forecast API"],
    ["chart", "Forecast model: next hour", "predict_next_hour_temperature", "Trained model, last 24 h of live data"],
    ["flask", "Model backtest: past hours", "backtest_temperature", "Trained model + ERA5 history"],
    ["search", "IMD document search", "search_imd_documents", "PostgreSQL + pgvector (Docker)"],
  ];
  arrow(s, 7.25, 3.95, 7.78, 3.95, { color: SLATE, head: false });
  arrow(s, 7.78, 1.96, 7.78, 4.72, { color: SLATE, head: false });
  tools.forEach(([ic, t, fn, src], i) => {
    const y = 1.55 + i * 0.92;
    arrow(s, 7.78, y + 0.41, 8.05, y + 0.41, { color: SLATE });
    box(s, 8.05, y, 4.78, 0.82, { fill: WHITE, line: GREY, shadow: true });
    icon(s, ic, 8.2, y + 0.16, 0.5, i === 0 || i === 3 ? ORANGE : BLUE);
    H(s, t, 8.85, y + 0.05, 3.9, 11);
    T(s, fn, Object.assign({ x: 8.85, y: y + 0.35, w: 3.9, h: 0.2, fontSize: 10 }, code()));
    T(s, src, { x: 8.85, y: y + 0.56, w: 3.9, h: 0.2, fontSize: 10 });
  });

  T(s, "BUILT ONCE BY SCRIPTS, BEFORE THE APP STARTS", { x: 0.5, y: 5.45, w: 8, h: 0.26, fontFace: HEAD, fontSize: 9, bold: true, charSpacing: 1.5 });
  const row = (items, y, note) => {
    items.forEach(([t, isCode], i) => {
      const x = 0.5 + i * 2.45;
      box(s, x, y, 2.0, 0.4, { fill: LIGHT, r: 0.2 });
      T(s, t, Object.assign({ x, y, w: 2.0, h: 0.4, fontSize: 10.5, align: "center", valign: "middle" }, isCode ? code() : {}));
      if (i < items.length - 1) arrow(s, x + 2.0, y + 0.2, x + 2.45, y + 0.2, { color: SLATE, w: 1.25 });
    });
    T(s, note, { x: 10.4, y, w: 2.43, h: 0.4, fontSize: 10.5, italic: true, valign: "middle" });
  };
  row([["Open-Meteo archive"], ["download_weather.py", true], ["train.py", true], ["model file"]], 5.8, "feeds both model tools");
  row([["IMD PDFs"], ["build_kb.py", true], ["pgvector"]], 6.36, "feeds the IMD search tool");
  s.addNotes("Left to right: a client sends a question. In Docker, FastAPI checks the input and passes it to the LangGraph agent. Gemini, inside the agent, decides which of the four tools it needs: live weather from Open-Meteo; my trained forecast model for the next hour; the same model checked on a past hour against the real value; or a search over the IMD documents stored in pgvector. The bottom rows are what runs once, before the app starts: the scripts that train the model and build the knowledge base. The terminal chat calls the agent directly and keeps the conversation.");
}

// ================================================================ 4. FORECAST MODEL PIPELINE
{
  const s = pres.addSlide();
  title(s, "Forecast model: raw data to a live tool");
  const steps = [
    ["cloud", "Download", "Open-Meteo Archive API: 45 years of hourly ERA5 weather for Mumbai"],
    ["check", "Clean", "Remove duplicate hours, fill short gaps, fix impossible values such as sunlight at night"],
    ["thermo", "Features", "Six simple inputs: temperature now, 3 hours ago, 24-hour average, sunlight, rain, hour"],
    ["split", "Split by time", "Train 1980–2021, check 2022–23, final test 2024–25. Never shuffled."],
    ["chart", "Train & compare", "Gradient boosting (scikit-learn) against the lazy guess: next hour = now"],
    ["hub", "Serve", "The saved model becomes two agent tools, using the same feature code"],
  ];
  steps.forEach(([ic, t, desc], i) => {
    const x = 0.5 + i * 2.07;
    box(s, x, 1.4, 1.9, 3.6, { fill: LIGHT });
    icon(s, ic, x + 0.18, 1.6, 0.7, i === 4 ? ORANGE : BLUE);
    if (i < steps.length - 1) arrow(s, x + 0.95, 1.95, x + 2.15, 1.95, { color: GREY, w: 1.25 });
    T(s, `STEP ${i + 1}`, { x: x + 0.18, y: 2.5, w: 1.5, h: 0.22, fontFace: HEAD, fontSize: 9, bold: true, color: SLATE, charSpacing: 1 });
    H(s, t, x + 0.18, 2.74, 1.65, 11);
    T(s, desc, { x: x + 0.18, y: 3.2, w: 1.58, h: 1.7, fontSize: 12 });
  });
  box(s, 0.5, 5.3, 12.33, 1.25, { fill: ORANGE, tr: 85 });
  icon(s, "bulb", 0.75, 5.57, 0.7, ORANGE);
  T(s, [
    { text: "What I learned:  ", options: { bold: true, color: BLUE, fontFace: HEAD } },
    { text: "always compare with a simple baseline, and split time-series data by time. A random split would let the model peek at the future." },
  ], { x: 1.7, y: 5.4, w: 10.9, h: 1.05, fontSize: 15, valign: "middle" });
  s.addNotes("Day 1, step by step. I downloaded 45 years of hourly ERA5 data for Mumbai through the Open-Meteo Archive API, cleaned it, and built six simple features. The split is by time: the model never sees the future during training. I compared gradient boosting from scikit-learn with the simplest possible forecast, 'the next hour will be like now', and the model clearly beat it. The saved model powers two agent tools: the live next-hour forecast and a backtest on past hours. Training and the tools use one shared feature file so they always compute the inputs the same way.");
}

// ================================================================ 5. RAG CHUNKING
{
  const s = pres.addSlide();
  title(s, "RAG: turning IMD documents into chunks");
  const stage = (n, ic, t, sub, y, h, style) => {
    const dark = style === "dark", warm = style === "warm";
    box(s, 0.5, y, 7.1, h, { fill: dark ? BLUE : warm ? ORANGE : LIGHT, tr: warm ? 85 : 0 });
    icon(s, ic, 0.72, y + (h - 0.6) / 2, 0.6, dark ? ORANGE : warm ? ORANGE : BLUE);
    H(s, `${n}  ·  ${t}`, 1.55, y + 0.1, 5.9, 12, { color: dark ? WHITE : BLUE });
    T(s, sub, { x: 1.55, y: y + 0.44, w: 5.9, h: h - 0.5, fontSize: 12, color: dark ? WHITE : SLATE });
  };
  stage(1, "doc", "Clean the PDF text", "Remove page headers and links, re-join broken words, fix °C symbols", 1.3, 0.95);
  arrow(s, 4.05, 2.25, 4.05, 2.55);
  stage(2, "split", "Cut by structure (main strategy)", "Each FAQ question, each SOP section number, small groups of glossary terms", 2.55, 0.95, "dark");
  arrow(s, 4.05, 3.5, 4.05, 3.8);
  stage(3, "check", "Recursive size check (fallback)", "Too long: split by paragraph, then by sentence, keeping the title and one sentence of overlap. Too short: merge with the neighbour.", 3.8, 1.2, "warm");
  arrow(s, 4.05, 5.0, 4.05, 5.3);
  stage(4, "db", "Embed and store", "Gemini embeddings, saved in PostgreSQL + pgvector: 219 chunks", 5.3, 0.95);

  H(s, "Why this strategy", 7.95, 1.3, 4.8, 15);
  [
    "One chunk holds one complete answer, such as one FAQ question or one SOP section",
    "Search returns whole facts, not half sentences cut at a random length",
    "Every part keeps its title, so a split chunk still knows its topic",
  ].forEach((t, i) => {
    const y = 1.95 + i * 0.85;
    icon(s, "check", 7.95, y + 0.03, 0.36, GREEN);
    T(s, t, { x: 8.45, y, w: 4.38, h: 0.75, fontSize: 13 });
  });
  box(s, 7.95, 4.55, 4.88, 1.95, { fill: LIGHT });
  T(s, "EXAMPLE CHUNK  ·  heat_faq-004", { x: 8.15, y: 4.67, w: 4.5, h: 0.25, fontFace: HEAD, fontSize: 9, bold: true, color: BLUE, charSpacing: 1 });
  T(s, [
    { text: "Q. What is a criterion for describing Heat Wave for coastal stations?", options: { bold: true, breakLine: true } },
    { text: "When maximum temperature departure is 4.5°C or more from normal, Heat Wave may be described provided actual maximum temperature is 37°C or more." },
  ], { x: 8.15, y: 4.98, w: 4.5, h: 1.45, fontSize: 11.5, paraSpaceAfter: 4 });
  s.addNotes("Most of the RAG work was preparing the documents. First I cleaned the PDF text. The main strategy is structure-based: I cut each document where it naturally starts a new topic, so one chunk is one FAQ question or one SOP section. A recursive fallback handles sizes: a section that is too long is split by paragraph, then by sentence, and every part keeps its title; a tiny piece is merged with its neighbour. Then each chunk is embedded with Gemini and stored in pgvector. The example on the right is a real chunk: one complete question and answer.");
}

// ================================================================ 6. AGENT & ORCHESTRATION
{
  const s = pres.addSlide();
  title(s, "Agent: one orchestrator, four tools");
  box(s, 0.5, 1.2, 5.6, 0.5, { fill: LIGHT, r: 0.25 });
  T(s, [{ text: "Question:  ", options: { bold: true, color: BLUE, fontFace: HEAD } }, { text: "Is it a heat wave in Mumbai now?" }], { x: 0.75, y: 1.2, w: 5.2, h: 0.5, fontSize: 13, valign: "middle" });
  box(s, 0.5, 1.95, 7.7, 1.85, { fill: WHITE, line: GREY, dash: "dash", r: 0.06 });
  T(s, "LANGGRAPH ORCHESTRATOR  ·  RUNS THE LOOP", { x: 0.7, y: 2.02, w: 5, h: 0.24, fontFace: HEAD, fontSize: 9, bold: true, charSpacing: 1 });
  box(s, 2.2, 2.35, 4.3, 1.2, { fill: BLUE, shadow: true });
  icon(s, "hub", 2.38, 2.65, 0.64, ORANGE);
  H(s, "Main agent  (Gemini)", 3.2, 2.5, 3.2, 12.5, { color: WHITE });
  T(s, "Reads the question and rules, decides which tools to call", { x: 3.2, y: 2.9, w: 3.2, h: 0.6, fontSize: 11, color: WHITE });
  arrow(s, 4.35, 1.7, 4.35, 2.35, { color: SLATE });

  const tools = [
    ["cloud", "Live weather", "Open-Meteo API"],
    ["chart", "Forecast model", "next hour, live data"],
    ["flask", "Model backtest", "past hour vs reality"],
    ["search", "IMD search", "pgvector"],
  ];
  const ax = [3.0, 3.95, 4.75, 5.7];
  tools.forEach(([ic, t, src], i) => {
    const x = 0.5 + i * 1.97, tc = x + 0.89;
    arrow(s, ax[i] - 0.1, 3.55, tc - 0.12, 4.45, { color: ORANGE, w: 1.75 });
    arrow(s, tc + 0.12, 4.45, ax[i] + 0.1, 3.55, { color: BLUE2, w: 1.75 });
    box(s, x, 4.45, 1.78, 1.3, { fill: WHITE, line: GREY, shadow: true });
    icon(s, ic, tc - 0.25, 4.55, 0.5, i === 0 || i === 3 ? ORANGE : BLUE);
    H(s, t, x + 0.05, 5.1, 1.68, 10.5, { align: "center", color: SLATE });
    T(s, src, { x: x + 0.08, y: 5.38, w: 1.62, h: 0.34, fontSize: 10.5, align: "center" });
  });
  arrow(s, 0.5, 5.98, 1.0, 5.98, { color: ORANGE, w: 1.75 });
  T(s, "calls a tool", { x: 1.1, y: 5.85, w: 1.5, h: 0.26, fontSize: 11 });
  arrow(s, 2.7, 5.98, 3.2, 5.98, { color: BLUE2, w: 1.75 });
  T(s, "returns the result", { x: 3.3, y: 5.85, w: 2, h: 0.26, fontSize: 11 });
  box(s, 0.5, 6.25, 7.7, 0.52, { fill: LIGHT, r: 0.1 });
  T(s, "Then the agent writes the answer and cites the IMD sources it used", { x: 0.7, y: 6.25, w: 7.4, h: 0.52, fontSize: 12.5, valign: "middle" });

  [
    ["search", "Descriptions decide routing", "Gemini chooses a tool from its name and description, so I wrote each one with care."],
    ["doc", "A short rulebook", "Rules say when to use each tool, to cite sources, and to say when data is missing."],
    ["lock", "Safe limits", "At most 8 steps per question. Greetings and other cities need no tool at all."],
  ].forEach(([ic, t, text], i) => {
    const y = 1.2 + i * 1.85;
    box(s, 8.55, y, 4.28, 1.65, { fill: LIGHT });
    icon(s, ic, 8.75, y + 0.2, 0.55, ORANGE);
    H(s, t, 9.45, y + 0.2, 3.25, 12);
    T(s, text, { x: 9.45, y: y + 0.62, w: 3.25, h: 0.95, fontSize: 12.5 });
  });
  s.addNotes("This is the orchestration. LangGraph runs the loop; inside it, the main agent is Gemini. It reads the question and a short rulebook, then calls the tools it needs: live weather, the forecast model, the model backtest on past hours, or the IMD document search. Each tool returns its result to the agent, and the loop repeats until the agent can answer. Then it writes the answer and cites its sources. What I learned: the tool descriptions are what Gemini uses to choose, the rulebook controls behaviour, and a step limit keeps it safe. Questions that need no tool, like greetings or other cities, are answered directly.");
}

// ================================================================ 7. ONE QUESTION STEP BY STEP
{
  const s = pres.addSlide();
  title(s, "One question, step by step");
  box(s, 0.5, 1.25, 7.0, 0.62, { fill: BLUE, r: 0.31 });
  T(s, "“Is it a heat wave in Mumbai right now?”", { x: 0.8, y: 1.25, w: 6.5, h: 0.62, fontFace: HEAD, fontSize: 14, bold: true, color: WHITE, valign: "middle" });
  const steps = [
    "/ask checks the input. Empty or too long: a friendly message, no crash.",
    "The agent reads its rules and decides it needs two tools.",
    "The tools run: live weather (now and today's maximum) and IMD search (the heat wave rule).",
    "Gemini writes a short answer and cites the IMD chunk it used.",
    "Citations are checked: only chunks the search really returned are kept.",
  ];
  arrow(s, 0.77, 2.5, 0.77, 5.9, { color: GREY, w: 1, head: false, dash: "dash" });
  steps.forEach((t, i) => {
    const y = 2.2 + i * 0.88;
    numberDot(s, i + 1, 0.52, y, 0.5, i === 2 ? ORANGE : BLUE);
    T(s, t, { x: 1.25, y: y - 0.06, w: 6.25, h: 0.62, fontSize: 14, valign: "middle" });
  });
  box(s, 7.95, 1.25, 4.88, 4.75, { fill: LIGHT });
  T(s, "THE REAL ANSWER, FROM THE RUNNING APP", { x: 8.2, y: 1.45, w: 4.4, h: 0.25, fontFace: HEAD, fontSize: 9, bold: true, color: BLUE, charSpacing: 1 });
  T(s, "“Mumbai's current temperature is 35.6°C with a maximum of 36°C expected today. According to IMD criteria for coastal stations, a heat wave requires an actual maximum temperature of 37°C or more alongside a temperature departure of 4.5°C or more from normal [heat_faq-004]. Therefore, it is not currently a heat wave.”",
    { x: 8.2, y: 1.85, w: 4.4, h: 2.6, fontSize: 15, italic: true });
  T(s, [
    { text: "tools_used: ", options: { bold: true, color: BLUE } }, { text: "get_live_weather, search_imd_documents", options: { breakLine: true } },
    { text: "source: ", options: { bold: true, color: BLUE } }, { text: "IMD FAQ on Heat Wave, page 2" },
  ], { x: 8.2, y: 4.55, w: 4.4, h: 0.6, fontSize: 11.5 });
  T(s, "Live numbers change with the weather.", { x: 8.2, y: 5.4, w: 4.4, h: 0.3, fontSize: 11, italic: true });
  s.addNotes("A real example. The question needs two things: today's live temperature, and the official IMD rule for coastal stations. The agent asks for both tools at once, then combines them: Mumbai is below 37 degrees, so it is not a heat wave. The answer cites chunk heat_faq-004, and the code checks that this chunk was really returned by the search, so the model cannot invent a source.");
}

// ================================================================ 8. SHIPPING, MLOPS, LESSONS
{
  const s = pres.addSlide();
  title(s, "Shipping it: Docker, MLOps and lessons");
  const cols = [
    ["box", "Shipping", BLUE, null, [
      "One command starts everything: docker compose up",
      "Bad input gets a clear message; outages are logged",
      "Secrets stay in .env, never in git",
    ]],
    ["flask", "MLOps so far", ORANGE, "warm", [
      "Scripts rebuild the model and the knowledge base",
      "Pinned package versions",
      "One shared feature file for training and live use",
      "Model saved with its features and library version",
      "MLflow: basic tracking of each training run (settings, scores, model)",
    ]],
    ["warn", "Problems that taught me", BLUE, null, [
      "A Gemini model was retired: keep a backup model",
      "Free-tier rate limits: wait and retry",
      "Company laptop blocked a library: pin versions that work",
      "Hidden PDF characters: compare outputs after every change",
    ]],
  ];
  cols.forEach(([ic, t, iconCol, style, items], i) => {
    const x = 0.5 + i * 4.19;
    box(s, x, 1.3, 3.95, 4.95, { fill: style === "warm" ? ORANGE : LIGHT, tr: style === "warm" ? 85 : 0 });
    icon(s, ic, x + 0.25, 1.52, 0.62, iconCol);
    H(s, t, x + 1.05, 1.52, 2.8, 14, { h: 0.62, valign: "middle" });
    s.addText(items.map((tx, j) => ({ text: tx, options: { bullet: { indent: 14 }, breakLine: j < items.length - 1 } })),
      { isTextBox: true, x: x + 0.25, y: 2.5, w: 3.5, h: 3.8, fontFace: BODY, fontSize: 15, color: SLATE, valign: "top", margin: 0, paraSpaceAfter: 14 });
  });
  s.addNotes("Shipping: one Docker command starts the database and the API, bad input gets a friendly message, and secrets stay in the .env file. MLOps so far is basic but real: scripts rebuild everything, versions are pinned, training and the live tools share one feature file, and MLflow tracks each training run with its settings and scores. Right: the problems that taught me the most, each with the habit it gave me.");
}

// ================================================================ 9. LIVE DEMO
{
  const s = pres.addSlide();
  title(s, "Live demo: the agent picks its tools");
  box(s, 0.5, 1.3, 7.1, 5.2, { fill: BLACK, r: 0.1, shadow: true });
  [ORANGE, SKY, GREEN].forEach((col, i) => s.addShape(S.OVAL, { x: 0.75 + i * 0.28, y: 1.52, w: 0.16, h: 0.16, fill: { color: col }, line: { type: "none" } }));
  const lines = [
    ["$ ", "docker compose up -d --wait", "cmd"],
    ["$ ", "docker exec -it weather-api python chat.py", "cmd"],
    ["", " ", "cmd"],
    ["You: ", "How hot is it in Mumbai right now?", "cmd"], ["", "     tools: get_live_weather", "tool"],
    ["You: ", "And in one hour?", "cmd"], ["", "     tools: predict_next_hour_temperature", "tool"],
    ["You: ", "Is that a heat wave by IMD rules?", "cmd"], ["", "     tools: get_live_weather, search_imd_documents", "tool"],
    ["You: ", "Check your model on 29 January 2025, 10:00", "cmd"], ["", "     tools: backtest_temperature", "tool"],
    ["You: ", "What's the weather in Delhi?", "cmd"], ["", "     tools: none", "tool"],
  ];
  const runs = [];
  lines.forEach(([p, t, kind], i) => {
    const tool = kind === "tool", last = i === lines.length - 1;
    if (p) runs.push({ text: p, options: { color: ORANGE, bold: true, fontSize: 14 } });
    runs.push({ text: t, options: { color: tool ? LIGHT2 : WHITE, bold: !tool, fontSize: tool ? 12.5 : 14, breakLine: !last } });
  });
  s.addText(runs, { isTextBox: true, x: 0.8, y: 1.95, w: 6.6, h: 4.4, fontFace: BODY, valign: "top", margin: 0, paraSpaceAfter: 7 });

  const hdr = (t) => ({ text: t, options: { bold: true, color: WHITE, fill: { color: BLUE }, fontFace: HEAD, fontSize: 10.5 } });
  const tool = (t) => ({ text: t, options: Object.assign({ fontFace: BODY, fontSize: 11 }, code()) });
  const plain = (t) => ({ text: t, options: { fontFace: BODY, fontSize: 11.5, color: SLATE } });
  s.addTable([
    [hdr("Question type"), hdr("Tool the agent picks")],
    [plain("Current weather"), tool("get_live_weather")],
    [plain("Next-hour temperature"), tool("predict_next_hour_temperature")],
    [plain("A past date vs reality"), tool("backtest_temperature")],
    [plain("IMD rules, definitions"), tool("search_imd_documents")],
    [plain("Heat wave right now?"), plain("live weather + IMD search")],
    [plain("Other city or greeting"), plain("no tool")],
  ], { x: 7.95, y: 1.3, w: 4.88, colW: [1.85, 3.03], rowH: 0.42, valign: "middle",
       border: { type: "solid", pt: 0.75, color: LIGHT2 }, margin: [0.04, 0.1, 0.04, 0.1] });
  box(s, 7.95, 4.7, 4.88, 1.8, { fill: ORANGE, tr: 85 });
  H(s, "What to watch for", 8.15, 4.82, 4.5, 13);
  s.addText([
    { text: "The tools: line under each answer", options: { bullet: { indent: 14 }, breakLine: true } },
    { text: "IMD sources shown in [brackets]", options: { bullet: { indent: 14 }, breakLine: true } },
    { text: "Follow-up questions are remembered", options: { bullet: { indent: 14 } } },
  ], { isTextBox: true, x: 8.15, y: 5.25, w: 4.5, h: 1.1, fontFace: BODY, fontSize: 13, color: SLATE, valign: "top", margin: 0, paraSpaceAfter: 4 });
  s.addNotes("Demo in the terminal. 1) Start everything with one command; --wait returns when both containers are healthy. 2) Open the chat inside the API container. Ask: current temperature (live weather tool), then 'and in one hour?' (the forecast model, and it remembers the topic), then 'is that a heat wave?' (two tools plus an IMD source), then 'check your model on 29 January 2025 at 10:00' (the backtest tool: prediction, the real value and the error, and it says that hour was never seen in training), then Delhi (no tool, polite answer). Point at the tools line each time. If the network is slow, use the table on this slide to explain the routing.");
}

// ================================================================ 10. NEXT & THANK YOU
{
  const s = pres.addSlide();
  title(s, "What's next");
  [
    ["bulb", "Fine-tuning (F5)", "A small text classifier for weather severity, compared with a zero-shot prompt"],
    ["check", "Automated tests (F7)", "pytest for /ask: a valid question, empty input and a service outage"],
    ["chart", "Monitoring", "Save each live forecast and check it against what really happened"],
  ].forEach(([ic, t, text], i) => {
    const y = 1.3 + i * 1.75;
    box(s, 0.5, y, 7.3, 1.55, { fill: LIGHT });
    icon(s, ic, 0.75, y + 0.4, 0.74, ORANGE);
    H(s, t, 1.75, y + 0.28, 5.9, 14);
    T(s, text, { x: 1.75, y: y + 0.78, w: 5.9, h: 0.65, fontSize: 14 });
  });
  box(s, 8.2, 1.3, 4.63, 5.05, { fill: BLUE, r: 0.12 });
  T(s, "KEY TAKEAWAY", { x: 8.55, y: 1.65, w: 3.9, h: 0.26, fontFace: HEAD, fontSize: 10, bold: true, color: WHITE, charSpacing: 1.5 });
  T(s, "Most of an AI system is data preparation, retrieval and careful wiring. The LLM call is the smallest part.",
    { x: 8.55, y: 2.05, w: 3.95, h: 2.6, fontFace: HEAD, fontSize: 16, color: WHITE });
  T(s, "Thank you", { x: 8.55, y: 4.95, w: 3.9, h: 0.55, fontFace: HEAD, fontSize: 24, bold: true, color: WHITE });
  T(s, "Questions?", { x: 8.55, y: 5.55, w: 3.9, h: 0.4, fontSize: 16, color: LIGHT2 });
  s.addNotes("Next steps: fine-tuning a small severity classifier and comparing it with a zero-shot prompt, automated tests for /ask, and monitoring the live forecasts. Takeaway: building every layer myself showed that most of the work is preparing data, retrieval and wiring the parts together; calling the LLM is the easy part. Thank you, happy to take questions.");
}

pres.writeFile({ fileName: OUT }).then(() => console.log("written", OUT));
