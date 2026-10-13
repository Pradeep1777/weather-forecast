// Challenges and Fixes, cleaner version: 3 big rows (seen in this project) + a quiet strip (expected in real use).
const path = require("path");
const pptxgen = require("pptxgenjs");

const ICONS = path.join(__dirname, "icons");
const OUT = process.argv[2] || path.join(__dirname, "content_challenges2.pptx");
const BLUE = "366B9D", SLATE = "44546A", ORANGE = "E77817", GREY = "A5A5A5";
const LIGHT = "EEEEF0", LIGHT2 = "E7E6E6", WHITE = "FFFFFF";
const HEAD = "Poppins", BODY = "Lato";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.title = "Challenges and Fixes";
const S = pres.shapes;
const s = pres.addSlide();

const T = (text, o = {}) => s.addText(text, Object.assign({ isTextBox: true, margin: 0, fontFace: BODY, fontSize: 12, color: SLATE, valign: "top" }, o));
const rbox = (x, y, w, h, o = {}) => s.addShape(S.ROUNDED_RECTANGLE, {
  x, y, w, h, rectRadius: o.r ?? 0.1,
  fill: { color: o.fill ?? WHITE },
  line: o.line ? { color: o.line, width: o.lw ?? 1, dashType: o.dash ?? "solid" } : { type: "none" },
});
const icon = (name, x, y, d, color) => {
  s.addShape(S.OVAL, { x, y, w: d, h: d, fill: { color }, line: { type: "none" } });
  const k = d * 0.58;
  s.addImage({ path: path.join(ICONS, name + ".png"), x: x + (d - k) / 2, y: y + (d - k) / 2, w: k, h: k, altText: "" });
};

T("Challenges and Fixes", { objectName: "SLIDE_TITLE", x: 0.4, y: 0.25, w: 11.6, h: 0.63 });

// ---- one heading row
const LX = 0.5, LW = 5.2, RX = 6.4, RW = 6.43;
T("What went wrong", { x: LX, y: 1.05, w: 4.5, h: 0.32, fontFace: HEAD, fontSize: 14, bold: true, color: ORANGE, valign: "middle" });
T("How I fixed it", { x: RX, y: 1.05, w: 4.5, h: 0.32, fontFace: HEAD, fontSize: 14, bold: true, color: SLATE, valign: "middle" });

// ---- three big rows: the problems I really met
const RH = 0.9, STEP = 1.12;
[
  ["doc", "Messy PDF text: hidden bullet characters and links turning into “2°C”",
    "Cleaned in a fixed order and compared with the old chunks: 219 chunks, 0 differences."],
  ["search", "Unrelated questions still scored about 0.5 in document search",
    "Unrelated scored 0.51–0.57 and relevant 0.70–0.82, so the threshold is 0.6."],
  ["hub", "Agent used tools it did not need, e.g. for a Fahrenheit conversion",
    "Added a short rulebook. All 12 test questions then used the right tools."],
].forEach(([ic, problem, fix], i) => {
  const y = 1.55 + i * STEP;
  rbox(LX, y, LW, RH, { fill: WHITE, line: ORANGE, lw: 1.25, dash: "dash" });
  icon(ic, LX + 0.18, y + (RH - 0.56) / 2, 0.56, ORANGE);
  T(problem, { x: LX + 0.95, y, w: LW - 1.15, h: RH, fontFace: HEAD, fontSize: 12, bold: true, color: ORANGE, valign: "middle" });
  s.addShape(S.RIGHT_ARROW, { x: 5.85, y: y + RH / 2 - 0.15, w: 0.4, h: 0.3, fill: { color: GREY }, line: { type: "none" } });
  rbox(RX, y, RW, RH, { fill: LIGHT2 });
  T(fix, { x: RX + 0.3, y, w: RW - 0.6, h: RH, fontSize: 14, valign: "middle" });
});

// ---- quiet strip: expected in real use
const PY = 5.0, PH = 1.72;
rbox(LX, PY, 12.33, PH, { fill: LIGHT, r: 0.12 });
T("ALSO EXPECTED IN REAL USE", { x: LX + 0.3, y: PY + 0.14, w: 6, h: 0.26, fontFace: HEAD, fontSize: 9.5, bold: true, color: ORANGE, charSpacing: 1.5 });
const CGAP = 0.22, CW = (12.33 - 0.6 - 2 * CGAP) / 3, CY = PY + 0.5, CH = 1.04;
[
  ["chart", "Live data drifts", "Live data differs from training data. Monitor the error and retrain."],
  ["api", "Many users at once", "Rate limits, cost, slow answers. Cache, use a paid tier, add a queue."],
  ["warn", "Wrong answers matter", "Show sources, say “not covered”, keep a human in the loop."],
].forEach(([ic, title, text], i) => {
  const x = LX + 0.3 + i * (CW + CGAP);
  rbox(x, CY, CW, CH, { fill: WHITE });
  icon(ic, x + 0.18, CY + (CH - 0.52) / 2, 0.52, BLUE);
  T(title, { x: x + 0.88, y: CY + 0.14, w: CW - 1.0, h: 0.3, fontFace: HEAD, fontSize: 11.5, bold: true, color: BLUE, valign: "middle" });
  T(text, { x: x + 0.88, y: CY + 0.47, w: CW - 1.0, h: 0.5, fontSize: 11 });
});

s.addNotes("Top: three problems I really met. 1) PDF text was messy: hidden bullet characters, links that turned into temperatures, broken words. I cleaned it in a fixed order and compared the new chunks with the old ones: the same 219 chunks, no differences. 2) Unrelated questions still scored about 0.5 in document search, so I measured the scores: unrelated 0.51 to 0.57, relevant 0.70 to 0.82, and set the threshold at 0.6; sources the model invents are removed. 3) The agent used tools it did not need, like for a Fahrenheit conversion, so I added a short rulebook and tested the routing on 12 questions. Bottom strip: problems I expect in real use; these did not all happen to me. Drift: the model learned from ERA5 history but live data comes from another source; I measured a small version, about 0.7 degrees live against 0.4 on the test years, so I would monitor and retrain. Many users: rate limits and cost, so cache (live weather is already cached for 10 minutes), use a paid tier and add a queue. Wrong answers matter for operations: show sources, say 'not covered' when unsure, keep a human in the loop and test a fixed set of questions. Closing line if asked: real systems need checks, monitoring and fallbacks, not just a working demo.");

pres.writeFile({ fileName: OUT }).then(() => console.log("written", OUT));
