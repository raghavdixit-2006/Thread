/* Build the THREAD project report in the Chitkara report format.
 * Run: node docs/build_report.cjs
 * Requires docx + sharp installed in %TEMP%/report-js.
 */
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const req = createRequire(path.join(process.env.TEMP, "report-js", "anchor.js"));
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, PageBreak, Footer, PageNumber, WidthType,
  BorderStyle, ShadingType, TableLayoutType, TabStopType, LeaderType, Tab,
  UnderlineType,
} = req("docx");
const sharp = req("sharp");

const ROOT = path.resolve(__dirname, "..");
const IMG = path.join(ROOT, "images");
const FIG = path.join(IMG, "report");
const OUT = process.env.REPORT_OUT || path.join(ROOT, "docs", "THREAD_Project_Report.docx");
const PAGE_MAP_FILE = path.join(ROOT, "docs", "page_map.json");
const PAGE_MAP = fs.existsSync(PAGE_MAP_FILE) ? JSON.parse(fs.readFileSync(PAGE_MAP_FILE, "utf8")) : {};
const LOGO_SMALL = path.join(process.env.TEMP, "fmt", "image1.jpeg");
const LOGO_BIG = path.join(process.env.TEMP, "fmt", "image2.jpeg");

const TITLE = "THREAD";
const SUBTITLE = "AN EDITORIAL CLOTHING E-COMMERCE PLATFORM";
const COURSE = "BEE-II";
const GUIDE = "Ms. Anu Thind";
const GUIDE_LINE = "Professor, Department of CSE, CUIET";
const GUIDE_LINE2 = "Chitkara University, Punjab";
const STUDENTS = [
  { name: "Raghav Dixit", roll: "2410990667" },
  { name: "Rahul Gheek", roll: "2410990669" },
  { name: "Manav Mandal", roll: "2410990435" },
  { name: "Sameer Aggarwal", roll: "2410990705" },
];
const STUDENT_LINE = "Raghav Dixit (2410990667), Rahul Gheek (2410990669), Manav Mandal (2410990435) and Sameer Aggarwal (2410990705)";

/* ---------------------------------------------------------------- images */

function imageSize(buf) {
  if (buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG") {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) { i += 1; continue; }
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  throw new Error("unknown image format");
}

function imageRun(file, targetWidth = 585) {
  const buf = fs.readFileSync(file);
  const meta = imageSize(buf);
  let width = targetWidth;
  let height = Math.round(width * meta.height / meta.width);
  const maxHeight = 760;
  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * meta.width / meta.height);
  }
  return new ImageRun({
    type: file.toLowerCase().endsWith(".png") ? "png" : "jpg",
    data: buf,
    transformation: { width, height },
    altText: { title: path.basename(file), description: path.basename(file), name: path.basename(file) },
  });
}

async function ensureSlices() {
  fs.mkdirSync(FIG, { recursive: true });
  // The home and product captures are full scrolling pages. Crop each to the
  // part that carries the feature under discussion so no figure is a tall strip.
  const crops = {
    "shot-home.png": ["home.png", 790],
    "shot-product.png": ["product-detail.png", 1060],
  };
  for (const [outName, [srcName, cropH]] of Object.entries(crops)) {
    const outFile = path.join(FIG, outName);
    const srcFile = path.join(IMG, srcName);
    const meta = await sharp(srcFile).metadata();
    await sharp(srcFile)
      .extract({ left: 0, top: 0, width: meta.width, height: Math.min(cropH, meta.height) })
      .png().toFile(outFile);
  }
}

/* ----------------------------------------------------------------- styles */

const FONT = "Times New Roman";

const styles = {
  default: {
    document: {
      run: { font: FONT, size: 24, color: "000000" },
      paragraph: { spacing: { line: 360, after: 120 }, alignment: AlignmentType.JUSTIFIED },
    },
  },
  paragraphStyles: [
    {
      id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { font: FONT, size: 32, bold: true, color: "000000" },
      paragraph: { spacing: { before: 0, after: 140, line: 276 }, alignment: AlignmentType.LEFT, outlineLevel: 0, keepNext: true },
    },
    {
      id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { font: FONT, size: 26, bold: true, color: "000000" },
      paragraph: { spacing: { before: 260, after: 100, line: 300 }, alignment: AlignmentType.LEFT, outlineLevel: 1, keepNext: true },
    },
    {
      id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { font: FONT, size: 24, bold: true, color: "000000" },
      paragraph: { spacing: { before: 180, after: 80, line: 300 }, alignment: AlignmentType.LEFT, outlineLevel: 2, keepNext: true },
    },
  ],
};

/* ---------------------------------------------------------------- helpers */

function P(text = "", o = {}) {
  return new Paragraph({
    alignment: o.align,
    spacing: { before: o.before, after: o.after ?? 120, line: o.line ?? 360 },
    indent: o.indent,
    keepNext: o.keepNext,
    pageBreakBefore: o.breakBefore,
    shading: o.shading,
    tabStops: o.tabStops,
    children: [new TextRun({
      text,
      bold: o.bold,
      italics: o.italics,
      size: o.size,
      underline: o.underline,
      font: o.font,
      color: o.color,
    })],
  });
}

function body(text) { return P(text); }

function lead(text, rest) {
  return new Paragraph({
    spacing: { after: 120, line: 360 },
    alignment: AlignmentType.JUSTIFIED,
    children: [
      new TextRun({ text, bold: true, size: 24 }),
      new TextRun({ text: rest, size: 24 }),
    ],
  });
}

function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun({ text, bold: true })] });
}
function h2(text, o = {}) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, pageBreakBefore: o.breakBefore, children: [new TextRun({ text, bold: true })] });
}
function h3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text, bold: true })] });
}

function bullet(text) {
  return new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { after: 60, line: 336 },
    alignment: AlignmentType.JUSTIFIED,
  });
}

function numbered(items) {
  return items.map((text, i) => P(`${i + 1}.  ${text}`, { after: 60, line: 336, indent: { left: 340, hanging: 340 } }));
}

function codeBlock(text) {
  const lines = text.replace(/^\n+|\n+$/g, "").split("\n");
  const children = [];
  lines.forEach((line, i) => {
    if (i) children.push(new TextRun({ break: 1 }));
    children.push(new TextRun({ text: line, font: "Consolas", size: 18 }));
  });
  return new Paragraph({
    spacing: { before: 80, after: 160, line: 240 },
    indent: { left: 227 },
    shading: { type: ShadingType.CLEAR, fill: "F2F2F2", color: "auto" },
    alignment: AlignmentType.LEFT,
    keepLines: true,
    children,
  });
}

const DX = (cm) => Math.round(cm * 567);

function makeTable(headers, rows, widthsCm, cap, font = 10, pad = 70) {
  const out = [];
  if (cap) {
    out.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 80, line: 240 },
      keepNext: true,
      children: [new TextRun({ text: cap, bold: true, size: 20 })],
    }));
  }
  const widths = widthsCm.map(DX);
  const total = widths.reduce((a, b) => a + b, 0);
  const border = { style: BorderStyle.SINGLE, size: 4, color: "808080" };
  const borders = {
    top: border, bottom: border, left: border, right: border,
    insideHorizontal: border, insideVertical: border,
  };
  const all = [headers, ...rows];
  const table = new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders,
    rows: all.map((row, ri) => new TableRow({
      tableHeader: ri === 0,
      children: row.map((val, ci) => new TableCell({
        width: { size: widths[ci], type: WidthType.DXA },
        shading: ri === 0 ? { type: ShadingType.CLEAR, fill: "E8E4DA", color: "auto" } : undefined,
        margins: { top: pad, bottom: pad, left: 100, right: 100 },
        children: [new Paragraph({
          spacing: { before: 0, after: 0, line: 240 },
          alignment: AlignmentType.LEFT,
          children: [new TextRun({ text: String(val), bold: ri === 0, size: font * 2 })],
        })],
      })),
    })),
  });
  out.push(table);
  out.push(new Paragraph({ spacing: { after: 100, line: 240 }, children: [] }));
  return out;
}

function figure(file, text, widthOverride) {
  const target = widthOverride || 430;
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 0, line: 240 },
      keepNext: true,
      children: [imageRun(file, target)],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 120, line: 240 },
      children: [new TextRun({ text, italics: true, size: 20 })],
    }),
  ];
}

function coverLogo(file, cm, breakBefore = false) {
  const buf = fs.readFileSync(file);
  const meta = imageSize(buf);
  const width = Math.round(cm / 2.54 * 96);
  const height = Math.round(width * meta.height / meta.width);
  return new Paragraph({
    spacing: { after: 0, line: 240 },
    pageBreakBefore: breakBefore,
    children: [new ImageRun({
      type: "jpg", data: buf, transformation: { width, height },
      altText: { title: "Chitkara University", description: "Chitkara University logo", name: "logo" },
    })],
  });
}

function annexureHeader(code, title) {
  return [
    coverLogo(LOGO_SMALL, 3.7, true),
    P("", { after: 6, line: 240 }),
    P(`(Annexure -${code})`, { bold: true, size: 24, after: 26 }),
    P(title, { align: AlignmentType.CENTER, bold: true, size: 32, after: 18 }),
  ];
}

function signatureTable() {
  const widths = [DX(4.0), DX(4.0), DX(4.0), DX(4.0)];
  const border = { style: BorderStyle.SINGLE, size: 4, color: "808080" };
  const cell = (children) => new TableCell({
    width: { size: widths[0], type: WidthType.DXA },
    margins: { top: 80, bottom: 80, left: 80, right: 80 },
    children,
  });
  const row1 = new TableRow({
    children: STUDENTS.map((_, i) => cell([
      P(`Sign. of Student ${i + 1}`, { bold: true, size: 21, after: 20, line: 240 }),
    ])),
  });
  const row2 = new TableRow({
    children: STUDENTS.map((student) => cell([
      P(student.name, { size: 21, after: 4, line: 240 }),
      P(`Roll No. ${student.roll}`, { size: 21, after: 10, line: 240 }),
    ])),
  });
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [row1, row2],
  });
}

function tocEntry(text, page, bold, indent) {
  const size = bold ? 23 : 22;
  const children = [new TextRun({ text, bold, size })];
  if (page) {
    children.push(new TextRun({ children: [new Tab()], bold, size }));
    children.push(new TextRun({ text: String(page), bold, size }));
  }
  return new Paragraph({
    spacing: { before: bold ? 100 : 0, after: bold ? 20 : 10, line: 276 },
    indent: indent ? { left: 566 } : undefined,
    tabStops: [{ type: TabStopType.RIGHT, position: 9184, leader: LeaderType.DOT }],
    children,
  });
}

/* ---------------------------------------------------------------- content */

function cover() {
  const kids = [];
  kids.push(coverLogo(LOGO_SMALL, 3.7));
  kids.push(P("", { after: 16, line: 240 }));
  kids.push(P("PROJECT REPORT", { align: AlignmentType.CENTER, size: 26, after: 2, line: 240 }));
  kids.push(P("On", { align: AlignmentType.CENTER, size: 22, after: 8, line: 240 }));
  kids.push(P(TITLE, { align: AlignmentType.CENTER, bold: true, size: 48, after: 2, line: 240 }));
  kids.push(P(SUBTITLE, { align: AlignmentType.CENTER, bold: true, size: 26, after: 14, line: 240 }));
  kids.push(P("Submitted in partial fulfilment of the requirement for the Course", { align: AlignmentType.CENTER, size: 22, after: 2, line: 240 }));
  kids.push(P(COURSE, { align: AlignmentType.CENTER, size: 22, after: 10, line: 240 }));
  kids.push(P("of", { align: AlignmentType.CENTER, size: 22, after: 6, line: 240 }));
  kids.push(P("COMPUTER SCIENCE AND ENGINEERING", { align: AlignmentType.CENTER, size: 22, after: 2, line: 240 }));
  kids.push(P("B.E. Batch-2024", { align: AlignmentType.CENTER, size: 22, after: 2, line: 240 }));
  kids.push(P("In", { align: AlignmentType.CENTER, size: 22, after: 2, line: 240 }));
  kids.push(P("June-Dec 2026", { align: AlignmentType.CENTER, size: 22, after: 10, line: 240 }));
  kids.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 10, line: 240 },
    children: [imageRun(LOGO_BIG, 250)],
  }));

  const left = [
    P("Under the Guidance of", { bold: true, size: 22, after: 10, line: 240 }),
    P(GUIDE, { bold: true, size: 22, after: 2, line: 240 }),
    P(GUIDE_LINE, { size: 21, after: 0, line: 240 }),
    P(GUIDE_LINE2, { size: 21, after: 0, line: 240 }),
  ];
  const right = [P("Submitted By", { bold: true, size: 22, after: 10, line: 240 })];
  STUDENTS.forEach((student) => {
    right.push(P(student.name, { bold: true, size: 22, after: 0, line: 240 }));
    right.push(P(`Roll No. ${student.roll}`, { size: 21, after: 8, line: 240 }));
  });
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  kids.push(new Table({
    width: { size: 9184, type: WidthType.DXA },
    columnWidths: [DX(7.6), DX(8.4)],
    layout: TableLayoutType.FIXED,
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
    rows: [new TableRow({
      children: [
        new TableCell({ width: { size: DX(7.6), type: WidthType.DXA }, borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }, margins: { left: 0, right: 60 }, children: left }),
        new TableCell({ width: { size: DX(8.4), type: WidthType.DXA }, borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }, margins: { left: 60, right: 0 }, children: right }),
      ],
    })],
  }));
  kids.push(P("DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING", { align: AlignmentType.CENTER, bold: true, size: 23, after: 2, line: 240, before: 4200 }));
  kids.push(P("CHITKARA UNIVERSITY", { align: AlignmentType.CENTER, bold: true, size: 26, after: 2, line: 240 }));
  kids.push(P("PUNJAB", { align: AlignmentType.CENTER, bold: true, size: 23, after: 0, line: 240 }));
  return kids;
}

