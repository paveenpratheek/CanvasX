import re

def get_depths(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        text = f.read()
    
    text = re.sub(r'//.*', '', text)
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
    text = re.sub(r'"(?:\\.|[^\\"])*"', '', text)
    text = re.sub(r"'(?:\\.|[^\\'])*'", '', text)
    text = re.sub(r"`(?:\\.|[^\\`])*`", '', text)
    
    depth = 0
    lines = text.split('\n')
    for i, line in enumerate(lines):
        for c in line:
            if c == '{': depth += 1
            elif c == '}': depth -= 1
        if depth < 0:
            print(f"Negative depth at line {i+1} in {filename}!")
            return i+1
    return depth

d1 = get_depths('script.js.fixed6')
d2 = get_depths('script.js')
print(f'fixed6 final depth: {d1}, script.js final depth: {d2}')
