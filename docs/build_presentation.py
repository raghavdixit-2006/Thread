# Build the THREAD project presentation in the supplied Chitkara BEE-II format.
import os
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.dml import MSO_LINE
from pptx.oxml.ns import qn
from pptx.oxml.xmlchemy import OxmlElement
from PIL import Image

TEMPLATE = r"C:\Users\ragha\Downloads\Project Report PPT(1).pptx"
OUT = r"C:\Users\ragha\Projects\thread\docs\THREAD_Project_Presentation.pptx"
IMG = r"C:\Users\ragha\Projects\thread\images"
TMP = os.path.join(os.environ["TEMP"], "thread-ppt", "crops")
os.makedirs(TMP, exist_ok=True)

ORANGE = RGBColor(0xFF, 0x33, 0x00)
RED = RGBColor(0xFF, 0x00, 0x00)
INK = RGBColor(0x11, 0x11, 0x11)
MUTED = RGBColor(0x55, 0x55, 0x55)
PAPER = RGBColor(0xF7, 0xF3, 0xEE)
BORDER = RGBColor(0xD9, 0xD2, 0xC7)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
GREEN = RGBColor(0x1B, 0x7A, 0x3D)
DARK = RGBColor(0x1F, 0x1F, 0x1F)
FONT = "Times New Roman"

def PX(v):
    return Emu(int(round(v * 914400 / 96)))

def rgb(hexstr):
    return RGBColor.from_string(hexstr)

prs = Presentation(TEMPLATE)

# Remove the three placeholder slides; keep master, layouts and theme.
sldIdLst = prs.slides._sldIdLst
for sldId in list(sldIdLst):
    rId = sldId.get(qn("r:id"))
    prs.part.drop_rel(rId)
    sldIdLst.remove(sldId)

BLANK = prs.slide_layouts[0]

def add_slide():
    return prs.slides.add_slide(BLANK)

def text(slide, x, y, w, h, s, size=14, bold=False, color=INK, align=PP_ALIGN.LEFT,
         anchor=MSO_ANCHOR.TOP, italic=False, spacing=1.0, after=0, font=FONT):
    tb = slide.shapes.add_textbox(PX(x), PX(y), PX(w), PX(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = 0
    tf.margin_right = 0
    tf.margin_top = 0
    tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    lines = s.split("\n")
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = spacing
        p.space_after = Pt(after)
        r = p.add_run()
        r.text = line
        r.font.name = font
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.italic = italic
        r.font.color.rgb = color
    return tb

def title(slide, s, page, size=28):
    text(slide, 40, 0, 600, 88, s, size=size, bold=False, align=PP_ALIGN.CENTER,
         anchor=MSO_ANCHOR.MIDDLE)
    text(slide, 688, 667, 224, 38, str(page), size=12, bold=True, align=PP_ALIGN.RIGHT,
         anchor=MSO_ANCHOR.MIDDLE)

def rect(slide, x, y, w, h, fill=None, line=None, lw=1.0, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
         radius=0.08):
    sh = slide.shapes.add_shape(shape, PX(x), PX(y), PX(w), PX(h))
    sh.shadow.inherit = False
    if shape == MSO_SHAPE.ROUNDED_RECTANGLE:
        try:
            sh.adjustments[0] = radius
        except Exception:
            pass
    if fill is None:
        sh.fill.background()
    else:
        sh.fill.solid()
        sh.fill.fore_color.rgb = fill
    if line is None:
        sh.line.fill.background()
    else:
        sh.line.color.rgb = line
        sh.line.width = Pt(lw)
    sh.text_frame.word_wrap = True
    sh.text_frame.margin_left = PX(8)
    sh.text_frame.margin_right = PX(8)
    sh.text_frame.margin_top = PX(4)
    sh.text_frame.margin_bottom = PX(4)
    sh.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
    style = sh._element.find(qn("p:style"))
    if style is not None:
        sh._element.remove(style)
    return sh

def box(slide, x, y, w, h, heading, body="", fill=PAPER, line=BORDER,
        hsize=12, bsize=10, hcolor=INK, bcolor=MUTED, align=PP_ALIGN.LEFT):
    sh = rect(slide, x, y, w, h, fill=fill, line=line)
    tf = sh.text_frame
    tf.margin_left = PX(9); tf.margin_right = PX(9)
    tf.margin_top = PX(5); tf.margin_bottom = PX(5)
    p = tf.paragraphs[0]
    p.alignment = align
    p.space_after = Pt(2)
    r = p.add_run(); r.text = heading
    r.font.name = FONT; r.font.size = Pt(hsize); r.font.bold = True; r.font.color.rgb = hcolor
    if body:
        for line in body.split("\n"):
            p2 = tf.add_paragraph()
            p2.alignment = align
            p2.space_after = Pt(1)
            r2 = p2.add_run(); r2.text = line
            r2.font.name = FONT; r2.font.size = Pt(bsize); r2.font.color.rgb = bcolor
    return sh

def arrow(slide, x1, y1, x2, y2, color=INK, width=1.4, dash=None):
    c = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, PX(x1), PX(y1), PX(x2), PX(y2))
    c.line.color.rgb = color
    c.line.width = Pt(width)
    if dash:
        c.line.dash_style = dash
    ln = c.line._get_or_add_ln()
    tail = OxmlElement("a:tailEnd")
    tail.set("type", "triangle"); tail.set("w", "med"); tail.set("len", "med")
    ln.append(tail)
    return c

def block_arrow(slide, x, y, w, h, color=ORANGE):
    sh = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, PX(x), PX(y), PX(w), PX(h))
    sh.shadow.inherit = False
    sh.fill.solid(); sh.fill.fore_color.rgb = color
    sh.line.fill.background()
    style = sh._element.find(qn("p:style"))
    if style is not None:
        sh._element.remove(style)
    return sh

