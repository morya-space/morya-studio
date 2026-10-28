/**
 * 安全表达式引擎（v0.2）
 * 用于 TransformStep 的 filter / map 等场景。
 *
 * 安全约束（见 docs/DESIGN-DEV.md §5.5）：
 * - 不使用 eval / new Function，递归下降解析为 AST 后解释执行。
 * - 字段访问白名单：只能读取数据行的属性（含点路径），禁止访问全局对象。
 * - 禁止标识符黑名单（process / require / global / window / document ...）。
 *
 * 支持语法：
 *   字段:  value | user.name | items[0].id
 *   字面量: 123 | 45.6 | "str" | 'str' | true | false | null
 *   比较:  ==  !=  >  >=  <  <=
 *   逻辑:  &&  ||  !
 *   算术:  +  -  *  /  %
 *   成员:  field in ["a", "b"]
 *   三元:  cond ? a : b
 *   括号:  (expr)
 */

export interface CompileResult {
  ok: boolean
  error?: string
}

type TokenType =
  | 'number'
  | 'string'
  | 'ident'
  | 'op'
  | 'punct'
  | 'eof'

interface Token {
  type: TokenType
  value: string
  pos: number
}

const KEYWORDS = new Set(['true', 'false', 'null', 'in', 'and', 'or', 'not'])

/** 危险标识符黑名单 —— 一律拒绝 */
const FORBIDDEN = new Set([
  'process', 'require', 'global', 'globalThis', 'window', 'document',
  'module', 'exports', 'eval', 'Function', 'constructor', 'prototype',
  '__proto__', 'this', 'new', 'delete', 'typeof', 'instanceof',
  'import', 'fetch', 'XMLHttpRequest', 'localStorage', 'sessionStorage',
])

/** 允许调用的安全函数白名单（无全局副作用、纯计算） */
const ALLOWED_FUNCS = new Set(['String', 'Number', 'includes', 'startsWith', 'endsWith', 'lower', 'upper', 'len'])

class ParseError extends Error {}

// ---------------- Lexer ----------------

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const len = input.length

  const isDigit = (c: string) => c >= '0' && c <= '9'
  // 标识符支持 Unicode 字母（中文字段名等，如 `城市 == "北京"`）；
  // 安全约束不变：完整单词仍须过 FORBIDDEN 黑名单，字段访问仅限数据行属性。
  const isIdentStart = (c: string) => /[\p{L}\p{Nl}_$]/u.test(c)
  const isIdentPart = (c: string) => /[\p{L}\p{Nl}\p{Nd}\p{Mn}\p{Mc}_$]/u.test(c)

  while (i < len) {
    const c = input[i]

    // 空白
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue }

    // 数字（含小数）
    if (isDigit(c) || (c === '.' && isDigit(input[i + 1] ?? ''))) {
      let j = i
      let seenDot = false
      while (j < len) {
        const ch = input[j]
        if (isDigit(ch)) { j++; continue }
        if (ch === '.' && !seenDot) { seenDot = true; j++; continue }
        break
      }
      tokens.push({ type: 'number', value: input.slice(i, j), pos: i })
      i = j
      continue
    }

    // 字符串
    if (c === '"' || c === "'") {
      const quote = c
      let j = i + 1
      let str = ''
      while (j < len && input[j] !== quote) {
        if (input[j] === '\\') {
          const next = input[j + 1]
          if (next === 'n') str += '\n'
          else if (next === 't') str += '\t'
          else str += next ?? ''
          j += 2
        } else {
          str += input[j]
          j++
        }
      }
      if (j >= len) throw new ParseError(`Unterminated string at ${i}`)
      tokens.push({ type: 'string', value: str, pos: i })
      i = j + 1
      continue
    }

    // 标识符 / 关键字
    if (isIdentStart(c)) {
      let j = i
      while (j < len && isIdentPart(input[j])) j++
      const word = input.slice(i, j)
      if (FORBIDDEN.has(word)) {
        throw new ParseError(`Forbidden identifier: "${word}"`)
      }
      if (word === 'and') tokens.push({ type: 'op', value: '&&', pos: i })
      else if (word === 'or') tokens.push({ type: 'op', value: '||', pos: i })
      else if (word === 'not') tokens.push({ type: 'op', value: '!', pos: i })
      else if (KEYWORDS.has(word)) tokens.push({ type: 'op', value: word, pos: i })
      else tokens.push({ type: 'ident', value: word, pos: i })
      i = j
      continue
    }

    // 双字符运算符
    const two = input.slice(i, i + 2)
    if (['==', '!=', '>=', '<=', '&&', '||'].includes(two)) {
      tokens.push({ type: 'op', value: two, pos: i })
      i += 2
      continue
    }

    // 单字符运算符 / 标点
    if (['>', '<', '+', '-', '*', '/', '%', '!'].includes(c)) {
      tokens.push({ type: 'op', value: c, pos: i })
      i++
      continue
    }
    if (['(', ')', '[', ']', ',', '?', ':', '.'].includes(c)) {
      tokens.push({ type: 'punct', value: c, pos: i })
      i++
      continue
    }

    throw new ParseError(`Unexpected character "${c}" at ${i}`)
  }

  tokens.push({ type: 'eof', value: '', pos: len })
  return tokens
}

