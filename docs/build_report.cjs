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
const OUT = path.join(ROOT, "docs", "THREAD_Project_Report.docx");
const PAGE_MAP_FILE = path.join(ROOT, "docs", "page_map.json");
const PAGE_MAP = fs.existsSync(PAGE_MAP_FILE) ? JSON.parse(fs.readFileSync(PAGE_MAP_FILE, "utf8")) : {};
const LOGO_SMALL = path.join(process.env.TEMP, "fmt", "image1.jpeg");
const LOGO_BIG = path.join(process.env.TEMP, "fmt", "image2.jpeg");

const TITLE = "THREAD";
const SUBTITLE = "AN EDITORIAL CLOTHING E-COMMERCE PLATFORM";
const COURSE = "BEE-II";
const GUIDE = "Dr. Durgesh Srivastava";
const GUIDE_LINE = "Professor, Department of CSE, CUIET";
const GUIDE_LINE2 = "Chitkara University, Punjab";
const STUDENTS = [
  { name: "Raghav Dixit", roll: "2410990667" },
  { name: "Rahul Gheek", roll: "2410990669" },
  { name: "Manav Mandal", roll: "241099xxxx" },
  { name: "Sameer Aggarwal", roll: "2410990704" },
];
const STUDENT_LINE = "Raghav Dixit (2410990667), Rahul Gheek (2410990669), Manav Mandal (241099xxxx) and Sameer Aggarwal (2410990704)";

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
  const crops = {
    "shop-top.png": ["shop.png", 1180],
    "order-confirmation-top.png": ["order-confirmation.png", 520],
  };
  for (const [outName, [srcName, cropH]] of Object.entries(crops)) {
    const outFile = path.join(FIG, outName);
    if (!fs.existsSync(outFile)) {
      const srcFile = path.join(IMG, srcName);
      const meta = await sharp(srcFile).metadata();
      await sharp(srcFile)
        .extract({ left: 0, top: 0, width: meta.width, height: Math.min(cropH, meta.height) })
        .png().toFile(outFile);
    }
  }
  const plan = {
    "home.png": 3,
    "product-detail.png": 3,
    "admin-product-new.png": 2,
    "admin-product-edit.png": 3,
  };
  for (const [file, count] of Object.entries(plan)) {
    const src = path.join(IMG, file);
    const base = path.basename(file, ".png");
    const meta = await sharp(src).metadata();
    const overlap = 28;
    const sliceH = Math.ceil((meta.height + (count - 1) * overlap) / count);
    for (let i = 0; i < count; i += 1) {
      const top = i * (sliceH - overlap);
      const height = Math.min(sliceH, meta.height - top);
      const out = path.join(FIG, `${base}-${i + 1}.png`);
      if (!fs.existsSync(out)) {
        await sharp(src).extract({ left: 0, top, width: meta.width, height }).png().toFile(out);
      }
    }
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
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text, bold: true })] });
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

function makeTable(headers, rows, widthsCm, cap, font = 10) {
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
        margins: { top: 70, bottom: 70, left: 100, right: 100 },
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
  const buf = fs.readFileSync(file);
  const meta = imageSize(buf);
  const ratio = meta.height / meta.width;
  let target = widthOverride || 585;
  if (!widthOverride) {
    if (ratio <= 0.9) target = 548;
    else if (ratio <= 1.05) target = 438;
  }
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
    body("This is to certify that the project entitled \"THREAD - An Editorial Clothing E-Commerce Platform\" has been submitted for the Bachelor of Computer Science Engineering at Chitkara University, Punjab during the academic semester June-December 2026, is a bonafide piece of project work carried out by \"" + STUDENT_LINE + "\" towards the partial fulfilment for the award of the course " + COURSE + " under the guidance of \"Dr. Durgesh Srivastava\" and supervision."),
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
    P("Place: Chandigarh", { size: 22, after: 2, line: 240 }),
    P("Date:", { size: 22, after: 0, line: 240 }),
  ];
}

function acknowledgement() {
  return [
    ...annexureHeader("E", "ACKNOWLEDGEMENT"),
    body("It is our pleasure to be indebted to various people who directly or indirectly contributed to the development of this work and who influenced our thinking, behaviour and acts during the course of study."),
    body("We express our sincere gratitude to Chitkara University, Punjab for providing us the opportunity to undertake this project as part of the curriculum."),
    body("We are thankful to our project guide, Dr. Durgesh Srivastava, Professor, Department of Computer Science and Engineering, CUIET, Chitkara University, Punjab, for his constant support, technical review, cooperation and motivation throughout the training period, and for his valuable suggestions and precious time in accomplishing this project report."),
    body("We also extend our sincere appreciation to the faculty of the department and to our external reviewers for their feedback during the review presentations."),
    body("Lastly, we would like to thank our parents for their moral support and our friends with whom we shared our day-to-day experience and received suggestions that improved the quality of our work."),
    P("", { after: 18, line: 240 }),
    signatureTable(),
  ];
}

