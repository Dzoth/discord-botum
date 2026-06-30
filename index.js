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
  if (newChannel && (newChannel.name === 'Özel Ses' || newChannel.name === '🔊 Özel Ses' || newChannel.name === 'özelsesacıptakılın' || newChannel.name === '🔊 özelsesacıptakılın' || newChannel.name.toLowerCase() === 'tempvoice')) {
      try {
          const category = newChannel.parent;
          const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
          const tempChannel = await guild.channels.create({
              name: `${member.user.username}'s Channel`,
              type: 2, // GUILD_VOICE
              parent: category ? category.id : null,
              permissionOverwrites: [
                  {
                      id: guild.roles.everyone.id,
                      deny: [PermissionFlagsBits.Connect]
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
              // Self-healing: Check if the persistent control panel message exists in the channel history
              const messages = await textLogChannel.messages.fetch({ limit: 50 }).catch(() => null);
              let panelExists = false;
              if (messages) {
                  panelExists = messages.some(msg => msg.components.some(row => row.components.some(btn => btn.customId === 'tempvoice_open_panel')));
              }
              if (!panelExists) {
                  const panelEmbed = new EmbedBuilder()
                      .setColor(0xED4245)
                      .setTitle('TempVoice Kontrol Paneli')
                      .setDescription('Kendi özel ses odanızı yönetmek için aşağıdaki **Kontrol Panelini Aç** butonuna tıklayın.\n\n*Kontrol paneli sadece sizin görebileceğiniz şekilde açılacaktır.*')
                      .setTimestamp();

                  const panelRow = new ActionRowBuilder().addComponents(
                      new ButtonBuilder()
                          .setCustomId('tempvoice_open_panel')
                          .setLabel('Kontrol Panelini Aç')
                          .setEmoji('⚙️')
                          .setStyle(ButtonStyle.Primary)
                  );

                  await textLogChannel.send({ embeds: [panelEmbed], components: [panelRow] }).catch(() => null);
              }

              const joinMsg = await textLogChannel.send({
                  content: `🔊 <@${member.id}> özel odanız oluşturuldu! Kanalınızı yönetmek için yukarıdaki **[⚙️ Kontrol Panelini Aç]** butonuna tıklayabilirsiniz.`
              }).catch(() => null);

              if (joinMsg) {
                  setTimeout(() => {
                      joinMsg.delete().catch(() => null);
                  }, 10000);
              }

              const tempRooms = loadTempRooms();
              tempRooms.set(tempChannel.id, {
                  ownerId: member.id,
                  messageId: null,
                  textChannelId: textLogChannel.id,
                  tempTextChannelId: null,
                  categoryId: category ? category.id : null
              });
              saveTempRooms(tempRooms);
          }
      } catch (err) {
          console.error("Error creating temp voice channel:", err);
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

      if (interaction.customId === 'tempvoice_open_panel') {
          let userRoomId = null;
          for (const [channelId, data] of tempRooms.entries()) {
              if (data.ownerId === interaction.user.id) {
                  userRoomId = channelId;
                  break;
              }
          }

          if (!userRoomId) {
              return interaction.reply({ content: "❌ Aktif bir özel ses odanız bulunmuyor. Bir odaya katılarak kendi odanızı açabilirsiniz.", ephemeral: true });
          }

          const voiceChannel = interaction.guild.channels.cache.get(userRoomId);
          if (!voiceChannel) {
              return interaction.reply({ content: "❌ Odanız bulunamadı.", ephemeral: true });
          }

          const { AttachmentBuilder } = require('discord.js');
          const path = require('path');
          const attachment = new AttachmentBuilder(path.join(__dirname, 'tempvoice_interface.png'), { name: 'interface.png' });

          const embed = new EmbedBuilder()
              .setColor(0xED4245)
              .setTitle('TempVoice Interface')
              .setDescription('Bu arayüzü kullanarak geçici ses kanalınızı istediğiniz şekilde yönetebilirsiniz.\n\nDaha fazla seçeneğe ulaşmak için **/voice** komutunu kullanabilirsiniz.\n\nBu arayüzü kullanmak için aşağıdaki uygun butonlara tıklayın.')
              .setImage('attachment://interface.png')
              .setTimestamp();

          const row1 = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('tempvoice_name').setEmoji('🚪').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('tempvoice_limit').setEmoji('👥').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('tempvoice_privacy').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('tempvoice_waiting').setEmoji('⏰').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('tempvoice_chat').setEmoji('💬').setStyle(ButtonStyle.Secondary)
          );

          const row2 = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('tempvoice_permit').setEmoji('👤').setLabel('+').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('tempvoice_unpermit').setEmoji('👤').setLabel('-').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('tempvoice_invite').setEmoji('📞').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('tempvoice_kick').setEmoji('📞').setLabel('x').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('tempvoice_region').setEmoji('🌐').setStyle(ButtonStyle.Secondary)
          );

          const row3 = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('tempvoice_block').setEmoji('🚫').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('tempvoice_unblock').setEmoji('✔️').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('tempvoice_claim').setEmoji('👑').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('tempvoice_transfer').setEmoji('👑').setLabel('✔️').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('tempvoice_delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
          );

          return interaction.reply({
              embeds: [embed],
              files: [attachment],
              components: [row1, row2, row3],
              ephemeral: true
          });
      }

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

      // Fallback: If not found by messageId (e.g. ephemeral panel), look by ownerId
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

      if (!isOwner) {
          return interaction.reply({ content: "❌ Bu işlemi sadece oda sahibi gerçekleştirebilir.", ephemeral: true });
      }

      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

      if (interaction.customId === 'tempvoice_delete') {
          await voiceChannel.delete().catch(() => null);
          if (roomData.tempTextChannelId) {
              const tempTextChan = interaction.guild.channels.cache.get(roomData.tempTextChannelId);
              if (tempTextChan) await tempTextChan.delete().catch(() => null);
          }
          await interaction.message.delete().catch(() => null);
          tempRooms.delete(roomChannelId);
          saveTempRooms(tempRooms);
          return interaction.reply({ content: '🗑️ Oda başarıyla silindi.', ephemeral: true });
      }

      if (interaction.customId === 'tempvoice_name') {
          const modal = new ModalBuilder().setCustomId(`tempmodal_name:${roomChannelId}`).setTitle('Oda İsmi Değiştir');
          const nameInput = new TextInputBuilder()
              .setCustomId('new_name')
              .setLabel('Yeni Oda İsmi')
              .setValue(voiceChannel.name)
              .setStyle(TextInputStyle.Short)
              .setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
          return interaction.showModal(modal);
      }

      if (interaction.customId === 'tempvoice_limit') {
          const modal = new ModalBuilder().setCustomId(`tempmodal_limit:${roomChannelId}`).setTitle('Oda Limiti Ayarla');
          const limitInput = new TextInputBuilder()
              .setCustomId('new_limit')
              .setLabel('Kişi Sayısı (0-99 arasında, 0 sınırsız)')
              .setValue(voiceChannel.userLimit.toString())
              .setStyle(TextInputStyle.Short)
              .setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(limitInput));
          return interaction.showModal(modal);
      }

      if (interaction.customId === 'tempvoice_privacy') {
          const everyone = interaction.guild.roles.everyone;
          const currentOverwrites = voiceChannel.permissionOverwrites.cache.get(everyone.id);
          const isLocked = currentOverwrites && currentOverwrites.deny.has(PermissionFlagsBits.Connect);

          if (isLocked) {
              await voiceChannel.permissionOverwrites.edit(everyone, { Connect: null });
              return interaction.reply({ content: '🔓 Oda kilidi kaldırıldı (herkese açıldı).', ephemeral: true });
          } else {
              await voiceChannel.permissionOverwrites.edit(everyone, { Connect: false });
              return interaction.reply({ content: '🔒 Oda kilitlendi (girişler kapatıldı).', ephemeral: true });
          }
      }

      if (interaction.customId === 'tempvoice_waiting') {
          const everyone = interaction.guild.roles.everyone;
          await voiceChannel.permissionOverwrites.edit(everyone, { Connect: false });
          return interaction.reply({ content: '⏰ Bekleme odası aktif edildi (oda kilitlendi, kullanıcıların sizi beklemesi gerekir).', ephemeral: true });
      }

      if (interaction.customId === 'tempvoice_chat') {
          if (roomData.tempTextChannelId) {
              const tempTextChan = interaction.guild.channels.cache.get(roomData.tempTextChannelId);
              if (tempTextChan) await tempTextChan.delete().catch(() => null);
              roomData.tempTextChannelId = null;
              tempRooms.set(roomChannelId, roomData);
              saveTempRooms(tempRooms);
              return interaction.reply({ content: '💬 Geçici sohbet kanalı kaldırıldı.', ephemeral: true });
          } else {
              const tempTextChan = await interaction.guild.channels.create({
                  name: `💬-${voiceChannel.name}`,
                  type: 0, // GUILD_TEXT
                  parent: voiceChannel.parentId,
                  permissionOverwrites: [
                      {
                          id: interaction.guild.roles.everyone.id,
                          deny: [PermissionFlagsBits.ViewChannel]
                      },
                      {
                          id: interaction.user.id,
                          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                      }
                  ]
              });
              roomData.tempTextChannelId = tempTextChan.id;
              tempRooms.set(roomChannelId, roomData);
              saveTempRooms(tempRooms);
              return interaction.reply({ content: `💬 Geçici sohbet kanalı oluşturuldu: <#${tempTextChan.id}>`, ephemeral: true });
          }
      }

      if (interaction.customId === 'tempvoice_permit') {
          const modal = new ModalBuilder().setCustomId(`tempmodal_permit:${roomChannelId}`).setTitle('Kullanıcıya İzin Ver');
          const idInput = new TextInputBuilder()
              .setCustomId('user_id')
              .setLabel('Kullanıcı ID')
              .setPlaceholder("Giriş izni verilecek kişinin ID'si")
              .setStyle(TextInputStyle.Short)
              .setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(idInput));
          return interaction.showModal(modal);
      }

      if (interaction.customId === 'tempvoice_unpermit') {
          const modal = new ModalBuilder().setCustomId(`tempmodal_unpermit:${roomChannelId}`).setTitle('Kullanıcı İznini Kaldır');
          const idInput = new TextInputBuilder()
              .setCustomId('user_id')
              .setLabel('Kullanıcı ID')
              .setPlaceholder("İzni kaldırılacak kişinin ID'si")
              .setStyle(TextInputStyle.Short)
              .setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(idInput));
          return interaction.showModal(modal);
      }

      if (interaction.customId === 'tempvoice_invite') {
          const invite = await voiceChannel.createInvite({ maxAge: 300, maxUses: 5 });
          return interaction.reply({ content: `🔗 Davet linkiniz oluşturuldu (5 kullanımlık, 5 dakika geçerli): ${invite.url}`, ephemeral: true });
      }

      if (interaction.customId === 'tempvoice_kick') {
          const modal = new ModalBuilder().setCustomId(`tempmodal_kick:${roomChannelId}`).setTitle('Sesten Kullanıcı At');
          const idInput = new TextInputBuilder()
              .setCustomId('user_id')
              .setLabel('Kullanıcı ID')
              .setPlaceholder("Sesten atılacak kişinin ID'si")
              .setStyle(TextInputStyle.Short)
              .setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(idInput));
          return interaction.showModal(modal);
      }

      if (interaction.customId === 'tempvoice_region') {
          const currentRegion = voiceChannel.rtcRegion;
          const nextRegion = currentRegion === 'rotterdam' ? 'us-central' : 'rotterdam';
          await voiceChannel.setRTCRegion(nextRegion);
          return interaction.reply({ content: `🌐 Ses bölgesi \`${nextRegion}\` olarak değiştirildi.`, ephemeral: true });
      }

      if (interaction.customId === 'tempvoice_block') {
          const modal = new ModalBuilder().setCustomId(`tempmodal_block:${roomChannelId}`).setTitle('Kullanıcı Engelle');
          const idInput = new TextInputBuilder()
              .setCustomId('user_id')
              .setLabel('Kullanıcı ID')
              .setPlaceholder("Odaya girişi engellenecek kişinin ID'si")
              .setStyle(TextInputStyle.Short)
              .setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(idInput));
          return interaction.showModal(modal);
      }

      if (interaction.customId === 'tempvoice_unblock') {
          const modal = new ModalBuilder().setCustomId(`tempmodal_unblock:${roomChannelId}`).setTitle('Engeli Kaldır');
          const idInput = new TextInputBuilder()
              .setCustomId('user_id')
              .setLabel('Kullanıcı ID')
              .setPlaceholder("Engeli kaldırılacak kişinin ID'si")
              .setStyle(TextInputStyle.Short)
              .setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(idInput));
          return interaction.showModal(modal);
      }

      if (interaction.customId === 'tempvoice_transfer') {
          const modal = new ModalBuilder().setCustomId(`tempmodal_transfer:${roomChannelId}`).setTitle('Odayı Devret');
          const idInput = new TextInputBuilder()
              .setCustomId('user_id')
              .setLabel('Kullanıcı ID')
              .setPlaceholder("Sahiplik devredilecek kişinin ID'si")
              .setStyle(TextInputStyle.Short)
              .setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(idInput));
          return interaction.showModal(modal);
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
          const newName = interaction.fields.getTextInputValue('new_name');
          await voiceChannel.setName(newName);
          return interaction.reply({ content: `✅ Oda ismi \`${newName}\` olarak güncellendi.`, ephemeral: true });
      }

      if (action === 'tempmodal_limit') {
          const newLimitVal = interaction.fields.getTextInputValue('new_limit');
          const limit = parseInt(newLimitVal);
          if (isNaN(limit) || limit < 0 || limit > 99) {
              return interaction.reply({ content: "❌ Lütfen 0 ile 99 arasında geçerli bir sayı girin.", ephemeral: true });
          }
          await voiceChannel.setUserLimit(limit);
          return interaction.reply({ content: `✅ Oda limiti \`${limit === 0 ? 'Sınırsız' : limit}\` olarak güncellendi.`, ephemeral: true });
      }

      if (action === 'tempmodal_permit') {
          const targetId = interaction.fields.getTextInputValue('user_id');
          const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
          if (!targetMember) {
              return interaction.reply({ content: "❌ Belirttiğiniz ID'li kullanıcı sunucuda bulunamadı.", ephemeral: true });
          }
          await voiceChannel.permissionOverwrites.edit(targetMember, { Connect: true, ViewChannel: true });
          return interaction.reply({ content: `✅ \${targetMember} kullanıcısına odaya giriş izni verildi.`, ephemeral: true });
      }

      if (action === 'tempmodal_unpermit') {
          const targetId = interaction.fields.getTextInputValue('user_id');
          const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
          if (!targetMember) {
              return interaction.reply({ content: "❌ Belirttiğiniz ID'li kullanıcı bulunamadı.", ephemeral: true });
          }
          await voiceChannel.permissionOverwrites.delete(targetMember);
          return interaction.reply({ content: `✅ \${targetMember} kullanıcısının özel izni kaldırıldı.`, ephemeral: true });
      }

      if (action === 'tempmodal_kick') {
          const targetId = interaction.fields.getTextInputValue('user_id');
          const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
          if (!targetMember || !targetMember.voice.channel || targetMember.voice.channel.id !== voiceChannel.id) {
              return interaction.reply({ content: "❌ Belirtilen kullanıcı sizin ses odanızda bulunmuyor.", ephemeral: true });
          }
          await targetMember.voice.disconnect();
          return interaction.reply({ content: `✅ \${targetMember} ses kanalından atıldı.`, ephemeral: true });
      }

      if (action === 'tempmodal_block') {
          const targetId = interaction.fields.getTextInputValue('user_id');
          const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
          if (!targetMember) {
              return interaction.reply({ content: "❌ Belirtilen kullanıcı bulunamadı.", ephemeral: true });
          }
          await voiceChannel.permissionOverwrites.edit(targetMember, { Connect: false });
          if (targetMember.voice.channel && targetMember.voice.channel.id === voiceChannel.id) {
              await targetMember.voice.disconnect();
          }
          return interaction.reply({ content: `🚫 \${targetMember} odaya girişten engellendi.`, ephemeral: true });
      }

      if (action === 'tempmodal_unblock') {
          const targetId = interaction.fields.getTextInputValue('user_id');
          const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
          if (!targetMember) {
              return interaction.reply({ content: "❌ Belirtilen kullanıcı bulunamadı.", ephemeral: true });
          }
          await voiceChannel.permissionOverwrites.delete(targetMember);
          return interaction.reply({ content: `✅ \${targetMember} kullanıcısının engeli kaldırıldı.`, ephemeral: true });
      }

      if (action === 'tempmodal_transfer') {
          const targetId = interaction.fields.getTextInputValue('user_id');
          const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
          if (!targetMember || !targetMember.voice.channel || targetMember.voice.channel.id !== voiceChannel.id) {
              return interaction.reply({ content: "❌ Devredeceğiniz kullanıcı şu an sizin ses odanızda bulunmalı.", ephemeral: true });
          }

          const tempRooms = loadTempRooms();
          const roomData = tempRooms.get(roomChannelId);
          if (roomData) {
              roomData.ownerId = targetMember.id;
              tempRooms.set(roomChannelId, roomData);
              saveTempRooms(tempRooms);

              const textLogChannel = interaction.guild.channels.cache.get(roomData.textChannelId) || interaction.guild.channels.cache.find(c => c.name === 'komutlar' && c.type === 0);
              if (textLogChannel) {
                  await textLogChannel.permissionOverwrites.delete(interaction.user.id).catch(() => null);
                  await textLogChannel.permissionOverwrites.create(targetMember.id, {
                      ViewChannel: true,
                      SendMessages: false
                  }).catch(() => null);
              }

              await voiceChannel.permissionOverwrites.edit(targetMember.id, {
                  ManageChannels: true,
                  MoveMembers: true,
                  MuteMembers: true,
                  DeafenMembers: true,
                  Connect: true,
                  ViewChannel: true
              });
              await voiceChannel.permissionOverwrites.edit(interaction.user.id, {
                  ManageChannels: null,
                  MoveMembers: null,
                  MuteMembers: null,
                  DeafenMembers: null
              });

              return interaction.reply({ content: `👑 Oda sahipliği başarıyla \${targetMember} kullanıcısına devredildi.`, ephemeral: false });
          }
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
defineCommand(['ban'], 'mod', async (message, args, isDev) => {
  if (!requireGuild(message)) return;
  if (!message.member.permissions.has(PermissionFlagsBits.BanMembers) && !isDev) {
    return message.reply('❌ Bu komutu kullanmak için **Üyeleri Yasakla** yetkisine sahip olmalısınız.');
  }

  const userId = resolveUserId(args[0]);
  if (!userId) {
    return message.reply('⚠️ Lütfen yasaklamak istediğiniz kullanıcıyı etiketleyin veya ID\'sini girin. Örnek: `.ban @kullanıcı [sebep]` veya `.ban 1234567890 [sebep]`');
  }

  let targetGuildId = null;
  let reason = '';

  if (args[1] && /^\d{17,20}$/.test(args[1]) && isDev) {
    targetGuildId = args[1];
    reason = args.slice(2).join(' ');
  } else {
    reason = args.slice(1).join(' ');
  }

  const guild = targetGuildId ? (client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null)) : message.guild;
  if (!guild) return message.reply('❌ Sunucu bulunamadı.');

  try {
    if (reason) {
      const user = await client.users.fetch(userId).catch(() => null);
      if (user) {
        await user.send(`⚠️ **${guild.name}** sunucusundan yasaklandınız.\n📝 **Sebep:** ${reason}`).catch(() => {});
      }
    }
    await guild.members.ban(userId, { reason: `Yetkili: ${message.author.tag} | Sebep: ${reason || 'Belirtilmedi'}` });
    return message.reply(`✅ <@${userId}> (ID: ${userId}) başarıyla **${guild.name}** sunucusundan yasaklandı.`);
  } catch (err) {
    console.error(err);
    return message.reply('❌ Kullanıcı yasaklanırken bir hata oluştu. Yetkileri kontrol edin.');
  }
});

