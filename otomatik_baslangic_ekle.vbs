Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

scriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
targetPath = scriptDir & "\baslat_arka_plan.vbs"

startupFolder = WshShell.SpecialFolders("Startup")
shortcutPath = startupFolder & "\DiscordBotBaslatici.lnk"

Set shortcut = WshShell.CreateShortcut(shortcutPath)
shortcut.TargetPath = targetPath
shortcut.WorkingDirectory = scriptDir
shortcut.Description = "Discord Bot Arka Plan Baslaticisi"
shortcut.Save

MsgBox "Bot basariyla Windows Baslangicina (Startup) eklendi!" & vbCrLf & _
       "Bilgisayariniz her acildiginda bot otomatik olarak arka planda baslayacaktir.", 64, "Baslangica Eklendi"
