import os

def restore_script():
    with open('script.js.fixed6', 'r', encoding='utf-8') as f:
        fixed_lines = f.readlines()
        
    with open('script.js', 'r', encoding='utf-8') as f:
        script_lines = f.readlines()
        
    # We want to extract lines 1779 (index) to 2883 (index) from fixed_lines
    # Note: line 1780 is index 1779. Let's find exactly the indices.
    
    start_fixed = -1
    for i, line in enumerate(fixed_lines):
        if "type: 'path'," in line and "color: state.areaColor," in fixed_lines[i+1]:
            start_fixed = i + 1
            break
            
    end_fixed = -1
    for i, line in enumerate(fixed_lines):
        if "if (fileData.isYoutube && fileData.youtubeUrl) {" in line:
            end_fixed = i
            break
            
    print(f"Fixed: Start={start_fixed}, End={end_fixed}")
    
    start_script = -1
    for i, line in enumerate(script_lines):
        if "type: 'path'," in line and i > 1500:
            if "if (state.mode === 'draw') {" in script_lines[i+2]:
                start_script = i + 1
                break
                
    end_script = -1
    for i, line in enumerate(script_lines):
        if "if (fileData.isYoutube && fileData.youtubeUrl) {" in line:
            end_script = i
            break
            
    print(f"Script: Start={start_script}, End={end_script}")
    
    if start_fixed != -1 and end_fixed != -1 and start_script != -1 and end_script != -1:
        new_script = script_lines[:start_script] + fixed_lines[start_fixed:end_fixed] + script_lines[end_script:]
        with open('script.js.restored', 'w', encoding='utf-8') as f:
            f.writelines(new_script)
        print("Successfully created script.js.restored!")
    else:
        print("Could not find boundaries.")

if __name__ == "__main__":
    restore_script()
