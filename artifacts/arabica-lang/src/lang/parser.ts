import { Token, TokenType } from './lexer';

export interface Loc { line: number; col: number }

export interface Program { type: 'Program'; body: Statement[] }
export type Statement =
  | VarDecl | ConstDecl | FunctionDecl | StructDecl
  | IfStatement | WhileStatement | ForStatement | ForEachStatement | MatchStatement
  | TryStatement | ReturnStatement | BreakStatement | ContinueStatement
  | ModuleDecl | ImportStmt | ExportStmt
  | Block | ExpressionStatement;

export interface VarDecl { type: 'VarDecl'; name: string; value: Expression | null; typeName?: string | null; loc?: Loc }
export interface ConstDecl { type: 'ConstDecl'; name: string; value: Expression; typeName?: string | null; loc?: Loc }
export interface ModuleDecl { type: 'ModuleDecl'; name: string; body: Statement[]; loc?: Loc }
export interface ImportStmt { type: 'ImportStmt'; names: string[]; module: string; loc?: Loc }
export interface ExportStmt { type: 'ExportStmt'; names: string[]; loc?: Loc }
export interface FunctionDecl { type: 'FunctionDecl'; name: string; params: string[]; body: Block; loc?: Loc }
export interface StructDecl { type: 'StructDecl'; name: string; parent: string | null; fields: string[]; methods: FunctionDecl[]; loc?: Loc }
export interface IfStatement { type: 'IfStatement'; condition: Expression; consequent: Block; alternate: Statement | null; loc?: Loc }
export interface WhileStatement { type: 'WhileStatement'; condition: Expression; body: Block; loc?: Loc }
export interface ForStatement { type: 'ForStatement'; variable: string; from: Expression; to: Expression; step: Expression | null; body: Block; loc?: Loc }
export interface ForEachStatement { type: 'ForEachStatement'; variable: string; iterable: Expression; body: Block; loc?: Loc }
export interface MatchStatement { type: 'MatchStatement'; value: Expression; cases: MatchCase[]; loc?: Loc }
export interface MatchCase { value: Expression | null; body: Statement[] }
export interface TryStatement { type: 'TryStatement'; tryBlock: Statement[]; catchVar: string | null; catchBlock: Statement[] | null; loc?: Loc }
export interface ReturnStatement { type: 'ReturnStatement'; value: Expression | null; loc?: Loc }
export interface BreakStatement { type: 'BreakStatement'; loc?: Loc }
export interface ContinueStatement { type: 'ContinueStatement'; loc?: Loc }
export interface Block { type: 'Block'; body: Statement[]; loc?: Loc }
export interface ExpressionStatement { type: 'ExpressionStatement'; expression: Expression; loc?: Loc }

export type Expression =
  | NumberLiteral | StringLiteral | BooleanLiteral | NullLiteral | TemplateLiteral
  | Identifier | ArrayLiteral | ObjectLiteral | LambdaExpr
  | BinaryExpr | UnaryExpr | AssignExpr
  | CallExpr | MemberExpr | IndexExpr;

export interface NumberLiteral { type: 'NumberLiteral'; value: number }
export interface StringLiteral { type: 'StringLiteral'; value: string }
export interface BooleanLiteral { type: 'BooleanLiteral'; value: boolean }
export interface NullLiteral { type: 'NullLiteral' }
export interface TemplateLiteral { type: 'TemplateLiteral'; raw: string }
export interface Identifier { type: 'Identifier'; name: string }
export interface ArrayLiteral { type: 'ArrayLiteral'; elements: Expression[] }
export interface ObjectLiteral { type: 'ObjectLiteral'; properties: { key: string; value: Expression }[] }
export interface LambdaExpr { type: 'LambdaExpr'; params: string[]; body: Block }
export interface BinaryExpr { type: 'BinaryExpr'; op: string; left: Expression; right: Expression }
export interface UnaryExpr { type: 'UnaryExpr'; op: string; operand: Expression }
export interface AssignExpr { type: 'AssignExpr'; target: Expression; value: Expression }
export interface CallExpr { type: 'CallExpr'; callee: Expression; args: Expression[] }
export interface MemberExpr { type: 'MemberExpr'; object: Expression; property: string }
export interface IndexExpr { type: 'IndexExpr'; object: Expression; index: Expression }

