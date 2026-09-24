"""
Generate the Sylva architecture diagram.

    python3 docs/architecture/generate.py

Writes sylva-architecture.excalidraw next to this file. Drag that onto
excalidraw.com to open or edit it. Edit THIS file rather than the .excalidraw,
so the diagram stays reproducible and reviewable in a diff.

Keep it honest: a box says BUILT only if you have run it.
"""
import json, itertools

_id = itertools.count(1)
def nid(p="el"): return f"{p}-{next(_id):04d}"

FONT = 2          # Helvetica - institutional, not the hand-drawn Excalifont
LH   = 1.25

INK      = "#1e1e1e"
GREY     = "#868e96"
FOREST   = "#1f4d3a"
WATER    = "#1b5a78"
AMBER    = "#8a5a00"
RED      = "#9f2f2d"
BG_DONE  = "#e8f0ec"   # built
BG_NEXT  = "#fbf3db"   # next up
BG_LATER = "#f1f3f5"   # phase 2
BG_BROKEN= "#fdebec"   # built but not working
BG_ENG   = "#e1f3fe"   # the engine
WHITE    = "transparent"

els = []

def base(**kw):
    d = dict(id=nid(), x=0, y=0, strokeColor=INK, backgroundColor=WHITE,
             fillStyle="solid", strokeWidth=1, strokeStyle="solid",
             roundness=None, roughness=0, opacity=100, width=10, height=10,
             angle=0, seed=next(_id)*7919, version=1, versionNonce=next(_id)*104729,
             index=None, isDeleted=False, groupIds=[], frameId=None,
             boundElements=None, updated=1, created=None, link=None, locked=False)
    d.update(kw); return d

def text(x, y, s, size=16, color=INK, w=None, align="left"):
    lines = s.split("\n")
    width = w if w else max(len(l) for l in lines) * size * 0.52
    height = len(lines) * size * LH
    e = base(type="text", x=x, y=y, width=width, height=height,
             strokeColor=color, fontSize=size, fontFamily=FONT, baseFontSize=None,
             text=s, originalText=s, textAlign=align, verticalAlign="top",
             containerId=None, lineHeight=LH, autoResize=True)
    els.append(e); return e

def rect(x, y, w, h, bg=WHITE, stroke=INK, sw=1, dashed=False, round_=True):
    e = base(type="rectangle", x=x, y=y, width=w, height=h,
             backgroundColor=bg, strokeColor=stroke, strokeWidth=sw,
             strokeStyle="dashed" if dashed else "solid",
             roundness={"type": 3} if round_ else None)
    els.append(e); return e

def arrow(x, y, pts, color=GREY, sw=1, dashed=False, head="arrow"):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    e = base(type="arrow", x=x, y=y,
             width=max(xs)-min(xs) or 1, height=max(ys)-min(ys) or 1,
             strokeColor=color, strokeWidth=sw,
             strokeStyle="dashed" if dashed else "solid",
             points=[list(map(float, p)) for p in pts],
             startBinding=None, endBinding=None,
             startArrowhead=None, endArrowhead=head,
             roundness={"type": 2}, elbowed=False)
    els.append(e); return e

CARD_W = 268
def card(x, y, title, status, bullets, accent=INK):
    """status: 'built' | 'ui' | 'broken' | 'next' | 'later'"""
    bg = {"built": BG_DONE, "ui": BG_NEXT, "broken": BG_BROKEN,
          "next": BG_NEXT, "later": BG_LATER}[status]
    tag = {"built": "BUILT", "ui": "UI ONLY", "broken": "BROKEN",
           "next": "NEXT", "later": "PHASE 2"}[status]
    body = "\n".join("- " + b for b in bullets)
    h = 34 + 20 + len(bullets) * 12 * LH + 18
    rect(x, y, CARD_W, h, bg=bg, stroke=accent, sw=1)
    text(x + 14, y + 12, title, size=15, color=accent, w=CARD_W - 28)
    text(x + CARD_W - 78, y + 13, tag, size=9,
         color={"built": FOREST, "ui": AMBER, "broken": RED,
                "next": AMBER, "later": GREY}[status], w=64, align="right")
    text(x + 14, y + 36, body, size=12, color=INK, w=CARD_W - 28)
    return x, y, CARD_W, h

