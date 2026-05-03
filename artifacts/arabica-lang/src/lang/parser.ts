import { Token, TokenType } from './lexer';

export interface Program { type: 'Program'; body: Statement[] }
export type Statement =
  | VarDecl | ConstDecl | FunctionDecl | StructDecl
  | IfStatement | WhileStatement | ForStatement | ForEachStatement | MatchStatement
  | ReturnStatement | BreakStatement | ContinueStatement
  | Block | ExpressionStatement;

export interface VarDecl { type: 'VarDecl'; name: string; value: Expression | null }
export interface ConstDecl { type: 'ConstDecl'; name: string; value: Expression }
export interface FunctionDecl { type: 'FunctionDecl'; name: string; params: string[]; body: Block }
export interface StructDecl { type: 'StructDecl'; name: string; fields: string[] }
export interface IfStatement { type: 'IfStatement'; condition: Expression; consequent: Block; alternate: Statement | null }
export interface WhileStatement { type: 'WhileStatement'; condition: Expression; body: Block }
export interface ForStatement { type: 'ForStatement'; variable: string; from: Expression; to: Expression; step: Expression | null; body: Block }
export interface ForEachStatement { type: 'ForEachStatement'; variable: string; iterable: Expression; body: Block }
export interface MatchStatement { type: 'MatchStatement'; value: Expression; cases: MatchCase[] }
export interface MatchCase { value: Expression | null; body: Statement[] }
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

// === Unique Arabica keywords (not direct translations) ===
const VAR_KW = new Set(['كنز']);              // treasure → variable
const CONST_KW = new Set(['سرّ', 'سر']);       // secret → constant
const FUNC_KW = new Set(['مهمّة', 'مهمة']);    // mission → function
const STRUCT_KW = new Set(['بنية']);           // structure → struct
const IF_KW = new Set(['إن', 'ان']);           // if-it-is → if
const ELSE_KW = new Set(['وإلا', 'والا']);     // otherwise → else
const WHILE_KW = new Set(['كرر']);             // repeat → while
const FOR_KW = new Set(['جوال']);              // traveler → for
const FROM_KW = new Set(['من']);
const TO_KW = new Set(['إلى', 'الى']);
const IN_KW = new Set(['في']);                 // in → for-in / foreach
const STEP_KW = new Set(['بخطوة']);
const RETURN_KW = new Set(['أعد', 'اعد']);     // return
const BREAK_KW = new Set(['قف']);              // halt → break
const CONTINUE_KW = new Set(['استمر']);        // continue
const MATCH_KW = new Set(['طابق']);            // match → match
const CASE_KW = new Set(['حال']);              // case
const END_KW = new Set(['انتهى']);             // ended → end-of-block

class ParseError extends Error {
  constructor(message: string, public line: number, public col: number) {
    super(`خطأ في السطر ${line}، العمود ${col}: ${message}`);
  }
}