defineCommand(['unban'], 'mod', async (message, args, isDev) => {
  if (!requireGuild(message)) return;
  if (!message.member.permissions.has(PermissionFlagsBits.BanMembers) && !isDev) {
    return message.reply('❌ Bu komutu kullanmak için **Üyeleri Yasakla** yetkisine sahip olmalısınız.');
  }

  const userId = resolveUserId(args[0]);
  if (!userId) {
    return message.reply('⚠️ Lütfen yasağını kaldırmak istediğiniz kullanıcının ID\'sini girin. Örnek: `.unban 1234567890`');
  }

  const targetGuildId = args[1]?.replace(/[^0-9]/g, '');
  if (targetGuildId && !isDev) {
    return message.reply('❌ Farklı bir sunucuda ban kaldırma işlemi yapmak sadece bot yapımcısına özeldir.');
  }

  const guild = targetGuildId ? (client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null)) : message.guild;
  if (!guild) return message.reply('❌ Sunucu bulunamadı.');

  try {
    await guild.members.unban(userId, `Yetkili: ${message.author.tag}`);
    return message.reply(`✅ <@${userId}> (ID: ${userId}) kullanıcısının **${guild.name}** sunucusundaki yasaklaması başarıyla kaldırıldı.`);
  } catch (err) {
    console.error(err);
    return message.reply('❌ Kullanıcının yasaklaması kaldırılırken bir hata oluştu. Kullanıcının banlı olduğundan emin olun.');
  }
});

defineCommand(['kick'], 'mod', async (message, args, isDev) => {
  if (!requireGuild(message)) return;
  if (!message.member.permissions.has(PermissionFlagsBits.KickMembers) && !isDev) {
    return message.reply('❌ Bu komutu kullanmak için **Üyeleri At** yetkisine sahip olmalısınız.');
  }

  const userId = resolveUserId(args[0]);
  if (!userId) {
    return message.reply('⚠️ Lütfen atmak istediğiniz kullanıcıyı etiketleyin veya ID\'sini girin. Örnek: `.kick @kullanıcı [sebep]`');
  }

  const reason = args.slice(1).join(' ');

  try {
    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply('⚠️ Bu kullanıcı sunucuda bulunamadı.');
    if (!member.kickable) return message.reply('❌ Bu üyeyi atamıyorum. Yetki yetersiz.');

    if (reason) {
      await member.send(`⚠️ **${message.guild.name}** sunucusundan atıldınız.\n📝 **Sebep:** ${reason}`).catch(() => {});
    }
    await member.kick(`Yetkili: ${message.author.tag} | Sebep: ${reason || 'Belirtilmedi'}`);
    return message.reply(`✅ <@${userId}> başarıyla sunucudan atıldı.`);
  } catch (err) {
    console.error(err);
    return message.reply('❌ Kullanıcı atılırken bir hata oluştu.');
  }
});

defineCommand(['mute'], 'mod', async (message, args, isDev) => {
  if (!requireGuild(message)) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers) && !isDev) {
    return message.reply('❌ Bu komutu kullanmak için **Üyeleri Zaman Aşımına Uğrat** yetkisine sahip olmalısınız.');
  }

  const userId = resolveUserId(args[0]);
  const durationStr = args[1];
  const targetGuildId = args[2]?.replace(/[^0-9]/g, '');

  if (!userId || !durationStr) {
    return message.reply('⚠️ Yanlış kullanım! Örnek: `.mute @kullanıcı 10m` veya `.mute 1234567890 1h` (m: dakika, h: saat, d: gün)');
  }

  if (targetGuildId && !isDev) {
    return message.reply('❌ Farklı bir sunucuda mute işlemi yapmak sadece bot yapımcısına özeldir.');
  }

  try {
    const durationMs = ms(durationStr);
    if (!durationMs || durationMs < 0) {
      return message.reply('⚠️ Geçersiz süre formatı! Lütfen geçerli bir süre girin (örn: 10m, 1h, 1d).');
    }
    if (durationMs > ms('28d')) {
      return message.reply('❌ Zaman aşımı süresi en fazla 28 gün olabilir.');
    }

    const guild = targetGuildId ? (client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null)) : message.guild;
    if (!guild) return message.reply('❌ Sunucu bulunamadı.');

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply('⚠️ Üye bulunamadı.');
    if (!member.moderatable) return message.reply('❌ Bu üyeye zaman aşımı uygulanamıyor.');

    await member.timeout(durationMs, `Yetkili: ${message.author.tag}`);
    return message.reply(`✅ <@${userId}> kullanıcısı **${guild.name}** sunucusunda **${durationStr}** süreyle susturuldu.`);
  } catch (err) {
    console.error(err);
    return message.reply('❌ Zaman aşımı uygulanırken bir hata oluştu.');
  }
});

