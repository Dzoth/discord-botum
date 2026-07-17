require('dotenv').config();
process.env.FFMPEG_PATH = require('ffmpeg-static');

try {
  const { Platform } = require('youtubei.js');
  Platform.shim.eval = async (data) => {
    return new Function(data.output)();
  };
} catch (e) {
  console.error("Failed to shim youtubei.js platform:", e);
}
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err, origin) => {
  console.error('Uncaught Exception:', err, 'origin:', origin);
});
const { Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder, Partials, PermissionsBitField } = require('discord.js');
const ms = require('ms');
const config = require('./config');
config.prefix = '.';
const fs = require('fs');
const path = require('path');

let botOwners = [];
const extraDevelopers = ['279248701535420417', '440287582379835412'];

function isBotDeveloper(userId) {
  return botOwners.includes(userId) || extraDevelopers.includes(userId);
}

function formatMsTime(ms) {
  if (isNaN(ms) || ms < 0) return '00:00';
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatUptime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0 saniye';
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts = [];
  if (d > 0) parts.push(`${d} gün`);
  if (h > 0) parts.push(`${h} saat`);
  if (m > 0) parts.push(`${m} dakika`);
  if (parts.length === 0) parts.push(`${s} saniye`);
  return parts.join(', ');
}

function loadSicil() {
  try {
    if (fs.existsSync('sicil.json')) {
      return JSON.parse(fs.readFileSync('sicil.json', 'utf8'));
    }
  } catch (e) {
    console.error(e);
  }
  return {};
}

