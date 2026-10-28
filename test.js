try { eval(new ActiveXObject(" Scripting.FileSystemObject\).OpenTextFile(\script.js\, 1).ReadAll()); WScript.Echo(\OK\); } catch(e) { WScript.Echo(e.name + \: \ + e.message + " on line \ + e.line); }
