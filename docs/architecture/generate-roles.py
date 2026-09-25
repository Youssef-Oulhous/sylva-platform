"""
Generate the per-role capability diagram.

    python3 docs/architecture/generate-roles.py

Writes sylva-roles.excalidraw and sylva-roles.svg next to this file. Drag the
.excalidraw onto excalidraw.com to open or edit; the .svg opens in any browser.

Edit THIS file rather than the output, so the diagram stays reviewable in a diff.
Every line below was verified against the running platform on 24 Sep 2026 by
signing in as that account and trying it. A bullet marked built means it was
seen working, not that it appears in a specification.
"""
import json, itertools, os, html as _html

_id = itertools.count(1)
def nid(): return f"el-{next(_id):04d}"

FONT, MONO, LH = 2, 3, 1.25
INK, GREY, FOREST, WATER = "#1e1e1e", "#868e96", "#1f4d3a", "#1b5a78"
AMBER, RED = "#8a5a00", "#9f2f2d"
BG_CORE, BG_PLATFORM, BG_PUBLIC, BG_NOTACC = "#e8f0ec", "#e1f3fe", "#f5f5f3", "#faf7f0"

els = []

def base(**kw):
    d = dict(id=nid(), x=0, y=0, strokeColor=INK, backgroundColor="transparent",
             fillStyle="solid", strokeWidth=1, strokeStyle="solid", roundness=None,
             roughness=0, opacity=100, width=10, height=10, angle=0,
             seed=next(_id) * 7919, version=1, versionNonce=next(_id) * 104729,
             index=None, isDeleted=False, groupIds=[], frameId=None,
             boundElements=None, updated=1, created=None, link=None, locked=False)
    d.update(kw); return d

def text(x, y, s, size=14, color=INK, w=None, mono=False, align="left"):
    lines = s.split("\n")
    width = w if w else max((len(l) for l in lines), default=1) * size * (0.60 if mono else 0.52)
    e = base(type="text", x=x, y=y, width=width, height=len(lines) * size * LH,
             strokeColor=color, fontSize=size, fontFamily=MONO if mono else FONT,
             baseFontSize=None, text=s, originalText=s, textAlign=align,
             verticalAlign="top", containerId=None, lineHeight=LH, autoResize=True)
    els.append(e); return e

def rect(x, y, w, h, bg="transparent", stroke=INK, sw=1, dashed=False, radius=True):
    els.append(base(type="rectangle", x=x, y=y, width=w, height=h, backgroundColor=bg,
                    strokeColor=stroke, strokeWidth=sw,
                    strokeStyle="dashed" if dashed else "solid",
                    roundness={"type": 3} if radius else None))

def line(x, y, w, color=GREY):
    els.append(base(type="line", x=x, y=y, width=w, height=0, strokeColor=color,
                    strokeWidth=1, points=[[0, 0], [float(w), 0]],
                    startBinding=None, endBinding=None,
                    startArrowhead=None, endArrowhead=None, roundness=None))

def arrow(x, y, pts, color=GREY, dashed=False):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    els.append(base(type="arrow", x=x, y=y, width=max(xs) - min(xs) or 1,
                    height=max(ys) - min(ys) or 1, strokeColor=color, strokeWidth=1.5,
                    strokeStyle="dashed" if dashed else "solid",
                    points=[list(map(float, p)) for p in pts],
                    startBinding=None, endBinding=None, startArrowhead=None,
                    endArrowhead="arrow", roundness={"type": 2}, elbowed=False))

CARD_W = 452
PAD = 16

