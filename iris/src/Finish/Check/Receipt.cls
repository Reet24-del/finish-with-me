Class Finish.Check.Receipt Extends %RegisteredObject
{
/// Interpret only a bounded JavaScript AST. Never eval, exec, import or run submitted code.
ClassMethod Run(astJSON As %String) As %String [ Language = python ]
{
    import json, math, functools, hashlib
    data = json.loads(astJSON)
    body = [n for n in data.get('body', []) if n.get('type') != 'EmptyStatement']
    node = body[0].get('declaration') if len(body) == 1 and body[0].get('type') == 'ExportNamedDeclaration' else (body[0] if len(body) == 1 else {})
    if not node or node.get('type') != 'FunctionDeclaration' or node.get('id', {}).get('name') != 'total' or len(node.get('params', [])) != 1 or node['params'][0].get('type') != 'Identifier':
        raise ValueError('Use one total(prices) function')
    class Unsupported(Exception): pass
    class UserError(Exception): pass
    class ReturnValue:
        def __init__(self, value): self.value = value
    undefined = object()
    def kind(x):
        if x is undefined: return 'undefined'
        if type(x) is bool: return 'boolean'
        if type(x) in (int, float): return 'number'
        if type(x) is str: return 'string'
        if callable(x): return 'function'
        return 'object'
    def string(x):
        if x is undefined: return 'undefined'
        if x is None: return 'null'
        if type(x) is bool: return 'true' if x else 'false'
        if type(x) in (float, int): return str(int(x)) if math.isfinite(x) and x == int(x) else str(x)
        return str(x)
    def number(x):
        if x is None: return 0
        if x is undefined: return math.nan
        if type(x) in (bool, int, float): return float(x)
        if type(x) is str:
            try: return float(x.strip()) if x.strip() else 0
            except ValueError: return math.nan
        return math.nan
    def truth(x):
        return False if x is undefined or x is None else (x != 0 and not math.isnan(x) if type(x) in (int,float) else bool(x) if type(x) in (str,bool) else True)
    def strict(a,b):
        return kind(a) == kind(b) and (a == b if kind(a) != 'object' else a is b)
    def finite(x): return type(x) in (int,float) and math.isfinite(x)
    def evaluate(value):
        budget = [5000]
        root = {'Number':number, 'String':string, 'Array':'__array_marker__', 'Error':lambda x:UserError(string(x)), 'TypeError':lambda x:UserError(string(x)), 'undefined':undefined, 'NaN':math.nan}
        def read(scope,name):
            for level in scope:
                if name in level: return level[name]
            raise Unsupported('Unknown identifier: '+name)
        def call(fn,args):
            if not callable(fn): raise Unsupported('Only supported calls are allowed')
            return fn(*args)
        def closure(n,scope):
            params=n.get('params',[])
            if any(p.get('type')!='Identifier' for p in params): raise Unsupported('Only simple parameters are allowed')
            def execute(*args):
                local={p['name']:(args[i] if i<len(args) else undefined) for i,p in enumerate(params)}
                result=walk(n['body'],[local]+scope)
                return result.value if isinstance(result,ReturnValue) else undefined if n['body']['type']=='BlockStatement' else result
            return execute
        def walk(n,scope):
            budget[0]-=1
            if budget[0]<0 or not n: raise Unsupported('Execution limit reached')
            t=n['type']
            if t=='Literal':
                if 'regex' in n or 'bigint' in n: raise Unsupported('Unsupported literal')
                return n.get('value')
            if t=='Identifier': return read(scope,n['name'])
            if t=='BlockStatement':
                local=[{}]+scope
                for item in n['body']:
                    result=walk(item,local)
                    if isinstance(result,ReturnValue): return result
                return undefined
            if t=='ReturnStatement': return ReturnValue(walk(n['argument'],scope) if n.get('argument') else undefined)
            if t=='VariableDeclaration':
                for item in n['declarations']:
                    if item['id']['type']!='Identifier': raise Unsupported('Unsupported variable')
                    scope[0][item['id']['name']]=walk(item['init'],scope)
                return undefined
            if t=='ExpressionStatement': return walk(n['expression'],scope)
            if t in ('ArrowFunctionExpression','FunctionExpression'): return closure(n,scope)
            if t in ('IfStatement','ConditionalExpression'):
                branch=n.get('consequent') if truth(walk(n['test'],scope)) else n.get('alternate')
                return walk(branch,scope) if branch else undefined
            if t=='ThrowStatement':
                error=walk(n['argument'],scope)
                raise error if isinstance(error,UserError) else UserError(string(error))
            if t=='ArrayExpression': return [walk(v,scope) for v in n['elements']]
            if t=='UnaryExpression':
                x=walk(n['argument'],scope);op=n['operator']
                if op=='!': return not truth(x)
                if op=='typeof': return kind(x)
                if op=='-': return -number(x)
                if op=='+': return number(x)
                raise Unsupported('Unsupported unary operator')
            if t=='LogicalExpression':
                x=walk(n['left'],scope);op=n['operator']
                if op=='&&': return walk(n['right'],scope) if truth(x) else x
                if op=='||': return x if truth(x) else walk(n['right'],scope)
                if op=='??': return walk(n['right'],scope) if x is None or x is undefined else x
                raise Unsupported('Unsupported logical operator')
            if t=='BinaryExpression':
                a=walk(n['left'],scope);b=walk(n['right'],scope);op=n['operator']
                if op=='+': return string(a)+string(b) if type(a) is str or type(b) is str else number(a)+number(b)
                if op=='-': return number(a)-number(b)
                if op=='*': return number(a)*number(b)
                if op=='/': return number(a)/number(b) if number(b)!=0 else math.nan
                if op=='===': return strict(a,b)
                if op=='!==': return not strict(a,b)
                if op=='<': return a<b
                if op=='>': return a>b
                if op=='<=': return a<=b
                if op=='>=': return a>=b
                raise Unsupported('Unsupported binary operator')
            if t=='MemberExpression':
                obj=walk(n['object'],scope);key=walk(n['property'],scope) if n.get('computed') else n['property']['name']
                if obj is number and key=='isFinite': return finite
                if type(obj) is str and obj=='__array_marker__' and key=='isArray': return lambda x:type(x) is list
                if type(obj) is list and key=='reduce':
                    if len(obj)>100: raise Unsupported('Input limit reached')
                    return lambda fn,initial:functools.reduce(lambda acc,item:call(fn,[acc,item[1],item[0]]),enumerate(obj),initial)
                if type(obj) is str and key=='trim': return lambda:obj.strip()
                if type(obj) in (str,list) and key=='length': return len(obj)
                raise Unsupported('Unsupported member')
            if t in ('CallExpression','NewExpression'): return call(walk(n['callee'],scope),[walk(v,scope) for v in n['arguments']])
            raise Unsupported('Outside the supported JavaScript subset: '+t)
        return closure(node,[root])(value)
    cases=[('Numeric strings add to 30',['10','20'],30,False),('An empty list returns zero',[],0,False),('Numbers and decimals work',[10,'2.5',-1],11.5,False),('Nonnumeric prices are rejected',['oops'],None,True),('Blank prices are rejected',[' '],None,True),('Null prices are rejected',[None],None,True),('Infinity is rejected',['Infinity'],None,True),('Non-array input is rejected',None,None,True)]
    checks=[]
    for name,value,expected,throws in cases:
        try:
            actual=evaluate(value);passed=not throws and kind(actual)=='number' and actual==expected;display=string(actual)
        except UserError as error: passed=throws;display=str(error)
        except Exception as error: passed=False;display=str(error)
        checks.append({'name':name,'passed':passed,'actual':display,'expected':'An input validation error' if throws else string(expected)})
    return json.dumps({'provider':'InterSystems Embedded Python','astHash':hashlib.sha256(astJSON.encode()).hexdigest(),'checks':checks})
}
}
