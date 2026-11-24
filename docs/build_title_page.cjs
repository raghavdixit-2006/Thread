/* Single-page A4 title page, built to the supplied layout spec.
 * Run: node docs/build_title_page.cjs
 */
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const req = createRequire(path.join(process.env.TEMP, "report-js", "anchor.js"));
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, TableLayoutType, LineRuleType,
} = req("docx");

const ROOT = path.resolve(__dirname, "..");
const LOGO = path.resolve(ROOT, "..", "AiProject", "report", "ChitkaraLogo", "chitkara-university-logo.png");
const OUT = path.join(ROOT, "docs", "THREAD_Title_Page.docx");
const FONT = "Times New Roman";
const TEXT_WIDTH = 9026; // A4 11906 twips minus 2 x 1440 twip margins

const TITLE_ONE = "THREAD";
const TITLE_TWO = "AN EDITORIAL CLOTHING E-COMMERCE PLATFORM";
const SUBJECT = "BEE-II";
const SESSION = "June\u2013December 2026";
const STUDENTS = [
  ["Raghav Dixit", "2410990667"],
  ["Rahul Gheek", "2410990669"],
  ["Manav Mandal", "241099xxxx"],
  ["Sameer Aggarwal", "2410990704"],
];

function pngSize(buf) {
  if (buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG") {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  throw new Error("logo must be a PNG");
}

const logoBuf = fs.readFileSync(LOGO);
const logoMeta = pngSize(logoBuf);
const logoRatio = logoMeta.width / logoMeta.height;

// Sizes are specified in inches; docx accepts pixels at 96 dpi.
function logo(inches, align, afterTwips) {
  const width = inches * 96;
  const height = width / logoRatio;
  return new Paragraph({
    alignment: align,
    spacing: { before: 0, after: afterTwips, line: 240, lineRule: LineRuleType.AUTO },
    children: [new ImageRun({
      type: "png",
      data: logoBuf,
      transformation: { width, height },
      altText: {
        title: "Chitkara University",
        description: "Chitkara University logo",
        name: "chitkara-university-logo.png",
      },
    })],
  });
}

function line(text, opts = {}) {
  const {
    size = 12, bold = false, align = AlignmentType.CENTER,
    after = 60, before = 0, lineSpacing = 276,
  } = opts;
  return new Paragraph({
    alignment: align,
    spacing: { before, after, line: lineSpacing, lineRule: LineRuleType.AUTO },
    children: [new TextRun({ text, font: FONT, size: size * 2, bold, color: "000000" })],
  });
}

const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = {
  top: NONE, bottom: NONE, left: NONE, right: NONE,
  insideHorizontal: NONE, insideVertical: NONE,
};

const leftCol = 4152;  // 46% of 9026
const rightCol = 4874; // 54%

const leftCell = new TableCell({
  width: { size: leftCol, type: WidthType.DXA },
  margins: { top: 0, bottom: 0, left: 0, right: 0 },
  borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
  children: [
    line("Under the Guidance of", { bold: true, align: AlignmentType.LEFT }),
    line("Dr. Durgesh Srivastava", { bold: true, align: AlignmentType.LEFT }),
    line("Professor, Department of CSE", { align: AlignmentType.LEFT }),
    line("CUIET, Chitkara University, Punjab", { align: AlignmentType.LEFT }),
  ],
});

const rightCell = new TableCell({
  width: { size: rightCol, type: WidthType.DXA },
  margins: { top: 0, bottom: 0, left: 0, right: 0 },
  borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
  children: [
    line("Submitted By", { bold: true, align: AlignmentType.LEFT }),
    ...STUDENTS.flatMap(([name, roll]) => [
      line(name, { bold: true, align: AlignmentType.LEFT }),
      line(`Roll. No. ${roll}`, { align: AlignmentType.LEFT }),
    ]),
  ],
});

const infoTable = new Table({
  width: { size: TEXT_WIDTH, type: WidthType.DXA },
  columnWidths: [leftCol, rightCol],
  layout: TableLayoutType.FIXED,
  borders: noBorders,
  rows: [new TableRow({ children: [leftCell, rightCell] })],
});

const styles = {
  default: {
    document: {
      run: { font: FONT, size: 24, color: "000000" },
      paragraph: {
        spacing: { before: 0, after: 0, line: 276, lineRule: LineRuleType.AUTO },
        alignment: AlignmentType.LEFT,
      },
    },
  },
};

const doc = new Document({
  creator: "Raghav Dixit",
  title: "THREAD - Title Page",
  description: "Project title page, BEE-II, B.E. CSE, Chitkara University, Punjab",
  styles,
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720, gutter: 0 },
      },
    },
    children: [
      logo(1.46, AlignmentType.LEFT, 180), // 9 pt below

      line("PROJECT REPORT", { size: 13 }),
      line("On", { size: 12 }),
      line(TITLE_ONE, { size: 15, bold: true }),
      line(TITLE_TWO, { size: 15, bold: true, after: 120 }), // 6 pt gap

      line("Submitted in partial fulfilment of the requirement for the Course", { size: 12 }),
      line(SUBJECT, { size: 12 }),
      line("of", { size: 12 }),
      line("COMPUTER SCIENCE AND ENGINEERING", { size: 13, bold: true }),
      line("B.E. Batch-2024", { size: 12 }),
      line("In", { size: 12 }),
      line(SESSION, { size: 12, after: 360 }), // 18 pt gap

      logo(2.08, AlignmentType.CENTER, 1200), // 60 pt gap (reduced from 70 to fit four students)

      infoTable,

      line("DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING", { size: 12, bold: true, before: 1200 }), // 60 pt gap (reduced from 75)
      line("CHITKARA UNIVERSITY", { size: 12, bold: true }),
      line("PUNJAB", { size: 12, bold: true, after: 0 }),
    ],
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(OUT, buffer);
  console.log("saved", OUT, Math.round(buffer.length / 1024), "KB");
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