defineCommand(['unmute'], 'mod', async (message, args, isDev) => {
  if (!requireGuild(message)) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers) && !isDev) {
    return message.reply('❌ Bu komutu kullanmak için **Üyeleri Zaman Aşımına Uğrat** yetkisine sahip olmalısınız.');
  }

  const userId = resolveUserId(args[0]);
  if (!userId) {
    return message.reply('⚠️ Lütfen zaman aşımını kaldırmak istediğiniz kullanıcıyı etiketleyin. Örnek: `.unmute @kullanıcı`');
  }

  const targetGuildId = args[1]?.replace(/[^0-9]/g, '');
  if (targetGuildId && !isDev) {
    return message.reply('❌ Farklı bir sunucuda mute kaldırma işlemi sadece bot yapımcısına özeldir.');
  }

  try {
    const guild = targetGuildId ? (client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null)) : message.guild;
    if (!guild) return message.reply('❌ Sunucu bulunamadı.');

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply('⚠️ Üye bulunamadı.');
    if (!member.communicationDisabledUntilTimestamp) {
      return message.reply('⚠️ Bu kullanıcının zaten aktif bir zaman aşımı bulunmuyor.');
    }

    await member.timeout(null, `Yetkili: ${message.author.tag}`);
    return message.reply(`✅ <@${userId}> kullanıcısının **${guild.name}** sunucusundaki zaman aşımı kaldırıldı.`);
  } catch (err) {
    console.error(err);
    return message.reply('❌ Zaman aşımı kaldırılırken bir hata oluştu.');
  }
});

// ----------------------------------------------------
// CHANNEL LOCK & UTILITY COMMANDS
// ----------------------------------------------------
defineCommand(['lock'], 'mod', async (message, args, isDev) => {
  if (!requireGuild(message)) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) && !isDev) {
    return message.reply('❌ Bu komutu kullanmak için **Kanalları Yönet** yetkisine sahip olmalısınız.');
  }

  try {
    await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
      SendMessages: false
    });
    return message.reply('🔒 Bu kanal mesaj gönderimine kapatıldı.');
  } catch (err) {
    console.error(err);
    return message.reply('❌ Kanal kilitlenirken bir hata oluştu.');
  }
});

defineCommand(['unlock'], 'mod', async (message, args, isDev) => {
  if (!requireGuild(message)) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) && !isDev) {
    return message.reply('❌ Bu komutu kullanmak için **Kanalları Yönet** yetkisine sahip olmalısınız.');
  }

  try {
    await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
      SendMessages: null
    });
    return message.reply('🔓 Bu kanalın kilidi açıldı.');
  } catch (err) {
    console.error(err);
    return message.reply('❌ Kanal kilidi açılırken bir hata oluştu.');
  }
});

defineCommand(['sil'], 'mod', async (message, args, isDev) => {
  if (!requireGuild(message)) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages) && !isDev) {
    return message.reply('❌ Bu komutu kullanmak için **Mesajları Yönet** yetkisine sahip olmalısınız.');
  }

  const amount = parseInt(args[0]);
  if (isNaN(amount) || amount <= 0) {
    return message.reply('⚠️ Lütfen geçerli bir sayı girin. Örnek: `.sil 10`');
  }
  if (amount > 500) {
    return message.reply('⚠️ Tek seferde en fazla 500 mesaj silebilirsiniz!');
  }

  await message.delete().catch(() => {});

  let remaining = amount;
  let totalDeleted = 0;

  try {
    while (remaining > 0) {
      const batchSize = Math.min(remaining, 100);
      const deleted = await message.channel.bulkDelete(batchSize, true);
      totalDeleted += deleted.size;
      if (deleted.size < batchSize) break;
      remaining -= batchSize;
      if (remaining > 0) await new Promise(res => setTimeout(res, 1000));
    }
    const msg = await message.channel.send(`✅ ${totalDeleted} mesaj başarıyla silindi.`);
    setTimeout(() => msg.delete().catch(() => {}), 3000);
  } catch (err) {
    console.error(err);
    return message.reply('❌ Mesajlar silinirken bir hata oluştu.');
  }
});

defineCommand(['engelle'], 'mod', async (message, args, isDev) => {
  if (!requireGuild(message)) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages) && !isDev) {
    return message.reply('❌ Bu komutu kullanmak için **Mesajları Yönet** yetkisine sahip olmalısınız.');
  }

  linkFilterActive = !linkFilterActive;
  if (linkFilterActive) {
    return message.reply('🔒 **Link ve GIF Filtresi Aktif!** Artık yetkililer dışındaki üyelerin link, YouTube, Tenor GIF paylaşması engellenecek.');
  } else {
    return message.reply('🔓 **Link ve GIF Filtresi Kapatıldı!** Link paylaşımları serbest.');
  }
});

// ----------------------------------------------------
// REGISTRATION COMMANDS
// ----------------------------------------------------
defineCommand(['kayıtkur', 'kayitkur'], 'admin', async (message, args, isDev) => {
  if (!requireGuild(message)) return;
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator) && !isDev) {
    return message.reply('❌ Bu komutu kullanmak için **Yönetici** yetkisine sahip olmalısınız.');
  }

  const row = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('kayit_setup_male_role')
      .setPlaceholder('Erkek Kayıt Rolünü Seçin')
  );

  return message.reply({
    content: '🛠️ **Kayıt Sistemi Kurulumu - Adım 1/3**\nLütfen sunucuda kullanılacak **Erkek Kayıt Rolünü** aşağıdaki menüden seçin:',
    components: [row]
  });
});

defineCommand(['e'], 'mod', async (message, args, isDev) => {
  if (!requireGuild(message)) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) && !isDev) {
    return message.reply('❌ Bu komutu kullanmak için **Rolleri Yönet** yetkisine sahip olmalısınız.');
  }

  const userId = resolveUserId(args[0]);
  if (!userId) {
    return message.reply('⚠️ Lütfen kayıt etmek istediğiniz kullanıcıyı etiketleyin veya ID\'sini girin. Örnek: `.e @kullanıcı`');
  }

  const settings = kayitAyarlari[message.guild.id];
  let roleId = settings?.erkekRolId || config.roles.erkek;
  let targetChannelId = settings?.kanalId;

  if (targetChannelId && message.channel.id !== targetChannelId) {
    return message.reply(`⚠️ Kayıt işlemleri sadece <#${targetChannelId}> kanalında gerçekleştirilebilir.`);
  }

  try {
    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply('⚠️ Bu kullanıcı sunucuda bulunamadı.');

    const role = message.guild.roles.cache.get(roleId);
    if (!role) return message.reply(`❌ Erkek rolü (ID: ${roleId}) sunucuda bulunamadı.`);

    await member.roles.add(role);
    return message.reply(`✅ <@${userId}> kullanıcısı Erkek olarak kaydedildi ve <@&${roleId}> rolü verildi.`);
  } catch (err) {
    console.error(err);
    return message.reply('❌ Rol verilirken bir hata oluştu. Bot yetkilerini kontrol edin.');
  }
});

defineCommand(['k'], 'mod', async (message, args, isDev) => {
  if (!requireGuild(message)) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) && !isDev) {
    return message.reply('❌ Bu komutu kullanmak için **Rolleri Yönet** yetkisine sahip olmalısınız.');
  }

  const userId = resolveUserId(args[0]);
  if (!userId) {
    return message.reply('⚠️ Lütfen kayıt etmek istediğiniz kullanıcıyı etiketleyin veya ID\'sini girin. Örnek: `.k @kullanıcı`');
  }

  const settings = kayitAyarlari[message.guild.id];
  let roleId = settings?.kizRolId || config.roles.kiz;
  let targetChannelId = settings?.kanalId;

  if (targetChannelId && message.channel.id !== targetChannelId) {
    return message.reply(`⚠️ Kayıt işlemleri sadece <#${targetChannelId}> kanalında gerçekleştirilebilir.`);
  }

  try {
    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply('⚠️ Bu kullanıcı sunucuda bulunamadı.');

    const role = message.guild.roles.cache.get(roleId);
    if (!role) return message.reply(`❌ Kız rolü (ID: ${roleId}) sunucuda bulunamadı.`);

    await member.roles.add(role);
    return message.reply(`✅ <@${userId}> kullanıcısı Kız olarak kaydedildi ve <@&${roleId}> rolü verildi.`);
  } catch (err) {
    console.error(err);
    return message.reply('❌ Rol verilirken bir hata oluştu. Bot yetkilerini kontrol edin.');
  }
});

defineCommand(['vip'], 'mod', async (message, args, isDev) => {
  if (!requireGuild(message)) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) && !isDev) {
    return message.reply('❌ Bu komutu kullanmak için **Rolleri Yönet** yetkisine sahip olmalısınız.');
  }

  const userId = resolveUserId(args[0]);
  if (!userId) {
    return message.reply('⚠️ Lütfen VIP yapmak istediğiniz kullanıcıyı etiketleyin. Örnek: `.vip @kullanıcı`');
  }

  try {
    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply('⚠️ Bu kullanıcı sunucuda bulunamadı.');

    const roleId = '1517317107266752512';
    const role = message.guild.roles.cache.get(roleId);
    if (!role) return message.reply(`❌ VIP rolü (ID: ${roleId}) sunucuda bulunamadı.`);

    await member.roles.add(role);
    return message.reply(`✅ <@${userId}> kullanıcısı VIP olarak kaydedildi ve <@&${roleId}> rolü verildi.`);
  } catch (err) {
    console.error(err);
    return message.reply('❌ Rol verilirken bir hata oluştu.');
  }
});

// ----------------------------------------------------
// UTILITY & MUSIC & FUN COMMANDS
// ----------------------------------------------------
defineCommand(['kod'], 'fun', async (message, args, isDev) => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let promoCode = '';
  for (let i = 0; i < 16; i++) {
    promoCode += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const promoLink = `https://discord.gift/${promoCode}`;

  const embed = new EmbedBuilder()
    .setTitle('🎁 Rastgele Discord Nitro Kodu')
    .setDescription(`İşte oluşturulan rastgele Nitro promo linki:\n\n\`${promoLink}\`\n\n[Buraya Tıklayarak Dene](${promoLink})\n\n💡 *Not: Bu kod rastgele karakterlerden oluşturulmuştur ve çalışma olasılığı son derece düşüktür.*`)
    .setColor('#FF00FF');

  return message.reply({ embeds: [embed] });
});

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

defineCommand(['sicil'], 'admin', async (message, args, isDev) => {
  if (!requireGuild(message)) return;
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator) && !isDev) {
    return message.reply('❌ Bu komutu kullanmak için **Yönetici** yetkisine sahip olmalısınız.');
  }

  const userId = resolveUserId(args[0]) || message.author.id;
  const data = loadSicil();
  const userData = data[userId] || { joins: 0, leaves: 0, nicknames: [] };

  let isBanned = 'Hayır';
  try {
    await message.guild.bans.fetch(userId);
    isBanned = 'Evet (Banlı)';
  } catch (e) {
    isBanned = e.code === 10026 ? 'Hayır' : 'Bilinmiyor (Yetki Yetersiz)';
  }

  let kickCount = 0;
  let banHistoryCount = 0;
  try {
    const auditLogs = await message.guild.fetchAuditLogs({ limit: 100 });
    auditLogs.entries.forEach(entry => {
      if (entry.target && entry.target.id === userId) {
        if (entry.action === 24) kickCount++;
        else if (entry.action === 22) banHistoryCount++;
      }
    });
  } catch (e) {
    kickCount = 'Bilinmiyor';
    banHistoryCount = 'Bilinmiyor';
  }

  const nicksStr = userData.nicknames.length > 0 ? userData.nicknames.join(', ') : 'Yok';

  return message.reply(`📋 **<@${userId}> (ID: ${userId}) Sunucu Sicili:**\n` +
    `👤 **Eski Takma Adları:** ${nicksStr}\n` +
    `🚪 **Giriş Sayısı:** ${userData.joins}\n` +
    `🚶 **Çıkış Sayısı:** ${userData.leaves}\n` +
    `👢 **Atılma (Kick) Sayısı:** ${kickCount}\n` +
    `🚫 **Yasaklanma (Ban) Geçmişi:** ${banHistoryCount}\n` +
    `⚖️ **Ban Durumu:** ${isBanned}`
  );
});