def down_arrow(slide, x, y, w, h, color=ORANGE):
    sh = slide.shapes.add_shape(MSO_SHAPE.DOWN_ARROW, PX(x), PX(y), PX(w), PX(h))
    sh.shadow.inherit = False
    sh.fill.solid(); sh.fill.fore_color.rgb = color
    sh.line.fill.background()
    style = sh._element.find(qn("p:style"))
    if style is not None:
        sh._element.remove(style)
    return sh

def crop(src, name, ratio):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    th = int(round(w / ratio))
    if th <= h:
        im = im.crop((0, 0, w, th))
    else:
        tw = int(round(h * ratio))
        left = (w - tw) // 2
        im = im.crop((left, 0, left + tw, h))
    dst = os.path.join(TMP, name)
    im.save(dst, "PNG")
    return dst

def picture(slide, path, x, y, w, h):
    pic = slide.shapes.add_picture(path, PX(x), PX(y), PX(w), PX(h))
    pic.line.color.rgb = BORDER
    pic.line.width = Pt(0.75)
    return pic

def table(slide, x, y, w, col_widths, rows, header=True, fsize=10.5, row_h=26):
    shape = slide.shapes.add_table(len(rows), len(col_widths), PX(x), PX(y), PX(w), PX(row_h * len(rows)))
    tbl = shape.table
    tbl.first_row = False
    tbl.horz_banding = False
    for i, cw in enumerate(col_widths):
        tbl.columns[i].width = PX(cw)
    for ri, row in enumerate(rows):
        tbl.rows[ri].height = PX(row_h)
        for ci, val in enumerate(row):
            cell = tbl.cell(ri, ci)
            cell.margin_left = PX(7); cell.margin_right = PX(6)
            cell.margin_top = PX(3); cell.margin_bottom = PX(3)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            if ri == 0 and header:
                cell.fill.solid(); cell.fill.fore_color.rgb = ORANGE
            else:
                cell.fill.solid(); cell.fill.fore_color.rgb = WHITE if ri % 2 else PAPER
            tf = cell.text_frame
            tf.word_wrap = True
            p = tf.paragraphs[0]
            p.alignment = PP_ALIGN.LEFT
            r = p.add_run(); r.text = str(val)
            r.font.name = FONT
            r.font.size = Pt(fsize)
            r.font.bold = (ri == 0 and header)
            r.font.color.rgb = WHITE if (ri == 0 and header) else INK
    return tbl

def footer_note(slide, s):
    text(slide, 40, 626, 880, 22, s, size=10, italic=True, color=MUTED)

# ------------------------------------------------------------------ 1 cover
s = add_slide()
text(s, 40, 98, 900, 24, "Project Presentation of Back End Engineering-II Project (BEE-II) (24CSE0315)",
     size=12, bold=True, align=PP_ALIGN.CENTER)
text(s, 40, 124, 900, 22, "On", size=12, align=PP_ALIGN.CENTER)
text(s, 40, 148, 900, 62, "THREAD", size=40, bold=True, align=PP_ALIGN.CENTER)
text(s, 40, 210, 900, 28, "An Editorial Clothing E-Commerce Platform", size=17, bold=True, align=PP_ALIGN.CENTER)
text(s, 40, 238, 900, 20, "A full-stack storefront with variant-level stock, server-derived pricing and verified payments",
     size=11, italic=True, color=MUTED, align=PP_ALIGN.CENTER)

names = [("Raghav Dixit", "2410990667"), ("Rahul Gheek", "2410990669"),
         ("Manav Mandal", "241099xxxx"), ("Sameer Aggarwal", "2410990704")]
for i, (name, roll) in enumerate(names):
    col = i % 2
    row = i // 2
    cx = 180 + col * 300
    cy = 300 + row * 58
    text(s, cx, cy, 300, 22, name, size=13, bold=True, align=PP_ALIGN.CENTER)
    text(s, cx, cy + 22, 300, 18, f"Roll No. {roll}", size=10.5, color=MUTED, align=PP_ALIGN.CENTER)

text(s, 40, 438, 900, 20, "Supervised By", size=12, align=PP_ALIGN.CENTER)
text(s, 40, 462, 900, 24, "Dr. Durgesh Srivastava", size=14, bold=True, align=PP_ALIGN.CENTER)
text(s, 40, 486, 900, 20, "Professor, Department of CSE, CUIET", size=11, color=MUTED, align=PP_ALIGN.CENTER)