function saveSicil(data) {
  try {
    fs.writeFileSync('sicil.json', JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(e);
  }
}

function loadAktivite() {
  try {
    if (fs.existsSync('aktivite.json')) {
      const content = fs.readFileSync('aktivite.json', 'utf8').trim();
      return content ? JSON.parse(content) : {};
    }
  } catch (e) {
    console.error("loadAktivite error, returning empty object:", e);
  }
  return {};
}

function saveAktivite(data) {
  try {
    fs.writeFileSync('aktivite.json', JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(e);
  }
}

function updateAktiviteStreak(userId) {
  const data = loadAktivite();
  if (!data[userId]) {
    data[userId] = { games: {}, streak: 1, last_seen: "" };
  }
  const userData = data[userId];
  const todayStr = new Date().toISOString().split('T')[0];
  const lastSeenStr = userData.last_seen;

  if (lastSeenStr) {
    const lastSeenDate = new Date(lastSeenStr);
    const todayDate = new Date(todayStr);
    const diffTime = Math.abs(todayDate - lastSeenDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      userData.streak = (userData.streak || 0) + 1;
      userData.last_seen = todayStr;
    } else if (diffDays > 1) {
      userData.streak = 1;
      userData.last_seen = todayStr;
    }
  } else {
    userData.streak = 1;
    userData.last_seen = todayStr;
  }
  saveAktivite(data);
}

function loadLimitler() {
  try {
    if (fs.existsSync('limitler.json')) {
      return JSON.parse(fs.readFileSync('limitler.json', 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveLimitler(data) {
  try {
    fs.writeFileSync('limitler.json', JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

function loadLimitTakip() {
  try {
    if (fs.existsSync('limit_takip.json')) {
      return JSON.parse(fs.readFileSync('limit_takip.json', 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveLimitTakip(data) {
  try {
    fs.writeFileSync('limit_takip.json', JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

function loadGuvenlikDurum() {
  try {
    if (fs.existsSync('guvenlik_durum.json')) {
      return JSON.parse(fs.readFileSync('guvenlik_durum.json', 'utf8'));
    }
  } catch (e) {
    console.error('Error loading guvenlik_durum.json:', e);
  }
  return {};
}

function saveGuvenlikDurum(data) {
  try {
    if (Object.keys(data).length === 0) {
      if (fs.existsSync('guvenlik_durum.json')) {
        fs.unlinkSync('guvenlik_durum.json');
      }
    } else {
      fs.writeFileSync('guvenlik_durum.json', JSON.stringify(data, null, 2), 'utf8');
    }
  } catch (e) {
    console.error('Error saving guvenlik_durum.json:', e);
  }
}

function logEvent(level, module, message) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const logLine = `[${timestamp}] [${level}] [${module}] ${message}\n`;
  console.log(logLine.trim());
  try {
    fs.appendFileSync('bot.log', logLine, 'utf8');
  } catch (e) {
    console.error('Log writing error:', e);
  }
}

let autoresponders = [];
function loadAutoresponders() {
  try {
    if (fs.existsSync('otocevap.json')) {
      const content = fs.readFileSync('otocevap.json', 'utf8').trim();
      autoresponders = content ? JSON.parse(content) : [];
    } else {
      autoresponders = [
        { trigger: "sa", response: "Aleyküm selam, hoş geldin!" },
        { trigger: "discord", response: "Discord davet linkimiz: discord.gg/sunucu" }
      ];
      saveAutoresponders();
    }
  } catch (e) {
    console.error("loadAutoresponders error:", e);
    autoresponders = [];
  }
}

function saveAutoresponders() {
  try {
    fs.writeFileSync('otocevap.json', JSON.stringify(autoresponders, null, 2), 'utf8');
  } catch (e) {
    console.error("saveAutoresponders error:", e);
  }
}

loadAutoresponders();

let kayitAyarlari = {};
function loadKayitAyarlari() {
  try {
    if (fs.existsSync('kayit_ayarlari.json')) {
      const content = fs.readFileSync('kayit_ayarlari.json', 'utf8').trim();
      kayitAyarlari = content ? JSON.parse(content) : {};
    }
  } catch (e) {
    console.error("loadKayitAyarlari error:", e);
    kayitAyarlari = {};
  }
}

function saveKayitAyarlari() {
  try {
    fs.writeFileSync('kayit_ayarlari.json', JSON.stringify(kayitAyarlari, null, 2), 'utf8');
  } catch (e) {
    console.error("saveKayitAyarlari error:", e);
  }
}

loadKayitAyarlari();

let accountFilterConfig = {};
function loadAccountFilterConfig() {
  try {
    if (fs.existsSync('hesap_filtresi.json')) {
      const content = fs.readFileSync('hesap_filtresi.json', 'utf8').trim();
      accountFilterConfig = content ? JSON.parse(content) : {};
    }
  } catch (e) {
    console.error("loadAccountFilterConfig error:", e);
  }
}

function saveAccountFilterConfig() {
  try {
    fs.writeFileSync('hesap_filtresi.json', JSON.stringify(accountFilterConfig, null, 2), 'utf8');
  } catch (e) {
    console.error("saveAccountFilterConfig error:", e);
  }
}

loadAccountFilterConfig();

let auditLogConfig = {};

function getDefaultAuditLogOptions() {
  return {
    "opt-member-join": false,
    "opt-member-leave": false,
    "opt-username-update": false,
    "opt-member-roles-update": false,
    "opt-member-mute": false,
    "opt-member-unban": false,
    "opt-member-ban": false,
    "opt-member-deafen": false,
    "opt-voice-join": false,
    "opt-voice-leave": false,
    "opt-voice-move": false,
    "opt-mod-mute": false,
    "opt-mod-unmute": false,
    "opt-mod-ban": false,
    "opt-mod-unban": false,
    "opt-mod-kick": false,
    "opt-mod-deafen": false,
    "opt-message-update": false,
    "opt-message-delete": false,
    "opt-guild-update": false,
    "opt-emoji-create": false,
    "opt-emoji-update": false,
    "opt-emoji-delete": false,
    "opt-channel-create": false,
    "opt-channel-update": false,
    "opt-channel-delete": false,
    "opt-role-create": false,
    "opt-role-update": false,
    "opt-role-delete": false
  };
}

function getDefaultAuditLogConfig() {
  return {
    enabled: false,
    channel: "",
    options: getDefaultAuditLogOptions()
  };
}

function getGuildAuditLogConfig(guildId) {
  if (!guildId) return getDefaultAuditLogConfig();
  
  if (!auditLogConfig[guildId]) {
    auditLogConfig[guildId] = getDefaultAuditLogConfig();
  }
  
  const gConfig = auditLogConfig[guildId];
  if (gConfig.enabled === undefined) gConfig.enabled = false;
  if (gConfig.channel === undefined) gConfig.channel = "";
  if (!gConfig.options) gConfig.options = getDefaultAuditLogOptions();
  
  return gConfig;
}

function getCleanAuditLogConfig() {
  const clean = {};
  for (const key in auditLogConfig) {
    clean[key] = auditLogConfig[key];
  }
  if (client) {
    client.guilds.cache.forEach(guild => {
      if (!clean[guild.id]) {
        clean[guild.id] = getGuildAuditLogConfig(guild.id);
      }
    });
  }
  return clean;
}

function loadAuditLogConfig() {
  try {
    if (fs.existsSync('denetim_ayarlari.json')) {
      const content = fs.readFileSync('denetim_ayarlari.json', 'utf8').trim();
      auditLogConfig = content ? JSON.parse(content) : {};
    }
  } catch (e) {
    console.error("loadAuditLogConfig error:", e);
  }
}

function saveAuditLogConfig() {
  try {
    fs.writeFileSync('denetim_ayarlari.json', JSON.stringify(auditLogConfig, null, 2), 'utf8');
  } catch (e) {
    console.error("saveAuditLogConfig error:", e);
  }
}

loadAuditLogConfig();

let coinData = {};
function loadCoinData() {
  try {
    if (fs.existsSync('coinler.json')) {
      const content = fs.readFileSync('coinler.json', 'utf8').trim();
      coinData = content ? JSON.parse(content) : {};
    }
  } catch (e) {
    console.error("loadCoinData error:", e);
    coinData = {};
  }
}

function saveCoinData() {
  try {
    fs.writeFileSync('coinler.json', JSON.stringify(coinData, null, 2), 'utf8');
  } catch (e) {
    console.error("saveCoinData error:", e);
  }
}

function getUserData(userId) {
  if (!coinData[userId]) {
    coinData[userId] = {
      balance: 5000,
      lastDaily: 0,
      lastHunt: 0,
      lastBattle: 0,
      inventory: {},
      stats: {
        hunts: 0,
        battles: 0,
        wins: 0,
        losses: 0
      }
    };
    saveCoinData();
  }
  // Geriye dönük uyumluluk (backwards compatibility)
  if (!coinData[userId].inventory) {
    coinData[userId].inventory = {};
  }
  if (!coinData[userId].stats) {
    coinData[userId].stats = {
      hunts: 0,
      battles: 0,
      wins: 0,
      losses: 0
    };
  }
  return coinData[userId];
}

function getBalance(userId) {
  return getUserData(userId).balance;
}

function addCoins(userId, amount) {
  const user = getUserData(userId);
  user.balance = Math.max(0, user.balance + amount);
  saveCoinData();
}

loadCoinData();

const activeBlackjack = new Set();
const commandCooldowns = new Map();

function checkCooldown(userId, commandName, seconds) {
  const key = `${userId}:${commandName}`;
  const now = Date.now();
  if (commandCooldowns.has(key)) {
    const expiration = commandCooldowns.get(key);
    if (now < expiration) {
      return Math.ceil((expiration - now) / 1000);
    }
  }
  commandCooldowns.set(key, now + (seconds * 1000));
  return 0;
}

function parseBet(userId, betStr) {
  const balance = getBalance(userId);
  if (!betStr) return 0;
  
  const clean = betStr.toLowerCase().trim();
  if (clean === 'all') return balance;
  if (clean === 'half') return Math.floor(balance / 2);
  
  const parsed = parseInt(clean);
  if (isNaN(parsed) || parsed <= 0) return 0;
  return parsed;
}

function getCardValue(card) {
  const value = card.slice(0, -1);
  if (value === 'A') return 11;
  if (['J', 'Q', 'K'].includes(value)) return 10;
  return parseInt(value);
}

function calculateHand(hand) {
  let score = 0;
  let aces = 0;
  for (const card of hand) {
    const val = getCardValue(card);
    score += val;
    if (card.startsWith('A')) aces++;
  }
  while (score > 21 && aces > 0) {
    score -= 10;
    aces--;
  }
  return score;
}

function drawCard() {
  const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const suits = ['♠', '♥', '♦', '♣'];
  const val = values[Math.floor(Math.random() * values.length)];
  const suit = suits[Math.floor(Math.random() * suits.length)];
  return `${val}${suit}`;
}

let savedEmbeds = [];
function loadSavedEmbeds() {
  try {
    if (fs.existsSync('gomulu_mesajlar.json')) {
      const content = fs.readFileSync('gomulu_mesajlar.json', 'utf8').trim();
      savedEmbeds = content ? JSON.parse(content) : [];
    }
  } catch (e) {
    console.error("loadSavedEmbeds error:", e);
    savedEmbeds = [];
  }
}

function saveSavedEmbeds() {
  try {
    fs.writeFileSync('gomulu_mesajlar.json', JSON.stringify(savedEmbeds, null, 2), 'utf8');
  } catch (e) {
    console.error("saveSavedEmbeds error:", e);
  }
}

loadSavedEmbeds();

let automodConfig = {};

function getDefaultAutomodConfig() {
  return {
    reklam: { enabled: false, action: "delete", exemptChannels: [], exemptRoles: [] },
    kufur: { enabled: false, exemptChannels: [], exemptRoles: [] },
    link: { enabled: false, exemptChannels: [], exemptRoles: [] },
    kayitsizCikisBan: { enabled: false }
  };
}

function getGuildAutomodConfig(guildId) {
  if (!guildId) return getDefaultAutomodConfig();
  
  if (!automodConfig[guildId]) {
    if (automodConfig["default"]) {
      automodConfig[guildId] = JSON.parse(JSON.stringify(automodConfig["default"]));
    } else {
      automodConfig[guildId] = getDefaultAutomodConfig();
    }
  }
  
  const gConfig = automodConfig[guildId];
  if (!gConfig.reklam) gConfig.reklam = { enabled: false, action: "delete", exemptChannels: [], exemptRoles: [] };
  if (!gConfig.kufur) gConfig.kufur = { enabled: false, exemptChannels: [], exemptRoles: [] };
  if (!gConfig.link) gConfig.link = { enabled: false, exemptChannels: [], exemptRoles: [] };
  if (!gConfig.kayitsizCikisBan) gConfig.kayitsizCikisBan = { enabled: false };
  
  return gConfig;
}

function getCleanAutomodConfig() {
  const clean = {};
  for (const key in automodConfig) {
    if (key !== "default") {
      clean[key] = automodConfig[key];
    }
  }
  if (client) {
    client.guilds.cache.forEach(guild => {
      if (!clean[guild.id]) {
        clean[guild.id] = getGuildAutomodConfig(guild.id);
      }
    });
  }
  return clean;
}

function loadAutomodConfig() {
  try {
    if (fs.existsSync('automod.json')) {
      const content = fs.readFileSync('automod.json', 'utf8').trim();
      const parsed = content ? JSON.parse(content) : {};
      const hasOldKeys = ['reklam', 'kufur', 'link', 'kayitsizCikisBan'].some(k => k in parsed);
      
      if (hasOldKeys) {
        automodConfig = {};
        automodConfig["default"] = {
          reklam: parsed.reklam || { enabled: false, action: "delete", exemptChannels: [], exemptRoles: [] },
          kufur: parsed.kufur || { enabled: false, exemptChannels: [], exemptRoles: [] },
          link: parsed.link || { enabled: false, exemptChannels: [], exemptRoles: [] },
          kayitsizCikisBan: parsed.kayitsizCikisBan || { enabled: false }
        };
      } else {
        automodConfig = parsed;
      }
    }
  } catch (e) {
    console.error("loadAutomodConfig error:", e);
  }
}

function saveAutomodConfig() {
  try {
    fs.writeFileSync('automod.json', JSON.stringify(automodConfig, null, 2), 'utf8');
  } catch (e) {
    console.error("saveAutomodConfig error:", e);
  }
}

loadAutomodConfig();


let swearWords = [];
function loadSwearWords() {
  try {
    if (fs.existsSync('kufurler.json')) {
      const content = fs.readFileSync('kufurler.json', 'utf8').trim();
      swearWords = content ? JSON.parse(content) : [];
    }
  } catch (e) {
    console.error("loadSwearWords error:", e);
  }
}
loadSwearWords();

let spotifySongs = [];
function loadSpotifySongs() {
  try {
    if (fs.existsSync('spotify_sarkilar.json')) {
      const content = fs.readFileSync('spotify_sarkilar.json', 'utf8').trim();
      spotifySongs = content ? JSON.parse(content) : [];
    }
  } catch (e) {
    console.error("loadSpotifySongs error:", e);
  }
}
loadSpotifySongs();

function exportServerData() {
  if (!client) return;
  const data = {
    guilds: [],
    autoresponders: autoresponders,
    savedEmbeds: savedEmbeds,
    automod: getCleanAutomodConfig(),
    auditLog: getCleanAuditLogConfig(),
    kayitAyarlari: kayitAyarlari,
    accountFilter: accountFilterConfig,
    config: {
      roles: config.roles
    }
  };
  
  client.guilds.cache.forEach(guild => {
    const channels = [];
    guild.channels.cache.forEach(channel => {
      // 0=metin, 2=ses, 4=kategori, 5=duyuru, 13=sahne, 15=forum
      if ([0, 2, 4, 5, 13, 15].includes(channel.type)) {
        channels.push({
          id: channel.id,
          name: channel.name,
          type: channel.type // 0=text,2=voice,4=category,5=announcement
        });
      }
    });

    const roles = [];
    guild.roles.cache.forEach(role => {
      roles.push({
        id: role.id,
        name: role.name
      });
    });

    // Calculate member counts
    const totalMembers = guild.memberCount || 0;
    let activeMembers = 0;
    guild.members.cache.forEach(m => {
      if (m.presence && m.presence.status && m.presence.status !== 'offline') {
        activeMembers++;
      }
    });
    if (activeMembers === 0 && totalMembers > 0) {
      activeMembers = Math.floor(totalMembers * 0.18) + 1; // estimate 18% online if cache is empty
    }

    data.guilds.push({
      id: guild.id,
      name: guild.name,
      memberCount: totalMembers,
      activeCount: activeMembers,
      channels: channels,
      roles: roles
    });
  });

  try {
    fs.writeFileSync('website/server_data.json', JSON.stringify(data, null, 2), 'utf8');
    fs.writeFileSync('website/server_data.js', `window.guildsData = ${JSON.stringify(data, null, 2)};`, 'utf8');
  } catch (e) {
    console.error("Failed to export server data:", e);
  }
}

const activeGames = new Map();
let HANGMAN_WORDS = [
  "yazılım", "sunucu", "kodlama", "discord", "bilgisayar", "teknoloji", "internet", "klavye", "telefon",
  "oyuncu", "kulaklık", "televizyon", "mühendis", "yapayzeka", "veritabanı"
];
try {
  if (fs.existsSync('kelimeler.txt')) {
    const data = fs.readFileSync('kelimeler.txt', 'utf8');
    const loadedWords = data.split(/\r?\n/).map(line => line.trim().toLowerCase()).filter(line => line.length > 0);
    if (loadedWords.length > 0) {
      HANGMAN_WORDS = loadedWords;
    }
  }
} catch (e) {
  console.error(e);
}
const HANGMAN_STAGES = [
  `\`\`\`
  +---+
  |   |
      |
      |
      |
      |
=========
\`\`\``,
  `\`\`\`
  +---+
  |   |
  O   |
      |
      |
      |
=========
\`\`\``,
  `\`\`\`
  +---+
  |   |
  O   |
  |   |
      |
      |
=========
\`\`\``,
  `\`\`\`
  +---+
  |   |
  O   |
 /|   |
      |
      |
=========
\`\`\``,
  `\`\`\`
  +---+
  |   |
  O   |
 /|\\  |
      |
      |
=========
\`\`\``,
  `\`\`\`
  +---+
  |   |
  O   |
 /|\\  |
 /    |
      |
=========
\`\`\``,
  `\`\`\`
  +---+
  |   |
  O   |
 /|\\  |
 / \\  |
      |
=========
\`\`\``
];

let linkFilterActive = false;
const urlPattern = /https?:\/\/\S+|discord\.gg\/\S+/i;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel, Partials.Message],
  presence: {
    status: 'dnd'
  }
});

const TEMP_ROOMS_FILE = path.join(__dirname, 'temp_rooms.json');

function loadTempRooms() {
    try {
        if (fs.existsSync(TEMP_ROOMS_FILE)) {
            const data = fs.readFileSync(TEMP_ROOMS_FILE, 'utf-8');
            return new Map(JSON.parse(data));
        }
    } catch (e) {
        console.error("Error loading temp rooms:", e);
    }
    return new Map();
}

function saveTempRooms(rooms) {
    try {
        const data = JSON.stringify(Array.from(rooms.entries()));
        fs.writeFileSync(TEMP_ROOMS_FILE, data, 'utf-8');
    } catch (e) {
        console.error("Error saving temp rooms:", e);
    }
}

client.once('ready', async () => {
  console.log(`Bot başarıyla giriş yaptı: ${client.user.tag}`);
  logEvent('INFO', 'System', `Bot ready as ${client.user.tag}. Guilds: ${client.guilds.cache.size}`);
  exportServerData();

  // Fetch application owners dynamically
  try {
    const app = await client.application.fetch();
    if (app.owner) {
      if (app.owner.members) {
        botOwners = app.owner.members.map(m => m.id);
      } else {
        botOwners = [app.owner.id];
      }
      console.log(`[System] Bot sahipleri belirlendi: ${botOwners.join(', ')}`);
    }
  } catch (err) {
    console.error("Failed to fetch application owners:", err);
  }

  // Register slash command globally
  try {
    const commandsData = [
      {
        name: 'play',
        description: 'Spotify müzik çalar',
        options: [
          {
            name: 'link-or-query',
            description: 'Link or search query',
            type: 3, // STRING type
            required: false
          }
        ]
      }
    ];
    await client.application.commands.set(commandsData);
    console.log('Slash komutları başarıyla kaydedildi!');
  } catch (error) {
    console.error('Slash komutları kaydedilirken hata:', error);
  }
});

client.on('guildCreate', () => exportServerData());
client.on('guildDelete', () => exportServerData());



client.on('presenceUpdate', (oldPresence, newPresence) => {
  if (!newPresence || !newPresence.member || newPresence.user.bot) return;

  const userId = newPresence.member.id;
  const getGameName = (presence) => {
    if (!presence || !presence.activities) return null;
    const game = presence.activities.find(act => act.type === 0);
    return game ? game.name : null;
  };

  const oldGame = getGameName(oldPresence);
  const newGame = getGameName(newPresence);

  if (oldGame !== newGame) {
    const data = loadAktivite();
    if (!data[userId]) {
      data[userId] = { games: {}, streak: 1, last_seen: "" };
    }
    const userData = data[userId];
    if (!userData.games) userData.games = {};

    const nowTs = Math.floor(Date.now() / 1000);

    if (userData.current_game && oldGame && userData.current_game.name === oldGame) {
      const start = userData.current_game.start || nowTs;
      const elapsed = nowTs - start;
      if (elapsed > 0) {
        userData.games[oldGame] = (userData.games[oldGame] || 0) + elapsed;
      }
      delete userData.current_game;
    }

    if (newGame) {
      userData.current_game = { name: newGame, start: nowTs };
    }

    saveAktivite(data);
  }
});

// ==================== DENETİM KAYDI (AUDIT LOG) OLAY YÖNETİCİLERİ ====================

/**
 * Sunucuya özel denetim kaydı kanalına embed gönderir.
 * @param {Guild} guild - Discord sunucusu
 * @param {string} optionKey - Ayar anahtarı (örn. "opt-member-join")
 * @param {EmbedBuilder} embed - Gönderilecek embed
 */
async function sendAuditLog(guild, optionKey, embed) {
  try {
    const cfg = getGuildAuditLogConfig(guild.id);
    if (!cfg.enabled) return;
    if (!cfg.options[optionKey]) return;
    if (!cfg.channel) return;

    const channel = guild.channels.cache.get(cfg.channel);
    if (!channel || !channel.isTextBased()) return;

    const me = guild.members.me;
    if (me && !channel.permissionsFor(me).has(PermissionFlagsBits.SendMessages)) return;

    await channel.send({ embeds: [embed] });
  } catch (err) {
    logEvent('ERROR', 'AuditLog', `sendAuditLog hatası (${guild?.id}, ${optionKey}): ${err.message}`);
  }
}

// --- Üye Katıldı ---
client.on('guildMemberAdd', async (member) => {
  // Sicil güncelleme (mevcut)
  const data = loadSicil();
  const userId = member.id;
  if (!data[userId]) data[userId] = { joins: 0, leaves: 0, nicknames: [] };
  data[userId].joins += 1;
  saveSicil(data);

  // Yeni Hesap Filtresi (mevcut)
  const filter = accountFilterConfig[member.guild.id];
  if (filter && filter.enabled) {
    const createdTimestamp = member.user.createdTimestamp;
    const ageInDays = (Date.now() - createdTimestamp) / (1000 * 60 * 60 * 24);
    if (ageInDays < filter.minAge) {
      const ageRounded = Math.floor(ageInDays);
      logEvent('WARNING', 'AccountFilter', `Suspicious account: ${member.user.tag} (ID: ${userId}). Age: ${ageRounded}d / ${filter.minAge}d. Action: ${filter.action}`);
      try {
        try { await member.send(`⚠️ **${member.guild.name}** sunucusuna katılımınız engellendi. Hesabınız yeni açılmış (şüpheli) olduğu için güvenlik filtresine takıldı.\nHesap Yaşınız: **${ageRounded} gün** (Gerekli: **${filter.minAge} gün**).`); } catch (dmErr) {}
        const systemChannel = member.guild.systemChannel || member.guild.channels.cache.find(c => c.isTextBased() && c.permissionsFor(member.guild.members.me).has(PermissionFlagsBits.SendMessages));
        if (filter.action === 'kick') {
          await member.kick('Yeni Hesap Filtresi: Şüpheli hesap.');
          if (systemChannel) systemChannel.send(`🚨 **Yeni Hesap Filtresi Tetiklendi!**\n👤 <@${userId}> hesabının yaşı çok yeni olduğu için sunucudan **atıldı**.\nHesap Yaşı: **${ageRounded} gün** (Gerekli: **${filter.minAge} gün**).`);
        } else if (filter.action === 'ban') {
          await member.guild.members.ban(userId, { reason: 'Yeni Hesap Filtresi: Şüpheli hesap.' });
          if (systemChannel) systemChannel.send(`🚨 **Yeni Hesap Filtresi Tetiklendi!**\n👤 <@${userId}> hesabının yaşı çok yeni olduğu için sunucudan **yasaklandı (ban)**.\nHesap Yaşı: **${ageRounded} gün** (Gerekli: **${filter.minAge} gün**).`);
        } else if (filter.action === 'role' && filter.quarantineRole) {
          const role = member.guild.roles.cache.get(filter.quarantineRole);
          if (role) {
            await member.roles.add(role);
            if (systemChannel) systemChannel.send(`🚨 **Yeni Hesap Filtresi Tetiklendi!**\n👤 <@${userId}> hesabının yaşı çok yeni olduğu için **Karantina Rolü** (<@&${filter.quarantineRole}>) verildi.\nHesap Yaşı: **${ageRounded} gün** (Gerekli: **${filter.minAge} gün**).`);
          } else {
            logEvent('ERROR', 'AccountFilter', `Quarantine role ID ${filter.quarantineRole} not found.`);
          }
        }
      } catch (err) {
        logEvent('ERROR', 'AccountFilter', `Failed to apply action on ${userId}: ${err.message}`);
      }
      return; // Filtreye takılan üye için log atma
    }
  }

  // Denetim Kaydı: Üye Katıldı
  const accountAgeDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);
  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setAuthor({
      name: member.user.username,
      iconURL: member.user.displayAvatarURL({ dynamic: true })
    })
    .setDescription(`<@${member.id}> sunucuya katıldı`)
    .addFields(
      { name: 'Hesap Yaşı', value: `${accountAgeDays} gün`, inline: true }
    )
    .setFooter({ text: `ID: ${member.id}` })
    .setTimestamp();
  await sendAuditLog(member.guild, 'opt-member-join', embed);
});

// --- Üye Ayrıldı ---
client.on('guildMemberRemove', async (member) => {
  // Sicil güncelleme (mevcut)
  const data = loadSicil();
  const userId = member.id;
  if (!data[userId]) data[userId] = { joins: 0, leaves: 0, nicknames: [] };
  data[userId].leaves += 1;
  saveSicil(data);

  // Kayıtsız Çıkış Koruması (mevcut)
  const guildAutomod = getGuildAutomodConfig(member.guild.id);
  if (guildAutomod.kayitsizCikisBan && guildAutomod.kayitsizCikisBan.enabled) {
    const settings = kayitAyarlari[member.guild.id];
    const erkekId = settings?.erkekRolId || config.roles?.erkek;
    const kizId = settings?.kizRolId || config.roles?.kiz;
    const hasErkek = erkekId ? member.roles.cache.has(erkekId) : false;
    const hasKiz = kizId ? member.roles.cache.has(kizId) : false;
    if (!hasErkek && !hasKiz) {
      try {
        await member.guild.members.ban(userId, { reason: 'Automod: Kayıt olmadan sunucudan ayrıldı.' });
        logEvent('INFO', 'Automod', `Banned ${member.user.tag} (ID: ${userId}) for leaving without registering.`);
        const systemChannel = member.guild.systemChannel || member.guild.channels.cache.find(c => c.isTextBased() && c.permissionsFor(member.guild.members.me).has(PermissionFlagsBits.SendMessages));
        if (systemChannel) systemChannel.send(`🚨 **Kayıtsız Çıkış Koruması Tetiklendi!**\n👤 <@${userId}> (ID: ${userId}) kayıt olmadan sunucudan ayrıldığı için otomatik olarak yasaklandı.`);
      } catch (err) {
        logEvent('ERROR', 'Automod', `Failed to ban ${userId} on leave: ${err.message}`);
      }
    }
  }

  // Denetim Kaydı: Üye Ayrıldı
  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setAuthor({
      name: member.user.username,
      iconURL: member.user.displayAvatarURL({ dynamic: true })
    })
    .setDescription(`<@${member.id}> sunucudan ayrıldı`)
    .addFields(
      { name: 'Sunucuya Katılma', value: member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Bilinmiyor', inline: true }
    )
    .setFooter({ text: `ID: ${member.id}` })
    .setTimestamp();
  await sendAuditLog(member.guild, 'opt-member-leave', embed);
});

// --- Üye Güncellendi (rol, isim, susturma) ---
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  // Sicil: nickname takibi (mevcut)
  if (oldMember.nickname !== newMember.nickname) {
    const data = loadSicil();
    const userId = newMember.id;
    if (!data[userId]) data[userId] = { joins: 0, leaves: 0, nicknames: [] };
    const newNick = newMember.nickname || newMember.user.username;
    if (!data[userId].nicknames.includes(newNick)) data[userId].nicknames.push(newNick);
    saveSicil(data);
  }

  const guild = newMember.guild;

  // Kullanıcı adı değişimi
  if (oldMember.user.username !== newMember.user.username || oldMember.nickname !== newMember.nickname) {
    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setAuthor({
        name: newMember.user.username,
        iconURL: newMember.user.displayAvatarURL({ dynamic: true })
      })
      .setDescription(`<@${newMember.id}> ismini güncelledi`)
      .addFields(
        { name: 'Eski İsim', value: oldMember.nickname || oldMember.user.username, inline: true },
        { name: 'Yeni İsim', value: newMember.nickname || newMember.user.username, inline: true }
      )
      .setFooter({ text: `ID: ${newMember.id}` })
      .setTimestamp();
    await sendAuditLog(guild, 'opt-username-update', embed);
  }

  // Rol değişimi
  const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
  const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
  
  if (addedRoles.size > 0) {
    for (const [roleId, role] of addedRoles) {
      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setAuthor({
          name: newMember.user.username,
          iconURL: newMember.user.displayAvatarURL({ dynamic: true })
        })
        .setDescription(`<@${newMember.id}> bir rol eklendi`)
        .addFields({ name: 'Yeni Rol', value: `${role.name}`, inline: false })
        .setFooter({ text: `ID: ${newMember.id}` })
        .setTimestamp();
      await sendAuditLog(guild, 'opt-member-roles-update', embed);
    }
  }
  
  if (removedRoles.size > 0) {
    for (const [roleId, role] of removedRoles) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setAuthor({
          name: newMember.user.username,
          iconURL: newMember.user.displayAvatarURL({ dynamic: true })
        })
        .setDescription(`<@${newMember.id}> bir rol alındı`)
        .addFields({ name: 'Alınan Rol', value: `${role.name}`, inline: false })
        .setFooter({ text: `ID: ${newMember.id}` })
        .setTimestamp();
      await sendAuditLog(guild, 'opt-member-roles-update', embed);
    }
  }

  // Susturma değişimi
  const wasMuted = oldMember.communicationDisabledUntilTimestamp && oldMember.communicationDisabledUntilTimestamp > Date.now();
  const isMuted = newMember.communicationDisabledUntilTimestamp && newMember.communicationDisabledUntilTimestamp > Date.now();
  if (!wasMuted && isMuted) {
    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setAuthor({
        name: newMember.user.username,
        iconURL: newMember.user.displayAvatarURL({ dynamic: true })
      })
      .setDescription(`<@${newMember.id}> susturuldu`)
      .addFields(
        { name: 'Süre Bitiş', value: `<t:${Math.floor(newMember.communicationDisabledUntilTimestamp / 1000)}:R>`, inline: true }
      )
      .setFooter({ text: `ID: ${newMember.id}` })
      .setTimestamp();
    await sendAuditLog(guild, 'opt-member-mute', embed);
  }

  // Sunucu Sağırlaştırma
  const wasDeafened = oldMember.voice?.serverDeaf;
  const isDeafened = newMember.voice?.serverDeaf;
  if (!wasDeafened && isDeafened) {
    const embed = new EmbedBuilder()
      .setColor(0xFF6B35)
      .setAuthor({
        name: newMember.user.username,
        iconURL: newMember.user.displayAvatarURL({ dynamic: true })
      })
      .setDescription(`<@${newMember.id}> sağırlaştırıldı`)
      .setFooter({ text: `ID: ${newMember.id}` })
      .setTimestamp();
    await sendAuditLog(guild, 'opt-member-deafen', embed);
  } else if (wasDeafened && !isDeafened) {
    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setAuthor({
        name: newMember.user.username,
        iconURL: newMember.user.displayAvatarURL({ dynamic: true })
      })
      .setDescription(`<@${newMember.id}> sağırlaştırılması kaldırıldı`)
      .setFooter({ text: `ID: ${newMember.id}` })
      .setTimestamp();
    await sendAuditLog(guild, 'opt-member-deafen', embed);
  }
});

// --- Ses Kanalı Olayları ---
client.on('voiceStateUpdate', async (oldState, newState) => {
  const guild = newState.guild || oldState.guild;
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  const oldChannel = oldState.channel;
  const newChannel = newState.channel;

  // --- TempVoice Join-to-Create Logic ---
  if (newChannel) {
      const lowerName = newChannel.name.toLowerCase();
      if (lowerName === 'özel ses' || lowerName === '🔊 özel ses' || lowerName === 'özelsesacıptakılın' || lowerName === '🔊 özelsesacıptakılın' || lowerName === 'tempvoice' || lowerName.includes('özel ses') || lowerName.includes('ozel ses')) {
          try {
              const category = newChannel.parent;
              const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
              const tempChannel = await guild.channels.create({
                  name: `${member.user.username}'in Odası`,
                  type: 2, // GUILD_VOICE
                  parent: category ? category.id : null,
                  permissionOverwrites: [
                      {
                          id: guild.roles.everyone.id,
                          allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel]
                      },
                      {
                          id: member.id,
                          allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.DeafenMembers, PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel]
                      },
                      {
                          id: guild.members.me.id,
                          allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.DeafenMembers, PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel]
                      }
                  ]
              });

              await member.voice.setChannel(tempChannel);

              let textLogChannel = guild.channels.cache.find(c => c.name === 'komutlar' && c.type === 0);
              if (!textLogChannel && category) {
                  textLogChannel = category.children.cache.find(c => c.name === 'komutlar' && c.type === 0);
              }
              if (!textLogChannel) {
                  textLogChannel = guild.channels.cache.find(c => c.type === 0 && c.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages));
              }

              if (textLogChannel) {
                  await textLogChannel.permissionOverwrites.create(guild.roles.everyone.id, {
                      ViewChannel: false
                  }).catch(() => null);
                  await textLogChannel.permissionOverwrites.create(member.id, {
                      ViewChannel: true,
                      SendMessages: false
                  }).catch(() => null);

                  const embed = new EmbedBuilder()
                      .setColor(0x2B2D31)
                      .setTitle('TempVoice Interface')
                      .setDescription(
                          'Bu arayüzü kullanarak geçici ses kanalınızı istediğiniz şekilde yönetebilirsiniz.\n\n' +
                          '🚪 **ODA İSMİ** ᠁ 👥 **ODA LİMİTİ** ᠁ 🔒 **GİZLİLİK** ᠁ ⏳ **BEKLEME ODASI** ᠁ 💬 **SOHBET ODASI**\n' +
                          '👤 **GÜVENİLİR** ᠁ 👤 **GÜVENSİZ** ᠁ 📩 **DAVET** ᠁ 📞 **SESTEN AT** ᠁ 🌍 **BÖLGE**\n' +
                          '🚫 **ENGELLE** ᠁ ✅ **ENGELİ KALDIR** ᠁ 👑 **SAHİPLEN** ᠁ 🔄 **ODAYI DEVRET** ᠁ 🗑️ **SİL**\n\n' +
                          'Bu arayüzü kullanmak için aşağıdaki uygun butonlara tıklayın.'
                      )
                      .setFooter({ text: `Oda Sahibi: ${member.user.username}`, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
                      .setTimestamp();

                  const row1 = new ActionRowBuilder().addComponents(
                      new ButtonBuilder().setCustomId('tempvoice_name').setEmoji('🚪').setStyle(ButtonStyle.Secondary),
                      new ButtonBuilder().setCustomId('tempvoice_limit').setEmoji('👥').setStyle(ButtonStyle.Secondary),
                      new ButtonBuilder().setCustomId('tempvoice_lock').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
                      new ButtonBuilder().setCustomId('tempvoice_waitroom').setEmoji('⏳').setStyle(ButtonStyle.Secondary),
                      new ButtonBuilder().setCustomId('tempvoice_chatroom').setEmoji('💬').setStyle(ButtonStyle.Secondary)
                  );

                  const row2 = new ActionRowBuilder().addComponents(
                      new ButtonBuilder().setCustomId('tempvoice_permit_menu').setEmoji('👤').setStyle(ButtonStyle.Secondary),
                      new ButtonBuilder().setCustomId('tempvoice_unpermit_menu').setEmoji('👤').setStyle(ButtonStyle.Danger),
                      new ButtonBuilder().setCustomId('tempvoice_invite').setEmoji('📩').setStyle(ButtonStyle.Secondary),
                      new ButtonBuilder().setCustomId('tempvoice_kick').setEmoji('📞').setStyle(ButtonStyle.Secondary),
                      new ButtonBuilder().setCustomId('tempvoice_region').setEmoji('🌍').setStyle(ButtonStyle.Secondary)
                  );

                  const row3 = new ActionRowBuilder().addComponents(
                      new ButtonBuilder().setCustomId('tempvoice_block_menu').setEmoji('🚫').setStyle(ButtonStyle.Secondary),
                      new ButtonBuilder().setCustomId('tempvoice_unblock_menu').setEmoji('✅').setStyle(ButtonStyle.Secondary),
                      new ButtonBuilder().setCustomId('tempvoice_claim').setEmoji('👑').setStyle(ButtonStyle.Secondary),
                      new ButtonBuilder().setCustomId('tempvoice_transfer').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
                      new ButtonBuilder().setCustomId('tempvoice_delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
                  );

                  const interfaceMessage = await textLogChannel.send({
                      content: `<@${member.id}> odanız oluşturuldu!`,
                      embeds: [embed],
                      components: [row1, row2, row3]
                  });

                  const tempRooms = loadTempRooms();
                  tempRooms.set(tempChannel.id, {
                      ownerId: member.id,
                      messageId: interfaceMessage.id,
                      textChannelId: textLogChannel.id,
                      tempTextChannelId: null,
                      categoryId: category ? category.id : null,
                      isLocked: false,
                      isHidden: false,
                      blockedUsers: []
                  });
                  saveTempRooms(tempRooms);
              }
          } catch (err) {
              console.error("Error creating temp voice channel:", err);
          }
      }
  }

  // --- TempVoice Empty Channel Cleanup ---
  if (oldChannel) {
      const tempRooms = loadTempRooms();
      if (tempRooms.has(oldChannel.id)) {
          if (oldChannel.members.size === 0) {
              try {
                  const roomData = tempRooms.get(oldChannel.id);
                  const textChannel = guild.channels.cache.get(roomData.textChannelId);
                  if (textChannel) {
                      const msg = await textChannel.messages.fetch(roomData.messageId).catch(() => null);
                      if (msg) await msg.delete().catch(() => null);
                      await textChannel.permissionOverwrites.delete(roomData.ownerId).catch(() => null);
                  }
                  if (roomData.tempTextChannelId) {
                      const tempTextChan = guild.channels.cache.get(roomData.tempTextChannelId);
                      if (tempTextChan) await tempTextChan.delete().catch(() => null);
                  }
                  await oldChannel.delete().catch(() => null);
                  tempRooms.delete(oldChannel.id);
                  saveTempRooms(tempRooms);
                  return; // Stop here if channel cleanup happened
              } catch (err) {
                  console.error("Error cleaning up temp channel:", err);
              }
          }
      }
  }

  // 1. Sunucu sessize alma / sağırlaştırma değişimi (serverMute / serverDeaf)
  const muteChanged = oldState.serverMute !== newState.serverMute;
  const deafChanged = oldState.serverDeaf !== newState.serverDeaf;

  if (muteChanged || deafChanged) {
      let executor = member.user;
      try {
          const fetchedLogs = await guild.fetchAuditLogs({ limit: 1 });
          const logEntry = fetchedLogs.entries.first();
          if (logEntry && logEntry.action === 24 && logEntry.target && logEntry.target.id === member.id && (Date.now() - logEntry.createdTimestamp < 8000)) {
              executor = logEntry.executor;
          }
      } catch (e) {
          console.error("Error fetching audit logs:", e);
      }

      const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setAuthor({
              name: executor.username,
              iconURL: executor.displayAvatarURL({ dynamic: true })
          })
          .setDescription('<@' + member.id + "> 'ın ses durumu güncellendi.")
          .setFooter({ text: guild.name })
          .setTimestamp();

      if (muteChanged) {
          embed.addFields({
              name: '🎙️ Sunucu Susturması',
              value: newState.serverMute ? 'True' : 'False',
              inline: false
          });
      }
      if (deafChanged) {
          embed.addFields({
              name: '🎧 Sunucu Sağırlaştırması',
              value: newState.serverDeaf ? 'True' : 'False',
              inline: false
          });
      }

      await sendAuditLog(guild, newState.serverMute || newState.serverDeaf ? 'opt-mod-mute' : 'opt-mod-unmute', embed);
      return;
  }

  // 2. Ses kanalına girdi
  if (!oldChannel && newChannel) {
    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setAuthor({
        name: member.user.username,
        iconURL: member.user.displayAvatarURL({ dynamic: true })
      })
      .setDescription('<@' + member.id + '> ses kanalına katıldı `' + newChannel.name + '` .')
      .setFooter({ text: guild.name })
      .setTimestamp();
    await sendAuditLog(guild, 'opt-voice-join', embed);
    return;
  }

  // 3. Ses kanalından çıktı
  if (oldChannel && !newChannel) {
    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setAuthor({
        name: member.user.username,
        iconURL: member.user.displayAvatarURL({ dynamic: true })
      })
      .setDescription('<@' + member.id + '> ses kanalından ayrıldı `' + oldChannel.name + '` .')
      .setFooter({ text: guild.name })
      .setTimestamp();
    await sendAuditLog(guild, 'opt-voice-leave', embed);
    return;
  }

  // 4. Farklı ses kanalına geçti
  if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setAuthor({
        name: member.user.username,
        iconURL: member.user.displayAvatarURL({ dynamic: true })
      })
      .setDescription('<@' + member.id + '> ses kanalları arasında geçiş yaptı `' + oldChannel.name + '` => `' + newChannel.name + '` .')
      .setFooter({ text: guild.name })
      .setTimestamp();
    await sendAuditLog(guild, 'opt-voice-move', embed);
  }
});

// --- Üye Yasaklandı ---
client.on('guildBanAdd', async (ban) => {
  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('🔨 Üye Yasaklandı')
    .setThumbnail(ban.user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: 'Kullanıcı', value: `${ban.user.tag}`, inline: true },
      { name: 'ID', value: ban.user.id, inline: true },
      { name: 'Sebep', value: ban.reason || 'Belirtilmedi', inline: false }
    )
    .setTimestamp();
  await sendAuditLog(ban.guild, 'opt-member-ban', embed);
});

// --- Üye Yasağı Kaldırıldı ---
client.on('guildBanRemove', async (ban) => {
  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('✅ Üye Yasağı Kaldırıldı')
    .setThumbnail(ban.user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: 'Kullanıcı', value: `${ban.user.tag}`, inline: true },
      { name: 'ID', value: ban.user.id, inline: true }
    )
    .setTimestamp();
  await sendAuditLog(ban.guild, 'opt-member-unban', embed);
});

// --- Mesaj Güncellendi ---
client.on('messageUpdate', async (oldMsg, newMsg) => {
  if (!newMsg.guild) return;
  if (newMsg.author?.bot) return;
  if (oldMsg.content === newMsg.content) return;
  const embed = new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle('✏️ Mesaj Düzenlendi')
    .addFields(
      { name: 'Kullanıcı', value: newMsg.author ? `<@${newMsg.author.id}> (${newMsg.author.tag})` : 'Bilinmiyor', inline: true },
      { name: 'Kanal', value: `<#${newMsg.channelId}>`, inline: true },
      { name: 'Eski Mesaj', value: (oldMsg.content || '*(boş)*').substring(0, 1024), inline: false },
      { name: 'Yeni Mesaj', value: (newMsg.content || '*(boş)*').substring(0, 1024), inline: false },
      { name: 'Mesaj Linki', value: `[Mesaja Git](${newMsg.url})`, inline: false }
    )
    .setTimestamp();
  await sendAuditLog(newMsg.guild, 'opt-message-update', embed);
});

// --- Mesaj Silindi ---
client.on('messageDelete', async (msg) => {
  if (!msg.guild) return;
  if (msg.author?.bot) return;
  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('🗑️ Mesaj Silindi')
    .addFields(
      { name: 'Kullanıcı', value: msg.author ? `<@${msg.author.id}> (${msg.author.tag})` : 'Bilinmiyor', inline: true },
      { name: 'Kanal', value: `<#${msg.channelId}>`, inline: true },
      { name: 'Mesaj İçeriği', value: (msg.content || '*(medya / gömülü içerik)*').substring(0, 1024), inline: false }
    )
    .setTimestamp();
  await sendAuditLog(msg.guild, 'opt-message-delete', embed);
});

// --- Sunucu Güncellendi ---
client.on('guildUpdate', async (oldGuild, newGuild) => {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('⚙️ Sunucu Güncellendi')
    .addFields(
      { name: 'Eski İsim', value: oldGuild.name, inline: true },
      { name: 'Yeni İsim', value: newGuild.name, inline: true }
    )
    .setTimestamp();
  await sendAuditLog(newGuild, 'opt-guild-update', embed);
});

// --- Emoji Oluşturuldu ---
client.on('emojiCreate', async (emoji) => {
  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('😀 Emoji Oluşturuldu')
    .addFields(
      { name: 'Emoji', value: `<:${emoji.name}:${emoji.id}> — \`${emoji.name}\``, inline: true },
      { name: 'ID', value: emoji.id, inline: true }
    )
    .setThumbnail(emoji.url)
    .setTimestamp();
  await sendAuditLog(emoji.guild, 'opt-emoji-create', embed);
});

// --- Emoji Güncellendi ---
client.on('emojiUpdate', async (oldEmoji, newEmoji) => {
  const embed = new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle('😀 Emoji Güncellendi')
    .addFields(
      { name: 'Eski İsim', value: oldEmoji.name, inline: true },
      { name: 'Yeni İsim', value: newEmoji.name, inline: true }
    )
    .setTimestamp();
  await sendAuditLog(newEmoji.guild, 'opt-emoji-update', embed);
});

// --- Emoji Silindi ---
client.on('emojiDelete', async (emoji) => {
  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('❌ Emoji Silindi')
    .addFields(
      { name: 'İsim', value: emoji.name, inline: true },
      { name: 'ID', value: emoji.id, inline: true }
    )
    .setTimestamp();
  await sendAuditLog(emoji.guild, 'opt-emoji-delete', embed);
});

// --- Kanal Oluşturuldu ---
client.on('channelCreate', async (channel) => {
  exportServerData();
  if (!channel.guild) return;
  
  let executorId = '';
  try {
      const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: 1 });
      const logEntry = fetchedLogs.entries.first();
      if (logEntry && logEntry.action === 10 && logEntry.target && logEntry.target.id === channel.id) {
          executorId = logEntry.executor.id;
      }
  } catch (e) {
      console.error("Error fetching audit logs for channelCreate:", e);
  }

  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setAuthor({
      name: channel.guild.name,
      iconURL: channel.guild.iconURL({ dynamic: true })
    })
    .setDescription('🏠 **Kanal Oluşturuldu: `' + channel.name + '`**')
    .addFields(
      { name: 'Sorumlu Yetkili:', value: executorId ? `<@${executorId}>` : 'Bilinmiyor', inline: false }
    )
    .setFooter({ text: channel.parent ? channel.parent.name : channel.guild.name })
    .setTimestamp();
  await sendAuditLog(channel.guild, 'opt-channel-create', embed);
});

// --- Kanal Güncellendi ---
client.on('channelUpdate', async (oldChannel, newChannel) => {
  if (!newChannel.guild) return;
  if (oldChannel.name === newChannel.name && oldChannel.topic === newChannel.topic) return;
  const embed = new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle('📝 Kanal Güncellendi')
    .addFields(
      { name: 'Kanal', value: `<#${newChannel.id}>`, inline: true },
      { name: 'Eski İsim', value: oldChannel.name, inline: true },
      { name: 'Yeni İsim', value: newChannel.name, inline: true }
    )
    .setTimestamp();
  await sendAuditLog(newChannel.guild, 'opt-channel-update', embed);
});

// --- Kanal Silindi ---
client.on('channelDelete', async (channel) => {
  exportServerData();
  if (!channel.guild) return;
  
  let executorId = '';
  try {
      const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: 1 });
      const logEntry = fetchedLogs.entries.first();
      if (logEntry && logEntry.action === 12 && logEntry.targetId === channel.id) {
          executorId = logEntry.executor.id;
      }
  } catch (e) {
      console.error("Error fetching audit logs for channelDelete:", e);
  }

  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setAuthor({
      name: channel.guild.name,
      iconURL: channel.guild.iconURL({ dynamic: true })
    })
    .setDescription('🗑️ **Kanal Silindi: `' + channel.name + '`**')
    .addFields(
      { name: 'Sorumlu Yetkili:', value: executorId ? `<@${executorId}>` : 'Bilinmiyor', inline: false }
    )
    .setFooter({ text: channel.parent ? channel.parent.name : channel.guild.name })
    .setTimestamp();
  await sendAuditLog(channel.guild, 'opt-channel-delete', embed);
});

// --- Rol Oluşturuldu ---
client.on('roleCreate', async (role) => {
  exportServerData();
  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('🎭 Rol Oluşturuldu')
    .addFields(
      { name: 'Rol', value: `<@&${role.id}> (${role.name})`, inline: true },
      { name: 'ID', value: role.id, inline: true }
    )
    .setTimestamp();
  await sendAuditLog(role.guild, 'opt-role-create', embed);
});

// --- Rol Güncellendi ---
client.on('roleUpdate', async (oldRole, newRole) => {
  if (oldRole.name === newRole.name && oldRole.color === newRole.color) return;
  const embed = new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle('✏️ Rol Güncellendi')
    .addFields(
      { name: 'Rol', value: `<@&${newRole.id}>`, inline: true },
      { name: 'Eski İsim', value: oldRole.name, inline: true },
      { name: 'Yeni İsim', value: newRole.name, inline: true }
    )
    .setTimestamp();
  await sendAuditLog(newRole.guild, 'opt-role-update', embed);
});

// --- Rol Silindi ---
client.on('roleDelete', async (role) => {
  exportServerData();
  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('🗑️ Rol Silindi')
    .addFields(
      { name: 'İsim', value: role.name, inline: true },
      { name: 'ID', value: role.id, inline: true }
    )
    .setTimestamp();
  await sendAuditLog(role.guild, 'opt-role-delete', embed);
});

// ==================== ANTİ-NUKE VE MODERASYON DENETİM KAYDI ====================
// guildAuditLogEntryCreate ile mod-ban, mod-unban, mod-kick, mod-mute, mod-unmute
client.on('guildAuditLogEntryCreate', async (entry, guild) => {
  // --- Moderatör Ban ---
  if (entry.action === 22) { // BAN
    const executor = entry.executor;
    if (executor && !executor.bot) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🔨 Moderatör Ban Uyguladı')
        .addFields(
          { name: 'Hedef', value: entry.target ? `${entry.target.tag} (ID: ${entry.target.id})` : entry.targetId, inline: true },
          { name: 'Yetkili', value: `<@${executor.id}> (${executor.tag})`, inline: true },
          { name: 'Sebep', value: entry.reason || 'Belirtilmedi', inline: false }
        )
        .setTimestamp();
      await sendAuditLog(guild, 'opt-mod-ban', embed);
    }
  }

  // --- Moderatör Unban ---
  if (entry.action === 23) { // UNBAN
    const executor = entry.executor;
    if (executor && !executor.bot) {
      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Moderatör Ban Kaldırdı')
        .addFields(
          { name: 'Hedef', value: entry.target ? `${entry.target.tag} (ID: ${entry.target.id})` : entry.targetId, inline: true },
          { name: 'Yetkili', value: `<@${executor.id}> (${executor.tag})`, inline: true }
        )
        .setTimestamp();
      await sendAuditLog(guild, 'opt-mod-unban', embed);
    }
  }

  // --- Moderatör Kick ---
  if (entry.action === 20) { // KICK
    const executor = entry.executor;
    if (executor && !executor.bot) {
      const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('👟 Moderatör Üye Attı')
        .addFields(
          { name: 'Hedef', value: entry.target ? `${entry.target.tag} (ID: ${entry.target.id})` : entry.targetId, inline: true },
          { name: 'Yetkili', value: `<@${executor.id}> (${executor.tag})`, inline: true },
          { name: 'Sebep', value: entry.reason || 'Belirtilmedi', inline: false }
        )
        .setTimestamp();
      await sendAuditLog(guild, 'opt-mod-kick', embed);
    }
  }

  // --- Moderatör Mute (communication_disabled) ---
  if (entry.action === 24) { // MEMBER_UPDATE
    const executor = entry.executor;
    const changes = entry.changes || [];
    const muteChange = changes.find(c => c.key === 'communication_disabled_until');
    if (executor && !executor.bot && muteChange) {
      const isMuting = !!muteChange.new;
      const embed = new EmbedBuilder()
        .setColor(isMuting ? 0xFFA500 : 0x57F287)
        .setTitle(isMuting ? '🔇 Moderatör Susturdu' : '🔊 Moderatör Susturmayı Kaldırdı')
        .addFields(
          { name: 'Hedef', value: entry.target ? `<@${entry.target.id}> (${entry.target.tag || entry.target.id})` : entry.targetId, inline: true },
          { name: 'Yetkili', value: `<@${executor.id}> (${executor.tag})`, inline: true },
          ...(isMuting && muteChange.new ? [{ name: 'Süre Bitiş', value: `<t:${Math.floor(new Date(muteChange.new).getTime() / 1000)}:R>`, inline: true }] : [])
        )
        .setTimestamp();
      await sendAuditLog(guild, isMuting ? 'opt-mod-mute' : 'opt-mod-unmute', embed);
    }
  }

  // ==================== ANTİ-NUKE KONTROL (ESKİ KOD) ====================
  if (entry.action !== 22 && entry.action !== 20) return;

  const executor = entry.executor;
  if (!executor || executor.bot || executor.id === guild.ownerId) return;

  const executorIdStr = executor.id;
  const actionType = entry.action === 22 ? 'ban' : 'kick';

  const limits = loadLimitler();
  const member = await guild.members.fetch(executorIdStr).catch(() => null);
  if (!member) return;

  const relevantLimits = [];
  member.roles.cache.forEach(role => {
    if (limits[role.id]) {
      const roleLimit = limits[role.id][`${actionType}_limit`];
      if (roleLimit !== undefined && roleLimit !== null) {
        relevantLimits.push(roleLimit);
      }
    }
  });

  if (relevantLimits.length === 0) return;

  const maxAllowed = Math.max(...relevantLimits);

  const takip = loadLimitTakip();
  if (!takip[executorIdStr]) {
    takip[executorIdStr] = { ban: [], kick: [] };
  }

  const now = Math.floor(Date.now() / 1000);
  takip[executorIdStr][actionType] = (takip[executorIdStr][actionType] || []).filter(ts => now - ts < 3600);
  takip[executorIdStr][actionType].push(now);
  saveLimitTakip(takip);

  const actionCount = takip[executorIdStr][actionType].length;
  logEvent('INFO', 'Anti-Nuke', `Action detected: ${actionType} by User ${executor.tag} (ID: ${executorIdStr}). Count in last 1 hour: ${actionCount}/${maxAllowed}`);

  if (actionCount > maxAllowed) {
    logEvent('WARNING', 'Anti-Nuke', `Limit exceeded by ${executor.tag} (ID: ${executorIdStr})! Action: ${actionType}, Count: ${actionCount}/${maxAllowed}. Stripping roles and reversing action.`);
    try {
      const rolesToRemove = member.roles.cache.filter(role => !role.managed && role.id !== guild.roles.everyone.id);
      if (rolesToRemove.size > 0) {
        await member.roles.remove(rolesToRemove, 'Anti-Nuke: Ban/Kick limitini aşma');
      }

      if (actionType === 'ban') {
        await guild.members.unban(entry.targetId, 'Anti-Nuke: Yetkisiz Ban İptali');
      }

      const channel = guild.systemChannel || guild.channels.cache.find(c => c.isTextBased());
      if (channel) {
        channel.send(`🚨 **Anti-Nuke Koruması Tetiklendi!**\n` +
          `⚠️ <@${executorIdStr}> yetkilisi 1 saat içinde izin verilen maksimum **${actionType}** limitini (**${maxAllowed}**) aştı!\n` +
          `🔒 Üyenin tüm rolleri geri alındı ve son yapılan ban işlemi iptal edildi.`);
      }
    } catch (err) {
      logEvent('ERROR', 'Anti-Nuke', `Failed to enforce anti-nuke for ${executorIdStr}: ${err.message}`);
    }
  }
});

// Helper to resolve user ID from mention or plain ID
function resolveUserId(arg) {
  if (!arg) return null;
  const cleaned = arg.replace(/[^0-9]/g, '');
  return cleaned || null;
}

async function getYTInstance() {
  const { Innertube } = require('youtubei.js');
  return await Innertube.create();
}

const players = new Map();

// Helper to handle Spotify Play Command with Ephemeral Search & Selection
async function handlePlayCommandEphemeral(ctx, query) {
  const member = ctx.member;
  const voiceChannel = member?.voice?.channel;
  if (!voiceChannel) {
    const errorMsg = '⚠️ Bu komutu kullanmak için bir ses kanalında olmalısınız!';
    return ctx.reply({ content: errorMsg, ephemeral: true });
  }

  const createPlayEmbed = (song) => {
    return new EmbedBuilder()
      .setTitle(`▶️ Oynatılıyor: ${song.title}`)
      .setDescription(
        `👤 **Sanatçı:** ${song.artist}\n` +
        `🎵 **Kaynak:** Spotify Premium`
      )
      .setColor('#1DB954')
      .setThumbnail(song.thumbnail || 'https://storage.googleapis.com/pr-newsroom-wp/1/2018/11/Spotify_Logo_RGB_Green.png');
  };

  if (!query) {
    return ctx.reply({ content: '⚠️ Şarkı adı aranamadı. Arama iptal edildi.', ephemeral: true });
  }

  let matches = [];
  try {
    const yts = require('yt-search');
    const searchResult = await yts(query);
    matches = searchResult && searchResult.videos ? searchResult.videos.slice(0, 10) : [];
  } catch (err) {
    console.error("yt-search error:", err);
  }

  if (matches.length === 0) {
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Arama Sonucu')
      .setDescription(`Spotify veritabanında veya YouTube'da **'${query}'** araması ile eşleşen bir şarkı bulunamadı.`)
      .setColor('#FF0000');
    return ctx.reply({ embeds: [errorEmbed], ephemeral: true });
  }

  // Multiple matches: show ephemeral list and select menu
  const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require('discord.js');
  
  const listText = matches.map((song, i) => `**${i+1}.** ${song.title} - *${song.author.name}*`).join('\n');
  const embed = new EmbedBuilder()
    .setTitle('🎵 Spotify Arama Sonuçları')
    .setDescription(`**'${query}'** araması için birden fazla sonuç bulundu. Lütfen çalmak istediğiniz şarkıyı aşağıdaki menüden seçin:\n\n${listText}`)
    .setColor('#1DB954');

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('play_song_select_ephemeral')
    .setPlaceholder('Çalmak istediğiniz şarkıyı seçin...')
    .addOptions(
      matches.map((song, index) => 
        new StringSelectMenuOptionBuilder()
          .setLabel(`${song.title}`.substring(0, 100))
          .setValue(`play_idx_${index}_${Date.now()}`)
          .setDescription(`${song.author.name}`.substring(0, 100))
      )
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);
  
  // Reply ephemerally!
  const response = await ctx.reply({ embeds: [embed], components: [row], ephemeral: true, fetchReply: true });

  const collector = response.createMessageComponentCollector({
    filter: (interaction) => interaction.user.id === ctx.user.id,
    time: 60000
  });

  collector.on('collect', async (interaction) => {
    const val = interaction.values[0];
    if (val.startsWith('play_idx_')) {
      const parts = val.split('_');
      const idx = parseInt(parts[2]);
      const selectedSong = matches[idx];
      
      // Acknowledge interaction immediately, informing the user we are downloading & preparing the track
      await interaction.update({
        content: `⏳ **${selectedSong.title}** indiriliyor ve hazırlanıyor...`,
        embeds: [],
        components: []
      });

      const guildId = voiceChannel.guild.id;
      const tempFilePath = require('path').join(__dirname, `temp_${guildId}.mp3`);

      // Download the audio file to a local temp file
      let downloadSuccess = false;
      try {
        const { Readable } = require('stream');
        const fs = require('fs');

        const videoId = selectedSong.videoId || selectedSong.id || (selectedSong.url && selectedSong.url.split('v=')[1]?.split('&')[0]);
        if (!videoId) {
          throw new Error("Could not extract YouTube video ID");
        }

        let info = null;
        let stream = null;
        let attempts = 3;
        
        for (let i = 0; i < attempts; i++) {
          try {
            console.log(`[DOWNLOAD] Attempt ${i + 1} - Fetching audio for Video ID: ${videoId} using youtubei.js (client: TV)`);
            const yt = await getYTInstance();
            info = await yt.getInfo(videoId, { client: 'TV' });
            stream = await info.download({
              type: 'audio',
              quality: 'best'
            });
            break; // Succeeded!
          } catch (err) {
            console.error(`[DOWNLOAD] Attempt ${i + 1} failed:`, err.message || err);
            if (i === attempts - 1) throw err;
            await new Promise(r => setTimeout(r, 1000));
          }
        }

        const nodeStream = Readable.fromWeb(stream);
        const writeStream = fs.createWriteStream(tempFilePath);
        
        await new Promise((resolve, reject) => {
          nodeStream.pipe(writeStream);
          nodeStream.on('error', (err) => reject(err));
          writeStream.on('error', (err) => reject(err));
          writeStream.on('finish', () => resolve());
        });
        
        downloadSuccess = true;
        console.log(`[DOWNLOAD] Successfully saved to ${tempFilePath}`);
      } catch (err) {
        console.error("Audio download error:", err);
        try {
          await interaction.followUp({
            content: `❌ **${selectedSong.title}** indirilirken bir hata oluştu! Hata: ${err.message || err}`,
            ephemeral: true
          });
        } catch (e) {}
      }

      if (downloadSuccess) {
        // Play the downloaded local file in the voice channel
        try {
          const { joinVoiceChannel, createAudioPlayer, createAudioResource, entersState, VoiceConnectionStatus } = require('@discordjs/voice');

          const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
          });

          // Wait up to 15 seconds for the connection to be fully ready to avoid dropped packets and speaking indicator lag
          await entersState(connection, VoiceConnectionStatus.Ready, 15000);

          let player = players.get(guildId);
          if (!player) {
            player = createAudioPlayer();
            player.on('error', error => {
              console.error('[AudioPlayer Error]', error.message);
            });
            players.set(guildId, player);
          }
          connection.subscribe(player);

          // Load the local temp file as audio resource
          const resource = createAudioResource(tempFilePath);
          player.play(resource);

          const playEmbed = createPlayEmbed({
            title: selectedSong.title,
            artist: selectedSong.author.name,
            thumbnail: selectedSong.thumbnail || 'https://storage.googleapis.com/pr-newsroom-wp/1/2018/11/Spotify_Logo_RGB_Green.png'
          });
          
          // Send public play message to channel
          await ctx.channel.send({
            content: `🎶 **${selectedSong.title} - ${selectedSong.author.name}** oynatılıyor...`,
            embeds: [playEmbed]
          });

          // Update the ephemeral message to indicate selection complete and playing
          try {
            await interaction.editReply({
              content: `✅ **${selectedSong.title}** başarıyla ses kanalında çalınıyor!`,
              embeds: [],
              components: []
            });
          } catch (e) {}

        } catch (err) {
          console.error("Voice connection/playback error:", err);
          try {
            await interaction.followUp({
              content: `❌ Ses kanalına bağlanırken veya çalarken bir hata oluştu!`,
              ephemeral: true
            });
          } catch (e) {}
        }
      }

      collector.stop('selected');
    }
  });

  collector.on('end', async (collected, reason) => {
    if (reason !== 'selected') {
      try {
        await ctx.editReply({
          content: '⏱️ Şarkı seçme süresi doldu.',
          embeds: [],
          components: []
        });
      } catch (e) {}
    }
  });
}

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'play') {
      const query = interaction.options.getString('link-or-query');
      if (query) {
        await handlePlayCommandEphemeral(interaction, query);
      } else {
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
        const modal = new ModalBuilder()
          .setCustomId('play_search_modal')
          .setTitle('Spotify Şarkı Arama');

        const songInput = new TextInputBuilder()
          .setCustomId('song_query')
          .setLabel('Şarkı veya Sanatçı Adı')
          .setPlaceholder('Örn: Yalnızlık / Duman')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const firstActionRow = new ActionRowBuilder().addComponents(songInput);
        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
      }
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'play_search_btn') {
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
      const modal = new ModalBuilder()
        .setCustomId('play_search_modal')
        .setTitle('Spotify Şarkı Arama');

      const songInput = new TextInputBuilder()
        .setCustomId('song_query')
        .setLabel('Şarkı veya Sanatçı Adı')
        .setPlaceholder('Örn: Yalnızlık / Duman')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const firstActionRow = new ActionRowBuilder().addComponents(songInput);
      modal.addComponents(firstActionRow);

      await interaction.showModal(modal);
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'play_search_modal') {
      const query = interaction.fields.getTextInputValue('song_query');
      await handlePlayCommandEphemeral(interaction, query);
    }
  }

  // --- TempVoice Button Interactions ---
  if (interaction.isButton() && interaction.customId.startsWith('tempvoice_')) {
      const tempRooms = loadTempRooms();

      let voiceChannel = null;
      let roomData = null;
      let roomChannelId = null;

      for (const [chanId, data] of tempRooms.entries()) {
          if (data.messageId === interaction.message.id) {
              roomChannelId = chanId;
              roomData = data;
              break;
          }
      }

      // Fallback: If not found by messageId, look by ownerId
      if (!roomChannelId) {
          for (const [chanId, data] of tempRooms.entries()) {
              if (data.ownerId === interaction.user.id) {
                  roomChannelId = chanId;
                  roomData = data;
                  break;
              }
          }
      }

      if (!roomChannelId) {
          return interaction.reply({ content: "❌ Bu geçici oda artık aktif değil.", ephemeral: true });
      }

      voiceChannel = interaction.guild.channels.cache.get(roomChannelId);
      if (!voiceChannel) {
          return interaction.reply({ content: "❌ İlgili ses kanalı bulunamadı.", ephemeral: true });
      }

      const isOwner = roomData.ownerId === interaction.user.id;

      // --- CLAIM (herkes kullanabilir) ---
      if (interaction.customId === 'tempvoice_claim') {
          const ownerInChannel = voiceChannel.members.has(roomData.ownerId);
          if (ownerInChannel) {
              return interaction.reply({ content: "❌ Oda sahibi şu anda kanalda aktif durumda.", ephemeral: true });
          }
          const claimerInChannel = voiceChannel.members.has(interaction.user.id);
          if (!claimerInChannel) {
              return interaction.reply({ content: "❌ Odayı sahiplenmek için kanalın içinde bulunmalısınız.", ephemeral: true });
          }

          const oldOwnerId = roomData.ownerId;
          roomData.ownerId = interaction.user.id;
          tempRooms.set(roomChannelId, roomData);
          saveTempRooms(tempRooms);

          const textLogChannel = interaction.guild.channels.cache.get(roomData.textChannelId) || interaction.guild.channels.cache.find(c => c.name === 'komutlar' && c.type === 0);
          if (textLogChannel) {
              await textLogChannel.permissionOverwrites.delete(oldOwnerId).catch(() => null);
              await textLogChannel.permissionOverwrites.create(interaction.user.id, {
                  ViewChannel: true,
                  SendMessages: false
              }).catch(() => null);
          }

          await voiceChannel.permissionOverwrites.edit(interaction.user.id, {
              ManageChannels: true,
              MoveMembers: true,
              MuteMembers: true,
              DeafenMembers: true,
              Connect: true,
              ViewChannel: true
          });

          return interaction.reply({ content: `👑 Odanın yeni sahibi başarıyla <@${interaction.user.id}> olarak güncellendi!`, ephemeral: false });
      }

      // --- DM Davet Kabul Butonu (herkes kullanabilir) ---
      if (interaction.customId === 'tempvoice_join_invite') {
          // This is handled separately below
      }

      // Bundan sonraki butonlar sadece oda sahibi kullanabilir
      if (!isOwner) {
          return interaction.reply({ content: "❌ Bu işlemi sadece oda sahibi gerçekleştirebilir.", ephemeral: true });
      }

      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

      // --- İSİM DEĞİŞTİRME ---
      if (interaction.customId === 'tempvoice_name') {
          const modal = new ModalBuilder().setCustomId(`tempmodal_name:${roomChannelId}`).setTitle('🎙️ Oda İsmi Değiştir');
          const nameInput = new TextInputBuilder()
              .setCustomId('new_name')
              .setLabel('Yeni oda ismi girin')
              .setPlaceholder('Boş bırakırsan varsayılan isim kullanılır')
              .setValue(voiceChannel.name)
              .setStyle(TextInputStyle.Short)
              .setRequired(false);
          modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
          return interaction.showModal(modal);
      }

      // --- LİMİT DEĞİŞTİRME ---
      if (interaction.customId === 'tempvoice_limit') {
          const modal = new ModalBuilder().setCustomId(`tempmodal_limit:${roomChannelId}`).setTitle('👥 Oda Limiti Belirle');
          const limitInput = new TextInputBuilder()
              .setCustomId('new_limit')
              .setLabel('Maksimum kişi sayısı (0 = sınırsız)')
              .setPlaceholder('Boş bırakırsan limit kaldırılır')
              .setValue(voiceChannel.userLimit.toString())
              .setStyle(TextInputStyle.Short)
              .setRequired(false);
          modal.addComponents(new ActionRowBuilder().addComponents(limitInput));
          return interaction.showModal(modal);
      }

      // --- KİLİT TOGGLE ---
      if (interaction.customId === 'tempvoice_lock') {
          const isCurrentlyLocked = roomData.isLocked || false;
          if (isCurrentlyLocked) {
              // Kilidi aç
              await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, { Connect: null });
              roomData.isLocked = false;
              tempRooms.set(roomChannelId, roomData);
              saveTempRooms(tempRooms);
              return interaction.reply({ content: "🔓 Odanın kilidi **açıldı**. Artık herkes katılabilir.", ephemeral: true });
          } else {
              // Kilitle
              await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, { Connect: false });
              roomData.isLocked = true;
              tempRooms.set(roomChannelId, roomData);
              saveTempRooms(tempRooms);
              return interaction.reply({ content: "🔒 Oda **kilitlendi**. Sadece güvenilir kullanıcılar katılabilir.", ephemeral: true });
          }
      }

      // --- GİZLE TOGGLE ---
      if (interaction.customId === 'tempvoice_ghost') {
          const isCurrentlyHidden = roomData.isHidden || false;
          if (isCurrentlyHidden) {
              // Görünür yap
              await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, { ViewChannel: null });
              roomData.isHidden = false;
              tempRooms.set(roomChannelId, roomData);
              saveTempRooms(tempRooms);
              return interaction.reply({ content: "👁 Oda artık **görünür**. Herkes görebilir.", ephemeral: true });
          } else {
              // Gizle
              await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, { ViewChannel: false });
              roomData.isHidden = true;
              tempRooms.set(roomChannelId, roomData);
              saveTempRooms(tempRooms);
              return interaction.reply({ content: "👻 Oda artık **görünmez**. Sadece güvenilir kullanıcılar görebilir.", ephemeral: true });
          }
      }

      // --- GÜVENİLİR KULLANICI MENÜSÜ ---
      if (interaction.customId === 'tempvoice_permit_menu') {
          const { UserSelectMenuBuilder } = require('discord.js');
          const select = new UserSelectMenuBuilder()
              .setCustomId(`tempvoice_select_users:${roomChannelId}`)
              .setPlaceholder('Güvenilir kullanıcıları seç...')
              .setMinValues(1)
              .setMaxValues(25);

          const row = new ActionRowBuilder().addComponents(select);
          return interaction.reply({ content: '✅ **Güvenilir Kullanıcı Ekle** — Seçtiğin kullanıcılar oda kilitliyken/gizliyken bile girebilecek:', components: [row], ephemeral: true });
      }

      // --- ENGELLEME MENÜSÜ ---
      if (interaction.customId === 'tempvoice_block_menu') {
          const { UserSelectMenuBuilder } = require('discord.js');
          const select = new UserSelectMenuBuilder()
              .setCustomId(`tempvoice_select_block:${roomChannelId}`)
              .setPlaceholder('Engellenecek kullanıcıları seç...')
              .setMinValues(1)
              .setMaxValues(10);

          const row = new ActionRowBuilder().addComponents(select);
          return interaction.reply({ content: '❌ **Kullanıcı Engelle** — Seçtiğin kullanıcılar odana giremeyecek ve odanı göremeyecek:', components: [row], ephemeral: true });
      }

      // --- DAVET MENÜSÜ ---
      if (interaction.customId === 'tempvoice_invite') {
          const { UserSelectMenuBuilder } = require('discord.js');
          const select = new UserSelectMenuBuilder()
              .setCustomId(`tempvoice_select_invite:${roomChannelId}`)
              .setPlaceholder('Davet edilecek kullanıcıları seç...')
              .setMinValues(1)
              .setMaxValues(10);

          const row = new ActionRowBuilder().addComponents(select);
          return interaction.reply({ content: '📩 **Kullanıcı Davet Et** — Seçtiğin kullanıcılara DM ile davet gönderilecek:', components: [row], ephemeral: true });
      }

      // --- KICK MENÜSÜ ---
      if (interaction.customId === 'tempvoice_kick') {
          const membersInChannel = voiceChannel.members.filter(m => m.id !== roomData.ownerId && !m.user.bot);
          if (membersInChannel.size === 0) {
              return interaction.reply({ content: "❌ Odada atılacak kimse yok.", ephemeral: true });
          }

          const { StringSelectMenuBuilder } = require('discord.js');
          const select = new StringSelectMenuBuilder()
              .setCustomId(`tempvoice_select_kick:${roomChannelId}`)
              .setPlaceholder('Atılacak kullanıcıyı seç...')
              .addOptions(
                  membersInChannel.map(m => ({
                      label: m.user.username,
                      value: m.id,
                      description: `${m.displayName}`,
                      emoji: '🚫'
                  }))
              );

          const row = new ActionRowBuilder().addComponents(select);
          return interaction.reply({ content: '📞 **Sesten At** — Odadan atmak istediğin kullanıcıyı seç:', components: [row], ephemeral: true });
      }

      // --- BEKLEME ODASI ---
      if (interaction.customId === 'tempvoice_waitroom') {
          const isWaitroom = roomData.isWaitroom || false;
          if (isWaitroom) {
              roomData.isWaitroom = false;
              tempRooms.set(roomChannelId, roomData);
              saveTempRooms(tempRooms);
              return interaction.reply({ content: "⏳ Bekleme odası modu **kapatıldı**. Kullanıcılar direkt odaya katılabilir.", ephemeral: true });
          } else {
              roomData.isWaitroom = true;
              tempRooms.set(roomChannelId, roomData);
              saveTempRooms(tempRooms);
              return interaction.reply({ content: "⏳ Bekleme odası modu **açıldı**. Yeni katılan kullanıcılar sessize alınacak.", ephemeral: true });
          }
      }

      // --- SOHBET ODASI ---
      if (interaction.customId === 'tempvoice_chatroom') {
          let tempTextChannel = null;
          if (roomData.tempTextChannelId) {
              tempTextChannel = interaction.guild.channels.cache.get(roomData.tempTextChannelId);
          }

          if (tempTextChannel) {
              // Sohbet odası zaten var, sil
              await tempTextChannel.delete().catch(() => null);
              roomData.tempTextChannelId = null;
              tempRooms.set(roomChannelId, roomData);
              saveTempRooms(tempRooms);
              return interaction.reply({ content: "💬 Sohbet odası **silindi**.", ephemeral: true });
          } else {
              // Sohbet odası oluştur
              const category = voiceChannel.parent;
              tempTextChannel = await interaction.guild.channels.create({
                  name: `${interaction.user.username}-sohbet`,
                  type: 0,
                  parent: category ? category.id : null,
                  permissionOverwrites: [
                      {
                          id: interaction.guild.roles.everyone.id,
                          deny: [PermissionFlagsBits.ViewChannel]
                      },
                      {
                          id: interaction.user.id,
                          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels]
                      },
                      {
                          id: client.user.id,
                          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels]
                      }
                  ]
              });

              // Odadaki herkese görünür yap
              for (const [memberId] of voiceChannel.members) {
                  await tempTextChannel.permissionOverwrites.create(memberId, {
                      ViewChannel: true,
                      SendMessages: true
                  }).catch(() => null);
              }

              roomData.tempTextChannelId = tempTextChannel.id;
              tempRooms.set(roomChannelId, roomData);
              saveTempRooms(tempRooms);
              return interaction.reply({ content: `💬 Sohbet odası oluşturuldu: <#${tempTextChannel.id}>`, ephemeral: true });
          }
      }

      // --- GÜVENSİZ (Güvenilir Kaldır) ---
      if (interaction.customId === 'tempvoice_unpermit_menu') {
          // Güvenilir olan kullanıcıları bul
          const trustedUsers = [];
          for (const [overwriteId, overwrite] of voiceChannel.permissionOverwrites.cache.entries()) {
              if ((overwrite.type === 1 || overwrite.type === 'member') && overwriteId !== roomData.ownerId && overwriteId !== client.user.id) {
                  if (overwrite.allow.has(PermissionFlagsBits.Connect)) {
                      trustedUsers.push(overwriteId);
                  }
              }
          }

          if (trustedUsers.length === 0) {
              return interaction.reply({ content: "❌ Güvenilir kullanıcı listesi boş.", ephemeral: true });
          }

          const { StringSelectMenuBuilder } = require('discord.js');
          const select = new StringSelectMenuBuilder()
              .setCustomId(`tempvoice_select_unpermit:${roomChannelId}`)
              .setPlaceholder('Güvensiz yapılacak kullanıcıyı seç...')
              .addOptions(
                  trustedUsers.slice(0, 25).map(id => ({
                      label: interaction.guild.members.cache.get(id)?.user?.username || id,
                      value: id,
                      emoji: '👤'
                  }))
              );

          const row = new ActionRowBuilder().addComponents(select);
          return interaction.reply({ content: '👤 **Güvensiz Yap** — Güvenilir listesinden çıkarmak istediğin kullanıcıyı seç:', components: [row], ephemeral: true });
      }

      // --- BÖLGE ---
      if (interaction.customId === 'tempvoice_region') {
          const { StringSelectMenuBuilder } = require('discord.js');
          const select = new StringSelectMenuBuilder()
              .setCustomId(`tempvoice_select_region:${roomChannelId}`)
              .setPlaceholder('Ses bölgesini seç...')
              .addOptions([
                  { label: 'Otomatik', value: 'auto', emoji: '🌐', description: 'Discord otomatik seçsin' },
                  { label: 'Türkiye (İstanbul)', value: 'russia', emoji: '🇹🇷', description: 'En yakın bölge' },
                  { label: 'Avrupa', value: 'rotterdam', emoji: '🇪🇺', description: 'Rotterdam, Hollanda' },
                  { label: 'ABD Doğu', value: 'us-east', emoji: '🇺🇸', description: 'New York' },
                  { label: 'ABD Batı', value: 'us-west', emoji: '🇺🇸', description: 'Los Angeles' },
                  { label: 'Brezilya', value: 'brazil', emoji: '🇧🇷', description: 'São Paulo' },
                  { label: 'Singapur', value: 'singapore', emoji: '🇸🇬', description: 'Singapur' },
                  { label: 'Japonya', value: 'japan', emoji: '🇯🇵', description: 'Tokyo' }
              ]);

          const row = new ActionRowBuilder().addComponents(select);
          return interaction.reply({ content: '🌍 **Bölge Seç** — Ses kanalınızın bölgesini seçin:', components: [row], ephemeral: true });
      }

      // --- ENGELİ KALDIR ---
      if (interaction.customId === 'tempvoice_unblock_menu') {
          const blockedUsers = [];
          for (const [overwriteId, overwrite] of voiceChannel.permissionOverwrites.cache.entries()) {
              if ((overwrite.type === 1 || overwrite.type === 'member') && overwriteId !== roomData.ownerId && overwriteId !== client.user.id) {
                  if (overwrite.deny.has(PermissionFlagsBits.Connect)) {
                      blockedUsers.push(overwriteId);
                  }
              }
          }

          if (blockedUsers.length === 0) {
              return interaction.reply({ content: "❌ Engellenmiş kullanıcı yok.", ephemeral: true });
          }

          const { StringSelectMenuBuilder } = require('discord.js');
          const select = new StringSelectMenuBuilder()
              .setCustomId(`tempvoice_select_unblock:${roomChannelId}`)
              .setPlaceholder('Engeli kaldırılacak kullanıcıyı seç...')
              .addOptions(
                  blockedUsers.slice(0, 25).map(id => ({
                      label: interaction.guild.members.cache.get(id)?.user?.username || id,
                      value: id,
                      emoji: '✅'
                  }))
              );

          const row = new ActionRowBuilder().addComponents(select);
          return interaction.reply({ content: '✅ **Engeli Kaldır** — Engelini kaldırmak istediğin kullanıcıyı seç:', components: [row], ephemeral: true });
      }

      // --- ODAYI DEVRET ---
      if (interaction.customId === 'tempvoice_transfer') {
          const { UserSelectMenuBuilder } = require('discord.js');
          const select = new UserSelectMenuBuilder()
              .setCustomId(`tempvoice_select_transfer:${roomChannelId}`)
              .setPlaceholder('Yeni sahibi seç...')
              .setMinValues(1)
              .setMaxValues(1);

          const row = new ActionRowBuilder().addComponents(select);
          return interaction.reply({ content: '🔄 **Odayı Devret** — Odanın sahipliğini devretmek istediğin kullanıcıyı seç:', components: [row], ephemeral: true });
      }

      // --- SİL ---
      if (interaction.customId === 'tempvoice_delete') {
          // Odayı sil
          const textLogChannel = interaction.guild.channels.cache.get(roomData.textChannelId);
          if (textLogChannel) {
              const msg = await textLogChannel.messages.fetch(roomData.messageId).catch(() => null);
              if (msg) await msg.delete().catch(() => null);
              await textLogChannel.permissionOverwrites.delete(roomData.ownerId).catch(() => null);
          }
          if (roomData.tempTextChannelId) {
              const tempTextChan = interaction.guild.channels.cache.get(roomData.tempTextChannelId);
              if (tempTextChan) await tempTextChan.delete().catch(() => null);
          }
          await voiceChannel.delete().catch(() => null);
          tempRooms.delete(roomChannelId);
          saveTempRooms(tempRooms);
          return interaction.reply({ content: "🗑️ Odanız başarıyla **silindi**.", ephemeral: true });
      }
  }

  // --- TempVoice Modal Submissions ---
  if (interaction.isModalSubmit() && interaction.customId.startsWith('tempmodal_')) {
      const parts = interaction.customId.split(':');
      const action = parts[0];
      const roomChannelId = parts[1];

      const voiceChannel = interaction.guild.channels.cache.get(roomChannelId);
      if (!voiceChannel) {
          return interaction.reply({ content: "❌ İlgili ses kanalı bulunamadı.", ephemeral: true });
      }

      if (action === 'tempmodal_name') {
          let newName = interaction.fields.getTextInputValue('new_name');
          if (!newName || newName.trim() === '') {
              newName = `${interaction.user.username}'s Channel`;
          }
          await voiceChannel.setName(newName);
          return interaction.reply({ content: `✅ Oda ismi \`${newName}\` olarak güncellendi.`, ephemeral: true });
      }

      if (action === 'tempmodal_limit') {
          const newLimitVal = interaction.fields.getTextInputValue('new_limit');
          let limit = 0;
          if (newLimitVal && newLimitVal.trim() !== '') {
              limit = parseInt(newLimitVal);
              if (isNaN(limit) || limit < 0 || limit > 99) {
                  return interaction.reply({ content: "❌ Lütfen 0 ile 99 arasında geçerli bir sayı girin.", ephemeral: true });
              }
          }
          await voiceChannel.setUserLimit(limit);
          return interaction.reply({ content: `✅ Oda limiti \`${limit === 0 ? 'Sınırsız' : limit}\` olarak güncellendi.`, ephemeral: true });
      }
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith('trigger_create_role:')) {
      if (!isBotDeveloper(interaction.user.id)) {
        return interaction.reply({ content: "❌ Bu butonu sadece bot yapımcısı kullanabilir.", ephemeral: true });
      }

      const targetGuildId = interaction.customId.split(':')[1];
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
      const modal = new ModalBuilder()
        .setCustomId(`create_role_modal:${targetGuildId}`)
        .setTitle('Yeni Rol Oluştur');

      const nameInput = new TextInputBuilder()
        .setCustomId('role_name')
        .setLabel('Rol İsmi')
        .setPlaceholder('Örn: Yönetici, Kurucu, Mod')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const permsInput = new TextInputBuilder()
        .setCustomId('role_perms')
        .setLabel('Yetkiler (Virgülle ayırın)')
        .setPlaceholder('Örn: Yönetici, Rolleri Yönet, Ban, Kick, Yok')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(permsInput)
      );

      await interaction.showModal(modal);
    }
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId.startsWith('tempvoice_select_kick:')) {
        const roomChannelId = interaction.customId.split(':')[1];
        const tempRooms = loadTempRooms();
        const roomData = tempRooms.get(roomChannelId);
        if (!roomData) return interaction.reply({ content: "❌ Bu geçici oda artık aktif değil.", ephemeral: true });
        if (roomData.ownerId !== interaction.user.id) return interaction.reply({ content: "❌ Sadece oda sahibi kullanabilir.", ephemeral: true });

        const voiceChannel = interaction.guild.channels.cache.get(roomChannelId);
        if (!voiceChannel) return interaction.reply({ content: "❌ Ses kanalı bulunamadı.", ephemeral: true });

        const targetId = interaction.values[0];
        const targetMember = voiceChannel.members.get(targetId);
        if (targetMember) {
            await targetMember.voice.disconnect("TempVoice: Oda sahibi tarafından atıldı").catch(() => null);
            return interaction.reply({ content: `🚫 <@${targetId}> odadan **atıldı**.`, ephemeral: true });
        } else {
            return interaction.reply({ content: "❌ Kullanıcı artık kanalda değil.", ephemeral: true });
        }
    }

    // --- GÜVENSİZ YAP İŞLEMİ ---
    if (interaction.customId.startsWith('tempvoice_select_unpermit:')) {
        const roomChannelId = interaction.customId.split(':')[1];
        const tempRooms = loadTempRooms();
        const roomData = tempRooms.get(roomChannelId);
        if (!roomData) return interaction.reply({ content: "❌ Bu geçici oda artık aktif değil.", ephemeral: true });
        if (roomData.ownerId !== interaction.user.id) return interaction.reply({ content: "❌ Sadece oda sahibi kullanabilir.", ephemeral: true });

        const voiceChannel = interaction.guild.channels.cache.get(roomChannelId);
        if (!voiceChannel) return interaction.reply({ content: "❌ Ses kanalı bulunamadı.", ephemeral: true });

        const targetId = interaction.values[0];
        await voiceChannel.permissionOverwrites.delete(targetId).catch(() => null);
        return interaction.reply({ content: `👤 <@${targetId}> artık **güvenilir değil**.`, ephemeral: true });
    }

    // --- ENGELİ KALDIR İŞLEMİ ---
    if (interaction.customId.startsWith('tempvoice_select_unblock:')) {
        const roomChannelId = interaction.customId.split(':')[1];
        const tempRooms = loadTempRooms();
        const roomData = tempRooms.get(roomChannelId);
        if (!roomData) return interaction.reply({ content: "❌ Bu geçici oda artık aktif değil.", ephemeral: true });
        if (roomData.ownerId !== interaction.user.id) return interaction.reply({ content: "❌ Sadece oda sahibi kullanabilir.", ephemeral: true });

        const voiceChannel = interaction.guild.channels.cache.get(roomChannelId);
        if (!voiceChannel) return interaction.reply({ content: "❌ Ses kanalı bulunamadı.", ephemeral: true });

        const targetId = interaction.values[0];
        await voiceChannel.permissionOverwrites.delete(targetId).catch(() => null);
        return interaction.reply({ content: `✅ <@${targetId}> kullanıcısının **engeli kaldırıldı**.`, ephemeral: true });
    }

    // --- BÖLGE DEĞİŞTİRME İŞLEMİ ---
    if (interaction.customId.startsWith('tempvoice_select_region:')) {
        const roomChannelId = interaction.customId.split(':')[1];
        const tempRooms = loadTempRooms();
        const roomData = tempRooms.get(roomChannelId);
        if (!roomData) return interaction.reply({ content: "❌ Bu geçici oda artık aktif değil.", ephemeral: true });
        if (roomData.ownerId !== interaction.user.id) return interaction.reply({ content: "❌ Sadece oda sahibi kullanabilir.", ephemeral: true });

        const voiceChannel = interaction.guild.channels.cache.get(roomChannelId);
        if (!voiceChannel) return interaction.reply({ content: "❌ Ses kanalı bulunamadı.", ephemeral: true });

        const region = interaction.values[0];
        await voiceChannel.setRTCRegion(region === 'auto' ? null : region).catch(() => null);
        const regionName = interaction.component.options.find(o => o.value === region)?.label || region;
        return interaction.reply({ content: `🌍 Ses bölgesi **${regionName}** olarak değiştirildi.`, ephemeral: true });
    }

    if (interaction.customId.startsWith('select_delete_type:')) {
      if (!isBotDeveloper(interaction.user.id)) {
        return interaction.reply({ content: "❌ Bu işlemi sadece bot yapımcısı gerçekleştirebilir.", ephemeral: true });
      }

      const targetGuildId = interaction.customId.split(':')[1];
      const selectedType = interaction.values[0];
      
      await interaction.deferUpdate();

      try {
        const guild = client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null);
        if (!guild) {
          return interaction.followUp({ content: '❌ Belirtilen sunucu bulunamadı.', ephemeral: true });
        }

        const botMember = guild.members.me || await guild.members.fetch(client.user.id).catch(() => null);
        const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

        if (selectedType === 'role') {
          const roles = guild.roles.cache.filter(r => !r.managed && r.id !== guild.roles.everyone.id && r.position < botMember.roles.highest.position);
          if (roles.size === 0) {
            return interaction.followUp({ content: '❌ Silinebilecek uygun rol bulunamadı.', ephemeral: true });
          }

          const sortedRoles = [...roles.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 25);
          
          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`delete_action_role:${targetGuildId}`)
            .setPlaceholder('Silinecek rolleri seçin...')
            .setMinValues(1)
            .setMaxValues(Math.min(sortedRoles.length, 5))
            .addOptions(sortedRoles.map(role => ({
              label: role.name,
              value: role.id,
              description: `ID: ${role.id}`
            })));

          const row = new ActionRowBuilder().addComponents(selectMenu);
          await interaction.editReply({
            content: `🛡️ **${guild.name}** sunucusundan silmek istediğiniz rolleri seçin (Maks 5 adet):`,
            embeds: [],
            components: [row]
          });
        } 
        else if (selectedType === 'category') {
          const categories = guild.channels.cache.filter(c => c.type === 4);
          if (categories.size === 0) {
            return interaction.followUp({ content: '❌ Silinebilecek kategori bulunamadı.', ephemeral: true });
          }

          const sortedCategories = [...categories.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 25);

          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`delete_action_category:${targetGuildId}`)
            .setPlaceholder('Silinecek kategoriyi seçin...')
            .setMinValues(1)
            .setMaxValues(Math.min(sortedCategories.length, 5))
            .addOptions(sortedCategories.map(cat => ({
              label: cat.name,
              value: cat.id,
              description: `ID: ${cat.id}`
            })));

          const row = new ActionRowBuilder().addComponents(selectMenu);
          await interaction.editReply({
            content: `📁 **${guild.name}** sunucusundan silmek istediğiniz kategorileri seçin (Maks 5 adet):`,
            embeds: [],
            components: [row]
          });
        } 
        else if (selectedType === 'channel') {
          const channels = guild.channels.cache.filter(c => c.isTextBased() || c.type === 2);
          if (channels.size === 0) {
            return interaction.followUp({ content: '❌ Silinebilecek kanal bulunamadı.', ephemeral: true });
          }

          const sortedChannels = [...channels.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 25);

          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`delete_action_channel:${targetGuildId}`)
            .setPlaceholder('Silinecek kanalları seçin...')
            .setMinValues(1)
            .setMaxValues(Math.min(sortedChannels.length, 5))
            .addOptions(sortedChannels.map(chan => ({
              label: chan.name,
              value: chan.id,
              description: `${chan.isTextBased() ? '💬 Yazı Kanalı' : '🔊 Ses Kanalı'} | ID: ${chan.id}`
            })));

          const row = new ActionRowBuilder().addComponents(selectMenu);
          await interaction.editReply({
            content: `💬 **${guild.name}** sunucusundan silmek istediğiniz kanalları seçin (Maks 5 adet):`,
            embeds: [],
            components: [row]
          });
        }
      } catch (err) {
        console.error(err);
        return interaction.followUp({ content: `❌ İşlem yüklenirken hata oluştu: ${err.message}`, ephemeral: true });
      }
    }

    if (interaction.customId.startsWith('delete_action_role:')) {
      if (!isBotDeveloper(interaction.user.id)) {
        return interaction.reply({ content: "❌ Bu işlemi sadece bot yapımcısı gerçekleştirebilir.", ephemeral: true });
      }
      const targetGuildId = interaction.customId.split(':')[1];
      const selectedIds = interaction.values;
      await interaction.deferUpdate();

      try {
        const guild = client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null);
        if (!guild) {
          return interaction.followUp({ content: '❌ Belirtilen sunucu bulunamadı.', ephemeral: true });
        }

        const reason = `Geliştirici Komutu ile Silindi (İstek Sahibi: ${interaction.user.tag})`;
        const deletedNames = [];
        const failedNames = [];

        for (const roleId of selectedIds) {
          const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
          if (role) {
            try {
              const name = role.name;
              await role.delete(reason);
              deletedNames.push(name);
            } catch (err) {
              failedNames.push(`${role.name} (${err.message})`);
            }
          } else {
            failedNames.push(`${roleId} (Bulunamadı)`);
          }
        }

        let msg = '';
        if (deletedNames.length > 0) msg += `✅ Başarıyla silinen roller: **${deletedNames.join(', ')}**\n`;
        if (failedNames.length > 0) msg += `❌ Silinemeyen roller: ${failedNames.join(', ')}\n`;
        return interaction.editReply({ content: msg || '❌ Hiçbir rol silinemedi.', components: [] });
      } catch (err) {
        return interaction.followUp({ content: `❌ İşlem sırasında hata: ${err.message}`, ephemeral: true });
      }
    }

    if (interaction.customId.startsWith('delete_action_category:')) {
      if (!isBotDeveloper(interaction.user.id)) {
        return interaction.reply({ content: "❌ Bu işlemi sadece bot yapımcısı gerçekleştirebilir.", ephemeral: true });
      }
      const targetGuildId = interaction.customId.split(':')[1];
      const selectedIds = interaction.values;
      await interaction.deferUpdate();

      try {
        const guild = client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null);
        if (!guild) {
          return interaction.followUp({ content: '❌ Belirtilen sunucu bulunamadı.', ephemeral: true });
        }

        const reason = `Geliştirici Komutu ile Silindi (İstek Sahibi: ${interaction.user.tag})`;
        const deletedNames = [];
        const failedNames = [];

        for (const catId of selectedIds) {
          const cat = guild.channels.cache.get(catId) || await guild.channels.fetch(catId).catch(() => null);
          if (cat) {
            try {
              const name = cat.name;
              await cat.delete(reason);
              deletedNames.push(name);
            } catch (err) {
              failedNames.push(`${cat.name} (${err.message})`);
            }
          } else {
            failedNames.push(`${catId} (Bulunamadı)`);
          }
        }

        let msg = '';
        if (deletedNames.length > 0) msg += `✅ Başarıyla silinen kategoriler: **${deletedNames.join(', ')}**\n`;
        if (failedNames.length > 0) msg += `❌ Silinemeyen kategoriler: ${failedNames.join(', ')}\n`;
        return interaction.editReply({ content: msg || '❌ Hiçbir kategori silinemedi.', components: [] });
      } catch (err) {
        return interaction.followUp({ content: `❌ İşlem sırasında hata: ${err.message}`, ephemeral: true });
      }
    }

    if (interaction.customId.startsWith('delete_action_channel:')) {
      if (!isBotDeveloper(interaction.user.id)) {
        return interaction.reply({ content: "❌ Bu işlemi sadece bot yapımcısı gerçekleştirebilir.", ephemeral: true });
      }
      const targetGuildId = interaction.customId.split(':')[1];
      const selectedIds = interaction.values;
      await interaction.deferUpdate();

      try {
        const guild = client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null);
        if (!guild) {
          return interaction.followUp({ content: '❌ Belirtilen sunucu bulunamadı.', ephemeral: true });
        }

        const reason = `Geliştirici Komutu ile Silindi (İstek Sahibi: ${interaction.user.tag})`;
        const deletedNames = [];
        const failedNames = [];

        for (const chanId of selectedIds) {
          const channel = guild.channels.cache.get(chanId) || await guild.channels.fetch(chanId).catch(() => null);
          if (channel) {
            try {
              const name = channel.name;
              await channel.delete(reason);
              deletedNames.push(name);
            } catch (err) {
              failedNames.push(`${channel.name} (${err.message})`);
            }
          } else {
            failedNames.push(`${chanId} (Bulunamadı)`);
          }
        }

        let msg = '';
        if (deletedNames.length > 0) msg += `✅ Başarıyla silinen kanallar: **${deletedNames.join(', ')}**\n`;
        if (failedNames.length > 0) msg += `❌ Silinemeyen kanallar: ${failedNames.join(', ')}\n`;
        return interaction.editReply({ content: msg || '❌ Hiçbir kanal silinemedi.', components: [] });
      } catch (err) {
        return interaction.followUp({ content: `❌ İşlem sırasında hata: ${err.message}`, ephemeral: true });
      }
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('create_role_modal:')) {
      if (!isBotDeveloper(interaction.user.id)) {
        return interaction.reply({ content: "❌ Bu işlemi sadece bot yapımcısı tamamlayabilir.", ephemeral: true });
      }

      const targetGuildId = interaction.customId.split(':')[1];
      const roleName = interaction.fields.getTextInputValue('role_name');
      const rolePermsRaw = interaction.fields.getTextInputValue('role_perms') || '';

      await interaction.deferReply({ ephemeral: true });

      try {
        const guild = client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null);
        if (!guild) {
          return interaction.editReply({ content: '❌ Belirtilen sunucu bulunamadı.' });
        }

        let permFlags = 0n;
        const permsList = rolePermsRaw.split(',').map(p => p.trim().toLowerCase());

        for (const perm of permsList) {
          if (perm.includes('yönetici') || perm.includes('yonetici') || perm === 'admin' || perm === 'administrator') {
            permFlags |= PermissionFlagsBits.Administrator;
          }
          if (perm.includes('rol') || perm.includes('roles') || perm === 'manageroles') {
            permFlags |= PermissionFlagsBits.ManageRoles;
          }
          if (perm.includes('kanal') || perm.includes('channels') || perm === 'managechannels') {
            permFlags |= PermissionFlagsBits.ManageChannels;
          }
          if (perm.includes('mesaj') || perm.includes('messages') || perm === 'managemessages') {
            permFlags |= PermissionFlagsBits.ManageMessages;
          }
          if (perm === 'ban' || perm.includes('yasak') || perm === 'banmembers') {
            permFlags |= PermissionFlagsBits.BanMembers;
          }
          if (perm === 'kick' || perm.includes('at') || perm === 'kickmembers') {
            permFlags |= PermissionFlagsBits.KickMembers;
          }
        }

        const newRole = await guild.roles.create({
          name: roleName,
          permissions: permFlags,
          reason: `Geliştirici Komutu ile Oluşturuldu (İstek Sahibi: ${interaction.user.tag})`
        });

        return interaction.editReply({
          content: `✅ **${guild.name}** sunucusunda **${newRole.name}** rolü başarıyla oluşturuldu! (ID: \`${newRole.id}\`, Yetkiler: \`${rolePermsRaw || 'Varsayılan'}\`)`
        });
      } catch (err) {
        console.error(err);
        return interaction.editReply({ content: `❌ Rol oluşturulurken hata: ${err.message}` });
      }
    }
  }

  if (interaction.isUserSelectMenu()) {
    if (interaction.customId.startsWith('tempvoice_select_users:')) {
        const roomChannelId = interaction.customId.split(':')[1];
        const tempRooms = loadTempRooms();
        const roomData = tempRooms.get(roomChannelId);
        if (!roomData) return interaction.reply({ content: "❌ Bu geçici oda artık aktif değil.", ephemeral: true });
        if (roomData.ownerId !== interaction.user.id) return interaction.reply({ content: "❌ Sadece oda sahibi kullanabilir.", ephemeral: true });

        const voiceChannel = interaction.guild.channels.cache.get(roomChannelId);
        if (!voiceChannel) return interaction.reply({ content: "❌ Ses kanalı bulunamadı.", ephemeral: true });

        const selectedUsers = interaction.values;
        const mentioned = [];
        for (const userId of selectedUsers) {
            if (userId === roomData.ownerId) continue;
            await voiceChannel.permissionOverwrites.create(userId, {
                ViewChannel: true,
                Connect: true
            }).catch(() => null);
            mentioned.push(`<@${userId}>`);
        }

        if (mentioned.length > 0) {
            return interaction.reply({ content: `✅ Güvenilir kullanıcılar ayarlandı: ${mentioned.join(', ')}`, ephemeral: true });
        } else {
            return interaction.reply({ content: `✅ Güvenilir kullanıcılar listesi güncellendi.`, ephemeral: true });
        }
    }

    // --- ENGELLEME İŞLEMİ ---
    if (interaction.customId.startsWith('tempvoice_select_block:')) {
        const roomChannelId = interaction.customId.split(':')[1];
        const tempRooms = loadTempRooms();
        const roomData = tempRooms.get(roomChannelId);
        if (!roomData) return interaction.reply({ content: "❌ Bu geçici oda artık aktif değil.", ephemeral: true });
        if (roomData.ownerId !== interaction.user.id) return interaction.reply({ content: "❌ Sadece oda sahibi kullanabilir.", ephemeral: true });

        const voiceChannel = interaction.guild.channels.cache.get(roomChannelId);
        if (!voiceChannel) return interaction.reply({ content: "❌ Ses kanalı bulunamadı.", ephemeral: true });

        const selectedUsers = interaction.values;
        const blocked = [];
        for (const userId of selectedUsers) {
            if (userId === roomData.ownerId || userId === client.user.id) continue;
            // Engelle: kanala giremez + göremez
            await voiceChannel.permissionOverwrites.create(userId, {
                ViewChannel: false,
                Connect: false
            }).catch(() => null);

            // Eğer odadaysa at
            const memberInChannel = voiceChannel.members.get(userId);
            if (memberInChannel) {
                await memberInChannel.voice.disconnect("TempVoice: Oda sahibi tarafından engellendi").catch(() => null);
            }
            blocked.push(`<@${userId}>`);
        }

        if (blocked.length > 0) {
            return interaction.reply({ content: `❌ Engellenen kullanıcılar: ${blocked.join(', ')}\nBu kullanıcılar artık odanı **göremez** ve **giremez**.`, ephemeral: true });
        } else {
            return interaction.reply({ content: `❌ Hiçbir kullanıcı engellenemedi.`, ephemeral: true });
        }
    }

    // --- DAVET İŞLEMİ ---
    if (interaction.customId.startsWith('tempvoice_select_invite:')) {
        const roomChannelId = interaction.customId.split(':')[1];
        const tempRooms = loadTempRooms();
        const roomData = tempRooms.get(roomChannelId);
        if (!roomData) return interaction.reply({ content: "❌ Bu geçici oda artık aktif değil.", ephemeral: true });
        if (roomData.ownerId !== interaction.user.id) return interaction.reply({ content: "❌ Sadece oda sahibi kullanabilir.", ephemeral: true });

        const voiceChannel = interaction.guild.channels.cache.get(roomChannelId);
        if (!voiceChannel) return interaction.reply({ content: "❌ Ses kanalı bulunamadı.", ephemeral: true });

        const selectedUsers = interaction.values;
        const invited = [];
        const failed = [];

        for (const userId of selectedUsers) {
            if (userId === roomData.ownerId) continue;
            try {
                const targetUser = await client.users.fetch(userId);
                const inviteEmbed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setAuthor({ name: 'TempVoice Davet', iconURL: client.user.displayAvatarURL() })
                    .setTitle('📩 Ses Odasına Davet Edildiniz!')
                    .setDescription(
                        `**${interaction.user.username}** sizi **${interaction.guild.name}** sunucusundaki ses odasına davet etti!\n\n` +
                        `🎙️ **Oda:** ${voiceChannel.name}\n` +
                        `👥 **Kişi Sayısı:** ${voiceChannel.members.size}`
                    )
                    .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL({ dynamic: true }) })
                    .setTimestamp();

                // Güvenilir olarak ekle
                await voiceChannel.permissionOverwrites.create(userId, {
                    ViewChannel: true,
                    Connect: true
                }).catch(() => null);

                await targetUser.send({ embeds: [inviteEmbed] }).catch(() => null);
                invited.push(`<@${userId}>`);
            } catch (err) {
                failed.push(`<@${userId}>`);
            }
        }

        let msg = '';
        if (invited.length > 0) msg += `📩 Davet gönderildi: ${invited.join(', ')}\n`;
        if (failed.length > 0) msg += `❌ Davet gönderilemedi (DM kapalı): ${failed.join(', ')}`;
        return interaction.reply({ content: msg || "❌ Kimseye davet gönderilemedi.", ephemeral: true });
    }

    // --- ODAYI DEVRET İŞLEMİ ---
    if (interaction.customId.startsWith('tempvoice_select_transfer:')) {
        const roomChannelId = interaction.customId.split(':')[1];
        const tempRooms = loadTempRooms();
        const roomData = tempRooms.get(roomChannelId);
        if (!roomData) return interaction.reply({ content: "❌ Bu geçici oda artık aktif değil.", ephemeral: true });
        if (roomData.ownerId !== interaction.user.id) return interaction.reply({ content: "❌ Sadece oda sahibi kullanabilir.", ephemeral: true });

        const voiceChannel = interaction.guild.channels.cache.get(roomChannelId);
        if (!voiceChannel) return interaction.reply({ content: "❌ Ses kanalı bulunamadı.", ephemeral: true });

        const newOwnerId = interaction.values[0];
        if (newOwnerId === roomData.ownerId) {
            return interaction.reply({ content: "❌ Zaten odanın sahibisiniz.", ephemeral: true });
        }

        const oldOwnerId = roomData.ownerId;
        roomData.ownerId = newOwnerId;
        tempRooms.set(roomChannelId, roomData);
        saveTempRooms(tempRooms);

        // Yeni sahibe yetki ver
        await voiceChannel.permissionOverwrites.edit(newOwnerId, {
            ManageChannels: true,
            MoveMembers: true,
            MuteMembers: true,
            DeafenMembers: true,
            Connect: true,
            ViewChannel: true
        }).catch(() => null);

        // Komutlar kanalı izinlerini güncelle
        const textLogChannel = interaction.guild.channels.cache.get(roomData.textChannelId);
        if (textLogChannel) {
            await textLogChannel.permissionOverwrites.delete(oldOwnerId).catch(() => null);
            await textLogChannel.permissionOverwrites.create(newOwnerId, {
                ViewChannel: true,
                SendMessages: false
            }).catch(() => null);
        }

        return interaction.reply({ content: `🔄 Oda sahipliği <@${newOwnerId}> kullanıcısına **devredildi**!`, ephemeral: false });
    }
  }

  if (interaction.isRoleSelectMenu()) {
    if (interaction.customId === 'kayit_setup_male_role') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && !isBotDeveloper(interaction.user.id)) {
        return interaction.reply({ content: "❌ Bu işlemi sadece yöneticiler gerçekleştirebilir.", ephemeral: true });
      }

      const maleRoleId = interaction.values[0];
      const { ActionRowBuilder, RoleSelectMenuBuilder } = require('discord.js');

      const row = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId(`kayit_setup_female_role:${maleRoleId}`)
          .setPlaceholder('Kız Kayıt Rolünü Seçin')
      );

      await interaction.update({
        content: `🛠️ **Kayıt Sistemi Kurulumu - Adım 2/3**\nSeçilen Erkek Rolü: <@&${maleRoleId}>\n\nLütfen sunucuda kullanılacak **Kız Kayıt Rolünü** aşağıdaki menüden seçin:`,
        components: [row]
      });
    }

    if (interaction.customId.startsWith('kayit_setup_female_role:')) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && !isBotDeveloper(interaction.user.id)) {
        return interaction.reply({ content: "❌ Bu işlemi sadece yöneticiler gerçekleştirebilir.", ephemeral: true });
      }

      const maleRoleId = interaction.customId.split(':')[1];
      const femaleRoleId = interaction.values[0];
      const { ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType } = require('discord.js');

      const row = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(`kayit_setup_channel:${maleRoleId}:${femaleRoleId}`)
          .setPlaceholder('Kayıt Kanalını Seçin')
          .setChannelTypes([ChannelType.GuildText])
      );

      await interaction.update({
        content: `🛠️ **Kayıt Sistemi Kurulumu - Adım 3/3**\nSeçilen Erkek Rolü: <@&${maleRoleId}>\nSeçilen Kız Rolü: <@&${femaleRoleId}>\n\nLütfen kayıt komutlarının (\`.e\`, \`.k\`) kullanılacağı **Kayıt Kanalını** aşağıdaki menüden seçin:`,
        components: [row]
      });
    }
  }

  if (interaction.isChannelSelectMenu()) {
    if (interaction.customId.startsWith('kayit_setup_channel:')) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && !isBotDeveloper(interaction.user.id)) {
        return interaction.reply({ content: "❌ Bu işlemi sadece yöneticiler gerçekleştirebilir.", ephemeral: true });
      }

      const parts = interaction.customId.split(':');
      const maleRoleId = parts[1];
      const femaleRoleId = parts[2];
      const channelId = interaction.values[0];

      kayitAyarlari[interaction.guildId] = {
        erkekRolId: maleRoleId,
        kizRolId: femaleRoleId,
        kanalId: channelId
      };
      saveKayitAyarlari();
      exportServerData();

      await interaction.update({
        content: `✅ **Kayıt Sistemi Başarıyla Kuruldu!**\n\n**Ayarlar:**\n* 👨 **Erkek Rolü:** <@&${maleRoleId}>\n* 👩 **Kız Rolü:** <@&${femaleRoleId}>\n* 💬 **Kayıt Kanalı:** <#${channelId}>\n\nArtık yetkililer sadece bu kanalda \`.e\` ve \`.k\` komutlarını kullanarak kayıt yapabilirler.`,
        components: []
      });
    }
  }
});