def lane(x, y, w, h, label, sub, color):
    rect(x, y, w, h, bg=WHITE, stroke=color, sw=2, dashed=True)
    text(x + 16, y + 12, label, size=18, color=color)
    text(x + 16, y + 36, sub, size=12, color=GREY)

# ===========================================================================
X0, GAP = 80, 300
def col(i): return X0 + 30 + i * GAP

# ---------- title ----------
text(X0, 40, "Sylva — European wetland restoration platform", size=30)
text(X0, 82, "Page architecture, user flows and current build state.  Regenerate with: python3 docs/architecture/generate.py", size=13, color=GREY)
text(X0, 104, "Every page carries: EU emblem + \"Co-funded by the European Union\" + grant-agreement disclaimer  ·  EN / DE  ·  demo-data notice", size=13, color=WATER)

# ---------- legend ----------
ly = 140
_L = [(190, "BUILT \u00b7 runs & tested",        BG_DONE,   FOREST),
      (250, "UI ONLY \u00b7 demo data, not wired", BG_NEXT,   AMBER),
      (205, "BROKEN \u00b7 raw i18n keys",       "#fdebec", RED),
      (165, "NOT STARTED",                     BG_LATER,  GREY),
      (150, "Engine \u00b7 done",                BG_ENG,    WATER)]
_x = X0
for _w, _label, _bg, _fg in _L:
    rect(_x, ly, _w, 26, bg=_bg, stroke=_fg)
    text(_x + 12, ly + 6, _label, size=12, color=_fg)
    _x += _w + 15

# ===================== LANE 1 — PUBLIC =====================
LY1 = 200
lane(X0, LY1, 1520, 300, "1 · PUBLIC", "No account. Indexable, shareable, server-rendered.", INK)
y = LY1 + 66
card(col(0), y, "Landing", "built", [
    "What the platform is, in plain words",
    "7-step flow: project -> evidence ->",
    "  interest -> deal -> verified -> units",
    "8 things you can evaluate",
    "NOT the registry — stated here",
], FOREST)
card(col(1), y, "Projects index", "built", [
    "Filters: country, outcome, status",
    "SORT: near my sites / my catchment",
    "Map draws catchment polygons",
    "Card per project with its OWN units",
    "Reads the REAL database (RLS)",
    "NO cross-project totals anywhere",
], FOREST)
card(col(2), y, "Project page", "ui", [
    "THE most important page",
    "10-min read for a finance analyst",
    "11 sections — see lane 1b below",
    "Own URL, shareable, indexable",
    "Express interest (primary action)",
    "13 section components, demo data",
], AMBER)
card(col(3), y, "Public record", "ui", [
    "Append-only event list",
    "Buyer 014 - one label PER DEAL",
    "  + sector, country, size",
    "Named only if that deal opted in",
    "RISK: small pilot -> re-identifiable",
], AMBER)
card(col(4), y, "Explainer pages", "ui", [
    "How it works / For buyers /",
    "  For investors = UI ONLY",
    "About = BROKEN (5 raw keys)",
    "No marketing language",
    "No stock photography",
], GREY)

arrow(col(0)+CARD_W+8, y+50, [[0,0],[GAP-CARD_W-16,0]])
arrow(col(1)+CARD_W+8, y+50, [[0,0],[GAP-CARD_W-16,0]])
arrow(col(2)+CARD_W+8, y+50, [[0,0],[GAP-CARD_W-16,0]])

