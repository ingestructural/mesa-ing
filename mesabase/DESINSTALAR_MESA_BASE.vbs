' DESINSTALAR_MESA_BASE.vbs - quita del clic derecho «Usar como carpeta base de la Mesa ING».
' No borra Documentos\MesaBase (puede borrarla a mano: solo contiene un enlace y _mesa_base.json).
Set sh = CreateObject("WScript.Shell")
On Error Resume Next
For Each k In Array("HKCU\Software\Classes\Directory\shell\MesaBaseING\", "HKCU\Software\Classes\Directory\Background\shell\MesaBaseING\")
  sh.RegDelete k & "command\"
  sh.RegDelete k
Next
On Error GoTo 0
If WScript.Arguments.Count = 0 Then MsgBox "Listo: se quito la opcion del clic derecho.", 64, "Mesa ING"