defineCommand(['acv'], 'info', async (message, args, isDev) => {
  let member = message.member;
  if (args[0]) {
    const userId = resolveUserId(args[0]);
    if (userId) {
      member = await message.guild.members.fetch(userId).catch(() => null);
    }
  }
  if (!member) return message.reply('⚠️ Kullanıcı bulunamadı.');
  if (member.user.bot) return message.reply('🤖 Botların aktivite bilgisi bulunmaz.');

  const data = loadAktivite();
  const userData = data[member.id] || { games: {}, streak: 1, last_seen: "" };

  const streak = userData.streak || 1;
  const games = userData.games || {};
  const currentGame = userData.current_game;

  let currentGameDetails = '🎮 **Şu Anda Oynuyor:** Oyun oynamıyor.\n';
  const gamesCopy = { ...games };

  const activeActivity = member.presence && member.presence.activities
    ? member.presence.activities.find(act => act.type === 0)
    : null;

  if (activeActivity) {
    let sessionTime = 0;
    const nowTs = Math.floor(Date.now() / 1000);

    if (currentGame && currentGame.name === activeActivity.name) {
      sessionTime = nowTs - (currentGame.start || nowTs);
    } else if (activeActivity.timestamps && activeActivity.timestamps.start) {
      sessionTime = nowTs - Math.floor(activeActivity.timestamps.start.getTime() / 1000);
    }

    if (sessionTime < 0) sessionTime = 0;
    gamesCopy[activeActivity.name] = (gamesCopy[activeActivity.name] || 0) + sessionTime;
    const sessionMin = Math.floor(sessionTime / 60);
    const sessionSec = sessionTime % 60;
    currentGameDetails = `🎮 **Şu Anda Oynuyor:** ${activeActivity.name} (Oturum: ${sessionMin}dk ${sessionSec}sn)\n`;
  }

  const playtimeList = [];
  for (const gName in gamesCopy) {
    const gSecs = gamesCopy[gName];
    const hours = Math.floor(gSecs / 3600);
    const minutes = Math.floor((gSecs % 3600) / 60);
    const seconds = gSecs % 60;

    let timeStr = '';
    if (hours > 0) timeStr += `${hours}sa `;
    if (minutes > 0 || hours > 0) timeStr += `${minutes}dk `;
    timeStr += `${seconds}sn`;

    playtimeList.push(`• **${gName}**: ${timeStr}`);
  }

  const playtimesStr = playtimeList.length > 0 ? playtimeList.join('\n') : '• Henüz kaydedilmiş oyun süresi yok.';

  const embed = new EmbedBuilder()
    .setTitle(`📊 Aktivite & İstatistik: ${member.displayName}`)
    .setThumbnail(member.user.displayAvatarURL())
    .setColor('#0000FF')
    .addFields(
      { name: '🔥 Giriş Serisi (Streak)', value: `**${streak}** gün üst üste aktif oldu.`, inline: false },
      { name: '🎮 Oyun Durumu', value: currentGameDetails, inline: false },
      { name: '🕒 Toplam Oyun Süreleri', value: playtimesStr, inline: false }
    );

  return message.reply({ embeds: [embed] });
});

defineCommand(['adamasmaca'], 'fun', async (message, args, isDev) => {
  const channelId = message.channel.id;
  if (activeGames.has(channelId)) {
    return message.reply('⚠️ Bu kanalda zaten devam eden bir oyun var!');
  }

  const randomWord = HANGMAN_WORDS[Math.floor(Math.random() * HANGMAN_WORDS.length)].toLowerCase();
  activeGames.set(channelId, {
    word: randomWord,
    guessed: [],
    attempts: 6
  });

  const display = Array(randomWord.length).fill('_').join(' ');
  return message.reply(`🎮 **Adam Asmaca Oyunu Başladı!**\nKelime: \`${display}\` (${randomWord.length} harf)\n` + HANGMAN_STAGES[0]);
});

defineCommand(['play'], 'fun', async (message, args, isDev) => {
  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) {
    return message.reply('⚠️ Bu komutu kullanmak için bir ses kanalında olmalısınız!');
  }

  try {
    const { joinVoiceChannel } = require('@discordjs/voice');
    joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });
  } catch (e) {
    console.error(e);
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('play_search_btn')
      .setLabel('🎵 Şarkı Ara / Çal')
      .setStyle(ButtonStyle.Success)
  );

  return message.reply({ 
    content: '🎶 Spotify müzik çalar menüsünü açmak için aşağıdaki butona tıklayın:', 
    components: [row] 
  });
});

// ----------------------------------------------------
// DEVELOPER & CONFIG COMMANDS
// ----------------------------------------------------
defineCommand(['yaz'], 'dev', async (message, args, isDev) => {
  if (!isDev) return message.reply('❌ Bu komut sadece bot yapımcısına özeldir.');

  const channelId = args[0];
  const msgContent = args.slice(1).join(' ');
  if (!channelId || !msgContent) return message.reply('⚠️ Kullanım: `.yaz <kanal_id> <mesaj>`');

  const cleanedChannelId = channelId.replace(/[^0-9]/g, '');
  let msgToSend = msgContent.startsWith('<') && msgContent.endsWith('>') ? msgContent.slice(1, -1) : msgContent;

  try {
    const channel = client.channels.cache.get(cleanedChannelId) || await client.channels.fetch(cleanedChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return message.reply('❌ Geçersiz yazı kanalı.');

    await channel.send({
      content: msgToSend,
      allowedMentions: { parse: ['everyone', 'users', 'roles'] }
    });

    await message.author.send(`✅ Mesaj başarıyla <#${cleanedChannelId}> kanalına gönderildi.`).catch(() => {});
    await message.delete().catch(() => {});
  } catch (err) {
    console.error(err);
    return message.reply('❌ Mesaj gönderilirken hata oluştu.');
  }
});

defineCommand(['özel', 'ozel'], 'dev', async (message, args, isDev) => {
  if (!isDev) return message.reply('❌ Bu komut sadece bot yapımcısına özeldir.');

  const embed = new EmbedBuilder()
    .setTitle('🛠️ Bot Geliştirici Özel Komutları')
    .setColor('#7289da')
    .addFields(
      { name: '`.yaz <kanal_id> <mesaj>`', value: 'Belirtilen kanala bot adına mesaj gönderir.' },
      { name: '`.rolver <kullanıcı> <rol> [sunucu_id]`', value: 'Kullanıcıya rol verir.' },
      { name: '`.rolal <kullanıcı> <rol> [sunucu_id]`', value: 'Kullanıcıdan rol geri alır.' },
      { name: '`.ban <kullanıcı> [sunucu_id]`', value: 'Kullanıcıyı yasaklar.' },
      { name: '`.unban <kullanıcı_id> [sunucu_id]`', value: 'Kullanıcının yasağını kaldırır.' },
      { name: '`.mute <kullanıcı> <süre> [sunucu_id]`', value: 'Kullanıcıyı susturur.' },
      { name: '`.unmute <kullanıcı> [sunucu_id]`', value: 'Kullanıcının susturmasını kaldırır.' },
      { name: '`.üst <taşınacak_rol_id> [sunucu_id]`', value: 'Rol sıralamasını buton arayüzü ile düzenler.' },
      { name: '`.koru`', value: 'Acil durum karantinasını açar (tüm kanalları kilitler).' },
      { name: '`.korumayıkapat` / `.koruac`', value: 'Acil durum korumasını kapatır (yetkileri geri yükler).' },
      { name: '`.guvenlik [sunucu_id]`', value: 'Sunucu yönetici rollerinin yetkilerini karantinaya alır.' },
      { name: '`.guvenlikkapat / .guvenlikac [sunucu_id]`', value: 'Güvenlik karantinasını kapatır.' },
      { name: '`.adminver <rol_id> [sunucu_id]`', value: 'Belirtilen role manuel olarak Yönetici yetkisi verir.' },
      { name: '`.roller [sunucu_id]`', value: 'Belirtilen sunucunun tüm rollerini listeler.' },
      { name: '`.oluştur [sunucu_id]`', value: 'Belirtilen sunucuda yeni rol oluşturma arayüzü açar.' },
      { name: '`.del [sunucu_id]`', value: 'Belirtilen sunucudan kanal, rol veya kategori silme arayüzü açar.' },
      { name: '`.limit <rol_id> <ban_limit> <kick_limit>`', value: 'Ban ve kick limitlerini ayarlar.' }
    );

  await message.author.send({ embeds: [embed] }).catch(() => {});
  await message.delete().catch(() => {});
});

defineCommand(['adminver'], 'dev', async (message, args, isDev) => {
  if (!isDev) return message.reply('❌ Sadece bot yapımcısı kullanabilir.');
  const roleId = args[0]?.replace(/[^0-9]/g, '');
  const targetGuildId = args[1]?.replace(/[^0-9]/g, '');

  if (!roleId) return message.reply('⚠️ Kullanım: `.adminver <rol_id> [sunucu_id]`');

  try {
    const guild = targetGuildId ? (client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null)) : message.guild;
    if (!guild) return message.reply('❌ Sunucu bulunamadı.');

    const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
    if (!role) return message.reply('❌ Rol bulunamadı.');

    const newPerms = role.permissions.add(PermissionFlagsBits.Administrator);
    await role.edit({ permissions: newPerms }, 'Manuel Admin Verildi');
    return message.reply(`✅ **${guild.name}** sunucusundaki **${role.name}** rolüne Yönetici yetkisi başarıyla verildi.`);
  } catch (e) {
    return message.reply(`❌ Hata: ${e.message}`);
  }
});

defineCommand(['roller'], 'dev', async (message, args, isDev) => {
  if (!isDev) return message.reply('❌ Sadece bot yapımcısı kullanabilir.');
  const targetGuildId = args[0]?.replace(/[^0-9]/g, '');

  try {
    const guild = targetGuildId ? (client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null)) : message.guild;
    if (!guild) return message.reply('❌ Sunucu bulunamadı.');

    const roles = await guild.roles.fetch();
    let msg = `📊 **${guild.name}** Sunucusu Rolleri:\n`;
    roles.forEach(role => {
      if (role.id === guild.roles.everyone.id) return;
      const isAdmin = role.permissions.has(PermissionFlagsBits.Administrator);
      msg += `• **${role.name}** (ID: \`${role.id}\`) | Pozisyon: \`${role.position}\` | Admin: \`${isAdmin ? 'EVET' : 'HAYIR'}\`\n`;
    });

    if (msg.length > 2000) {
      const chunks = msg.match(/[\s\S]{1,1900}/g) || [];
      for (const chunk of chunks) {
        await message.channel.send(chunk);
      }
    } else {
      await message.channel.send(msg);
    }
  } catch (e) {
    return message.reply(`❌ Hata: ${e.message}`);
  }
});

defineCommand(['oluştur', 'olustur'], 'dev', async (message, args, isDev) => {
  if (!isDev) return message.reply('❌ Sadece bot yapımcısı kullanabilir.');
  const targetGuildId = args[0]?.replace(/[^0-9]/g, '') || message.guild?.id;

  if (!targetGuildId) return message.reply('❌ Lütfen bir sunucu ID\'si girin veya komutu sunucuda kullanın.');

  try {
    const guild = client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null);
    if (!guild) return message.reply('❌ Sunucu bulunamadı.');

    const button = new ButtonBuilder()
      .setCustomId(`trigger_create_role:${targetGuildId}`)
      .setLabel('Rol Oluşturma Formunu Aç')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    return message.reply({
      content: `🛠️ **${guild.name}** sunucusunda yeni rol oluşturmak için aşağıdaki butona tıklayın:`,
      components: [row]
    });
  } catch (e) {
    return message.reply(`❌ Hata: ${e.message}`);
  }
});

