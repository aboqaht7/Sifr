import { Token, TokenType } from './lexer';

export interface Program { type: 'Program'; body: Statement[] }
export type Statement =
  | VarDecl | ConstDecl | FunctionDecl
  | IfStatement | WhileStatement | ForStatement
  | ReturnStatement | BreakStatement | ContinueStatement
  | Block | ExpressionStatement;

export interface VarDecl { type: 'VarDecl'; name: string; value: Expression | null }
export interface ConstDecl { type: 'ConstDecl'; name: string; value: Expression }
export interface FunctionDecl { type: 'FunctionDecl'; name: string; params: string[]; body: Block }
export interface IfStatement { type: 'IfStatement'; condition: Expression; consequent: Block; alternate: Statement | null }
export interface WhileStatement { type: 'WhileStatement'; condition: Expression; body: Block }
export interface ForStatement { type: 'ForStatement'; variable: string; from: Expression; to: Expression; step: Expression | null; body: Block }
export interface ReturnStatement { type: 'ReturnStatement'; value: Expression | null }
export interface BreakStatement { type: 'BreakStatement' }
export interface ContinueStatement { type: 'ContinueStatement' }
export interface Block { type: 'Block'; body: Statement[] }
export interface ExpressionStatement { type: 'ExpressionStatement'; expression: Expression }

export type Expression =
  | NumberLiteral | StringLiteral | BooleanLiteral | NullLiteral
  | Identifier | ArrayLiteral | ObjectLiteral
  | BinaryExpr | UnaryExpr | AssignExpr
  | CallExpr | MemberExpr | IndexExpr;

export interface NumberLiteral { type: 'NumberLiteral'; value: number }
export interface StringLiteral { type: 'StringLiteral'; value: string }
export interface BooleanLiteral { type: 'BooleanLiteral'; value: boolean }
export interface NullLiteral { type: 'NullLiteral' }
export interface Identifier { type: 'Identifier'; name: string }
export interface ArrayLiteral { type: 'ArrayLiteral'; elements: Expression[] }
export interface ObjectLiteral { type: 'ObjectLiteral'; properties: { key: string; value: Expression }[] }
export interface BinaryExpr { type: 'BinaryExpr'; op: string; left: Expression; right: Expression }
export interface UnaryExpr { type: 'UnaryExpr'; op: string; operand: Expression }
export interface AssignExpr { type: 'AssignExpr'; target: Expression; value: Expression }
export interface CallExpr { type: 'CallExpr'; callee: Expression; args: Expression[] }
export interface MemberExpr { type: 'MemberExpr'; object: Expression; property: string }
export interface IndexExpr { type: 'IndexExpr'; object: Expression; index: Expression }

const VAR_KW = new Set(['عرّف', 'عرف', 'متغير', 'اعرف']);
const CONST_KW = new Set(['ثابت']);
const FUNC_KW = new Set(['دالة', 'ادالة']);
const IF_KW = new Set(['إذا', 'اذا', 'لو']);
const ELSE_KW = new Set(['وإلا', 'والا', 'وإلّا', 'غير_ذلك', 'آخر', 'اخر']);
const WHILE_KW = new Set(['طالما', 'بينما', 'كرر']);
const FOR_KW = new Set(['لكل', 'لكل_رقم', 'كرر_من']);
const FROM_KW = new Set(['من']);
const TO_KW = new Set(['حتى', 'إلى', 'الى']);
const STEP_KW = new Set(['بخطوة']);
const RETURN_KW = new Set(['أعِد', 'اعد', 'ارجع', 'اعادة']);
const BREAK_KW = new Set(['وقف', 'اوقف', 'اكسر']);
const CONTINUE_KW = new Set(['تابع', 'استمر']);

class ParseError extends Error {
  constructor(message: string, public line: number, public col: number) {
    super(`خطأ في السطر ${line}، العمود ${col}: ${message}`);
  }
}

