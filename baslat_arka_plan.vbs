Set UAC = CreateObject("Shell.Application")
Set FSO = CreateObject("Scripting.FileSystemObject")
scriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)

' Run start_hidden.bat with Administrator privileges in a completely hidden window (0)
UAC.ShellExecute "cmd.exe", "/c """ & scriptDir & "\start_hidden.bat""", "", "runas", 0