text(s, 40, 584, 900, 24, "Department of Computer Science and Engineering,", size=14, align=PP_ALIGN.CENTER)
text(s, 40, 610, 900, 24, "Chitkara University, Punjab", size=14, align=PP_ALIGN.CENTER)

# ------------------------------------------------------------------ 2 agenda
s = add_slide(); title(s, "Contents", 2)
items = [
    ("01", "Introduction & Objectives", "Problem, scope and goals"),
    ("02", "Technology Stack", "Client, API, data and services"),
    ("03", "System Architecture", "Three tiers and trust boundaries"),
    ("04", "Modules & Data Model", "Domain modules and collections"),
    ("05", "Authentication & Sessions", "JWT, refresh cookie, OTP"),
    ("06", "Catalogue & Orders", "Variant stock and order lifecycle"),
    ("07", "Payments & Security", "Signature verification and controls"),
    ("08", "Results & Future Scope", "Testing, limits and next steps"),
]
for i, (num, head, sub) in enumerate(items):
    col = i // 4
    row = i % 4
    x = 48 + col * 450
    y = 126 + row * 122
    text(s, x, y, 42, 30, num, size=22, bold=True, color=ORANGE)
    text(s, x + 50, y - 1, 360, 26, head, size=15, bold=True)
    text(s, x + 50, y + 26, 360, 22, sub, size=10.5, color=MUTED)
    if row < 3:
        ln = s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, PX(x + 50), PX(y + 76), PX(x + 390), PX(y + 76))
        ln.line.color.rgb = BORDER; ln.line.width = Pt(0.75)

# ------------------------------------------------------------------ 3 problem / objectives
s = add_slide(); title(s, "Introduction & Objectives", 3)
text(s, 44, 112, 410, 24, "The problem", size=15, bold=True)
problems = [
    ("Stock is per product, not per variant", "A sold-out size still accepts an order."),
    ("Totals are computed in the browser", "A modified page can change what is charged."),
    ("Paid status comes from a client callback", "An unpaid order can be marked paid."),
    ("Catalogue edits need code", "A two-person team cannot run the store alone."),
]
for i, (h, b) in enumerate(problems):
    y = 150 + i * 104
    text(s, 44, y, 24, 24, "×", size=18, bold=True, color=ORANGE)
    text(s, 74, y, 370, 24, h, size=12.5, bold=True)
    text(s, 74, y + 26, 370, 40, b, size=10.5, color=MUTED)
ln = s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, PX(466), PX(126), PX(466), PX(620))
ln.line.color.rgb = BORDER; ln.line.width = Pt(0.75)
text(s, 492, 112, 410, 24, "Objectives", size=15, bold=True)
objectives = [
    "Deliver the complete journey: discovery, bag, checkout, payment, order tracking and fulfilment.",
    "Model stock per colour and size; validate it on the server at add-to-bag and at order placement.",
    "Derive every amount on the server from integer paise; the client is a renderer only.",
    "Confirm online payments only by gateway signature and matching amount.",
    "Enforce role-based access on the client for usability and on the API for security.",
    "Meet an editorial accessibility bar: 16 px body, 44 px targets, URL-encoded filter state.",
]
for i, t in enumerate(objectives):
    y = 150 + i * 76
    text(s, 492, y, 24, 24, f"{i+1}.", size=11.5, bold=True, color=ORANGE)
    text(s, 520, y - 1, 390, 66, t, size=10.5)

# ------------------------------------------------------------------ 4 tech stack
s = add_slide(); title(s, "Technology Stack", 4)
cols = [
    ("CLIENT", ["React 19 + Vite 7", "Redux Toolkit / RTK Query", "React Router 7", "Hand-written CSS tokens", "Bootstrap Icons"]),
    ("API", ["Node.js 24 LTS", "Express 5", "Zod validation", "JWT + bcrypt", "Pino structured logs"]),
    ("DATA", ["MongoDB Atlas", "Mongoose ODM", "Redis (OTP, limits, sessions)", "Cloudinary media", "Text + SKU indexes"]),
    ("SERVICES", ["Razorpay (test mode)", "Nodemailer over SMTP", "Vercel (client)", "Botkeep / Pterodactyl (API)", "GitHub + Postman"]),
]
for i, (head, rows) in enumerate(cols):
    x = 40 + i * 226
    sh = rect(s, x, 132, 206, 380, fill=WHITE, line=BORDER)
    band = rect(s, x, 132, 206, 38, fill=ORANGE, line=None, shape=MSO_SHAPE.RECTANGLE)
    text(s, x, 138, 206, 26, head, size=12, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    for j, row in enumerate(rows):
        text(s, x + 14, 190 + j * 60, 180, 46, row, size=11, color=INK)
        if j < len(rows) - 1:
            ln = s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, PX(x + 14), PX(232 + j * 60), PX(x + 192), PX(232 + j * 60))
            ln.line.color.rgb = BORDER; ln.line.width = Pt(0.5)