const VAR_KW = new Set(['كنز']);
const CONST_KW = new Set(['سرّ', 'سر']);
const FUNC_KW = new Set(['مهمّة', 'مهمة']);
const STRUCT_KW = new Set(['بنية']);
const IF_KW = new Set(['إن', 'ان']);
const ELSE_KW = new Set(['وإلا', 'والا']);
const WHILE_KW = new Set(['كرر']);
const FOR_KW = new Set(['جوال']);
const FROM_KW = new Set(['من']);
const TO_KW = new Set(['إلى', 'الى']);
const IN_KW = new Set(['في']);
const STEP_KW = new Set(['بخطوة']);
const RETURN_KW = new Set(['أعد', 'اعد']);
const BREAK_KW = new Set(['قف']);
const CONTINUE_KW = new Set(['استمر']);
const MATCH_KW = new Set(['طابق']);
const CASE_KW = new Set(['حال']);
const TRY_KW = new Set(['حاول']);
const CATCH_KW = new Set(['التقط']);
const INHERITS_KW = new Set(['وارث', 'يرث']);
const MODULE_KW = new Set(['وحدة']);
const IMPORT_KW = new Set(['استورد']);
const EXPORT_KW = new Set(['صدّر', 'صدر']);
const END_KW = new Set(['انتهى']);

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
  function check(type: TokenType): boolean { return cur().type === type; }
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
    return END_KW.has(t.value) || ELSE_KW.has(t.value) || CASE_KW.has(t.value) || CATCH_KW.has(t.value);
  }
  function skipSemis() { while (check('SEMICOLON')) pos++; }

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
    const loc: Loc = { line: t.line, col: t.col };
    let result: Statement;
    if (t.type === 'IDENT') {
      if (VAR_KW.has(t.value)) { pos++; result = parseVarDecl(); }
      else if (CONST_KW.has(t.value)) { pos++; result = parseConstDecl(); }
      else if (FUNC_KW.has(t.value) && tokens[pos + 1]?.type === 'IDENT') {
        pos++; result = parseFunctionDecl();
      }
      else if (STRUCT_KW.has(t.value)) { pos++; result = parseStructDecl(); }
      else if (IF_KW.has(t.value)) { pos++; result = parseIfStatement(); }
      else if (WHILE_KW.has(t.value)) { pos++; result = parseWhileStatement(); }
      else if (FOR_KW.has(t.value)) { pos++; result = parseForStatement(); }
      else if (MATCH_KW.has(t.value)) { pos++; result = parseMatchStatement(); }
      else if (TRY_KW.has(t.value)) { pos++; result = parseTryStatement(); }
      else if (RETURN_KW.has(t.value)) { pos++; result = parseReturnStatement(); }
      else if (BREAK_KW.has(t.value)) { pos++; result = { type: 'BreakStatement' }; }
      else if (CONTINUE_KW.has(t.value)) { pos++; result = { type: 'ContinueStatement' }; }
      else if (MODULE_KW.has(t.value)) { pos++; result = parseModuleDecl(); }
      else if (IMPORT_KW.has(t.value)) { pos++; result = parseImportStmt(); }
      else if (EXPORT_KW.has(t.value)) { pos++; result = parseExportStmt(); }
      else { result = parseExpressionStatement(); }
    } else {
      result = parseExpressionStatement();
    }
    (result as { loc?: Loc }).loc = loc;
    return result;
  }

  function parseTypeAnnotation(): string | null {
    // Optional ": typeName" — only consume colon if followed directly by an IDENT that isn't a keyword starter
    if (!check('COLON')) return null;
    // Lookahead: must be IDENT followed by (ASSIGN | end-of-decl context)
    const savedPos = pos;
    pos++;
    if (cur().type !== 'IDENT') { pos = savedPos; return null; }
    const typeName = tokens[pos++].value;
    return typeName;
  }
  function parseVarDecl(): VarDecl {
    const name = expect('IDENT').value;
    const typeName = parseTypeAnnotation();
    let value: Expression | null = null;
    if (check('ASSIGN')) { pos++; value = parseExpression(); }
    return { type: 'VarDecl', name, value, typeName };
  }
  function parseConstDecl(): ConstDecl {
    const name = expect('IDENT').value;
    const typeName = parseTypeAnnotation();
    expect('ASSIGN');
    return { type: 'ConstDecl', name, value: parseExpression(), typeName };
  }
  function parseModuleDecl(): ModuleDecl {
    const name = expect('IDENT').value;
    expect('COLON');
    const body = parseBody();
    expectIdent(END_KW, 'انتهى');
    return { type: 'ModuleDecl', name, body };
  }
  function parseImportStmt(): ImportStmt {
    const names: string[] = [expect('IDENT').value];
    while (check('COMMA')) { pos++; names.push(expect('IDENT').value); }
    expectIdent(FROM_KW, 'من');
    const module = expect('IDENT').value;
    return { type: 'ImportStmt', names, module };
  }
  function parseExportStmt(): ExportStmt {
    const names: string[] = [expect('IDENT').value];
    while (check('COMMA')) { pos++; names.push(expect('IDENT').value); }
    return { type: 'ExportStmt', names };
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
  function parseLambda(): LambdaExpr {
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
    return { type: 'LambdaExpr', params, body };
  }
  function parseStructDecl(): StructDecl {
    const name = expect('IDENT').value;
    let parent: string | null = null;
    if (matchIdent(INHERITS_KW)) {
      parent = expect('IDENT').value;
    }
    expect('COLON');
    const fields: string[] = [];
    const methods: FunctionDecl[] = [];
    skipSemis();
    while (!checkIdent(END_KW) && !check('EOF')) {
      if (checkIdent(FUNC_KW)) {
        pos++;
        methods.push(parseFunctionDecl());
      } else {
        fields.push(expect('IDENT').value);
      }
      skipSemis();
    }
    expectIdent(END_KW, 'انتهى');
    return { type: 'StructDecl', name, parent, fields, methods };
  }
  function parseIfStatement(): IfStatement {
    const condition = parseExpression();
    expect('COLON');
    const consequent: Block = { type: 'Block', body: parseBody() };
    let alternate: Statement | null = null;
    if (matchIdent(ELSE_KW)) {
      if (checkIdent(IF_KW)) {
        const ifTok = cur();
        pos++;
        const inner = parseIfStatement();
        (inner as IfStatement).loc = { line: ifTok.line, col: ifTok.col };
        alternate = inner;
      }
      else {
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
    if (matchIdent(IN_KW)) {
      const iterable = parseExpression();
      expect('COLON');
      const body: Block = { type: 'Block', body: parseBody() };
      expectIdent(END_KW, 'انتهى');
      return { type: 'ForEachStatement', variable, iterable, body };
    }
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
      if (cur().type === 'IDENT' && cur().value === '_') { pos++; }
      else { caseValue = parseExpression(); }
      expect('COLON');
      const body = parseBody();
      cases.push({ value: caseValue, body });
      skipSemis();
    }
    expectIdent(END_KW, 'انتهى');
    return { type: 'MatchStatement', value, cases };
  }
  function parseTryStatement(): TryStatement {
    expect('COLON');
    const tryBlock = parseBody();
    let catchVar: string | null = null;
    let catchBlock: Statement[] | null = null;
    if (matchIdent(CATCH_KW)) {
      // optional variable name before colon
      if (cur().type === 'IDENT') {
        catchVar = expect('IDENT').value;
      }
      expect('COLON');
      catchBlock = parseBody();
    }
    expectIdent(END_KW, 'انتهى');
    return { type: 'TryStatement', tryBlock, catchVar, catchBlock };
  }
  function parseReturnStatement(): ReturnStatement {
    if (isBodyTerminator() || check('SEMICOLON')) {
      return { type: 'ReturnStatement', value: null };
    }
    return { type: 'ReturnStatement', value: parseExpression() };
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
    return { type: 'ExpressionStatement', expression: parseExpression() };
  }

  function parseExpression(): Expression { return parseAssignment(); }
  function parseAssignment(): Expression {
    const left = parseOr();
    if (check('ASSIGN')) { pos++; return { type: 'AssignExpr', target: left, value: parseAssignment() }; }
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
      if (check('DOT')) { pos++; expr = { type: 'MemberExpr', object: expr, property: expect('IDENT').value }; }
      else if (check('LBRACKET')) {
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
    if (t.type === 'TEMPLATE') { pos++; return { type: 'TemplateLiteral', raw: t.value }; }
    if (t.type === 'BOOLEAN') { pos++; return { type: 'BooleanLiteral', value: t.value === 'true' }; }
    if (t.type === 'NULL') { pos++; return { type: 'NullLiteral' }; }
    if (t.type === 'IDENT') {
      // Anonymous function expression: مهمّة(...)
      if (FUNC_KW.has(t.value) && tokens[pos + 1]?.type === 'LPAREN') {
        pos++;
        return parseLambda();
      }
      pos++;
      return { type: 'Identifier', name: t.value };
    }
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
        const key = (cur().type === 'STRING' ? tokens[pos++].value : expect('IDENT').value);
        expect('COLON');
        properties.push({ key, value: parseExpression() });
        while (check('COMMA')) {
          pos++;
          if (check('RBRACE')) break;
          const k = (cur().type === 'STRING' ? tokens[pos++].value : expect('IDENT').value);
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
