' INSTALAR_MESA_BASE.vbs - ING Estructural (25-11-2026)
' Agrega al clic derecho del Explorador «Usar como carpeta base de la Mesa ING»
' (sobre una carpeta y sobre el fondo de una carpeta abierta). Solo este usuario
' (HKCU), sin administrador. Copia los scripts a %APPDATA%\ING\MesaBase y crea
' Documentos\MesaBase (el puente que se elige UNA vez en la Mesa).
' En Windows 11 la opcion queda en «Mostrar mas opciones» o con Shift + clic derecho.
Set sh = CreateObject("WScript.Shell")
Set fs = CreateObject("Scripting.FileSystemObject")
src = Replace(WScript.ScriptFullName, WScript.ScriptName, "")
dst = sh.ExpandEnvironmentStrings("%APPDATA%") & "\ING"
If Not fs.FolderExists(dst) Then fs.CreateFolder dst
dst = dst & "\MesaBase\"
If Not fs.FolderExists(dst) Then fs.CreateFolder dst
For Each f In Array("MESA_BASE.ps1", "MESA_BASE.vbs", "mesa_base_ing.ico", "DESINSTALAR_MESA_BASE.vbs")
  fs.CopyFile src & f, dst & f, True
Next
puente = sh.SpecialFolders("MyDocuments") & "\MesaBase"
If Not fs.FolderExists(puente) Then fs.CreateFolder puente
cmd = "wscript.exe """ & dst & "MESA_BASE.vbs"" ""%V"""
For Each k In Array("HKCU\Software\Classes\Directory\shell\MesaBaseING\", "HKCU\Software\Classes\Directory\Background\shell\MesaBaseING\")
  sh.RegWrite k, "Usar como carpeta base de la Mesa ING", "REG_SZ"
  sh.RegWrite k & "Icon", dst & "mesa_base_ing.ico", "REG_SZ"
  sh.RegWrite k & "command\", cmd, "REG_SZ"
Next
If WScript.Arguments.Count = 0 Then MsgBox "Listo. Clic derecho sobre una carpeta (en Windows 11: Shift + clic derecho, o «Mostrar mas opciones») > «Usar como carpeta base de la Mesa ING»." & vbCrLf & vbCrLf & "Una sola vez: en la Mesa, «Carpetas de calculos» > «Elegir carpeta base...» > Documentos\MesaBase.", 64, "Mesa ING"