// ---------------- Parser (recursive descent) ----------------

type AstNode =
  | { kind: 'literal'; value: unknown }
  | { kind: 'path'; parts: (string | number)[] }
  | { kind: 'array'; items: AstNode[] }
  | { kind: 'unary'; op: string; operand: AstNode }
  | { kind: 'binary'; op: string; left: AstNode; right: AstNode }
  | { kind: 'in'; item: AstNode; list: AstNode }
  | { kind: 'call'; name: string; args: AstNode[] }
  | { kind: 'ternary'; cond: AstNode; then: AstNode; else: AstNode }

class Parser {
  private tokens: Token[]
  private pos = 0

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  private peek(): Token { return this.tokens[this.pos] }
  private next(): Token { return this.tokens[this.pos++] }
  private expectOp(value: string): void {
    const t = this.next()
    if (t.value !== value) throw new ParseError(`Expected "${value}" but got "${t.value}" at ${t.pos}`)
  }
  /** 仅匹配运算符/标点 token；同值的字符串字面量（如 "!"）不算 */
  private isOp(value: string): boolean {
    const t = this.peek()
    return (t.type === 'op' || t.type === 'punct') && t.value === value
  }

  parse(): AstNode {
    const node = this.parseTernary()
    const t = this.peek()
    if (t.type !== 'eof') throw new ParseError(`Unexpected token "${t.value}" at ${t.pos}`)
    return node
  }

  private parseTernary(): AstNode {
    const cond = this.parseOr()
    if (this.isOp('?')) {
      this.next()
      const then = this.parseTernary()
      this.expectOp(':')
      const elseN = this.parseTernary()
      return { kind: 'ternary', cond, then, else: elseN }
    }
    return cond
  }

  private parseOr(): AstNode {
    let left = this.parseAnd()
    while (this.isOp('||')) {
      this.next()
      const right = this.parseAnd()
      left = { kind: 'binary', op: '||', left, right }
    }
    return left
  }

  private parseAnd(): AstNode {
    let left = this.parseComparison()
    while (this.isOp('&&')) {
      this.next()
      const right = this.parseComparison()
      left = { kind: 'binary', op: '&&', left, right }
    }
    return left
  }

  private parseComparison(): AstNode {
    let left = this.parseAdditive()
    const ops = ['==', '!=', '>', '>=', '<', '<=', 'in']
    while (ops.includes(this.peek().value)) {
      const op = this.next().value
      const right = this.parseAdditive()
      if (op === 'in') {
        left = { kind: 'in', item: left, list: right }
      } else {
        left = { kind: 'binary', op, left, right }
      }
    }
    return left
  }

