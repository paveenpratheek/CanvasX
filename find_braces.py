import sys

def check_braces(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    in_string = False
    in_comment = False
    in_multiline_comment = False
    string_char = ''
    
    stack = []
    lines = content.split('\n')
    
    for line_idx, line in enumerate(lines):
        i = 0
        while i < len(line):
            char = line[i]
            next_char = line[i+1] if i+1 < len(line) else ''
            prev_char = line[i-1] if i > 0 else ''
            
            if not in_comment and not in_multiline_comment and not in_string:
                if char == '/' and next_char == '/':
                    break # Skip rest of line
                elif char == '/' and next_char == '*':
                    in_multiline_comment = True
                    i += 1
                elif char in ('"', "'", '`'):
                    in_string = True
                    string_char = char
                elif char == '{':
                    stack.append(('{', line_idx + 1))
                elif char == '}':
                    if len(stack) > 0 and stack[-1][0] == '{':
                        stack.pop()
                    else:
                        print(f"Error: Unmatched closing brace at line {line_idx + 1}")
            elif in_string:
                if char == string_char and prev_char != '\\':
                    in_string = False
            elif in_multiline_comment:
                if char == '*' and next_char == '/':
                    in_multiline_comment = False
                    i += 1
            i += 1
                
    for brace, line in stack:
        print(f"Unmatched opening {brace} at line {line}")

check_braces('script.js')