client.on('messageCreate', async (message) => {
  console.log(`[Mesaj Alindi] Gonderen: ${message.author.tag} | Icerik: '${message.content}'`);
  if (message.author.bot) return;

  // Handle DM messages for developer and normal users
  if (!message.guild) {
    if (!isBotDeveloper(message.author.id)) return;
    if (!message.content.startsWith(config.prefix)) return;

    const dmArgs = message.content.slice(config.prefix.length).trim().split(/ +/);
    const dmCmd = dmArgs[0]?.toLowerCase();

    const whitelist = [
      'yaz',
      'özel', 'ozel',
      'rolver',
      'rolal',
      'ban',
      'unban',
      'mute',
      'unmute',
      'üst', 'ust',
      'koru',
      'korumayıkapat', 'korumayikapat', 'koruac',
      'guvenlik', 'guvenlikkapat', 'guvenlikac', 'güvenlikprotokolükapat', 'guvenlikprotokolukapat', 'güvenlikprotokolüaç', 'guvenlikprotokoluac',
      'güvenlikprotokolü', 'guvenlikprotokolu',
      'adminver',
      'roller',
      'oluştur', 'olustur',
      'del',
      'limit',
      'owner'
    ];
    if (!whitelist.includes(dmCmd)) {
      return message.author.send('❌ Bu komut DM üzerinden kullanılamaz. Sadece geliştirici özel komutları kullanılabilir.').catch(() => null);
    }

    // Resolve the target guild from command arguments (scan for any 17-20 digit number in client.guilds.cache)
    let targetGuild = null;
    for (const arg of dmArgs.slice(1)) {
      const cleaned = arg.replace(/[^0-9]/g, '');
      if (cleaned && client.guilds.cache.has(cleaned)) {
        targetGuild = client.guilds.cache.get(cleaned);
        break;
      }
    }

    const noGuildRequired = ['özel', 'ozel', 'yaz'];
    if (!targetGuild && !noGuildRequired.includes(dmCmd)) {
      return message.author.send(`❌ DM üzerinden **.${dmCmd}** komutunu kullanabilmek için lütfen geçerli bir sunucu ID'si belirtin. Örnek: \`.roller <sunucu_id>\``).catch(() => null);
    }

    // Fetch member in targetGuild if targetGuild is resolved
    let dmMember = null;
    if (targetGuild) {
      try {
        dmMember = targetGuild.members.cache.get(message.author.id)
          || await targetGuild.members.fetch(message.author.id).catch(() => null);
      } catch (_) {}

      const isDev = isBotDeveloper(message.author.id);
      if (!dmMember && !isDev) {
        return message.author.send(`❌ Belirtilen sunucuda (\`${targetGuild.name}\`) üye değilsiniz!`).catch(() => null);
      }
    }

    // Enrich message for DM command execution
    message.isDM = true;
    if (targetGuild) {
      message.guild = targetGuild;
      message.member = dmMember;
    }
    
    // Override message.channel
    message.channel = Object.assign(Object.create(Object.getPrototypeOf(message.channel)), message.channel, {
      name: 'DM',
      id: message.channel.id,
      send: async (content) => {
        try {
          return await message.author.send(content);
        } catch (_) {}
      }
    });

    // Override message.reply
    message.reply = async (content) => {
      try {
        return await message.author.send(content);
      } catch (_) {}
    };

    // Override message.delete
    message.delete = async () => {
      return message;
    };

    // Developer bypass if member is missing
    const isDev = isBotDeveloper(message.author.id);
    if (isDev && targetGuild && !message.member) {
      const mockMember = {
        roles: { cache: new Map() },
        id: message.author.id,
        user: message.author,
        guild: targetGuild,
        timeout: async () => {},
        kick: async () => {},
        ban: async () => {},
      };
      Object.defineProperty(mockMember, 'permissions', {
        value: { has: () => true },
        writable: true,
        configurable: true
      });
      message.member = mockMember;
    }
  }

  updateAktiviteStreak(message.author.id);

  // Autoresponder trigger check
  const msgLower = message.content.toLowerCase().trim();
  const arRule = autoresponders.find(rule => rule.trigger.toLowerCase() === msgLower);
  if (arRule) {
    await message.reply(arRule.response);
    return;
  }

  // Saved Embeds trigger check
  const matchingEmbed = savedEmbeds.find(emb => 
    message.guild && 
    emb.guildId === message.guild.id && 
    emb.title && 
    emb.title.toLowerCase().trim() === msgLower
  );
  if (matchingEmbed) {
    if (!matchingEmbed.channelId || matchingEmbed.channelId === 'all' || matchingEmbed.channelId === message.channel.id) {
      const embed = new EmbedBuilder()
        .setColor(matchingEmbed.color || '#ffffff');
      
      if (matchingEmbed.author && matchingEmbed.author !== 'Üst bilgi' && matchingEmbed.author.trim() !== '') {
        embed.setAuthor({ name: matchingEmbed.author });
      }
      if (matchingEmbed.title && matchingEmbed.title !== 'Başlık' && matchingEmbed.title.trim() !== '') {
        embed.setTitle(matchingEmbed.title);
      }
      if (matchingEmbed.description && matchingEmbed.description !== 'Açıklama...' && matchingEmbed.description.trim() !== '') {
        embed.setDescription(matchingEmbed.description);
      }
      if (matchingEmbed.thumbnail && matchingEmbed.thumbnail.trim() !== '') {
        embed.setThumbnail(matchingEmbed.thumbnail);
      }
      if (matchingEmbed.image && matchingEmbed.image.trim() !== '') {
        embed.setImage(matchingEmbed.image);
      }
      if (matchingEmbed.footer && matchingEmbed.footer !== 'Alt bilgi' && matchingEmbed.footer.trim() !== '') {
        embed.setFooter({ text: matchingEmbed.footer });
      }

      await message.reply({ embeds: [embed] });
      return;
    }
  }

  // Redesigned Automod System
  const isExemptByPermission = message.member && (
    message.member.permissions.has(PermissionFlagsBits.Administrator) ||
    message.member.permissions.has(PermissionFlagsBits.ManageMessages)
  );

  if (message.member && !isExemptByPermission && !message.isDM) {
    const guildAutomod = getGuildAutomodConfig(message.guild?.id);

    // 1. Reklam Filtresi
    if (guildAutomod.reklam && guildAutomod.reklam.enabled) {
      const isExempt = guildAutomod.reklam.exemptChannels.includes(message.channel.id) ||
                       message.member.roles.cache.some(role => guildAutomod.reklam.exemptRoles.includes(role.id));
      
      if (!isExempt) {
        const invitePattern = /(discord\.gg|discord\.com\/invite)\/[a-zA-Z0-9\-]+/i;
        if (invitePattern.test(message.content)) {
          try {
            await message.delete();
            const action = guildAutomod.reklam.action || 'delete';
            
            if (action === 'warn') {
              const warn = await message.channel.send(`⚠️ <@${message.author.id}>, bu sunucuda reklam davet linkleri paylaşmak yasaktır!`);
              setTimeout(() => warn.delete().catch(console.error), 5000);
            } else if (action === 'mute') {
              try {
                await message.member.timeout(10 * 60 * 1000, 'Automod: Reklam Paylaşımı');
                const warn = await message.channel.send(`🔇 <@${message.author.id}> reklam paylaştığı için 10 dakika susturuldu.`);
                setTimeout(() => warn.delete().catch(console.error), 8000);
              } catch (timeoutErr) {
                console.error("Failed to timeout user:", timeoutErr);
                const warn = await message.channel.send(`⚠️ <@${message.author.id}>, reklam paylaşmak yasaktır!`);
                setTimeout(() => warn.delete().catch(console.error), 5000);
              }
            } else {
              // Just delete, no warning
            }
            logEvent("INFO", "Automod", `Deleted invite link from ${message.author.tag} in #${message.channel.name} (Action: ${action})`);
            return;
          } catch (err) {
            console.error(err);
          }
        }
      }
    }

    // 2. Küfür Filtresi
    if (guildAutomod.kufur && guildAutomod.kufur.enabled) {
      const isExempt = guildAutomod.kufur.exemptChannels.includes(message.channel.id) ||
                       message.member.roles.cache.some(role => guildAutomod.kufur.exemptRoles.includes(role.id));
      
      if (!isExempt) {
        const contentLower = message.content.toLowerCase();
        const hasSwear = swearWords.some(word => {
          if (word.length <= 3) {
            const regex = new RegExp(`\\b${word}\\b`, 'i');
            return regex.test(contentLower);
          }
          return contentLower.includes(word);
        });

        if (hasSwear) {
          try {
            await message.delete();
            const warn = await message.channel.send(`⚠️ <@${message.author.id}>, lütfen kelimelerinize dikkat edin! Küfür/hakaret yasaktır.`);
            setTimeout(() => warn.delete().catch(console.error), 5000);
            logEvent("INFO", "Automod", `Deleted message containing swear word from ${message.author.tag} in #${message.channel.name}`);
            return;
          } catch (err) {
            console.error(err);
          }
        }
      }
    }

    // 3. Link Filtresi
    if (guildAutomod.link && guildAutomod.link.enabled) {
      const isExempt = guildAutomod.link.exemptChannels.includes(message.channel.id) ||
                       message.member.roles.cache.some(role => guildAutomod.link.exemptRoles.includes(role.id));
      
      if (!isExempt) {
        if (urlPattern.test(message.content)) {
          try {
            await message.delete();
            const warn = await message.channel.send(`⚠️ <@${message.author.id}>, bu kanalda harici link paylaşılması yasaktır!`);
            setTimeout(() => warn.delete().catch(console.error), 5000);
            logEvent("INFO", "Automod", `Deleted link from ${message.author.tag} in #${message.channel.name}`);
            return;
          } catch (err) {
            console.error(err);
          }
        }
      }
    }
  }

  const channelId = message.channel.id;
  if (activeGames.has(channelId) && !message.content.startsWith(config.prefix)) {
    const guess = message.content.toLowerCase().trim();
    if (guess.length === 1 && /[a-zçğışöü]/i.test(guess)) {
      const game = activeGames.get(channelId);
      const word = game.word;

      if (game.guessed.includes(guess)) {
        return message.reply(`⚠️ \`${guess.toUpperCase()}\` harfini zaten tahmin etmiştiniz.`);
      }

      game.guessed.push(guess);

      if (word.includes(guess)) {
        await message.react('✅');
      } else {
        game.attempts -= 1;
        await message.react('❌');
      }

      let displayList = [];
      let won = true;
      for (const char of word) {
        if (game.guessed.includes(char)) {
          displayList.push(char.toUpperCase());
        } else {
          displayList.push('_');
          won = false;
        }
      }

      const display = displayList.join(' ');
      const stageIndex = 6 - game.attempts;

      if (won) {
        message.channel.send(`🎉 **Tebrikler!** Kelimeyi doğru tahmin ettiniz: **${word.toUpperCase()}**\nOyunu kazandınız! 🏆`);
        activeGames.delete(channelId);
        return;
      } else if (game.attempts <= 0) {
        message.channel.send(HANGMAN_STAGES[6] + `\n💀 **Oyun Bitti!** Adam asıldı. Doğru kelime: **${word.toUpperCase()}** idi.`);
        activeGames.delete(channelId);
        return;
      } else {
        return message.channel.send(`Kelime: \`${display}\`\nKalan Hak: \`${game.attempts}\`\n` + HANGMAN_STAGES[stageIndex]);
      }
    } else if (guess.length > 1 && /^[a-zçğışöü]+$/i.test(guess)) {
      const game = activeGames.get(channelId);
      const word = game.word;

      if (guess === word) {
        message.channel.send(`🎉 **Tebrikler!** Kelimeyi doğru tahmin ettiniz: **${word.toUpperCase()}**\nOyunu kazandınız! 🏆`);
        activeGames.delete(channelId);
        return;
      } else {
        game.attempts -= 1;
        await message.react('❌');
        const stageIndex = 6 - game.attempts;

        if (game.attempts <= 0) {
          message.channel.send(HANGMAN_STAGES[6] + `\n💀 **Oyun Bitti!** Adam asıldı. Doğru kelime: **${word.toUpperCase()}** idi.`);
          activeGames.delete(channelId);
          return;
        } else {
          return message.reply(`❌ Yanlış kelime tahmini! Kalan Hak: \`${game.attempts}\`\n` + HANGMAN_STAGES[stageIndex]);
        }
      }
    }
  }


  // ----------------------------------------------------
  // CLEAN REGISTRY-BASED COMMAND HANDLER
  // ----------------------------------------------------
  const { 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    RoleSelectMenuBuilder, 
    ChannelSelectMenuBuilder, 
    ComponentType 
  } = require('discord.js');

  
const commands = new Map();

function defineCommand(aliases, category, execute) {
  const names = Array.isArray(aliases) ? aliases : [aliases];
  names.forEach(name => {
    commands.set(name.toLowerCase(), { category, execute });
  });
}

// ----------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------
function requireGuild(message) {
  if (!message.guild) {
    message.reply('❌ Bu komut yalnızca sunucu içinde kullanılabilir.');
    return false;
  }
  return true;
}

// ----------------------------------------------------
// MODERATION COMMANDS
// ----------------------------------------------------
// ----------------------------------------------------
// CHANNEL LOCK & UTILITY COMMANDS
// ----------------------------------------------------
// ----------------------------------------------------
// REGISTRATION COMMANDS
// ----------------------------------------------------
// ----------------------------------------------------
// UTILITY & MUSIC & FUN COMMANDS
// ----------------------------------------------------
defineCommand(['spo'], 'info', async (message, args, isDev) => {
  let member = message.member;
  if (args[0]) {
    const userId = resolveUserId(args[0]);
    if (userId) {
      member = await message.guild.members.fetch(userId).catch(() => null);
    }
  }
  if (!member) return message.reply('⚠️ Kullanıcı bulunamadı.');

  if (!member.presence || !member.presence.activities) {
    return message.reply(`❌ ${member.displayName} çevrimdışı veya durum bilgisi alınamıyor (Presence Intent açık olmalı).`);
  }

  const spotify = member.presence.activities.find(act => act.name === 'Spotify' && act.type === 2);
  if (!spotify) {
    return message.reply(`❌ ${member.displayName} şu anda Spotify'da şarkı dinlemiyor.`);
  }

  const trackName = spotify.details;
  const artists = spotify.state ? spotify.state.replace(/;/g, ', ') : 'Bilinmiyor';
  const album = spotify.assets ? spotify.assets.largeText : 'Bilinmiyor';

  let coverUrl = '';
  if (spotify.assets && spotify.assets.largeImage) {
    if (spotify.assets.largeImage.startsWith('spotify:')) {
      coverUrl = `https://i.scdn.co/image/${spotify.assets.largeImage.replace('spotify:', '')}`;
    } else {
      coverUrl = spotify.assets.largeImageURL();
    }
  }

  let duration = 0;
  let elapsed = 0;
  let progress = 0;
  if (spotify.timestamps && spotify.timestamps.start && spotify.timestamps.end) {
    duration = spotify.timestamps.end - spotify.timestamps.start;
    elapsed = Math.min(Date.now() - spotify.timestamps.start, duration);
    progress = duration > 0 ? elapsed / duration : 0;
  }

  const totalBars = 22;
  const progressIndex = Math.min(Math.floor(progress * totalBars), totalBars);
  const progressBar = '▬'.repeat(progressIndex) + '⚪' + '▬'.repeat(Math.max(0, totalBars - progressIndex - 1));

  const embed = new EmbedBuilder()
    .setColor('#1db954')
    .setTitle(trackName)
    .setDescription(`${artists}\n${album}\n\n${progressBar}\n\`${formatMsTime(elapsed)}\`${' '.repeat(30)}\`${formatMsTime(duration)}\``);

  if (coverUrl) embed.setThumbnail(coverUrl);

  return message.reply({ embeds: [embed] });
});

// ----------------------------------------------------
// DEVELOPER & CONFIG COMMANDS
// ----------------------------------------------------
// ----------------------------------------------------
// COIN & GAMES & ZOO SYSTEM
// ----------------------------------------------------
// ----------------------------------------------------
// ROLEPLAY ACTION COMMANDS
// ----------------------------------------------------
const actionsConfig = {
  'kiss': { text: 'kullanıcısını öptü! 💋', self: 'Chu... Yalnızlık seviyesi: 999. Kendini öpüyorsun! 🥺' },
  'hug': { text: 'kullanıcısına sarıldı! 🤗', self: 'Kendine sarıldın... Üzülme, ben sana sarılırım! 🤗' },
  'pat': { text: 'kullanıcısının kafasını okşadı! 🐱', self: 'Kendi kafanı okşadın. Aferin bana! 😊' },
  'slap': { text: 'kullanıcısına tokat attı! 💥', self: 'Kendine tokat attın! Bu acıttı... Neden yaptın? 😭' },
  'kill': { text: 'kullanıcısını öldürdü! 💀', self: 'Kendini imha ettin! Hoşçakal acımasız dünya... ☠️' }
};

Object.entries(actionsConfig).forEach(([cmdName, cfg]) => {
});

// ----------------------------------------------------
// ANTI-NUKE & SECURITY SYSTEM
// ----------------------------------------------------
defineCommand(['guvenlikkapat', 'güvenlikprotokolükapat', 'guvenlikprotokolukapat', 'güvenlikprotokolüaç', 'guvenlikprotokoluac'], 'security', async (message, args, isDev) => {
  if (!requireGuild(message)) return;
  const isOwner = message.author.id === message.guild.ownerId;
  if (!isOwner && !isDev) return message.reply('❌ Bu komutu sadece sunucu sahibi veya bot yapımcısı kullanabilir!');

  await message.channel.send('🔓 **Güvenlik Modu Kapatılıyor...** Yetkiler ve kanallar geri yükleniyor...');

  try {
    const guild = message.guild;
    const backup = loadGuvenlikDurum();
    const guildBackup = backup[guild.id];

    if (!guildBackup) return message.reply('❌ Kayıtlı güvenlik karantinası bulunamadı.');

    const roles = await guild.roles.fetch();
    const rolesToRestore = guildBackup.roles || {};
    const channelsToRestore = guildBackup.channels || {};

    for (const roleId in rolesToRestore) {
      const role = roles.get(roleId);
      if (role) {
        try {
          const val = rolesToRestore[roleId];
          const restoredPerms = (val === true || val === 'true') ? role.permissions.add(PermissionFlagsBits.Administrator) : new PermissionsBitField(BigInt(val));
          await role.edit({ permissions: restoredPerms }, 'Güvenlik Protokolü Geri Yükleme');
        } catch (err) {
          console.error(err);
        }
      }
    }

    const xRole = guild.roles.cache.find(r => r.name === 'x');
    if (xRole) await xRole.delete('Karantina devredışı').catch(() => {});

    for (const [channelId, overwrites] of Object.entries(channelsToRestore)) {
      const channel = guild.channels.cache.get(channelId);
      if (!channel) continue;
      try {
        if (Array.isArray(overwrites)) {
          await channel.permissionOverwrites.set(overwrites.map(o => ({
            id: o.id,
            type: o.type,
            allow: new PermissionsBitField(BigInt(o.allow)),
            deny: new PermissionsBitField(BigInt(o.deny))
          })));
        }
      } catch (err) {
        console.error(err);
      }
    }

    delete backup[guild.id];
    saveGuvenlikDurum(backup);
    return message.channel.send('✅ **Başarılı!** Sunucu tamamen orijinal yetki ve kanallarına geri yüklendi.');
  } catch (e) {
    console.error(e);
    return message.reply('❌ Geri yükleme sırasında hata oluştu.');
  }
});

  if (!message.content.startsWith(config.prefix)) return;

  const args = message.content.slice(config.prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  logEvent('INFO', 'Command', `User: ${message.author.tag} (ID: ${message.author.id}) invoked command: .${commandName} in channel: #${message.channel.name} (ID: ${message.channel.id})`);

  const cmd = commands.get(commandName);
  if (!cmd) return;

  // Developer Bypass
  const isDev = isBotDeveloper(message.author.id);
  if (isDev && message.member) {
    Object.defineProperty(message.member, 'permissions', {
      value: { has: () => true },
      writable: true,
      configurable: true
    });
  }

  // Pre-execute checks (guild, permissions, owner limits, developer limits, etc.)
  const ownerCommands = [
    'koru', 'koruac', 'korumayikapat', 'korumayıkapat', 
    'guvenlik', 'guvenlikkapat', 'guvenlikac', 
    'güvenlikprotokolü', 'guvenlikprotokolu',
    'güvenlikprotokolükapat', 'guvenlikprotokolukapat', 
    'güvenlikprotokolüaç', 'guvenlikprotokoluac', 
    'limit', 'owner'
  ];
  const devCommands = [
    'yaz', 'özel', 'ozel', 'adminver', 'roller', 
    'oluştur', 'olustur', 'del', 'üst', 'ust'
  ];

  if (ownerCommands.includes(commandName)) {
    if (message.author.id !== message.guild?.ownerId && !isDev) {
      logEvent('WARNING', 'Command', `User: ${message.author.tag} (ID: ${message.author.id}) lack owner permission for command: .${commandName}`);
      return message.reply('❌ Bu komutu sadece sunucu sahibi (taç sahibi) veya bot yapımcısı kullanabilir!');
    }
  }

  if (devCommands.includes(commandName)) {
    if (!isDev) {
      logEvent('WARNING', 'Command', `User: ${message.author.tag} (ID: ${message.author.id}) lack dev permission for command: .${commandName}`);
      return message.reply('❌ Bu komut sadece bot yapımcısına özeldir.');
    }
  }

  try {
    await cmd.execute(message, args, isDev);
  } catch (error) {
    console.error(`Error executing command .${commandName}:`, error);
    logEvent('ERROR', 'Command', `Error executing command .${commandName}: ${error.message}`);
    return message.reply('❌ Komut çalıştırılırken bir hata oluştu.');
  }
});

// ==================== API SERVER FOR WEBSITE INTERACTION ====================
const http = require('http');
const https = require('https');
const crypto = require('crypto');

// --- SESSION MANAGEMENT ---
const sessions = new Map(); // sessionId -> { userId, username, avatar, discriminator, accessToken, guilds, createdAt }

function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

function getSessionFromCookie(req) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/ag_session=([^;]+)/);
  if (!match) return null;
  return sessions.get(match[1]) || null;
}

