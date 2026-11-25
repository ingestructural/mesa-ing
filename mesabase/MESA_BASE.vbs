' MESA_BASE.vbs - clic derecho «Usar como carpeta base de la Mesa ING»: corre MESA_BASE.ps1 sin ventana
Set sh = CreateObject("WScript.Shell")
d = Replace(WScript.ScriptFullName, WScript.ScriptName, "")
If WScript.Arguments.Count = 0 Then WScript.Quit
c = WScript.Arguments(0)
sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & d & "MESA_BASE.ps1"" -Carpeta """ & c & """", 0, False