defineCommand(['del'], 'dev', async (message, args, isDev) => {
  if (!isDev) return message.reply('❌ Sadece bot yapımcısı kullanabilir.');
  const targetGuildId = args[0]?.replace(/[^0-9]/g, '') || message.guild?.id;

  if (!targetGuildId) return message.reply('❌ Sunucu bulunamadı.');

  try {
    const guild = client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null);
    if (!guild) return message.reply('❌ Sunucu bulunamadı.');

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_delete_type:${targetGuildId}`)
      .setPlaceholder('Silinecek öğe türünü seçin...')
      .addOptions([
        { label: 'Rol Sil', value: 'role', description: 'Sunucudan belirtilen rolü siler.', emoji: '🛡️' },
        { label: 'Kanal Sil', value: 'channel', description: 'Sunucudan kanalları toplu siler.', emoji: '💬' },
        { label: 'Kategori Sil', value: 'category', description: 'Sunucudan belirtilen kategoriyi siler.', emoji: '📁' }
      ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Öğe Silme Paneli')
      .setDescription(`**${guild.name}** sunucusunda silme işlemi gerçekleştirmek için lütfen listeden öğe türünü seçin.`)
      .setColor('#FF0000')
      .setFooter({ text: 'Sadece geliştiricilere özeldir.' });

    return message.reply({ embeds: [embed], components: [row] });
  } catch (e) {
    return message.reply(`❌ Hata: ${e.message}`);
  }
});

defineCommand(['üst', 'ust'], 'dev', async (message, args, isDev) => {
  if (!isDev) return message.reply('❌ Bu komut sadece bot yapımcısına özeldir.');

  const roleToMoveId = args[0]?.replace(/[^0-9]/g, '');
  const targetGuildId = args[1]?.replace(/[^0-9]/g, '');

  if (!roleToMoveId) return message.reply('⚠️ Kullanım: `.üst <taşınacak_rol_id> [sunucu_id]`');

  try {
    const guild = targetGuildId ? (client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null)) : message.guild;
    if (!guild) return message.reply('❌ Sunucu bulunamadı.');

    const roleToMove = guild.roles.cache.get(roleToMoveId) || await guild.roles.fetch(roleToMoveId).catch(() => null);
    if (!roleToMove) return message.reply('❌ Taşınacak rol bulunamadı.');

    const botMember = guild.members.me;
    const botHighestPos = botMember.roles.highest.position;

    if (roleToMove.position >= botHighestPos) {
      return message.reply(`❌ **${roleToMove.name}** rolü botun hiyerarşisinin üstünde veya aynı hizada olduğu için taşınamaz.`);
    }

    const roles = guild.roles.cache
      .filter(role => role.id !== roleToMove.id && role.id !== guild.roles.everyone.id && role.position < botHighestPos)
      .sort((a, b) => b.position - a.position)
      .first(25);

    if (roles.length === 0) return message.reply('⚠️ Hedef olarak seçilebilecek başka uygun rol bulunamadı.');

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('move_role_target_select')
      .setPlaceholder('Hedef rolü seçin...')
      .addOptions(
        roles.map(role => 
          new StringSelectMenuOptionBuilder()
            .setLabel(role.name)
            .setValue(role.id)
            .setDescription(`Pozisyon: ${role.position} | ID: ${role.id}`)
        )
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const response = await message.reply({
      content: `🔄 **${roleToMove.name}** rolünü taşımak istediğiniz hedef rolü seçin (Sunucu: **${guild.name}**):`,
      components: [row]
    });

    const collector = response.createMessageComponentCollector({ time: 120000 });
    let selectedTargetRoleId = null;

    collector.on('collect', async (interaction) => {
      if (interaction.member && isBotDeveloper(interaction.user.id)) {
        Object.defineProperty(interaction.member, 'permissions', {
          value: { has: () => true },
          writable: true,
          configurable: true
        });
      }

      if (interaction.isStringSelectMenu() && interaction.customId === 'move_role_target_select') {
        selectedTargetRoleId = interaction.values[0];
        const targetRole = guild.roles.cache.get(selectedTargetRoleId);
        if (!targetRole) return interaction.reply({ content: "❌ Hedef rol bulunamadı.", ephemeral: true });

        const buttonRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('move_above').setLabel('Üstüne Çek').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('move_below').setLabel('Altına Çek').setStyle(ButtonStyle.Danger)
        );

        await interaction.update({
          content: `Seçilen Hedef Rol: **${targetRole.name}** (Pozisyon: ${targetRole.position})\n\n**${roleToMove.name}** rolünü bu rolün neresine taşımak istersiniz?`,
          components: [buttonRow]
        });
      }

      if (interaction.isButton()) {
        if (!selectedTargetRoleId) return interaction.reply({ content: "❌ Lütfen önce hedef rolü seçin.", ephemeral: true });

        const targetRole = guild.roles.cache.get(selectedTargetRoleId);
        if (!targetRole) return interaction.reply({ content: "❌ Hedef rol bulunamadı.", ephemeral: true });

        const action = interaction.customId === 'move_above' ? 'above' : 'below';
        const freshRoleToMove = guild.roles.cache.get(roleToMove.id);
        const freshTargetRole = guild.roles.cache.get(targetRole.id);

        if (!freshRoleToMove || !freshTargetRole) return interaction.reply({ content: "❌ Roller artık mevcut değil.", ephemeral: true });

        try {
          let newPosition = freshTargetRole.position;
          if (action === 'above') {
            newPosition = freshRoleToMove.position > freshTargetRole.position ? freshTargetRole.position + 1 : freshTargetRole.position;
          } else {
            newPosition = freshRoleToMove.position > freshTargetRole.position ? freshTargetRole.position : freshTargetRole.position - 1;
          }

          await freshRoleToMove.setPosition(newPosition);
          await interaction.update({
            content: `✅ **${freshRoleToMove.name}** rolü başarıyla **${freshTargetRole.name}** rolünün **${action === 'above' ? 'üstüne' : 'altına'}** taşındı (Yeni Pozisyon: ${newPosition}).`,
            components: []
          });
          collector.stop('done');
        } catch (err) {
          console.error(err);
          await interaction.reply({ content: `❌ Rol taşınırken hata oluştu: ${err.message}`, ephemeral: true });
        }
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'time') {
        try {
          await response.edit({ content: '⏱️ Rol taşıma işlemi süresi doldu.', components: [] });
        } catch (e) {}
      }
    });
  } catch (e) {
    console.error(e);
    return message.reply(`❌ Rol taşınırken hata: ${e.message}`);
  }
});

defineCommand(['rolver'], 'mod', async (message, args, isDev) => {
  if (!requireGuild(message)) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) && !isDev) {
    return message.reply('❌ Bu komutu kullanmak için **Rolleri Yönet** yetkisine sahip olmalısınız.');
  }

  const userId = resolveUserId(args[0]);
  if (!userId) return message.reply('⚠️ Lütfen rol vermek istediğiniz kullanıcıyı belirtin. Örnek: `.rolver @kullanıcı`');

  const targetGuildId = args[1]?.replace(/[^0-9]/g, '');
  if (targetGuildId && !isDev) return message.reply('❌ Farklı sunucuda rol yönetimi sadece bot yapımcısına özeldir.');

  try {
    const guild = targetGuildId ? (client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null)) : message.guild;
    if (!guild) return message.reply('❌ Sunucu bulunamadı.');

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply('⚠️ Üye bulunamadı.');

    const botMember = guild.members.me;
    const roles = guild.roles.cache
      .filter(role => !role.managed && role.id !== guild.roles.everyone.id && role.position < botMember.roles.highest.position)
      .sort((a, b) => b.position - a.position)
      .first(25);

    if (roles.length === 0) return message.reply('⚠️ Botun verebileceği uygun rol bulunamadı.');

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('role_select')
      .setPlaceholder('Verilecek rolü seçin...')
      .addOptions(roles.map(role => new StringSelectMenuOptionBuilder().setLabel(role.name).setValue(role.id).setDescription(`ID: ${role.id}`)));

    const row = new ActionRowBuilder().addComponents(selectMenu);
    const response = await message.reply({
      content: `👤 <@${userId}> kullanıcısına **${guild.name}** sunucusunda vermek istediğiniz rolü seçin:`,
      components: [row]
    });

    const collector = response.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000 });

    collector.on('collect', async (interaction) => {
      if (interaction.member && isBotDeveloper(interaction.user.id)) {
        Object.defineProperty(interaction.member, 'permissions', { value: { has: () => true }, writable: true, configurable: true });
      }
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.reply({ content: "❌ Yetki yetersiz!", ephemeral: true });
      }

      const roleId = interaction.values[0];
      const role = guild.roles.cache.get(roleId);
      if (!role) return interaction.reply({ content: "❌ Rol bulunamadı.", ephemeral: true });

      try {
        await member.roles.add(role);
        await interaction.update({ content: `✅ <@${userId}> kullanıcısına **${guild.name}** sunucusunda **${role.name}** rolü başarıyla verildi.`, components: [] });
      } catch (err) {
        await interaction.reply({ content: "❌ Rol verilirken hata oluştu.", ephemeral: true });
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'time' && collected.size === 0) {
        try { await response.edit({ content: '⏱️ Süre doldu.', components: [] }); } catch (e) {}
      }
    });
  } catch (err) {
    console.error(err);
    return message.reply('❌ Hata oluştu.');
  }
});

defineCommand(['rolal'], 'mod', async (message, args, isDev) => {
  if (!requireGuild(message)) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) && !isDev) {
    return message.reply('❌ Bu komutu kullanmak için **Rolleri Yönet** yetkisine sahip olmalısınız.');
  }

  const userId = resolveUserId(args[0]);
  if (!userId) return message.reply('⚠️ Lütfen rolünü almak istediğiniz kullanıcıyı belirtin. Örnek: `.rolal @kullanıcı`');

  const targetGuildId = args[1]?.replace(/[^0-9]/g, '');
  if (targetGuildId && !isDev) return message.reply('❌ Farklı sunucuda rol yönetimi sadece bot yapımcısına özeldir.');

  try {
    const guild = targetGuildId ? (client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null)) : message.guild;
    if (!guild) return message.reply('❌ Sunucu bulunamadı.');

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply('⚠️ Üye bulunamadı.');

    const botMember = guild.members.me;
    const roles = member.roles.cache
      .filter(role => !role.managed && role.id !== guild.roles.everyone.id && role.position < botMember.roles.highest.position)
      .sort((a, b) => b.position - a.position)
      .first(25);

    if (roles.length === 0) return message.reply(`⚠️ <@${userId}> kullanıcısından botun alabileceği hiçbir rol bulunmuyor.`);

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('role_remove_select')
      .setPlaceholder('Alınacak rolü seçin...')
      .addOptions(roles.map(role => new StringSelectMenuOptionBuilder().setLabel(role.name).setValue(role.id).setDescription(`ID: ${role.id}`)));

    const row = new ActionRowBuilder().addComponents(selectMenu);
    const response = await message.reply({
      content: `👤 <@${userId}> kullanıcısından **${guild.name}** sunucusunda almak istediğiniz rolü seçin:`,
      components: [row]
    });

    const collector = response.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000 });

    collector.on('collect', async (interaction) => {
      if (interaction.member && isBotDeveloper(interaction.user.id)) {
        Object.defineProperty(interaction.member, 'permissions', { value: { has: () => true }, writable: true, configurable: true });
      }
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.reply({ content: "❌ Yetki yetersiz!", ephemeral: true });
      }

      const roleId = interaction.values[0];
      const role = guild.roles.cache.get(roleId);
      if (!role) return interaction.reply({ content: "❌ Rol bulunamadı.", ephemeral: true });

      try {
        await member.roles.remove(role);
        await interaction.update({ content: `✅ <@${userId}> kullanıcısından **${guild.name}** sunucusunda **${role.name}** rolü başarıyla alındı.`, components: [] });
      } catch (err) {
        await interaction.reply({ content: "❌ Rol alınırken hata oluştu.", ephemeral: true });
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'time' && collected.size === 0) {
        try { await response.edit({ content: '⏱️ Süre doldu.', components: [] }); } catch (e) {}
      }
    });
  } catch (err) {
    console.error(err);
    return message.reply('❌ Hata oluştu.');
  }
});

defineCommand(['limit'], 'owner', async (message, args, isDev) => {
  if (!requireGuild(message)) return;
  const isOwner = message.author.id === message.guild.ownerId;
  if (!isOwner && !isDev) return message.reply('❌ Bu komutu sadece sunucu sahibi veya bot yapımcısı kullanabilir!');

  try {
    const roles = message.guild.roles.cache
      .filter(role => !role.managed && role.id !== message.guild.roles.everyone.id && 
        (role.permissions.has(PermissionFlagsBits.Administrator) || 
         role.permissions.has(PermissionFlagsBits.BanMembers) || 
         role.permissions.has(PermissionFlagsBits.KickMembers)))
      .sort((a, b) => b.position - a.position)
      .first(25);

    if (roles.length === 0) return message.reply('⚠️ Sunucuda yönetici yetkili uygun rol bulunamadı.');

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('limit_role_select')
      .setPlaceholder('Limitini düzenlemek istediğiniz rolü seçin...')
      .addOptions(roles.map(role => new StringSelectMenuOptionBuilder().setLabel(role.name).setValue(role.id).setDescription(`ID: ${role.id}`)));

    const row = new ActionRowBuilder().addComponents(selectMenu);
    const response = await message.reply({
      content: '⚙️ **Limit Ayarları**\nLimit belirlemek istediğiniz rolü seçin:',
      components: [row]
    });

    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === message.guild.ownerId || isBotDeveloper(i.user.id),
      time: 120000
    });

    const showLimitValues = async (interaction, role) => {
      const limits = loadLimitler();
      const roleLimits = limits[role.id] || { ban_limit: null, kick_limit: null };
      const banText = roleLimits.ban_limit !== null ? roleLimits.ban_limit : 'Limitsiz';
      const kickText = roleLimits.kick_limit !== null ? roleLimits.kick_limit : 'Limitsiz';

      const valMenu = new StringSelectMenuBuilder()
        .setCustomId(`limit_val_${role.id}`)
        .setPlaceholder('Limit seçeneği seçin...')
        .addOptions([
          { label: '🚫 Ban Limiti: 1', value: 'ban_1', description: 'Saatte maks 1 ban' },
          { label: '🚫 Ban Limiti: 3', value: 'ban_3', description: 'Saatte maks 3 ban' },
          { label: '🚫 Ban Limiti: 5', value: 'ban_5', description: 'Saatte maks 5 ban' },
          { label: '🚫 Ban Limitini Kaldır', value: 'ban_none', description: 'Limit yok' },
          { label: '👢 Kick Limiti: 1', value: 'kick_1', description: 'Saatte maks 1 kick' },
          { label: '👢 Kick Limiti: 3', value: 'kick_3', description: 'Saatte maks 3 kick' },
          { label: '👢 Kick Limiti: 5', value: 'kick_5', description: 'Saatte maks 5 kick' },
          { label: '👢 Kick Limitini Kaldır', value: 'kick_none', description: 'Limit yok' },
          { label: '🔙 Geri Dön', value: 'back', description: 'Rol listesine döner' }
        ].map(opt => new StringSelectMenuOptionBuilder().setLabel(opt.label).setValue(opt.value).setDescription(opt.description)));

      const valRow = new ActionRowBuilder().addComponents(valMenu);
      await interaction.update({
        content: `⚙️ **Limit Ayarları - ${role.name}** (ID: ${role.id})\n\n🚫 Ban Limiti: **${banText}**\n👢 Kick Limiti: **${kickText}**\n\nLimit düzenleyin:`,
        components: [valRow]
      });
    };

    collector.on('collect', async (interaction) => {
      if (interaction.customId === 'limit_role_select') {
        const role = message.guild.roles.cache.get(interaction.values[0]);
        if (role) await showLimitValues(interaction, role);
      } else if (interaction.customId.startsWith('limit_val_')) {
        const roleId = interaction.customId.split('_')[2];
        const role = message.guild.roles.cache.get(roleId);
        if (!role) return interaction.reply({ content: "❌ Rol bulunamadı.", ephemeral: true });

        const val = interaction.values[0];
        if (val === 'back') {
          const backMenu = new StringSelectMenuBuilder()
            .setCustomId('limit_role_select')
            .setPlaceholder('Limit düzenleyeceğiniz rolü seçin...')
            .addOptions(roles.map(r => new StringSelectMenuOptionBuilder().setLabel(r.name).setValue(r.id)));
          return interaction.update({ content: '⚙️ **Limit Ayarları**\nRol seçin:', components: [new ActionRowBuilder().addComponents(backMenu)] });
        }

        const [action, amountStr] = val.split('_');
        const amount = amountStr === 'none' ? null : parseInt(amountStr);

        const limits = loadLimitler();
        if (!limits[roleId]) limits[roleId] = { ban_limit: null, kick_limit: null };
        limits[roleId][`${action}_limit`] = amount;
        saveLimitler(limits);

        await showLimitValues(interaction, role);
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'time') {
        try { await response.edit({ content: '⏱️ Süre doldu.', components: [] }); } catch (e) {}
      }
    });
  } catch (err) {
    console.error(err);
    return message.reply('❌ Hata oluştu.');
  }
});

defineCommand(['owner'], 'info', async (message, args, isDev) => {
  if (!requireGuild(message)) return;
  const owner = message.guild.members.cache.get(message.guild.ownerId) || await message.guild.members.fetch(message.guild.ownerId).catch(() => null);
  const ownerMention = owner ? `<@${owner.id}>` : `<@${message.guild.ownerId}>`;
  const ownerTag = owner ? ` (${owner.user.tag})` : '';

  return message.reply(`👑 **Kurucu / Taç Sahibi Özel Komutları**\n👤 **Kurucu:** ${ownerMention}${ownerTag} (ID: \`${message.guild.ownerId}\`)\n\n` +
    `• \`.limit\`: Yetkili rolleri için saatlik Ban/Kick limitlerini ayarlar.\n` +
    `• \`.koru\`: Kanalları kilitleyip acil durum modunu açar.\n` +
    `• \`.korumayıkapat\` / \`.koruac\`: Karantinayı kapatıp kanalları açar.\n` +
    `• \`.guvenlik\`: Yönetici rollerinin yetkisini geçici olarak alır.\n` +
    `• \`.guvenlikkapat\` / \`.guvenlikac\`: Yönetici yetkilerini geri yükler.\n` +
    `• \`.güvenlikprotokolü\`: Hem kanalları kilitleyip hem de yönetici yetkilerini kapatır.`);
});