text(s, 40, 538, 880, 24, "One language end to end: JavaScript on the client and the server, with one validation vocabulary.",
     size=12, bold=True, align=PP_ALIGN.CENTER)
footer_note(s, "All components are open source or managed services with a free or low-cost tier.")

# ------------------------------------------------------------------ 5 architecture
s = add_slide(); title(s, "System Architecture", 5)
text(s, 40, 108, 260, 22, "PRESENTATION", size=10, bold=True, color=ORANGE)
text(s, 340, 108, 260, 22, "APPLICATION", size=10, bold=True, color=ORANGE)
text(s, 640, 108, 280, 22, "DATA & SERVICES", size=10, bold=True, color=ORANGE)
box(s, 40, 136, 250, 150, "React SPA on Vercel",
    "Storefront + staff console\nRoute guards by role\nRTK Query cache\nNo database access", hsize=13, bsize=10)
box(s, 340, 136, 250, 150, "Express API on Botkeep",
    "Stateless HTTP layer\nZod at every boundary\nBusiness rules + pricing\nRole-based access", hsize=13, bsize=10)
backing = [("MongoDB Atlas", "durable documents"), ("Redis", "OTP, limits, refresh sessions"),
           ("Cloudinary", "product media"), ("Razorpay + SMTP", "payments + email")]
for i, (h, b) in enumerate(backing):
    box(s, 640, 136 + i * 58, 280, 48, h, b, hsize=11, bsize=9)
block_arrow(s, 295, 198, 38, 26)
block_arrow(s, 595, 198, 38, 26)
text(s, 292, 168, 46, 22, "HTTPS", size=8.5, color=MUTED, align=PP_ALIGN.CENTER)
text(s, 590, 168, 48, 22, "SDK / TCP", size=8.5, color=MUTED, align=PP_ALIGN.CENTER)
text(s, 40, 316, 550, 20, "The browser never talks to the database. The API holds no session state in process memory.",
     size=10.5, italic=True, color=MUTED)
# bottom trust band
box(s, 40, 372, 270, 104, "Trust boundary 1", "CORS allowlist with credentials.\nUnknown origins are rejected.", hsize=11, bsize=9.5)
box(s, 330, 372, 270, 104, "Trust boundary 2", "Access token in memory only.\nRefresh token in an httpOnly cookie.", hsize=11, bsize=9.5)
box(s, 620, 372, 300, 104, "Trust boundary 3", "Amounts and stock recomputed on the server.\nThe client submits no total.", hsize=11, bsize=9.5)
box(s, 40, 492, 880, 104, "Deployment split",
    "Client on Vercel with an SPA rewrite; API in a single Botkeep container; MongoDB Atlas and managed Redis as backing services.\nThe API can restart without logging customers out because the session is reconstructed from the refresh cookie and Redis.",
    hsize=11, bsize=9.5)
footer_note(s, "Three-tier, API-first architecture: browser → API → stateful services.")

# ------------------------------------------------------------------ 6 modules
s = add_slide(); title(s, "API Modules", 6)
mods = [
    ("auth", "Register, OTP, login, refresh, logout, reset"),
    ("users", "Profile and saved addresses"),
    ("products", "Catalogue, detail by slug, related pieces"),
    ("search", "Text index + word-start prefix"),
    ("carts", "Bag by SKU, quantities, guest merge"),
    ("wishlists", "Saved pieces and heart state"),
    ("orders", "Create, history, timeline, stock decrement"),
    ("payments", "Gateway order, verify, webhook"),
    ("coupons", "Discount rules applied server-side"),
    ("reviews", "Verified-purchase reviews and ratings"),
    ("policies", "Versioned, effective-dated pages"),
    ("admin", "Staff login, orders, catalogue CRUD"),
]
for i, (h, b) in enumerate(mods):
    col = i % 4
    row = i // 4
    x = 40 + col * 224
    y = 130 + row * 132
    sh = rect(s, x, y, 206, 112, fill=WHITE, line=BORDER)
    text(s, x + 12, y + 12, 182, 22, h, size=13, bold=True, color=ORANGE)
    text(s, x + 12, y + 40, 182, 62, b, size=9.5, color=MUTED)
text(s, 40, 532, 880, 22, "Each module owns its routes, schemas, service and data access; the central registry exposes only its router.",
     size=11, align=PP_ALIGN.CENTER)
box(s, 40, 570, 880, 44, "Why it matters",
    "A module boundary is also a review boundary: validation, authorisation and rate limits attach in one place.",
    hsize=10, bsize=9.5, fill=PAPER)
footer_note(s, "Staff login mounts before the RBAC-gated admin router, so an unauthenticated request can reach it.")

