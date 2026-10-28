import sys

def check_braces(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We should ignore strings and comments, but let's do a simple count first
    braces = 0
    
    in_string = False
    in_comment = False
    in_multiline_comment = False
    string_char = ''
    
    for i in range(len(content)):
        char = content[i]
        next_char = content[i+1] if i+1 < len(content) else ''
        prev_char = content[i-1] if i > 0 else ''
        
        if not in_comment and not in_multiline_comment and not in_string:
            if char == '/' and next_char == '/':
                in_comment = True
            elif char == '/' and next_char == '*':
                in_multiline_comment = True
            elif char in ('"', "'", '`'):
                in_string = True
                string_char = char
            elif char == '{':
                braces += 1
            elif char == '}':
                braces -= 1
        elif in_string:
            if char == string_char and prev_char != '\\':
                in_string = False
        elif in_comment:
            if char == '\n':
                in_comment = False
        elif in_multiline_comment:
            if char == '*' and next_char == '/':
                in_multiline_comment = False
                
    print(f"Final counts - Braces: {braces}")

check_braces('script.js')