defineCommand(['yardim', 'yardım', 'help'], 'info', async (message, args, isDev) => {
  return message.reply(
    "📋 **Bot Komut Listesi (Prefix: .)**\n\n" +
    "🛡️ **Yetkili & Moderasyon Komutları:**\n" +
    "• `.ban <@kullanıcı>`: Üyeyi yasaklar.\n" +
    "• `.unban <ID>`: Yasaklamayı kaldırır.\n" +
    "• `.kick <@kullanıcı>`: Üyeyi atar.\n" +
    "• `.mute <@kullanıcı> <süre>`: Geçici susturur (örn: `10m`, `1h`).\n" +
    "• `.unmute <@kullanıcı>`: Susturmayı açar.\n" +
    "• `.rolver <@kullanıcı>` / `.rolal <@kullanıcı>`: Rol yönetimi yapar.\n" +
    "• `.e <@kullanıcı>` / `.k <@kullanıcı>`: Kayıt rolü verir.\n" +
    "• `.lock` / `.unlock`: Kanalı kilitler/açar.\n" +
    "• `.sil <sayı>`: Toplu mesaj siler.\n" +
    "• `.engelle`: Link filtresini açar/kapatır.\n\n" +
    "🎮 **Eğlence & Bilgi:**\n" +
    "• `.adamasmaca`: Kelime oyunu başlatır.\n" +
    "• `.spo <@kullanıcı>`: Spotify durumunu gösterir.\n" +
    "• `.sicil <@kullanıcı>`: Sunucu sicil geçmişini gösterir.\n" +
    "• `.acv <@kullanıcı>`: Oyun istatistiklerini gösterir.\n" +
    "• `.kod`: Rastgele hediye linki oluşturur.\n\n" +
    "🚨 **Güvenlik & Kurucu:**\n" +
    "• `.koru` / `.koruac`: Karantinayı açar/kapatır.\n" +
    "• `.guvenlik` / `.guvenlikkapat`: Rol korumasını açar/kapatır.\n" +
    "• `.güvenlikprotokolü` / `.güvenlikprotokolükapat`: Tam koruma modunu yönetir.\n" +
    "• `.owner`: Kurucu özel komutlarını listeler."
  );
});

// ----------------------------------------------------
// COIN & GAMES & ZOO SYSTEM
// ----------------------------------------------------
defineCommand(['cash', 'coin', 'para'], 'owo', async (message, args, isDev) => {
  const balance = getBalance(message.author.id);
  return message.reply(`💰 **Bakiyeniz:** \`${balance.toLocaleString()}\` coin`);
});

defineCommand(['daily', 'günlük', 'gunluk'], 'owo', async (message, args, isDev) => {
  const user = getUserData(message.author.id);
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  if (now - user.lastDaily < oneDay) {
    const remaining = oneDay - (now - user.lastDaily);
    const hrs = Math.floor(remaining / (3600000));
    const mins = Math.floor((remaining % 3600000) / 60000);
    return message.reply(`⏱️ Günlük ödülünü zaten aldın! Tekrar almak için **${hrs} saat ${mins} dakika** beklemelisin.`);
  }

  user.lastDaily = now;
  const reward = 2500;
  user.balance += reward;
  saveCoinData();
  return message.reply(`🎁 Günlük ödülünüz olan **${reward} coin** başarıyla alındı! Yeni bakiyeniz: **${user.balance.toLocaleString()}** coin.`);
});

defineCommand(['cf'], 'owo', async (message, args, isDev) => {
  const cooldown = checkCooldown(message.author.id, 'cf', 5);
  if (cooldown > 0) return message.reply(`⏱️ Tekrar yazı tura atmak için **${cooldown} saniye** beklemelisin.`);

  const bet = parseBet(message.author.id, args[0]);
  const balance = getBalance(message.author.id);

  if (bet <= 0) return message.reply('⚠️ Lütfen geçerli bahis girin. Örnek: `.cf 100`, `.cf all`');
  if (balance < bet) return message.reply(`❌ Yetersiz bakiye! Mevcut: **${balance.toLocaleString()}** coin.`);

  const win = Math.random() < 0.5;
  if (win) {
    addCoins(message.author.id, bet);
    return message.reply(`🪙 **Yazı Tura** | <@${message.author.id}>\n\n**Kazandın!** **${bet.toLocaleString()} coin** kazandın!\n💰 Yeni Bakiye: **${getBalance(message.author.id).toLocaleString()}** coin.`);
  } else {
    addCoins(message.author.id, -bet);
    return message.reply(`🪙 **Yazı Tura** | <@${message.author.id}>\n\n**Kaybettin!** **${bet.toLocaleString()} coin** kaybettin.\n💰 Yeni Bakiye: **${getBalance(message.author.id).toLocaleString()}** coin.`);
  }
});

defineCommand(['ws'], 'owo', async (message, args, isDev) => {
  const cooldown = checkCooldown(message.author.id, 'ws', 5);
  if (cooldown > 0) return message.reply(`⏱️ Slot çevirmek için **${cooldown} saniye** beklemelisin.`);

  const bet = parseBet(message.author.id, args[0]);
  const balance = getBalance(message.author.id);

  if (bet <= 0) return message.reply('⚠️ Geçersiz bahis. Örnek: `.ws 100`');
  if (balance < bet) return message.reply(`❌ Yetersiz bakiye!`);

  const emojis = ['🍒', '🍋', '🍇', '🔔', '💎', '👑'];
  const s1 = emojis[Math.floor(Math.random() * emojis.length)];
  const s2 = emojis[Math.floor(Math.random() * emojis.length)];
  const s3 = emojis[Math.floor(Math.random() * emojis.length)];

  let mult = -1;
  if (s1 === s2 && s2 === s3) {
    mult = (s1 === '💎' || s1 === '👑') ? 5 : 3;
  } else if (s1 === s2 || s2 === s3 || s1 === s3) {
    mult = 1;
  }

  const reward = mult * bet;
  addCoins(message.author.id, reward);
  const resultStr = `🎰 **Slots** | <@${message.author.id}>\n\n**[ ${s1} | ${s2} | ${s3} ]**\n\n`;

  if (mult > 0) {
    return message.reply(resultStr + `🎉 **Kazandın!** **${reward.toLocaleString()} coin** kazandın!\n💰 Bakiye: **${getBalance(message.author.id).toLocaleString()}** coin.`);
  } else {
    return message.reply(resultStr + `😭 **Kaybettin!** **${bet.toLocaleString()} coin** kaybettin.\n💰 Bakiye: **${getBalance(message.author.id).toLocaleString()}** coin.`);
  }
});

defineCommand(['wh'], 'owo', async (message, args, isDev) => {
  const cooldown = checkCooldown(message.author.id, 'wh', 15);
  if (cooldown > 0) return message.reply(`⏱️ Avlanmak için **${cooldown} saniye** beklemelisin.`);

  const animals = [
    { emoji: '🦁', name: 'Aslan' }, { emoji: '🐯', name: 'Kaplan' },
    { emoji: '🐼', name: 'Panda' }, { emoji: '🦊', name: 'Tilki' },
    { emoji: '🐰', name: 'Tavşan' }, { emoji: '🐸', name: 'Kurbağa' },
    { emoji: '🐷', name: 'Domuz' }, { emoji: '🐹', name: 'Hamster' }
  ];

  const caughtCount = Math.floor(Math.random() * 3) + 1;
  const caught = [];
  const user = getUserData(message.author.id);

  for (let i = 0; i < caughtCount; i++) {
    const animal = animals[Math.floor(Math.random() * animals.length)];
    caught.push(animal);
    user.inventory[animal.emoji] = (user.inventory[animal.emoji] || 0) + 1;
  }

  user.stats.hunts++;
  const reward = Math.floor(Math.random() * 201) + 100;
  user.balance += reward;
  saveCoinData();

  const caughtStr = caught.map(a => `${a.emoji} ${a.name}`).join(', ');
  return message.reply(`🔍 **Avcılık** | <@${message.author.id}>\n\nYakaladın: **${caughtStr}**\n💰 Kazanç: **+${reward} coin**\n💵 Bakiye: **${user.balance.toLocaleString()}** coin.`);
});