export function parse(tokens: Token[]): Program {
  let pos = 0;

  function cur(): Token { return tokens[pos] || tokens[tokens.length - 1]; }
  function peek(offset = 1): Token { return tokens[pos + offset] || tokens[tokens.length - 1]; }

  function expect(type: TokenType, value?: string): Token {
    const t = cur();
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new ParseError(`توقعت '${value || type}' لكن وجدت '${t.value}'`, t.line, t.col);
    }
    return tokens[pos++];
  }

  function check(type: TokenType, value?: string): boolean {
    const t = cur();
    return t.type === type && (value === undefined || t.value === value);
  }

  function checkIdent(set: Set<string>): boolean {
    return cur().type === 'IDENT' && set.has(cur().value);
  }

  function matchIdent(set: Set<string>): boolean {
    if (checkIdent(set)) { pos++; return true; }
    return false;
  }

  function skipSemis() {
    while (check('SEMICOLON')) pos++;
  }

  function parseProgram(): Program {
    const body: Statement[] = [];
    skipSemis();
    while (!check('EOF')) {
      body.push(parseStatement());
      skipSemis();
    }
    return { type: 'Program', body };
  }

  function parseStatement(): Statement {
    skipSemis();
    const t = cur();

    if (t.type === 'IDENT') {
      if (VAR_KW.has(t.value)) { pos++; return parseVarDecl(); }
      if (CONST_KW.has(t.value)) { pos++; return parseConstDecl(); }
      if (FUNC_KW.has(t.value)) { pos++; return parseFuncDecl(); }
      if (IF_KW.has(t.value)) { pos++; return parseIfStatement(); }
      if (WHILE_KW.has(t.value)) { pos++; return parseWhileStatement(); }
      if (FOR_KW.has(t.value)) { pos++; return parseForStatement(); }
      if (RETURN_KW.has(t.value)) { pos++; return parseReturnStatement(); }
      if (BREAK_KW.has(t.value)) { pos++; return { type: 'BreakStatement' }; }
      if (CONTINUE_KW.has(t.value)) { pos++; return { type: 'ContinueStatement' }; }
    }

    if (check('LBRACE')) return parseBlock();

    return parseExpressionStatement();
  }

  function parseVarDecl(): VarDecl {
    const t = expect('IDENT');
    const name = t.value;
    let value: Expression | null = null;
    if (check('ASSIGN')) { pos++; value = parseExpression(); }
    return { type: 'VarDecl', name, value };
  }

  function parseConstDecl(): ConstDecl {
    const t = expect('IDENT');
    const name = t.value;
    expect('ASSIGN');
    const value = parseExpression();
    return { type: 'ConstDecl', name, value };
  }

  function parseFuncDecl(): FunctionDecl {
    const name = expect('IDENT').value;
    expect('LPAREN');
    const params: string[] = [];
    if (!check('RPAREN')) {
      params.push(expect('IDENT').value);
      while (check('COMMA')) {
        pos++;
        params.push(expect('IDENT').value);
      }
    }
    expect('RPAREN');
    const body = parseBlock();
    return { type: 'FunctionDecl', name, params, body };
  }

  function parseIfStatement(): IfStatement {
    expect('LPAREN');
    const condition = parseExpression();
    expect('RPAREN');
    const consequent = parseBlock();
    let alternate: Statement | null = null;
    if (checkIdent(ELSE_KW)) {
      pos++;
      if (checkIdent(IF_KW)) { pos++; alternate = parseIfStatement(); }
      else alternate = parseBlock();
    }
    return { type: 'IfStatement', condition, consequent, alternate };
  }

  function parseWhileStatement(): WhileStatement {
    expect('LPAREN');
    const condition = parseExpression();
    expect('RPAREN');
    const body = parseBlock();
    return { type: 'WhileStatement', condition, body };
  }

  function parseForStatement(): ForStatement {
    const variable = expect('IDENT').value;
    if (!matchIdent(FROM_KW)) {
      throw new ParseError(`توقعت 'من' بعد اسم المتغير`, cur().line, cur().col);
    }
    const from = parseExpression();
    if (!matchIdent(TO_KW)) {
      throw new ParseError(`توقعت 'حتى' بعد قيمة البداية`, cur().line, cur().col);
    }
    const to = parseExpression();
    let step: Expression | null = null;
    if (checkIdent(STEP_KW)) { pos++; step = parseExpression(); }
    const body = parseBlock();
    return { type: 'ForStatement', variable, from, to, step, body };
  }

  function parseReturnStatement(): ReturnStatement {
    if (check('RBRACE') || check('EOF') || check('SEMICOLON')) {
      return { type: 'ReturnStatement', value: null };
    }
    const value = parseExpression();
    return { type: 'ReturnStatement', value };
  }

  function parseBlock(): Block {
    expect('LBRACE');
    const body: Statement[] = [];
    skipSemis();
    while (!check('RBRACE') && !check('EOF')) {
      body.push(parseStatement());
      skipSemis();
    }
    expect('RBRACE');
    return { type: 'Block', body };
  }

  function parseExpressionStatement(): ExpressionStatement {
    const expression = parseExpression();
    return { type: 'ExpressionStatement', expression };
  }

  function parseExpression(): Expression {
    return parseAssignment();
  }

  function parseAssignment(): Expression {
    const left = parseOr();
    if (check('ASSIGN')) {
      pos++;
      const value = parseAssignment();
      return { type: 'AssignExpr', target: left, value };
    }
    return left;
  }

  function parseOr(): Expression {
    let left = parseAnd();
    while (check('OR')) {
      const op = cur().value; pos++;
      const right = parseAnd();
      left = { type: 'BinaryExpr', op, left, right };
    }
    return left;
  }

  function parseAnd(): Expression {
    let left = parseEquality();
    while (check('AND')) {
      const op = cur().value; pos++;
      const right = parseEquality();
      left = { type: 'BinaryExpr', op, left, right };
    }
    return left;
  }

  function parseEquality(): Expression {
    let left = parseComparison();
    while (check('EQ') || check('NEQ')) {
      const op = cur().value; pos++;
      const right = parseComparison();
      left = { type: 'BinaryExpr', op, left, right };
    }
    return left;
  }

  function parseComparison(): Expression {
    let left = parseAdditive();
    while (check('LT') || check('GT') || check('LTE') || check('GTE')) {
      const op = cur().value; pos++;
      const right = parseAdditive();
      left = { type: 'BinaryExpr', op, left, right };
    }
    return left;
  }

  function parseAdditive(): Expression {
    let left = parseMultiplicative();
    while (check('PLUS') || check('MINUS')) {
      const op = cur().value; pos++;
      const right = parseMultiplicative();
      left = { type: 'BinaryExpr', op, left, right };
    }
    return left;
  }

  function parseMultiplicative(): Expression {
    let left = parsePower();
    while (check('STAR') || check('SLASH') || check('PERCENT')) {
      const op = cur().value; pos++;
      const right = parsePower();
      left = { type: 'BinaryExpr', op, left, right };
    }
    return left;
  }

  function parsePower(): Expression {
    const left = parseUnary();
    if (check('POWER')) {
      pos++;
      const right = parsePower();
      return { type: 'BinaryExpr', op: '**', left, right };
    }
    return left;
  }

  function parseUnary(): Expression {
    if (check('MINUS')) {
      pos++;
      return { type: 'UnaryExpr', op: '-', operand: parseUnary() };
    }
    if (check('NOT')) {
      pos++;
      return { type: 'UnaryExpr', op: '!', operand: parseUnary() };
    }
    return parsePostfix();
  }

  function parsePostfix(): Expression {
    let expr = parsePrimary();
    while (true) {
      if (check('DOT')) {
        pos++;
        const prop = expect('IDENT').value;
        expr = { type: 'MemberExpr', object: expr, property: prop };
      } else if (check('LBRACKET')) {
        pos++;
        const index = parseExpression();
        expect('RBRACKET');
        expr = { type: 'IndexExpr', object: expr, index };
      } else if (check('LPAREN')) {
        pos++;
        const args: Expression[] = [];
        if (!check('RPAREN')) {
          args.push(parseExpression());
          while (check('COMMA')) { pos++; args.push(parseExpression()); }
        }
        expect('RPAREN');
        expr = { type: 'CallExpr', callee: expr, args };
      } else break;
    }
    return expr;
  }

  function parsePrimary(): Expression {
    const t = cur();

    if (t.type === 'NUMBER') { pos++; return { type: 'NumberLiteral', value: parseFloat(t.value) }; }
    if (t.type === 'STRING') { pos++; return { type: 'StringLiteral', value: t.value }; }
    if (t.type === 'BOOLEAN') { pos++; return { type: 'BooleanLiteral', value: t.value === 'true' }; }
    if (t.type === 'NULL') { pos++; return { type: 'NullLiteral' }; }
    if (t.type === 'IDENT') { pos++; return { type: 'Identifier', name: t.value }; }

    if (t.type === 'LPAREN') {
      pos++;
      const expr = parseExpression();
      expect('RPAREN');
      return expr;
    }

    if (t.type === 'LBRACKET') {
      pos++;
      const elements: Expression[] = [];
      if (!check('RBRACKET')) {
        elements.push(parseExpression());
        while (check('COMMA')) { pos++; if (check('RBRACKET')) break; elements.push(parseExpression()); }
      }
      expect('RBRACKET');
      return { type: 'ArrayLiteral', elements };
    }

    if (t.type === 'LBRACE') {
      pos++;
      const properties: { key: string; value: Expression }[] = [];
      if (!check('RBRACE')) {
        const key = expect('IDENT').value;
        expect('COLON');
        const value = parseExpression();
        properties.push({ key, value });
        while (check('COMMA')) {
          pos++;
          if (check('RBRACE')) break;
          const k = expect('IDENT').value;
          expect('COLON');
          const v = parseExpression();
          properties.push({ key: k, value: v });
        }
      }
      expect('RBRACE');
      return { type: 'ObjectLiteral', properties };
    }

    throw new ParseError(`رمز غير متوقع: '${t.value}'`, t.line, t.col);
  }

  return parseProgram();
}
