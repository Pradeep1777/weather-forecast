// One slide: Problem Statement, following the structure of the company template's own Problem Statement slide
// (flow row + "handoff" labels + loop, four problem cards, bold bottom line). Merged into the template by merge.py.
const path = require("path");
const pptxgen = require("pptxgenjs");

const ICONS = path.join(__dirname, "icons");
const OUT = process.argv[2] || path.join(__dirname, "content_problem.pptx");
const BLUE = "366B9D", BLUE2 = "166FA9", SLATE = "44546A", ORANGE = "E77817", GREY = "A5A5A5";
const LIGHT = "EEEEF0", LIGHT2 = "E7E6E6", WHITE = "FFFFFF";
const HEAD = "Poppins", BODY = "Lato";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.title = "Problem Statement";
const S = pres.shapes;
const s = pres.addSlide();

const T = (text, o = {}) => s.addText(text, Object.assign({ isTextBox: true, margin: 0, fontFace: BODY, fontSize: 12, color: SLATE, valign: "top" }, o));
const box = (x, y, w, h, o = {}) => s.addShape(S.ROUNDED_RECTANGLE, {
  x, y, w, h, rectRadius: o.r ?? 0.08, fill: { color: o.fill ?? LIGHT, transparency: o.tr ?? 0 },
  line: o.line ? { color: o.line, width: o.lw ?? 1 } : { type: "none" },
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

// ---- title (filled into the template's own title placeholder by merge.py)
T("Problem Statement", { objectName: "SLIDE_TITLE", x: 0.4, y: 0.25, w: 11.6, h: 0.63 });

// ---- the one-sentence problem (from the PRD)
T([
  { text: "Operations staff need quick, plain-language weather answers that come from a trained model and official documents, ", options: {} },
  { text: "not from an LLM's guesses.", options: { bold: true, color: BLUE } },
], { x: 0.5, y: 1.0, w: 12.33, h: 0.5, fontSize: 13.5 });

// ---- flow: how an answer is found today
T("HOW AN ANSWER IS FOUND TODAY  (A TYPICAL MANUAL WAY)", { x: 0.5, y: 1.6, w: 9, h: 0.22, fontFace: HEAD, fontSize: 9, bold: true, color: SLATE, charSpacing: 1.5 });
const steps = ["Question", "Weather site", "Forecast numbers", "Long IMD PDFs", "Combine by hand", "Unverified answer"];
const BW = 1.5, GAP = 0.666, BY = 1.9, BH = 0.7;
steps.forEach((t, i) => {
  const x = 0.5 + i * (BW + GAP), last = i === steps.length - 1;
  box(x, BY, BW, BH, { fill: last ? WHITE : LIGHT2, line: last ? ORANGE : SLATE, lw: last ? 2 : 0.75, r: 0.1 });
  T(t, { x: x + 0.08, y: BY, w: BW - 0.16, h: BH, fontSize: 11.5, bold: true, color: last ? ORANGE : SLATE, align: "center", valign: "middle" });
  if (!last) {
    s.addShape(S.RECTANGLE, { x: x + BW, y: BY + BH / 2 - 0.045, w: GAP, h: 0.09, fill: { color: GREY }, line: { type: "none" } });
  }
});
[1, 2, 3].forEach((g) => T("handoff", { x: 2.333 + 2.166 * g - 0.45, y: BY + BH + 0.05, w: 0.9, h: 0.22, fontSize: 10.5, align: "center" }));
// loop: doubt sends the person back to the sources
const LY = 3.08, x6 = 0.5 + 5 * (BW + GAP) + BW / 2, x2 = 0.5 + (BW + GAP) + BW / 2;
seg(x6, BY + BH, x6, LY, { color: ORANGE, w: 2.25 });
seg(x6, LY, x2, LY, { color: ORANGE, w: 2.25 });
seg(x2, LY, x2, BY + BH + 0.02, { color: ORANGE, w: 2.25, head: true });
T("doubt, then re-check loop", { x: (x2 + x6) / 2 - 1.6, y: LY + 0.06, w: 3.2, h: 0.26, fontFace: HEAD, fontSize: 11.5, bold: true, color: ORANGE, align: "center" });
s.addShape(S.LINE, { x: 0.5, y: 3.5, w: 12.33, h: 0, line: { color: GREY, width: 1 } });

// ---- four problems
const cards = [
  ["split", "Scattered sources", "Live weather, forecasts and official rules sit in different places. The IMD SOP alone is 347 pages."],
  ["doc", "Raw outputs, not answers", "Staff must read model numbers and long documents themselves just to get a simple answer."],
  ["warn", "LLMs can guess", "An LLM alone may invent numbers or rules from memory, which is risky for operations."],
  ["search", "Hard to trust", "Without a source, nobody can check where an answer came from."],
];
const CW = 2.9, CG = (12.33 - 4 * CW) / 3, CY = 3.7, CH = 2.2;
cards.forEach(([ic, title, text], i) => {
  const x = 0.5 + i * (CW + CG);
  box(x, CY, CW, CH, { fill: LIGHT });
  icon(ic, x + CW / 2 - 0.27, CY + 0.15, 0.54, i === 2 ? ORANGE : BLUE);
  T(title, { x: x + 0.2, y: CY + 0.8, w: CW - 0.4, h: 0.5, fontFace: HEAD, fontSize: 12, bold: true, color: BLUE, align: "center", valign: "middle" });
  T(text, { x: x + 0.2, y: CY + 1.32, w: CW - 0.4, h: 0.82, fontSize: 12, align: "center" });
});

// ---- bottom line + our answer
box(0.5, 6.12, 6.5, 0.6, { fill: BLUE });
const phrases = [["Many sources", 0.8, 1.5], ["Manual reading", 2.75, 1.65], ["Unverified answers", 4.85, 2.0]];
phrases.forEach(([t, x, w]) => T(t, { x, y: 6.12, w, h: 0.6, fontFace: HEAD, fontSize: 11.5, bold: true, color: WHITE, align: "center", valign: "middle" }));
[2.3, 4.4].forEach((x) => s.addShape(S.RIGHT_ARROW, { x, y: 6.31, w: 0.32, h: 0.22, fill: { color: ORANGE }, line: { type: "none" } }));
box(7.2, 6.12, 5.63, 0.6, { fill: ORANGE, tr: 85 });
T([
  { text: "Our answer:  ", options: { bold: true, color: BLUE, fontFace: HEAD } },
  { text: "one question, one agent, a short answer with its tools and sources." },
], { x: 7.4, y: 6.12, w: 5.3, h: 0.6, fontSize: 12.5, valign: "middle" });

s.addNotes("The problem comes from the PRD: operations staff need fast, plain-language answers about current and forecast weather, grounded in a trained model and authoritative documents, not in an LLM's guesses. The flow at the top is a typical manual way, shown as an illustration: the person checks a weather site, looks at forecast numbers, searches long IMD PDFs, and combines everything by hand. Every step is a handoff, and doubt sends them back to re-check. The four cards are the problems behind that: scattered sources (the IMD SOP alone is 347 pages), raw outputs instead of answers, LLMs that can guess, and answers nobody can trace to a source. Bottom line: many sources, manual reading and unverified answers. My answer is one question, one agent, and a short reply that shows its tools and sources.");

pres.writeFile({ fileName: OUT }).then(() => console.log("written", OUT));
