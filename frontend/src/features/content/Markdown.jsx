import { Link } from 'react-router-dom';

// Markdown → React element โดยตรง (ไม่มี dangerouslySetInnerHTML) จึงไม่มี HTML/สคริปต์หลุดมารัน
// รองรับ: # หัวข้อ, ย่อหน้า, **หนา** *เอียง* `โค้ด`, [ลิงก์](url), ![รูป](url), - / 1. รายการ, ```โค้ดบล็อก```, > quote, ---

const SAFE_URL = /^(https?:\/\/|\/(?!\/)|#|mailto:)/i;
export const safeUrl = (url) => (SAFE_URL.test(String(url).trim()) ? String(url).trim() : null);

const INLINE = /(!\[([^\]]*)\]\(([^)\s]+)\))|(\[([^\]]+)\]\(([^)\s]+)\))|(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(_([^_]+)_)/;

export function renderInline(text, keyBase = 'i') {
  const out = [];
  let rest = text;
  let i = 0;
  while (rest) {
    const m = rest.match(INLINE);
    if (!m) { out.push(rest); break; }
    if (m.index) out.push(rest.slice(0, m.index));
    const key = `${keyBase}-${i += 1}`;
    if (m[1]) {
      const src = safeUrl(m[3]);
      out.push(src ? <img key={key} src={src} alt={m[2]} loading="lazy" /> : m[0]);
    } else if (m[4]) {
      const href = safeUrl(m[6]);
      if (!href) out.push(m[5]);
      else if (href.startsWith('/')) out.push(<Link key={key} to={href}>{renderInline(m[5], key)}</Link>);
      else out.push(<a key={key} href={href} target="_blank" rel="noreferrer noopener">{renderInline(m[5], key)}</a>);
    } else if (m[7]) out.push(<code key={key}>{m[8]}</code>);
    else if (m[9]) out.push(<strong key={key}>{renderInline(m[10], key)}</strong>);
    else if (m[11]) out.push(<em key={key}>{renderInline(m[12], key)}</em>);
    else if (m[13]) out.push(<em key={key}>{renderInline(m[14], key)}</em>);
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

/** Splits markdown into blocks: [{ type, ... }] — exported for tests and the editor's outline. */
export function parseBlocks(source) {
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }
    const fence = line.match(/^```\s*([\w-]*)\s*$/);
    if (fence) {
      const code = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i++]);
      i += 1;
      blocks.push({ type: 'code', lang: fence[1], text: code.join('\n') });
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) { blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() }); i += 1; continue; }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { blocks.push({ type: 'hr' }); i += 1; continue; }
    if (/^>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push({ type: 'quote', text: quote.join(' ') });
      continue;
    }
    const listMatch = line.match(/^\s*([-*]|\d+\.)\s+/);
    if (listMatch) {
      const ordered = /\d/.test(listMatch[1]);
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ''));
      blocks.push({ type: 'list', ordered, items });
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|>|\s*([-*]|\d+\.)\s+|-{3,}\s*$)/.test(lines[i])) para.push(lines[i++].trim());
    blocks.push({ type: 'p', text: para.join(' ') });
  }
  return blocks;
}

// \p{M} = สระ/วรรณยุกต์ไทย (combining marks) ต้องเก็บไว้ ไม่งั้น “หัวข้อ” จะแตกเป็น “ห-วข-อ”
const slugify = (text) => text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, '-').replace(/^-|-$/g, '');

export function Markdown({ source, className = 'prose' }) {
  return (
    <div className={className}>
      {parseBlocks(source).map((b, i) => {
        const key = `b${i}`;
        switch (b.type) {
          case 'heading': {
            const Tag = `h${Math.min(4, b.level + 1)}`;
            return <Tag key={key} id={slugify(b.text)}>{renderInline(b.text, key)}</Tag>;
          }
          case 'code': return <pre key={key} className="terminal"><code>{b.text}</code></pre>;
          case 'quote': return <blockquote key={key}>{renderInline(b.text, key)}</blockquote>;
          case 'hr': return <hr key={key} />;
          case 'list': {
            const Tag = b.ordered ? 'ol' : 'ul';
            return <Tag key={key}>{b.items.map((item, j) => <li key={j}>{renderInline(item, `${key}-${j}`)}</li>)}</Tag>;
          }
          default: return <p key={key}>{renderInline(b.text, key)}</p>;
        }
      })}
    </div>
  );
}

export function headingsOf(source) {
  return parseBlocks(source).filter((b) => b.type === 'heading' && b.level === 2).map((b) => ({ text: b.text, id: slugify(b.text) }));
}

