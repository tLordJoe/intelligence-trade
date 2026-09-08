"""Independent read-only field cross-check using pdfplumber, not the app parser.
Checks source ticker, direction, transaction date, amount and option tag as a
multiset per document. It does not validate issuer names or claim OCR coverage.
Usage: python check-house-recovery-pdfs.py CANDIDATE_JSON PDF_DIRECTORY
"""
import collections
import hashlib
import json
import pathlib
import re
import sys
import pdfplumber

candidate = json.loads(pathlib.Path(sys.argv[1]).read_text())
pdf_dir = pathlib.Path(sys.argv[2])
def symbol(value):
    return re.sub(r"[.\-]", "", value.upper())
def money(value):
    return float(value.replace(",", ""))

findings = []
matched = 0
for source in candidate["findings"]:
    doc = source["docId"]
    path = pdf_dir / (doc + ".pdf")
    if hashlib.sha256(path.read_bytes()).hexdigest() != source["sourceSha256"]:
        raise ValueError("Source hash changed: " + doc)
    with pdfplumber.open(path) as pdf:
        text = "\n".join(page.extract_text() or "" for page in pdf.pages).replace("\x00", "")
    text = re.sub(r"\$200\?", "", text)
    actual = []
    unresolved = []
    for block in re.split(r"\bF\s*S\s*:\s*(?:New|Amended|Amendment|Corrected)\b", text, flags=re.I):
        # pdfplumber orders by printed coordinates: a wrapped tag may follow
        # the row's type/date/amount cells rather than the ticker immediately.
        tags = list(re.finditer(r"\(([A-Z][A-Z0-9.\-]{0,6})\)(?:\s+(?:P|S\s*\(partial\)|S|E)\s+\d{2}/\d{2}/\d{4}[^\[\]]{0,180})?\s*(?:\$[\d,]+(?:\.\d{2})?\s*)?\[(ST|OP|CS|ET)\]", block))
        if not tags:
            continue
        types = list(re.finditer(r"\b(P|S\s*\(partial\)|S|E)\s+(\d{2}/\d{2}/\d{4})", block))
        if len(tags) != 1 or len(types) != 1:
            unresolved.append({"symbols":[t[1] for t in tags],"typeMatches":len(types)})
            continue
        tag, typ = tags[0], types[0]
        cells = block[typ.end():]
        amount = re.search(r"\$([\d,]+(?:\.\d{2})?)\s*-\s*[^$]{0,220}?\$([\d,]+(?:\.\d{2})?)", cells)
        if amount:
            low, high = money(amount[1]), money(amount[2])
        else:
            exact = re.search(r"\$([\d,]+(?:\.\d{2})?)", cells)
            if not exact:
                unresolved.append({"symbols":[tag[1]],"reason":"no amount"})
                continue
            low = high = money(exact[1])
        month, day, year = typ[2].split("/")
        actual.append((symbol(tag[1]),{"P":"Buy","S":"Sell","E":"Exchange"}[typ[1][0]],
                       f"{year}-{month}-{day}",low,high,tag[2]=="OP"))
    expected = [(symbol(r["raw"]["tickerText"]),r["type"],r["transactionDate"],r["amountLow"],r["amountHigh"],r["isOptions"])
                for r in candidate["candidate"]["trades"] if r["provenance"]["docId"]==doc]
    a, e = collections.Counter(actual), collections.Counter(expected)
    matches = sum((a & e).values())
    matched += matches
    if a != e or unresolved:
        findings.append({"docId":doc,"matched":matches,"sourceOnly":list((a-e).elements()),
                         "candidateOnly":list((e-a).elements()),"unresolved":unresolved})
print(json.dumps({"method":"independent pdfplumber extraction; per-document economic-field multiset",
                  "documents":len(candidate["findings"]),"matchedRows":matched,"differences":findings},indent=2))
sys.exit(1 if findings else 0)