  private parseAdditive(): AstNode {
    let left = this.parseMultiplicative()
    while (this.isOp('+') || this.isOp('-')) {
      const op = this.next().value
      const right = this.parseMultiplicative()
      left = { kind: 'binary', op, left, right }
    }
    return left
  }

  private parseMultiplicative(): AstNode {
    let left = this.parseUnary()
    while (this.isOp('*') || this.isOp('/') || this.isOp('%')) {
      const op = this.next().value
      const right = this.parseUnary()
      left = { kind: 'binary', op, left, right }
    }
    return left
  }

  private parseUnary(): AstNode {
    if (this.isOp('!')) {
      this.next()
      return { kind: 'unary', op: '!', operand: this.parseUnary() }
    }
    if (this.isOp('-')) {
      this.next()
      return { kind: 'unary', op: '-', operand: this.parseUnary() }
    }
    return this.parsePostfix()
  }

  /** primary 后的 .prop 与 [index] 链 */
  private parsePostfix(): AstNode {
    const base = this.parsePrimary()

    // 仅当 base 是字段路径起始（ident）时才允许继续拼接为 path
    if (base.kind === 'path') {
      const parts = [...base.parts]
      let extended = true
      while (extended) {
        extended = false
        if (this.isOp('.')) {
          this.next()
          const t = this.next()
          if (t.type !== 'ident') throw new ParseError(`Expected property after "." at ${t.pos}`)
          parts.push(t.value)
          extended = true
        } else if (this.isOp('[')) {
          this.next()
          const t = this.next()
          if (t.type === 'number') {
            parts.push(Number(t.value))
          } else if (t.type === 'string') {
            parts.push(t.value)
          } else {
            throw new ParseError(`Expected number or string index at ${t.pos}`)
          }
          this.expectOp(']')
          extended = true
        }
      }
      return { kind: 'path', parts }
    }
    return base
  }

  private parsePrimary(): AstNode {
    const t = this.next()

    if (t.type === 'number') return { kind: 'literal', value: Number(t.value) }
    if (t.type === 'string') return { kind: 'literal', value: t.value }

    if (t.type === 'op') {
      if (t.value === 'true') return { kind: 'literal', value: true }
      if (t.value === 'false') return { kind: 'literal', value: false }
      if (t.value === 'null') return { kind: 'literal', value: null }
    }

    if (t.type === 'ident') {
      // 函数调用：仅白名单函数可调用（安全约束）
      if (this.isOp('(')) {
        if (!ALLOWED_FUNCS.has(t.value)) {
          throw new ParseError(`Function "${t.value}" is not allowed`)
        }
        this.next() // consume '('
        const args: AstNode[] = []
        if (!this.isOp(')')) {
          args.push(this.parseTernary())
          while (this.isOp(',')) {
            this.next()
            args.push(this.parseTernary())
          }
        }
        this.expectOp(')')
        return { kind: 'call', name: t.value, args }
      }
      return { kind: 'path', parts: [t.value] }
    }

    if (t.value === '(') {
      const node = this.parseTernary()
      this.expectOp(')')
      return node
    }

    if (t.value === '[') {
      const items: AstNode[] = []
      if (!this.isOp(']')) {
        items.push(this.parseTernary())
        while (this.isOp(',')) {
          this.next()
          items.push(this.parseTernary())
        }
      }
      this.expectOp(']')
      return { kind: 'array', items }
    }

    throw new ParseError(`Unexpected token "${t.value}" at ${t.pos}`)
  }
}

// ---------------- Evaluator ----------------

function getPathValue(row: Record<string, unknown>, parts: (string | number)[]): unknown {
  let cur: unknown = row
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined
    if (typeof part === 'number') {
      if (!Array.isArray(cur)) return undefined
      cur = cur[part]
    } else {
      if (typeof cur !== 'object') return undefined
      cur = (cur as Record<string, unknown>)[part]
    }
  }
  return cur
}