# ------------------------------------------------------------------ 7 data model
s = add_slide(); title(s, "Data Model", 7)
box(s, 40, 140, 190, 112, "users", "_id, name, email\npasswordHash, role\naddresses[]", hsize=12, bsize=9)
box(s, 40, 300, 190, 92, "carts", "userId\nitems[productId, sku, qty]", hsize=12, bsize=9)
box(s, 40, 430, 190, 80, "wishlists", "userId, productIds[]", hsize=12, bsize=9)
box(s, 340, 140, 240, 128, "products", "title, slug, category, price\nvariants[sku, size, colour,\nstock, price override]", hsize=12, bsize=9)
box(s, 340, 320, 240, 142, "orders", "orderNumber, userId\nitems[] (frozen snapshot)\nshippingAddress, pricing\npayment, status, timeline[]", hsize=12, bsize=9)
box(s, 340, 510, 240, 78, "reviews", "productId, userId, rating\nisVerifiedPurchase", hsize=12, bsize=9)
box(s, 680, 140, 240, 92, "coupons", "code, type, value\nminSubtotal, maxDiscount", hsize=12, bsize=9)
box(s, 680, 278, 240, 82, "policies", "slug, title, version\neffectiveAt, body", hsize=12, bsize=9)
arrow(s, 135, 252, 135, 300)
arrow(s, 135, 392, 135, 430)
arrow(s, 230, 210, 340, 368)
arrow(s, 230, 346, 340, 346)
arrow(s, 460, 268, 460, 320)
arrow(s, 460, 462, 460, 510)
text(s, 240, 268, 92, 20, "places", size=9, color=MUTED)
text(s, 240, 322, 96, 20, "checks out", size=9, color=MUTED)
text(s, 470, 288, 100, 20, "snapshot", size=9, color=MUTED)
box(s, 680, 400, 240, 150, "Money rule",
    "Every amount is stored as integer paise.\nFormatting to ₹ happens once, at the edge.\nNo floating-point rupee sums.",
    hsize=11, bsize=9.5, fill=PAPER)
footer_note(s, "Two indexes carry the read load: product text search and the unique variant SKU.")

# ------------------------------------------------------------------ 8 auth
s = add_slide(); title(s, "Authentication & Session Pipeline", 8)
steps = [
    ("1  Sign in", "Credentials checked;\nstaff blocked with 403\nADMIN_PORTAL_ONLY"),
    ("2  Issue", "Short-lived access JWT\nin memory + rotating\nrefresh cookie"),
    ("3  Persist", "Refresh record in Redis;\ncookie is httpOnly,\npath-scoped"),
    ("4  Recover", "401 triggers exactly one\nrefresh and replay of\nthe original request"),
    ("5  End", "Logout revokes the Redis\nrecord and clears\nthe cookie"),
]
for i, (h, b) in enumerate(steps):
    x = 40 + i * 178
    box(s, x, 132, 160, 150, h, b, hsize=11, bsize=9)
    if i < 4:
        block_arrow(s, x + 160, 194, 18, 20)
box(s, 40, 310, 880, 92, "Registration gate",
    "Six-digit email OTP, stored as SHA-256 with a server-side pepper; 10-minute TTL, five attempts, 60-second resend cooldown,\nfive sends per hour per address and ten per day per network. The plain code exists only in the email.",
    hsize=12, bsize=9.5, fill=PAPER)
# bottom split
box(s, 40, 430, 420, 150, "Why this design",
    "The access token never touches localStorage, so a script cannot read it.\nThe refresh token is rotated on every use, so a stolen copy is single-use.\nThe API stays stateless, so a container restart does not log users out.",
    hsize=11, bsize=9.5)
box(s, 480, 430, 440, 150, "Known deployment gap",
    "The client and API are on different sites, so production must issue the refresh cookie with SameSite=None and Secure.\nThe current build uses SameSite=Lax; this is recorded as a limitation and a pre-launch fix.",
    hsize=11, bsize=9.5, fill=PAPER)
footer_note(s, "A guest refresh returns 401 and is treated as a normal outcome, not an error.")

# ------------------------------------------------------------------ 9 catalogue
s = add_slide(); title(s, "Catalogue, Search & Variant Stock", 9)
row1 = [
    ("URL filters", "Search, category, size,\ncolour, price, rating,\nsort and page"),
    ("Search", "MongoDB text index +\nword-start prefix over\ntitle, brand, colour"),
    ("Product detail", "Gallery, variant matrix,\nper-variant stock,\nrelated pieces"),
]
row2 = [
    ("Add to bag", "Stores only the SKU;\nserver re-reads the variant\nand caps at stock"),
    ("Checkout", "Every line recomputed\nfrom the database before\nthe order is written"),
    ("Commit", "Stock decremented inside\na transaction; unique\norder number + idempotency key"),
]
for i, (h, b) in enumerate(row1):
    x = 40 + i * 304
    box(s, x, 130, 280, 136, h, b, hsize=12, bsize=9.5)
    if i < 2:
        block_arrow(s, x + 280, 186, 24, 22)
for i, (h, b) in enumerate(row2):
    x = 40 + i * 304
    box(s, x, 330, 280, 136, h, b, hsize=12, bsize=9.5)
    if i < 2:
        block_arrow(s, x + 280, 386, 24, 22)
down_arrow(s, 156, 266, 26, 64)
# variant matrix illustration
text(s, 40, 492, 300, 22, "Variant matrix: colour × size", size=10.5, bold=True)
colours = ["Ink", "Ecru", "Clay"]
sizes = ["S", "M", "L"]
for c, size in enumerate(sizes):
    text(s, 80 + c * 54, 516, 48, 18, size, size=8.5, bold=True, color=MUTED, align=PP_ALIGN.CENTER)