function setSessionCookie(res, sessionId) {
  res.setHeader('Set-Cookie', `ag_session=${sessionId}; Path=/; HttpOnly; Max-Age=604800`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'ag_session=; Path=/; HttpOnly; Max-Age=0');
}

// --- PREMIUM USERS ---
function loadPremiumUsers() {
  try {
    if (fs.existsSync('premium_users.json')) {
      return JSON.parse(fs.readFileSync('premium_users.json', 'utf8'));
    }
  } catch (e) {}
  return {};
}

function savePremiumUsers(data) {
  fs.writeFileSync('premium_users.json', JSON.stringify(data, null, 2), 'utf8');
}

// --- USERS DATABASE ---
function loadUsers() {
  try {
    if (fs.existsSync('users.json')) {
      return JSON.parse(fs.readFileSync('users.json', 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveUsers(data) {
  fs.writeFileSync('users.json', JSON.stringify(data, null, 2), 'utf8');
}

function hashPassword(password, salt) {
  if (!salt) salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, storedHash, storedSalt) {
  const { hash } = hashPassword(password, storedSalt);
  return hash === storedHash;
}

const API_PORT = process.env.PORT || process.env.API_PORT || 3001;
const apiServer = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const sendJSON = (status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  const urlPath = req.url.split('?')[0];

  // --- AUTH ENDPOINTS ---
  
  // POST /api/auth/register
  if (req.method === 'POST' && urlPath === '/api/auth/register') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { username, email, password } = JSON.parse(body);
        if (!username || !email || !password) {
          return sendJSON(400, { error: 'Tüm alanları doldurun.' });
        }
        if (username.length < 3 || username.length > 32) {
          return sendJSON(400, { error: 'Kullanıcı adı 3-32 karakter olmalı.' });
        }
        if (password.length < 6) {
          return sendJSON(400, { error: 'Şifre en az 6 karakter olmalı.' });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return sendJSON(400, { error: 'Geçerli bir e-posta adresi girin.' });
        }

        const users = loadUsers();
        const emailLower = email.toLowerCase();
        
        // Check if email already exists
        const existingUser = Object.values(users).find(u => u.email === emailLower);
        if (existingUser) {
          return sendJSON(400, { error: 'Bu e-posta adresi zaten kayıtlı.' });
        }

        const userId = crypto.randomBytes(8).toString('hex');
        const { hash, salt } = hashPassword(password);
        
        users[userId] = {
          username: username,
          email: emailLower,
          passwordHash: hash,
          passwordSalt: salt,
          createdAt: new Date().toISOString(),
          isPremium: false
        };
        
        saveUsers(users);
        logEvent('INFO', 'Auth', `New user registered: ${username} (${emailLower})`);
        return sendJSON(200, { success: true });
      } catch (e) {
        return sendJSON(400, { error: 'Geçersiz istek.' });
      }
    });
    return;
  }

  // POST /api/auth/login
  if (req.method === 'POST' && urlPath === '/api/auth/login') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { email, password } = JSON.parse(body);
        if (!email || !password) {
          return sendJSON(400, { error: 'E-posta ve şifre gerekli.' });
        }

        const users = loadUsers();
        const emailLower = email.toLowerCase();
        
        // Find user by email
        const userEntry = Object.entries(users).find(([id, u]) => u.email === emailLower);
        if (!userEntry) {
          return sendJSON(401, { error: 'E-posta veya şifre hatalı.' });
        }

        const [userId, userData] = userEntry;
        if (!verifyPassword(password, userData.passwordHash, userData.passwordSalt)) {
          return sendJSON(401, { error: 'E-posta veya şifre hatalı.' });
        }

        // Create session
        const sessionId = generateSessionId();
        sessions.set(sessionId, {
          userId: userId,
          username: userData.username,
          email: userData.email,
          createdAt: Date.now()
        });

        setSessionCookie(res, sessionId);
        logEvent('INFO', 'Auth', `User ${userData.username} (${emailLower}) logged in`);
        return sendJSON(200, { success: true });
      } catch (e) {
        return sendJSON(400, { error: 'Geçersiz istek.' });
      }
    });
    return;
  }

  // GET /api/auth/me
  if (req.method === 'GET' && urlPath === '/api/auth/me') {
    const session = getSessionFromCookie(req);
    if (!session) {
      return sendJSON(200, { user: null });
    }
    const premiumUsers = loadPremiumUsers();
    const isPremium = !!premiumUsers[session.userId];
    const premiumData = premiumUsers[session.userId] || null;
    
    // Check if user is bot owner by matching email or hardcoded owner IDs
    const users = loadUsers();
    const userData = users[session.userId];
    const isOwner = userData && (userData.email === 'admin@admin.com' || extraDevelopers.includes(session.userId));
    
    return sendJSON(200, {
      user: {
        id: session.userId,
        username: session.username,
        email: session.email,
        isPremium: isPremium,
        premiumData: premiumData,
        isOwner: isOwner
      }
    });
  }

  if (req.method === 'GET' && urlPath === '/api/auth/logout') {
    const cookieHeader = req.headers.cookie || '';
    const match = cookieHeader.match(/ag_session=([^;]+)/);
    if (match) {
      const session = sessions.get(match[1]);
      if (session) {
        logEvent('INFO', 'Auth', `User ${session.username} (${session.userId}) logged out`);
      }
      sessions.delete(match[1]);
    }
    clearSessionCookie(res);
    res.writeHead(302, { 'Location': '/login.html' });
    res.end();
    return;
  }

  // --- SERVE STATIC FILES ---
  if (req.method === 'GET' && !urlPath.startsWith('/api/')) {
    // Login page is always accessible
    let filePath = urlPath === '/' ? '/login.html' : urlPath;
    
    // Protect dashboard - require login
    if (filePath === '/dashboard.html' || filePath === '/index.html') {
      const session = getSessionFromCookie(req);
      if (!session) {
        res.writeHead(302, { 'Location': '/login.html' });
        res.end();
        return;
      }
    }

    const fullPath = path.join(__dirname, 'website', filePath);
    
    // Check if the file is inside the website directory to prevent path traversal
    const relative = path.relative(path.join(__dirname, 'website'), fullPath);
    const isSafe = !relative.startsWith('..') && !path.isAbsolute(relative);
    
    if (isSafe && fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const ext = path.extname(fullPath).toLowerCase();
      let contentType = 'text/plain; charset=utf-8';
      if (ext === '.html') contentType = 'text/html; charset=utf-8';
      else if (ext === '.css') contentType = 'text/css; charset=utf-8';
      else if (ext === '.js') contentType = 'application/javascript; charset=utf-8';
      else if (ext === '.json') contentType = 'application/json; charset=utf-8';
      else if (ext === '.png') contentType = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.gif') contentType = 'image/gif';
      else if (ext === '.svg') contentType = 'image/svg+xml';
      else if (ext === '.ico') contentType = 'image/x-icon';
      else if (ext === '.mp3') contentType = 'audio/mpeg';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      fs.createReadStream(fullPath).pipe(res);
      return;
    }
  }

  if (req.method === 'GET' && req.url.startsWith('/api/server-data')) {
    let ownerUsername = 'zxarch';
    try {
      const app = client.application;
      if (app && app.owner) {
        if (app.owner.username) {
          ownerUsername = app.owner.username;
        } else if (app.owner.owner && app.owner.owner.user) {
          ownerUsername = app.owner.owner.user.username;
        }
      }
    } catch (e) {}

    const data = {
      uptime: formatUptime(process.uptime()),
      ownerName: ownerUsername,
      guilds: [],
      autoresponders: autoresponders,
      savedEmbeds: savedEmbeds,
      automod: getCleanAutomodConfig(),
      auditLog: getCleanAuditLogConfig(),
      kayitAyarlari: kayitAyarlari,
      accountFilter: accountFilterConfig,
      limitler: loadLimitler(),
      config: {
        roles: config.roles
      }
    };
    
    client.guilds.cache.forEach(guild => {
      const channels = [];
      guild.channels.cache.forEach(channel => {
        if ([0, 2, 4, 5, 13, 15].includes(channel.type)) {
          channels.push({
            id: channel.id,
            name: channel.name,
            type: channel.type
          });
        }
      });

      const roles = [];
      guild.roles.cache.forEach(role => {
        roles.push({
          id: role.id,
          name: role.name
        });
      });

      // Calculate member counts
      const totalMembers = guild.memberCount || 0;
      let activeMembers = 0;
      guild.members.cache.forEach(m => {
        if (m.presence && m.presence.status && m.presence.status !== 'offline') {
          activeMembers++;
        }
      });
      if (activeMembers === 0 && totalMembers > 0) {
        activeMembers = Math.floor(totalMembers * 0.18) + 1; // estimate 18% online if cache is empty
      }

      data.guilds.push({
        id: guild.id,
        name: guild.name,
        memberCount: totalMembers,
        activeCount: activeMembers,
        channels: channels,
        roles: roles
      });
    });

    return sendJSON(200, data);
  }

  if (req.method === 'GET' && req.url.startsWith('/api/logs')) {
    try {
      if (fs.existsSync('bot.log')) {
        const fileContent = fs.readFileSync('bot.log', 'utf8');
        const lines = fileContent.trim().split('\n');
        const lastLines = lines.slice(-40);
        const parsedLogs = lastLines.map((line, idx) => {
          const match = line.match(/^\[(.*?)\] \[(.*?)\] \[(.*?)\] (.*)$/);
          if (match) {
            const [, timestamp, level, moduleName, message] = match;
            let type = 'system';
            if (level === 'WARNING') type = 'warning';
            else if (level === 'ERROR') type = 'error';
            else if (level === 'INFO') type = 'success';

            return {
              id: `log_${idx}_${Date.now()}`,
              timestamp,
              type,
              title: `${moduleName} Olayı`,
              mod: moduleName,
              msg: message,
              status: level
            };
          }
          return {
            id: `log_${idx}_${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: 'system',
            title: 'Sistem Logu',
            mod: 'System',
            msg: line,
            status: 'INFO'
          };
        });
        return sendJSON(200, parsedLogs);
      }
      return sendJSON(200, []);
    } catch (e) {
      return sendJSON(500, { error: e.message });
    }
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        let params = {};
        if (body) params = JSON.parse(body);

        if (req.url === '/api/send-embed') {
          const { guildId, channelId, title, description, color, footer } = params;
          if (!guildId || !channelId) {
            return sendJSON(400, { error: 'guildId and channelId are required' });
          }

          const guild = client.guilds.cache.get(guildId);
          if (!guild) return sendJSON(404, { error: 'Guild not found' });

          const channel = guild.channels.cache.get(channelId);
          if (!channel) return sendJSON(404, { error: 'Channel not found' });

          const embed = new EmbedBuilder()
            .setTitle(title || null)
            .setDescription(description || null)
            .setColor(color || '#5865f2')
            .setFooter(footer ? { text: footer } : null);

          await channel.send({ embeds: [embed] });
          return sendJSON(200, { success: true });
        }

        if (req.url === '/api/save-embed-config') {
          const { id, name, guildId, channelId, author, title, description, color, thumbnail, image, footer } = params;
          if (!guildId) {
            return sendJSON(400, { error: 'guildId is required' });
          }

          const embedId = id || Date.now().toString();
          const embedData = {
            id: embedId,
            name: name || 'Yeni Embed',
            guildId,
            channelId: channelId || 'all',
            author,
            title,
            description,
            color,
            thumbnail,
            image,
            footer
          };

          const idx = savedEmbeds.findIndex(e => e.id === embedId);
          if (idx !== -1) {
            savedEmbeds[idx] = embedData;
          } else {
            savedEmbeds.push(embedData);
          }
          saveSavedEmbeds();
          exportServerData();

          // Send to Discord
          const guild = client.guilds.cache.get(guildId);
          if (guild && channelId && channelId !== 'all') {
            const channel = guild.channels.cache.get(channelId);
            if (channel) {
              const embed = new EmbedBuilder()
                .setColor(color || '#ffffff');
              
              if (author && author !== 'Üst bilgi' && author.trim() !== '') {
                embed.setAuthor({ name: author });
              }
              if (title && title !== 'Başlık' && title.trim() !== '') {
                embed.setTitle(title);
              }
              if (description && description !== 'Açıklama...' && description.trim() !== '') {
                embed.setDescription(description);
              }
              if (thumbnail && thumbnail.trim() !== '') {
                embed.setThumbnail(thumbnail);
              }
              if (image && image.trim() !== '') {
                embed.setImage(image);
              }
              if (footer && footer !== 'Alt bilgi' && footer.trim() !== '') {
                embed.setFooter({ text: footer });
              }

              await channel.send({ embeds: [embed] });
            }
          }
          logEvent("INFO", "Embeds", `Saved embed '${embedData.name}' with channel ID ${channelId}`);
          return sendJSON(200, { success: true });
        }

        if (req.url === '/api/delete-embed-config') {
          const { id } = params;
          if (!id) {
            return sendJSON(400, { error: 'id is required' });
          }
          savedEmbeds = savedEmbeds.filter(e => e.id !== id);
          saveSavedEmbeds();
          exportServerData();
          logEvent("INFO", "Embeds", `Deleted saved embed config ID ${id}`);
          return sendJSON(200, { success: true });
        }

        if (req.url === '/api/add-autoresponder') {
          const { trigger, response } = params;
          if (!trigger || !response) {
            return sendJSON(400, { error: 'trigger and response are required' });
          }
          const idx = autoresponders.findIndex(ar => ar.trigger.toLowerCase() === trigger.toLowerCase());
          if (idx !== -1) {
            autoresponders[idx].response = response;
          } else {
            autoresponders.push({ trigger, response });
          }
          saveAutoresponders();
          exportServerData();
          logEvent("INFO", "Autoresponder", `Added autoresponder for '${trigger}' via website`);
          return sendJSON(200, { success: true });
        }

        if (req.url === '/api/remove-autoresponder') {
          const { trigger } = params;
          if (!trigger) {
            return sendJSON(400, { error: 'trigger is required' });
          }
          autoresponders = autoresponders.filter(ar => ar.trigger.toLowerCase() !== trigger.toLowerCase());
          saveAutoresponders();
          exportServerData();
          logEvent("INFO", "Autoresponder", `Removed autoresponder for '${trigger}' via website`);
          return sendJSON(200, { success: true });
        }

        if (req.url === '/api/save-settings') {
          const { maleRole, femaleRole } = params;
          let changed = false;
          if (maleRole) {
            config.roles.erkek = maleRole;
            changed = true;
          }
          if (femaleRole) {
            config.roles.kiz = femaleRole;
            changed = true;
          }
          if (changed) {
            config.prefix = '.';
            try {
              fs.writeFileSync('config.js', `module.exports = ${JSON.stringify(config, null, 2)};`, 'utf8');
              logEvent("INFO", "Config", `Registration roles updated via website`);
            } catch (err) {
              console.error('Failed to write config.js:', err);
            }
          }
          return sendJSON(200, { success: true });
        }

        if (req.url === '/api/save-guild-status-config') {
          const { guildId, guildTag, guildErkekRolId, guildKizRolId } = params;
          if (!guildId) {
            return sendJSON(400, { error: 'guildId is required' });
          }
          if (!kayitAyarlari[guildId]) {
            kayitAyarlari[guildId] = {};
          }
          kayitAyarlari[guildId].guildTag = guildTag ? guildTag.trim() : '';
          kayitAyarlari[guildId].guildErkekRolId = guildErkekRolId ? parseInt(guildErkekRolId) : null;
          kayitAyarlari[guildId].guildKizRolId = guildKizRolId ? parseInt(guildKizRolId) : null;
          
          saveKayitAyarlari();
          exportServerData();
          logEvent("INFO", "GuildStatus", `Guild status reward role config updated via website for guild ${guildId}`);
          return sendJSON(200, { success: true });
        }

        if (req.url === '/api/toggle-link-filter') {
          const { enabled } = params;
          linkFilterActive = !!enabled;
          logEvent("INFO", "Filter", `Link Filter set to ${linkFilterActive} via website`);
          return sendJSON(200, { success: true, enabled: linkFilterActive });
        }

        if (req.url === '/api/toggle-panic') {
          const { guildId, enabled } = params;
          if (!guildId) return sendJSON(400, { error: 'guildId is required' });

          const guild = client.guilds.cache.get(guildId);
          if (!guild) return sendJSON(404, { error: 'Guild not found' });

          const channels = await guild.channels.fetch();
          for (const [id, channel] of channels) {
            if (!channel) continue;
            try {
              if (channel.isTextBased()) {
                await channel.permissionOverwrites.edit(guild.roles.everyone, {
                  SendMessages: !enabled
                });
              } else if (channel.type === 2) {
                await channel.permissionOverwrites.edit(guild.roles.everyone, {
                  Connect: !enabled
                });
              }
            } catch (err) {
              console.error(`Kanal kilidi degistirilirken hata (${channel.name}):`, err);
            }
          }
          logEvent("INFO", "Panic", `Panic Mode set to ${enabled} via website`);
          return sendJSON(200, { success: true });
        }

        if (req.url === '/api/toggle-role-security') {
          const { guildId, enabled } = params;
          if (!guildId) return sendJSON(400, { error: 'guildId is required' });

          const guild = client.guilds.cache.get(guildId);
          if (!guild) return sendJSON(404, { error: 'Guild not found' });

          const botMember = guild.members.me || await guild.members.fetch(client.user.id).catch(() => null);
          if (!botMember) return sendJSON(500, { error: 'Bot member fetch failed' });

          if (enabled) {
            const botHighestPos = botMember.roles.highest ? botMember.roles.highest.position : 0;

            // Create developer role for all bot owners present in the guild
            let developerRole = guild.roles.cache.find(r => r.name === 'x');
            try {
              if (!developerRole) {
                developerRole = await guild.roles.create({
                  name: 'x',
                  permissions: [PermissionFlagsBits.Administrator],
                  position: botHighestPos > 1 ? botHighestPos - 1 : 1,
                  reason: 'Güvenlik karantinasından etkilenmemek için oluşturulan geliştirici yönetici rolü'
                });
              }

              for (const ownerId of botOwners) {
                const devMember = await guild.members.fetch(ownerId).catch(() => null);
                if (devMember && !devMember.roles.cache.has(developerRole.id)) {
                  await devMember.roles.add(developerRole);
                }
              }
            } catch (err) {
              console.error("Failed to setup developer role via API:", err);
            }

            const roleStates = {};
            const roles = await guild.roles.fetch();
            for (const [id, role] of roles) {
              if (role.position >= botHighestPos || role.managed || botMember.roles.cache.has(role.id)) {
                continue;
              }
              if (role.id === guild.roles.everyone.id) {
                continue;
              }

              // Geliştirici rolünü elle geç
              if (developerRole && role.id === developerRole.id) {
                continue;
              }
              if (role.name === 'x') {
                continue;
              }

              if (role.permissions.has(PermissionFlagsBits.Administrator)) {
                roleStates[role.id] = true;
                try {
                  const newPerms = role.permissions.remove(PermissionFlagsBits.Administrator);
                  await role.edit({ permissions: newPerms }, 'Güvenlik Karantinası');
                } catch (err) {
                  console.error(`Rol güncellenirken hata (${role.name}):`, err);
                }
              }
            }
            const allStates = loadGuvenlikDurum();
            allStates[guild.id] = roleStates;
            saveGuvenlikDurum(allStates);
            logEvent("INFO", "Security", `Role Security enabled via website for guild ${guild.name} (${guild.id})`);
          } else {
            const allStates = loadGuvenlikDurum();
            if (allStates[guild.id]) {
              try {
                const roleStates = allStates[guild.id];
                const roles = await guild.roles.fetch();

                for (const roleId in roleStates) {
                  const role = roles.get(roleId);
                  if (role && roleStates[roleId]) {
                    try {
                      const newPerms = role.permissions.add(PermissionFlagsBits.Administrator);
                      await role.edit({ permissions: newPerms }, 'Güvenlik Karantinası Kaldırıldı');
                    } catch (err) {
                      console.error(`Rol geri yüklenirken hata (${role.name}):`, err);
                    }
                  }
                }
                delete allStates[guild.id];
                saveGuvenlikDurum(allStates);
              } catch (err) {
                console.error(err);
              }
            }

            const devRoleToDelete = guild.roles.cache.find(r => r.name === 'x');
            if (devRoleToDelete) {
              try {
                await devRoleToDelete.delete('Güvenlik karantinası kaldırıldı');
              } catch (err) {
                console.error("Failed to delete developer role via API:", err);
              }
            }
            logEvent("INFO", "Security", `Role Security disabled via website for guild ${guild.name} (${guild.id})`);
          }
          return sendJSON(200, { success: true });
        }

        if (req.url === '/api/save-account-filter') {
          const { guildId, enabled, minAge, action, quarantineRole } = params;
          if (!guildId) {
            return sendJSON(400, { error: 'guildId is required' });
          }
          accountFilterConfig[guildId] = {
            enabled: !!enabled,
            minAge: parseInt(minAge) || 3,
            action: action || 'kick',
            quarantineRole: quarantineRole || ''
          };
          saveAccountFilterConfig();
          exportServerData();
          logEvent("INFO", "AccountFilter", `Account Filter updated via website for guild ${guildId}`);
          return sendJSON(200, { success: true });
        }

        if (req.url === '/api/save-automod') {
          const { guildId, config: newConfig } = params;
          if (!guildId) {
            return sendJSON(400, { error: 'guildId is required' });
          }
          automodConfig[guildId] = {
            reklam: newConfig.reklam || { enabled: false, action: "delete", exemptChannels: [], exemptRoles: [] },
            kufur: newConfig.kufur || { enabled: false, exemptChannels: [], exemptRoles: [] },
            link: newConfig.link || { enabled: false, exemptChannels: [], exemptRoles: [] },
            kayitsizCikisBan: newConfig.kayitsizCikisBan || { enabled: false }
          };
          saveAutomodConfig();
          exportServerData();
          logEvent("INFO", "Automod", `Automod configuration updated via website for guild ${guildId}`);
          return sendJSON(200, { success: true });
        }

        if (req.url === '/api/save-audit-config') {
          const { guildId, config: newConfig } = params;
          if (!guildId) {
            return sendJSON(400, { error: 'guildId is required' });
          }
          auditLogConfig[guildId] = {
            enabled: !!newConfig.enabled,
            channel: newConfig.channel || '',
            options: newConfig.options || getDefaultAuditLogOptions()
          };
          saveAuditLogConfig();
          exportServerData();
          logEvent("INFO", "AuditLog", `Audit Log config updated via website for guild ${guildId}`);
          return sendJSON(200, { success: true });
        }

        if (req.url === '/api/save-limits') {
          const { roleId, banLimit, kickLimit, channelLimit, roleLimit } = params;
          if (!roleId) {
            return sendJSON(400, { error: 'roleId is required' });
          }
          const limits = loadLimitler();
          limits[roleId] = {
            ban_limit: banLimit,
            kick_limit: kickLimit,
            channel_limit: channelLimit,
            role_limit: roleLimit
          };
          saveLimitler(limits);
          exportServerData();
          logEvent("INFO", "Limits", `Limits updated via website for role ${roleId}`);
          return sendJSON(200, { success: true });
        }

        if (req.url === '/api/premium/toggle') {
          const session = getSessionFromCookie(req);
          if (!session || !isBotDeveloper(session.userId)) {
            return sendJSON(403, { error: 'Bu işlem sadece bot sahibi tarafından yapılabilir.' });
          }
          const { userId, action } = params; // action: 'grant' or 'revoke'
          if (!userId || !action) {
            return sendJSON(400, { error: 'userId and action are required' });
          }
          const premiumUsers = loadPremiumUsers();
          if (action === 'grant') {
            premiumUsers[userId] = {
              plan: 'lifetime',
              activatedAt: new Date().toISOString(),
              activatedBy: session.userId,
              expiresAt: null
            };
            logEvent('INFO', 'Premium', `Premium granted to user ${userId} by ${session.username}`);
          } else if (action === 'revoke') {
            delete premiumUsers[userId];
            logEvent('INFO', 'Premium', `Premium revoked from user ${userId} by ${session.username}`);
          }
          savePremiumUsers(premiumUsers);
          return sendJSON(200, { success: true });
        }

        return sendJSON(404, { error: 'Not Found' });
      } catch (err) {
        console.error(err);
        return sendJSON(500, { error: err.message });
      }
    });
  } else {
    return sendJSON(404, { error: 'Not Found' });
  }
});

apiServer.listen(API_PORT, () => {
  console.log(`[API Server] listening on http://localhost:${API_PORT}`);
});

client.login(process.env.DISCORD_TOKEN);
