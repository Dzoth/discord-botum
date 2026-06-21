import os
import re
import datetime
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
import discord
from discord.ext import commands
from dotenv import load_dotenv

# Environment dosyasını yükle
load_dotenv()
TOKEN = os.getenv("DISCORD_TOKEN")

# Bot Yapılandırması ve İzinler
intents = discord.Intents.all()
bot = commands.Bot(command_prefix=".", intents=intents)

# Kayıt Rol ID Tanımlamaları
ROLE_ERKEK_ID = 1516983424059965703
ROLE_KIZ_ID = 1516983384079859712

# Render Canlılık Kontrolü (Web Server)
class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(b"Bot aktif ve calisiyor!")

    def log_message(self, format, *args):
        # Render loglarını kirletmemek için konsol loglarını gizle
        return

def run_web_server():
    port = int(os.getenv("PORT", 10000))
    server = HTTPServer(("0.0.0.0", port), HealthCheckHandler)
    server.serve_forever()

def resolve_user_id(arg: str) -> int | None:
    """Kullanıcı etiketini veya sayısal ID'yi tamsayı ID olarak çözümler."""
    if not arg:
        return None
    cleaned = re.sub(r"[<@!>]", "", arg)
    if cleaned.isdigit() and 17 <= len(cleaned) <= 20:
        return int(cleaned)
    return None

def parse_duration(duration_str: str) -> datetime.timedelta | None:
    """Süre dizesini (örn: 10m, 1h, 2d) timedelta nesnesine dönüştürür."""
    if not duration_str:
        return None
    match = re.match(r"^(\d+)([smhd])$", duration_str.lower().strip())
    if not match:
        return None
    value, unit = match.groups()
    value = int(value)
    
    if unit == "s":
        return datetime.timedelta(seconds=value)
    elif unit == "m":
        return datetime.timedelta(minutes=value)
    elif unit == "h":
        return datetime.timedelta(hours=value)
    elif unit == "d":
        return datetime.timedelta(days=value)
    return None

