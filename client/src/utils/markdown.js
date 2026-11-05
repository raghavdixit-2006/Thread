// utils/markdown.js - minimal markdown-to-HTML for policy documents.
// Security: the source markdown is produced by the server (admin-authored),
// yet every character is escaped BEFORE any tag is synthesized, so no raw
// HTML from the storage layer can survive into the DOM.

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inline(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

/** converts a markdown subset (headings, lists, paragraphs, hr) to safe HTML */
export function markdownToHtml(markdown = '') {
  const lines = escapeHtml(String(markdown)).split(/\r?\n/);

  const out = [];
  let listKind = null; // 'ul' | 'ol' | null
  const listItems = [];
  const paragraph = [];

  const flushList = () => {
    if (listKind) {
      out.push(`<${listKind}>${listItems.map((item) => `<li>${item}</li>`).join('')}</${listKind}>`);
      listKind = null;
      listItems.length = 0;
    }
  };

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${inline(paragraph.join(' '))}</p>`);
      paragraph.length = 0;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushList();
      flushParagraph();
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    const isHr = /^(---+|\*\*\*+)$/.test(line);
    const isUl = /^[-*]\s+/.test(line);
    const isOl = /^\d+[.)]\s+/.test(line);

    if (isHr) {
      flushList();
      flushParagraph();
      out.push('<hr>');
      continue;
    }
    if (heading) {
      flushList();
      flushParagraph();
      const level = Math.min(heading[1].length + 1, 5); // document h1 renders as h2
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    if (isUl || isOl) {
      flushParagraph();
      const kind = isUl ? 'ul' : 'ol';
      if (listKind && listKind !== kind) flushList();
      listKind = kind;
      listItems.push(inline(line.replace(/^(?:[-*]|\d+[.)])\s+/, '')));
      continue;
    }
    if (listKind) flushList();
    paragraph.push(line);
  }

  flushList();
  flushParagraph();

  return out.join('\n');
}