# ===================== LANE 1b — PROJECT PAGE ANATOMY =====================
LY1b = 530
lane(X0, LY1b, 1520, 410, "1b · PROJECT PAGE — the eleven sections", "The page a buyer forwards to a colleague. Every figure carries source + date.", AMBER)
sec = [
    ("1 Header", ["Name, owner, location", "Status + verification status", "Express interest / documents"]),
    ("2 Catchment map", ["Boundary + catchment, satellite", "Download GeoJSON", "Same catchment? yes/no",
         "Distance to boundary (private)"]),
    ("3 Claim rights", ["Benefit | who may claim |", "  allowed use | EXCLUSIONS", "Deal-breaker for buyers"]),
    ("4 Outcomes", ["WATER and BIODIVERSITY apart", "Metric, baseline, target, method", "Verifier + stated uncertainty"]),
    ("5 Durability", ["Who controls the land", "Who maintains, how long", "What happens after the contract"]),
    ("6 Availability", ["Per period: expected, buffer,", "  committed, remaining", "This project's unit type ONLY"]),
    ("7 Documents", ["Idea note, design document,", "  monitoring plan, verification", "Version, date, uploader"]),
    ("8 Partners", ["Developer, landowner, verifier", "Buyers judge by the people"]),
    ("9 Evidence pack", ["Action, timeframe, impact,", "  BUDGET, verification standard", "Budget vs investor-only: OPEN"]),
    ("10 Investor block", ["Financing need, revenue, model", "Vetted investors only", "PHASE 2 - shown as locked"]),
    ("11 Private questions", ["To owner + operator", "NO public comments"]),
]
SW, SH = 268, 88
for i, (t, bs) in enumerate(sec):
    cx = X0 + 30 + (i % 5) * GAP
    cy = LY1b + 66 + (i // 5) * 106
    rect(cx, cy, SW, SH, bg="#fffaf0", stroke=AMBER)
    text(cx + 12, cy + 10, t, size=13, color=AMBER, w=SW-24)
    text(cx + 12, cy + 30, "\n".join(bs), size=11, w=SW-24)

# ===================== LANE 2 — ACCOUNT & VETTING =====================
LY2 = 970
lane(X0, LY2, 1520, 240, "2 · ACCOUNT & VETTING", "Nobody transacts without being vetted. This is the anti-greenwashing gate.", WATER)
y = LY2 + 66
card(col(0), y, "Register", "ui", [
    "Organisation + first person",
    "Personal data -> ONE table only",
    "Role: buyer / owner / investor",
], WATER)
card(col(1), y, "Sign in", "ui", [
    "Session in identity.user_session",
    "No IP, no user-agent stored",
    "Signed org context per request",
], WATER)
card(col(2), y, "Vetting questionnaire", "ui", [
    "What you intend to claim",
    "How you operate",
    "Your sustainability approach",
    "Onward sale? Offset? Exclusive?",
], WATER)
card(col(3), y, "Awaiting decision", "broken", [
    "Clear state, no dead end",
    "Declined -> reason shown",
    "Cannot reach any deal screen",
    "2 raw i18n keys - needs fixing",
], RED)
card(col(4), y, "Operator decides", "built", [
    "Approve / decline / suspend",
    "Approval DERIVED from decision",
    "  (never written directly)",
    "R6 enforced in Postgres",
], FOREST)
for i in range(4):
    arrow(col(i)+CARD_W+8, y+50, [[0,0],[GAP-CARD_W-16,0]], color=WATER)


# ===================== LANE 2b - PROJECT OWNER =====================
LY_OWN = 1240
lane(X0, LY_OWN, 1520, 250, "2b \u00b7 PROJECT OWNER", "One of the five user types in the note: owners put projects on the platform and answer questions. Release 1.", AMBER)
y = LY_OWN + 66
card(col(0), y, "Owner dashboard", "broken", [
    "My projects and their status",
    "What is blocking publication",
    "Open questions, open interest",
    "133 raw i18n keys",
], RED)
card(col(1), y, "Create / edit project", "broken", [
    "Text, outcomes, claim rights,",
    "  durability, partners, periods",
    "Upload boundary + catchment",
    "Every figure needs source + date",
    "600 raw i18n keys - biggest fix",
], RED)
card(col(2), y, "Submit for review", "ui", [
    "Shows the publication gate list",
    "The SAME list the database checks",
    "Cannot publish itself",
], AMBER)
card(col(3), y, "Question inbox", "ui", [
    "Private questions from buyers",
    "Goes to owner AND operator",
    "Section 11 now has a destination",
    "No public comments, ever",
], AMBER)
card(col(4), y, "Interest inbox", "later", [
    "Who expressed interest",
    "Buyer shown per disclosure rules",
    "Respond / hand to operator",
], AMBER)
for i in range(4):
    arrow(col(i)+CARD_W+8, y+50, [[0,0],[GAP-CARD_W-16,0]], color=AMBER)

# ===================== LANE 3 — BUYER =====================
LY3 = 1530
lane(X0, LY3, 1520, 250, "3 · BUYER (vetted)", "A buyer must never see another buyer's prices, terms, documents, messages or identity.", FOREST)
y = LY3 + 66
card(col(0), y, "Buyer dashboard", "ui", [
    "My interests, deals, documents",
    "Organisation + vetting status",
    "Not an analytics dashboard",
], FOREST)
card(col(1), y, "My sites", "ui", [
    "Register company sites",
    "Distance to each project",
    "PRIVATE — anon role has no grant",
    "Proven: RLS + privilege, 2 layers",
], FOREST)
card(col(2), y, "Express interest", "ui", [
    "Checks org is approved (R6)",
    "Writes interest event to record",
    "RELEASE 1: confirmation screen,",
    "  emails owner + operator,",
    "  states the next step. NO room.",
    "Room opens in Phase 2",
], AMBER)
card(col(3), y, "Deal room", "later", [
    "Messages, documents, versions",
    "Draft terms + versions",
    "Stage: interest -> LOI ->",
    "  term sheet -> signed",
    "Not a chat app",
], GREY)
card(col(4), y, "Three deal shapes", "later", [
    "Spot volume (units exist)",
    "Forward (future period) — most",
    "Co-investment (funds a share)",
    "Reserved at term sheet,",
    "  committed at signed",
    "BOTH count against R1 (fixed)",
], GREY)
for i in range(4):
    arrow(col(i)+CARD_W+8, y+56, [[0,0],[GAP-CARD_W-16,0]], color=FOREST)

# ===================== LANE 4 — INVESTOR / OPERATOR / AUDITOR =====================
LY4 = 1810
lane(X0, LY4, 1520, 250, "4 · INVESTOR, OPERATOR, AUDITOR", "Investor financial data is visible only to vetted investors. Auditors read everything and change nothing.", GREY)
y = LY4 + 66
card(col(0), y, "Investor view", "later", [
    "Financing need, revenue streams",
    "Financial model download",
    "Gated: vetted investors only",
    "Comes in after buyers commit",
], GREY)
card(col(1), y, "Operator — vetting queue", "next", [
    "Review submissions",
    "Approve / decline / suspend",
    "Every decision is recorded",
], FOREST)
card(col(2), y, "Operator — publish", "next", [
    "Publication GATE in the database:",
    "  text, boundary, claim rights,",
    "  outcomes, baseline, durability,",
    "  verifier, PIN, PDD, availability",
    "123 raw i18n keys",
], RED)
card(col(3), y, "Operator — record", "next", [
    "Confirm registry references",
    "Corrections = NEW entry",
    "  pointing at the wrong one",
    "Nothing is ever edited",
], FOREST)
card(col(4), y, "Auditor", "later", [
    "Read-only, everything",
    "Org names ALWAYS",
    "Person names until erasure",
    "DELETE denied at DB level",
    "Loses names after erasure",
], FOREST)

# ===================== LANE 5 — THE ENGINE =====================
LY5 = 2090
lane(X0, LY5, 1520, 500, "5 · THE ENGINE — already built, tested, invisible to users", "PostgreSQL 16 + PostGIS 3.5. The rules live here because application code gets rewritten and the rules must survive that.", WATER)
y = LY5 + 66
card(col(0), y, "Schema", "built", [
    "81 tables, 31 migrations",
    "Personal data in ONE table",
    "person_ref is an FK to NOTHING",
    "  -> erasure never breaks history",
], WATER)
card(col(1), y, "The seven rules", "built", [
    "R1 reserved+committed <= exp-buffer",
    "R2 registry ref required",
    "R3 retired/cancelled is terminal",
    "R4 append-only (privilege+trigger)",
    "R5 pseudonym PER DEAL (fixed)",
    "R6 no deal for unapproved org",
    "R7 partly in DB + tests/review",
], WATER)
card(col(2), y, "Row-level security", "built", [
    "216 policies, 20 CI guards",
    "6 login roles, none BYPASSRLS",
    "Role = current_user (unforgeable)",
    "Org = HMAC-signed context",
    "FINDING-001 found & fixed",
], WATER)
card(col(3), y, "Geography", "built", [
    "PostGIS, SRID 4326",
    "Boundary + catchment per project",
    "Geodesic distance to BOUNDARY",
    "Point-in-polygon = same catchment",
    "Buyer sites private",
], WATER)
card(col(4), y, "Provenance & EU", "built", [
    "Every figure -> source_ref + date",
    "Storage region FK to EU states:",
    "  London / Zurich REJECTED",
    "EN/DE, 132 keys, full parity",
], WATER)
card(col(0), y+200, "Platform services", "later", [
    "Analytics: self-hosted, EU, no",
    "  third-party trackers (day one)",
    "Email: vetting decisions,",
    "  questions, interest - EU provider",
    "App + backups + logs: ONE named",
    "  EU region, not only storage",
], AMBER)
card(col(1), y+200, "The record", "built", [
    "All 9 note events present:",
    "  listed, offered, interest,",
    "  terms proposed, agreed, issued,",
    "  allocated, retired, cancelled",
    "+ correction, transferred,",
    "  withdrawn, declined, lapsed",
], WATER)
card(col(2), y+200, "Erasure - structured", "built", [
    "person_ref is an FK to nothing",
    "DELETE always succeeds",
    "erasure_event records THAT,",
    "  never who",
], WATER)
card(col(3), y+200, "Erasure - free text & files", "later", [
    "Messages, questionnaire answers,",
    "  signed PDFs contain names",
    "One-table design does NOT cover",
    "  these. Needs a rule:",
    "  redact a copy, keep the hash",
], RED)

card(col(4), y+200, "NOT WIRED YET", "later", [
    "Authentication (tables exist)",
    "All form submissions",
    "Document upload / storage",
    "Map basemap (tile provider = OPEN)",
    "Analytics, email, EU region cfg",
    "Only the index + project page",
    "  read the real database",
], RED)

# ---------- cross-cutting note ----------
ny = LY5 + 530
rect(X0, ny, 1520, 196, bg="#fdebec", stroke=RED)
text(X0+18, ny+14, "OPEN — needs the client before launch", size=15, color=RED)
text(X0+18, ny+38, "1  EU emblem asset + exact disclaimer wording from the grant agreement (renders as a red placeholder until supplied)\n"
                   "2  Public record still carries sector + country + size on every row. Per-deal labels no longer link a buyer's deals, but those three\n"
                   "     attributes still match a named row to a pseudonymous one. Needs a k-anonymity rule - suppress below a minimum buyer count.\n"
                   "3  Availability: expected / buffer / reserved / committed / remaining are mutually determining. With one buyer, committed IS their volume.\n"
                   "     Options: publish committed in bands, suppress below a threshold, or accept it. Product decision, not an engineering one.\n"
                   "4  Evidence pack needs a budget (note section 6) but budgets are investor-only. Decide which figure goes in and who may download it.\n"
                   "5  May a registered but NOT YET vetted buyer add sites? Recommended yes - sites are private and it helps them decide whether to apply.\n"
                   "6  Auditors and erasure: does the grant agreement require retaining named individuals for a fixed period? That would override erasure.\n"
                   "7  Demo-data notice needs a removal plan for launch.   8  Co-investor claim rights on volume sold onward - one buyer said this decides participation.", size=12, color=INK)

# ---------- do-not-build ----------
dy = ny + 216
rect(X0, dy, 1520, 58, bg="#f1f3f5", stroke=GREY)
text(X0+18, dy+12, "NOT BUILT, DELIBERATELY", size=13, color=GREY)
text(X0+18, dy+32, "payments  ·  escrow  ·  settlement  ·  an official credit registry  ·  automatic legal or environmental claims  ·  public comments  ·  public buyer identities by default  ·  cross-project unit totals", size=12, color=GREY)

doc = {
    "type": "excalidraw",
    "version": 2,
    "source": "https://excalidraw.com",
    "elements": els,
    "appState": {"gridSize": None, "viewBackgroundColor": "#ffffff"},
    "files": {},
}
import os, html as _html
HERE = os.path.dirname(os.path.abspath(__file__))

out = os.path.join(HERE, "sylva-architecture.excalidraw")
with open(out, "w") as f:
    json.dump(doc, f, indent=2, ensure_ascii=False)
print("wrote", out)


def write_svg(elements, path):
    """A plain SVG of the same diagram, so it opens in any browser with no tool."""
    PAD = 40
    xs = [e["x"] for e in elements] + [e["x"] + e["width"] for e in elements]
    ys = [e["y"] for e in elements] + [e["y"] + e["height"] for e in elements]
    minx, maxx, miny, maxy = min(xs) - PAD, max(xs) + PAD, min(ys) - PAD, max(ys) + PAD
    w, h = maxx - minx, maxy - miny
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w:.0f}" height="{h:.0f}" '
         f'viewBox="{minx} {miny} {w} {h}">',
         f'<rect x="{minx}" y="{miny}" width="{w}" height="{h}" fill="#fff"/>',
         '<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" '
         'markerHeight="6" orient="auto-start-reverse">'
         '<path d="M0,0 L10,5 L0,10 z" fill="#868e96"/></marker></defs>']
    for e in elements:
        t = e["type"]
        if t == "rectangle":
            fill = e["backgroundColor"] if e["backgroundColor"] != "transparent" else "none"
            dash = ' stroke-dasharray="8 6"' if e["strokeStyle"] == "dashed" else ""
            o.append(f'<rect x="{e["x"]}" y="{e["y"]}" width="{e["width"]}" '
                     f'height="{e["height"]}" rx="6" fill="{fill}" '
                     f'stroke="{e["strokeColor"]}" stroke-width="{e["strokeWidth"]}"{dash}/>')
        elif t == "text":
            fs = e["fontSize"]; lh = fs * e["lineHeight"]
            anc = {"left": "start", "right": "end", "center": "middle"}[e["textAlign"]]
            ax = e["x"] if anc == "start" else (e["x"] + e["width"] if anc == "end"
                                                else e["x"] + e["width"] / 2)
            wt = ' font-weight="600"' if fs >= 15 else ""
            for i, line in enumerate(e["text"].split("\n")):
                o.append(f'<text x="{ax}" y="{e["y"] + lh * (i + 0.8):.1f}" '
                         f'font-family="Helvetica,Arial,sans-serif" font-size="{fs}" '
                         f'fill="{e["strokeColor"]}" text-anchor="{anc}"{wt}>'
                         f'{_html.escape(line)}</text>')
        elif t == "arrow":
            pts = " ".join(f'{e["x"] + p[0]},{e["y"] + p[1]}' for p in e["points"])
            o.append(f'<polyline points="{pts}" fill="none" stroke="{e["strokeColor"]}" '
                     f'stroke-width="{e["strokeWidth"]}" marker-end="url(#a)"/>')
    o.append("</svg>")
    open(path, "w").write("\n".join(o))
    print(f"wrote {path}  ({w:.0f}x{h:.0f})")


write_svg(els, os.path.join(HERE, "sylva-architecture.svg"))
print("elements:", len(els))