@bot.event
async def on_ready():
    print(f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [System] Bot ready as {bot.user}. Guilds: {len(bot.guilds)}")

# --- BAN KOMUTU ---
@bot.command(name="ban")
@commands.has_permissions(ban_members=True)
async def ban_command(ctx, target: str = None, *, reason: str = "Belirtilmedi"):
    if not target:
        await ctx.reply("⚠️ Lütfen yasaklamak istediğiniz kullanıcıyı etiketleyin veya ID'sini girin. Örnek: `.ban @kullanıcı [sebep]`")
        return
    
    user_id = resolve_user_id(target)
    if not user_id:
        await ctx.reply("❌ Geçersiz kullanıcı formatı. Lütfen geçerli bir etiket veya ID girin.")
        return
    
    try:
        user = await bot.fetch_user(user_id)
        try:
            await user.send(f"⚠️ **{ctx.guild.name}** sunucusundan yasaklandınız.\n📝 **Sebep:** {reason}")
        except discord.Forbidden:
            pass
        
        await ctx.guild.ban(discord.Object(id=user_id), reason=f"Yetkili: {ctx.author} | Sebep: {reason}")
        await ctx.reply(f"✅ <@{user_id}> (ID: {user_id}) başarıyla sunucudan yasaklandı.")
    except discord.Forbidden:
        await ctx.reply("❌ Bu kullanıcıyı yasaklamak için yetkim yetersiz.")
    except Exception as e:
        print(f"Ban Hatası: {e}")
        await ctx.reply("❌ Kullanıcı yasaklanırken bir hata oluştu.")

# --- KICK KOMUTU ---
@bot.command(name="kick")
@commands.has_permissions(kick_members=True)
async def kick_command(ctx, target: str = None, *, reason: str = "Belirtilmedi"):
    if not target:
        await ctx.reply("⚠️ Lütfen atmak istediğiniz kullanıcıyı etiketleyin veya ID'sini girin. Örnek: `.kick @kullanıcı [sebep]`")
        return
    
    user_id = resolve_user_id(target)
    if not user_id:
        await ctx.reply("❌ Geçersiz kullanıcı formatı. Lütfen geçerli bir etiket veya ID girin.")
        return
    
    try:
        member = ctx.guild.get_member(user_id) or await ctx.guild.fetch_member(user_id)
        if not member:
            await ctx.reply("⚠️ Bu kullanıcı sunucuda bulunamadı.")
            return
        
        try:
            await member.send(f"⚠️ **{ctx.guild.name}** sunucusundan atıldınız.\n📝 **Sebep:** {reason}")
        except discord.Forbidden:
            pass
        
        await member.kick(reason=f"Yetkili: {ctx.author} | Sebep: {reason}")
        await ctx.reply(f"✅ {member.mention} başarıyla sunucudan atıldı.")
    except discord.Forbidden:
        await ctx.reply("❌ Bu kullanıcıyı atmak için yetkim yetersiz.")
    except Exception as e:
        print(f"Kick Hatası: {e}")
        await ctx.reply("❌ Kullanıcı atılırken bir hata oluştu.")

# --- MALE REGISTRATION KOMUTU (.e) ---
@bot.command(name="e")
@commands.has_permissions(manage_roles=True)
async def e_command(ctx, target: str = None):
    if not target:
        await ctx.reply("⚠️ Lütfen kayıt etmek istediğiniz kullanıcıyı etiketleyin veya ID'sini girin. Örnek: `.e @kullanıcı`")
        return
    
    user_id = resolve_user_id(target)
    if not user_id:
        await ctx.reply("❌ Geçersiz kullanıcı formatı.")
        return
    
    try:
        member = ctx.guild.get_member(user_id) or await ctx.guild.fetch_member(user_id)
        if not member:
            await ctx.reply("⚠️ Bu kullanıcı sunucuda bulunamadı.")
            return
        
        role = ctx.guild.get_role(ROLE_ERKEK_ID)
        if not role:
            await ctx.reply(f"❌ Erkek rolü (ID: {ROLE_ERKEK_ID}) sunucuda bulunamadı.")
            return
        
        await member.add_roles(role, reason=f"Kayıt: {ctx.author}")
        await ctx.reply(f"✅ {member.mention} Erkek olarak kaydedildi ve <@&{ROLE_ERKEK_ID}> rolü verildi.")
    except discord.Forbidden:
        await ctx.reply("❌ Rol vermek için yetkim yetersiz (Botun rolü hedeflenen rolden üstte olmalı).")
    except Exception as e:
        print(f"Kayıt Hatası (e): {e}")
        await ctx.reply("❌ Rol verilirken bir hata oluştu.")

# --- FEMALE REGISTRATION KOMUTU (.k) ---
@bot.command(name="k")
@commands.has_permissions(manage_roles=True)
async def k_command(ctx, target: str = None):
    if not target:
        await ctx.reply("⚠️ Lütfen kayıt etmek istediğiniz kullanıcıyı etiketleyin veya ID'sini girin. Örnek: `.k @kullanıcı`")
        return
    
    user_id = resolve_user_id(target)
    if not user_id:
        await ctx.reply("❌ Geçersiz kullanıcı formatı.")
        return
    
    try:
        member = ctx.guild.get_member(user_id) or await ctx.guild.fetch_member(user_id)
        if not member:
            await ctx.reply("⚠️ Bu kullanıcı sunucuda bulunamadı.")
            return
        
        role = ctx.guild.get_role(ROLE_KIZ_ID)
        if not role:
            await ctx.reply(f"❌ Kız rolü (ID: {ROLE_KIZ_ID}) sunucuda bulunamadı.")
            return
        
        await member.add_roles(role, reason=f"Kayıt: {ctx.author}")
        await ctx.reply(f"✅ {member.mention} Kız olarak kaydedildi ve <@&{ROLE_KIZ_ID}> rolü verildi.")
    except discord.Forbidden:
        await ctx.reply("❌ Rol vermek için yetkim yetersiz (Botun rolü hedeflenen rolden üstte olmalı).")
    except Exception as e:
        print(f"Kayıt Hatası (k): {e}")
        await ctx.reply("❌ Rol verilirken bir hata oluştu.")

# --- MUTE KOMUTU ---
@bot.command(name="mute")
@commands.has_permissions(moderate_members=True)
async def mute_command(ctx, target: str = None, duration_str: str = None):
    if not target or not duration_str:
        await ctx.reply("⚠️ Yanlış kullanım! Örnek: `.mute @kullanıcı 10m` veya `.mute 1234567890 1h` (s: saniye, m: dakika, h: saat, d: gün)")
        return
    
    user_id = resolve_user_id(target)
    if not user_id:
        await ctx.reply("❌ Geçersiz kullanıcı formatı.")
        return
    
    duration = parse_duration(duration_str)
    if not duration:
        await ctx.reply("⚠️ Geçersiz süre formatı! Lütfen geçerli bir süre girin (örn: 10m, 1h, 1d).")
        return
    
    if duration > datetime.timedelta(days=28):
        await ctx.reply("❌ Zaman aşımı süresi en fazla 28 gün olabilir.")
        return
    
    try:
        member = ctx.guild.get_member(user_id) or await ctx.guild.fetch_member(user_id)
        if not member:
            await ctx.reply("⚠️ Üye bulunamadı.")
            return
        
        await member.timeout(duration, reason=f"Yetkili: {ctx.author}")
        await ctx.reply(f"✅ {member.mention} kullanıcısı **{duration_str}** süreyle susturuldu (zaman aşımına uğratıldı).")
    except discord.Forbidden:
        await ctx.reply("❌ Bu üyeye zaman aşımı uygulamak için yetkim yetersiz.")
    except Exception as e:
        print(f"Mute Hatası: {e}")
        await ctx.reply("❌ Zaman aşımı uygulanırken bir hata oluştu.")

# --- UNMUTE KOMUTU ---
@bot.command(name="unmute")
@commands.has_permissions(moderate_members=True)
async def unmute_command(ctx, target: str = None):
    if not target:
        await ctx.reply("⚠️ Lütfen zaman aşımını kaldırmak istediğiniz kullanıcıyı etiketleyin. Örnek: `.unmute @kullanıcı`")
        return
    
    user_id = resolve_user_id(target)
    if not user_id:
        await ctx.reply("❌ Geçersiz kullanıcı formatı.")
        return
    
    try:
        member = ctx.guild.get_member(user_id) or await ctx.guild.fetch_member(user_id)
        if not member:
            await ctx.reply("⚠️ Üye bulunamadı.")
            return
        
        if not member.timed_out:
            await ctx.reply("⚠️ Bu kullanıcının zaten aktif bir zaman aşımı bulunmuyor.")
            return
        
        await member.timeout(None, reason=f"Yetkili: {ctx.author}")
        await ctx.reply(f"✅ {member.mention} kullanıcısının zaman aşımı kaldırıldı.")
    except discord.Forbidden:
        await ctx.reply("❌ Bu üyenin zaman aşımını kaldırmak için yetkim yetersiz.")
    except Exception as e:
        print(f"Unmute Hatası: {e}")
        await ctx.reply("❌ Zaman aşımı kaldırılırken bir hata oluştu.")

# --- HATA YÖNETİMİ ---
@bot.event
async def on_command_error(ctx, error):
    if isinstance(error, commands.MissingPermissions):
        await ctx.reply("❌ Bu komutu kullanmak için gerekli yetkilere sahip değilsiniz.")
    elif isinstance(error, commands.MissingRequiredArgument):
        await ctx.reply("⚠️ Eksik argüman girdiniz. Lütfen komut kullanımını kontrol edin.")
    elif isinstance(error, commands.BadArgument):
        await ctx.reply("⚠️ Geçersiz argüman girdiniz.")
    elif isinstance(error, commands.CommandNotFound):
        pass # Bilinmeyen komutları yoksay
    else:
        print(f"Beklenmeyen Hata: {error}")

if __name__ == "__main__":
    if not TOKEN:
        print("❌ DISCORD_TOKEN bulunamadı! Lütfen .env dosyasını kontrol edin.")
    else:
        # Web sunucusunu arka planda başlat (Render için)
        threading.Thread(target=run_web_server, daemon=True).start()
        bot.run(TOKEN)
