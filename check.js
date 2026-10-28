var fso = new ActiveXObject('Scripting.FileSystemObject');
var f = fso.OpenTextFile('script.js', 1);
var code = f.ReadAll();
f.Close();
try {
  eval(code);
  WScript.Echo('Syntax OK');
} catch(e) {
  WScript.Echo('Error: ' + e.message + ' at line ' + (e.line || 'unknown'));
}
