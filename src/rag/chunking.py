import logging
import re
from collections import Counter
from pathlib import Path

import requests
from pypdf import PdfReader

from .config import PROJECT_DIR

logger = logging.getLogger(__name__)

DOCS_DIR = PROJECT_DIR / "docs" / "reference"

DOCUMENTS = [
    {
        "doc_id": "heat_faq",
        "file": "FAQ_heat_wave.pdf",
        "title": "IMD: FAQ on Heat Wave",
        "url": "https://mausam.imd.gov.in/pdfs/heatcolduser/FAQ_heat_wave.pdf",
        "pages": "all",
    },
    {
        "doc_id": "monsoon_faq",
        "file": "monsoonfaq.pdf",
        "title": "IMD: FAQ on Monsoon",
        "url": "https://mausam.imd.gov.in/imd_latest/monsoonfaq.pdf",
        "pages": "all",
    },
    {
        "doc_id": "cyclone_terms",
        "file": "terminology.pdf",
        "title": "IMD RSMC New Delhi: Cyclone terminology",
        "url": "https://rsmcnewdelhi.imd.gov.in/images/pdf/terminology.pdf",
        "pages": "all",
    },
    {
        "doc_id": "forecast_sop",
        "file": "forecasting_sop.pdf",
        "title": "IMD: SOP for Weather Forecasting and Warning",
        "url": "https://mausam.imd.gov.in/imd_latest/contents/pdf/forecasting_sop.pdf",
        # 347 pages: only chapter 1 (rainfall terms, warning colours) and chapter 7 (heat & cold waves)
        "pages": [range(24, 28), range(171, 183)],
    },
]

# ------------------------------------------------------------------ 1. read the PDFs

def ensure_pdf(doc: dict) -> Path:
    """The PDF from docs/reference; downloaded from IMD first if it is not there."""
    path = DOCS_DIR / doc["file"]
    if not path.exists():
        logger.info("Downloading %s from %s", doc["file"], doc["url"])
        response = requests.get(doc["url"], timeout=120)
        response.raise_for_status()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(response.content)
    return path


def pages_to_read(doc: dict, total_pages: int) -> list[int]:
    if doc["pages"] == "all":
        return list(range(1, total_pages + 1))
    return [p for page_range in doc["pages"] for p in page_range]


def read_pages(documents: list[dict]) -> list[dict]:
    pages = []
    for doc in documents:
        reader = PdfReader(ensure_pdf(doc))
        for page_no in pages_to_read(doc, len(reader.pages)):
            text = reader.pages[page_no - 1].extract_text() or ""
            pages.append({"doc_id": doc["doc_id"], "page": page_no, "text": text})
    logger.info("Read %d pages from %d documents", len(pages), len(documents))
    return pages

# ------------------------------------------------------------------ 2. clean the text

HEADER_PATTERNS = [
    r"^\d+\s*\|\s*P a g e$",
    r"^SOP for Weather Forecasting and Warning\s*\d*$",
    r"^Heat and Cold Wave Monitoring & Warning Services\s*\d*$",
    r"^General Forecasting Organisation of IMD\s*\d*$",
]
# short words that are real words on their own: never glue them to a neighbour
NEVER_JOIN = {"or", "and", "the", "a", "an", "of", "in", "to", "per", "is", "on", "at",
              "as", "by", "be", "it", "rain", "wide", "frame", "sea", "day", "time"}


def remove_headers(text: str) -> str:
    lines = [line.strip() for line in text.splitlines()]
    lines = [line for line in lines if not any(re.match(p, line) for p in HEADER_PATTERNS)]
    while lines and (lines[0] == "" or lines[0].isdigit()):
        lines.pop(0)
    while lines and (lines[-1] == "" or lines[-1].isdigit()):
        lines.pop()
    return "\n".join(lines)


def remove_links(text: str) -> str:
    # before fix_degrees: a URL like "...%2C..." would otherwise turn into "2°C"
    text = re.sub(r"https?://\S+", " ", text)
    return re.sub(r"\S*%[0-9A-F]{2}\S*", " ", text)