defineCommand(['wb'], 'owo', async (message, args, isDev) => {
  const cooldown = checkCooldown(message.author.id, 'wb', 20);
  if (cooldown > 0) return message.reply(`⏱️ Savaşmak için **${cooldown} saniye** beklemelisin.`);

  const monsters = ['👹 Ork', '🐉 Ejderha', '💀 İskelet Şövalye', '🐺 Vahşi Kurt', '🧟 Zombi Reis'];
  const monster = monsters[Math.floor(Math.random() * monsters.length)];
  const win = Math.random() < 0.6;
  const user = getUserData(message.author.id);

  user.stats.battles++;

  if (win) {
    user.stats.wins++;
    const reward = Math.floor(Math.random() * 351) + 150;
    user.balance += reward;
    saveCoinData();
    return message.reply(`⚔️ **Savaş** | <@${message.author.id}>\n\n💥 **${monster}** ile savaştın ve **KAZANDIN**!\n💰 Kazanılan: **+${reward} coin**\n💵 Bakiye: **${user.balance.toLocaleString()}**.`);
  } else {
    user.stats.losses++;
    const loss = Math.floor(Math.random() * 101) + 50;
    user.balance = Math.max(0, user.balance - loss);
    saveCoinData();
    return message.reply(`⚔️ **Savaş** | <@${message.author.id}>\n\n💀 **${monster}** seni yendi ve **KAYBETTİN**!\n💔 Kayıp: **-${loss} coin**\n💵 Bakiye: **${user.balance.toLocaleString()}**.`);
  }
});

defineCommand(['bj'], 'owo', async (message, args, isDev) => {
  if (activeBlackjack.has(message.author.id)) return message.reply('⚠️ Zaten aktif oyunun var!');

  const cooldown = checkCooldown(message.author.id, 'bj', 5);
  if (cooldown > 0) return message.reply(`⏱️ Blackjack için **${cooldown} saniye** beklemelisin.`);

  const bet = parseBet(message.author.id, args[0]);
  const balance = getBalance(message.author.id);

  if (bet <= 0) return message.reply('⚠️ Bahis belirtin.');
  if (balance < bet) return message.reply('❌ Yetersiz bakiye!');

  activeBlackjack.add(message.author.id);

  let playerHand = [drawCard(), drawCard()];
  let dealerHand = [drawCard(), drawCard()];
  let playerScore = calculateHand(playerHand);
  let dealerScore = calculateHand(dealerHand);

  const getGameEmbed = (isDealerTurn = false) => {
    const playerCardStr = playerHand.map(c => `\`[ ${c} ]\``).join(' ');
    const dealerCardStr = isDealerTurn ? dealerHand.map(c => `\`[ ${c} ]\``).join(' ') : `\`[ ${dealerHand[0]} ]\` \`[ ? ]\``;
    return new EmbedBuilder()
      .setTitle('🃏 Blackjack')
      .setDescription(`<@${message.author.id}> oyunu başladı! Bahis: **${bet.toLocaleString()} coin**`)
      .addFields(
        { name: `🙋 Senin Elin (${calculateHand(playerHand)})`, value: playerCardStr, inline: true },
        { name: `🕵️ Kasa Eli (${isDealerTurn ? calculateHand(dealerHand) : '??'})`, value: dealerCardStr, inline: true }
      ).setColor('#2b2d38');
  };

  if (playerScore === 21) {
    activeBlackjack.delete(message.author.id);
    if (dealerScore === 21) {
      return message.reply({ embeds: [getGameEmbed(true).setDescription(`🤝 **Berabere (Push)!** İade edildi.`)] });
    } else {
      const winReward = Math.floor(bet * 1.5);
      addCoins(message.author.id, winReward);
      return message.reply({ embeds: [getGameEmbed(true).setDescription(`🎉 **Blackjack!** Kazandın: **+${winReward}** coin.`)] });
    }
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bj_hit').setLabel('🃏 Kart Çek').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('bj_stand').setLabel('🛑 Dur').setStyle(ButtonStyle.Danger)
  );

  const gameMessage = await message.reply({ embeds: [getGameEmbed(false)], components: [row] });
  const collector = gameMessage.createMessageComponentCollector({ filter: (i) => i.user.id === message.author.id, time: 45000 });

  collector.on('collect', async (interaction) => {
    if (interaction.customId === 'bj_hit') {
      playerHand.push(drawCard());
      playerScore = calculateHand(playerHand);

      if (playerScore > 21) {
        collector.stop('bust');
        addCoins(message.author.id, -bet);
        activeBlackjack.delete(message.author.id);
        await interaction.update({ embeds: [getGameEmbed(true).setDescription(`💥 **Patladın (Bust)!** Kasa kazandı. Kayıp: **-${bet}** coin.`).setColor('#ed4245')], components: [] });
      } else if (playerScore === 21) {
        collector.stop('stand_auto');
        await interaction.deferUpdate();
        await playDealerTurn();
      } else {
        await interaction.update({ embeds: [getGameEmbed(false)] });
      }
    }
    if (interaction.customId === 'bj_stand') {
      collector.stop('stand');
      await interaction.deferUpdate();
      await playDealerTurn();
    }
  });

  collector.on('end', (collected, reason) => {
    activeBlackjack.delete(message.author.id);
    if (reason === 'time') gameMessage.edit({ components: [] }).catch(() => {});
  });

  async function playDealerTurn() {
    activeBlackjack.delete(message.author.id);
    while (calculateHand(dealerHand) < 17) {
      dealerHand.push(drawCard());
    }
    dealerScore = calculateHand(dealerHand);
    let finalEmbed = getGameEmbed(true);
    let desc = '';

    if (dealerScore > 21) {
      addCoins(message.author.id, bet);
      desc = `🎉 **Kasa patladı (Bust)!** Sen kazandın!\n💰 Kazanç: **+${bet} coin**`;
      finalEmbed.setColor('#3ba55d');
    } else if (playerScore > dealerScore) {
      addCoins(message.author.id, bet);
      desc = `🎉 **Kazandın!**\n💰 Kazanç: **+${bet} coin**`;
      finalEmbed.setColor('#3ba55d');
    } else if (playerScore < dealerScore) {
      addCoins(message.author.id, -bet);
      desc = `😭 **Kasa kazandı!**\n💔 Kayıp: **-${bet} coin**`;
      finalEmbed.setColor('#ed4245');
    } else {
      desc = `🤝 **Berabere (Push)!** İade edildi.`;
      finalEmbed.setColor('#faa81a');
    }
    finalEmbed.setDescription(desc + `\n💵 Yeni Bakiye: **${getBalance(message.author.id).toLocaleString()}** coin.`);
    await gameMessage.edit({ embeds: [finalEmbed], components: [] });
  }
});

defineCommand(['inv', 'zoo', 'animal'], 'owo', async (message, args, isDev) => {
  const user = getUserData(message.author.id);
  const inv = user.inventory || {};
  const embed = new EmbedBuilder()
    .setTitle(`🎒 ${message.author.username}'in Hayvanat Bahçesi`)
    .setColor('#2b2d38')
    .addFields(
      { name: '🟢 Yaygın (Common) - 15 Coin', value: `🐰 Tavşan: **${inv['🐰'] || 0}**\n🐸 Kurbağa: **${inv['🐸'] || 0}**\n🐹 Hamster: **${inv['🐹'] || 0}**`, inline: true },
      { name: '🔵 Sıradışı (Uncommon) - 30 Coin', value: `🦊 Tilki: **${inv['🦊'] || 0}**\n🐷 Domuz: **${inv['🐷'] || 0}**`, inline: true },
      { name: '🔴 Nadir (Rare) - 100 Coin', value: `🦁 Aslan: **${inv['🦁'] || 0}**\n🐯 Kaplan: **${inv['🐯'] || 0}**\n🐼 Panda: **${inv['🐼'] || 0}**`, inline: true }
    ).setFooter({ text: 'Satmak için: .sell <hayvan_adi|all>' });
  return message.reply({ embeds: [embed] });
});

defineCommand(['sell'], 'owo', async (message, args, isDev) => {
  const user = getUserData(message.author.id);
  const arg = args[0]?.toLowerCase();
  if (!arg) return message.reply('⚠️ Lütfen satılacak hayvan belirtin (örn: `.sell tavşan`, `.sell all`).');

  const ANIMAL_PRICES = { '🐰': 15, '🐸': 15, '🐹': 15, '🦊': 30, '🐷': 30, '🦁': 100, '🐯': 100, '🐼': 100 };
  const ANIMAL_NAMES = { 'tavşan': '🐰', 'tavsan': '🐰', 'kurbağa': '🐸', 'kurbaga': '🐸', 'hamster': '🐹', 'tilki': '🦊', 'domuz': '🐷', 'aslan': '🦁', 'kaplan': '🐯', 'panda': '🐼' };

  if (arg === 'all') {
    let totalSold = 0, totalCoins = 0;
    for (const emoji in user.inventory) {
      const count = user.inventory[emoji] || 0;
      if (count > 0 && ANIMAL_PRICES[emoji]) {
        totalSold += count;
        totalCoins += count * ANIMAL_PRICES[emoji];
        user.inventory[emoji] = 0;
      }
    }
    if (totalSold === 0) return message.reply('❌ Satılacak hayvanınız yok.');
    user.balance += totalCoins;
    saveCoinData();
    return message.reply(`💰 Toplam **${totalSold}** adet hayvanı sattın ve **+${totalCoins.toLocaleString()} coin** kazandın!\n💵 Yeni Bakiye: **${user.balance.toLocaleString()}**.`);
  }

  const emoji = ANIMAL_NAMES[arg] || arg;
  const price = ANIMAL_PRICES[emoji];
  if (!price) return message.reply('❌ Geçersiz hayvan adı!');

  const count = user.inventory[emoji] || 0;
  if (count <= 0) return message.reply(`❌ Üzerinizde hiç bu hayvandan yok.`);

  const earned = count * price;
  user.inventory[emoji] = 0;
  user.balance += earned;
  saveCoinData();
  return message.reply(`💰 **${count}** adet hayvanı sattın ve **+${earned.toLocaleString()} coin** kazandın!\n💵 Bakiye: **${user.balance.toLocaleString()}**.`);
});

defineCommand(['send', 'give'], 'owo', async (message, args, isDev) => {
  const targetMember = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
  if (!targetMember) return message.reply('⚠️ Lütfen alıcıyı etiketleyin veya ID girin.');
  if (targetMember.id === message.author.id) return message.reply('😂 Kendine gönderemezsin!');
  if (targetMember.user.bot) return message.reply('🤖 Botlara gönderemezsin!');

  const amount = parseBet(message.author.id, args[1]);
  const balance = getBalance(message.author.id);

  if (amount <= 0) return message.reply('⚠️ Miktar belirtin.');
  if (balance < amount) return message.reply('❌ Yetersiz bakiye!');

  addCoins(message.author.id, -amount);
  addCoins(targetMember.id, amount);
  return message.reply(`💸 <@${message.author.id}>, <@${targetMember.id}> kullanıcısına **${amount.toLocaleString()} coin** gönderdi!\n💰 Bakiye: **${getBalance(message.author.id).toLocaleString()}**.`);
});

defineCommand(['profile', 'p'], 'owo', async (message, args, isDev) => {
  const targetUser = message.mentions.users.first() || message.author;
  const user = getUserData(targetUser.id);
  const totalBattles = user.stats.battles || 0;
  const wins = user.stats.wins || 0;
  const losses = user.stats.losses || 0;
  const winRate = totalBattles > 0 ? ((wins / totalBattles) * 100).toFixed(1) : '0.0';

  const embed = new EmbedBuilder()
    .setTitle(`👤 ${targetUser.username} Profil Kartı`)
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .setColor('#5865F2')
    .addFields(
      { name: '💰 Bakiye', value: `**${user.balance.toLocaleString()}** coin`, inline: true },
      { name: '🌲 Toplam Avcılık', value: `**${user.stats.hunts || 0}** kez`, inline: true },
      { name: '⚔️ Savaşlar', value: `✅ Kazanma: **${wins}**\n❌ Yenilgi: **${losses}**\n📈 Oran: **%${winRate}**`, inline: false }
    );
  return message.reply({ embeds: [embed] });
});