function certificate() {
  return [
    ...annexureHeader("C", "CERTIFICATE"),
    body("This is to certify that the project entitled \"THREAD - An Editorial Clothing E-Commerce Platform\" has been submitted for the Bachelor of Computer Science Engineering at Chitkara University, Punjab during the academic semester June-December 2026, is a bonafide piece of project work carried out by \"" + STUDENT_LINE + "\" towards the partial fulfilment for the award of the course " + COURSE + " under the guidance of \"" + GUIDE + "\" and supervision."),
    P("", { after: 54, line: 240 }),
    P("Sign. of Project Guide:", { align: AlignmentType.RIGHT, bold: true, size: 23, after: 10, line: 240 }),
    P(GUIDE, { align: AlignmentType.RIGHT, size: 23, after: 2, line: 240 }),
    P("Professor", { align: AlignmentType.RIGHT, size: 22, after: 2, line: 240 }),
    P("Department of Computer Science and Engineering", { align: AlignmentType.RIGHT, size: 22, after: 2, line: 240 }),
    P("Chitkara University, Punjab", { align: AlignmentType.RIGHT, size: 22, after: 0, line: 240 }),
  ];
}

function declaration() {
  return [
    ...annexureHeader("D", "CANDIDATE'S DECLARATION"),
    body("We, " + STUDENT_LINE + ", B.E.-2024 of Chitkara University, Punjab hereby declare that the project report entitled \"THREAD - An Editorial Clothing E-Commerce Platform\" is an original work and the data provided in the study is authentic to the best of our knowledge. This report has not been submitted to any other institution or university for the award of any other degree or diploma."),
    P("", { after: 24, line: 240 }),
    signatureTable(),
    P("", { after: 14, line: 240 }),
    P("Place: Rajpura", { size: 22, after: 2, line: 240 }),
    P("Date: 25-11-2026", { size: 22, after: 0, line: 240 }),
  ];
}

function acknowledgement() {
  return [
    ...annexureHeader("E", "ACKNOWLEDGEMENT"),
    body("It is our pleasure to be indebted to various people who directly or indirectly contributed to the development of this work and who influenced our thinking, behaviour and acts during the course of study."),
    body("We express our sincere gratitude to Chitkara University, Punjab for providing us the opportunity to undertake this project as part of the curriculum."),
    body("We are thankful to our project guide, " + GUIDE + ", Professor, Department of Computer Science and Engineering, CUIET, Chitkara University, Punjab, for her constant support, technical review, cooperation and motivation throughout the training period, and for her valuable suggestions and precious time in accomplishing this project report."),
    body("We also extend our sincere appreciation to the faculty of the department and to our external reviewers for their feedback during the review presentations."),
    body("Lastly, we would like to thank our parents for their moral support and our friends with whom we shared our day-to-day experience and received suggestions that improved the quality of our work."),
    P("", { after: 18, line: 240 }),
    signatureTable(),
  ];
}

const TOC = [
  ["1: INTRODUCTION", ["1.1 Background", "1.2 Problem Statement", "1.3 Objectives of the Project", "1.4 Scope of the Project", "1.5 Significance of the Project", "1.6 Organisation of the Report"]],
  ["2: SOFTWARE AND HARDWARE REQUIREMENT SPECIFICATION", ["2.1 Hardware Requirements", "2.2 Software Requirements", "2.3 Programming Languages, Libraries and Tools", "2.4 Requirements Analysis and Feasibility", "2.5 Study of Existing Systems", "2.6 Proposed System"]],
  ["3: SYSTEM DESIGN AND ARCHITECTURE", ["3.1 System Architecture", "3.2 Architecture in Text", "3.3 Module Description", "3.4 Database Design", "3.5 Client Routing and Access Control", "3.6 Interface Design", "3.7 Interface Walkthrough"]],
  ["4: METHODOLOGY AND IMPLEMENTATION", ["4.1 Proposed Methodology and Workflow", "4.2 Session and Authentication Design", "4.3 Catalogue, Search and Variant Stock", "4.4 Order Lifecycle and Pricing", "4.5 Online Payment Workflow", "4.6 Security Design", "4.7 API Design and Response Contract", "4.8 Validation, Error Handling and Observability", "4.9 Deployment and Configuration", "4.10 Data Consistency and Transaction Boundaries"]],
  ["5: CODE IMPLEMENTATION", ["5.1 Implementation Steps", "5.2 Server Bootstrap and Routing", "5.3 Session Cookie Handling", "5.4 Order Placement and Pricing", "5.5 Client Routing and Route Guards", "5.6 Payment Verification", "5.7 Catalogue, Search and Media Implementation", "5.8 Staff Console Implementation", "5.9 Transactional Email and OTP Delivery", "5.10 Deployment Procedure and Health Checks", "5.11 Client Error States and Recovery"]],
  ["6: TESTING AND RESULTS", ["6.1 Testing Approach", "6.2 Test Cases and Results", "6.3 Defects Found and Fixed", "6.4 Results and Observations", "6.5 Accessibility and Interface Validation", "6.6 Performance and Scalability Observations", "6.7 Security and Failure-Path Validation", "6.8 Test Environment and Data", "6.9 Regression Checklist"]],
  ["7: CONCLUSION AND FUTURE SCOPE", ["7.1 Conclusion", "7.2 Limitations", "7.3 Future Scope", "7.4 Lessons Learned", "7.5 Operational and Societal Impact"]],
  ["8: APPENDIX / REFERENCES", ["8.1 Appendix A - API Reference", "8.2 Appendix B - Environment Variables", "8.3 References"]],
];

function tableOfContents() {
  const kids = [new Paragraph({
    pageBreakBefore: true,
    spacing: { after: 260, line: 300 },
    children: [new TextRun({ text: "Table of Contents", bold: true, underline: { type: UnderlineType.SINGLE }, size: 28 })],
  })];
  TOC.forEach(([chapter, subs]) => {
    kids.push(tocEntry(chapter, PAGE_MAP[chapter], true, false));
    subs.forEach((sub) => kids.push(tocEntry(sub, PAGE_MAP[sub], false, true)));
  });
  return kids;
}

function figures() {
  const groups = [
    ["3.1", "Home page - editorial composition and featured pieces", "shot-home"],
    ["3.2", "Product detail - gallery, colour and size matrix with variant stock", "shot-product"],
    ["3.3", "Bag - SKU-level lines, quantity control and server-derived summary", "cart"],
    ["3.4", "Checkout - saved address, payment method and server-derived totals", "checkout"],
    ["3.5", "Order history with status filters", "orders"],
    ["3.6", "Order detail with frozen pricing and the status timeline", "order-detail"],
    ["3.7", "Wishlist - saved pieces for the signed-in customer", "wishlist"],
    ["3.8", "Profile - account details, saved addresses and recent order", "profile"],
    ["3.9", "Staff console - 30-day counters and the order queue", "admin-console"],
    ["3.10", "Policy index with versions and effective dates", "policies"],
  ];
  const kids = [];
  groups.forEach(([num, title, file]) => {
    const sliced = path.join(FIG, `${file}.png`);
    const original = path.join(IMG, `${file}.png`);
    kids.push(...figure(
      fs.existsSync(sliced) ? sliced : original,
      `Figure ${num}: ${title}`,
    ));
  });
  return kids;
}