for r, colour in enumerate(colours):
    y = 536 + r * 28
    text(s, 36, y + 3, 40, 18, colour, size=8.5, color=MUTED, align=PP_ALIGN.RIGHT)
    for c, size in enumerate(sizes):
        sold = (r == 0 and c == 1)
        rect(s, 80 + c * 54, y, 48, 24,
             fill=(RGBColor(0xF2,0xD6,0xCF) if sold else RGBColor(0xEE,0xE8,0xE0)), line=BORDER)
        text(s, 80 + c * 54, y + 2, 48, 18, "—" if sold else "●",
             size=9, color=(MUTED if sold else INK), align=PP_ALIGN.CENTER)
box(s, 270, 510, 650, 104, "Stock truth is per variant",
    "A product owns an array of variants, each with its own SKU, size, colour and stock. Sold-out combinations are disabled in the matrix and rejected again by the API.\nThe bag stores the SKU, not a product id, so a line can always be resolved to exactly one colour and size.",
    hsize=11, bsize=9.5, fill=PAPER)

# ------------------------------------------------------------------ 10 orders
s = add_slide(); title(s, "Order Lifecycle & Pricing", 10)
states = ["Payment\npending", "Confirmed", "Packed", "Shipped", "Delivered"]
for i, st in enumerate(states):
    sh = rect(s, 40 + i * 178, 128, 166, 62, fill=(WHITE if i else PAPER), line=(BORDER if i else ORANGE),
              shape=MSO_SHAPE.CHEVRON)
    tf = sh.text_frame
    tf.margin_left = PX(14); tf.margin_right = PX(6)
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
    for j, line in enumerate(st.split("\n")):
        p2 = p if j == 0 else tf.add_paragraph()
        p2.alignment = PP_ALIGN.CENTER
        r = p2.add_run(); r.text = line
        r.font.name = FONT; r.font.size = Pt(10.5); r.font.bold = True; r.font.color.rgb = INK
text(s, 40, 204, 880, 22, "Cash on delivery starts at Confirmed. Online payment enters at Payment pending and only advances after signature verification.",
     size=10, italic=True, color=MUTED)
text(s, 40, 232, 880, 22, "Cancelled branch: a confirmed order can be cancelled; the transition is written to the order timeline.",
     size=10, italic=True, color=MUTED)
# pricing
text(s, 40, 314, 500, 24, "Pricing is computed once, on the server, from integer paise", size=12, bold=True)
price_steps = [("Line totals", "stored unit price\n× quantity"), ("Discount", "coupon rules\nserver-side"), ("Shipping", "delivery option"), ("GST 5%", "on taxable value"), ("Grand total", "rendered, never\nsubmitted by client")]
for i, (h, b) in enumerate(price_steps):
    x = 40 + i * 178
    box(s, x, 350, 160, 96, h, b, hsize=10.5, bsize=9)
    if i < 4:
        block_arrow(s, x + 160, 388, 18, 20)
box(s, 40, 470, 880, 112, "Verified example",
    "One jacket at ₹9,000 → subtotal ₹9,000 → GST 5% ₹450 → payable ₹9,450.\nThe amount shown in the bag, the amount sent to the gateway and the amount recomputed at verification were identical.",
    hsize=11, bsize=9.5, fill=PAPER)
footer_note(s, "Every status transition is written to the order timeline, so customer and operator read the same history.")

# ------------------------------------------------------------------ 11 payment
s = add_slide(); title(s, "Online Payment Verification", 11)
lanes = [("CLIENT", 40, 230), ("API", 340, 260), ("RAZORPAY", 680, 240)]
for name, x, w in lanes:
    box(s, x, 112, w, 38, name, "", hsize=11, fill=ORANGE, line=None, hcolor=WHITE, align=PP_ALIGN.CENTER)
for lx in (155, 470, 800):
    c = s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, PX(lx), PX(156), PX(lx), PX(586))
    c.line.color.rgb = BORDER; c.line.width = Pt(1); c.line.dash_style = MSO_LINE.DASH
steps = [
    (155, 470, 190, "1  POST /payments/razorpay/order (server amount)"),
    (470, 800, 228, "2  create gateway order"),
    (800, 470, 266, "3  gateway order id"),
    (470, 155, 304, "4  order id + public key"),
    (155, 800, 342, "5  checkout: customer pays"),
    (800, 155, 380, "6  payment id, order id, signature"),
    (155, 470, 418, "7  POST /verify"),
    (800, 470, 456, "8  webhook, same confirmation path"),
]
for x1, x2, y, label in steps:
    arrow(s, x1, y, x2, y, color=(ORANGE if x1 < x2 else INK))
    mid = (x1 + x2) / 2
    text(s, min(x1, x2) + 6, y - 26, abs(x2 - x1) - 12, 22, label, size=8.5, color=MUTED, align=PP_ALIGN.CENTER)