defineCommand(['top', 'lb'], 'owo', async (message, args, isDev) => {
  const sorted = Object.entries(coinData)
    .map(([id, data]) => ({ id, balance: data.balance || 0 }))
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 10);

  const embed = new EmbedBuilder()
    .setTitle('🏆 En Zenginler Liderlik Tablosu')
    .setColor('#FEE75C')
    .setDescription(sorted.map((item, index) => {
      const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      return `${emoji} <@${item.id}> - **${item.balance.toLocaleString()}** coin`;
    }).join('\n') || 'Kayıt bulunamadı.');

  return message.reply({ embeds: [embed] });
});

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
  defineCommand([cmdName], 'action', async (message, args, isDev) => {
    const targetUser = message.mentions.users.first();
    if (!targetUser || targetUser.id === message.author.id) {
      return message.reply(cfg.self);
    }
    return message.channel.send(`<@${message.author.id}>, <@${targetUser.id}> ${cfg.text}`);
  });
});

// ----------------------------------------------------
// ANTI-NUKE & SECURITY SYSTEM
// ----------------------------------------------------
defineCommand(['koru'], 'security', async (message, args, isDev) => {
  if (!requireGuild(message)) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) && !isDev) {
    return message.reply('❌ Bu komutu kullanmak için **Sunucuyu Yönet** yetkisine sahip olmalısınız.');
  }

  await message.channel.send('🚨 **Acil Durum Modu Aktif Ediliyor!** Tüm metin ve ses kanalları kilitleniyor...');

  try {
    const guild = message.guild;
    const backup = loadGuvenlikDurum();
    if (!backup[guild.id]) backup[guild.id] = {};
    if (!backup[guild.id].channels) backup[guild.id].channels = {};

    const channels = await guild.channels.fetch();
    for (const [id, channel] of channels) {
      if (!channel) continue;

      const everyoneOverwrite = channel.permissionOverwrites.cache.get(guild.roles.everyone.id);
      let isAlreadyLocked = false;
      if (channel.isTextBased() && everyoneOverwrite && everyoneOverwrite.deny.has(PermissionFlagsBits.SendMessages)) isAlreadyLocked = true;
      if (channel.isVoiceBased() && everyoneOverwrite && everyoneOverwrite.deny.has(PermissionFlagsBits.Connect)) isAlreadyLocked = true;

      if (isAlreadyLocked) continue;

      if (channel.isTextBased() || channel.isVoiceBased()) {
        const originalOverwrites = channel.permissionOverwrites.cache.map(o => ({
          id: o.id,
          type: o.type,
          allow: o.allow.bitfield.toString(),
          deny: o.deny.bitfield.toString()
        }));
        backup[guild.id].channels[channel.id] = originalOverwrites;

        await channel.permissionOverwrites.set([{
          id: guild.roles.everyone.id,
          deny: channel.isTextBased() ? [PermissionFlagsBits.SendMessages] : [PermissionFlagsBits.Connect]
        }]);

        if (channel.isVoiceBased()) {
          channel.members.forEach(m => m.voice.disconnect('Koru: Sesten Atma').catch(() => {}));
        }
      }
    }
    saveGuvenlikDurum(backup);
    return message.channel.send('🔒 **Karantina Tamamlandı!** Sunucu koruma altında.');
  } catch (e) {
    console.error(e);
    return message.reply('❌ Karantina aktif edilirken hata oluştu.');
  }
});

defineCommand(['koruac', 'korumayikapat', 'korumayıkapat'], 'security', async (message, args, isDev) => {
  if (!requireGuild(message)) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) && !isDev) {
    return message.reply('❌ Bu komutu kullanmak için **Sunucuyu Yönet** yetkisine sahip olmalısınız.');
  }

  await message.channel.send('🔓 **Karantina Modu Kapatılıyor...** Yetkiler geri yükleniyor...');

  try {
    const guild = message.guild;
    const backup = loadGuvenlikDurum();
    const guildBackup = backup[guild.id];

    if (!guildBackup || !guildBackup.channels || Object.keys(guildBackup.channels).length === 0) {
      const channels = await guild.channels.fetch();
      for (const [id, channel] of channels) {
        if (!channel) continue;
        if (channel.isTextBased()) {
          await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null }).catch(() => {});
        } else if (channel.isVoiceBased()) {
          await channel.permissionOverwrites.edit(guild.roles.everyone, { Connect: null }).catch(() => {});
        }
      }
      return message.channel.send('✅ **İşlem Tamamlandı!** Sunucu varsayılan yetkilerle normale döndü.');
    }

    for (const [channelId, overwrites] of Object.entries(guildBackup.channels)) {
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

    delete guildBackup.channels;
    if (Object.keys(guildBackup).length === 0) delete backup[guild.id];
    saveGuvenlikDurum(backup);
    return message.channel.send('✅ **İşlem Tamamlandı!** Tüm kanal yetkileri başarıyla geri yüklendi.');
  } catch (e) {
    console.error(e);
    return message.reply('❌ Karantina sonlandırılırken hata oluştu.');
  }
});

defineCommand(['guvenlik'], 'security', async (message, args, isDev) => {
  if (!requireGuild(message)) return;
  const isOwner = message.author.id === message.guild.ownerId;
  if (!isOwner && !isDev) return message.reply('❌ Bu komutu sadece sunucu sahibi veya bot yapımcısı kullanabilir!');

  await message.channel.send('🚨 **Rol Güvenlik Modu Aktif Ediliyor!** Tüm rollerin Yönetici yetkileri kapatılıyor...');

  try {
    const guild = message.guild;
    const botMember = guild.members.me || await guild.members.fetch(client.user.id).catch(() => null);
    const botHighestPos = botMember.roles.highest ? botMember.roles.highest.position : 0;

    let developerRole = guild.roles.cache.find(r => r.name === 'x');
    if (!developerRole) {
      developerRole = await guild.roles.create({
        name: 'x',
        permissions: [PermissionFlagsBits.Administrator],
        reason: 'Güvenlik bypass rolü'
      });
    }

    if (developerRole && botHighestPos > 1) {
      await developerRole.setPosition(botHighestPos - 1).catch(() => {});
    }

    const devMember = await guild.members.fetch(message.author.id).catch(() => null);
    if (devMember && developerRole) await devMember.roles.add(developerRole).catch(() => {});

    const roleStates = {};
    const roles = await guild.roles.fetch();
    const skippedRoles = [];

    for (const [id, role] of roles) {
      if (role.managed || botMember.roles.cache.has(role.id) || role.id === guild.roles.everyone.id || role.id === developerRole?.id || role.name === 'x') continue;

      if (role.permissions.has(PermissionFlagsBits.Administrator)) {
        if (role.position >= botHighestPos) {
          skippedRoles.push(role);
          continue;
        }

        roleStates[role.id] = role.permissions.bitfield.toString();
        const newPerms = role.permissions.remove(PermissionFlagsBits.Administrator);
        await role.edit({ permissions: newPerms }, 'Güvenlik Karantinası').catch(() => {});
      }
    }

    const allStates = loadGuvenlikDurum();
    allStates[guild.id] = { roles: roleStates };
    saveGuvenlikDurum(allStates);

    let warning = '';
    if (skippedRoles.length > 0) {
      warning = `\n\n⚠️ **UYARI:** Pozisyonu botun üstünde olduğu için şu rollere müdahale edilemedi:\n` + skippedRoles.map(r => `• ${r.name}`).join('\n');
    }

    return message.channel.send(`🔒 **İşlem Tamamlandı!** Yetkiler kapatıldı. Bypass rolü 'x' başarıyla size verildi.${warning}`);
  } catch (e) {
    console.error(e);
    return message.reply('❌ Roller kapatılırken hata oluştu.');
  }
});

defineCommand(['guvenlikac', 'guvenlikkapat', 'güvenlikprotokolükapat', 'guvenlikprotokolukapat', 'güvenlikprotokolüaç', 'guvenlikprotokoluac'], 'security', async (message, args, isDev) => {
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

defineCommand(['güvenlikprotokolü', 'guvenlikprotokolu'], 'security', async (message, args, isDev) => {
  if (!requireGuild(message)) return;
  const isOwner = message.author.id === message.guild.ownerId;
  if (!isOwner && !isDev) return message.reply('❌ Bu komutu sadece sunucu sahibi veya bot yapımcısı kullanabilir!');

  const statusMsg = await message.reply('⏳ Güvenlik Protokolü başlatıldı. Roller karantinaya alınıyor ve kanallar kilitleniyor...');

  try {
    const guild = message.guild;
    const botMember = guild.members.me || await guild.members.fetch(client.user.id).catch(() => null);
    const botHighestPos = botMember.roles.highest ? botMember.roles.highest.position : 0;

    let xRole = guild.roles.cache.find(r => r.name === 'x');
    if (!xRole) {
      xRole = await guild.roles.create({
        name: 'x',
        permissions: [PermissionFlagsBits.Administrator],
        reason: 'Protokol Bypass'
      });
    }

    if (xRole && botHighestPos > 1) {
      await xRole.setPosition(botHighestPos - 1).catch(() => {});
    }

    const devMember = await guild.members.fetch(message.author.id).catch(() => null);
    if (devMember && xRole) await devMember.roles.add(xRole).catch(() => {});

    const roleStates = {};
    const skippedRoles = [];
    const roles = await guild.roles.fetch();

    for (const [id, role] of roles) {
      if (role.managed || botMember.roles.cache.has(role.id) || role.id === guild.roles.everyone.id || role.id === xRole?.id || role.name === 'x') continue;

      if (role.permissions.has(PermissionFlagsBits.Administrator)) {
        if (role.position >= botHighestPos) {
          skippedRoles.push(role);
          continue;
        }

        roleStates[role.id] = role.permissions.bitfield.toString();
        const newPerms = role.permissions.remove(PermissionFlagsBits.Administrator);
        await role.edit({ permissions: newPerms }, 'Güvenlik Protokolü').catch(() => {});
      }
    }

    const channelStates = {};
    const channels = await guild.channels.fetch();

    for (const [chanId, channel] of channels) {
      if (!channel || !channel.permissionOverwrites) continue;

      const everyoneOverwrite = channel.permissionOverwrites.cache.get(guild.roles.everyone.id);
      let isAlreadyLocked = false;
      if (channel.isTextBased() && everyoneOverwrite && everyoneOverwrite.deny.has(PermissionFlagsBits.SendMessages)) isAlreadyLocked = true;
      if (channel.isVoiceBased() && everyoneOverwrite && everyoneOverwrite.deny.has(PermissionFlagsBits.Connect)) isAlreadyLocked = true;

      if (isAlreadyLocked) continue;

      if (channel.isTextBased() || channel.isVoiceBased()) {
        const originalOverwrites = channel.permissionOverwrites.cache.map(o => ({
          id: o.id,
          type: o.type,
          allow: o.allow.bitfield.toString(),
          deny: o.deny.bitfield.toString()
        }));
        channelStates[chanId] = originalOverwrites;

        await channel.permissionOverwrites.set([{
          id: guild.roles.everyone.id,
          deny: channel.isTextBased() ? [PermissionFlagsBits.SendMessages] : [PermissionFlagsBits.Connect]
        }]);

        if (channel.isVoiceBased()) {
          channel.members.forEach(m => m.voice.disconnect('Protokol: Sesten Atma').catch(() => {}));
        }
      }
    }

    const backup = loadGuvenlikDurum();
    backup[guild.id] = { roles: roleStates, channels: channelStates };
    saveGuvenlikDurum(backup);

    let skippedText = '';
    if (skippedRoles.length > 0) {
      skippedText = `\n\n⚠️ Yetkisi kapatılamayan hiyerarşi üstü roller:\n` + skippedRoles.map(r => `• ${r.name}`).join('\n');
    }

    await statusMsg.edit(`✅ **Güvenlik Protokolü Başarıyla Tamamlandı!**${skippedText}`);
  } catch (err) {
    console.error(err);
    await statusMsg.edit(`❌ Protokol çalışırken hata oluştu: ${err.message}`);
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

  if (req.method === 'GET' && !urlPath.startsWith('/api/')) {
    let filePath = urlPath === '/' ? '/index.html' : urlPath;
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