function chapters() {
  const k = [];

  /* 1 */
  k.push(h1("1: INTRODUCTION"));
  k.push(h2("1.1 Background"));
  k.push(body("Small clothing labels begin by selling through social media and messaging applications. The channel is cheap and personal, but it stops scaling the moment the label carries more than a handful of pieces: stock is tracked by hand, orders live in chat threads, and every sale depends on somebody replying in time. The usual next step is a hosted storefront template. It works, but it forces the label into someone else's design system, hides the stock truth inside a plugin, and charges a commission on every order."));
  k.push(body("THREAD is an attempt to build the alternative. It is a full-stack storefront for a small editorial clothing label, written from scratch around the pieces the label actually sells. The interface is deliberately quiet: a paper-and-ink palette, a serif display face, flat surfaces and rules instead of shadows. Under that surface the project is a study in correctness - variant-level stock, server-derived pricing, an order state machine, and a payment flow that cannot be talked into marking an unpaid order as paid."));
  k.push(body("The system is delivered as two independently deployable applications: a React single-page storefront and staff console, and a Node.js REST API backed by MongoDB and Redis. This separation keeps the browser stateless, allows the API container to restart without logging customers out, and makes each half testable on its own."));
  k.push(h2("1.2 Problem Statement"));
  k.push(body("A small label needs a storefront that represents the brand rather than a template, never oversells stock that does not exist, never records a payment the gateway did not confirm, and lets a two-person team run orders and products without a developer. Off-the-shelf templates fail at least one of these requirements:"));
  ["stock is stored as a single number per product, so a sold-out size still accepts an order;",
    "prices and totals are computed in the browser, so a modified page can change what is charged;",
    "orders are marked paid on a client callback rather than a verified gateway signature;",
    "catalogue edits require code changes, and every filter is a server setting rather than a shareable link."].forEach((t) => k.push(bullet(t)));
  k.push(body("The problem addressed by this project is therefore both functional and architectural: deliver the complete commercial journey, and place the trust boundaries in the places that matter - the server, not the browser."));
  k.push(h2("1.3 Objectives of the Project"));
  k.push(body("The project was carried out against the following objectives:"));
  numbered([
    "Deliver the complete purchase journey - discovery, bag, checkout, payment, order tracking and fulfilment - on a single responsive web client.",
    "Model stock at the variant level (colour and size) and validate it on the server both at add-to-bag and at order placement.",
    "Derive every monetary value on the server from integer paise, treating the client as a renderer only.",
    "Implement online payment with server-side signature and amount verification, idempotent order creation and an explicit unpaid state.",
    "Enforce role-based access control on the client for usability and on the API for security.",
    "Apply an editorial visual identity with measurable accessibility constraints: body text of at least 16 px, labels of at least 12 px, 44 px touch targets, semantic landmarks and URL-encoded filter state.",
    "Deploy both halves to production hosting with an explicit origin allowlist, health checks and structured logs.",
  ]).forEach((p) => k.push(p));
  k.push(h2("1.4 Scope of the Project"));
  k.push(body("The scope of the delivered system is the complete commercial journey of a single-label storefront, not a general-purpose marketplace. The customer can discover a piece, inspect its variants, save it, add it to a bag, check out with a saved or typed address, pay online or choose cash on delivery, and follow the order through a status timeline. The operator can sign in to a separate console, watch the order queue, move an order through its legal states, and create or edit catalogue pieces with their images, variants and prices."));
  k.push(body("The following capabilities are inside the delivered scope:"));
  ["Customer registration with email OTP verification, password login, silent session refresh, logout and password reset.",
    "Catalogue browsing with URL-encoded search, category, size, colour, price and rating filters, sorting and pagination.",
    "Variant-level stock with a colour and size matrix, server-side stock checks and transaction-safe decrement.",
    "Persistent bag and wishlist, including the merge of a guest bag on sign-in.",
    "Checkout with saved or typed address, delivery option, coupon, GST and two payment methods.",
    "Online payment through Razorpay with server-side signature and amount verification, plus a webhook that shares the same confirmation path.",
    "Customer order history and detail, and a staff console for order status, catalogue CRUD, inventory and policies.",
    "Versioned policy pages and verified-purchase reviews."].forEach((t) => k.push(bullet(t)));
  k.push(body("The following capabilities are deliberately outside the scope of this delivery: returns and refunds automation, multi-currency pricing, international shipping, a mobile application, a marketplace with multiple sellers, and a full content-management system for editorial pages. These are recorded in the future scope."));
  k.push(h2("1.5 Significance of the Project"));
  k.push(body("For a small label, the project removes the two dependencies that usually force a move to a hosted template: a developer for every catalogue change and a payments team for every online order. The staff console covers day-to-day operation, and the payment flow delegates card handling to the gateway while keeping the confirmation decision on the server. The label can operate the storefront without giving up control of its design or data."));
  k.push(body("For the team, the project is a study in the parts of e-commerce that are easy to demo and hard to get right: stock that is attached to the combination a customer actually buys, totals that cannot be edited in the browser, an order state machine with an audit trail, and a session model that survives a container restart."));
  k.push(body("For the department, the report documents a production-shaped deployment rather than a local demonstration. The system runs on separate client and API hosts, uses managed data services, verifies real gateway callbacks in test mode, and records the deployment defects that were found and fixed. That record is useful to the next team that attempts a similar build."));
  k.push(h2("1.6 Organisation of the Report"));
  k.push(body("Chapter 1 introduces the problem, objectives and scope. Chapter 2 states the requirements and studies the existing alternatives. Chapter 3 presents the architecture in text form, the module boundaries, the data model, the route table and the interface rules. Chapter 4 explains the methodology and the session, catalogue, order, payment and security paths. Chapter 5 documents the implementation, including the API registry, cookie handling, route guards and payment verification. Chapter 6 reports the testing approach, cases, defects and results. Chapter 7 concludes the report and sets out the limitations and future scope. Chapter 8 contains the API reference, environment variables and references."));

  /* 2 */
  k.push(h1("2: SOFTWARE AND HARDWARE REQUIREMENT SPECIFICATION"));
  k.push(h2("2.1 Hardware Requirements"));
  k.push(body("The system is a web application. The customer side requires only a browser; the developer and server side require a machine capable of running Node.js, a local MongoDB instance for development and a build of the client. The minimum configuration used during development and testing is listed below."));
  k.push(...makeTable(["Component", "Minimum requirement", "Recommended"], [
    ["Processor", "Intel Core i3 (2 cores), 2.0 GHz", "Intel Core i5 or higher, 4 cores"],
    ["Memory", "4 GB RAM", "8 GB RAM or higher"],
    ["Storage", "2 GB free disk space", "10 GB free disk space"],
    ["Display", "1280 x 720", "1920 x 1080"],
    ["Network", "2 Mbps broadband", "10 Mbps broadband"],
    ["Server", "1 vCPU, 512 MB RAM container", "2 vCPU, 1 GB RAM container"],
  ], [4.0, 6.0, 6.0], "Table 2.1: Hardware requirements"));
  k.push(body("On the hosting side the API runs in a single container on a Botkeep (Pterodactyl) node with MongoDB Atlas and a managed Redis instance as backing services, so no dedicated physical server is required."));
  k.push(h2("2.2 Software Requirements"));
  k.push(...makeTable(["Category", "Software / version", "Purpose"], [
    ["Operating system", "Windows 11 (development), Linux container (production)", "Host environment"],
    ["Runtime", "Node.js 24 LTS", "API and build tooling"],
    ["Client framework", "React 19 with Vite 7", "Single-page storefront and console"],
    ["State and data", "Redux Toolkit, RTK Query, Axios", "Client cache and API access"],
    ["Routing", "React Router 7", "Routes, guards and URL state"],
    ["Styling", "Hand-written CSS with design tokens, Bootstrap Icons", "Editorial interface, icon set"],
    ["API framework", "Express 5", "HTTP layer, middleware, routing"],
    ["Database", "MongoDB Atlas with Mongoose", "Durable document storage"],
    ["Cache", "Redis with ioredis", "OTP records, rate-limit counters, refresh sessions"],
    ["Validation", "Zod", "Request body, query and parameter schemas"],
    ["Authentication", "jsonwebtoken, @node-rs/bcrypt, cookie-parser", "Access tokens, password hashing, cookies"],
    ["Payments", "Razorpay Checkout and Orders API (test mode)", "Online payments and webhooks"],
    ["Media", "Cloudinary", "Product image storage and delivery"],
    ["Email", "Nodemailer over SMTP", "OTP and order notifications"],
    ["Observability", "Pino, pino-http", "Structured request logs"],
    ["Tooling", "Git, GitHub, Postman, Chrome DevTools, VS Code", "Version control, testing and debugging"],
    ["Hosting", "Vercel (client), Botkeep/Pterodactyl (API)", "Production deployment"],
  ], [3.4, 6.4, 6.2], "Table 2.2: Software requirements"));
  k.push(h2("2.3 Programming Languages, Libraries and Tools"));
  k.push(body("JavaScript is used end to end. The client is written in modern ES modules with JSX; the server uses ES modules on Node.js. The choice of one language across both halves keeps validation schemas, naming and mental models consistent."));
  ["React and Vite: component-based rendering with a fast development server and a small production bundle.",
    "Redux Toolkit and RTK Query: one cache for server data, tag-based invalidation after mutations, and far less bespoke fetching code than hand-written hooks.",
    "React Router: nested routing, layout routes, and guards that redirect by role.",
    "Express 5: a thin HTTP layer with routing, middleware and error handling.",
    "Mongoose: schema definitions, indexes and transactions for order placement.",
    "Zod: parse, do not validate - every route boundary parses its input into a typed object.",
    "Redis: OTP storage with TTLs, rate-limit counters and refresh-session records.",
    "Razorpay: gateway order creation, checkout.js on the client, and signature verification on the server.",
    "Pino: structured JSON logs with a request id on every line.",
    "Bootstrap Icons: a single icon set, used with accessible labels and no emoji anywhere in the interface."].forEach((t) => k.push(bullet(t)));
  k.push(h2("2.4 Requirements Analysis and Feasibility"));
  k.push(body("The requirements were gathered by walking through the journey a first-time customer and a shop operator actually take, then writing each step as a testable requirement."));
  k.push(h3("Functional requirements"));
  k.push(...makeTable(["ID", "Requirement"], [
    ["FR-1", "Catalogue listing with search, category, size, colour, price and rating filters encoded in the URL, plus sorting and pagination."],
    ["FR-2", "Product detail by slug with gallery, variant matrix, per-variant stock, related pieces and reviews."],
    ["FR-3", "Customer accounts with email OTP verification, password login, silent refresh, logout and password reset."],
    ["FR-4", "Persistent bag keyed by SKU, guest bag merged on sign-in, quantities capped at available stock."],
    ["FR-5", "Wishlist toggle with state reflected across the catalogue and product pages."],
    ["FR-6", "Checkout with saved or new address, delivery option, coupon, GST and payment method selection."],
    ["FR-7", "Online payment with server-side signature verification; unpaid orders never become confirmed."],
    ["FR-8", "Customer order history and detail with a status timeline."],
    ["FR-9", "Staff console with order queue, legal status transitions, catalogue CRUD, image upload and low-stock view."],
    ["FR-10", "Versioned store policies linked from the footer."],
  ], [2.0, 14.0], "Table 2.3: Functional requirements"));
  k.push(h3("Feasibility"));
  k.push(lead("Technical feasibility. ", "Every component is a mature open-source library or a managed service with a free or low-cost tier. The team had prior experience with React and Node.js, so the technical risk was concentrated in the payment flow and in variant stock, both of which were prototyped early."));
  k.push(lead("Economic feasibility. ", "The client is hosted on Vercel's free tier, the API on a small container, MongoDB Atlas and Redis on managed tiers, and Cloudinary on its free plan. The only unavoidable cost is the payment gateway's transaction fee, which applies per successful order rather than as a platform charge."));
  k.push(lead("Operational feasibility. ", "The staff console is a normal web page with no installation. Catalogue edits, order status changes and image uploads are performed through forms, so the label does not need a developer for day-to-day operation."));
  k.push(h2("2.5 Study of Existing Systems"));
  k.push(body("Four approaches were considered before the build: a hosted SaaS storefront, a plugin-based storefront on a general content platform, a headless commerce framework, and a bespoke application. Each solves the basic problem of listing a product and taking an order; they differ in where the stock truth lives, how much design control the label keeps, and how much engineering the label must own."));
  k.push(...makeTable(["Approach", "Stock model", "Design and data control", "Operating cost", "Fit for a two-person label"], [
    ["Hosted SaaS (for example Shopify)", "Variant stock is supported, but the rules live inside the platform", "Theme-level control; catalogue and customer data stay on the platform", "Monthly subscription plus payment and application fees", "Fast to start, but the label rents its storefront and its data"],
    ["Plugin storefront (for example WooCommerce)", "Variant stock depends on the plugin set and its configuration", "Theme and plugin control; self-hosted database", "Hosting, plugins and ongoing maintenance", "Flexible, but plugin updates and security become a second job"],
    ["Headless commerce framework (for example Medusa)", "Variant stock and server-side totals are part of the framework", "Full design control with a separate admin", "Hosting plus the engineering needed to run and extend it", "Strong fit, but heavier than a two-person catalogue needs"],
    ["Bespoke application (this project)", "Variant stock, reservations and decrements are written for this catalogue", "Full control of interface, data model and deployment", "Low hosting cost; engineering time is the main investment", "Fits the catalogue and the team, provided the sensitive paths are tested"],
  ], [3.5, 4.4, 3.6, 3.0, 3.5], "Table 2.4: Comparison of storefront approaches"));
  k.push(body("The comparison made the trade-off explicit. A hosted platform would have delivered a working shop in days, but it would have hidden the two behaviours the project set out to study: variant-level stock and server-authoritative pricing. A headless framework would have supplied both, but it would also have supplied a large surface that the label does not need and the team would still have to operate. The bespoke route was chosen because the interesting requirements sit exactly at the boundary between the client and the API, and because the resulting system can be explained end to end."));
  k.push(h2("2.6 Proposed System"));
  k.push(body("The proposed system is a two-application, three-tier storefront. A React single-page client renders the storefront and the staff console; an Express API owns every rule that must not be trusted to a browser; MongoDB Atlas stores durable documents; Redis holds short-lived state; Cloudinary serves product media; Razorpay handles the card data; and SMTP delivers transactional mail. The client and the API are deployed separately, so each can be rebuilt, restarted or rolled back without taking the other down."));
  k.push(body("The design is deliberately narrow. The client never receives database credentials, never computes a payable total that the server will accept, and never marks an order paid. The API treats every request as untrusted input, parses it with a schema, applies the rule in a service, and writes through a model. The staff console uses the same API as the storefront but a different role, which keeps one set of business rules instead of two."));
  k.push(body("Six decisions distinguish the proposed system from a template installation:"));
  ["Stock is stored per variant and validated again at order placement, not only when the bag is drawn.",
    "Every amount is computed from integer paise on the server; the client renders and never submits a total.",
    "An online order is confirmed only after an HMAC signature and an amount comparison succeed, whether the confirmation arrives from the browser or the webhook.",
    "Sessions are reconstructed from an httpOnly refresh cookie and a Redis record, so a container restart does not sign customers out.",
    "The staff console is a role on the same API, protected by a separate login and an authorisation middleware on every admin route.",
    "The interface is constrained by measurable accessibility rules rather than reviewed for them at the end."].forEach((t) => k.push(bullet(t)));
  k.push(body("Taken together, those decisions describe a system that is small enough for two people to operate but strict enough to be trusted with an order. The chapters that follow explain how each decision is implemented, how it was tested, and where the current delivery stops. The emphasis is on the paths that carry money, identity and stock, because those are the paths where a shortcut in the browser becomes a defect in the business."));

  /* 3 */
  k.push(h1("3: SYSTEM DESIGN AND ARCHITECTURE"));
  k.push(h2("3.1 System Architecture"));
  k.push(body("THREAD follows a three-tier, API-first architecture: a browser client, a stateless HTTP API, and stateful backing services. The client never talks to the database. The API holds no session state in process memory, which is what allows the container to restart without logging users out - a session is reconstructed from a signed refresh cookie and a Redis record."));
  k.push(body("The tiers communicate as follows. The browser loads the static client from a CDN and calls the API over HTTPS with credentials enabled, so the httpOnly refresh cookie travels with session requests. The API reads and writes MongoDB, uses Redis for short-lived state, streams product images through Cloudinary, sends transactional mail over SMTP, and exchanges payment confirmations with Razorpay. CORS is restricted to an explicit origin allowlist, so a page on any other origin cannot call the API with a user's credentials."));
  k.push(...makeTable(["Tier", "Component", "Responsibility"], [
    ["Presentation", "React SPA on Vercel", "Rendering, routing, client-side guards, optimistic UI"],
    ["Application", "Express API on Botkeep", "Business rules, validation, authorisation, pricing, payments"],
    ["Data", "MongoDB Atlas", "Users, products, carts, orders, reviews, policies"],
    ["Ephemeral", "Redis", "OTP codes, rate-limit counters, refresh-session records"],
    ["External", "Razorpay, Cloudinary, SMTP", "Payments, media, transactional email"],
  ], [3.2, 5.0, 8.0], "Table 3.1: Tier responsibilities"));
  k.push(h2("3.2 Architecture in Text"));
  k.push(body("The architecture is easier to audit when it is written as a sequence of responsibilities and calls rather than as a diagram alone. This section describes the same system in words: what each tier owns, how a request travels through it, how identity and commerce are reconstructed on every call, and what happens when a dependency fails. The description is deliberately concrete, because most of the correctness of the project lives in the order in which those steps occur."));
  k.push(h3("3.2.1 Component view"));
  k.push(body("The presentation tier is a React single-page application built with Vite and served as static files from Vercel. It contains the storefront routes, the staff routes, the route guards, the RTK Query cache and the design system. It holds the access token in memory, keeps the refresh token out of JavaScript entirely, and has no database driver, no gateway secret and no ability to write an order directly. Every piece of state it displays either came from the API or is local interface state such as an open drawer or a typed search term."));
  k.push(body("The application tier is an Express 5 API running in a single container on Botkeep. Its middleware order is part of the design: Helmet sets security headers, CORS checks the origin against an explicit allowlist, the cookie parser exposes the refresh cookie, the JSON parser reads ordinary bodies while the webhook route receives a raw body for signature verification, pino-http attaches a request id and a structured log line, and route-specific rate limiters guard the sensitive doors. Behind the middleware, each domain router parses its input with Zod, calls a service, and reaches MongoDB through a Mongoose model. The API keeps no session state in process memory; a restart is invisible to a signed-in customer."));
  k.push(body("The data tier is split by the lifetime of the data. MongoDB Atlas stores the durable documents: users, products with their variant arrays, carts, wishlists, orders with frozen line items, coupons, reviews and policies. Redis stores state that is allowed to expire: OTP records, rate-limit counters and refresh-session records. Cloudinary stores and delivers product media. Razorpay holds the card data and returns a signed payment result. SMTP carries transactional mail. The dependency direction is one-way: the client calls the API, the API calls the data tier, and no backing service ever calls the client."));
  k.push(h3("3.2.2 Request lifecycle"));
  k.push(body("A single request passes through the following stages. The order matters, because each stage narrows what the next one is allowed to assume."));
  numbered([
    "Name resolution and static delivery: the browser resolves the client host, Vercel serves the SPA shell and hashed assets, and the SPA rewrite returns index.html for a deep link such as /admin/login instead of a platform 404.",
    "Application boot: React mounts, the session bootstrap calls the refresh endpoint with credentials enabled, and the client waits for the answer before deciding whether the visitor is a guest, a customer or a staff member.",
    "Request construction: RTK Query builds the request, attaches the in-memory access token as an authorization header, and lets the browser attach the refresh cookie only on the authentication path for which the cookie is scoped.",
    "Origin check: a cross-origin request triggers a preflight; the API answers only for an origin on the allowlist, so a page on another origin cannot call the API with a customer's credentials.",
    "Middleware: the request receives an id, security headers, a parsed body, a rate-limit decision and a log entry before any route code runs.",
    "Validation: the route parses body, query and parameters with a Zod schema. Unknown or malformed input is rejected at the boundary, so a service never receives a half-valid object.",
    "Business rule: the service applies the rule against the current database state, using a transaction where more than one document must change together.",
    "Response and cache: the API returns a small JSON envelope; RTK Query stores the result under a tag and invalidates the affected tags after a mutation, so the next read reflects the write without a full page reload."
  ]).forEach((p) => k.push(p));
  k.push(body("Two consequences follow from this sequence. First, the browser is never the authority for stock, price or payment state; it can only ask the API to perform an operation, and the API re-derives the answer from the database. Second, a read that the client cached can be stale, but a write cannot be applied to stale data, because the service re-reads the documents it is about to change inside the request."));
  k.push(h3("3.2.3 Identity and session path"));
  k.push(body("Registration begins with an email address and a password. The API hashes the password with bcrypt, creates the account in an unverified state, generates a six-digit code, stores only a SHA-256 hash of that code with a server-side pepper, and sends the plain code by email. Verification checks the hash, the remaining attempts and the expiry, marks the account verified and issues the first session. The plain code never exists in the database or in a log."));
  k.push(body("Login compares the password hash and then checks the role. A staff account that presents credentials at the customer login is rejected with 403 ADMIN_PORTAL_ONLY, so the two audiences cannot accidentally share a session. On success the API returns a short-lived access JWT in the response body and sets a rotating refresh token in an httpOnly cookie. The access token lives only in Redux memory; the refresh token is unreadable to scripts and is scoped to the authentication path."));
  k.push(body("The refresh record is stored in Redis with the user identity and an expiry. On refresh, the API validates the record, replaces it with a new one, sets a new cookie and returns a fresh access token with the public user. A 401 on any later request triggers exactly one refresh and a replay of the original request; a second failure ends the session. A guest receives a 401 on the first refresh, which the client treats as a normal outcome rather than an error. Logout revokes the Redis record and clears the cookie."));
  k.push(body("Authorisation is applied twice. The client guards routes for usability, so a customer does not land on a staff screen and a staff member does not land in the storefront. The API applies adminRequired to every admin route for security, so a direct HTTP call without a staff token is rejected regardless of what the client rendered. The two layers use the same role value but serve different purposes: one prevents confusion, the other prevents access."));
  k.push(h3("3.2.4 Commerce paths"));
  k.push(body("Catalogue reads begin with the URL. Search, category, size, colour, price, rating, sort and page are parsed into a filter object, validated, and translated into a MongoDB query. A text index provides relevance across title, brand, category and colour names, and a word-start prefix pass catches fragments such as jack or a colour such as blue. Hidden products are excluded in the query rather than filtered after the fact, so pagination counts remain correct."));
  k.push(body("The bag stores a SKU, not a product id. Adding an item re-reads the variant on the server, rejects a quantity above the available stock and returns the recalculated bag. The client may render an optimistic quantity, but the server's answer replaces it. Checkout re-reads every line again, applies the coupon and delivery rules, computes GST and the grand total from integer paise, and only then writes the order."));
  k.push(body("A cash-on-delivery order is written and confirmed in one transaction: the order document is created with a frozen snapshot of the line items and the shipping address, stock is decremented for each SKU, and a timeline entry records the confirmation. An online order is written in a payment-pending state. The client asks the API to create a gateway order for the server-computed amount, opens Razorpay Checkout with the returned order id and public key, and posts the payment id, gateway order id and signature back to the API. The API recomputes the HMAC-SHA256 signature, compares the amount and currency with the stored order, and only then confirms it. The webhook runs the same confirmation path with a raw-body signature check, so a browser callback and a gateway callback converge on one idempotent transition."));
  k.push(body("The staff path shares the same order service but a different entry point. Staff sign in through /api/admin/login, receive a staff access token, and pass adminRequired on every subsequent admin call. Status changes are validated against the legal transition table before they are written, and each change appends to the same timeline the customer reads. Catalogue edits write the product document and upload media through signed Cloudinary requests; the storefront sees the change on its next read, with no deployment."));
  k.push(h3("3.2.5 Deployment and failure behaviour"));
  k.push(body("The deployed system has two independent origins. The client is a static build on Vercel with an SPA rewrite; the API is a Node.js container on Botkeep with MongoDB Atlas, managed Redis, Cloudinary, Razorpay and SMTP as backing services. TLS terminates at each host. The API accepts only the configured client origin, reads its secrets from environment variables, and exposes a health endpoint that reports the state of its dependencies. The client reads a small configuration endpoint to decide whether online payment is available, so a missing gateway key degrades the checkout instead of breaking the page."));
  k.push(body("Failure behaviour was designed rather than discovered. The table below records what each failure does to the customer experience."));
  k.push(...makeTable(["Failure", "Behaviour", "Why it is safe"], [
    ["API container restarts", "The access token is refreshed from the httpOnly cookie and the Redis record; the customer stays signed in", "No session state lives in process memory"],
    ["Redis is unavailable", "The health endpoint reports the dependency as down and session, OTP and rate-limit operations fail rather than bypass their checks", "The system does not silently drop a security control"],
    ["MongoDB is unavailable", "Reads and writes return a server error and the client shows a retry state", "No fabricated catalogue or order data is rendered"],
    ["Razorpay is unavailable", "The configuration endpoint hides the online option and cash on delivery remains usable", "Checkout degrades to a supported path"],
    ["Checkout is retried", "The idempotency key returns the original order instead of creating a second one", "A network retry cannot duplicate an order"],
    ["A payment signature is wrong", "Verification returns 400 and the order stays in payment pending", "A client callback cannot mark an order paid"],
  ], [4.0, 7.4, 4.8], "Table 3.2: Failure behaviour by dependency"));
  k.push(h3("3.2.6 Architecture decisions and trade-offs"));
  k.push(body("Every structural choice buys one property at the cost of another. The table below states both sides, because a report that lists only the benefits is not useful to the next team."));
  k.push(...makeTable(["Decision", "Alternative considered", "What it buys", "What it costs"], [
    ["Separate SPA and API", "A server-rendered monolith", "Independent deploys and a clear trust boundary", "Two hosts, CORS configuration and a cross-site cookie"],
    ["MongoDB documents", "A relational schema", "Nested variants and frozen order snapshots fit the domain", "Transactions and indexes need explicit discipline"],
    ["Redis for ephemeral state", "In-process memory", "Sessions, OTPs and limits survive a restart and are shared", "One more dependency to run and monitor"],
    ["Server-derived pricing", "Client-computed totals", "A modified page cannot change what is charged", "An extra server read on every checkout"],
    ["Signature verification", "Trusting the checkout callback", "An unpaid order cannot be marked paid", "Webhook and reconciliation paths must be maintained"],
    ["Hand-written CSS", "A component kit", "Brand control and measurable accessibility", "More CSS to own and review"],
  ], [3.4, 3.6, 4.8, 4.4], "Table 3.3: Architecture decisions and trade-offs"));
  k.push(h2("3.3 Module Description"));
  k.push(body("The API is organised by domain module. Each module owns its routes, schemas, service and data access, and exposes only its router to the central registry."));
  k.push(...makeTable(["Module", "Responsibility"], [
    ["auth", "Registration, OTP verification, login, refresh, logout, password reset, Google entry point"],
    ["users", "Profile updates and saved addresses"],
    ["products", "Catalogue queries, detail by slug, featured pieces, categories, related items"],
    ["search", "MongoDB text index plus word-start prefix matching on title, brand, category and colours"],
    ["carts", "Server-side bag keyed by SKU, quantity updates, guest-bag merge"],
    ["wishlists", "Saved products and per-product state for the heart control"],
    ["orders", "Order creation, customer history and detail, status timeline, stock decrement"],
    ["payments", "Razorpay order creation, signature verification, webhook handling"],
    ["coupons", "Coupon lookup and discount rules applied server-side"],
    ["reviews", "Verified-purchase reviews with average rating aggregation"],
    ["policies", "Versioned, effective-dated store policies"],
    ["admin", "Staff login, dashboard, catalogue CRUD, inventory, order queue, policy editing"],
    ["emails", "Templated transactional mail for OTP, verification and order events"],
  ], [3.6, 12.6], "Table 3.4: API modules"));
  k.push(h2("3.4 Database Design"));
  k.push(body("MongoDB was chosen because a product is naturally a document with a nested variant array, and because orders keep a frozen copy of what was bought rather than a set of live foreign keys. Money is stored as integer paise everywhere, never as a floating-point rupee value."));
  k.push(...makeTable(["Collection", "Key fields", "Purpose"], [
    ["users", "name, email, phone, passwordHash, role, isEmailVerified, addresses[]", "Accounts and addresses"],
    ["products", "title, slug, images[], category, price, mrp, variants[sku, size, color, stock, price]", "Catalogue and stock"],
    ["carts", "userId, items[productId, sku, qty]", "Server-side bag"],
    ["wishlists", "userId, productIds[]", "Saved pieces"],
    ["orders", "orderNumber, userId, items[], shippingAddress, pricing, payment, status, timeline[]", "Orders and audit trail"],
    ["coupons", "code, type, value, minSubtotal, maxDiscount, expiresAt, isActive", "Discount rules"],
    ["reviews", "productId, userId, rating, title, body, isVerifiedPurchase", "Product feedback"],
    ["policies", "slug, title, version, effectiveAt, body", "Published policies"],
  ], [2.6, 9.4, 4.2], "Table 3.5: Collections and key fields", 9.5, 40));
  k.push(body("Two indexes carry most of the read load: a text index over the product title, brand, category and colour names for catalogue search, and a unique index on the variant SKU so that a bag line can always be resolved to exactly one product, colour and size. Orders additionally carry a unique order number and an idempotency key, so a retried checkout cannot create a duplicate order."));
  k.push(h2("3.5 Client Routing and Access Control"));
  k.push(body("The client is a single-page application. Access is shaped by two guards: RequireCustomer keeps staff out of the storefront, and RequireAdmin sends guests to the staff portal and customers to the home page. The cart is intentionally open to guests, because a first-time visitor should be able to build a bag before creating an account."));
  k.push(...makeTable(["Path", "Access", "Page"], [
    ["/", "Guest, Customer", "Editorial home page"],
    ["/shop", "Guest, Customer", "Catalogue with URL filters"],
    ["/product/:slug", "Guest, Customer", "Product detail"],
    ["/cart", "Guest, Customer", "Bag"],
    ["/auth", "Guest only", "Sign in, register, verify, reset"],
    ["/wishlist", "Customer", "Saved pieces"],
    ["/checkout", "Customer", "Address, payment and summary"],
    ["/orders, /orders/:id", "Customer", "Order history and detail"],
    ["/profile", "Customer", "Profile and addresses"],
    ["/policies, /policies/:slug", "Public", "Policy index and page"],
    ["/admin/login", "Guest only", "Staff sign-in"],
    ["/admin", "Staff", "Order console"],
    ["/admin/products", "Staff", "Catalogue list"],
    ["/admin/products/new", "Staff", "Create a piece"],
    ["/admin/products/:slug/edit", "Staff", "Edit a piece"],
    ["*", "Public", "Not-found page"],
  ], [5.2, 4.0, 7.0], "Table 3.6: Client routes and access"));
  k.push(h2("3.6 Interface Design"));
  k.push(body("The interface uses a paper-and-ink palette with a serif display face for headings and a neutral sans face for controls and body copy. Elevation is expressed with hairlines rather than shadows, and the layout is a flat grid with generous whitespace. Bootstrap Icons is the only icon set; there is no emoji anywhere in the product."));
  k.push(body("Accessibility is treated as a constraint rather than a review step. Body text is at least 16 px and labels at least 12 px with letter-spacing, every interactive target is at least 44 px, icon-only controls carry an aria-label, toggles expose aria-pressed, forms use real label elements with inline role=alert errors, focus is always visible, and each page has a single h1 inside a main landmark with a skip link ahead of it."));
  k.push(body("The visual system is expressed as tokens rather than one-off values: a small spacing scale, three radii, a type scale with a 12 px label floor, a small set of border and surface colours, and motion durations that respect prefers-reduced-motion. Product cards, buttons, fields and panels consume those tokens, so a change to the scale propagates consistently. The result is a flat editorial surface: hairlines instead of shadows, square panels instead of rounded cards, and photography carrying most of the colour."));
  k.push(h2("3.7 Interface Walkthrough"));
  k.push(body("The ten figures below were captured from the live deployment at a desktop viewport with real data: a signed-in customer with a populated bag and order history, and staff credentials for the console. Each figure is reproduced once, at a size that keeps the interface legible on a single page; scrolling pages are represented by the region that carries the feature under discussion rather than by a tall strip."));
  k.push(...figures());

  /* 4 */
  k.push(h1("4: METHODOLOGY AND IMPLEMENTATION"));
  k.push(h2("4.1 Proposed Methodology and Workflow"));
  k.push(body("The project followed an incremental, vertical-slice methodology. Each iteration delivered one complete path through every layer - database, service, route, client page - instead of building a whole layer at a time. This kept the system demonstrable from the first week and exposed integration problems early."));
  numbered([
    "Requirement walkthrough: list the steps a customer and an operator actually take, then write each as a testable requirement.",
    "Data modelling: define the collections, indexes and money representation before writing routes.",
    "API slice: implement the module end to end with a Zod schema at the boundary and a service behind it.",
    "Client slice: add the RTK Query endpoint, the page, the loading and error states, and the guard.",
    "Verification: exercise the slice against the live API, then against the deployed environment.",
    "Hardening: rate limits, error shapes, logging and accessibility checks before moving to the next slice.",
  ]).forEach((p) => k.push(p));
  k.push(h2("4.2 Session and Authentication Design"));
  k.push(body("Authentication separates the short-lived credential from the long-lived one. On login the API returns a short-lived JWT access token in the response body and sets a rotating refresh token in an httpOnly cookie scoped to the authentication path. The access token lives only in Redux memory; it is never written to localStorage or exposed to a script."));
  k.push(body("On boot the client calls the refresh endpoint. The API validates the refresh record in Redis, rotates the token, sets a new cookie and returns a fresh access token together with the public user. A 401 on any later request triggers exactly one refresh and replay of the original request. A guest receives a 401 on the first refresh; the client treats it as a normal outcome and renders the storefront, showing a session-check state while the decision is pending so guards never flash the wrong screen."));
  k.push(body("Registration is gated by a six-digit email OTP. Codes are stored as a SHA-256 hash with a server-side pepper, expire after ten minutes, allow five verification attempts, and are bounded by a 60-second resend cooldown, five sends per hour per address and ten sends per day per network. The plain code exists only in the email that is sent."));
  k.push(h2("4.3 Catalogue, Search and Variant Stock"));
  k.push(body("The catalogue query is built from URL search parameters, so every filter combination is a shareable link and the browser's back button behaves as a user expects. Search uses a MongoDB text index for relevance plus a word-start prefix pass over title, brand, category and colour names, so typing a fragment such as \"jack\" or a colour such as \"blue\" still resolves to the right piece."));
  k.push(body("Stock is modelled at the variant level. A product owns an array of variants, each with a SKU, size, colour, stock and optional price override. The product page derives the selectable matrix from that array and disables sold-out combinations. Adding to the bag re-reads the variant on the server, rejects a quantity above stock and stores only the SKU. Checkout recomputes every line from the database before the order is written, and order placement decrements stock inside a transaction."));
  k.push(h2("4.4 Order Lifecycle and Pricing"));
  k.push(body("An order moves through an explicit state machine. A cash-on-delivery order is created and confirmed immediately; an online order is created in a payment-pending state and only becomes confirmed after the gateway signature is verified. Staff move confirmed orders through packed, shipped and delivered, or cancel them. Every transition is written to the order timeline, so the customer sees the same history the operator does."));
  k.push(body("Pricing is computed once, on the server, from integer paise: line totals from the stored unit price, then discount, shipping, GST at five per cent and the grand total. The client renders the numbers it receives and never submits a total of its own. During verification the same arithmetic produced a subtotal of Rs 9,000, GST of Rs 450 and a payable total of Rs 9,450 for a single jacket, which matched the amount shown in the bag and at the gateway."));
  k.push(h2("4.5 Online Payment Workflow"));
  k.push(body("Online payment uses Razorpay in test mode. The client asks the API to create a gateway order for the server-computed amount; the API returns the gateway order id and the public key. The client opens the Razorpay checkout with those values, and on success posts the payment id, gateway order id and signature back to the API. The API recomputes the HMAC-SHA256 signature with the secret key, compares the captured amount and currency with the stored order, and only then marks the order paid and confirmed. A signature mismatch is rejected and logged; the order is never marked paid on the strength of a client callback."));
  k.push(body("If the customer closes the modal, the order stays in payment pending with its stock held for a bounded window. The webhook and a reconciliation sweep decide whether to confirm or release it, which keeps an abandoned checkout from silently overselling a variant. The storefront hides the online option when the configuration endpoint is unavailable and falls back to cash on delivery, so a gateway outage cannot leave the customer staring at a dead button."));
  k.push(h2("4.6 Security Design"));
  k.push(...makeTable(["Control", "Implementation"], [
    ["Password storage", "@node-rs/bcrypt with cost 10; hashes are never reversible"],
    ["Access token", "JWT with a short lifetime, held in memory only"],
    ["Refresh token", "Random 256-bit value in an httpOnly cookie, Redis-backed, rotated on every use, path-scoped"],
    ["OTP", "Six digits, SHA-256 with pepper, ten-minute TTL, five attempts, resend and daily caps"],
    ["Authorisation", "adminRequired on every /api/admin route; staff rejected by the customer login with 403 ADMIN_PORTAL_ONLY"],
    ["Rate limiting", "General 300/5 min; auth 30/10 min; OTP verify 10/10 min; refresh 60/10 min; writes 100/5 min; admin login 10/10 min; uploads 30/10 min; payments 30/10 min"],
    ["Input validation", "Zod schemas at body, query and parameter boundaries"],
    ["Headers", "Helmet: HSTS, content-type options, referrer policy, frame options"],
    ["CORS", "Explicit origin allowlist with credentials; unknown origins rejected as CORS_REJECTED"],
    ["Idempotency", "Idempotency-Key accepted on order creation to prevent duplicate orders"],
    ["Webhooks", "Raw-body HMAC verification before any state change"],
    ["Logging", "Structured JSON with request ids; secrets and tokens are never logged"],
  ], [4.2, 12.0], "Table 4.1: Security controls"));
  k.push(h2("4.7 API Design and Response Contract"));
  k.push(body("The API is resource-oriented and uses plural nouns for collections: /api/products, /api/cart, /api/orders, /api/policies and /api/admin/orders. Actions that are not a simple create, read, update or delete are expressed as a sub-resource with a verb, such as /api/payments/razorpay/verify or /api/admin/orders/:id/status. The shape is intentionally conventional so that a new route can be reviewed against the existing ones without a style debate."));
  k.push(body("Every response uses one envelope. A successful response carries success set to true and a data field; a failure carries success set to false and an error object with a stable code, a human-readable message and optional details. The client branches on the code, not on the message text, so copy can change without breaking behaviour. Paginated collections add a meta object with the page, the page size and the total count, which lets the interface render pagination without a second request."));
  k.push(body("Status codes are used consistently. The table below records the contract that the client can rely on."));
  k.push(...makeTable(["Status", "Used when", "Client behaviour"], [
    ["200 OK", "A read or an update succeeded", "Render the returned data"],
    ["201 Created", "An order, review or catalogue piece was created", "Navigate to the created resource"],
    ["400 Bad Request", "The request is syntactically valid but violates a rule, such as a bad coupon or a failed payment signature", "Show the message against the relevant control"],
    ["401 Unauthorized", "The access token is missing or expired", "Attempt one refresh, then replay or end the session"],
    ["403 Forbidden", "The role is not allowed, or staff credentials were used on the customer login", "Redirect to the correct portal"],
    ["404 Not Found", "The product, order or policy does not exist", "Render the not-found state"],
    ["409 Conflict", "A stock, duplicate or state-transition conflict", "Refresh the affected view and explain the conflict"],
    ["422 Unprocessable Entity", "Zod rejected a field before any service ran", "Show field-level errors"],
    ["429 Too Many Requests", "A route budget was exhausted", "Ask the customer to wait; do not retry in a loop"],
    ["500 / 503", "An unexpected error or an unavailable dependency", "Show a retry state; never fabricate data"],
  ], [3.3, 8.6, 4.3], "Table 4.2: HTTP status contract"));
  k.push(body("Order creation additionally accepts an Idempotency-Key. The first request stores the key with the resulting order; a retry with the same key returns the original order with an idempotentReplay flag instead of creating a second one. This is what makes a network retry, a double click or the client's 401 replay safe. The key is scoped to the customer and has a bounded lifetime, so it cannot be used to read another customer's order."));
  k.push(body("The API is not versioned with a path prefix. The client and the API are deployed from the same repository and verified together, and the envelope leaves room for additive fields. A breaking change would be introduced as a new route rather than by silently changing the meaning of an existing one."));
  k.push(h2("4.8 Validation, Error Handling and Observability"));
  k.push(body("Validation follows a parse, do not validate rule. Each route defines a Zod schema for the body, the query and the parameters, and the handler receives the parsed object rather than the raw request. Parsing strips unknown fields, coerces the values that are safe to coerce and rejects the rest with a field-level error. This keeps the service layer free of defensive checks and makes the accepted shape of every route readable in one place."));
  k.push(body("Errors are handled in one place. A service throws a typed error with an HTTP status and a stable code; the central error middleware converts it into the response envelope. Operational errors, such as a sold-out variant or a bad signature, keep their message. Unexpected errors are logged with the request id and returned as a generic 500, so an internal stack trace never reaches the browser. In production the logger redacts authorization headers, cookies, passwords and gateway secrets."));
  k.push(body("Every request carries an id from the moment it enters the API. The id appears in the structured log line, in the error response and in the server-side log for the same request, which turns a customer report into a single search. The health endpoint reports the state of MongoDB, Redis, search and Razorpay, so a deployment can be checked before a browser is opened. The client mirrors this discipline with explicit loading, empty, error and retry states on every data-bearing page; a failed request produces an explanation and a way forward, not a blank screen."));
  k.push(body("Error codes are treated as part of the interface contract rather than as debugging text. A sold-out variant, an expired coupon, a rejected signature and an exhausted rate limit each have a stable code that the client can branch on and the test suite can assert. The message is written for the customer, while the log line keeps the request id and the technical detail. This separation lets the interface explain a failure without exposing an internal path, a stack trace or a secret."));
  k.push(body("Health reporting follows the same principle. The health endpoint is public but not verbose: it reports each dependency as available or unavailable and returns a non-success status when a required dependency is down. The configuration endpoint exposes only the values a browser legitimately needs, such as the public gateway key and the email delivery mode. Neither endpoint exposes a connection string, a secret or an internal hostname."));
  k.push(h2("4.9 Deployment and Configuration", { breakBefore: true }));
  k.push(body("Configuration is environment-specific and never committed. The client reads its API base URL and public gateway key at build time; the API reads its database, Redis, JWT, gateway, Cloudinary, SMTP and CORS values at boot. The API validates the required values before it starts listening, so a missing secret fails the deployment instead of producing a half-working instance. SERVER_PORT takes precedence over PORT because the hosting panel injects the former, with a fallback so the same image also runs locally."));
  k.push(body("The client is built with Vite and deployed to Vercel as static output. A rewrite sends every unknown path to index.html, which is what makes a deep link such as /admin/login work on a static host. The API is deployed as a single container on Botkeep. A root manifest and lockfile let the panel install dependencies without a separate build step, and a pre-start guard verifies that the runtime dependencies are present before the process starts. The container exposes the health endpoint and reads the same environment file in every restart."));
  k.push(...makeTable(["Concern", "Development", "Production"], [
    ["Client origin", "Local Vite dev server", "Vercel domain, served over HTTPS"],
    ["API origin", "Local Express process", "Botkeep container behind HTTPS"],
    ["Database", "Local MongoDB or an Atlas development cluster", "MongoDB Atlas production cluster"],
    ["Redis", "Local Redis instance", "Managed Redis with persistence"],
    ["Payments", "Razorpay test keys", "Razorpay test mode for this delivery; live keys are a launch step"],
    ["Email", "SMTP or the console transport", "SMTP with a verified sender"],
    ["Refresh cookie", "SameSite=Lax on localhost", "SameSite=None with Secure is required for the cross-site client"],
  ], [4.0, 6.2, 6.0], "Table 4.3: Environment configuration"));
  k.push(body("The deployment order is client after API. The API is deployed first and its health endpoint is checked; the client is then built against the deployed API origin, and the origin is added to the API allowlist. A rollback is a redeploy of the previous build on either host, which is possible because the two halves are independent and the database schema is additive."));
  k.push(h2("4.10 Data Consistency and Transaction Boundaries"));
  k.push(body("The order path changes more than one document: an order is written, stock is decremented for every line, and a timeline entry is appended. Those writes must succeed or fail together, so order placement runs inside a MongoDB transaction. The service re-reads each SKU inside the transaction, verifies that the requested quantity is still available, writes the order with a frozen snapshot of the line items and the address, decrements each variant and appends the first timeline entry. If any step fails, the transaction aborts and no stock is lost."));
  k.push(body("Reads that do not change shared state do not need a transaction. Updating a cart line, toggling a wishlist item or editing a profile is a single-document write, which MongoDB applies atomically. The distinction matters because a transaction has a cost and a retry behaviour of its own; using one for every write would add complexity without adding a guarantee."));
  k.push(body("Uniqueness is enforced by indexes rather than by a prior read. The variant SKU is unique, the order number is unique, and the idempotency key is unique per customer. Payment identifiers use partial unique indexes so that documents without a payment id do not collide with one another; an earlier build used a sparse index that still indexed explicit nulls and rejected a second cash-on-delivery order. The fix was to make the index partial on the existence of the field, which is the correct expression of the rule."));
  k.push(body("Orders deliberately denormalise the product. A line stores the title, the SKU, the size, the colour and the unit price at the time of purchase, rather than a live reference that would change when the catalogue changes. The product page and the order detail therefore answer different questions: the page shows what is for sale now, and the order shows what was bought then. That separation is what makes a historical total reproducible even after a price edit."));
  k.push(...makeTable(["Write path", "Documents touched", "Boundary"], [
    ["Add or update a bag line", "Cart", "Single-document atomic write"],
    ["Place a cash-on-delivery order", "Order, products (stock), timeline", "Multi-document transaction"],
    ["Confirm an online payment", "Order, timeline", "Idempotent transition after signature verification"],
    ["Advance or cancel an order", "Order, timeline", "Validated transition, single order document"],
    ["Create or edit a catalogue piece", "Product", "Single-document write plus media upload"],
    ["Publish a policy version", "Policy", "Single-document write with an effective date"],
  ], [5.2, 5.6, 5.4], "Table 4.4: Write paths and consistency boundaries"));
  k.push(body("The transaction boundary is kept as short as possible. Signature verification, coupon evaluation and address validation happen before the transaction opens; the transaction contains only the reads that decide stock and the writes that must be atomic. This reduces the window in which two checkouts can contend for the same variant and keeps the retry story simple: a failed transaction is retried from the service entry point, not from the middle of a partially applied order."));

  /* 5 */
  k.push(h1("5: CODE IMPLEMENTATION"));
  k.push(h2("5.1 Implementation Steps"));
  k.push(body("The build proceeded in the order below. Each step ended with a working, demonstrable system rather than a partial layer."));
  numbered([
    "Scaffold the client with Vite and the API with Express, and agree on the response envelope.",
    "Model users, products and variants; add the text and SKU indexes; write the seed script for the staff account.",
    "Implement registration, OTP verification, login, refresh and logout; wire the client session bootstrap.",
    "Build the catalogue and product detail pages against the live API, including the variant matrix.",
    "Implement the bag and wishlist, including guest-bag merge on sign-in.",
    "Implement addresses, checkout and server-side pricing; place a cash-on-delivery order end to end.",
    "Add Razorpay order creation, checkout.js on the client, signature verification and the webhook.",
    "Build the staff console: order queue, status transitions, catalogue CRUD, image upload and inventory.",
    "Add policies, reviews, coupons and the editorial policy pages.",
    "Harden: Helmet, CORS, rate limits, Zod schemas, structured logs and the health endpoint.",
    "Deploy the client to Vercel and the API to Botkeep; verify deep links, CORS and the health check.",
  ]).forEach((p) => k.push(p));
  k.push(h2("5.2 Server Bootstrap and Routing"));
  k.push(body("The API mounts every domain router in one registry, which keeps the entry point readable and makes the surface easy to audit. The staff login is mounted before the role-gated admin router so that an unauthenticated request can reach it, while everything behind it requires a valid staff token."));
  k.push(codeBlock(`// server/src/routes/index.js - central API route registry
router.get('/health', health);
router.get('/config', storefrontConfig);

router.use('/auth', authRoutes());
router.use('/products', productRoutes());
router.use('/cart', cartRoutes());
router.use('/payments', paymentRoutes());
router.use('/wishlist', wishlistRoutes());
router.use('/orders', orderRoutes());
router.use('/coupons', couponRoutes());
router.use('/reviews', reviewRoutes());
router.use('/users', userRoutes());
router.use('/policies', policyRoutes());

// public staff login mounts BEFORE the RBAC-gated router
router.use('/admin', adminAuthRoutes());
router.use('/admin', adminRoutes());`));
  k.push(h2("5.3 Session Cookie Handling"));
  k.push(body("Session cookies are issued by one helper so that every entry point - password login, staff login, refresh, OTP verification and the OAuth callback - sets identical attributes. The cookie is httpOnly, scoped to the authentication path and given an explicit lifetime."));
  k.push(codeBlock(`// server/src/modules/auth/jwt.js
export const REFRESH_COOKIE = 'thread_rt';

export function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: REFRESH_TTL_SEC * 1000,
  });
}`));
  k.push(body("Because the client and the API are deployed on different sites, production must issue this cookie with SameSite=None alongside Secure for browsers to accept it on a cross-site response. That requirement is recorded in the deployment notes and in the limitations of this report."));
  k.push(h2("5.4 Order Placement and Pricing"));
  k.push(body("Order creation is the most sensitive write in the system. The service re-reads every SKU, recomputes the line totals, applies the coupon and tax rules, compares the result with the expected total, and then writes the order and decrements stock in one transaction. The client's numbers are used only to render; they are never trusted as input to the total."));
  k.push(body("Money is handled as integer paise end to end. A jacket priced at Rs 9,000 is stored as 900000 paise. Formatting to the rupee symbol happens once, at the edge, in a shared formatter. This avoids the rounding drift that appears when floating-point rupees are summed across lines, discounts and tax."));
  k.push(h2("5.5 Client Routing and Route Guards"));
  k.push(body("The client route table is the readable summary of the access model. Guards wrap the element rather than the path, so the same page can be reused under a different rule without duplicating routes."));
  k.push(codeBlock(`// client/src/App.jsx - route table (excerpt)
<Route path="/" element={<RequireCustomer><HomePage /></RequireCustomer>} />
<Route path="/shop" element={<RequireCustomer><ShopPage /></RequireCustomer>} />
<Route path="/product/:slug" element={<RequireCustomer><ProductPage /></RequireCustomer>} />
<Route path="/auth" element={<RequireGuest><AuthPage /></RequireGuest>} />
<Route path="/admin/login" element={<RequireGuest><AdminLoginPage /></RequireGuest>} />
<Route path="/cart" element={<RequireCustomer><CartPage /></RequireCustomer>} />
<Route path="/checkout" element={<RequireCustomer><RequireAuth><CheckoutPage /></RequireAuth></RequireCustomer>} />
<Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
<Route path="/admin/products" element={<RequireAdmin><AdminProductsPage /></RequireAdmin>} />
<Route path="*" element={<NotFoundPage />} />`));
  k.push(h2("5.6 Payment Verification"));
  k.push(body("The verify endpoint is deliberately boring: it recomputes the signature, compares the amount, and only then calls the order service to confirm. Verification is a pure function of the gateway response and the server secret, so it can be unit-tested without a browser. The webhook shares the same confirmation path, which means a payment confirmed by the browser and a payment confirmed by the gateway converge on exactly one state transition; the operation is idempotent by design."));
  k.push(h2("5.7 Catalogue, Search and Media Implementation"));
  k.push(body("The catalogue query builder is the busiest read path in the system, so it is written as a sequence of small decisions rather than one large query. Search terms are trimmed and split; category, size and colour are matched against the variant array; price and rating become range predicates; sort is mapped through an allowlist so an unknown value cannot order by an unindexed field; and pagination is applied last. Hidden products are excluded in the filter, which keeps the total count and the page contents consistent."));
  k.push(body("Search uses a MongoDB text index for relevance and a word-start prefix expression for fragments. The text index covers the title, brand, category and colour names; the prefix pass covers a short fragment such as jack, a partial colour such as blu, and the label name. Results are ordered by text score first and by the requested sort second, so a search for jacket still returns the jacket before a related piece. The index is declared on the model and created by the seed script, so a fresh environment has the same query plan as production."));
  k.push(body("Product media is uploaded to Cloudinary from the staff console through a signed request; the API never proxies the binary and never stores a local path. The product document keeps an ordered gallery and a variant array. Each variant has a SKU, a size, a colour, a stock count and an optional price override. The SKU is the stable identity of a sellable combination, which is why the bag, the stock check and the order line all point at it rather than at a product id."));
  k.push(h2("5.8 Staff Console Implementation"));
  k.push(body("The staff console is a set of ordinary routes behind a separate login. The public staff login is mounted before the role-gated admin router, so an unauthenticated request can reach the login handler while every other admin route passes through adminRequired. The console reads the same order service as the storefront: the dashboard aggregates the last thirty days, the queue filters by state, and the detail view exposes only the transitions that are legal from the current state."));
  k.push(body("Status changes are validated against a transition table before they are written. A packed order cannot jump to delivered, a cancelled order cannot be shipped, and a payment-pending order cannot be packed until the payment is confirmed. Each accepted transition appends a timeline entry with the new state, the time and the actor, so the customer and the operator read the same history. The catalogue form creates or edits the product document, its gallery and its variant array, and can hide a piece from the storefront without deleting it."));
  k.push(body("The inventory view groups stock by variant and surfaces low-stock combinations rather than a single product total. That view is the operational counterpart of the variant matrix on the product page: the customer sees which combination can be bought, and the operator sees which combination needs attention. Uploads, edits and status changes all pass through the same validation and authorisation layers as the rest of the API; the console has no privileged back door."));
  k.push(h2("5.9 Transactional Email and OTP Delivery"));
  k.push(body("Transactional mail is sent through Nodemailer over SMTP, with a console transport for local development and a Brevo-compatible transport where SMTP credentials are not available. The templates cover the OTP, the welcome message after verification and the order confirmation. The verification event is published only after the account is marked verified, so a welcome message cannot arrive before the address has been proven. The client reads the delivery mode from the configuration endpoint and shows the console hint only when mail is actually being printed rather than sent."));
  k.push(body("OTP delivery is bounded on both sides. The code is generated with a cryptographic random source, stored as a SHA-256 hash with a server-side pepper, and given a ten-minute lifetime. Verification allows five attempts; resend has a 60-second cooldown, five sends per hour per address and ten per day per network. A failed send is reported to the caller, and the send counters are still incremented, so a retry loop cannot be used to bypass the budget. The plain code is written only into the email body and is never logged."));
  k.push(h2("5.10 Deployment Procedure and Health Checks"));
  k.push(body("The deployment is a repeatable sequence rather than a manual upload. The steps below are the ones used for the delivered environment."));
  numbered([
    "Push the verified commit to the main branch of the repository.",
    "Deploy the API container on Botkeep and confirm that the root manifest and lockfile are present, so the panel can install dependencies without a separate build step.",
    "Set the API environment: database and Redis URLs, JWT secrets, gateway keys, Cloudinary credentials, SMTP settings and the client origin.",
    "Start the container and confirm that the pre-start dependency guard passes and that SERVER_PORT or its fallback is honoured.",
    "Open /api/health and confirm that MongoDB, Redis, search and Razorpay are reported as available.",
    "Send a preflight request from the deployed client origin and confirm that the allowlist returns the expected headers.",
    "Build the client against the deployed API origin and publish it to Vercel with the SPA rewrite.",
    "Walk the smoke path on the deployed site: guest home, sign in, product detail, add to bag, checkout, order history and the staff console."
  ]).forEach((p) => k.push(p));
  k.push(body("Two deployment defects shaped this procedure. The first was a missing root manifest: the panel started the API without a package.json at the project root and the process exited before it could listen. The fix was a root manifest and lockfile, a pre-start guard and a documented start command. The second was a port mismatch: the panel injected SERVER_PORT while the application read PORT. The fix was an explicit precedence rule with a local fallback. Both defects are now checked before a deployment is declared successful, which is why the health endpoint and the preflight are part of the procedure rather than an afterthought."));
  k.push(h2("5.11 Client Error States and Recovery"));
  k.push(body("The client is written on the assumption that every request can fail. RTK Query exposes a loading, a success and an error state for each endpoint, and each page renders all three rather than treating the happy path as the default. A first load shows a skeleton; a refetch dims the existing content instead of replacing it with a spinner; an error shows a short explanation and a retry control. No page fabricates a placeholder product, a zero total or a fake order when the API is unavailable."));
  k.push(body("Session recovery is centralised. A 401 from an ordinary request triggers one refresh and a replay of the original request; the replay is marked so that a second 401 ends the session instead of looping. Mutations that carry an idempotency key reuse the same key on the replay, which is why a retried checkout returns the original order rather than creating a second one. The refresh call itself is excluded from the retry rule, because a failed refresh is the signal that the visitor is a guest."));
  k.push(body("Checkout has its own recovery rules because it is the one flow where a network failure can leave the customer unsure whether an order exists. If order creation times out, the client keeps the idempotency key and offers a retry; the retry either returns the order that was created or creates the first one. If the payment modal is closed, the order remains in payment pending and appears in the order history with that state; the interface does not show a confirmation it did not receive. If the gateway configuration is unavailable, the online method is hidden before the customer reaches the payment step."));
  k.push(body("Form errors are shown where the correction is made. Each field has a real label, an inline message with role=alert and a visible focus state; the typed values survive a rejected submit. A route-level error boundary catches an unexpected render failure and offers a reload instead of a blank page. The result is an interface that is honest about failure: it distinguishes between loading, empty, unavailable and rejected, and it never pretends that a write succeeded when the server did not confirm it."));

  /* 6 */
  k.push(h1("6: TESTING AND RESULTS"));
  k.push(h2("6.1 Testing Approach"));
  k.push(body("Testing was layered rather than concentrated at one level. Schema-level checks confirmed that malformed input is rejected before it reaches a service. Service-level checks ran against a local database with seeded products. HTTP-level checks exercised the deployed API with real requests. Scripted browser journeys then walked the complete path - sign in, add to bag, check out, place an order, review it in the console - against the live deployment. Accessibility and layout were checked at three viewport widths, including a 360 px phone width."));
  k.push(h2("6.2 Test Cases and Results"));
  k.push(...makeTable(["ID", "Test case", "Expected result", "Status"], [
    ["T-01", "GET /api/health", "Reports mongo, redis, search and razorpay status", "Pass"],
    ["T-02", "Catalogue search for jacket, jack, rah, blue, THREAD", "Returns the matching piece in every case", "Pass"],
    ["T-03", "Catalogue search for zzz", "Returns no results", "Pass"],
    ["T-04", "Guest boots the storefront", "Refresh returns 401 and the storefront renders as guest", "Pass"],
    ["T-05", "Customer signs in with valid credentials", "Access token issued, refresh cookie set, redirect to storefront", "Pass"],
    ["T-06", "Customer signs in with a wrong password", "401 with a generic message; no account disclosure", "Pass"],
    ["T-07", "Staff credentials on the customer login", "403 ADMIN_PORTAL_ONLY after password verification", "Pass"],
    ["T-08", "Select a sold-out size", "Size is disabled and cannot be added to the bag", "Pass"],
    ["T-09", "Add to bag above available stock", "Server rejects with a stock error; the bag count is unchanged", "Pass"],
    ["T-10", "Guest bag followed by sign-in", "Guest lines merge into the account bag without duplication", "Pass"],
    ["T-11", "Apply a valid coupon", "Discount reflected in the server-computed total", "Pass"],
    ["T-12", "Place a cash-on-delivery order", "Order created, confirmed, visible in history and console", "Pass"],
    ["T-13", "Customer opens /admin", "Redirected out of the staff area", "Pass"],
    ["T-14", "Staff opens /shop", "Redirected to the console", "Pass"],
    ["T-15", "Deep link /admin/login on the deployed site", "Client loads through the SPA rewrite, not a platform 404", "Pass"],
  ], [1.6, 7.4, 6.6, 1.8], "Table 6.1: Test cases and results"));
  k.push(h2("6.3 Defects Found and Fixed"));
  k.push(...makeTable(["Defect", "Root cause", "Fix"], [
    ["Catalogue search depended on a search node that did not exist in production", "An Elasticsearch read model was configured but no cluster was provisioned", "Removed the read model; MongoDB text and prefix search is now the only path"],
    ["Deep links returned the platform's 404 page", "A static build has no file at /admin/login", "Added a SPA rewrite to index.html in client/vercel.json"],
    ["The API container could not install dependencies on boot", "No root manifest, and the panel port was ignored", "Root manifest with postinstall, SERVER_PORT fallback and a pre-start dependency guard"],
    ["Order confirmation was reachable without a verified payment", "Confirmation was driven by a client callback", "Confirmation now requires a valid HMAC signature and a matching amount"],
    ["Session did not survive a reload on the deployed origin", "Cross-site refresh cookie issued with SameSite=Lax", "Recorded as a deployment fix: SameSite=None with Secure in production"],
  ], [5.2, 5.6, 6.4], "Table 6.2: Defects found and fixed"));
  k.push(h2("6.4 Results and Observations"));
  k.push(body("The deployed system completed the full commercial journey. A signed-in customer added a jacket in size L and colour blue, saw the bag at Rs 9,000 with Rs 450 GST and a total of Rs 9,450, saved a delivery address and placed an order. The order appeared immediately in the customer's history with a status timeline and in the staff console queue, and the console's 30-day counters updated to reflect it: two orders and Rs 28,350 of revenue at the time of capture, with one earlier order shown as cancelled."));
  k.push(body("Three observations are worth recording. First, server-side recomputation never disagreed with the client-visible totals, which validates the decision to treat the client as a renderer. Second, the staff console's order queue and the customer's order history stayed consistent through status changes, because both read the same timeline. Third, the API budget - 300 requests per five minutes per address - is generous for a human but easy to exhaust from an automated browser session, which is a useful reminder that rate limits are a shared resource rather than a per-user one."));
  k.push(h2("6.5 Accessibility and Interface Validation"));
  ["Body copy measured at 16 px or above and labels at 12 px or above with letter-spacing across the storefront and the console.",
    "Every interactive target measured at least 44 px in both dimensions, including the quantity stepper and the wishlist heart.",
    "Keyboard-only traversal reached every control; focus remained visible on the editorial palette.",
    "Each page exposes one h1 inside a main landmark, with a skip link ahead of the header.",
    "Filter, search and sort state survive a copy-paste of the URL and a browser back action.",
    "The 360 px layout keeps the bag summary and the checkout button reachable without horizontal scrolling."].forEach((t) => k.push(bullet(t)));
  k.push(h2("6.6 Performance and Scalability Observations"));
  k.push(body("The project did not attempt a production load test; the observations below are the ones that can be justified from the implementation and from the deployed behaviour during testing."));
  k.push(...makeTable(["Aspect", "Observation", "Implication"], [
    ["Catalogue search", "The text index and the word-start prefix pass resolve the tested queries without a collection scan", "Search cost grows with the index, not with the full catalogue"],
    ["Pagination", "Every list route applies a page and a page size and returns a total count", "A large catalogue cannot return an unbounded response"],
    ["Client reads", "RTK Query caches each resource under a tag and invalidates it after a mutation", "Repeated navigation does not repeat every request"],
    ["Session checks", "Refresh records and rate-limit counters are single-key Redis operations with a TTL", "Expiry is handled by the store rather than by a sweep job"],
    ["API scaling", "The API keeps no session state in process memory", "A second container can be added behind a load balancer without sticky sessions"],
    ["Delivery", "Product media is served by Cloudinary rather than by the API container", "Image bandwidth does not compete with API requests"],
  ], [3.6, 7.4, 5.2], "Table 6.3: Performance observations"));
  k.push(body("The current deployment runs a single API container, which is sufficient for the traffic a two-person label generates. The architecture leaves room to scale horizontally because the only state that must be shared already lives in Redis and MongoDB. The first bottleneck under growth would be the database connection pool rather than the HTTP layer, which is why the catalogue reads are indexed and paginated before any scaling work is considered."));
  k.push(h2("6.7 Security and Failure-Path Validation"));
  k.push(body("Functional tests confirm that the happy path works. Security tests confirm that the unhappy paths fail in the right direction. The following abuse cases were exercised deliberately, either with a scripted request or through the interface."));
  ["A tampered Razorpay signature was posted to the verify endpoint. The API returned 400 PAYMENT_SIGNATURE_INVALID and the order remained in payment pending, with no stock change.",
    "Staff credentials were submitted to the customer login. The API verified the password and then returned 403 ADMIN_PORTAL_ONLY, so the staff role was not silently downgraded to a customer session.",
    "A customer opened /admin in the browser. The client guard redirected away from the console, and a direct request to an admin endpoint without a staff token returned 403.",
    "A quantity above the available stock was submitted for a variant. The API rejected the line and the bag count did not change.",
    "The same checkout request was sent twice with the same idempotency key. The second response returned the original order instead of creating a duplicate.",
    "A request from an origin outside the allowlist was rejected as CORS_REJECTED before it reached a route handler.",
    "A burst of authentication requests exhausted the route budget and returned 429, while ordinary catalogue reads continued to work."].forEach((t) => k.push(bullet(t)));
  k.push(body("The results were consistent with the design intent: the system fails closed on identity, money and stock, and fails visibly on dependencies. The one deliberate exception is the online payment option. When the gateway configuration is unavailable, the storefront hides the online method and keeps cash on delivery available, because a checkout that cannot take money is worse than a checkout that offers one supported path."));
  k.push(h2("6.8 Test Environment and Data"));
  k.push(body("Development and verification ran on Windows 11 with Node.js 24 LTS, a local MongoDB instance for early iterations and an Atlas cluster for the deployed build, and Chrome DevTools for layout and network inspection. Postman was used for direct API calls, including the signature and authorisation cases that are awkward to reproduce through the interface. The deployed environment was tested from the same machine over the public internet, so the CORS, cookie and deep-link behaviour reflect the real origins rather than a local proxy."));
  k.push(body("The catalogue used a small set of real pieces so that the variant matrix, stock caps and order totals could be checked against known values. The customer account carried a populated bag and two orders in different states; the staff account was separate and was used for the console checks. The gateway ran in test mode, which is why the report records the payment flow as verified but not live. Automated browser runs were limited by the API's own rate limits, a useful demonstration that the budgets apply to scripts as well as people."));
  k.push(body("Each verification run started from a catalogue state produced by the seed script: the same pieces, variants, stock counts and policy versions. Orders created during a run stayed on the test customer, so the console queue and the customer history described the same records, and a failed run could be repeated without inventing new data. The script also created the staff account and the policy documents, which made the deployment reproducible on a fresh database instead of dependent on hand-entered records. Where a test needed a sold-out variant or an expired coupon, the record was changed deliberately and restored afterwards, so the test proved the rule rather than an accidental state."));
  k.push(h2("6.9 Regression Checklist"));
  k.push(body("The checklist below is the minimum set of checks run against a new deployment before it is treated as ready. It is deliberately short enough to run by hand and specific enough to catch the defects that have already appeared once."));
  k.push(...makeTable(["ID", "Check", "Expected result"], [
    ["R-01", "Open the home, shop and a product detail as a guest", "Pages render from the API; no console error; filters and variants work"],
    ["R-02", "Sign in, reload and sign out", "Session survives the reload; sign-out clears the cookie and returns the guest header"],
    ["R-03", "Request an OTP twice within a minute", "The second request is refused by the resend cooldown"],
    ["R-04", "Try to add a sold-out variant by direct request", "The API rejects the line and the bag count is unchanged"],
    ["R-05", "Add to the bag as a guest, then sign in", "Guest lines merge into the account bag without duplicates"],
    ["R-06", "Apply a coupon and compare the totals", "Subtotal, discount, GST and total agree with the server calculation"],
    ["R-07", "Place a cash-on-delivery order", "Order, stock decrement and timeline commit together; the order appears in history and the console"],
    ["R-08", "Post a payment with a tampered signature", "400 PAYMENT_SIGNATURE_INVALID; the order stays payment pending"],
    ["R-09", "Open /admin as a customer and call an admin route without a token", "The client redirects and the API returns 403"],
    ["R-10", "Open a deep link and send a preflight from the deployed origin", "The SPA rewrite serves the app and CORS returns the allowlisted headers"],
    ["R-11", "Check /api/health and /api/config", "Dependencies are reported and the client receives its public configuration"],
  ], [1.6, 7.6, 7.0], "Table 6.4: Deployment regression checklist"));
  k.push(body("The checklist is not a substitute for the test cases in Table 6.1; it is the shorter path used after a deployment. R-04 bypasses the disabled button and R-08 bypasses the browser, so a deployment that passes only the interface checks has not been verified."));

  /* 7 */
  k.push(h1("7: CONCLUSION AND FUTURE SCOPE"));
  k.push(h2("7.1 Conclusion"));
  k.push(body("THREAD demonstrates that a small label can own its commerce stack without owning a payments team. The project delivers the complete journey - discovery, variant-accurate stock, a persistent bag, checkout, payment, order fulfilment and catalogue operation - on a three-tier architecture that is inexpensive to host, simple to reason about, and careful with money and identity."));
  k.push(body("The engineering value sits in decisions that are invisible in a screenshot. Prices are derived on the server from integer paise. Stock is enforced per variant rather than per product. Payments are confirmed only by signature verification. Authorisation is enforced twice. Sessions are kept out of JavaScript. Every sensitive door carries its own rate-limit budget. Those decisions are what separate a storefront that can take an order from one that can be trusted with one."));
  k.push(h2("7.2 Limitations"));
  ["Cross-site deployment requires the refresh cookie to be issued with SameSite=None and Secure in production; the current configuration uses Lax and must be hardened before real traffic.",
    "Pricing, shipping and tax rules are specific to India and a single currency.",
    "Some older products still reference local upload paths and must be re-uploaded to object storage.",
    "Validation is scripted but not yet wired into a continuous integration pipeline.",
    "An abandoned online payment holds stock until the reconciliation sweep runs; there is no customer-facing resume-payment screen yet."].forEach((t) => k.push(bullet(t)));
  k.push(h2("7.3 Future Scope"));
  ["Automated integration and end-to-end tests in CI with seeded fixtures and a mocked gateway.",
    "Webhook-first confirmation with replay-safe event storage and a dead-letter queue.",
    "Returns and partial refunds with a staff workflow.",
    "Server-side rendering or hydration for catalogue pages to improve first paint and link previews.",
    "Responsive image delivery with modern formats and low-quality placeholders.",
    "Observability with distributed tracing across the API and the gateway callbacks.",
    "Multi-currency and international shipping if the label expands beyond India."].forEach((t) => k.push(bullet(t)));
  k.push(h2("7.4 Lessons Learned"));
  k.push(lead("Correctness is a placement problem. ", "The most valuable decisions in the project were about where a rule lives, not how clever the rule is. Stock, price and payment state became reliable only when the browser stopped being the authority for them. Moving those three decisions to the server removed a class of defects that no amount of client-side validation would have closed."));
  k.push(lead("A demo can hide the hard part. ", "A storefront that lists a product and takes an order is a weekend project. The weeks went into the parts a demo skips: a sold-out combination, a retried checkout, a signature that does not match, a container that restarts mid-session, a deep link on a static host. Writing each of those as a test case changed the design more than any feature request."));
  k.push(lead("Deployment is part of the architecture. ", "The two defects that blocked the first deployment were not business-logic bugs. They were a missing manifest and a port that the panel injected under a different name. The fix was small, but it changed the way the project is documented: the start command, the environment and the health check are now first-class parts of the deliverable."));
  k.push(lead("Accessibility improves the interface. ", "Treating the 16 px body, the 12 px label floor and the 44 px target as constraints rather than a checklist produced a calmer layout. The rules forced decisions about hierarchy early, and the resulting pages are easier to scan at a desktop width and usable at 360 px without a separate mobile design."));
  k.push(lead("Scope control is a feature. ", "The system deliberately stops at the edge of returns, multi-currency and a mobile application. Each of those would have doubled a surface that the team could not test to the same standard. Naming them as future scope kept the delivered path complete instead of spreading the same effort across half-finished modules."));
  k.push(h2("7.5 Operational and Societal Impact"));
  k.push(body("For the label, the practical impact is independence. Catalogue changes, order status and policy updates no longer wait for a developer, and the payment flow does not require the label to handle card data. The staff console is deliberately plain: it runs in a browser, needs no installation and exposes only the actions that are legal at the current state. That reduces the training burden for a small team and lowers the chance of an accidental transition."));
  k.push(body("For the customer, the impact is predictability. The variant matrix shows what can actually be bought, the bag and checkout agree on the total, and the order history shows the same timeline the operator sees. The interface avoids dark patterns: there is no fake urgency, no pre-ticked add-on and no hidden charge at the last step. Prices are shown with tax broken out, and the delivery promise is stated before the order is placed."));
  k.push(body("For the wider context, the project is a small argument for local, owned commerce infrastructure. A label does not need a marketplace to reach its customers, and it does not need to hand its catalogue and customer list to a platform in order to take a payment. The trade-off is engineering and operational responsibility, which this report has tried to state honestly rather than hide."));
  k.push(body("That honesty is also the practical position of the deliverable. The system is complete enough to run a real catalogue and take a real order, and it is explicit about the work that remains before live payments and cross-site sessions can be offered without caveats. The value of the project is not that it removes every risk, but that it places each remaining risk where it can be seen, tested and fixed."));

  /* 8 */
  k.push(h1("8: APPENDIX / REFERENCES"));
  k.push(h2("8.1 Appendix A - API Reference"));
  k.push(...makeTable(["Group", "Endpoints"], [
    ["Health and config", "GET /api/health, GET /api/config"],
    ["Auth", "POST /api/auth/register, /verify, /resend-otp, /login, /refresh, /logout, /forgot-password, /reset-password; GET /api/auth/me"],
    ["Products", "GET /api/products, /featured, /categories, /:slug, /:slug/related"],
    ["Cart", "GET /api/cart; POST /api/cart/items; PATCH /api/cart/items; DELETE /api/cart/items/:sku; DELETE /api/cart; POST /api/cart/merge"],
    ["Wishlist", "GET /api/wishlist, GET /api/wishlist/states, POST /api/wishlist/toggle"],
    ["Orders", "POST /api/orders; GET /api/orders; GET /api/orders/:id; GET /api/orders/:id/timeline"],
    ["Payments", "POST /api/payments/razorpay/order, /razorpay/verify, /razorpay/webhook"],
    ["Coupons and reviews", "GET /api/coupons/:code; GET /api/reviews/:slug; POST /api/reviews/:slug"],
    ["Users", "GET /api/users/me; PATCH /api/users/me; address create, update and delete"],
    ["Policies", "GET /api/policies, GET /api/policies/:slug"],
    ["Admin", "POST /api/admin/login; GET /api/admin/dashboard, /products, /inventory, /orders; POST /api/admin/products; GET/PATCH/DELETE /api/admin/products/:slug; PATCH /api/admin/orders/:id/status; GET/PATCH /api/admin/policies"],
  ], [3.4, 12.8], "Table 8.1: API reference"));
  k.push(h2("8.2 Appendix B - Environment Variables"));
  k.push(...makeTable(["Variable", "Purpose"], [
    ["MONGODB_URI", "MongoDB Atlas connection string"],
    ["REDIS_URL", "Redis connection string for OTP, limits and sessions"],
    ["JWT_ACCESS_SECRET / JWT_REFRESH_SECRET", "Signing secrets for access and refresh tokens"],
    ["RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET", "Gateway credentials (test mode in this build)"],
    ["RAZORPAY_WEBHOOK_SECRET", "HMAC secret for webhook verification"],
    ["CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET", "Signed media uploads"],
    ["SMTP_HOST / PORT / USER / PASS / FROM", "Transactional email delivery"],
    ["CORS_ORIGINS", "Explicit origin allowlist for the deployed client"],
    ["CLIENT_ORIGIN", "Origin used in transactional email links"],
    ["SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD", "Staff account created by the seed script"],
    ["SERVER_PORT", "Port injected by the hosting panel; falls back to PORT"],
  ], [6.6, 9.6], "Table 8.2: Environment variables"));
  k.push(h2("8.3 References"));
  const refs = [
    "React documentation. https://react.dev",
    "Redux Toolkit and RTK Query. https://redux-toolkit.js.org",
    "React Router. https://reactrouter.com",
    "Express. https://expressjs.com",
    "Mongoose and the MongoDB Manual. https://mongoosejs.com, https://www.mongodb.com/docs",
    "Redis documentation. https://redis.io/docs",
    "Razorpay Payments API and webhooks. https://razorpay.com/docs",
    "JSON Web Tokens, RFC 7519. https://datatracker.ietf.org/doc/html/rfc7519",
    "OWASP Application Security Verification Standard. https://owasp.org/www-project-application-security-verification-standard/",
    "MDN Web Docs: HTTP cookies, SameSite and CORS. https://developer.mozilla.org",
    "W3C Web Content Accessibility Guidelines 2.2. https://www.w3.org/TR/WCAG22/",
    "Zod documentation. https://zod.dev",
    "Cloudinary documentation. https://cloudinary.com/documentation",
    "Helmet documentation. https://helmetjs.github.io",
  ];
  refs.forEach((ref, i) => k.push(new Paragraph({
    spacing: { after: 60, line: 300 },
    indent: { left: 454, hanging: 454 },
    alignment: AlignmentType.LEFT,
    children: [
      new TextRun({ text: `[${i + 1}] `, size: 22 }),
      new TextRun({ text: ref, size: 22 }),
    ],
  })));

  return k;
}

/* ------------------------------------------------------------------- main */

async function main() {
  await ensureSlices();

  const footer = new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 0, line: 240 },
      children: [
        new TextRun({ text: "Page ", font: FONT, size: 20 }),
        new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 }),
      ],
    })],
  });
  const emptyFooter = new Footer({ children: [new Paragraph({ children: [new TextRun({ text: "" })] })] });

  const doc = new Document({
    creator: "Raghav Dixit, Rahul Gheek, Manav Mandal, Sameer Aggarwal",
    title: "THREAD - An Editorial Clothing E-Commerce Platform",
    description: "Project Report, BEE-II, B.E. CSE, Chitkara University, Punjab",
    subject: "Project Report",
    styles,
    sections: [{
      properties: {
        titlePage: true,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1247, right: 1361, bottom: 1134, left: 1361, header: 708, footer: 708, gutter: 0 },
        },
      },
      footers: { default: footer, first: emptyFooter },
      children: [
        ...cover(),
        ...certificate(),
        ...declaration(),
        ...acknowledgement(),
        ...tableOfContents(),
        ...chapters(),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUT, buffer);
  console.log("saved", OUT, Math.round(buffer.length / 1024), "KB");
}

main().catch((err) => { console.error(err); process.exit(1); });
