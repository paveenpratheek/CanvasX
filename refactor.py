import re

with open('script.js', 'r', encoding='utf-8') as f:
    code = f.read()

start_idx = code.find('function setupWorkspaceListeners()')
brace_start = code.find('{', start_idx)

count = 1
i = brace_start + 1
while count > 0 and i < len(code):
    if code[i] == '{': count += 1
    elif code[i] == '}': count -= 1
    i += 1

func_body = code[brace_start+1:i-1]
func_end = i

# Parse the components out of func_body
def get_listener(event):
    pattern = f"workspace.addEventListener('{event}', "
    idx = func_body.find(pattern)
    if idx == -1: return None
    
    # find ending
    paren_idx = func_body.find('(', idx)
    paren_count = 1
    j = paren_idx + 1
    while paren_count > 0 and j < len(func_body):
        if func_body[j] == '(': paren_count += 1
        elif func_body[j] == ')': paren_count -= 1
        j += 1
        
    # Check if there is { passive: false } after parenthesis
    rest = func_body[j:j+50]
    if rest.startswith(', { passive: false }'):
        j = j + len(', { passive: false }')
        # consume ')'
        if func_body[j] == ')':
            j += 1
    
    if func_body[j] == ';':
        j += 1
        
    return func_body[idx:j]

wheel_listener = get_listener('wheel')
ctx_listener = get_listener('contextmenu')
dblclick_listener = get_listener('dblclick')
down_listener = get_listener('pointerdown')
move_listener = get_listener('pointermove')

# For pointerup etc, they use endInteraction
end_interaction_idx = func_body.find('const endInteraction = ')
end_interaction_paren = func_body.find('{', end_interaction_idx)
c = 1
k = end_interaction_paren + 1
while c > 0 and k < len(func_body):
    if func_body[k] == '{': c += 1
    elif func_body[k] == '}': c -= 1
    k += 1
    
if k < len(func_body) and func_body[k] == ';':
    k += 1

end_interaction_code = func_body[end_interaction_idx:k]


# Construct the new code
new_setup = """function setupWorkspaceListeners() {
    workspace.addEventListener('wheel', handleWorkspaceWheel, { passive: false });
    workspace.addEventListener('contextmenu', handleWorkspaceContextMenu);
    workspace.addEventListener('dblclick', handleWorkspaceDoubleClick);
    workspace.addEventListener('pointerdown', handleWorkspacePointerDown);
    workspace.addEventListener('pointermove', handleWorkspacePointerMove);
    workspace.addEventListener('pointerup', handleWorkspacePointerUp);
    workspace.addEventListener('pointercancel', handleWorkspacePointerUp);
    workspace.addEventListener('pointerleave', handleWorkspacePointerUp);
}"""

# Convert listeners to named functions
def to_named(listener_str, name):
    if not listener_str: return ""
    s = listener_str.find('{')
    e = listener_str.rfind('}')
    body = listener_str[s+1:e]
    return f"function {name}(e) {{{body}}}"

wheel_func = to_named(wheel_listener, 'handleWorkspaceWheel')
ctx_func = to_named(ctx_listener, 'handleWorkspaceContextMenu')
dblclick_func = to_named(dblclick_listener, 'handleWorkspaceDoubleClick')
down_func = to_named(down_listener, 'handleWorkspacePointerDown')
move_func = to_named(move_listener, 'handleWorkspacePointerMove')

ei_s = end_interaction_code.find('{')
ei_e = end_interaction_code.rfind('}')
ei_body = end_interaction_code[ei_s+1:ei_e]
up_func = f"function handleWorkspacePointerUp(e) {{{ei_body}}}"

all_new_funcs = f"""{new_setup}

{wheel_func}

{ctx_func}

{dblclick_func}

{down_func}

{move_func}

{up_func}
"""

new_code = code[:start_idx] + all_new_funcs + code[func_end:]
with open('script.js', 'w', encoding='utf-8') as f:
    f.write(new_code)
print("Successfully refactored setupWorkspaceListeners!")