def card(x, y, num, name, login, tint, accent, purpose, can, cannot, note=None):
    """can is a list of (text, built); cannot is a list of plain strings."""
    body_lines = 1 + len(can) + 1 + len(cannot) + (2 if note else 0)
    note_lines = note.count("\n") + 1 if note else 0
    h = 52 + 18 + 20 + len(can) * 17 + 22 + len(cannot) * 17 + (20 + note_lines * 15 if note else 0) + 14
    rect(x, y, CARD_W, h, bg=tint, stroke=accent)
    rect(x, y, CARD_W, 34, bg=accent, stroke=accent)
    text(x + PAD, y + 9, f"{num}   {name}", size=15, color="#ffffff", w=CARD_W - 2 * PAD)
    cy = y + 42
    text(x + PAD, cy, login, size=11, color=accent, mono=True, w=CARD_W - 2 * PAD)
    cy += 20
    text(x + PAD, cy, purpose, size=12, color=INK, w=CARD_W - 2 * PAD)
    cy += 22

    text(x + PAD, cy, "CAN", size=10, color=FOREST, w=60)
    cy += 16
    for t, built in can:
        mark = "+" if built else "~"
        col = INK if built else AMBER
        text(x + PAD, cy, f"{mark}  {t}", size=12, color=col, w=CARD_W - 2 * PAD)
        cy += 17
    cy += 6

    text(x + PAD, cy, "CANNOT", size=10, color=RED, w=80)
    cy += 16
    for t in cannot:                       # plain strings, not tuples
        text(x + PAD, cy, f"-  {t}", size=12, color=GREY, w=CARD_W - 2 * PAD)
        cy += 17

    if note:
        cy += 8
        line(x + PAD, cy, CARD_W - 2 * PAD)
        text(x + PAD, cy + 7, note, size=11, color=AMBER, w=CARD_W - 2 * PAD)
    return h

# ===========================================================================
X0, GAP = 70, 44
def col(i): return X0 + i * (CARD_W + GAP)

text(X0, 40, "Sylva - who can do what", size=30)
text(X0, 82, "Every line verified on the running platform, 24 September 2026, by signing in as that account and trying it.", size=13, color=GREY)
text(X0, 104, "+ built and seen working        ~ partly built        - refused, by the database and not by the interface", size=12, color=WATER)

# ---- legend for the three groups ----
ly = 138
for lx, lw, label, bg, fg in [
        (X0, 250, "BRINGS SOMETHING TO THE PLATFORM", BG_CORE, FOREST),
        (X0 + 265, 200, "RUNS / CHECKS THE PLATFORM", BG_PLATFORM, WATER),
        (X0 + 480, 175, "NO LOGIN ACCOUNT", BG_NOTACC, AMBER)]:
    rect(lx, ly, lw, 26, bg=bg, stroke=fg)
    text(lx + 12, ly + 6, label, size=11, color=fg)

# ================= ROW 1 - the three who bring something =================
ry = 200
text(X0, ry - 18, "THE THREE WHO BRING SOMETHING", size=12, color=FOREST)

h1 = card(col(0), ry, "1", "PROJECT OWNER", "owner.a@demo.sylva.example", BG_CORE, FOREST,
    "Runs the restoration. Needs buyers and financing.",
    [("Create a project: name, location, boundary, catchment", True),
     ("Outcomes: baseline, verifier, stated uncertainty", True),
     ("Claim rights, with the exclusions", True),
     ("Partners: developer, land owner, verifier", True),
     ("Availability: periods, expected, BUFFER, unit type", True),
     ("Upload documents (idea note, design document)", True),
     ("Every figure paired with its source + as-of date", True),
     ("Answer buyers' private questions", True),
     ("See what is still blocking publication", True),
     ("Durability section, submit-for-review button", False)],
    [("Publish its own project - only Sylva can"),
     ("Touch another owner's project"),
     ("Edit anything: append-only, an edit is version + 1")],
    "13 forms, 120 inputs at /owner/projects/[slug]")

h2 = card(col(1), ry, "2", "BUYER / COMPANY", "buyer.a@demo.sylva.example", BG_CORE, FOREST,
    "Wants units, or the benefit. Asks: is this relevant to me?",
    [("Register its own sites (factory, brewery, plant)", True),
     ("DISTANCE from its sites to each project", True),
     ("Same-catchment yes/no answer", True),
     ("Read claim rights and what is EXCLUDED", True),
     ("Availability per period, with the unit named", True),
     ("Verifier, monitoring plan, documents", True),
     ("Ask a PRIVATE question (no public comments exist)", True),
     ("Express interest -> deal + permanent record entry", True),
     ("Complete vetting, track its status", True)],
    [("See another buyer's sites, deals, terms or identity"),
     ("See investor financials - shows WITHHELD"),
     ("Reach the owner, admin or auditor areas")],
    "Verified: 23 km and 241 km to the Havel project")