box(s, 340, 492, 260, 94, "Server checks", "HMAC-SHA256 signature\nAmount + currency match\nOrder marked paid only then", hsize=10, bsize=8.5, fill=PAPER)
box(s, 40, 600, 880, 30, "A client callback alone never marks an order paid.", "", hsize=10, fill=RGBColor(0xF2,0xD6,0xCF), line=RGBColor(0xD9,0xA0,0x94), align=PP_ALIGN.CENTER)

# ------------------------------------------------------------------ 12 security
s = add_slide(); title(s, "Security Design", 12)
rows = [
    ["Control", "Implementation"],
    ["Password storage", "bcrypt cost 10; hashes are never reversible"],
    ["Access token", "Short-lived JWT held in Redux memory only"],
    ["Refresh token", "256-bit value, httpOnly cookie, Redis-backed, rotated on use"],
    ["OTP", "SHA-256 with pepper, 10-minute TTL, five attempts, resend caps"],
    ["Authorisation", "adminRequired on every /api/admin route; staff rejected by customer login"],
    ["Rate limits", "Per-route budgets: auth 30/10 min, OTP verify 10/10 min, writes 100/5 min"],
    ["Input and headers", "Zod at body/query/params; Helmet; explicit CORS allowlist"],
    ["Money and webhooks", "Integer paise end to end; raw-body HMAC before any state change"],
]
table(s, 40, 126, 880, [210, 670], rows, fsize=9.8, row_h=48)
box(s, 40, 582, 880, 38, "Authorisation is enforced twice: on the client for usability, on the API for security.",
    "", hsize=10, fill=PAPER, align=PP_ALIGN.CENTER)

# ------------------------------------------------------------------ 13 storefront
s = add_slide(); title(s, "Storefront", 13)
text(s, 40, 104, 880, 22, "Paper-and-ink palette, serif display face, flat surfaces and rules instead of shadows.",
     size=11, italic=True, color=MUTED, align=PP_ALIGN.CENTER)
home = crop(os.path.join(IMG, "home.png"), "home.png", 400/424)
wish = crop(os.path.join(IMG, "wishlist.png"), "wishlist.png", 400/424)
picture(s, home, 48, 134, 400, 424)
picture(s, wish, 512, 134, 400, 424)
text(s, 48, 566, 400, 20, "Home — editorial composition and featured pieces", size=9.5, bold=True, align=PP_ALIGN.CENTER)
text(s, 512, 566, 400, 20, "Wishlist — saved pieces with consistent product state", size=9.5, bold=True, align=PP_ALIGN.CENTER)
text(s, 48, 590, 400, 34, "16 px body, 12 px labels, 44 px targets,\none h1 inside a main landmark.", size=8.5, color=MUTED, align=PP_ALIGN.CENTER)
text(s, 512, 590, 400, 34, "Saved pieces keep their price and stock state;\nthe heart reflects it across the catalogue.", size=8.5, color=MUTED, align=PP_ALIGN.CENTER)

# ------------------------------------------------------------------ 14 journey
s = add_slide(); title(s, "Customer Journey", 14)
text(s, 40, 104, 880, 22, "Product → bag → order: every step re-reads server truth.", size=11, italic=True, color=MUTED, align=PP_ALIGN.CENTER)
prod = crop(os.path.join(IMG, "product-detail.png"), "product.png", 260/300)
cart = crop(os.path.join(IMG, "cart.png"), "cart.png", 260/300)
order = crop(os.path.join(IMG, "orders.png"), "order.png", 260/300)
for i, (img, cap, note) in enumerate([
    (prod, "01  Product", "Colour and size matrix;\nsold-out combinations disabled."),
    (cart, "02  Bag", "SKU-level lines, quantity caps\nand a live summary."),
    (order, "03  Orders", "Confirmed orders with status\nfilters and server totals."),
]):
    x = 48 + i * 304
    picture(s, img, x, 138, 260, 300)
    text(s, x, 450, 260, 20, cap, size=11, bold=True, color=ORANGE)
    text(s, x, 472, 260, 44, note, size=9.5, color=MUTED)
box(s, 40, 540, 880, 76, "The client never submits a total",
    "It renders the subtotal, GST and grand total it receives. At checkout the server recomputes every line from the database, then writes the order and decrements stock in one transaction.",
    hsize=10.5, bsize=9.5, fill=PAPER)

# ------------------------------------------------------------------ 15 admin
s = add_slide(); title(s, "Staff Console", 15)
admin = crop(os.path.join(IMG, "admin-console.png"), "admin.png", 470/440)
picture(s, admin, 44, 130, 470, 440)
text(s, 44, 578, 470, 20, "Admin console — 30-day counters and the order queue", size=9.5, bold=True, align=PP_ALIGN.CENTER)
text(s, 548, 124, 372, 22, "Run the store without a developer", size=13, bold=True)
caps = [
    ("Order queue", "Every order with its current state and customer."),
    ("Legal transitions", "Packed, shipped, delivered or cancelled; each writes to the timeline."),
    ("Catalogue CRUD", "Create and edit pieces, gallery, variants and pricing."),
    ("Inventory", "Low-stock view by variant; hidden pieces stay out of the storefront."),
    ("Policies", "Versioned pages with effective dates."),
    ("Separate login", "Staff credentials are rejected by the customer login with 403."),
]
for i, (h, b) in enumerate(caps):
    y = 160 + i * 74
    text(s, 548, y, 18, 20, "—", size=11, bold=True, color=ORANGE)
    text(s, 574, y - 1, 346, 22, h, size=10.5, bold=True)
    text(s, 574, y + 21, 346, 44, b, size=9, color=MUTED)