def fix_degrees(text: str) -> str:
    text = text.replace("℃", "°C").replace("º", "°")
    text = re.sub(r"(\d) 0C\b", r"\1°C", text)        # "40 0C" -> "40°C"
    text = re.sub(r"(\d)0C\b", r"\1°C", text)         # "400C"  -> "40°C"
    text = re.sub(r"(?<![\w.%])(\d+(?:\.\d+)?)C\b", r"\1°C", text)
    return text


def fix_symbols(text: str) -> str:
    # PDF bullet symbols (two invisible private-use characters from Word's Symbol font, then ♦ and •)
    for bullet in ["", "", "♦", "•"]:
        text = text.replace(bullet, "-")
    for curly, plain in {"“": '"', "”": '"', "‘": "'", "’": "'"}.items():
        text = text.replace(curly, plain)
    return re.sub(r"(\w) -(\w)", r"\1-\2", text)


def build_vocabulary(texts) -> Counter:
    return Counter(w.lower() for t in texts for w in re.findall(r"[A-Za-z]+", t))


def should_join(a: str, b: str, vocab: Counter) -> bool:
    """Join "tempe rature" -> "temperature": the joined word exists, and one half is a rare fragment."""
    is_word = vocab[(a + b).lower()] > 0
    has_fragment = min(vocab[a.lower()], vocab[b.lower()]) <= 2
    safe = a.lower() not in NEVER_JOIN and b.lower() not in NEVER_JOIN and len(a + b) >= 4
    return is_word and has_fragment and safe


def fix_split_words(text: str, vocab: Counter, joins: Counter) -> str:
    fixed_lines = []
    for line in text.split("\n"):
        words = line.split(" ")
        result, i = [], 0
        while i < len(words):
            if i + 1 < len(words):
                a = re.fullmatch(r"(\W*)([A-Za-z]+)", words[i])
                b = re.fullmatch(r"([a-z]+)(\W*)", words[i + 1])
                if a and b and should_join(a.group(2), b.group(1), vocab):
                    joins[f"{a.group(2)} {b.group(1)} -> {a.group(2) + b.group(1)}"] += 1
                    result.append(a.group(1) + a.group(2) + b.group(1) + b.group(2))
                    i += 2
                    continue
            result.append(words[i])
            i += 1
        fixed_lines.append(" ".join(result))
    return "\n".join(fixed_lines)


def squeeze_spaces(text: str) -> str:
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def clean_pages(pages: list[dict]) -> list[dict]:
    """Adds a "clean" text to every page (the order of the steps matters)."""
    vocab = build_vocabulary(p["text"] for p in pages)
    joins = Counter()
    for p in pages:
        text = remove_headers(p["text"])
        text = remove_links(text)
        text = fix_degrees(text)
        text = fix_symbols(text)
        text = squeeze_spaces(text)
        text = fix_split_words(text, vocab, joins)
        p["clean"] = squeeze_spaces(text)
    logger.info("Cleaned %d pages, joined %d split words", len(pages), sum(joins.values()))
    return pages

# ------------------------------------------------------------------ 3. cut into sections

SECTION_MARKERS = {
    "heat_faq": r"^Q\. ",
    "monsoon_faq": r"^\d{1,2}\. (?:What|How|Why|When|Which|Who|Where|Whether|Is|Are|Does|Do|Can|Will)\b",
    "forecast_sop": r"^\d+\.\d+(?:\.\d+)*\.? [A-Z]",
    "cyclone_terms": r"^[A-Z][A-Za-z ()/,\-]{1,50}\s?:",
}


def join_pages(doc_pages: list[dict]) -> tuple[str, list[tuple[int, int]]]:
    """One long text per document, plus where each page starts (to find page numbers later)."""
    text, page_starts = "", []
    for p in doc_pages:
        page_starts.append((len(text), p["page"]))
        text += p["clean"] + "\n"
    return text, page_starts


def page_at(position: int, page_starts: list[tuple[int, int]]) -> int:
    page = page_starts[0][1]
    for start, page_no in page_starts:
        if start <= position:
            page = page_no
    return page


