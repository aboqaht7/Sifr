export type TokenType =
  | 'NUMBER' | 'STRING' | 'BOOLEAN' | 'NULL'
  | 'IDENT'
  | 'ASSIGN'
  | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'PERCENT' | 'POWER'
  | 'EQ' | 'NEQ' | 'LT' | 'GT' | 'LTE' | 'GTE'
  | 'AND' | 'OR' | 'NOT'
  | 'LBRACE' | 'RBRACE' | 'LPAREN' | 'RPAREN' | 'LBRACKET' | 'RBRACKET'
  | 'COMMA' | 'SEMICOLON' | 'COLON' | 'DOT'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

function isArabicChar(ch: string): boolean {
  const code = ch.charCodeAt(0);
  // Exclude Arabic punctuation: ، ؛ ؟ ٪ ٬ ٭ ؍ ؎ ؏ ؞ ؟
  if (code === 0x060C || code === 0x061B || code === 0x061F ||
      code === 0x066A || code === 0x066B || code === 0x066C ||
      code === 0x066D || code === 0x06D4) return false;
  // Exclude Arabic digits (handled separately)
  if (code >= 0x0660 && code <= 0x0669) return false;
  if (code >= 0x06F0 && code <= 0x06F9) return false;
  return (
    (code >= 0x0600 && code <= 0x06FF) ||
    (code >= 0x0750 && code <= 0x077F) ||
    (code >= 0xFB50 && code <= 0xFDFF) ||
    (code >= 0xFE70 && code <= 0xFEFF)
  );
}

function isIdentStart(ch: string): boolean {
  return isArabicChar(ch) || /[a-zA-Z_]/.test(ch);
}

function isIdentPart(ch: string): boolean {
  const code = ch.charCodeAt(0);
  // Arabic diacritics (tashkeel) including shadda
  if (code >= 0x064B && code <= 0x065F) return true;
  return isIdentStart(ch) || /[0-9]/.test(ch) || ch === '_';
}

function isDigit(ch: string): boolean {
  return /[0-9٠-٩]/.test(ch);
}

function toWesternDigit(ch: string): string {
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  const idx = arabicDigits.indexOf(ch);
  return idx >= 0 ? idx.toString() : ch;
}

const BOOLEANS = new Set(['صدق', 'حق', 'كذب', 'باطل']);
const NULLS = new Set(['عدم', 'لاشيء', 'لا_شيء']);

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let line = 1;
  let col = 1;

  function cur(): string { return source[pos] || ''; }
  function peek(offset = 1): string { return source[pos + offset] || ''; }

  function advance(): string {
    const ch = source[pos++];
    if (ch === '\n') { line++; col = 1; } else { col++; }
    return ch;
  }

  function push(type: TokenType, value: string, l = line, c = col) {
    tokens.push({ type, value, line: l, col: c });
  }

  while (pos < source.length) {
    const sl = line, sc = col;
    const ch = cur();

    if (/\s/.test(ch)) { advance(); continue; }

    // Comments
    if (ch === '/' && peek() === '/') {
      while (pos < source.length && cur() !== '\n') advance();
      continue;
    }
    if (ch === '/' && peek() === '*') {
      advance(); advance();
      while (pos < source.length && !(cur() === '*' && peek() === '/')) advance();
      if (pos < source.length) { advance(); advance(); }
      continue;
    }

    // Numbers
    if (isDigit(ch) || (ch === '.' && isDigit(peek()))) {
      let num = '';
      while (pos < source.length && (isDigit(cur()) || cur() === '.')) {
        num += toWesternDigit(advance());
      }
      push('NUMBER', num, sl, sc);
      continue;
    }

    // Strings
    if (ch === '"' || ch === "'") {
      const q = advance();
      let str = '';
      while (pos < source.length && cur() !== q) {
        if (cur() === '\\') {
          advance();
          const e = advance();
          switch (e) {
            case 'n': str += '\n'; break;
            case 't': str += '\t'; break;
            case 'r': str += '\r'; break;
            default: str += e;
          }
        } else {
          str += advance();
        }
      }
      if (pos < source.length) advance();
      push('STRING', str, sl, sc);
      continue;
    }

    // Identifiers / keywords
    if (isIdentStart(ch)) {
      let ident = '';
      while (pos < source.length && isIdentPart(cur())) {
        ident += advance();
      }
      if (BOOLEANS.has(ident)) {
        push('BOOLEAN', (ident === 'صدق' || ident === 'حق') ? 'true' : 'false', sl, sc);
      } else if (NULLS.has(ident)) {
        push('NULL', 'null', sl, sc);
      } else {
        push('IDENT', ident, sl, sc);
      }
      continue;
    }

    // Operators & punctuation
    advance();
    switch (ch) {
      case '=':
        if (cur() === '=') { advance(); push('EQ', '==', sl, sc); }
        else push('ASSIGN', '=', sl, sc);
        break;
      case '!':
        if (cur() === '=') { advance(); push('NEQ', '!=', sl, sc); }
        else push('NOT', '!', sl, sc);
        break;
      case '<':
        if (cur() === '=') { advance(); push('LTE', '<=', sl, sc); }
        else push('LT', '<', sl, sc);
        break;
      case '>':
        if (cur() === '=') { advance(); push('GTE', '>=', sl, sc); }
        else push('GT', '>', sl, sc);
        break;
      case '&':
        if (cur() === '&') { advance(); push('AND', '&&', sl, sc); }
        break;
      case '|':
        if (cur() === '|') { advance(); push('OR', '||', sl, sc); }
        break;
      case '+': push('PLUS', '+', sl, sc); break;
      case '-': push('MINUS', '-', sl, sc); break;
      case '*':
        if (cur() === '*') { advance(); push('POWER', '**', sl, sc); }
        else push('STAR', '*', sl, sc);
        break;
      case '/': push('SLASH', '/', sl, sc); break;
      case '%': push('PERCENT', '%', sl, sc); break;
      case '{': push('LBRACE', '{', sl, sc); break;
      case '}': push('RBRACE', '}', sl, sc); break;
      case '(': push('LPAREN', '(', sl, sc); break;
      case ')': push('RPAREN', ')', sl, sc); break;
      case '[': push('LBRACKET', '[', sl, sc); break;
      case ']': push('RBRACKET', ']', sl, sc); break;
      case ',':
      case '،': push('COMMA', ',', sl, sc); break;
      case ';':
      case '؛': push('SEMICOLON', ';', sl, sc); break;
      case ':': push('COLON', ':', sl, sc); break;
      case '.': push('DOT', '.', sl, sc); break;
      default: break; // ignore unknown
    }
  }

  push('EOF', '', line, col);
  return tokens;
}
