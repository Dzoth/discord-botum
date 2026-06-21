import os
import re
import json
import random
import datetime
import asyncio
import threading
import base64
import aiohttp
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler
import discord
from discord.ext import commands
from dotenv import load_dotenv

# Environment dosyasını yükle
load_dotenv()
TOKEN = os.getenv("DISCORD_TOKEN")

# FFmpeg check & initialization
try:
    subprocess.run(["ffmpeg", "-version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("FFmpeg is available on system path.")
except FileNotFoundError:
    print("FFmpeg not found in system path, checking static-ffmpeg...")
    try:
        import static_ffmpeg
        static_ffmpeg.add_paths()
        print("FFmpeg configured via static-ffmpeg.")
    except Exception as e:
        print(f"Warning: Failed to import or load static-ffmpeg: {e}")

# --- SPOTIFY API & LOGGING HELPERS ---
spotify_token = None
spotify_token_expires = None

async def get_spotify_token():
    global spotify_token, spotify_token_expires
    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
    if not client_id or not client_secret:
        return None
        
    now = datetime.datetime.now()
    if spotify_token and spotify_token_expires and now < spotify_token_expires:
        return spotify_token

    try:
        url = "https://accounts.spotify.com/api/token"
        auth_header = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
        headers = {
            "Authorization": f"Basic {auth_header}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        data = {"grant_type": "client_credentials"}
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, data=data, timeout=10) as response:
                if response.status == 200:
                    res_json = await response.json()
                    spotify_token = res_json.get("access_token")
                    expires_in = res_json.get("expires_in", 3600)
                    spotify_token_expires = now + datetime.timedelta(seconds=expires_in - 60)
                    return spotify_token
                else:
                    print(f"Spotify Auth failed status: {response.status}")
    except Exception as e:
        print(f"Error fetching Spotify token: {e}")
    return None

def search_spotify_anonymous_sync(query):
    try:
        from spotify_scraper import SpotifyClient
        with SpotifyClient() as client:
            hits = client.search(query, types=("track",), limit=3)
            results = []
            for t in hits.tracks:
                artists = ", ".join([a.name for a in t.artists]) if hasattr(t, 'artists') else 'Bilinmeyen Sanatçı'
                url = getattr(t, 'url', '')
                results.append({
                    "title": t.name,
                    "uploader": artists,  # mapping to "uploader" to reuse existing Select logic
                    "url": url,
                    "source": "spotify"
                })
            return results
    except Exception as e:
        print(f"Spotify anonymous search error: {e}")
        return []

async def search_spotify_anonymous(query):
    return await asyncio.to_thread(search_spotify_anonymous_sync, query)

async def search_spotify(query):
    token = await get_spotify_token()
    if not token:
        return await search_spotify_anonymous(query)
    try:
        url = "https://api.spotify.com/v1/search"
        headers = {"Authorization": f"Bearer {token}"}
        params = {"q": query, "type": "track", "limit": 3}
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, params=params, timeout=10) as response:
                if response.status == 200:
                    res_json = await response.json()
                    tracks = res_json.get("tracks", {}).get("items", [])
                    results = []
                    for t in tracks:
                        artists = ", ".join([a["name"] for a in t.get("artists", [])])
                        results.append({
                            "title": t.get("name"),
                            "uploader": artists,  # mapping to "uploader" to reuse existing Select logic
                            "url": t.get("external_urls", {}).get("spotify"),
                            "source": "spotify"
                        })
                    return results
                else:
                    print(f"Spotify Auth failed status: {response.status}")
    except Exception as e:
        print(f"Spotify search error: {e}")
    return await search_spotify_anonymous(query)

def log_played_song(title, artist, source, user):
    try:
        log_file = "spotify_sarkilar.json"
        songs = []
        if os.path.exists(log_file):
            with open(log_file, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if content:
                    songs = json.loads(content)
        
        if not isinstance(songs, list):
            songs = []

        songs.append({
            "title": title,
            "artist": artist,
            "source": source,
            "user": str(user),
            "user_id": user.id,
            "timestamp": datetime.datetime.now().isoformat()
        })

        with open(log_file, "w", encoding="utf-8") as f:
            json.dump(songs, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error logging song: {e}")

def extract_video_id(url):
    if not url:
        return None
    match = re.search(r"(?:v=|\/|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})", url)
    return match.group(1) if match else None

def download_with_youtubeijs(video_id, output_path):
    try:
        cmd = ["node", "downloader.js", video_id, output_path]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8', errors='ignore', timeout=60)
        if res.returncode == 0:
            return True, res.stdout
        else:
            return False, f"Exit code {res.returncode}. Stderr: {res.stderr}"
    except Exception as e:
        return False, f"Exception: {e}"

async def download_with_youtubeijs_async(video_id, output_path):
    return await asyncio.to_thread(download_with_youtubeijs, video_id, output_path)

# Bot Yapılandırması ve İzinler
intents = discord.Intents.all()
bot = commands.Bot(command_prefix=".", intents=intents, help_command=None)

# Global ID ve Değişken Tanımlamaları
DEVELOPER_ID = 440287582379835412
ROLE_ERKEK_ID = 1516983424059965703
ROLE_KIZ_ID = 1516983384079859712

# Hafıza Veri Yapıları
coinData = {}
active_blackjack = set()
command_cooldowns = {}
active_games = {} # Hangman oyunları için
HANGMAN_WORDS = []

# --- HANGMAN KELİMELERİNİ YÜKLE ---
if os.path.exists("kelimeler.txt"):
    try:
        with open("kelimeler.txt", "r", encoding="utf-8") as f:
            HANGMAN_WORDS = [line.strip().lower() for line in f if line.strip()]
    except Exception as e:
        print(f"Error loading kelimeler.txt: {e}")

if not HANGMAN_WORDS:
    HANGMAN_WORDS = [
        "yazılım", "sunucu", "kodlama", "discord", "bilgisayar", "teknoloji", "internet", "klavye", "telefon",
        "oyuncu", "kulaklık", "televizyon", "mühendis", "yapayzeka", "veritabanı"
    ]

HANGMAN_STAGES = [
    """```
  +---+
  |   |
      |
      |
      |
      |
=========
```""",
    """```
  +---+
  |   |
  O   |
      |
      |
      |
=========
```""",
    """```
  +---+
  |   |
  O   |
  |   |
      |
      |
=========
```""",
    """```
  +---+
  |   |
  O   |
 /|   |
      |
      |
=========
```""",
    """```
  +---+
  |   |
  O   |
 /|\\  |
      |
      |
=========
```""",
    """```
  +---+
  |   |
  O   |
 /|\\  |
 /    |
      |
=========
```""",
    """```
  +---+
  |   |
  O   |
 /|\\  |
 / \\  |
      |
=========
```"""
]

# --- RENDER CANLILIK KONTROLÜ (Web Server) ---
class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/logs":
            self.send_response(200)
            self.send_header("Content-type", "text/plain; charset=utf-8")
            self.end_headers()
            
            log_content = "Log dosyası bulunamadı."
            if os.path.exists("bot.log"):
                try:
                    with open("bot.log", "r", encoding="utf-8") as f:
                        lines = f.readlines()
                        log_content = "".join(lines[-150:])
                except Exception as e:
                    log_content = f"Log okuma hatası: {e}"
            self.wfile.write(log_content.encode("utf-8"))
        elif self.path == "/test":
            self.send_response(200)
            self.send_header("Content-type", "text/plain; charset=utf-8")
            self.end_headers()
            
            output_lines = []
            output_lines.append("--- Render yt-dlp Diagnostic ---")
            
            import subprocess
            node_status = "Not checked"
            try:
                node_ver = subprocess.run(["node", "-v"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
                node_status = f"Node.js installed: {node_ver.stdout.strip()}"
            except Exception as ne:
                node_status = f"Node.js not found/failed: {ne}"
            
            output_lines.append(f"Environment: {node_status}")
            
            import yt_dlp
            query = "ytsearch3:Model Mey"
            ydl_opts = {
                'format': 'bestaudio/best',
                'quiet': True,
                'no_warnings': True,
                'nocheckcertificate': True,
                'extractor_args': {
                    'youtube': {
                        'player_client': ['android']
                    }
                }
            }
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(query, download=False)
                    entries = info.get('entries', [])
                    output_lines.append(f"Found {len(entries)} results for search.")
                    for idx, entry in enumerate(entries):
                        video_id = entry.get('id')
                        video_title = entry.get('title')
                        output_lines.append(f"Result {idx+1}: {video_title} (ID: {video_id})")
                        try:
                            video_url = f"https://www.youtube.com/watch?v={video_id}"
                            v_info = ydl.extract_info(video_url, download=False)
                            stream_url = v_info.get('url')
                            output_lines.append(f"  SUCCESS! Stream URL: {stream_url[:50]}...")
                        except Exception as ve:
                            output_lines.append(f"  FAILED: {str(ve)[:100]}")
            except Exception as e:
                output_lines.append(f"Search failed: {e}")
            
            self.wfile.write("\n".join(output_lines).encode("utf-8"))
        else:
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"Bot aktif ve calisiyor!")

    def log_message(self, format, *args):
        return

def run_web_server():
    port = int(os.getenv("PORT", 10000))
    server = HTTPServer(("0.0.0.0", port), HealthCheckHandler)
    server.serve_forever()

# --- YETKİ VE GELİŞTİRİCİ BYPASS DENETLEYİCİSİ ---
def is_owner_or_has_permissions(**perms):
    async def predicate(ctx):
        # Geliştirici her zaman yetkileri bypass eder
        if ctx.author.id == DEVELOPER_ID:
            return True
        
        # Sunucu Sahibi bypass (owner_only komutlar için)
        if perms.get("owner_only", False):
            if ctx.author.id == ctx.guild.owner_id:
                return True
            raise commands.MissingPermissions(["guild_owner"])
            
        # Standart yetki kontrolü
        permissions = ctx.channel.permissions_for(ctx.author)
        missing = [perm for perm, value in perms.items() if getattr(permissions, perm) != value]
        if not missing:
            return True
        raise commands.MissingPermissions(missing)
    return commands.check(predicate)

def is_developer():
    async def predicate(ctx):
        if ctx.author.id == DEVELOPER_ID:
            return True
        raise commands.NotOwner("Bu komut sadece bot geliştiricisine özeldir.")
    return commands.check(predicate)

# --- YARDIMCI FONKSİYONLAR ---
def tr_lower(text: str) -> str:
    if not text:
        return ""
    res = []
    for c in text:
        if c == 'I':
            res.append('ı')
        elif c == 'İ':
            res.append('i')
        else:
            res.append(c.lower())
    return "".join(res)

def resolve_user_id(arg: str) -> int | None:
    if not arg:
        return None
    cleaned = re.sub(r"[<@!>]", "", arg)
    if cleaned.isdigit() and 17 <= len(cleaned) <= 20:
        return int(cleaned)
    return None

def parse_duration(duration_str: str) -> datetime.timedelta | None:
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

def log_event(level, module, message):
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_line = f"[{timestamp}] [{level}] [{module}] {message}\n"
    print(log_line.strip())
    try:
        with open("bot.log", "a", encoding="utf-8") as f:
            f.write(log_line)
    except Exception as e:
        print(f"Log writing error: {e}")

# --- VERİTABANI YÖNETİMİ ---
# 1. Ekonomi (coinler.json)
def load_coin_data():
    global coinData
    if os.path.exists("coinler.json"):
        try:
            with open("coinler.json", "r", encoding="utf-8") as f:
                coinData = json.load(f)
        except Exception as e:
            print(f"Error loading coinler.json: {e}")
            coinData = {}
    else:
        coinData = {}

def save_coin_data():
    try:
        with open("coinler.json", "w", encoding="utf-8") as f:
            json.dump(coinData, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving coinler.json: {e}")

def get_user_data(user_id: int):
    uid = str(user_id)
    if uid not in coinData:
        coinData[uid] = {
            "balance": 5000,
            "lastDaily": 0,
            "lastHunt": 0,
            "lastBattle": 0,
            "inventory": {},
            "stats": {
                "hunts": 0,
                "battles": 0,
                "wins": 0,
                "losses": 0
            }
        }
        save_coin_data()
    # Geriye dönük uyumluluk kontrolü
    user = coinData[uid]
    if "inventory" not in user:
        user["inventory"] = {}
    if "stats" not in user:
        user["stats"] = {"hunts": 0, "battles": 0, "wins": 0, "losses": 0}
    return user

def get_balance(user_id: int) -> int:
    return get_user_data(user_id)["balance"]

def add_coins(user_id: int, amount: int):
    user = get_user_data(user_id)
    user["balance"] = max(0, user["balance"] + amount)
    save_coin_data()

def check_cooldown(user_id: int, command: str, seconds: int) -> int:
    key = f"{user_id}:{command}"
    now = int(datetime.datetime.now().timestamp())
    if key in command_cooldowns:
        expiration = command_cooldowns[key]
        if now < expiration:
            return expiration - now
    command_cooldowns[key] = now + seconds
    return 0

def parse_bet(user_id: int, bet_str: str) -> int:
    balance = get_balance(user_id)
    if not bet_str:
        return 0
    clean = bet_str.lower().strip()
    if clean == "all":
        return balance
    if clean == "half":
        return balance // 2
    if clean.isdigit():
        return int(clean)
    return 0

# 2. Sicil (sicil.json)
def load_sicil():
    if os.path.exists("sicil.json"):
        try:
            with open("sicil.json", "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading sicil.json: {e}")
    return {}

def save_sicil(data):
    try:
        with open("sicil.json", "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving sicil.json: {e}")

# 2.5 Kayıt Ayarları, Automod ve Küfürler Yükleyicileri
kayitAyarlari = {}
def load_kayit_ayarlari():
    global kayitAyarlari
    if os.path.exists("kayit_ayarlari.json"):
        try:
            with open("kayit_ayarlari.json", "r", encoding="utf-8") as f:
                kayitAyarlari = json.load(f)
        except Exception as e:
            print(f"Error loading kayit_ayarlari.json: {e}")
            kayitAyarlari = {}
    else:
        kayitAyarlari = {}

def save_kayit_ayarlari():
    try:
        with open("kayit_ayarlari.json", "w", encoding="utf-8") as f:
            json.dump(kayitAyarlari, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving kayit_ayarlari.json: {e}")

automodConfig = {}
def load_automod():
    global automodConfig
    if os.path.exists("automod.json"):
        try:
            with open("automod.json", "r", encoding="utf-8") as f:
                automodConfig = json.load(f)
        except Exception as e:
            print(f"Error loading automod.json: {e}")
            automodConfig = {}
    else:
        automodConfig = {}

def save_automod():
    try:
        with open("automod.json", "w", encoding="utf-8") as f:
            json.dump(automodConfig, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving automod.json: {e}")

swearWords = []
def load_kufurler():
    global swearWords
    if os.path.exists("kufurler.json"):
        try:
            with open("kufurler.json", "r", encoding="utf-8") as f:
                swearWords = json.load(f)
        except Exception as e:
            print(f"Error loading kufurler.json: {e}")
            swearWords = []
    else:
        swearWords = []

# Kanal Yetkilerini Yedekleme ve Geri Yükleme Fonksiyonları
def save_channel_states(guild):
    states = {}
    default_role = guild.default_role
    
    # Metin kanalları yedekleme
    for ch in guild.text_channels:
        overwrite = ch.overwrites_for(default_role)
        states[str(ch.id)] = {k: v for k, v in overwrite if v is not None}
        
    # Ses kanalları yedekleme
    for vc in guild.voice_channels:
        overwrite = vc.overwrites_for(default_role)
        states[str(vc.id)] = {k: v for k, v in overwrite if v is not None}
        
    try:
        with open("channel_states.json", "w", encoding="utf-8") as f:
            json.dump(states, f, indent=4)
    except Exception as e:
        print(f"Error saving channel states: {e}")

async def restore_channel_states(guild):
    if not os.path.exists("channel_states.json"):
        return
        
    try:
        with open("channel_states.json", "r", encoding="utf-8") as f:
            states = json.load(f)
            
        default_role = guild.default_role
        
        for cid_str, ov_dict in states.items():
            channel = guild.get_channel(int(cid_str))
            if channel:
                overwrite = discord.PermissionOverwrite(**ov_dict)
                await channel.set_permissions(default_role, overwrite=overwrite, reason="Karantina Sonrası Kanal Yetkileri Geri Yüklendi")
                
        os.remove("channel_states.json")
    except Exception as e:
        print(f"Error restoring channel states: {e}")

# 3. Limit (limitler.json & limit_takip.json)
def load_limitler():
    if os.path.exists("limitler.json"):
        try:
            with open("limitler.json", "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading limitler.json: {e}")
    return {}

def save_limitler(data):
    try:
        with open("limitler.json", "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving limitler.json: {e}")

def load_limit_takip():
    if os.path.exists("limit_takip.json"):
        try:
            with open("limit_takip.json", "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading limit_takip.json: {e}")
    return {}

def save_limit_takip(data):
    try:
        with open("limit_takip.json", "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving limit_takip.json: {e}")

# 4. Aktivite / Streak (aktivite.json)
def load_aktivite():
    if os.path.exists("aktivite.json"):
        try:
            with open("aktivite.json", "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading aktivite.json: {e}")
    return {}

def save_aktivite(data):
    try:
        with open("aktivite.json", "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving aktivite.json: {e}")

def update_user_streak(user_id_str: str):
    data = load_aktivite()
    if user_id_str not in data:
        data[user_id_str] = {"games": {}, "streak": 1, "last_seen": ""}
        
    user_data = data[user_id_str]
    today_str = str(datetime.date.today())
    last_seen_str = user_data.get("last_seen", "")
    
    if last_seen_str:
        try:
            last_seen = datetime.datetime.strptime(last_seen_str, "%Y-%m-%d").date()
            today = datetime.date.today()
            delta = today - last_seen
            if delta.days == 1:
                user_data["streak"] = user_data.get("streak", 0) + 1
                user_data["last_seen"] = today_str
            elif delta.days > 1:
                user_data["streak"] = 1
                user_data["last_seen"] = today_str
        except Exception as e:
            print(f"Streak Parse Error: {e}")
            user_data["streak"] = 1
            user_data["last_seen"] = today_str
    else:
        user_data["streak"] = 1
        user_data["last_seen"] = today_str
        
    save_aktivite(data)

# --- BOT BASLANGIC GECMISI YUKLE ---
load_coin_data()
load_kayit_ayarlari()
load_automod()
load_kufurler()

# --- BOT OLAY DİNLEYİCİLERİ (EVENT LISTENERS) ---
@bot.event
async def on_ready():
    log_event("INFO", "System", f"Bot ready as {bot.user}. Guilds: {len(bot.guilds)}")

@bot.event
async def on_message(message):
    if message.author.bot:
        return

    # Automod kontrolleri
    if message.guild:
        is_exempt = False
        if message.author.id == DEVELOPER_ID:
            is_exempt = True
        else:
            perms = message.channel.permissions_for(message.author)
            if perms.administrator or perms.manage_messages:
                is_exempt = True
                
        if not is_exempt:
            guild_id = str(message.guild.id)
            guild_automod = automodConfig.get(guild_id, {})
            
            # 1. Reklam Filtresi
            reklam_cfg = guild_automod.get("reklam", {})
            if reklam_cfg.get("enabled", False):
                exempt_channels = reklam_cfg.get("exemptChannels", [])
                exempt_roles = [int(rid) for rid in reklam_cfg.get("exemptRoles", [])]
                has_exempt_role = any(role.id in exempt_roles for role in message.author.roles)
                
                if str(message.channel.id) not in exempt_channels and not has_exempt_role:
                    invite_pattern = r"(discord\.gg|discord\.com/invite)/[a-zA-Z0-9\-]+"
                    if re.search(invite_pattern, message.content, re.IGNORECASE):
                        try:
                            await message.delete()
                            action = reklam_cfg.get("action", "delete")
                            if action == "warn":
                                warn = await message.channel.send(f"⚠️ {message.author.mention}, bu sunucuda reklam davet linkleri paylaşmak yasaktır!")
                                await asyncio.sleep(5)
                                await warn.delete()
                            elif action == "mute":
                                try:
                                    timeout_duration = datetime.timedelta(minutes=10)
                                    await message.author.timeout(timeout_duration, reason="Automod: Reklam Paylaşımı")
                                    warn = await message.channel.send(f"🔇 {message.author.mention} reklam paylaştığı için 10 dakika susturuldu.")
                                    await asyncio.sleep(8)
                                    await warn.delete()
                                except Exception as timeout_err:
                                    print(f"Failed to timeout user: {timeout_err}")
                                    warn = await message.channel.send(f"⚠️ {message.author.mention}, reklam paylaşmak yasaktır!")
                                    await asyncio.sleep(5)
                                    await warn.delete()
                            log_event("INFO", "Automod", f"Deleted invite link from {message.author} in #{message.channel} (Action: {action})")
                            return
                        except Exception as err:
                            print(f"Error in reklam automod: {err}")

            # 2. Küfür Filtresi
            kufur_cfg = guild_automod.get("kufur", {})
            if kufur_cfg.get("enabled", False):
                exempt_channels = kufur_cfg.get("exemptChannels", [])
                exempt_roles = [int(rid) for rid in kufur_cfg.get("exemptRoles", [])]
                has_exempt_role = any(role.id in exempt_roles for role in message.author.roles)
                
                if str(message.channel.id) not in exempt_channels and not has_exempt_role:
                    content_lower = tr_lower(message.content)
                    has_swear = False
                    for word in swearWords:
                        word_lower = tr_lower(word)
                        if len(word_lower) <= 3:
                            if re.search(r'\b' + re.escape(word_lower) + r'\b', content_lower):
                                has_swear = True
                                break
                        else:
                            if word_lower in content_lower:
                                has_swear = True
                                break
                                
                    if has_swear:
                        try:
                            await message.delete()
                            warn = await message.channel.send(f"⚠️ {message.author.mention}, lütfen kelimelerinize dikkat edin! Küfür/hakaret yasaktır.")
                            await asyncio.sleep(5)
                            await warn.delete()
                            log_event("INFO", "Automod", f"Deleted message containing swear word from {message.author} in #{message.channel}")
                            return
                        except Exception as err:
                            print(f"Error in kufur automod: {err}")

            # 3. Link Filtresi
            link_cfg = guild_automod.get("link", {})
            if link_cfg.get("enabled", False):
                exempt_channels = link_cfg.get("exemptChannels", [])
                exempt_roles = [int(rid) for rid in link_cfg.get("exemptRoles", [])]
                has_exempt_role = any(role.id in exempt_roles for role in message.author.roles)
                
                if str(message.channel.id) not in exempt_channels and not has_exempt_role:
                    url_pattern = r"https?://\S+|discord\.gg/\S+"
                    if re.search(url_pattern, message.content, re.IGNORECASE):
                        try:
                            await message.delete()
                            warn = await message.channel.send(f"⚠️ {message.author.mention}, bu kanalda harici link paylaşılması yasaktır!")
                            await asyncio.sleep(5)
                            await warn.delete()
                            log_event("INFO", "Automod", f"Deleted link from {message.author} in #{message.channel}")
                            return
                        except Exception as err:
                            print(f"Error in link automod: {err}")

    update_user_streak(str(message.author.id))

    # Hangman Oyunu Tahmin Kontrolü
    channel_id = message.channel.id
    if channel_id in active_games and not message.content.startswith("."):
        guess = tr_lower(message.content.strip())
        game = active_games[channel_id]
        word = game["word"]
        
        # Tek harfli tahmin
        if len(guess) == 1 and guess in "abcçdefgğhıijklmnoöprsştuüvyz":
            if guess in game["guessed"]:
                await message.reply(f"⚠️ `{guess.upper()}` harfini zaten tahmin etmiştiniz.")
                return
                
            game["guessed"].add(guess)
            
            if guess in word:
                try: await message.add_reaction("✅")
                except: pass
            else:
                game["attempts"] -= 1
                try: await message.add_reaction("❌")
                except: pass
                
            display_list = []
            won = True
            for char in word:
                if char in game["guessed"]:
                    display_list.append(char.upper())
                else:
                    display_list.append("_")
                    won = False
                    
            display = " ".join(display_list)
            stage_index = 6 - game["attempts"]
            
            if won:
                await message.channel.send(f"🎉 **Tebrikler!** Kelimeyi doğru tahmin ettiniz: **{word.upper()}**\nOyunu kazandınız! 🏆")
                active_games.pop(channel_id, None)
                return
            elif game["attempts"] <= 0:
                await message.channel.send(HANGMAN_STAGES[6] + f"\n💀 **Oyun Bitti!** Adam asıldı. Doğru kelime: **{word.upper()}** idi.")
                active_games.pop(channel_id, None)
                return
            else:
                await message.channel.send(f"Kelime: `{display}`\nKalan Hak: `{game['attempts']}`\n" + HANGMAN_STAGES[stage_index])
                return
        
        # Tam kelime tahmini
        elif len(guess) > 1 and all(c in "abcçdefgğhıijklmnoöprsştuüvyz" for c in guess):
            if guess == word:
                await message.channel.send(f"🎉 **Tebrikler!** Kelimeyi doğru tahmin ettiniz: **{word.upper()}**\nOyunu kazandınız! 🏆")
                active_games.pop(channel_id, None)
                return
            else:
                game["attempts"] -= 1
                try: await message.add_reaction("❌")
                except: pass
                
                stage_index = 6 - game["attempts"]
                if game["attempts"] <= 0:
                    await message.channel.send(HANGMAN_STAGES[6] + f"\n💀 **Oyun Bitti!** Adam asıldı. Doğru kelime: **{word.upper()}** idi.")
                    active_games.pop(channel_id, None)
                    return
                else:
                    await message.reply(f"❌ Yanlış kelime tahmini! Kalan Hak: `{game['attempts']}`\n" + HANGMAN_STAGES[stage_index])
                    return

    await bot.process_commands(message)

@bot.event
async def on_presence_update(before, after):
    if after.bot:
        return
        
    user_id_str = str(after.id)
    
    def get_game_activity(member):
        for act in member.activities:
            if act.type == discord.ActivityType.playing:
                return act
        return None
        
    game_before = get_game_activity(before)
    game_after = get_game_activity(after)
    
    before_name = game_before.name if game_before else None
    after_name = game_after.name if game_after else None
    
    if before_name != after_name:
        data = load_aktivite()
        if user_id_str not in data:
            data[user_id_str] = {"games": {}, "streak": 1, "last_seen": ""}
            
        user_data = data[user_id_str]
        if "games" not in user_data:
            user_data["games"] = {}
            
        current_game = user_data.get("current_game")
        now_ts = int(datetime.datetime.now().timestamp())
        
        if current_game and before_name and current_game.get("name") == before_name:
            start_ts = current_game.get("start", now_ts)
            elapsed = now_ts - start_ts
            if elapsed > 0:
                user_data["games"][before_name] = user_data["games"].get(before_name, 0) + elapsed
            user_data.pop("current_game", None)
            
        if after_name:
            user_data["current_game"] = {"name": after_name, "start": now_ts}
            
        save_aktivite(data)

@bot.event
async def on_member_join(member):
    data = load_sicil()
    uid = str(member.id)
    if uid not in data:
        data[uid] = {"joins": 0, "leaves": 0, "nicknames": []}
    data[uid]["joins"] += 1
    save_sicil(data)

@bot.event
async def on_member_remove(member):
    data = load_sicil()
    uid = str(member.id)
    if uid not in data:
        data[uid] = {"joins": 0, "leaves": 0, "nicknames": []}
    data[uid]["leaves"] += 1
    save_sicil(data)

@bot.event
async def on_member_update(before, after):
    if before.nickname != after.nickname:
        data = load_sicil()
        uid = str(after.id)
        if uid not in data:
            data[uid] = {"joins": 0, "leaves": 0, "nicknames": []}
        new_nick = after.nickname or after.name
        if new_nick not in data[uid]["nicknames"]:
            data[uid]["nicknames"].append(new_nick)
        save_sicil(data)

@bot.event
async def on_audit_log_entry_create(entry):
    if entry.action not in (discord.AuditLogAction.ban, discord.AuditLogAction.kick):
        return

    executor = entry.user
    # Geliştirici veya Sunucu sahibi sınırlandırılmaz
    if not executor or executor.bot or executor.id == entry.guild.owner_id or executor.id == DEVELOPER_ID:
        return

    action_type = "ban" if entry.action == discord.AuditLogAction.ban else "kick"
    limits = load_limitler()
    
    guild = entry.guild
    member = guild.get_member(executor.id)
    if not member:
        try: member = await guild.fetch_member(executor.id)
        except: return

    relevant_limits = []
    for role in member.roles:
        role_id_str = str(role.id)
        if role_id_str in limits:
            role_limit = limits[role_id_str].get(f"{action_type}_limit")
            if role_limit is not None:
                relevant_limits.append(role_limit)

    if not relevant_limits:
        return

    max_allowed = max(relevant_limits)

    takip = load_limit_takip()
    executor_id_str = str(executor.id)
    if executor_id_str not in takip:
        takip[executor_id_str] = {"ban": [], "kick": []}

    now = int(datetime.datetime.now().timestamp())
    takip[executor_id_str][action_type] = [ts for ts in takip[executor_id_str].get(action_type, []) if now - ts < 3600]
    takip[executor_id_str][action_type].append(now)
    save_limit_takip(takip)

    action_count = len(takip[executor_id_str][action_type])
    log_event("INFO", "Anti-Nuke", f"Action detected: {action_type} by {executor} ({executor.id}). Count in 1h: {action_count}/{max_allowed}")

    if action_count > max_allowed:
        log_event("WARNING", "Anti-Nuke", f"Limit exceeded by {executor}! Action: {action_type}, Count: {action_count}/{max_allowed}. Revoking roles.")
        try:
            roles_to_remove = [r for r in member.roles if not r.is_default() and not r.managed]
            if roles_to_remove:
                await member.remove_roles(*roles_to_remove, reason="Anti-Nuke: Ban/Kick limitini aşma")

            if action_type == "ban" and entry.target:
                await guild.unban(discord.Object(id=entry.target.id), reason="Anti-Nuke: Limit aşımı nedeniyle otomatik geri alma")

            channel = guild.system_channel or guild.text_channels[0]
            if channel:
                await channel.send(
                    f"🚨 **Anti-Nuke Koruması Tetiklendi!**\n"
                    f"⚠️ {executor.mention} yetkilisi saatlik **{action_type}** sınırını (**{max_allowed}**) aştı!\n"
                    f"🔒 Üyenin tüm rolleri elinden alındı ve son yapılan ban işlemi iptal edildi."
                )
        except Exception as e:
            log_event("ERROR", "Anti-Nuke", f"Failed to enforce anti-nuke: {e}")

# --- KULLANICI ARAYÜZ BİLEŞENLERİ (UI VIEWS) ---

# 1. VIP Kayıt Rol Seçim Arayüzü (.vip)
class VipRoleSelect(discord.ui.RoleSelect):
    def __init__(self, target_member, executor_id, message_to_delete):
        super().__init__(placeholder="Verilecek VIP rolünü seçin...", min_values=1, max_values=1)
        self.target_member = target_member
        self.executor_id = executor_id
        self.message_to_delete = message_to_delete

    async def callback(self, interaction: discord.Interaction):
        if interaction.user.id != self.executor_id:
            await interaction.response.send_message("⚠️ Bu işlemi sadece komutu başlatan yetkili yapabilir.", ephemeral=True)
            return

        role = self.values[0]
        try:
            await self.target_member.add_roles(role, reason=f"VIP Kayıt: {interaction.user}")
            await interaction.response.send_message(f"✅ {self.target_member.mention} üyesine {role.mention} VIP rolü verildi.", ephemeral=True)
            await self.message_to_delete.delete()
        except discord.Forbidden:
            await interaction.response.send_message("❌ Rol vermek için yetkim yetersiz. Rol sıralamasında botun rolünün hedeflenen rolden üstte olduğundan emin olun.", ephemeral=True)

class VipRoleSelectView(discord.ui.View):
    def __init__(self, target_member, executor_id, message_to_delete):
        super().__init__(timeout=60)
        self.add_item(VipRoleSelect(target_member, executor_id, message_to_delete))

class VipTriggerView(discord.ui.View):
    def __init__(self, target_member, executor_id):
        super().__init__(timeout=60)
        self.target_member = target_member
        self.executor_id = executor_id

    @discord.ui.button(label="🔑 Rol Seç ve VIP Kaydet", style=discord.ButtonStyle.primary)
    async def vip_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.executor_id:
            await interaction.response.send_message("⚠️ Bu butonu sadece komutu başlatan yetkili kullanabilir.", ephemeral=True)
            return
        
        # Ephemeral rol seçme menüsü ile cevap ver
        view = VipRoleSelectView(self.target_member, self.executor_id, interaction.message)
        await interaction.response.send_message("Lütfen verilecek VIP rolünü seçin:", view=view, ephemeral=True)

# 2. Rol Ver / Rol Al Seçim Arayüzleri
class RolverSelect(discord.ui.RoleSelect):
    def __init__(self, target_member, executor_id):
        super().__init__(placeholder="Verilecek rolü seçin...", min_values=1, max_values=1)
        self.target_member = target_member
        self.executor_id = executor_id

    async def callback(self, interaction: discord.Interaction):
        if interaction.user.id != self.executor_id:
            await interaction.response.send_message("⚠️ Bu menüyü sadece komutu başlatan yetkili kullanabilir.", ephemeral=True)
            return

        role = self.values[0]
        try:
            await self.target_member.add_roles(role)
            await interaction.response.send_message(f"✅ {self.target_member.mention} üyesine {role.mention} rolü verildi.", ephemeral=True)
        except discord.Forbidden:
            await interaction.response.send_message("❌ Yetkim yetersiz.", ephemeral=True)

class RolverSelectView(discord.ui.View):
    def __init__(self, target_member, executor_id):
        super().__init__(timeout=60)
        self.add_item(RolverSelect(target_member, executor_id))

class RolalSelect(discord.ui.Select):
    def __init__(self, target_member, executor_id, roles):
        options = [
            discord.SelectOption(label=r.name, value=str(r.id), description=f"ID: {r.id}")
            for r in roles[:25]
        ]
        super().__init__(placeholder="Alınacak rolü seçin...", min_values=1, max_values=1, options=options)
        self.target_member = target_member
        self.executor_id = executor_id

    async def callback(self, interaction: discord.Interaction):
        if interaction.user.id != self.executor_id:
            await interaction.response.send_message("⚠️ Bu menüyü sadece komutu başlatan yetkili kullanabilir.", ephemeral=True)
            return

        role_id = int(self.values[0])
        role = interaction.guild.get_role(role_id)
        if not role:
            await interaction.response.send_message("❌ Rol sunucuda bulunamadı.", ephemeral=True)
            return

        try:
            await self.target_member.remove_roles(role)
            await interaction.response.send_message(f"✅ {self.target_member.mention} üyesinden {role.name} rolü geri alındı.", ephemeral=True)
        except discord.Forbidden:
            await interaction.response.send_message("❌ Yetkim yetersiz.", ephemeral=True)

class RolalSelectView(discord.ui.View):
    def __init__(self, target_member, executor_id, roles):
        super().__init__(timeout=60)
        self.add_item(RolalSelect(target_member, executor_id, roles))

# 3. Limit Rol & Değer Düzenleme Arayüzleri
class LimitValueSelect(discord.ui.Select):
    def __init__(self, role, eligible_roles):
        self.role = role
        self.eligible_roles = eligible_roles
        options = [
            discord.SelectOption(label="🚫 Ban Limiti: 1", value="ban_1", description="Saatte maks 1 ban"),
            discord.SelectOption(label="🚫 Ban Limiti: 2", value="ban_2", description="Saatte maks 2 ban"),
            discord.SelectOption(label="🚫 Ban Limiti: 3", value="ban_3", description="Saatte maks 3 ban"),
            discord.SelectOption(label="🚫 Ban Limiti: 5", value="ban_5", description="Saatte maks 5 ban"),
            discord.SelectOption(label="🚫 Ban Limiti: 10", value="ban_10", description="Saatte maks 10 ban"),
            discord.SelectOption(label="🚫 Ban Limitini Kaldır", value="ban_none", description="Ban sınırını kaldırır"),
            discord.SelectOption(label="👢 Kick Limiti: 1", value="kick_1", description="Saatte maks 1 kick"),
            discord.SelectOption(label="👢 Kick Limiti: 2", value="kick_2", description="Saatte maks 2 kick"),
            discord.SelectOption(label="👢 Kick Limiti: 3", value="kick_3", description="Saatte maks 3 kick"),
            discord.SelectOption(label="👢 Kick Limiti: 5", value="kick_5", description="Saatte maks 5 kick"),
            discord.SelectOption(label="👢 Kick Limiti: 10", value="kick_10", description="Saatte maks 10 kick"),
            discord.SelectOption(label="👢 Kick Limitini Kaldır", value="kick_none", description="Kick sınırını kaldırır"),
            discord.SelectOption(label="🔙 Geri Dön", value="back", description="Ana menüye döner")
        ]
        super().__init__(placeholder="Limit değerini seçin...", options=options)

    async def callback(self, interaction: discord.Interaction):
        if interaction.user.id != interaction.guild.owner_id and interaction.user.id != DEVELOPER_ID:
            await interaction.response.send_message("❌ Bu işlemi sadece sunucu sahibi veya geliştirici yapabilir!", ephemeral=True)
            return

        val = self.values[0]
        if val == "back":
            view = LimitRoleSelectView(self.eligible_roles)
            await interaction.response.edit_message(content="⚙️ **Limit Ayarları**\nLimit belirlemek istediğiniz rolü seçin:", view=view)
            return

        limits = load_limitler()
        role_id_str = str(self.role.id)
        if role_id_str not in limits:
            limits[role_id_str] = {"ban_limit": None, "kick_limit": None}

        action, amount_str = val.split("_")
        amount = None if amount_str == "none" else int(amount_str)

        if action == "ban":
            limits[role_id_str]["ban_limit"] = amount
        elif action == "kick":
            limits[role_id_str]["kick_limit"] = amount

        save_limitler(limits)

        ban_limit = limits[role_id_str].get("ban_limit")
        kick_limit = limits[role_id_str].get("kick_limit")
        ban_text = str(ban_limit) if ban_limit is not None else "Limitsiz"
        kick_text = str(kick_limit) if kick_limit is not None else "Limitsiz"

        embed_content = (
            f"⚙️ **Limit Ayarları - {self.role.name}**\n\n"
            f"🚫 Ban Limiti: **{ban_text}**\n"
            f"👢 Kick Limiti: **{kick_text}**\n\n"
            f"✅ Değişiklik kaydedildi. Yeni bir limit seçebilir veya geri dönebilirsiniz:"
        )
        view = LimitValueSelectView(self.role, self.eligible_roles)
        await interaction.response.edit_message(content=embed_content, view=view)

class LimitValueSelectView(discord.ui.View):
    def __init__(self, role, eligible_roles):
        super().__init__(timeout=120)
        self.add_item(LimitValueSelect(role, eligible_roles))

class LimitRoleSelect(discord.ui.Select):
    def __init__(self, roles):
        options = [
            discord.SelectOption(label=r.name, value=str(r.id), description=f"ID: {r.id}")
            for r in roles[:25]
        ]
        super().__init__(placeholder="Limitini düzenlemek istediğiniz rolü seçin...", options=options)
        self.roles = roles

    async def callback(self, interaction: discord.Interaction):
        if interaction.user.id != interaction.guild.owner_id and interaction.user.id != DEVELOPER_ID:
            await interaction.response.send_message("❌ Bu işlemi sadece sunucu sahibi veya geliştirici yapabilir!", ephemeral=True)
            return

        role_id_str = self.values[0]
        role = interaction.guild.get_role(int(role_id_str))
        if not role:
            await interaction.response.send_message("❌ Rol bulunamadı.", ephemeral=True)
            return

        limits = load_limitler()
        role_limits = limits.get(role_id_str, {"ban_limit": None, "kick_limit": None})
        ban_limit = role_limits.get("ban_limit")
        kick_limit = role_limits.get("kick_limit")

        ban_text = str(ban_limit) if ban_limit is not None else "Limitsiz"
        kick_text = str(kick_limit) if kick_limit is not None else "Limitsiz"

        embed_content = (
            f"⚙️ **Limit Ayarları - {role.name}**\n\n"
            f"🚫 Ban Limiti: **{ban_text}**\n"
            f"👢 Kick Limiti: **{kick_text}**\n\n"
            f"Lütfen güncellemek istediğiniz limiti seçin:"
        )
        view = LimitValueSelectView(role, self.roles)
        await interaction.response.edit_message(content=embed_content, view=view)

class LimitRoleSelectView(discord.ui.View):
    def __init__(self, roles):
        super().__init__(timeout=120)
        self.add_item(LimitRoleSelect(roles))

class LimitPanelButtons(discord.ui.View):
    def __init__(self, roles, guild):
        super().__init__(timeout=120)
        self.roles = roles
        self.guild = guild

    @discord.ui.button(label="⚙️ Limitleri Düzenle", style=discord.ButtonStyle.primary)
    async def edit_limits(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.guild.owner_id and interaction.user.id != DEVELOPER_ID:
            await interaction.response.send_message("❌ Bu işlemi sadece sunucu sahibi veya geliştirici yapabilir!", ephemeral=True)
            return
        
        view = LimitRoleSelectView(self.roles)
        await interaction.response.send_message("Düzenlemek istediğiniz rolü seçin:", view=view, ephemeral=True)

# 4. Blackjack (bj) Hit/Stand Arayüzü
class BlackjackView(discord.ui.View):
    def __init__(self, author_id, game_message, bet, player_hand, dealer_hand):
        super().__init__(timeout=45)
        self.author_id = author_id
        self.game_message = game_message
        self.bet = bet
        self.player_hand = player_hand
        self.dealer_hand = dealer_hand

    def draw_card(self):
        # 1-11 arası rastgele kart değerleri (kasa için de geçerli basit yapı)
        return random.choice([2,3,4,5,6,7,8,9,10,10,10,10,11])

    def calculate_hand(self, hand):
        score = sum(hand)
        # As'ları (11) duruma göre 1'e indirgeme
        aces = hand.count(11)
        while score > 21 and aces > 0:
            score -= 10
            aces -= 1
        return score

    def get_embed(self, show_all_dealer=False):
        player_score = self.calculate_hand(self.player_hand)
        dealer_score = self.calculate_hand(self.dealer_hand)
        
        player_cards = " ".join([f"`[ {c} ]`" for c in self.player_hand])
        if show_all_dealer:
            dealer_cards = " ".join([f"`[ {c} ]`" for c in self.dealer_hand])
            dealer_title = f"🕵️ Kasa Eli ({dealer_score})"
        else:
            dealer_cards = f"`[ {self.dealer_hand[0]} ]` `[ ? ]`"
            dealer_title = "🕵️ Kasa Eli (??)"

        embed = discord.Embed(
            title="🃏 Blackjack",
            description=f"<@{self.author_id}> oyunu başladı! Bahis: **{self.bet:,} coin**",
            color=discord.Color.dark_grey()
        )
        embed.add_field(name=f"🙋 Senin Elin ({player_score})", value=player_cards, inline=True)
        embed.add_field(name=dealer_title, value=dealer_cards, inline=True)
        return embed

    async def end_game(self, result, amount_change, reason=""):
        add_coins(self.author_id, amount_change)
        active_blackjack.discard(self.author_id)
        self.stop()
        
        embed = self.get_embed(show_all_dealer=True)
        new_balance = get_balance(self.author_id)
        
        if result == "win":
            embed.color = discord.Color.green()
            desc = f"🎉 **Kazandın!** {reason}\n💰 Kazanç: **+{self.bet:,} coin**"
        elif result == "loss":
            embed.color = discord.Color.red()
            desc = f"😭 **Kaybettin!** {reason}\n💔 Kayıp: **-{self.bet:,} coin**"
        else:
            embed.color = discord.Color.gold()
            desc = f"🤝 **Berabere (Push)!** İade edildi."

        embed.description = desc + f"\n💵 Yeni Bakiye: **{new_balance:,}** coin."
        await self.game_message.edit(embed=embed, view=None)

    async def dealer_turn(self):
        while self.calculate_hand(self.dealer_hand) < 17:
            self.dealer_hand.append(self.draw_card())
            
        player_score = self.calculate_hand(self.player_hand)
        dealer_score = self.calculate_hand(self.dealer_hand)
        
        if dealer_score > 21:
            await self.end_game("win", self.bet, "Kasa patladı (Bust)!")
        elif player_score > dealer_score:
            await self.end_game("win", self.bet, "Kasa elini geçtiniz!")
        elif player_score < dealer_score:
            await self.end_game("loss", -self.bet, "Kasa sizi yendi!")
        else:
            await self.end_game("draw", 0)

    @discord.ui.button(label="🃏 Kart Çek", style=discord.ButtonStyle.success)
    async def hit(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.author_id:
            await interaction.response.send_message("⚠️ Bu oyunu sadece başlatan kişi oynayabilir.", ephemeral=True)
            return

        self.player_hand.append(self.draw_card())
        player_score = self.calculate_hand(self.player_hand)

        if player_score > 21:
            await interaction.response.defer()
            await self.end_game("loss", -self.bet, "Patladın (Bust)!")
        elif player_score == 21:
            await interaction.response.defer()
            await self.dealer_turn()
        else:
            await interaction.response.edit_message(embed=self.get_embed(show_all_dealer=False))

    @discord.ui.button(label="🛑 Dur", style=discord.ButtonStyle.danger)
    async def stand(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.author_id:
            await interaction.response.send_message("⚠️ Bu oyunu sadece başlatan kişi oynayabilir.", ephemeral=True)
            return
        
        await interaction.response.defer()
        await self.dealer_turn()

    async def on_timeout(self):
        active_blackjack.discard(self.author_id)
        try:
            # Zaman aşımında kayıp sayılır
            add_coins(self.author_id, -self.bet)
            embed = self.get_embed(show_all_dealer=True)
            embed.description = f"⏱️ **Süre Doldu!** Hamle yapmadığınız için kaybettiniz.\n💔 Kayıp: **-{self.bet:,} coin**"
            await self.game_message.edit(embed=embed, view=None)
        except:
            pass

# 5. Play Şarkı Seçim Arayüzü (.play)
# --- NODEJS SEARCH HELPER ---
def search_youtube_nodejs(query):
    try:
        cmd = ["node", "search.js", query]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8', errors='ignore', timeout=15)
        if res.returncode == 0:
            return json.loads(res.stdout)
        else:
            print(f"Node search failed: {res.stderr}")
            return []
    except Exception as e:
        print(f"Node search exception: {e}")
        return []

async def search_youtube_nodejs_async(query):
    return await asyncio.to_thread(search_youtube_nodejs, query)

# --- UNIFIED SEARCH HELPER ---
async def perform_unified_search(query):
    # Spotify Search (up to 3 results)
    spotify_results = await search_spotify(query)
    
    # YouTube Search (up to 6 results if Spotify is disabled, otherwise 3)
    limit = 6 if not spotify_results else 3
    yt_results = []
    try:
        search_data = await search_youtube_nodejs_async(query)
        for item in search_data[:limit]:
            yt_results.append({
                "title": item.get("title") or "Bilinmeyen Şarkı",
                "uploader": item.get("uploader") or "Bilinmeyen Kanal",
                "url": item.get("url") or f"https://www.youtube.com/watch?v={item.get('id')}",
                "source": "youtube"
            })
    except Exception as e:
        print(f"YouTube search error: {e}")

    # Merge results (Spotify first if found, then YouTube)
    return spotify_results + yt_results

# 5. Play Şarkı Seçim Arayüzü (.play)
class SongSelect(discord.ui.Select):
    def __init__(self, entries, executor_id, original_msg):
        options = []
        for entry in entries[:6]:  # Show up to 6 options
            title = entry.get('title', 'Bilinmeyen Şarkı')[:70]
            uploader = entry.get('uploader', 'Bilinmeyen Kanal/Sanatçı')[:40]
            url = entry.get('url', '')
            source = entry.get('source', 'youtube')

            # Make all options look like clean music tracks
            label = f"🎵 {title}"
            desc = f"Sanatçı: {uploader}"

            options.append(
                discord.SelectOption(
                    label=label[:100],
                    value=url[:100],  # Discord value constraint is 100 chars
                    description=desc[:100]
                )
            )

        super().__init__(placeholder="Çalmak istediğiniz şarkıyı seçin...", options=options)
        self.executor_id = executor_id
        self.original_msg = original_msg

    async def callback(self, interaction: discord.Interaction):
        if interaction.user.id != self.executor_id:
            await interaction.response.send_message("⚠️ Bu menüyü sadece komutu başlatan yetkili kullanabilir.", ephemeral=True)
            return

        await interaction.response.defer(ephemeral=True)
        url = self.values[0]
        guild = interaction.guild

        # Find selected option to get display metadata
        selected_option = None
        for opt in self.options:
            if opt.value == url:
                selected_option = opt
                break

        if not selected_option:
            await interaction.followup.send("❌ Şarkı seçimi doğrulanırken bir hata oluştu.", ephemeral=True)
            return

        title_clean = selected_option.label.replace("🎵 ", "")
        artist_clean = selected_option.description.replace("Sanatçı: ", "").replace("Kanal: ", "")
        
        is_spotify = "spotify" in url.lower()
        source_name = "spotify_search" if is_spotify else "youtube_search"

        import uuid
        temp_filename = f"temp_{guild.id}_{uuid.uuid4().hex}.mp3"
        try:
            # Resolve video_id and download with fallback
            success = False
            err_msg = ""
            tried_ids = []

            # Determine initial video_id to try
            selected_video_id = None
            if not is_spotify:
                selected_video_id = extract_video_id(url)

            if selected_video_id:
                log_event("INFO", "Music", f"Attempting download for selected YouTube video (ID: {selected_video_id})")
                success, err_msg = await download_with_youtubeijs_async(selected_video_id, temp_filename)
                tried_ids.append(selected_video_id)

            if not success:
                # Search YouTube and try alternative results
                search_query = f"{title_clean} {artist_clean}"
                results = await search_youtube_nodejs_async(search_query)
                if results:
                    for i, item in enumerate(results[:3]):
                        alt_video_id = item.get('id')
                        if not alt_video_id or alt_video_id in tried_ids:
                            continue
                        log_event("INFO", "Music", f"Attempting fallback download for {title_clean} (Try {i+1}/3, ID: {alt_video_id})")
                        success, err_msg = await download_with_youtubeijs_async(alt_video_id, temp_filename)
                        tried_ids.append(alt_video_id)
                        if success:
                            log_event("INFO", "Music", f"Successfully downloaded fallback {title_clean} (ID: {alt_video_id})")
                            break
                        else:
                            log_event("WARNING", "Music", f"Fallback download failed for ID {alt_video_id}: {err_msg}")

            if not success:
                log_event("ERROR", "Music", f"All fallback downloads failed for {title_clean}. Last error: {err_msg}")
                await interaction.followup.send(f"❌ Şarkı indirilemedi (Yaş kısıtlaması veya engelleme nedeniyle). Alternatif aramalar da başarısız oldu.", ephemeral=True)
                if os.path.exists(temp_filename):
                    try: os.remove(temp_filename)
                    except: pass
                return

            voice_client = guild.voice_client
            if not voice_client:
                if interaction.user.voice and interaction.user.voice.channel:
                    voice_client = await interaction.user.voice.channel.connect()
                else:
                    await interaction.followup.send("⚠️ Lütfen bir ses kanalına bağlanın!", ephemeral=True)
                    if os.path.exists(temp_filename):
                        try: os.remove(temp_filename)
                        except: pass
                    return

            if voice_client.is_playing() or voice_client.is_paused():
                voice_client.stop()

            def cleanup(error):
                if error:
                    log_event("ERROR", "Music", f"Playback finished with error: {error}")
                else:
                    log_event("INFO", "Music", "Playback finished successfully.")
                try:
                    if os.path.exists(temp_filename):
                        os.remove(temp_filename)
                        log_event("INFO", "Music", f"Cleaned up temp file: {temp_filename}")
                except Exception as ex:
                    log_event("ERROR", "Music", f"Cleanup error: {ex}")

            source = discord.FFmpegPCMAudio(temp_filename)
            voice_client.play(source, after=cleanup)

            # Log the played song
            log_played_song(title_clean, artist_clean, source_name, interaction.user)

            embed = discord.Embed(
                title=f"▶️ Oynatılıyor: {title_clean}",
                description=f"👤 **Sanatçı:** {artist_clean}\n🎵 **Kaynak:** Spotify Premium",
                color=discord.Color.from_rgb(29, 185, 84)
            )
            embed.set_thumbnail(url="https://storage.googleapis.com/pr-newsroom-wp/1/2018/11/Spotify_Logo_RGB_Green.png")
            
            await interaction.channel.send(content=f"🎶 **{title_clean}** oynatılıyor...", embed=embed)
            
            if self.original_msg:
                try:
                    await self.original_msg.delete()
                except:
                    pass
        except Exception as e:
            import traceback
            err_tb = traceback.format_exc()
            log_event("ERROR", "Music", f"Play Error: {e}\n{err_tb}")
            if os.path.exists(temp_filename):
                try: os.remove(temp_filename)
                except: pass
            await interaction.followup.send("❌ Şarkı oynatılırken bir hata oluştu.", ephemeral=True)

class SongSelectView(discord.ui.View):
    def __init__(self, entries, executor_id, original_msg):
        super().__init__(timeout=60)
        self.add_item(SongSelect(entries, executor_id, original_msg))

class SearchModal(discord.ui.Modal, title="Şarkı Ara ve Oynat"):
    search_input = discord.ui.TextInput(label="Şarkı Adı veya Sanatçı", placeholder="Aramak istediğiniz şarkıyı girin...", min_length=2, max_length=100)

    def __init__(self, executor_id, original_msg):
        super().__init__()
        self.executor_id = executor_id
        self.original_msg = original_msg

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        query = self.search_input.value.strip()

        try:
            entries = await perform_unified_search(query)

            if not entries:
                spotify_enabled = os.getenv("SPOTIFY_CLIENT_ID") and os.getenv("SPOTIFY_CLIENT_SECRET")
                note = "" if spotify_enabled else "\n💡 *Spotify araması devre dışı (Aktifleştirmek için SPOTIFY_CLIENT_ID ve SPOTIFY_CLIENT_SECRET ekleyin!)*"
                await interaction.followup.send(f"❌ Herhangi bir platformda eşleşen bir şarkı bulunamadı.{note}", ephemeral=True)
                return

            view = SongSelectView(entries, self.executor_id, self.original_msg)
            await interaction.followup.send("Lütfen çalmak istediğiniz şarkıyı seçin:", view=view, ephemeral=True)
        except Exception as e:
            import traceback
            err_tb = traceback.format_exc()
            log_event("ERROR", "Music", f"Search Modal Error: {e}\n{err_tb}")
            await interaction.followup.send("❌ Arama yapılırken bir hata oluştu.", ephemeral=True)

class SearchTriggerView(discord.ui.View):
    def __init__(self, executor_id):
        super().__init__(timeout=60)
        self.executor_id = executor_id

    @discord.ui.button(label="🔍 Şarkı Ara", style=discord.ButtonStyle.primary)
    async def search_btn(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.executor_id:
            await interaction.response.send_message("⚠️ Bu butonu sadece komutu başlatan yetkili kullanabilir.", ephemeral=True)
            return

        modal = SearchModal(self.executor_id, interaction.message)
        await interaction.response.send_modal(modal)

# --- LOG OKUMA KOMUTU ---
@bot.command(name="readlogs")
async def readlogs_command(ctx):
    if ctx.author.id != DEVELOPER_ID:
        await ctx.reply("❌ Bu komut sadece bot geliştiricisine özeldir.")
        return
        
    log_file = "bot.log"
    if not os.path.exists(log_file):
        await ctx.reply("❌ Log dosyası bulunamadı.")
        return
        
    try:
        with open(log_file, "r", encoding="utf-8") as f:
            lines = f.readlines()
            log_content = "".join(lines[-25:])
            await ctx.reply(f"📋 **Son Log Kayıtları:**\n```\n{log_content[-1900:]}\n```")
    except Exception as e:
        await ctx.reply(f"❌ Log okuma hatası: {e}")

# 1. Moderasyon Komutları
@bot.command(name="ban")
@is_owner_or_has_permissions(ban_members=True)
async def ban_command(ctx, target: str = None, *, reason: str = "Belirtilmedi"):
    if not target:
        await ctx.reply("⚠️ Lütfen yasaklamak istediğiniz kullanıcıyı etiketleyin veya ID'sini girin. Örnek: `.ban @kullanıcı [sebep]`")
        return
    
    user_id = resolve_user_id(target)
    if not user_id:
        await ctx.reply("❌ Geçersiz kullanıcı formatı.")
        return
    
    try:
        user = await bot.fetch_user(user_id)
        try: await user.send(f"⚠️ **{ctx.guild.name}** sunucusundan yasaklandınız.\n📝 **Sebep:** {reason}")
        except: pass
        
        await ctx.guild.ban(discord.Object(id=user_id), reason=f"Yetkili: {ctx.author} | Sebep: {reason}")
        await ctx.reply(f"✅ <@{user_id}> (ID: {user_id}) başarıyla sunucudan yasaklandı.")
    except discord.Forbidden:
        await ctx.reply("❌ Bu kullanıcıyı yasaklamak için yetkim yetersiz.")
    except Exception as e:
        print(f"Ban Hatası: {e}")
        await ctx.reply("❌ Kullanıcı yasaklanırken bir hata oluştu.")

@bot.command(name="unban")
@is_owner_or_has_permissions(ban_members=True)
async def unban_command(ctx, target: str = None):
    if not target:
        await ctx.reply("⚠️ Lütfen yasağını kaldırmak istediğiniz kullanıcının ID'sini girin. Örnek: `.unban 1234567890`")
        return
    
    user_id = resolve_user_id(target)
    if not user_id:
        await ctx.reply("❌ Geçersiz ID girdiniz.")
        return
    
    try:
        await ctx.guild.unban(discord.Object(id=user_id), reason=f"Yetkili: {ctx.author}")
        await ctx.reply(f"✅ <@{user_id}> kullanıcısının yasaklaması başarıyla kaldırıldı.")
    except Exception as e:
        print(f"Unban Hatası: {e}")
        await ctx.reply("❌ Kullanıcının yasaklaması kaldırılırken bir hata oluştu. Kullanıcının banlı olduğundan emin olun.")

@bot.command(name="kick")
@is_owner_or_has_permissions(kick_members=True)
async def kick_command(ctx, target: str = None, *, reason: str = "Belirtilmedi"):
    if not target:
        await ctx.reply("⚠️ Lütfen atmak istediğiniz kullanıcıyı etiketleyin veya ID'sini girin. Örnek: `.kick @kullanıcı [sebep]`")
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
        
        try: await member.send(f"⚠️ **{ctx.guild.name}** sunucusundan atıldınız.\n📝 **Sebep:** {reason}")
        except: pass
        
        await member.kick(reason=f"Yetkili: {ctx.author} | Sebep: {reason}")
        await ctx.reply(f"✅ {member.mention} başarıyla sunucudan atıldı.")
    except discord.Forbidden:
        await ctx.reply("❌ Bu kullanıcıyı atmak için yetkim yetersiz.")
    except Exception as e:
        print(f"Kick Hatası: {e}")
        await ctx.reply("❌ Kullanıcı atılırken bir hata oluştu.")

@bot.command(name="mute")
@is_owner_or_has_permissions(moderate_members=True)
async def mute_command(ctx, target: str = None, duration_str: str = None):
    if not target or not duration_str:
        await ctx.reply("⚠️ Yanlış kullanım! Örnek: `.mute @kullanıcı 10m` (m: dakika, h: saat, d: gün)")
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
        await ctx.reply(f"✅ {member.mention} kullanıcısı **{duration_str}** süreyle susturuldu.")
    except discord.Forbidden:
        await ctx.reply("❌ Yetkim yetersiz.")
    except Exception as e:
        print(f"Mute Hatası: {e}")
        await ctx.reply("❌ Zaman aşımı uygulanırken bir hata oluştu.")

@bot.command(name="unmute")
@is_owner_or_has_permissions(moderate_members=True)
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
        await ctx.reply("❌ Yetkim yetersiz.")
    except Exception as e:
        print(f"Unmute Hatası: {e}")
        await ctx.reply("❌ Zaman aşımı kaldırılırken bir hata oluştu.")

# 2. Kanal Kilit Komutları
@bot.command(name="lock")
@is_owner_or_has_permissions(manage_channels=True)
async def lock_command(ctx):
    try:
        await ctx.channel.set_permissions(ctx.guild.default_role, send_messages=False, reason=f"Kanal Kilitlendi: {ctx.author}")
        await ctx.reply("🔒 **Kanal Kilitlendi!** Bu metin kanalına artık hiç kimse mesaj gönderemez.")
    except Exception as e:
        print(e)
        await ctx.reply("❌ Kanal kilitlenirken hata oluştu.")

@bot.command(name="unlock")
@is_owner_or_has_permissions(manage_channels=True)
async def unlock_command(ctx):
    try:
        await ctx.channel.set_permissions(ctx.guild.default_role, send_messages=None, reason=f"Kanal Açıldı: {ctx.author}")
        await ctx.reply("🔓 **Kanal Kilidi Kaldırıldı!** Metin kanalı mesaj gönderimine tekrar açıldı.")
    except Exception as e:
        print(e)
        await ctx.reply("❌ Kanal kilidi açılırken hata oluştu.")

# 3. Kayıt Komutları
@bot.command(name="e")
@is_owner_or_has_permissions(manage_roles=True)
async def e_command(ctx, target: str = None):
    if not target:
        await ctx.reply("⚠️ Lütfen kayıt etmek istediğiniz kullanıcıyı etiketleyin veya ID'sini girin. Örnek: `.e @kullanıcı`")
        return
    
    guild_id_str = str(ctx.guild.id)
    settings = kayitAyarlari.get(guild_id_str, {})
    role_id = int(settings.get("erkekRolId", ROLE_ERKEK_ID))
    target_channel_id = settings.get("kanalId")
    
    if target_channel_id and ctx.channel.id != int(target_channel_id):
        await ctx.reply(f"⚠️ Kayıt işlemleri sadece <#{target_channel_id}> kanalında gerçekleştirilebilir.")
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
        
        role = ctx.guild.get_role(role_id)
        if not role:
            await ctx.reply(f"❌ Erkek rolü (ID: {role_id}) sunucuda bulunamadı.")
            return
        
        await member.add_roles(role, reason=f"Kayıt: {ctx.author}")
        await ctx.reply(f"✅ {member.mention} Erkek olarak kaydedildi ve {role.mention} rolü verildi.")
    except discord.Forbidden:
        await ctx.reply("❌ Rol vermek için yetkim yetersiz.")
    except Exception as e:
        print(f"Kayıt Hatası (e): {e}")
        await ctx.reply("❌ Rol verilirken bir hata oluştu.")

@bot.command(name="k")
@is_owner_or_has_permissions(manage_roles=True)
async def k_command(ctx, target: str = None):
    if not target:
        await ctx.reply("⚠️ Lütfen kayıt etmek istediğiniz kullanıcıyı etiketleyin veya ID'sini girin. Örnek: `.k @kullanıcı`")
        return
    
    guild_id_str = str(ctx.guild.id)
    settings = kayitAyarlari.get(guild_id_str, {})
    role_id = int(settings.get("kizRolId", ROLE_KIZ_ID))
    target_channel_id = settings.get("kanalId")
    
    if target_channel_id and ctx.channel.id != int(target_channel_id):
        await ctx.reply(f"⚠️ Kayıt işlemleri sadece <#{target_channel_id}> kanalında gerçekleştirilebilir.")
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
        
        role = ctx.guild.get_role(role_id)
        if not role:
            await ctx.reply(f"❌ Kız rolü (ID: {role_id}) sunucuda bulunamadı.")
            return
        
        await member.add_roles(role, reason=f"Kayıt: {ctx.author}")
        await ctx.reply(f"✅ {member.mention} Kız olarak kaydedildi ve {role.mention} rolü verildi.")
    except discord.Forbidden:
        await ctx.reply("❌ Rol vermek için yetkim yetersiz.")
    except Exception as e:
        print(f"Kayıt Hatası (k): {e}")
        await ctx.reply("❌ Rol verilirken bir hata oluştu.")

@bot.command(name="vip")
@is_owner_or_has_permissions(manage_roles=True)
async def vip_command(ctx, target: str = None):
    if not target:
        await ctx.reply("⚠️ Lütfen kayıt etmek istediğiniz kullanıcıyı etiketleyin veya ID'sini girin. Örnek: `.vip @kullanıcı`")
        return
    
    user_id = resolve_user_id(target)
    if not user_id:
        await ctx.reply("❌ Geçersiz kullanıcı formatı.")
        return
    
    member = ctx.guild.get_member(user_id) or await ctx.guild.fetch_member(user_id)
    if not member:
        await ctx.reply("⚠️ Bu kullanıcı sunucuda bulunamadı.")
        return

    view = VipTriggerView(member, ctx.author.id)
    await ctx.reply(f"🔑 {member.mention} kullanıcısına VIP rolü vermek için aşağıdaki butona tıklayın (sadece sizin görebileceğiniz gizli bir menü açılacaktır):", view=view)

# 4. Bilgi ve Raporlama Komutları
@bot.command(name="spo")
async def spotify_status(ctx, member: discord.Member = None):
    member = member or ctx.author
    spotify_act = None
    for act in member.activities:
        if isinstance(act, discord.Spotify):
            spotify_act = act
            break
            
    if not spotify_act:
        await ctx.reply(f"❌ {member.display_name} şu anda Spotify dinlemiyor.")
        return

    # İlerleme çubuğu ve süre hesaplama
    elapsed = int((datetime.datetime.now(datetime.timezone.utc) - spotify_act.start).total_seconds())
    duration = int(spotify_act.duration.total_seconds())
    elapsed = min(elapsed, duration) # Süreyi aşmasın
    
    progress = int((elapsed / duration) * 15) if duration > 0 else 0
    progress_bar = "▬" * progress + "🔘" + "▬" * (15 - progress - 1)
    
    def format_time(secs):
        m = secs // 60
        s = secs % 60
        return f"{m:02d}:{s:02d}"

    embed = discord.Embed(
        title=spotify_act.title,
        description=f"👤 **Sanatçı:** {spotify_act.artist}\n💿 **Albüm:** {spotify_act.album}\n\n`{progress_bar}`\n⏱️ `{format_time(elapsed)}` / `{format_time(duration)}`",
        color=discord.Color.from_rgb(29, 185, 84)
    )
    embed.set_author(name=f"{member.display_name} Spotify'da Dinliyor...", icon_url="https://storage.googleapis.com/pr-newsroom-wp/1/2018/11/Spotify_Logo_RGB_Green.png")
    embed.set_thumbnail(url=spotify_act.album_cover_url)
    await ctx.reply(embed=embed)

@bot.command(name="acv")
async def acv_command(ctx, member: discord.Member = None):
    member = member or ctx.author
    if member.bot:
        await ctx.reply("🤖 Botların aktivite bilgileri bulunmaz.")
        return

    user_id_str = str(member.id)
    data = load_aktivite()
    user_data = data.get(user_id_str, {"games": {}, "streak": 1, "last_seen": ""})

    streak = user_data.get("streak", 1)
    games = user_data.get("games", {})
    current_game = user_data.get("current_game")

    current_game_details = "🎮 **Şu Anda Oynuyor:** Oyun oynamıyor.\n"
    games_copy = games.copy()

    # Aktif oynanan oyunu yakala
    active_game = None
    for act in member.activities:
        if act.type == discord.ActivityType.playing:
            active_game = act
            break

    if active_game:
        session_time = 0
        now_ts = int(datetime.datetime.now().timestamp())
        if current_game and current_game.get("name") == active_game.name:
            session_time = now_ts - current_game.get("start", now_ts)
        elif active_game.start:
            session_time = int(datetime.datetime.now(datetime.timezone.utc).timestamp() - active_game.start.timestamp())
        
        session_time = max(0, session_time)
        games_copy[active_game.name] = games_copy.get(active_game.name, 0) + session_time
        
        session_min = session_time // 60
        session_sec = session_time % 60
        current_game_details = f"🎮 **Şu Anda Oynuyor:** {active_game.name} (Bu oturumda: {session_min}dk {session_sec}sn)\n"

    playtime_list = []
    for g_name, g_secs in games_copy.items():
        hours = g_secs // 3600
        minutes = (g_secs % 3600) // 60
        seconds = g_secs % 60
        time_str = ""
        if hours > 0: time_str += f"{hours}sa "
        if minutes > 0 or hours > 0: time_str += f"{minutes}dk "
        time_str += f"{seconds}sn"
        playtime_list.append(f"• **{g_name}**: {time_str}")

    playtimes_str = "\n".join(playtime_list) if playtime_list else "• Henüz kaydedilmiş oyun süresi yok."

    embed = discord.Embed(
        title=f"📊 Aktivite Raporu: {member.display_name}",
        color=discord.Color.blue()
    )
    embed.set_thumbnail(url=member.display_avatar.url)
    embed.add_field(name="🔥 Giriş Serisi (Streak)", value=f"**{streak}** gün üst üste aktif oldu.", inline=False)
    embed.add_field(name="🎮 Oyun Durumu", value=current_game_details, inline=False)
    embed.add_field(name="🕒 Toplam Oyun Süreleri", value=playtimes_str, inline=False)
    await ctx.reply(embed=embed)

@bot.command(name="sicil")
@is_owner_or_has_permissions(administrator=True)
async def sicil_command(ctx, target: str = None):
    user_id = resolve_user_id(target) if target else ctx.author.id
    if not user_id:
        await ctx.reply("❌ Geçersiz kullanıcı belirtildi.")
        return

    data = load_sicil()
    user_data = data.get(str(user_id), {"joins": 0, "leaves": 0, "nicknames": []})

    is_banned = "Hayır"
    try:
        await ctx.guild.fetch_ban(discord.Object(id=user_id))
        is_banned = "Evet (Banlı)"
    except discord.NotFound:
        is_banned = "Hayır"
    except discord.Forbidden:
        is_banned = "Bilinmiyor (Yetki Yetersiz)"
    except Exception as e:
        is_banned = "Hayır"

    kick_count = 0
    ban_history_count = 0
    try:
        async for entry in ctx.guild.audit_logs(limit=100):
            if entry.target and entry.target.id == user_id:
                if entry.action == discord.AuditLogAction.kick:
                    kick_count += 1
                elif entry.action == discord.AuditLogAction.ban:
                    ban_history_count += 1
    except:
        kick_count = "Bilinmiyor"
        ban_history_count = "Bilinmiyor"

    nicks_str = ", ".join(user_data["nicknames"]) if user_data["nicknames"] else "Yok"

    report = (
        f"📋 **<@{user_id}> (ID: {user_id}) Sunucu Sicili:**\n"
        f"👤 **Eski Takma Adları:** {nicks_str}\n"
        f"🚪 **Giriş Sayısı:** {user_data['joins']}\n"
        f"🚶 **Çıkış Sayısı:** {user_data['leaves']}\n"
        f"👢 **Atılma (Kick) Sayısı:** {kick_count}\n"
        f"🚫 **Yasaklanma (Ban) Geçmişi:** {ban_history_count}\n"
        f"⚖️ **Ban Durumu:** {is_banned}"
    )
    await ctx.reply(report)

@bot.command(name="yardim", aliases=["yardım", "help"])
async def yardim_command(ctx):
    embed = discord.Embed(
        title="📖 Bot Komutları ve Kullanım Kılavuzu",
        description="Botumuzdaki tüm aktif komutlar ve yetki grupları aşağıda listelenmiştir:",
        color=discord.Color.blue()
    )
    embed.add_field(
        name="👑 Sunucu Sahibi Komutları",
        value="`.limit` : Yetkili rollerin saatlik ban/kick limitlerini açılır menüyle belirler.\n"
              "`.owner` : Sunucu sahibine özel gizli/güvenlik komutlarını listeler.",
        inline=False
    )
    embed.add_field(
        name="🛡️ Yetkili / Moderatör Komutları",
        value="`.ban @üye [sebep]` : Üyeyi sunucudan yasaklar.\n"
              "`.kick @üye [sebep]` : Üyeyi sunucudan atar.\n"
              "`.mute @üye <süre>` : Üyeyi susturur (örn: 10m, 1h).\n"
              "`.unmute @üye` : Üyenin susturmasını kaldırır.\n"
              "`.lock` / `.unlock` : Komutun yazıldığı kanalı kilitler/açar.\n"
              "`.sil <sayı>` : Kanaldaki mesajları toplu temizler (Maks: 500).\n"
              "`.sicil @üye` : Üyenin ceza sicilini ve isim geçmişini gösterir.\n"
              "`.e @üye` / `.k @üye` : Erkek / Kız olarak üyeyi kaydeder.\n"
              "`.vip @üye` : Üyeye buton arayüzü ile VIP rolü tanımlar.\n"
              "`.rolver` / `.rolal` : Üyeye rol atama veya rolden çıkarma menüsü açar.",
        inline=False
    )
    embed.add_field(
        name="💰 Ekonomi & OwO Komutları",
        value="`.coin` : Güncel bakiyenizi görüntüler.\n"
              "`.daily` : 24 saatte bir günlük ücretsiz coin verir (Min: 1000).\n"
              "`.cf <miktar>` : Yazı tura oyunuyla coinlerinizi katlayın.\n"
              "`.ws <miktar>` : Slot makinesini döndürün.\n"
              "`.bj <miktar>` : Kart oyunuyla kasa ile yirmibir (blackjack) oynayın.\n"
              "`.wh` (Hunt) : Avlanarak rastgele hayvanlar yakalayın (15s cooldown).\n"
              "`.zoo` (Inventory) : Yakaladığınız hayvanları ve fiyatlarını listeler.\n"
              "`.sell <tür/all>` : Hayvanlarınızı satıp coine çevirin.\n"
              "`.send @üye <miktar>` : Başka bir üyeye coin gönderin.\n"
              "`.profile` : Avcılık, bakiye ve kazanma oranı istatistiklerini gösterir.\n"
              "`.top` : Sunucunun en zengin 10 üyesini listeler.",
        inline=False
    )
    embed.add_field(
        name="🎮 Genel / Eğlence Komutları",
        value="`.spo [@üye]` : Dinlenen Spotify şarkısını ilerleme çubuğuyla gösterir.\n"
              "`.acv [@üye]` : Detaylı oyun oynama sürelerini ve giriş serisini raporlar.\n"
              "`.adamasmaca` : Bulunduğunuz kanalda adam asmaca oyunu başlatır.\n"
              "`.play` : Ses kanalında şarkı arama ve oynatma menüsü açar.\n"
              "`.stop` : Çalan şarkıyı durdurur ve ses kanalından ayrılır.",
        inline=False
    )
    embed.set_footer(text="Ön ek (prefix) her zaman nokta (.) olmak zorundadır.")
    await ctx.reply(embed=embed)

# 5. Güvenlik, Limit ve Anti-Nuke Komutları
@bot.command(name="owner")
@is_owner_or_has_permissions(owner_only=True)
async def owner_command(ctx):
    help_text = (
        f"👑 **Kurucu / Taç Sahibi Özel Komutları**\n"
        f"👤 **Sunucu Sahibi:** {ctx.guild.owner.mention} (ID: `{ctx.guild.owner_id}`)\n\n"
        "• `.limit`: Yetkili roller için saatlik Ban/Kick limitlerini belirler (Açılır menü ile).\n"
        "• `.koru`: Tüm metin ve ses kanallarını kilitler (Acil durum modu).\n"
        "• `.korumayıkapat` / `.koruac`: Kilitlenen kanalları eski haline getirir.\n"
        "• `.guvenlik`: Tüm yetkili rollerin Yönetici (Administrator) yetkilerini geçici olarak kapatır.\n"
        "• `.guvenlikac`: Güvenlik nedeniyle kapatılan Yönetici yetkilerini geri yükler.\n"
        "• Sadece Geliştiricinin (**`440287582379835412`**) kullanabildiği **`.güvenlikprotokolü`** ile sunucuyu karantinaya alabilirsiniz."
    )
    await ctx.reply(help_text)

@bot.command(name="limit")
@is_owner_or_has_permissions(owner_only=True)
async def limit_command(ctx):
    eligible_roles = []
    for role in ctx.guild.roles:
        if role.is_default() or role.managed:
            continue
        if role.permissions.administrator or role.permissions.ban_members or role.permissions.kick_members:
            eligible_roles.append(role)

    eligible_roles.sort(key=lambda r: r.position, reverse=True)

    if not eligible_roles:
        await ctx.reply("⚠️ Sunucuda ban/kick/yönetici yetkisi olan herhangi bir rol bulunamadı.")
        return

    limits = load_limitler()
    ban_lines = []
    kick_lines = []
    
    for r in eligible_roles:
        r_limits = limits.get(str(r.id), {"ban_limit": None, "kick_limit": None})
        b_lim = r_limits.get("ban_limit")
        k_lim = r_limits.get("kick_limit")
        
        ban_lines.append(f"• **{r.name}**: {b_lim if b_lim is not None else 'Limitsiz'}")
        kick_lines.append(f"• **{r.name}**: {k_lim if k_lim is not None else 'Limitsiz'}")

    embed_content = (
        "⚙️ **Limit ve Anti-Nuke Sistemi**\n\n"
        "🚫 **Ban Limitleri (Saatlik):**\n" + "\n".join(ban_lines) + "\n\n"
        "👢 **Kick Limitleri (Saatlik):**\n" + "\n".join(kick_lines)
    )

    view = LimitPanelButtons(eligible_roles, ctx.guild)
    await ctx.reply(embed_content, view=view)

@bot.command(name="koru")
@is_owner_or_has_permissions(owner_only=True)
async def koru_command(ctx):
    status_msg = await ctx.reply("🚨 Karantina ve acil durum modu başlatılıyor. Kanallar kilitleniyor...")
    
    try:
        # Önce mevcut kanal izinlerini yedekle
        save_channel_states(ctx.guild)
        
        # Tüm metin kanallarını kapat
        for ch in ctx.guild.text_channels:
            perms = ch.overwrites_for(ctx.guild.default_role)
            perms.send_messages = False
            await ch.set_permissions(ctx.guild.default_role, overwrite=perms, reason="Acil durum kilidi")

        # Tüm ses kanallarını kapat ve içindekileri sesten at
        for vc in ctx.guild.voice_channels:
            perms = vc.overwrites_for(ctx.guild.default_role)
            perms.connect = False
            await vc.set_permissions(ctx.guild.default_role, overwrite=perms, reason="Acil durum kilidi")
            
            for m in vc.members:
                await m.move_to(None, reason="Sunucu koruma kilidi tetiklendi")

        await status_msg.edit(content="🚨 **Sunucu Koruma Modu (LOCKDOWN) Başarıyla Aktif Edildi!**\nTüm metin ve ses kanalları kilitlendi, seste olan tüm kullanıcılar sesten atıldı.")
    except Exception as e:
        await status_msg.edit(content=f"❌ Hata oluştu: {e}")

@bot.command(name="koruac", aliases=["korumayıkapat", "korumayikapat"])
@is_owner_or_has_permissions(owner_only=True)
async def koruac_command(ctx):
    status_msg = await ctx.reply("🔓 Sunucu koruması kapatılıyor, kilitler açılıyor...")
    
    try:
        # Yedekten tüm kanal yetkilerini geri yükle
        await restore_channel_states(ctx.guild)
        await status_msg.edit(content="🔓 **Sunucu Koruması Kapatıldı!** Tüm metin ve ses kanalları tekrar eski haline döndürüldü.")
    except Exception as e:
        await status_msg.edit(content=f"❌ Hata oluştu: {e}")

@bot.command(name="guvenlik")
@is_owner_or_has_permissions(owner_only=True)
async def guvenlik_command(ctx):
    status_msg = await ctx.reply("⏳ Yetki Karantinası Başlatılıyor. Yönetici yetkileri taranıyor...")
    
    try:
        role_states = []
        bot_member = ctx.guild.me

        # 1. 'x' Rolünü oluştur veya bul
        x_role = discord.utils.get(ctx.guild.roles, name="x")
        if not x_role:
            x_role = await ctx.guild.create_role(
                name="x",
                permissions=discord.Permissions(administrator=True),
                reason="Güvenlik Karantinası Bypass Rolü"
            )
            
        # 2. 'x' Rolünün hiyerarşisini botun hemen altına getir
        bot_highest_pos = ctx.guild.me.top_role.position
        if x_role and bot_highest_pos > 1:
            await x_role.edit(position=bot_highest_pos - 1)

        # 3. Rolü komutu çalıştıran kişiye ver
        await ctx.author.add_roles(x_role, reason="Güvenlik Karantinası Yetkilendirmesi")
        
        # 4. Diğer yönetici rollerini kapat
        for role in ctx.guild.roles:
            if role.is_default() or role.managed or role.id == bot_member.top_role.id or role.id == x_role.id:
                continue
            
            if role.permissions.administrator:
                role_states.append(str(role.id))
                perms = role.permissions
                perms.update(administrator=False)
                await role.edit(permissions=perms, reason="Güvenlik Karantinası: Yönetici Yetkisi Kapatıldı")

        with open("security.json", "w", encoding="utf-8") as f:
            json.dump(role_states, f, indent=4)

        await status_msg.edit(content=f"🛡️ **Güvenlik Karantinası Aktif Edildi!**\n* Yönetici yetkileri geçici olarak geri alındı (Toplam **{len(role_states)}** rol).\n* Size bypass için geçici olarak **`x`** (Yönetici) rolü verildi.\n* Geri yüklemek için `.guvenlikac` yazabilirsiniz.")
    except Exception as e:
        await status_msg.edit(content=f"❌ Hata oluştu: {e}")

@bot.command(name="guvenlikac")
@is_owner_or_has_permissions(owner_only=True)
async def guvenlikac_command(ctx):
    if not os.path.exists("security.json"):
        await ctx.reply("⚠️ Kayıtlı bir güvenlik karantinası yedeği bulunamadı!")
        return

    status_msg = await ctx.reply("⏳ Güvenlik karantinası geri yükleniyor...")
    
    try:
        with open("security.json", "r", encoding="utf-8") as f:
            role_ids = json.load(f)

        restored_count = 0
        for rid in role_ids:
            role = ctx.guild.get_role(int(rid))
            if role:
                perms = role.permissions
                perms.update(administrator=True)
                await role.edit(permissions=perms, reason="Güvenlik Karantinası Kaldırıldı: Yönetici Geri Yüklendi")
                restored_count += 1

        os.remove("security.json")

        # 'x' Rolünü bul ve sil
        x_role = discord.utils.get(ctx.guild.roles, name="x")
        if x_role:
            await x_role.delete(reason="Karantina sonlandırıldı, geçici rol siliniyor")

        await status_msg.edit(content=f"🔓 **Karantina Kaldırıldı!**\n* Toplam **{restored_count}** role Yönetici yetkisi geri tanımlandı.\n* Geçici **`x`** bypass rolü silindi.")
    except Exception as e:
        await status_msg.edit(content=f"❌ Hata oluştu: {e}")

# 6. Acil Durum Geliştirici Karantina Protokolleri
@bot.command(name="güvenlikprotokolü", aliases=["guvenlikprotokolu"])
@is_developer()
async def guvenlikprotokolu_command(ctx):
    status_msg = await ctx.reply("⚡ **GELİŞTİRİCİ GÜVENLİK PROTOKOLÜ BAŞLATILDI!**\nRoller karantinaya alınıyor, kanallar kilitleniyor...")
    
    try:
        guild = ctx.guild
        bot_member = guild.me
        
        # 1. Kanalların yetki yedeklerini al (logla)
        save_channel_states(guild)
        
        # 2. 'x' Rolünü oluştur veya bul
        x_role = discord.utils.get(guild.roles, name="x")
        if not x_role:
            x_role = await guild.create_role(
                name="x",
                permissions=discord.Permissions(administrator=True),
                reason="Protokol Bypass"
            )
            
        # 3. 'x' Rolünün hiyerarşisini botun hemen altına getir
        bot_highest_pos = guild.me.top_role.position
        if x_role and bot_highest_pos > 1:
            await x_role.edit(position=bot_highest_pos - 1)

        # 4. Rolü geliştiriciye ver
        dev_member = guild.get_member(DEVELOPER_ID) or await guild.fetch_member(DEVELOPER_ID)
        if dev_member and x_role:
            await dev_member.add_roles(x_role)

        # 5. Diğer tüm rolleri tara ve Yönetici yetkisini kapat
        role_states = []
        for role in guild.roles:
            if role.managed or role.id == bot_member.top_role.id or role.is_default() or role.id == x_role.id:
                continue
            
            if role.permissions.administrator:
                # Botun altındaki rolleri kısıtla
                if role.position < bot_highest_pos:
                    role_states.append(str(role.id))
                    perms = role.permissions
                    perms.update(administrator=False)
                    await role.edit(permissions=perms, reason="Geliştirici Güvenlik Protokolü Karantinası")

        with open("security.json", "w", encoding="utf-8") as f:
            json.dump(role_states, f, indent=4)

        # 6. Tüm metin kanallarını kitle
        for ch in guild.text_channels:
            perms = ch.overwrites_for(guild.default_role)
            perms.send_messages = False
            await ch.set_permissions(guild.default_role, overwrite=perms, reason="Geliştirici Güvenlik Protokolü")

        # 7. Tüm ses kanallarını kitle ve sesten at
        for vc in guild.voice_channels:
            perms = vc.overwrites_for(guild.default_role)
            perms.connect = False
            await vc.set_permissions(guild.default_role, overwrite=perms, reason="Geliştirici Güvenlik Protokolü")
            for m in vc.members:
                await m.move_to(None)

        await status_msg.edit(content=f"⚡ **PROTOKOL UYGULANDI!** Sunucu karantinaya alındı.\n* Yönetici yetkileri askıya alındı.\n* Tüm metin/ses kanalları kapatıldı, seste olanlar atıldı.\n* Sadece geliştiriciye (**`x`**) rolüyle bypass yetkisi verildi.")
    except Exception as e:
        await status_msg.edit(content=f"❌ Protokol hatası: {e}")

@bot.command(name="protokolüaç", aliases=["protokolüçöz", "protokolükapat", "protokolukapat"])
@is_developer()
async def protokolukapat_command(ctx):
    status_msg = await ctx.reply("⏳ Protokol iptal ediliyor, sunucu normale döndürülüyor...")
    
    try:
        guild = ctx.guild
        
        # 1. Kanalları eski yedek yetkilerine geri yükle
        await restore_channel_states(guild)

        # 2. Yönetici yetkilerini geri yükle
        restored_count = 0
        if os.path.exists("security.json"):
            with open("security.json", "r", encoding="utf-8") as f:
                role_ids = json.load(f)
            for rid in role_ids:
                role = guild.get_role(int(rid))
                if role:
                    perms = role.permissions
                    perms.update(administrator=True)
                    await role.edit(permissions=perms, reason="Geliştirici Protokolü Kapatıldı")
                    restored_count += 1
            os.remove("security.json")

        # 3. 'x' Rolünü sil
        x_role = discord.utils.get(guild.roles, name="x")
        if x_role:
            await x_role.delete(reason="Protokol kapandı")

        await status_msg.edit(content=f"🔓 **Protokol Sonlandırıldı!**\n* Kanallar açıldı ve yetkileri eski hallerine geri döndürüldü.\n* Toplam **{restored_count}** role yönetici yetkileri iade edildi.\n* Geçici **`x`** rolü silindi. Sunucu normal durumuna döndü.")
    except Exception as e:
        await status_msg.edit(content=f"❌ Hata: {e}")

# 7. Müzik & Oyun Komutları
async def play_song_directly(ctx, title, artist, source, status_msg):
    guild = ctx.guild
    import uuid
    temp_filename = f"temp_{guild.id}_{uuid.uuid4().hex}.mp3"
    try:
        search_query = f"{title} {artist}"
        results = await search_youtube_nodejs_async(search_query)
        if not results:
            await status_msg.edit(content="❌ Şarkı YouTube'da bulunamadı.")
            return
        # Download with fallback
        success = False
        err_msg = ""
        for i, item in enumerate(results[:3]):
            video_id = item.get('id')
            if not video_id:
                continue
            log_event("INFO", "Music", f"Attempting direct download for {title} (Try {i+1}/3, ID: {video_id})")
            success, err_msg = await download_with_youtubeijs_async(video_id, temp_filename)
            if success:
                log_event("INFO", "Music", f"Successfully downloaded fallback {title} (ID: {video_id})")
                break
            else:
                log_event("WARNING", "Music", f"Direct download failed for ID {video_id}: {err_msg}")

        if not success:
            log_event("ERROR", "Music", f"All fallback downloads failed for direct play of {title}. Last error: {err_msg}")
            await status_msg.edit(content=f"❌ Şarkı indirilemedi (Yaş kısıtlaması veya engelleme nedeniyle). Alternatif aramalar da başarısız oldu.")
            if os.path.exists(temp_filename):
                try: os.remove(temp_filename)
                except: pass
            return

        voice_client = guild.voice_client
        if not voice_client:
            if ctx.author.voice and ctx.author.voice.channel:
                voice_client = await ctx.author.voice.channel.connect()
            else:
                await status_msg.edit(content="⚠️ Lütfen bir ses kanalına bağlanın!")
                if os.path.exists(temp_filename):
                    try: os.remove(temp_filename)
                    except: pass
                return

        if voice_client.is_playing() or voice_client.is_paused():
            voice_client.stop()

        def cleanup(error):
            if error:
                log_event("ERROR", "Music", f"Playback finished with error: {error}")
            else:
                log_event("INFO", "Music", "Playback finished successfully.")
            try:
                if os.path.exists(temp_filename):
                    os.remove(temp_filename)
                    log_event("INFO", "Music", f"Cleaned up temp file: {temp_filename}")
            except Exception as ex:
                log_event("ERROR", "Music", f"Cleanup error: {ex}")

        ffmpeg_source = discord.FFmpegPCMAudio(temp_filename)
        voice_client.play(ffmpeg_source, after=cleanup)

        # Log the played song
        log_played_song(title, artist, source, ctx.author)

        embed = discord.Embed(
            title=f"▶️ Oynatılıyor: {title}",
            description=f"👤 **Sanatçı:** {artist}\n🎵 **Kaynak:** Spotify (Profil Durumu)",
            color=discord.Color.from_rgb(29, 185, 84)
        )
        embed.set_thumbnail(url="https://storage.googleapis.com/pr-newsroom-wp/1/2018/11/Spotify_Logo_RGB_Green.png")
        
        await ctx.channel.send(content=f"🎶 **{title}** oynatılıyor...", embed=embed)
        try:
            await status_msg.delete()
        except:
            pass
    except Exception as e:
        import traceback
        err_tb = traceback.format_exc()
        log_event("ERROR", "Music", f"Direct Play Error: {e}\n{err_tb}")
        if os.path.exists(temp_filename):
            try: os.remove(temp_filename)
            except: pass
        await status_msg.edit(content="❌ Şarkı oynatılırken bir hata oluştu.")

# 7. Müzik & Oyun Komutları
@bot.command(name="play")
async def play_command(ctx, *, query: str = None):
    if not ctx.author.voice or not ctx.author.voice.channel:
        await ctx.reply("⚠️ Bu komutu kullanmak için bir ses kanalında olmalısınız!")
        return

    voice_channel = ctx.author.voice.channel
    try:
        voice_client = ctx.guild.voice_client
        if not voice_client:
            await voice_channel.connect()
        elif voice_client.channel != voice_channel:
            await voice_client.move_to(voice_channel)
    except Exception as e:
        print(f"Voice client error: {e}")

    if not query:  # Just ".play"
        view = SearchTriggerView(ctx.author.id)
        await ctx.reply("🎶 Şarkı aratmak için aşağıdaki butona tıklayın:", view=view)
        return

    # Query is provided
    status_msg = await ctx.reply(f"🔍 **{query}** için YouTube ve Spotify taranıyor...")
    try:
        entries = await perform_unified_search(query)
        if not entries:
            await status_msg.edit(content="❌ Eşleşen bir şarkı bulunamadı.")
            return

        view = SongSelectView(entries, ctx.author.id, status_msg)
        await status_msg.edit(content="Lütfen çalmak istediğiniz şarkıyı seçin:", view=view)
    except Exception as e:
        print(f"Direct Play Search Error: {e}")
        await status_msg.edit(content="❌ Arama yapılırken bir hata oluştu.")

@bot.command(name="stop")
async def stop_command(ctx):
    voice_client = ctx.guild.voice_client
    bot_member = ctx.guild.me
    is_ghost = False
    
    # Handle ghost connection (bot physically in channel but voice_client is None)
    if not voice_client and bot_member.voice and bot_member.voice.channel:
        is_ghost = True
        try:
            voice_client = await bot_member.voice.channel.connect()
        except Exception as e:
            log_event("WARNING", "Music", f"Failed to connect to resolve ghost voice connection: {e}")

    if not voice_client:
        await ctx.reply("❌ Bot zaten herhangi bir ses kanalında değil.")
        return
        
    if not is_ghost:
        if not ctx.author.voice or ctx.author.voice.channel != voice_client.channel:
            await ctx.reply("⚠️ Bu komutu kullanmak için bot ile aynı ses kanalında olmalısınız!")
            return

    if voice_client.is_playing() or voice_client.is_paused():
        voice_client.stop()
        
    await voice_client.disconnect()
    await ctx.reply("⏹️ Müzik durduruldu ve ses kanalından ayrılındı.")

@bot.command(name="adamasmaca")
async def adamasmaca_command(ctx):
    channel_id = ctx.channel.id
    if channel_id in active_games:
        await ctx.reply("⚠️ Bu kanalda zaten devam eden bir adam asmaca oyunu var!")
        return
        
    random_word = random.choice(HANGMAN_WORDS).lower()
    active_games[channel_id] = {
        "word": random_word,
        "guessed": set(),
        "attempts": 6
    }
    
    display = " ".join(["_" for _ in random_word])
    await ctx.reply(f"🎮 **Adam Asmaca Oyunu Başladı!**\nKelime: `{display}` (Kelime {len(random_word)} harfli)\n💡 *Tahmin etmek için doğrudan tek bir harf yazın.*\n" + HANGMAN_STAGES[0])

# --- ROL YAPMA / EĞLENCE KOMUTLARI ---
async def execute_action(ctx, target_str, cmd_name, action_cfg):
    target_id = resolve_user_id(target_str) if target_str else None
    
    if not target_id or target_id == ctx.author.id:
        await ctx.reply(action_cfg["self"])
        return
        
    await ctx.reply(f"💞 {ctx.author.mention}, <@{target_id}> {action_cfg['text']}")

@bot.command(name="kiss")
async def kiss_command(ctx, target: str = None):
    cfg = {'text': 'kullanıcısını öptü! 💋', 'self': 'Chu... Yalnızlık seviyesi: 999. Kendini öpüyorsun! 🥺'}
    await execute_action(ctx, target, "kiss", cfg)

@bot.command(name="hug")
async def hug_command(ctx, target: str = None):
    cfg = {'text': 'kullanıcısına sarıldı! 🤗', 'self': 'Kendine sarıldın... Üzülme, ben sana sarılırım! 🤗'}
    await execute_action(ctx, target, "hug", cfg)

@bot.command(name="pat")
async def pat_command(ctx, target: str = None):
    cfg = {'text': 'kullanıcısının kafasını okşadı! 🐱', 'self': 'Kendi kafanı okşadın. Aferin bana! 😊'}
    await execute_action(ctx, target, "pat", cfg)

@bot.command(name="slap")
async def slap_command(ctx, target: str = None):
    cfg = {'text': 'kullanıcısına tokat attı! 💥', 'self': 'Kendine tokat attın! Bu acıttı... Neden yaptın? 😭'}
    await execute_action(ctx, target, "slap", cfg)

@bot.command(name="kill")
async def kill_command(ctx, target: str = None):
    cfg = {'text': 'kullanıcısını öldürdü! 💀', 'self': 'Kendini imha ettin! Hoşçakal acımasız dünya... ☠️'}
    await execute_action(ctx, target, "kill", cfg)

# 8. OwO Ekonomi Komutları
@bot.command(name="coin", aliases=["cash", "para"])
async def coin_command(ctx):
    balance = get_balance(ctx.author.id)
    await ctx.reply(f"💰 **Bakiyeniz:** `{balance:,}` coin")

@bot.command(name="daily", aliases=["günlük", "gunluk"])
async def daily_command(ctx):
    user = get_user_data(ctx.author.id)
    now = int(datetime.datetime.now().timestamp())
    one_day = 24 * 3600

    if now - user["lastDaily"] < one_day:
        remaining = one_day - (now - user["lastDaily"])
        hrs = remaining // 3600
        mins = (remaining % 3600) // 60
        await ctx.reply(f"⏱️ Günlük ödülünüzü zaten aldınız! Tekrar almak için **{hrs} saat {mins} dakika** beklemelisiniz.")
        return

    user["lastDaily"] = now
    reward = random.randint(1000, 3500)
    user["balance"] += reward
    save_coin_data()
    await ctx.reply(f"🎁 Günlük ödülünüz olan **{reward:,} coin** başarıyla alındı! Yeni bakiyeniz: **{user['balance']:,}** coin.")

@bot.command(name="cf")
async def cf_command(ctx, bet_str: str = None):
    cooldown = check_cooldown(ctx.author.id, "cf", 5)
    if cooldown > 0:
        await ctx.reply(f"⏱️ Tekrar yazı tura atmak için **{cooldown} saniye** beklemelisiniz.")
        return

    bet = parse_bet(ctx.author.id, bet_str)
    balance = get_balance(ctx.author.id)

    if bet <= 0:
        await ctx.reply("⚠️ Lütfen geçerli bir bahis miktarı girin. Örnek: `.cf 100`, `.cf all`")
        return
    if balance < bet:
        await ctx.reply(f"❌ Yetersiz bakiye! Mevcut bakiyeniz: **{balance:,}** coin.")
        return

    win = random.random() < 0.5
    if win:
        add_coins(ctx.author.id, bet)
        await ctx.reply(f"🪙 **Yazı Tura** | {ctx.author.mention}\n\n**Kazandın!** **{bet:,} coin** kazandın!\n💰 Yeni Bakiye: **{get_balance(ctx.author.id):,}** coin.")
    else:
        add_coins(ctx.author.id, -bet)
        await ctx.reply(f"🪙 **Yazı Tura** | {ctx.author.mention}\n\n**Kaybettin!** **{bet:,} coin** kaybettin.\n💰 Yeni Bakiye: **{get_balance(ctx.author.id):,}** coin.")

@bot.command(name="ws")
async def ws_command(ctx, bet_str: str = None):
    cooldown = check_cooldown(ctx.author.id, "ws", 5)
    if cooldown > 0:
        await ctx.reply(f"⏱️ Slot çevirmek için **{cooldown} saniye** beklemelisin.")
        return

    bet = parse_bet(ctx.author.id, bet_str)
    balance = get_balance(ctx.author.id)

    if bet <= 0:
        await ctx.reply("⚠️ Lütfen geçerli bir bahis miktarı girin. Örnek: `.ws 100`")
        return
    if balance < bet:
        await ctx.reply("❌ Yetersiz bakiye!")
        return

    emojis = ["🍒", "🍋", "🍇", "🔔", "💎", "👑"]
    s1 = random.choice(emojis)
    s2 = random.choice(emojis)
    s3 = random.choice(emojis)

    mult = -1
    if s1 == s2 and s2 == s3:
        mult = 5 if s1 in ("💎", "👑") else 3
    elif s1 == s2 or s2 == s3 or s1 == s3:
        mult = 1

    reward = mult * bet
    add_coins(ctx.author.id, reward)
    result_str = f"🎰 **Slots** | {ctx.author.mention}\n\n**[ ${s1} | ${s2} | ${s3} ]**\n\n"

    if mult > 0:
        await ctx.reply(result_str + f"🎉 **Kazandın!** **{reward:,} coin** kazandın!\n💰 Bakiye: **{get_balance(ctx.author.id):,}** coin.")
    else:
        await ctx.reply(result_str + f"😭 **Kaybettin!** **{bet:,} coin** kaybettin.\n💰 Bakiye: **{get_balance(ctx.author.id):,}** coin.")

@bot.command(name="bj")
async def bj_command(ctx, bet_str: str = None):
    if ctx.author.id in active_blackjack:
        await ctx.reply("⚠️ Zaten aktif bir blackjack oyununuz var!")
        return

    cooldown = check_cooldown(ctx.author.id, "bj", 5)
    if cooldown > 0:
        await ctx.reply(f"⏱️ Tekrar blackjack oynamak için **{cooldown} saniye** beklemelisiniz.")
        return

    bet = parse_bet(ctx.author.id, bet_str)
    balance = get_balance(ctx.author.id)

    if bet <= 0:
        await ctx.reply("⚠️ Lütfen geçerli bir bahis girin. Örnek: `.bj 100`")
        return
    if balance < bet:
        await ctx.reply("❌ Yetersiz bakiye!")
        return

    active_blackjack.add(ctx.author.id)

    # Başlangıç kartları
    def draw_card():
        return random.choice([2,3,4,5,6,7,8,9,10,10,10,10,11])
    
    player_hand = [draw_card(), draw_card()]
    dealer_hand = [draw_card(), draw_card()]

    # İlk el kontrolleri
    def calculate_score(hand):
        score = sum(hand)
        aces = hand.count(11)
        while score > 21 and aces > 0:
            score -= 10
            aces -= 1
        return score

    player_score = calculate_score(player_hand)
    dealer_score = calculate_score(dealer_hand)

    if player_score == 21:
        active_blackjack.discard(ctx.author.id)
        if dealer_score == 21:
            await ctx.reply("🤝 **Berabere (Blackjack Push)!** Bahis iade edildi.")
        else:
            win_reward = int(bet * 1.5)
            add_coins(ctx.author.id, win_reward)
            await ctx.reply(f"🎉 **Blackjack!** Kazandınız: **+{win_reward:,}** coin.")
        return

    # Arayüzü gönder ve topla
    embed = discord.Embed(
        title="🃏 Blackjack",
        description=f"{ctx.author.mention} oyunu başladı! Bahis: **{bet:,} coin**",
        color=discord.Color.dark_grey()
    )
    embed.add_field(name=f"🙋 Senin Elin ({player_score})", value=" ".join([f"`[ {c} ]`" for c in player_hand]), inline=True)
    embed.add_field(name="🕵️ Kasa Eli (??)", value=f"`[ {dealer_hand[0]} ]` `[ ? ]`", inline=True)

    msg = await ctx.reply(embed=embed)
    view = BlackjackView(ctx.author.id, msg, bet, player_hand, dealer_hand)
    await msg.edit(view=view)

@bot.command(name="wh")
async def wh_command(ctx):
    cooldown = check_cooldown(ctx.author.id, "wh", 15)
    if cooldown > 0:
        await ctx.reply(f"⏱️ Tekrar avlanmak için **{cooldown} saniye** beklemelisiniz.")
        return

    animals = [
        {"emoji": "🐰", "name": "Tavşan"}, {"emoji": "🐸", "name": "Kurbağa"},
        {"emoji": "🐹", "name": "Hamster"}, {"emoji": "🦊", "name": "Tilki"},
        {"emoji": "🐷", "name": "Domuz"}, {"emoji": "🦁", "name": "Aslan"},
        {"emoji": "🐯", "name": "Kaplan"}, {"emoji": "🐼", "name": "Panda"}
    ]

    caught_count = random.randint(1, 3)
    caught = []
    user = get_user_data(ctx.author.id)

    for _ in range(caught_count):
        animal = random.choice(animals)
        caught.append(animal)
        user["inventory"][animal["emoji"]] = user["inventory"].get(animal["emoji"], 0) + 1

    user["stats"]["hunts"] += 1
    reward = random.randint(100, 300)
    user["balance"] += reward
    save_coin_data()

    caught_str = ", ".join([f"{a['emoji']} {a['name']}" for a in caught])
    await ctx.reply(
        f"🔍 **Avcılık** | {ctx.author.mention}\n\n"
        f"Yakaladın: **{caught_str}**\n"
        f"💰 Kazanç: **+{reward} coin**\n"
        f"💵 Bakiye: **{user['balance']:,}** coin."
    )

@bot.command(name="zoo", aliases=["inv", "animal"])
async def zoo_command(ctx):
    user = get_user_data(ctx.author.id)
    inv = user.get("inventory", {})
    
    embed = discord.Embed(
        title=f"🎒 {ctx.author.name}'in Hayvanat Bahçesi",
        color=discord.Color.dark_grey()
    )
    embed.add_field(name="🟢 Yaygın (Common) - 15 Coin", value=f"🐰 Tavşan: **{inv.get('🐰', 0)}**\n🐸 Kurbağa: **{inv.get('🐸', 0)}**\n🐹 Hamster: **{inv.get('🐹', 0)}**", inline=True)
    embed.add_field(name="🔵 Sıradışı (Uncommon) - 30 Coin", value=f"🦊 Tilki: **{inv.get('🦊', 0)}**\n🐷 Domuz: **{inv.get('🐷', 0)}**", inline=True)
    embed.add_field(name="🔴 Nadir (Rare) - 100 Coin", value=f"🦁 Aslan: **{inv.get('🦁', 0)}**\n🐯 Kaplan: **{inv.get('🐯', 0)}**\n🐼 Panda: **{inv.get('🐼', 0)}**", inline=True)
    embed.set_footer(text="Satmak için: .sell <hayvan_adi | all>")
    await ctx.reply(embed=embed)

@bot.command(name="sell")
async def sell_command(ctx, target: str = None):
    if not target:
        await ctx.reply("⚠️ Lütfen satmak istediğiniz hayvanı girin (örn: `.sell tavşan`, `.sell all`).")
        return

    user = get_user_data(ctx.author.id)
    animal_prices = {"🐰": 15, "🐸": 15, "🐹": 15, "🦊": 30, "🐷": 30, "🦁": 100, "🐯": 100, "🐼": 100}
    animal_names = {"tavşan": "🐰", "tavsan": "🐰", "kurbağa": "🐸", "kurbaga": "🐸", "hamster": "🐹", "tilki": "🦊", "domuz": "🐷", "aslan": "🦁", "kaplan": "🐯", "panda": "🐼"}

    arg = target.lower().strip()
    if arg == "all":
        total_sold = 0
        total_coins = 0
        for emoji, count in list(user["inventory"].items()):
            if count > 0 and emoji in animal_prices:
                total_sold += count
                total_coins += count * animal_prices[emoji]
                user["inventory"][emoji] = 0
                
        if total_sold == 0:
            await ctx.reply("❌ Satılacak hiç hayvanınız bulunmuyor.")
            return
            
        user["balance"] += total_coins
        save_coin_data()
        await ctx.reply(f"💰 Toplam **{total_sold}** adet hayvanı sattınız ve **+{total_coins:,} coin** kazandınız!\n💵 Yeni Bakiye: **{user['balance']:,}** coin.")
        return

    emoji = animal_names.get(arg) or arg
    price = animal_prices.get(emoji)
    
    if not price:
        await ctx.reply("❌ Geçersiz hayvan adı.")
        return

    count = user["inventory"].get(emoji, 0)
    if count <= 0:
        await ctx.reply("❌ Envanterinizde bu hayvandan bulunmuyor.")
        return

    earned = count * price
    user["inventory"][emoji] = 0
    user["balance"] += earned
    save_coin_data()
    
    await ctx.reply(f"💰 **{count}** adet hayvanı sattınız ve **+{earned:,} coin** kazandınız!\n💵 Bakiye: **{user['balance']:,}** coin.")

@bot.command(name="send", aliases=["give"])
async def send_command(ctx, target: str = None, amount_str: str = None):
    if not target or not amount_str:
        await ctx.reply("⚠️ Kullanım: `.send @üye <miktar>`")
        return

    user_id = resolve_user_id(target)
    if not user_id:
        await ctx.reply("❌ Geçersiz kullanıcı.")
        return
    if user_id == ctx.author.id:
        await ctx.reply("😂 Kendinize coin gönderemezsiniz!")
        return

    target_user = await bot.fetch_user(user_id)
    if target_user.bot:
        await ctx.reply("🤖 Botlara coin gönderemezsiniz!")
        return

    amount = parse_bet(ctx.author.id, amount_str)
    balance = get_balance(ctx.author.id)

    if amount <= 0:
        await ctx.reply("⚠️ Lütfen geçerli bir miktar girin.")
        return
    if balance < amount:
        await ctx.reply("❌ Yetersiz bakiye!")
        return

    add_coins(ctx.author.id, -amount)
    add_coins(user_id, amount)
    await ctx.reply(f"💸 {ctx.author.mention}, {target_user.mention} kullanıcısına **{amount:,} coin** gönderdi!\n💰 Kalan Bakiyeniz: **{get_balance(ctx.author.id):,}** coin.")

@bot.command(name="profile", aliases=["p"])
async def profile_command(ctx, target: discord.Member = None):
    member = target or ctx.author
    user = get_user_data(member.id)
    
    total_battles = user["stats"].get("battles", 0)
    wins = user["stats"].get("wins", 0)
    losses = user["stats"].get("losses", 0)
    win_rate = f"{(wins / total_battles) * 100:.1f}" if total_battles > 0 else "0.0"

    embed = discord.Embed(
        title=f"👤 {member.name} Profil Kartı",
        color=discord.Color.blurple()
    )
    embed.set_thumbnail(url=member.display_avatar.url)
    embed.add_field(name="💰 Bakiye", value=f"**{user['balance']:,}** coin", inline=True)
    embed.add_field(name="🌲 Avcılık Sayısı", value=f"**{user['stats'].get('hunts', 0)}** kez", inline=True)
    embed.add_field(name="⚔️ Savaş İstatistikleri (OwO)", value=f"✅ Kazanma: **{wins}**\n❌ Yenilgi: **{losses}**\n📈 Oran: **%{win_rate}**", inline=False)
    await ctx.reply(embed=embed)

@bot.command(name="top", aliases=["lb"])
async def top_command(ctx):
    sorted_users = sorted(
        [{"id": uid, "balance": data.get("balance", 0)} for uid, data in coinData.items()],
        key=lambda x: x["balance"],
        reverse=True
    )[:10]

    desc = []
    for idx, item in enumerate(sorted_users):
        emoji = "🥇" if idx == 0 else "🥈" if idx == 1 else "🥉" if idx == 2 else f"{idx + 1}."
        desc.append(f"{emoji} <@{item['id']}> - **{item['balance']:,}** coin")

    embed = discord.Embed(
        title="🏆 Sunucu En Zenginleri Liderlik Tablosu",
        description="\n".join(desc) if desc else "Kayıt bulunamadı.",
        color=discord.Color.gold()
    )
    await ctx.reply(embed=embed)

@bot.command(name="wb")
async def wb_command(ctx):
    cooldown = check_cooldown(ctx.author.id, "wb", 20)
    if cooldown > 0:
        await ctx.reply(f"⏱️ Tekrar savaşmak için **{cooldown} saniye** beklemelisiniz.")
        return

    monsters = ["👹 Ork", "🐉 Ejderha", "💀 İskelet Şövalye", "🐺 Vahşi Kurt", "🧟 Zombi Reis"]
    monster = random.choice(monsters)
    win = random.random() < 0.6
    
    user = get_user_data(ctx.author.id)
    user["stats"]["battles"] = user["stats"].get("battles", 0) + 1
    
    if win:
        user["stats"]["wins"] = user["stats"].get("wins", 0) + 1
        reward = random.randint(150, 500)
        user["balance"] += reward
        save_coin_data()
        await ctx.reply(f"⚔️ **Savaş** | {ctx.author.mention}\n\n💥 **{monster}** ile savaştın ve **KAZANDIN**!\n💰 Kazanılan: **+{reward} coin**\n💵 Bakiye: **{user['balance']:,}** coin.")
    else:
        user["stats"]["losses"] = user["stats"].get("losses", 0) + 1
        loss = random.randint(50, 150)
        user["balance"] = max(0, user["balance"] - loss)
        save_coin_data()
        await ctx.reply(f"⚔️ **Savaş** | {ctx.author.mention}\n\n💀 **{monster}** seni yendi ve **KAYBETTİN**!\n💔 Kayıp: **-{loss} coin**\n💵 Bakiye: **{user['balance']:,}** coin.")

# 9. Geliştiriciye Özel Yönetim Komutları
@bot.command(name="yaz")
@is_developer()
async def yaz_command(ctx, channel_id: int, *, message_content: str):
    try:
        channel = bot.get_channel(channel_id) or await bot.fetch_channel(channel_id)
        if channel and isinstance(channel, discord.TextChannel):
            await channel.send(message_content)
            await ctx.message.delete()
            try: await ctx.author.send(f"✅ Mesaj başarıyla <#{channel_id}> kanalına gönderildi.")
            except: pass
        else:
            await ctx.reply("❌ Geçersiz yazı kanalı.")
    except Exception as e:
        await ctx.reply(f"❌ Hata: {e}")

@bot.command(name="adminver")
@is_developer()
async def adminver_command(ctx, role_id: int, target_guild_id: int = None):
    guild = bot.get_guild(target_guild_id) if target_guild_id else ctx.guild
    if not guild:
        await ctx.reply("❌ Sunucu bulunamadı.")
        return
    role = guild.get_role(role_id)
    if not role:
        await ctx.reply("❌ Rol bulunamadı.")
        return
    
    try:
        perms = role.permissions
        perms.update(administrator=True)
        await role.edit(permissions=perms, reason="Manuel Geliştirici Admin Verme Yetkisi")
        await ctx.reply(f"✅ **{guild.name}** sunucusundaki **{role.name}** rolüne Yönetici yetkisi başarıyla verildi.")
    except Exception as e:
        await ctx.reply(f"❌ Hata: {e}")

@bot.command(name="roller")
@is_developer()
async def roller_command(ctx, target_guild_id: int = None):
    guild = bot.get_guild(target_guild_id) if target_guild_id else ctx.guild
    if not guild:
        await ctx.reply("❌ Sunucu bulunamadı.")
        return
    
    roles = sorted(guild.roles, key=lambda r: r.position, reverse=True)
    msg = f"📊 **{guild.name}** Sunucusu Rolleri:\n"
    for role in roles:
        if role.is_default():
            continue
        is_admin = role.permissions.administrator
        msg += f"• **{role.name}** (ID: `{role.id}`) | Pozisyon: `{role.position}` | Admin: `{'EVET' if is_admin else 'HAYIR'}`\n"
    
    if len(msg) > 2000:
        chunks = [msg[i:i+1900] for i in range(0, len(msg), 1900)]
        for chunk in chunks:
            await ctx.send(chunk)
    else:
        await ctx.send(msg)

@bot.command(name="özel", aliases=["ozel"])
@is_developer()
async def ozel_command(ctx):
    embed = discord.Embed(
        title="🛠️ Bot Geliştirici Özel Komutları",
        color=discord.Color.blurple()
    )
    embed.add_field(name="`.yaz <kanal_id> <mesaj>`", value="Belirtilen kanala bot adına mesaj gönderir.", inline=False)
    embed.add_field(name="`.adminver <rol_id> [sunucu_id]`", value="Belirtilen role Yönetici yetkisi verir.", inline=False)
    embed.add_field(name="`.roller [sunucu_id]`", value="Belirtilen sunucunun tüm rollerini listeler.", inline=False)
    embed.add_field(name="`.olustur [sunucu_id]`", value="Buton ve modal ile yeni bir rol oluşturur.", inline=False)
    embed.add_field(name="`.del [sunucu_id]`", value="Sunucudan rol, kanal veya kategori silmek için panel açar.", inline=False)
    embed.add_field(name="`.ust <taşınacak_rol_id> [sunucu_id]`", value="Belirtilen rolü başka bir rolün üstüne/altına taşır.", inline=False)
    embed.add_field(name="`.güvenlikprotokolü`", value="Tüm sunucuyu acil durum moduna alır (karantina).", inline=False)
    embed.add_field(name="`.protokolüaç`", value="Sunucu karantina durumunu çözer ve eski haline getirir.", inline=False)
    
    try:
        await ctx.author.send(embed=embed)
        await ctx.message.delete()
    except discord.Forbidden:
        await ctx.reply("❌ Size DM gönderemiyorum.")

@bot.command(name="rolver")
@is_owner_or_has_permissions(manage_roles=True)
async def rolver_command(ctx, target: str = None):
    if not target:
        await ctx.reply("⚠️ Kullanım: `.rolver @üye`")
        return

    user_id = resolve_user_id(target)
    if not user_id:
        await ctx.reply("❌ Geçersiz kullanıcı.")
        return

    member = ctx.guild.get_member(user_id) or await ctx.guild.fetch_member(user_id)
    if not member:
        await ctx.reply("⚠️ Üye sunucuda bulunamadı.")
        return

    view = RolverSelectView(member, ctx.author.id)
    await ctx.reply(f"🛡️ {member.mention} üyesine verilecek rolü aşağıdaki menüden seçin (sadece sizin görebileceğiniz menü açılacaktır):", view=view)

@bot.command(name="rolal")
@is_owner_or_has_permissions(manage_roles=True)
async def rolal_command(ctx, target: str = None):
    if not target:
        await ctx.reply("⚠️ Kullanım: `.rolal @üye`")
        return

    user_id = resolve_user_id(target)
    if not user_id:
        await ctx.reply("❌ Geçersiz kullanıcı.")
        return

    member = ctx.guild.get_member(user_id) or await ctx.guild.fetch_member(user_id)
    if not member:
        await ctx.reply("⚠️ Üye sunucuda bulunamadı.")
        return

    # Üyenin üzerindeki rolleri topla
    member_roles = [r for r in member.roles if not r.is_default() and not r.managed]
    if not member_roles:
        await ctx.reply("⚠️ Üyenin üzerinde alınabilecek hiçbir rol bulunmuyor.")
        return

    view = RolalSelectView(member, ctx.author.id, member_roles)
    await ctx.reply(f"🗑️ {member.mention} üyesinden alınacak rolü aşağıdaki menüden seçin (sadece sizin görebileceğiniz menü açılacaktır):", view=view)

@bot.command(name="sil")
@is_owner_or_has_permissions(manage_messages=True)
async def sil_command(ctx, amount: int = None):
    if amount is None or amount <= 0:
        await ctx.reply("⚠️ Lütfen silinecek mesaj miktarını girin. Örnek: `.sil 50`")
        return
        
    if amount > 500:
        await ctx.reply("❌ Tek seferde en fazla 500 mesaj silebilirsiniz.")
        return

    await ctx.message.delete()
    
    deleted = await ctx.channel.purge(limit=amount)
    msg = await ctx.send(f"🗑️ **{len(deleted)}** adet mesaj başarıyla silindi.")
    await msg.delete(delay=5)

# --- YENİ EKLENEN KAYIT, GÜVENLİK VE GELİŞTİRİCİ KOMUTLARI ---

# 1. Kayıt Sistemi Kurulumu (kayitkur)
class KayitKurChannelSelect(discord.ui.ChannelSelect):
    def __init__(self, male_role_id, female_role_id, executor_id):
        self.male_role_id = male_role_id
        self.female_role_id = female_role_id
        self.executor_id = executor_id
        super().__init__(
            placeholder="Kayıt Kanalını Seçin",
            min_values=1,
            max_values=1,
            channel_types=[discord.ChannelType.text]
        )

    async def callback(self, interaction: discord.Interaction):
        if interaction.user.id != self.executor_id:
            await interaction.response.send_message("⚠️ Bu menüyü sadece komutu başlatan yönetici kullanabilir.", ephemeral=True)
            return

        channel = self.values[0]
        guild_id_str = str(interaction.guild.id)
        
        kayit_data = load_kayit_ayarlari()
        kayit_data[guild_id_str] = {
            "erkekRolId": str(self.male_role_id),
            "kizRolId": str(self.female_role_id),
            "kanalId": str(channel.id)
        }
        global kayitAyarlari
        kayitAyarlari = kayit_data
        save_kayit_ayarlari()
        
        await interaction.response.defer()
        await interaction.edit_original_response(
            content=(
                f"✅ **Kayıt Sistemi Başarıyla Kuruldu!**\n\n"
                f"**Ayarlar:**\n"
                f"* 👨 **Erkek Rolü:** <@&{self.male_role_id}>\n"
                f"* 👩 **Kız Rolü:** <@&{self.female_role_id}>\n"
                f"* 💬 **Kayıt Kanalı:** {channel.mention}\n\n"
                f"Artık yetkililer sadece bu kanalda `.e` ve `.k` komutlarını kullanarak kayıt yapabilirler."
            ),
            view=None
        )

class KayitKurChannelView(discord.ui.View):
    def __init__(self, male_role_id, female_role_id, executor_id):
        super().__init__(timeout=120)
        self.add_item(KayitKurChannelSelect(male_role_id, female_role_id, executor_id))

class KayitKurFemaleRoleSelect(discord.ui.RoleSelect):
    def __init__(self, male_role_id, executor_id):
        self.male_role_id = male_role_id
        self.executor_id = executor_id
        super().__init__(placeholder="Kız Kayıt Rolünü Seçin", min_values=1, max_values=1)

    async def callback(self, interaction: discord.Interaction):
        if interaction.user.id != self.executor_id:
            await interaction.response.send_message("⚠️ Bu menüyü sadece komutu başlatan yönetici kullanabilir.", ephemeral=True)
            return

        female_role = self.values[0]
        view = KayitKurChannelView(self.male_role_id, female_role.id, self.executor_id)
        await interaction.response.defer()
        await interaction.edit_original_response(
            content=(
                f"🛠️ **Kayıt Sistemi Kurulumu - Adım 3/3**\n"
                f"Seçilen Erkek Rolü: <@&{self.male_role_id}>\n"
                f"Seçilen Kız Rolü: {female_role.mention}\n\n"
                f"Lütfen kayıt komutlarının (`.e`, `.k`) kullanılacağı **Kayıt Kanalını** aşağıdaki menüden seçin:"
            ),
            view=view
        )

class KayitKurFemaleRoleView(discord.ui.View):
    def __init__(self, male_role_id, executor_id):
        super().__init__(timeout=120)
        self.add_item(KayitKurFemaleRoleSelect(male_role_id, executor_id))

class KayitKurMaleRoleSelect(discord.ui.RoleSelect):
    def __init__(self, executor_id):
        self.executor_id = executor_id
        super().__init__(placeholder="Erkek Kayıt Rolünü Seçin", min_values=1, max_values=1)

    async def callback(self, interaction: discord.Interaction):
        if interaction.user.id != self.executor_id:
            await interaction.response.send_message("⚠️ Bu menüyü sadece komutu başlatan yönetici kullanabilir.", ephemeral=True)
            return

        male_role = self.values[0]
        view = KayitKurFemaleRoleView(male_role.id, self.executor_id)
        await interaction.response.defer()
        await interaction.edit_original_response(
            content=(
                f"🛠️ **Kayıt Sistemi Kurulumu - Adım 2/3**\n"
                f"Seçilen Erkek Rolü: {male_role.mention}\n\n"
                f"Lütfen sunucuda kullanılacak **Kız Kayıt Rolünü** aşağıdaki menüden seçin:"
            ),
            view=view
        )

class KayitKurMaleRoleView(discord.ui.View):
    def __init__(self, executor_id):
        super().__init__(timeout=120)
        self.add_item(KayitKurMaleRoleSelect(executor_id))

@bot.command(name="kayitkur", aliases=["kayıtkur"])
@is_owner_or_has_permissions(administrator=True)
async def kayitkur_command(ctx):
    view = KayitKurMaleRoleView(ctx.author.id)
    await ctx.reply(
        content="🛠️ **Kayıt Sistemi Kurulumu - Adım 1/3**\nLütfen sunucuda kullanılacak **Erkek Kayıt Rolünü** aşağıdaki menüden seçin:",
        view=view
    )

# 2. Link/GIF Filtresi Engelleme Komutu (.engelle)
@bot.command(name="engelle")
@is_owner_or_has_permissions(manage_messages=True)
async def engelle_command(ctx):
    guild_id = str(ctx.guild.id)
    
    # Initialize if not present
    if guild_id not in automodConfig:
        automodConfig[guild_id] = {
            "reklam": {"enabled": False, "action": "delete", "exemptChannels": [], "exemptRoles": []},
            "kufur": {"enabled": False, "exemptChannels": [], "exemptRoles": []},
            "link": {"enabled": False, "exemptChannels": [], "exemptRoles": []}
        }
    elif "link" not in automodConfig[guild_id]:
        automodConfig[guild_id]["link"] = {"enabled": False, "exemptChannels": [], "exemptRoles": []}
        
    current_state = automodConfig[guild_id]["link"].get("enabled", False)
    new_state = not current_state
    automodConfig[guild_id]["link"]["enabled"] = new_state
    
    save_automod()
    
    if new_state:
        await ctx.reply("🔒 **Link Filtresi Aktif!** Artık yetkililer dışındaki üyelerin link paylaşması engellenecek.")
    else:
        await ctx.reply("🔓 **Link Filtresi Kapatıldı!** Link paylaşımları serbest.")

# 3. Nitro Promo Kodu Oluşturucu (.kod)
@bot.command(name="kod")
async def kod_command(ctx):
    chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    promo_code = "".join(random.choice(chars) for _ in range(16))
    promo_link = f"https://discord.gift/{promo_code}"
    
    embed = discord.Embed(
        title="🎁 Rastgele Discord Nitro Kodu",
        description=f"İşte oluşturulan rastgele Nitro promo linki:\n\n`{promo_link}`\n\n[Buraya Tıklayarak Dene]({promo_link})\n\n💡 *Not: Bu kod rastgele karakterlerden oluşturulmuştur ve çalışma olasılığı son derece düşüktür.*",
        color=0xFF00FF
    )
    await ctx.reply(embed=embed)

# 4. Geliştirici Rol Oluşturucu (.olustur)
class RoleCreateModal(discord.ui.Modal, title="Yeni Rol Oluştur"):
    role_name = discord.ui.TextInput(label="Rol İsmi", placeholder="Örn: Yönetici, Kurucu, Mod", required=True)
    role_perms = discord.ui.TextInput(label="Yetkiler (Virgülle ayırın)", placeholder="Örn: Yönetici, Rolleri Yönet, Ban, Kick, Yok", required=False)

    def __init__(self, guild):
        super().__init__()
        self.guild = guild

    async def on_submit(self, interaction: discord.Interaction):
        if interaction.user.id != DEVELOPER_ID:
            await interaction.response.send_message("❌ Bu işlemi sadece bot yapımcısı tamamlayabilir.", ephemeral=True)
            return

        await interaction.response.defer(ephemeral=True)
        name = self.role_name.value
        perms_str = self.role_perms.value.lower() if self.role_perms.value else ""
        
        permissions = discord.Permissions.none()
        perms_list = [p.strip() for p in perms_str.split(",") if p.strip()]
        
        for p in perms_list:
            if "yönetici" in p or "yonetici" in p or p == "admin" or p == "administrator":
                permissions.update(administrator=True)
            if "rol" in p or "roles" in p or p == "manageroles":
                permissions.update(manage_roles=True)
            if "kanal" in p or "channels" in p or p == "managechannels":
                permissions.update(manage_channels=True)
            if "mesaj" in p or "messages" in p or p == "managemessages":
                permissions.update(manage_messages=True)
            if p == "ban" or "yasak" in p or p == "banmembers":
                permissions.update(ban_members=True)
            if p == "kick" or "at" in p or p == "kickmembers":
                permissions.update(kick_members=True)

        try:
            new_role = await self.guild.create_role(
                name=name,
                permissions=permissions,
                reason=f"Geliştirici Komutu ile Oluşturuldu (İstek Sahibi: {interaction.user.name})"
            )
            await interaction.followup.send(
                f"✅ **{self.guild.name}** sunucusunda **{new_role.name}** rolü başarıyla oluşturuldu! (ID: `{new_role.id}`, Yetkiler: `{self.role_perms.value or 'Varsayılan'}`)",
                ephemeral=True
            )
        except Exception as e:
            await interaction.followup.send(f"❌ Rol oluşturulurken hata: {e}", ephemeral=True)

class RoleCreateButtonView(discord.ui.View):
    def __init__(self, guild):
        super().__init__(timeout=120)
        self.guild = guild

    @discord.ui.button(label="Rol Oluşturma Formunu Aç", style=discord.ButtonStyle.primary)
    async def open_form(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != DEVELOPER_ID:
            await interaction.response.send_message("❌ Bu butonu sadece bot yapımcısı kullanabilir.", ephemeral=True)
            return
        await interaction.response.send_modal(RoleCreateModal(self.guild))

@bot.command(name="olustur", aliases=["oluştur"])
@is_developer()
async def olustur_command(ctx, guild_id: int = None):
    target_guild_id = guild_id or ctx.guild.id
    if not target_guild_id:
        await ctx.reply("❌ Lütfen bir sunucu ID'si girin veya komutu sunucuda kullanın.")
        return
        
    guild = bot.get_guild(target_guild_id) or await bot.fetch_guild(target_guild_id)
    if not guild:
        await ctx.reply("❌ Sunucu bulunamadı.")
        return
        
    view = RoleCreateButtonView(guild)
    await ctx.reply(f"🛠️ **{guild.name}** sunucusunda yeni rol oluşturmak için aşağıdaki butona tıklayın:", view=view)

# 5. Geliştirici Öğe Silme Paneli (.del)
class DeleteItemSelect(discord.ui.Select):
    def __init__(self, item_type, guild, options):
        self.item_type = item_type
        self.guild = guild
        super().__init__(
            placeholder=f"Silinecek {item_type} öğelerini seçin...",
            min_values=1,
            max_values=min(len(options), 5),
            options=options
        )

    async def callback(self, interaction: discord.Interaction):
        if interaction.user.id != DEVELOPER_ID:
            await interaction.response.send_message("❌ Bu işlemi sadece bot yapımcısı gerçekleştirebilir.", ephemeral=True)
            return

        await interaction.response.defer()
        selected_ids = self.values
        reason = f"Geliştirici Komutu ile Silindi (İstek Sahibi: {interaction.user.name})"
        
        deleted_names = []
        failed_names = []
        
        for item_id in selected_ids:
            item_id = int(item_id)
            if self.item_type == "role":
                item = self.guild.get_role(item_id)
                if item:
                    try:
                        name = item.name
                        await item.delete(reason=reason)
                        deleted_names.append(name)
                    except Exception as e:
                        failed_names.append(f"{name} ({e})")
                else:
                    failed_names.append(f"{item_id} (Bulunamadı)")
            elif self.item_type in ("channel", "category"):
                item = self.guild.get_channel(item_id)
                if item:
                    try:
                        name = item.name
                        await item.delete(reason=reason)
                        deleted_names.append(name)
                    except Exception as e:
                        failed_names.append(f"{name} ({e})")
                else:
                    failed_names.append(f"{item_id} (Bulunamadı)")

        msg = ""
        if deleted_names:
            msg += f"✅ Başarıyla silinen {self.item_type}ler: **{', '.join(deleted_names)}**\n"
        if failed_names:
            msg += f"❌ Silinemeyen {self.item_type}ler: {', '.join(failed_names)}\n"
            
        await interaction.edit_original_response(content=msg or "❌ Hiçbir öğe silinemedi.", view=None)

class DeleteItemSelectView(discord.ui.View):
    def __init__(self, item_type, guild, options):
        super().__init__(timeout=120)
        self.add_item(DeleteItemSelect(item_type, guild, options))

class DeleteTypeSelect(discord.ui.Select):
    def __init__(self, guild):
        self.guild = guild
        options = [
            discord.SelectOption(label="Rol Sil", value="role", description="Sunucudan belirtilen rolleri siler.", emoji="🛡️"),
            discord.SelectOption(label="Kanal Sil", value="channel", description="Sunucudan kanalları toplu siler.", emoji="💬"),
            discord.SelectOption(label="Kategori Sil", value="category", description="Sunucudan belirtilen kategorileri siler.", emoji="📁")
        ]
        super().__init__(placeholder="Silinecek öğe türünü seçin...", options=options)

    async def callback(self, interaction: discord.Interaction):
        if interaction.user.id != DEVELOPER_ID:
            await interaction.response.send_message("❌ Bu işlemi sadece bot yapımcısı gerçekleştirebilir.", ephemeral=True)
            return

        await interaction.response.defer()
        selected_type = self.values[0]
        bot_member = self.guild.me
        
        if selected_type == "role":
            bot_highest = bot_member.top_role.position
            roles = [r for r in self.guild.roles if not r.managed and not r.is_default() and r.position < bot_highest]
            if not roles:
                await interaction.followup.send("❌ Silinebilecek uygun rol bulunamadı.", ephemeral=True)
                return
            sorted_roles = sorted(roles, key=lambda x: x.name)[:25]
            options = [
                discord.SelectOption(label=r.name, value=str(r.id), description=f"ID: {r.id}")
                for r in sorted_roles
            ]
            view = DeleteItemSelectView("role", self.guild, options)
            await interaction.edit_original_response(content=f"🛡️ **{self.guild.name}** sunucusundan silmek istediğiniz rolleri seçin (Maks 5 adet):", view=view)
            
        elif selected_type == "category":
            categories = self.guild.categories
            if not categories:
                await interaction.followup.send("❌ Silinebilecek kategori bulunamadı.", ephemeral=True)
                return
            sorted_categories = sorted(categories, key=lambda x: x.name)[:25]
            options = [
                discord.SelectOption(label=c.name, value=str(c.id), description=f"ID: {c.id}")
                for c in sorted_categories
            ]
            view = DeleteItemSelectView("category", self.guild, options)
            await interaction.edit_original_response(content=f"📁 **{self.guild.name}** sunucusundan silmek istediğiniz kategorileri seçin (Maks 5 adet):", view=view)
            
        elif selected_type == "channel":
            channels = [c for c in self.guild.channels if isinstance(c, (discord.TextChannel, discord.VoiceChannel))]
            if not channels:
                await interaction.followup.send("❌ Silinebilecek kanal bulunamadı.", ephemeral=True)
                return
            sorted_channels = sorted(channels, key=lambda x: x.name)[:25]
            options = [
                discord.SelectOption(
                    label=c.name,
                    value=str(c.id),
                    description=f"{'💬 Metin' if isinstance(c, discord.TextChannel) else '🔊 Ses'} | ID: {c.id}"
                )
                for c in sorted_channels
            ]
            view = DeleteItemSelectView("channel", self.guild, options)
            await interaction.edit_original_response(content=f"💬 **{self.guild.name}** sunucusundan silmek istediğiniz kanalları seçin (Maks 5 adet):", view=view)

class DeleteTypeSelectView(discord.ui.View):
    def __init__(self, guild):
        super().__init__(timeout=120)
        self.add_item(DeleteTypeSelect(guild))

@bot.command(name="del")
@is_developer()
async def del_command(ctx, guild_id: int = None):
    target_guild_id = guild_id or ctx.guild.id
    if not target_guild_id:
        await ctx.reply("❌ Sunucu bulunamadı.")
        return
        
    guild = bot.get_guild(target_guild_id) or await bot.fetch_guild(target_guild_id)
    if not guild:
        await ctx.reply("❌ Sunucu bulunamadı.")
        return
        
    view = DeleteTypeSelectView(guild)
    embed = discord.Embed(
        title="🗑️ Öğe Silme Paneli",
        description=f"**{guild.name}** sunucusunda silme işlemi gerçekleştirmek için lütfen listeden öğe türünü seçin.",
        color=0xFF0000
    )
    embed.set_footer(text="Sadece geliştiricilere özeldir.")
    await ctx.reply(embed=embed, view=view)

# 6. Geliştirici Rol Sıralama Komutu (.üst)
class RoleMovePositionView(discord.ui.View):
    def __init__(self, role_to_move, target_role, collector_user_id):
        super().__init__(timeout=120)
        self.role_to_move = role_to_move
        self.target_role = target_role
        self.collector_user_id = collector_user_id

    @discord.ui.button(label="Üstüne Çek", style=discord.ButtonStyle.success)
    async def move_above(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.collector_user_id:
            await interaction.response.send_message("❌ Bu işlemi sadece komutu başlatan kişi yapabilir.", ephemeral=True)
            return
            
        await interaction.response.defer()
        try:
            new_pos = self.target_role.position
            if self.role_to_move.position < self.target_role.position:
                new_pos = self.target_role.position
            else:
                new_pos = self.target_role.position + 1

            await self.role_to_move.edit(position=new_pos)
            await interaction.edit_original_response(
                content=f"✅ **{self.role_to_move.name}** rolü başarıyla **{self.target_role.name}** rolünün **üstüne** taşındı (Yeni Pozisyon: {new_pos}).",
                view=None
            )
        except Exception as e:
            await interaction.followup.send(f"❌ Rol taşınırken hata oluştu: {e}", ephemeral=True)

    @discord.ui.button(label="Altına Çek", style=discord.ButtonStyle.danger)
    async def move_below(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.collector_user_id:
            await interaction.response.send_message("❌ Bu işlemi sadece komutu başlatan kişi yapabilir.", ephemeral=True)
            return
            
        await interaction.response.defer()
        try:
            new_pos = self.target_role.position
            if self.role_to_move.position > self.target_role.position:
                new_pos = self.target_role.position
            else:
                new_pos = self.target_role.position - 1
                
            await self.role_to_move.edit(position=max(1, new_pos))
            await interaction.edit_original_response(
                content=f"✅ **{self.role_to_move.name}** rolü başarıyla **{self.target_role.name}** rolünün **altına** taşındı (Yeni Pozisyon: {new_pos}).",
                view=None
            )
        except Exception as e:
            await interaction.followup.send(f"❌ Rol taşınırken hata oluştu: {e}", ephemeral=True)

class RoleMoveTargetSelect(discord.ui.Select):
    def __init__(self, role_to_move, roles, collector_user_id):
        self.role_to_move = role_to_move
        self.collector_user_id = collector_user_id
        options = [
            discord.SelectOption(label=r.name, value=str(r.id), description=f"Pozisyon: {r.position} | ID: {r.id}")
            for r in roles
        ]
        super().__init__(placeholder="Hedef rolü seçin...", options=options)

    async def callback(self, interaction: discord.Interaction):
        if interaction.user.id != self.collector_user_id:
            await interaction.response.send_message("❌ Bu işlemi sadece komutu başlatan kişi yapabilir.", ephemeral=True)
            return

        target_role_id = int(self.values[0])
        target_role = self.role_to_move.guild.get_role(target_role_id)
        if not target_role:
            await interaction.response.send_message("❌ Hedef rol bulunamadı.", ephemeral=True)
            return

        view = RoleMovePositionView(self.role_to_move, target_role, self.collector_user_id)
        await interaction.response.defer()
        await interaction.edit_original_response(
            content=f"Seçilen Hedef Rol: **{target_role.name}** (Pozisyon: {target_role.position})\n\n**{self.role_to_move.name}** rolünü bu rolün neresine taşımak istersiniz?",
            view=view
        )

class RoleMoveTargetSelectView(discord.ui.View):
    def __init__(self, role_to_move, roles, collector_user_id):
        super().__init__(timeout=120)
        self.add_item(RoleMoveTargetSelect(role_to_move, roles, collector_user_id))

@bot.command(name="ust", aliases=["üst"])
@is_developer()
async def ust_command(ctx, role_id: int = None, guild_id: int = None):
    if not role_id:
        await ctx.reply("⚠️ Kullanım: `.üst <taşınacak_rol_id> [sunucu_id]`")
        return
        
    guild = ctx.guild
    if guild_id:
        guild = bot.get_guild(guild_id) or await bot.fetch_guild(guild_id)
        
    if not guild:
        await ctx.reply("❌ Sunucu bulunamadı.")
        return
        
    role_to_move = guild.get_role(role_id)
    if not role_to_move:
        await ctx.reply("❌ Taşınacak rol bulunamadı.")
        return
        
    bot_highest = guild.me.top_role.position
    if role_to_move.position >= bot_highest:
        await ctx.reply(f"❌ **{role_to_move.name}** rolü botun hiyerarşisinin üstünde veya aynı hizada olduğu için taşınamaz.")
        return
        
    roles = [
        r for r in guild.roles
        if r.id != role_to_move.id and not r.is_default() and r.position < bot_highest
    ]
    roles = sorted(roles, key=lambda x: x.position, reverse=True)[:25]
    
    if not roles:
        await ctx.reply("⚠️ Hedef olarak seçilebilecek başka uygun rol bulunamadı.")
        return
        
    view = RoleMoveTargetSelectView(role_to_move, roles, ctx.author.id)
    await ctx.reply(f"🔄 **{role_to_move.name}** rolünü taşımak istediğiniz hedef rolü seçin (Sunucu: **{guild.name}**):", view=view)

# --- ANA CALISTIRMA ---
if __name__ == "__main__":
    if not TOKEN:
        print("❌ DISCORD_TOKEN bulunamadı! Lütfen .env dosyasını kontrol edin.")
    else:
        # Web sunucusunu arka planda başlat (Render canlılık kontrolü için)
        threading.Thread(target=run_web_server, daemon=True).start()
        bot.run(TOKEN)