def split_sections(doc_id: str, doc_pages: list[dict]) -> list[dict]:
    text, page_starts = join_pages(doc_pages)
    starts = [m.start() for m in re.finditer(SECTION_MARKERS[doc_id], text, re.M)]
    if not starts or starts[0] > 0:
        starts = [0] + starts
    starts.append(len(text))

    sections = []
    for begin, end in zip(starts, starts[1:]):
        section_text = text[begin:end].strip()
        if not section_text:
            continue
        sections.append({
            "doc_id": doc_id,
            "title": section_text.split("\n")[0][:120],
            "text": section_text,
            "page_start": page_at(begin, page_starts),
            "page_end": page_at(end - 1, page_starts),
        })
    return sections

# ------------------------------------------------------------------ 4. safety rules (too small / too big)

MIN_CHARS, MAX_CHARS, TARGET_CHARS, GLOSSARY_CHARS = 100, 1000, 800, 600


def group_glossary(terms: list[dict]) -> list[dict]:
    """Glossary terms are tiny: put neighbours together, up to ~600 characters per group."""
    groups, current = [], []
    for term in terms:
        if current and sum(len(t["text"]) for t in current) + len(term["text"]) > GLOSSARY_CHARS:
            groups.append(current)
            current = []
        current.append(term)
    if current:
        groups.append(current)
    return [{
        "doc_id": g[0]["doc_id"],
        "title": f"Glossary: {g[0]['title'].split(':')[0]} ... {g[-1]['title'].split(':')[0]}",
        "text": "\n".join(t["text"] for t in g),
        "page_start": g[0]["page_start"],
        "page_end": g[-1]["page_end"],
    } for g in groups]


def merge_small(doc_sections: list[dict]) -> list[dict]:
    """A section under MIN_CHARS is glued to the start of the next one (the last one to the previous)."""
    merged, carry = [], None
    for s in doc_sections:
        if carry:
            s = {**s, "text": carry["text"] + "\n" + s["text"], "page_start": carry["page_start"]}
            carry = None
        if len(s["text"]) < MIN_CHARS:
            carry = s
        else:
            merged.append(s)
    if carry and merged:
        merged[-1] = {**merged[-1], "text": merged[-1]["text"] + "\n" + carry["text"]}
    return merged


def last_sentence(text: str) -> str:
    sentences = re.split(r"(?<=[.?!])\s+", text.strip())
    return sentences[-1] if len(sentences[-1]) < 250 else ""


def split_big(section: dict) -> list[dict]:
    """A section over MAX_CHARS -> parts of ~TARGET_CHARS, each starting with the title, one sentence overlap."""
    if len(section["text"]) <= MAX_CHARS:
        return [section]
    body = section["text"][len(section["title"]):].strip()
    paragraphs = [p for p in re.split(r"\n\s*\n", body) if p.strip()]
    pieces = []
    for p in paragraphs:
        pieces += re.split(r"(?<=[.?!])\s+", p) if len(p) > TARGET_CHARS else [p]

    parts, current = [], ""
    for piece in pieces:
        if current and len(current) + len(piece) > TARGET_CHARS:
            parts.append(current)
            current = last_sentence(current)
        current = (current + "\n" + piece).strip()
    parts.append(current)

    n = len(parts)
    return [{**section, "text": f"{section['title']} (part {i}/{n})\n{part}", "part": f"{i}/{n}"}
            for i, part in enumerate(parts, start=1)]

# ------------------------------------------------------------------ 5. everything together

def make_chunks(documents: list[dict] = DOCUMENTS) -> list[dict]:
    pages = clean_pages(read_pages(documents))

    final_sections = []
    for doc in documents:
        doc_pages = [p for p in pages if p["doc_id"] == doc["doc_id"]]
        doc_sections = split_sections(doc["doc_id"], doc_pages)
        if doc["doc_id"] == "cyclone_terms":
            doc_sections = group_glossary(doc_sections)
        for s in merge_small(doc_sections):
            final_sections += split_big(s)

    doc_info = {d["doc_id"]: d for d in documents}
    chunks = [{
        "chunk_id": f"{s['doc_id']}-{i:03d}",
        "doc_id": s["doc_id"],
        "doc_title": doc_info[s["doc_id"]]["title"],
        "source_url": doc_info[s["doc_id"]]["url"],
        "page_start": s["page_start"],
        "page_end": s["page_end"],
        "section_title": s["title"],
        "text": s["text"],
        "chars": len(s["text"]),
    } for i, s in enumerate(final_sections)]
    logger.info("Made %d chunks", len(chunks))
    return chunks
