/* Build docs/page_map.json from a rendered PDF's text. */
const fs = require("fs");
const path = require("path");

const pdfText = process.argv[2];
if (!pdfText || !fs.existsSync(pdfText)) {
  console.error("usage: node make_page_map.cjs <report.txt>");
  process.exit(1);
}

const raw = fs.readFileSync(pdfText, "utf8");
const pages = raw.split("\f");
const norm = (s) => s.replace(/\s+/g, " ").trim();

const headings = [
  "1: INTRODUCTION",
  "1.1 Background",
  "1.2 Problem Statement",
  "1.3 Objectives of the Project",
  "1.4 Scope of the Project",
  "1.5 Significance of the Project",
  "1.6 Organisation of the Report",
  "2: SOFTWARE AND HARDWARE REQUIREMENT SPECIFICATION",
  "2.1 Hardware Requirements",
  "2.2 Software Requirements",
  "2.3 Programming Languages, Libraries and Tools",
  "2.4 Requirements Analysis and Feasibility",
  "2.5 Study of Existing Systems",
  "2.6 Proposed System",
  "3: SYSTEM DESIGN AND ARCHITECTURE",
  "3.1 System Architecture",
  "3.2 Architecture in Text",
  "3.3 Module Description",
  "3.4 Database Design",
  "3.5 Client Routing and Access Control",
  "3.6 Interface Design",
  "3.7 Interface Walkthrough",
  "4: METHODOLOGY AND IMPLEMENTATION",
  "4.1 Proposed Methodology and Workflow",
  "4.2 Session and Authentication Design",
  "4.3 Catalogue, Search and Variant Stock",
  "4.4 Order Lifecycle and Pricing",
  "4.5 Online Payment Workflow",
  "4.6 Security Design",
  "4.7 API Design and Response Contract",
  "4.8 Validation, Error Handling and Observability",
  "4.9 Deployment and Configuration",
  "4.10 Data Consistency and Transaction Boundaries",
  "5: CODE IMPLEMENTATION",
  "5.1 Implementation Steps",
  "5.2 Server Bootstrap and Routing",
  "5.3 Session Cookie Handling",
  "5.4 Order Placement and Pricing",
  "5.5 Client Routing and Route Guards",
  "5.6 Payment Verification",
  "5.7 Catalogue, Search and Media Implementation",
  "5.8 Staff Console Implementation",
  "5.9 Transactional Email and OTP Delivery",
  "5.10 Deployment Procedure and Health Checks",
  "5.11 Client Error States and Recovery",
  "6: TESTING AND RESULTS",
  "6.1 Testing Approach",
  "6.2 Test Cases and Results",
  "6.3 Defects Found and Fixed",
  "6.4 Results and Observations",
  "6.5 Accessibility and Interface Validation",
  "6.6 Performance and Scalability Observations",
  "6.7 Security and Failure-Path Validation",
  "6.8 Test Environment and Data",
  "6.9 Regression Checklist",
  "7: CONCLUSION AND FUTURE SCOPE",
  "7.1 Conclusion",
  "7.2 Limitations",
  "7.3 Future Scope",
  "7.4 Lessons Learned",
  "7.5 Operational and Societal Impact",
  "8: APPENDIX / REFERENCES",
  "8.1 Appendix A - API Reference",
  "8.2 Appendix B - Environment Variables",
  "8.3 References",
];

const map = {};
const missing = [];
for (const heading of headings) {
  const target = norm(heading);
  let found = -1;
  for (let i = pages.length - 1; i >= 0; i -= 1) {
    if (norm(pages[i]).includes(target)) { found = i; break; }
  }
  if (found >= 0) map[heading] = found + 1;
  else missing.push(heading);
}

fs.writeFileSync(path.resolve(__dirname, "page_map.json"), JSON.stringify(map, null, 2) + "\n");
console.log("mapped", Object.keys(map).length, "of", headings.length);
if (missing.length) console.log("missing:", missing.join(" | "));
console.log(JSON.stringify(map));