h3 = card(col(2), ry, "3", "INVESTOR", "investor.a@demo.sylva.example", BG_CORE, FOREST,
    "A bank or fund. Finances the project, repaid from revenue.",
    [("Everything the public can see", True),
     ("FINANCING NEED - nobody else sees this", True),
     ("Revenue streams the project expects", True),
     ("Download the financial model", True),
     ("Ask a private question", True),
     ("Complete vetting", True)],
    [("Register sites - that is a buyer's feature"),
     ("EXPRESS INTEREST - only buyers can create a deal"),
     ("Reach the owner, admin or auditor areas")],
    "No return, yield or IRR anywhere - not ours to state")

# ================= ROW 2 - platform side =================
ry2 = ry + max(h1, h2, h3) + 58
text(X0, ry2 - 18, "RUNS THE PLATFORM, AND CHECKS IT", size=12, color=WATER)

h4 = card(col(0), ry2, "4", "SYLVA OPERATOR", "operator@demo.sylva.example", BG_PLATFORM, WATER,
    "Sylva itself. Decides who may transact, and what goes public.",
    [("Vetting queue: approve / decline / suspend", True),
     ("Every decision needs a written reason", True),
     ("Approval is DERIVED from the decision by trigger", True),
     ("Publish a project, once the gate passes", True),
     ("See real identities behind a pseudonym", True),
     ("Confirm and correct transaction records", False)],
    [("Force publication past the gate - the DB refuses"),
     ("Edit or delete a record entry - corrections are NEW rows")],
    "/admin/record is a 404 - not built yet")

h5 = card(col(1), ry2, "5", "AUDITOR", "auditor@demo.sylva.example", BG_PLATFORM, WATER,
    "For the funder and external audit. Inspects, changes nothing.",
    [("Read EVERYTHING, including drafts", True),
     ("Non-public record entries", True),
     ("Organisation names, always", True),
     ("Documents, registry references, verification", True)],
    [("Write anything, anywhere, ever"),
     ("Create a deal or buy a unit")],
    "Only button on the page is Sign out. A guard walks every\ntable and fails if the auditor holds any write privilege.")

h6 = card(col(2), ry2, "6", "ANONYMOUS VISITOR", "no account needed", BG_PUBLIC, GREY,
    "Discovers projects. The page is shareable and indexable.",
    [("Browse the projects index", True),
     ("Read a full project page, all 11 sections", True),
     ("Download the boundary GeoJSON", True),
     ("Read the public transaction record", True),
     ("See a buyer as 'Buyer 014', with sector and country", True)],
    [("See an unpublished project - returns nothing, not a 403"),
     ("See any buyer's site locations"),
     ("See investor financials"),
     ("See a buyer's real name unless THAT deal was disclosed")],
    None)

# ================= ROW 3 - not accounts =================
ry3 = ry2 + max(h4, h5, h6) + 58
text(X0, ry3 - 18, "NAMED ON THE PLATFORM, BUT NOT USERS OF IT", size=12, color=AMBER)

h7 = card(col(0), ry3, "7", "INDEPENDENT VERIFIER", "no account - information only", BG_NOTACC, AMBER,
    "Checks whether the ecological result meets the scheme's rules.",
    [("Named on every project page", True),
     ("Their monitoring plan is shown", True),
     ("Baseline and stated uncertainty shown", True)],
    ["Log in - there is no verifier account",
     "Act on the platform at all"],
    "The note defines no verifier workflow, so we invented none")

h8 = card(col(1), ry3, "8", "LANDOWNER", "no account - information only", BG_NOTACC, AMBER,
    "Owns the land. NOT necessarily the one running the project.",
    [("Named on the project page, separately from the developer", True),
     ("A buyer can see who controls the land, and for how long", True)],
    ["Log in - there is no landowner account",
     "Act on the platform at all"],
    "The landowner may be the project owner, or may not be -\nthe project page names both, separately")