const TOC = [
  ["1: INTRODUCTION", ["1.1 Background", "1.2 Problem Statement", "1.3 Objectives of the Project"]],
  ["2: SOFTWARE AND HARDWARE REQUIREMENT SPECIFICATION", ["2.1 Hardware Requirements", "2.2 Software Requirements", "2.3 Programming Languages, Libraries and Tools", "2.4 Requirements Analysis and Feasibility"]],
  ["3: SYSTEM DESIGN AND ARCHITECTURE", ["3.1 System Architecture", "3.2 Module Description", "3.3 Database Design", "3.4 Client Routing and Access Control", "3.5 Interface Design"]],
  ["4: METHODOLOGY AND IMPLEMENTATION", ["4.1 Proposed Methodology and Workflow", "4.2 Session and Authentication Design", "4.3 Catalogue, Search and Variant Stock", "4.4 Order Lifecycle and Pricing", "4.5 Online Payment Workflow", "4.6 Security Design"]],
  ["5: CODE IMPLEMENTATION", ["5.1 Implementation Steps", "5.2 Server Bootstrap and Routing", "5.3 Session Cookie Handling", "5.4 Order Placement and Pricing", "5.5 Client Routing and Route Guards", "5.6 Payment Verification"]],
  ["6: TESTING AND RESULTS", ["6.1 Testing Approach", "6.2 Test Cases and Results", "6.3 Defects Found and Fixed", "6.4 Results and Observations", "6.5 Accessibility and Interface Validation"]],
  ["7: CONCLUSION AND FUTURE SCOPE", ["7.1 Conclusion", "7.2 Limitations", "7.3 Future Scope"]],
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
    ["3.1", "Home page", ["home-1", "home-2", "home-3"]],
    ["3.2", "Shop page - catalogue with URL-driven filters", ["shop-top"]],
    ["3.3", "Product detail - gallery, colour and size matrix, variant stock", ["product-detail-1", "product-detail-2", "product-detail-3"]],
    ["3.4", "Bag - line items, quantity control and order summary", ["cart"]],
    ["3.5", "Wishlist - saved pieces for the signed-in customer", ["wishlist"]],
    ["3.6", "Checkout - delivery address, payment method and server-derived totals", ["checkout"]],
    ["3.7", "Order confirmation after a cash-on-delivery order", ["order-confirmation-top"]],
    ["3.8", "Order history", ["orders"]],
    ["3.9", "Order detail with the status timeline", ["order-detail"]],
    ["3.10", "Profile and saved addresses", ["profile"]],
    ["3.11", "Sign-in page", ["auth-sign-in"]],
    ["3.12", "Registration with email OTP verification", ["auth-register"]],
    ["3.13", "Policy index with versions and effective dates", ["policies"]],
    ["3.14", "Not-found page", ["not-found"]],
    ["3.15", "Staff sign-in on its own endpoint", ["admin-sign-in"]],
    ["3.16", "Admin console - 30-day counters and the order queue", ["admin-console"]],
    ["3.17", "Admin catalogue including hidden pieces", ["admin-products"]],
    ["3.18", "Create a piece - gallery, variants and pricing", ["admin-product-new-1", "admin-product-new-2"]],
    ["3.19", "Edit a piece", ["admin-product-edit-1", "admin-product-edit-2", "admin-product-edit-3"]],
  ];
  const kids = [];
  groups.forEach(([num, title, files]) => {
    files.forEach((file, i) => {
      const label = files.length > 1 ? `${num}${String.fromCharCode(97 + i)}` : num;
      const part = files.length > 1 ? ` (part ${i + 1} of ${files.length})` : "";
      const sliced = path.join(FIG, `${file}.png`);
      const original = path.join(IMG, `${file}.png`);
      kids.push(...figure(
        fs.existsSync(sliced) ? sliced : original,
        `Figure ${label}: ${title}${part}`,
        file === "shop-top" || file === "order-confirmation-top" ? 585 : undefined,
      ));
    });
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
  k.push(h2("3.2 Module Description"));
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
  ], [3.6, 12.6], "Table 3.2: API modules"));
  k.push(h2("3.3 Database Design"));
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
  ], [2.6, 9.4, 4.2], "Table 3.3: Collections and key fields"));
  k.push(body("Two indexes carry most of the read load: a text index over the product title, brand, category and colour names for catalogue search, and a unique index on the variant SKU so that a bag line can always be resolved to exactly one product, colour and size. Orders additionally carry a unique order number and an idempotency key, so a retried checkout cannot create a duplicate order."));
  k.push(h2("3.4 Client Routing and Access Control"));
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
  ], [5.2, 4.0, 7.0], "Table 3.4: Client routes and access"));
  k.push(h2("3.5 Interface Design"));
  k.push(body("The interface uses a paper-and-ink palette with a serif display face for headings and a neutral sans face for controls and body copy. Elevation is expressed with hairlines rather than shadows, and the layout is a flat grid with generous whitespace. Bootstrap Icons is the only icon set; there is no emoji anywhere in the product."));
  k.push(body("Accessibility is treated as a constraint rather than a review step. Body text is at least 16 px and labels at least 12 px with letter-spacing, every interactive target is at least 44 px, icon-only controls carry an aria-label, toggles expose aria-pressed, forms use real label elements with inline role=alert errors, focus is always visible, and each page has a single h1 inside a main landmark with a skip link ahead of it."));
  k.push(body("The screenshots below were captured from the live deployment at a desktop viewport with real data: a signed-in customer with a populated bag and order history, and staff credentials for the admin console. Long pages are reproduced in numbered parts so that the interface remains legible in print."));
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
