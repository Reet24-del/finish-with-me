import { parse } from 'acorn';

// A small, bounded AST interpreter. Submitted source is NEVER eval'd or imported.
// Its only capabilities are primitive arithmetic and the explicit helpers below.
const RETURN = Symbol('return');
const native = (fn) => ({ native: fn });
class Scope {
  constructor(parent) { this.parent = parent; this.values = new Map(); }
  get(key) { if (this.values.has(key)) return this.values.get(key); if (this.parent) return this.parent.get(key); throw Error(`Unknown identifier: ${key}`); }
  set(key, value) { this.values.set(key, value); }
}
export function evaluateTotal(source, input) {
  if (typeof source !== 'string' || source.length > 12000) throw Error('Source must be at most 12,000 characters.');
  const ast = parse(source, {ecmaVersion:2022, sourceType:'module'});
  const body = ast.body.filter(n => n.type !== 'EmptyStatement');
  const declaration = body[0]?.type === 'ExportNamedDeclaration' ? body[0].declaration : body[0];
  if (body.length !== 1 || declaration?.type !== 'FunctionDeclaration' || declaration.id.name !== 'total' || declaration.params.length !== 1 || declaration.params[0].type !== 'Identifier') throw Error('Use one function: export function total(prices) { … }.');
  let budget = 5000;
  const root = new Scope();
  root.set('Number', native(Number)); root.set('String', native(String));
  root.set('Array', { marker:'Array' }); root.set('Error', native(message => Error(String(message))));
  root.set('TypeError', native(message => TypeError(String(message))));
  root.set('undefined', undefined); root.set('NaN', NaN);
  function call(fn, args) {
    if (fn?.native) return fn.native(...args);
    if (!fn?.node) throw Error('Only supported functions may be called.');
    const scope = new Scope(fn.scope);
    if (fn.node.params.some(p => p.type !== 'Identifier')) throw Error('Only simple parameters are supported.');
    fn.node.params.forEach((p, i) => scope.set(p.name, args[i]));
    const result = evaluate(fn.node.body, scope);
    return result?.kind === RETURN ? result.value : fn.node.body.type === 'BlockStatement' ? undefined : result;
  }
  function evaluate(node, scope) {
    if (!node || --budget < 0) throw Error('Execution limit reached.');
    switch (node.type) {
      case 'Literal': if (node.regex || node.bigint) throw Error('Unsupported literal.'); return node.value;
      case 'Identifier': return scope.get(node.name);
      case 'BlockStatement': {
        const local = new Scope(scope);
        for (const item of node.body) { const result = evaluate(item, local); if (result?.kind === RETURN) return result; }
        return undefined;
      }
      case 'ReturnStatement': return {kind:RETURN, value:node.argument ? evaluate(node.argument, scope) : undefined};
      case 'VariableDeclaration':
        for (const d of node.declarations) { if (d.id.type !== 'Identifier') throw Error('Unsupported variable.'); scope.set(d.id.name, evaluate(d.init, scope)); } return;
      case 'ExpressionStatement': return evaluate(node.expression, scope);
      case 'ArrowFunctionExpression': case 'FunctionExpression': return {node, scope};
      case 'IfStatement': return evaluate(node.test, scope) ? evaluate(node.consequent, scope) : node.alternate ? evaluate(node.alternate, scope) : undefined;
      case 'ConditionalExpression': return evaluate(node.test, scope) ? evaluate(node.consequent, scope) : evaluate(node.alternate, scope);
      case 'ThrowStatement': { const error = evaluate(node.argument, scope); throw error instanceof Error ? error : Error(String(error)); }
      case 'ArrayExpression': return node.elements.map(n => evaluate(n, scope));
      case 'UnaryExpression': {
        const value = evaluate(node.argument, scope);
        if (node.operator === '!') return !value; if (node.operator === '-') return -value;
        if (node.operator === '+') return +value; if (node.operator === 'typeof') return typeof value;
        throw Error('Unsupported unary operator.');
      }
      case 'LogicalExpression': {
        const left = evaluate(node.left, scope);
        if (node.operator === '&&') return left && evaluate(node.right, scope);
        if (node.operator === '||') return left || evaluate(node.right, scope);
        if (node.operator === '??') return left ?? evaluate(node.right, scope);
        throw Error('Unsupported logical operator.');
      }
      case 'BinaryExpression': {
        const a = evaluate(node.left, scope), b = evaluate(node.right, scope);
        switch(node.operator) {
          case '+': return a+b; case '-': return a-b; case '*': return a*b; case '/': return a/b;
          case '===': return a===b; case '!==': return a!==b; case '<': return a<b; case '>': return a>b;
          case '<=': return a<=b; case '>=': return a>=b;
          default: throw Error('Unsupported binary operator.');
        }
      }
      case 'MemberExpression': {
        const object = evaluate(node.object, scope);
        const key = node.computed ? evaluate(node.property, scope) : node.property.name;
        if (object === root.get('Number') && key === 'isFinite') return native(Number.isFinite);
        if (object === root.get('Array') && key === 'isArray') return native(Array.isArray);
        if (Array.isArray(object) && key === 'reduce') return native((fn, initial) => {
          if (object.length > 100) throw Error('Input limit reached.');
          return object.reduce((sum, price, index) => call(fn, [sum, price, index]), initial);
        });
        if (typeof object === 'string' && key === 'trim') return native(() => object.trim());
        if ((Array.isArray(object) || typeof object === 'string') && key === 'length') return object.length;
        throw Error(`Unsupported member: ${String(key)}`);
      }
      case 'CallExpression': case 'NewExpression': return call(evaluate(node.callee, scope), node.arguments.map(n => evaluate(n, scope)));
      default: throw Error(`Outside the supported JavaScript subset: ${node.type}`);
    }
  }
  return call({node:declaration, scope:root}, [input]);
}

export const FIXED_TOTAL = `export function total(prices) {
  if (!Array.isArray(prices)) throw new TypeError('Expected an array');
  return prices.reduce((sum, price) => {
    if ((typeof price !== 'number' && typeof price !== 'string') || String(price).trim() === '') {
      throw new TypeError('Invalid price');
    }
    const amount = Number(price);
    if (!Number.isFinite(amount)) throw new TypeError('Invalid price');
    return sum + amount;
  }, 0);
}`;
export const TOTAL_CHECKS = [
  {name:'Numeric strings add to 30', input:['10','20'], expected:30},
  {name:'An empty list returns zero', input:[], expected:0},
  {name:'Numbers and decimals work', input:[10,'2.5',-1], expected:11.5},
  {name:'Nonnumeric prices are rejected', input:['oops'], throws:true},
  {name:'Blank prices are rejected', input:[' '], throws:true},
  {name:'Null prices are rejected', input:[null], throws:true},
  {name:'Infinity is rejected', input:['Infinity'], throws:true},
  {name:'Non-array input is rejected', input:null, throws:true},
];
export function checkTotal(source) {
  return TOTAL_CHECKS.map(test => {
    try {
      const value = evaluateTotal(source, test.input);
      return {name:test.name, passed:!test.throws && typeof value === 'number' && value === test.expected, actual:String(value), expected:test.throws ? 'An input validation error' : String(test.expected)};
    } catch (error) {
      // Unsupported syntax and interpreter limits must never count as validation.
      const passed = Boolean(test.throws && /^(Invalid price|Expected an array)$/.test(error.message));
      return {name:test.name, passed, actual:error.message, expected:test.throws ? 'An input validation error' : String(test.expected)};
    }
  });
}