footer_note(s, "Same API, separate role: the console is a normal web page with no installation.")

# ------------------------------------------------------------------ 16 testing
s = add_slide(); title(s, "Testing & Results", 16)
rows = [
    ["ID", "Test case", "Result"],
    ["T-01", "GET /api/health reports all dependencies", "Pass"],
    ["T-02", "Search for jacket, jack, blue, THREAD", "Pass"],
    ["T-04", "Guest boot renders the storefront", "Pass"],
    ["T-07", "Staff credentials on customer login", "Pass"],
    ["T-09", "Add to bag above available stock", "Pass"],
    ["T-12", "Place a cash-on-delivery order", "Pass"],
    ["T-13", "Customer opens /admin", "Pass"],
    ["T-15", "Deep link /admin/login on production", "Pass"],
]
table(s, 40, 126, 560, [58, 402, 100], rows, fsize=9.5, row_h=40)
metrics = [
    ("15/15", "scripted checks passed"),
    ("₹9,450", "server total matched at gateway"),
    ("0", "stock oversells in the tested path"),
]
for i, (num, lab) in enumerate(metrics):
    y = 126 + i * 108
    box(s, 636, y, 284, 92, num, lab, hsize=22, bsize=9, fill=PAPER, align=PP_ALIGN.CENTER, hcolor=ORANGE)
box(s, 40, 500, 880, 116, "Defects found and fixed",
    "Elasticsearch read model with no cluster → MongoDB text + prefix search.\nDeep links returned the platform 404 → SPA rewrite in client/vercel.json.\nAPI container could not install on boot → root manifest, prestart guard and SERVER_PORT fallback.\nConfirmation was reachable without payment → HMAC signature and amount check.",
    hsize=10.5, bsize=9)

# ------------------------------------------------------------------ 17 conclusion
s = add_slide(); title(s, "Conclusion & Future Scope", 17)
text(s, 40, 112, 420, 24, "What the project proves", size=14, bold=True)
left = [
    "A small label can own its commerce stack without owning a payments team.",
    "Variant-level stock and server-derived pricing remove the two most common oversell paths.",
    "Signature-verified payments and two-layer authorisation make the order trustworthy.",
    "The console lets a two-person team run catalogue, orders and policies without code.",
]
for i, t in enumerate(left):
    y = 148 + i * 96
    text(s, 40, y, 24, 24, "—", size=12, bold=True, color=ORANGE)
    text(s, 66, y - 2, 380, 88, t, size=10.5)
ln = s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, PX(466), PX(126), PX(466), PX(600))
ln.line.color.rgb = BORDER; ln.line.width = Pt(0.75)
text(s, 492, 112, 410, 24, "Future scope", size=14, bold=True)
right = [
    "CI with seeded fixtures and a mocked gateway.",
    "Webhook-first confirmation with replay-safe storage and a dead-letter queue.",
    "Returns, partial refunds and a staff workflow.",
    "SSR or hydration for catalogue pages and link previews.",
    "Responsive images, tracing and multi-currency.",
]
for i, t in enumerate(right):
    y = 148 + i * 78
    text(s, 492, y, 24, 24, f"{i+1}.", size=10.5, bold=True, color=ORANGE)
    text(s, 518, y - 2, 380, 70, t, size=10.5)
text(s, 40, 548, 420, 40, "Known limits: cross-site refresh cookie needs SameSite=None; the gateway is in test mode; returns are not yet implemented.",
     size=8.5, italic=True, color=MUTED)
box(s, 40, 600, 880, 30, "Takeaway: correctness lives in the server, not in the browser.", "", hsize=11, fill=PAPER, align=PP_ALIGN.CENTER)

# ------------------------------------------------------------------ 18 thank you
s = add_slide()
text(s, 40, 260, 880, 100, "Thank You", size=54, bold=False, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
text(s, 40, 380, 880, 26, "Questions & Discussion", size=16, align=PP_ALIGN.CENTER, color=MUTED)
text(s, 40, 470, 880, 22, "Raghav Dixit  ·  Rahul Gheek  ·  Manav Mandal  ·  Sameer Aggarwal", size=11, align=PP_ALIGN.CENTER)
text(s, 40, 496, 880, 22, "Supervised by Dr. Durgesh Srivastava", size=11, italic=True, align=PP_ALIGN.CENTER, color=MUTED)
text(s, 688, 667, 224, 38, "18", size=12, bold=True, align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.MIDDLE)

prs.save(OUT)
print("saved", OUT, "slides", len(prs.slides))