function evaluate(node: AstNode, row: Record<string, unknown>): unknown {
  switch (node.kind) {
    case 'literal':
      return node.value
    case 'path':
      return getPathValue(row, node.parts)
    case 'array':
      return node.items.map(item => evaluate(item, row))
    case 'unary': {
      const v = evaluate(node.operand, row)
      if (node.op === '!') return !truthy(v)
      if (node.op === '-') return -toNumber(v)
      return undefined
    }
    case 'binary':
      return evalBinary(node.op, node.left, node.right, row)
    case 'in': {
      const item = evaluate(node.item, row)
      const list = evaluate(node.list, row)
      if (!Array.isArray(list)) return false
      return list.some(el => looseEqual(el, item))
    }
    case 'call': {
      const args = node.args.map(a => evaluate(a, row))
      return evalCall(node.name, args)
    }
    case 'ternary':
      return truthy(evaluate(node.cond, row))
        ? evaluate(node.then, row)
        : evaluate(node.else, row)
  }
}

function evalBinary(op: string, leftNode: AstNode, rightNode: AstNode, row: Record<string, unknown>): unknown {
  // 逻辑短路
  if (op === '&&') {
    const l = evaluate(leftNode, row)
    return truthy(l) ? evaluate(rightNode, row) : l
  }
  if (op === '||') {
    const l = evaluate(leftNode, row)
    return truthy(l) ? l : evaluate(rightNode, row)
  }

  const l = evaluate(leftNode, row)
  const r = evaluate(rightNode, row)

  switch (op) {
    case '==': return looseEqual(l, r)
    case '!=': return !looseEqual(l, r)
    case '>': return toNumber(l) > toNumber(r)
    case '>=': return toNumber(l) >= toNumber(r)
    case '<': return toNumber(l) < toNumber(r)
    case '<=': return toNumber(l) <= toNumber(r)
    case '+':
      // 任一字符串则拼接，否则数值相加
      if (typeof l === 'string' || typeof r === 'string') return String(l ?? '') + String(r ?? '')
      return toNumber(l) + toNumber(r)
    case '-': return toNumber(l) - toNumber(r)
    case '*': return toNumber(l) * toNumber(r)
    case '/': return toNumber(l) / toNumber(r)
    case '%': return toNumber(l) % toNumber(r)
    default: return undefined
  }
}

function truthy(v: unknown): boolean { return Boolean(v) }
function toNumber(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  const n = Number(v)
  return Number.isNaN(n) ? 0 : n
}

/** 白名单函数求值 */
function evalCall(name: string, args: unknown[]): unknown {
  const a0 = args[0]
  switch (name) {
    case 'String': return a0 === null || a0 === undefined ? '' : String(a0)
    case 'Number': return toNumber(a0)
    case 'includes': return String(a0 ?? '').includes(String(args[1] ?? ''))
    case 'startsWith': return String(a0 ?? '').startsWith(String(args[1] ?? ''))
    case 'endsWith': return String(a0 ?? '').endsWith(String(args[1] ?? ''))
    case 'lower': return String(a0 ?? '').toLowerCase()
    case 'upper': return String(a0 ?? '').toUpperCase()
    case 'len': return Array.isArray(a0) || typeof a0 === 'string' ? a0.length : 0
    default: return undefined
  }
}
function looseEqual(a: unknown, b: unknown): boolean {
  // eslint-disable-next-line eqeqeq
  return a == b
}

// ---------------- Public API ----------------

/**
 * 编译表达式为可执行函数。
 * 表达式语法非法或含危险标识符时抛错（用 validateExpr 预检可避免）。
 */
export function compileExpr(expr: string): (row: Record<string, unknown>) => unknown {
  const tokens = tokenize(expr)
  const ast = new Parser(tokens).parse()
  return (row: Record<string, unknown>) => evaluate(ast, row)
}

/** 预检表达式是否合法（不执行） */
export function validateExpr(expr: string): CompileResult {
  if (typeof expr !== 'string' || expr.trim() === '') {
    return { ok: false, error: 'Expression is empty' }
  }
  try {
    const tokens = tokenize(expr)
    new Parser(tokens).parse()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
