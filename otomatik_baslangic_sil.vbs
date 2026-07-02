Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

startupFolder = WshShell.SpecialFolders("Startup")
shortcutPath = startupFolder & "\DiscordBotBaslatici.lnk"

If FSO.FileExists(shortcutPath) Then
    FSO.DeleteFile(shortcutPath)
    MsgBox "Bot Windows Baslangicindan (Startup) kaldirildi.", 64, "Baslangictan Kaldirildi"
Else
    MsgBox "Windows Baslangicinda bot kisayolu bulunamadi.", 48, "Bulunamadi"
End If