export function parse(tokens: Token[]): Program {
  let pos = 0;

  function cur(): Token { return tokens[pos] || tokens[tokens.length - 1]; }

  function expect(type: TokenType, value?: string): Token {
    const t = cur();
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new ParseError(`توقعت '${value || type}' لكن وجدت '${t.value || t.type}'`, t.line, t.col);
    }
    return tokens[pos++];
  }

  function expectIdent(set: Set<string>, label: string): Token {
    const t = cur();
    if (t.type !== 'IDENT' || !set.has(t.value)) {
      throw new ParseError(`توقعت '${label}' لكن وجدت '${t.value || t.type}'`, t.line, t.col);
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

  function isBodyTerminator(): boolean {
    const t = cur();
    if (t.type === 'EOF') return true;
    if (t.type !== 'IDENT') return false;
    return END_KW.has(t.value) || ELSE_KW.has(t.value) || CASE_KW.has(t.value);
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
      if (FUNC_KW.has(t.value)) { pos++; return parseFunctionDecl(); }
      if (STRUCT_KW.has(t.value)) { pos++; return parseStructDecl(); }
      if (IF_KW.has(t.value)) { pos++; return parseIfStatement(); }
      if (WHILE_KW.has(t.value)) { pos++; return parseWhileStatement(); }
      if (FOR_KW.has(t.value)) { pos++; return parseForStatement(); }
      if (MATCH_KW.has(t.value)) { pos++; return parseMatchStatement(); }
      if (RETURN_KW.has(t.value)) { pos++; return parseReturnStatement(); }
      if (BREAK_KW.has(t.value)) { pos++; return { type: 'BreakStatement' }; }
      if (CONTINUE_KW.has(t.value)) { pos++; return { type: 'ContinueStatement' }; }
    }

    return parseExpressionStatement();
  }

  function parseVarDecl(): VarDecl {
    const name = expect('IDENT').value;
    let value: Expression | null = null;
    if (check('ASSIGN')) { pos++; value = parseExpression(); }
    return { type: 'VarDecl', name, value };
  }

  function parseConstDecl(): ConstDecl {
    const name = expect('IDENT').value;
    expect('ASSIGN');
    const value = parseExpression();
    return { type: 'ConstDecl', name, value };
  }

  function parseFunctionDecl(): FunctionDecl {
    const name = expect('IDENT').value;
    expect('LPAREN');
    const params: string[] = [];
    if (!check('RPAREN')) {
      params.push(expect('IDENT').value);
      while (check('COMMA')) { pos++; params.push(expect('IDENT').value); }
    }
    expect('RPAREN');
    expect('COLON');
    const body: Block = { type: 'Block', body: parseBody() };
    expectIdent(END_KW, 'انتهى');
    return { type: 'FunctionDecl', name, params, body };
  }

  function parseStructDecl(): StructDecl {
    const name = expect('IDENT').value;
    expect('COLON');
    const fields: string[] = [];
    skipSemis();
    while (!checkIdent(END_KW) && !check('EOF')) {
      fields.push(expect('IDENT').value);
      skipSemis();
    }
    expectIdent(END_KW, 'انتهى');
    return { type: 'StructDecl', name, fields };
  }

  function parseIfStatement(): IfStatement {
    const condition = parseExpression();
    expect('COLON');
    const consequent: Block = { type: 'Block', body: parseBody() };
    let alternate: Statement | null = null;

    if (matchIdent(ELSE_KW)) {
      if (checkIdent(IF_KW)) {
        pos++; // consume 'إن'
        alternate = parseIfStatement(); // recursive — consumes its own انتهى
      } else {
        expect('COLON');
        const elseBlock: Block = { type: 'Block', body: parseBody() };
        expectIdent(END_KW, 'انتهى');
        alternate = elseBlock;
      }
    } else {
      expectIdent(END_KW, 'انتهى');
    }

    return { type: 'IfStatement', condition, consequent, alternate };
  }

  function parseWhileStatement(): WhileStatement {
    const condition = parseExpression();
    expect('COLON');
    const body: Block = { type: 'Block', body: parseBody() };
    expectIdent(END_KW, 'انتهى');
    return { type: 'WhileStatement', condition, body };
  }

  function parseForStatement(): ForStatement | ForEachStatement {
    const variable = expect('IDENT').value;

    // foreach: جوال x في collection :
    if (matchIdent(IN_KW)) {
      const iterable = parseExpression();
      expect('COLON');
      const body: Block = { type: 'Block', body: parseBody() };
      expectIdent(END_KW, 'انتهى');
      return { type: 'ForEachStatement', variable, iterable, body };
    }

    // range: جوال x من 1 إلى 10 [بخطوة 2] :
    expectIdent(FROM_KW, 'من');
    const from = parseExpression();
    expectIdent(TO_KW, 'إلى');
    const to = parseExpression();
    let step: Expression | null = null;
    if (matchIdent(STEP_KW)) step = parseExpression();
    expect('COLON');
    const body: Block = { type: 'Block', body: parseBody() };
    expectIdent(END_KW, 'انتهى');
    return { type: 'ForStatement', variable, from, to, step, body };
  }

  function parseMatchStatement(): MatchStatement {
    const value = parseExpression();
    expect('COLON');
    skipSemis();
    const cases: MatchCase[] = [];
    while (matchIdent(CASE_KW)) {
      let caseValue: Expression | null = null;
      // Wildcard '_'
      if (cur().type === 'IDENT' && cur().value === '_') {
        pos++;
      } else {
        caseValue = parseExpression();
      }
      expect('COLON');
      const body = parseBody(); // terminates at حال or انتهى
      cases.push({ value: caseValue, body });
      skipSemis();
    }
    expectIdent(END_KW, 'انتهى');
    return { type: 'MatchStatement', value, cases };
  }

  function parseReturnStatement(): ReturnStatement {
    if (isBodyTerminator() || check('SEMICOLON')) {
      return { type: 'ReturnStatement', value: null };
    }
    const value = parseExpression();
    return { type: 'ReturnStatement', value };
  }

  function parseBody(): Statement[] {
    const stmts: Statement[] = [];
    skipSemis();
    while (!isBodyTerminator()) {
      stmts.push(parseStatement());
      skipSemis();
    }
    return stmts;
  }

  function parseExpressionStatement(): ExpressionStatement {
    const expression = parseExpression();
    return { type: 'ExpressionStatement', expression };
  }

  function parseExpression(): Expression { return parseAssignment(); }

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
    while (check('OR')) { const op = cur().value; pos++; left = { type: 'BinaryExpr', op, left, right: parseAnd() }; }
    return left;
  }
  function parseAnd(): Expression {
    let left = parseEquality();
    while (check('AND')) { const op = cur().value; pos++; left = { type: 'BinaryExpr', op, left, right: parseEquality() }; }
    return left;
  }
  function parseEquality(): Expression {
    let left = parseComparison();
    while (check('EQ') || check('NEQ')) { const op = cur().value; pos++; left = { type: 'BinaryExpr', op, left, right: parseComparison() }; }
    return left;
  }
  function parseComparison(): Expression {
    let left = parseAdditive();
    while (check('LT') || check('GT') || check('LTE') || check('GTE')) { const op = cur().value; pos++; left = { type: 'BinaryExpr', op, left, right: parseAdditive() }; }
    return left;
  }
  function parseAdditive(): Expression {
    let left = parseMultiplicative();
    while (check('PLUS') || check('MINUS')) { const op = cur().value; pos++; left = { type: 'BinaryExpr', op, left, right: parseMultiplicative() }; }
    return left;
  }
  function parseMultiplicative(): Expression {
    let left = parsePower();
    while (check('STAR') || check('SLASH') || check('PERCENT')) { const op = cur().value; pos++; left = { type: 'BinaryExpr', op, left, right: parsePower() }; }
    return left;
  }
  function parsePower(): Expression {
    const left = parseUnary();
    if (check('POWER')) { pos++; return { type: 'BinaryExpr', op: '**', left, right: parsePower() }; }
    return left;
  }
  function parseUnary(): Expression {
    if (check('MINUS')) { pos++; return { type: 'UnaryExpr', op: '-', operand: parseUnary() }; }
    if (check('NOT')) { pos++; return { type: 'UnaryExpr', op: '!', operand: parseUnary() }; }
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
    if (t.type === 'LPAREN') { pos++; const expr = parseExpression(); expect('RPAREN'); return expr; }
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
          properties.push({ key: k, value: parseExpression() });
        }
      }
      expect('RBRACE');
      return { type: 'ObjectLiteral', properties };
    }
    throw new ParseError(`رمز غير متوقع: '${t.value}'`, t.line, t.col);
  }

  return parseProgram();
}