# the flow, small, beside the last two
fx, fy = col(2), ry3
rect(fx, fy, CARD_W, 232, bg="#ffffff", stroke=GREY, sw=1)
text(fx + PAD, fy + 14, "HOW THEY MEET", size=15, color=INK)
flow = [("Owner", "puts the project up"),
        ("Sylva", "vets the organisations, publishes"),
        ("Buyer", "reads the evidence, expresses interest"),
        ("Investor", "reads the financing, may fund it"),
        ("Verifier", "checks the result on the ground"),
        ("Units", "the scheme issues them, in ITS registry"),
        ("Auditor", "reads the whole trail afterwards")]
cy = fy + 44
for who, what in flow:
    text(fx + PAD, cy, who, size=12, color=FOREST, w=76)
    text(fx + PAD + 82, cy, what, size=12, color=INK, w=CARD_W - 110)
    cy += 25

# ---- the one rule that binds all of them ----
by = ry3 + max(h7, h8, 232) + 46
rect(X0, by, col(2) + CARD_W - X0, 92, bg="#e1f3fe", stroke=WATER)
text(X0 + 18, by + 14, "THE SAME RULE UNDER ALL EIGHT", size=15, color=WATER)
text(X0 + 18, by + 40,
     "Role comes from the PostgreSQL role and cannot be forged. Organisation comes from an HMAC-signed context and cannot be forged.\n"
     "So the screen never decides who sees what - it asks, and the database answers. A buyer asking Postgres directly for another buyer's\n"
     "sites gets zero rows; for a pseudonym's organisation, \"permission denied\". Tested as each role, not assumed.",
     size=12, color=INK)

doc = {"type": "excalidraw", "version": 2, "source": "https://excalidraw.com",
       "elements": els, "appState": {"gridSize": None, "viewBackgroundColor": "#ffffff"},
       "files": {}}

HERE = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(HERE, "sylva-roles.excalidraw")
json.dump(doc, open(out, "w"), indent=2, ensure_ascii=False)
print("wrote", out)

def write_svg(elements, path):
    P = 40
    xs = [e["x"] for e in elements] + [e["x"] + e["width"] for e in elements]
    ys = [e["y"] for e in elements] + [e["y"] + e["height"] for e in elements]
    mnx, mxx, mny, mxy = min(xs) - P, max(xs) + P, min(ys) - P, max(ys) + P
    w, h = mxx - mnx, mxy - mny
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w:.0f}" height="{h:.0f}" viewBox="{mnx} {mny} {w} {h}">',
         f'<rect x="{mnx}" y="{mny}" width="{w}" height="{h}" fill="#fff"/>',
         '<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" '
         'orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#868e96"/></marker></defs>']
    for e in elements:
        t = e["type"]
        if t == "rectangle":
            fill = e["backgroundColor"] if e["backgroundColor"] != "transparent" else "none"
            o.append(f'<rect x="{e["x"]}" y="{e["y"]}" width="{e["width"]}" height="{e["height"]}" rx="5" '
                     f'fill="{fill}" stroke="{e["strokeColor"]}" stroke-width="{e["strokeWidth"]}"/>')
        elif t == "text":
            fs = e["fontSize"]; lh = fs * e["lineHeight"]
            fam = "ui-monospace,Menlo,monospace" if e["fontFamily"] == MONO else "Helvetica,Arial,sans-serif"
            wt = ' font-weight="600"' if fs >= 15 else ""
            for i, ln in enumerate(e["text"].split("\n")):
                o.append(f'<text x="{e["x"]}" y="{e["y"] + lh * (i + 0.8):.1f}" font-family="{fam}" '
                         f'font-size="{fs}" fill="{e["strokeColor"]}"{wt}>{_html.escape(ln)}</text>')
        elif t in ("arrow", "line"):
            pts = " ".join(f'{e["x"] + p[0]},{e["y"] + p[1]}' for p in e["points"])
            mk = ' marker-end="url(#a)"' if t == "arrow" else ""
            o.append(f'<polyline points="{pts}" fill="none" stroke="{e["strokeColor"]}" '
                     f'stroke-width="{e["strokeWidth"]}"{mk}/>')
    o.append("</svg>")
    open(path, "w").write("\n".join(o))
    print(f"wrote {path}  ({w:.0f}x{h:.0f})")

write_svg(els, os.path.join(HERE, "sylva-roles.svg"))
print("elements:", len(els))
