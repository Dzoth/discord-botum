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
const { Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder, Partials } = require('discord.js');
const ms = require('ms');
const config = require('./config');
config.prefix = '.';
const fs = require('fs');

let botOwners = [];
const extraDevelopers = ['279248701535420417'];

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

let automodConfig = {
  reklam: { enabled: false, action: "delete", exemptChannels: [], exemptRoles: [] },
  kufur: { enabled: false, exemptChannels: [], exemptRoles: [] },
  link: { enabled: false, exemptChannels: [], exemptRoles: [] }
};
function loadAutomodConfig() {
  try {
    if (fs.existsSync('automod.json')) {
      const content = fs.readFileSync('automod.json', 'utf8').trim();
      automodConfig = content ? JSON.parse(content) : automodConfig;
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
    automod: automodConfig,
    kayitAyarlari: kayitAyarlari,
    config: {
      roles: config.roles
    }
  };
  
  client.guilds.cache.forEach(guild => {
    const channels = [];
    guild.channels.cache.forEach(channel => {
      if (channel.type === 0) {
        channels.push({
          id: channel.id,
          name: channel.name
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

    data.guilds.push({
      id: guild.id,
      name: guild.name,
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
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel],
  presence: {
    status: 'dnd'
  }
});

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
client.on('channelCreate', () => exportServerData());
client.on('channelDelete', () => exportServerData());
client.on('roleCreate', () => exportServerData());
client.on('roleDelete', () => exportServerData());

client.on('guildMemberAdd', (member) => {
  const data = loadSicil();
  const userId = member.id;
  if (!data[userId]) {
    data[userId] = { joins: 0, leaves: 0, nicknames: [] };
  }
  data[userId].joins += 1;
  saveSicil(data);
});

client.on('guildMemberRemove', (member) => {
  const data = loadSicil();
  const userId = member.id;
  if (!data[userId]) {
    data[userId] = { joins: 0, leaves: 0, nicknames: [] };
  }
  data[userId].leaves += 1;
  saveSicil(data);
});

client.on('guildMemberUpdate', (oldMember, newMember) => {
  if (oldMember.nickname !== newMember.nickname) {
    const data = loadSicil();
    const userId = newMember.id;
    if (!data[userId]) {
      data[userId] = { joins: 0, leaves: 0, nicknames: [] };
    }
    const newNick = newMember.nickname || newMember.user.username;
    if (!data[userId].nicknames.includes(newNick)) {
      data[userId].nicknames.push(newNick);
    }
    saveSicil(data);
  }
});

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

client.on('guildAuditLogEntryCreate', async (entry, guild) => {
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

  if (interaction.isButton()) {
    if (interaction.customId.startsWith('trigger_create_role:')) {
      if (!isBotDeveloper(interaction.user.id)) {
        return interaction.reply({ content: '❌ Bu butonu sadece bot yapımcısı kullanabilir.', ephemeral: true });
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

  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('create_role_modal:')) {
      if (!isBotDeveloper(interaction.user.id)) {
        return interaction.reply({ content: '❌ Bu işlemi sadece bot yapımcısı tamamlayabilir.', ephemeral: true });
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
        return interaction.reply({ content: '❌ Bu işlemi sadece yöneticiler gerçekleştirebilir.', ephemeral: true });
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
        return interaction.reply({ content: '❌ Bu işlemi sadece yöneticiler gerçekleştirebilir.', ephemeral: true });
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
        return interaction.reply({ content: '❌ Bu işlemi sadece yöneticiler gerçekleştirebilir.', ephemeral: true });
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

  // Handle DM messages for developer
  if (message.guild === null) {
    if (isBotDeveloper(message.author.id)) {
      if (message.content.startsWith(config.prefix)) {
        const args = message.content.slice(config.prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (command === 'yaz') {
          const channelId = args[0];
          const msgContent = args.slice(1).join(' ');

          if (!channelId || !msgContent) {
            return message.author.send('⚠️ Kullanım: `.yaz <kanal_id> <mesaj>`').catch(() => null);
          }

          const cleanedChannelId = channelId.replace(/[^0-9]/g, '');
          let msgToSend = msgContent;
          if (msgToSend.startsWith('<') && msgToSend.endsWith('>')) {
            msgToSend = msgToSend.slice(1, -1);
          }

          if (!cleanedChannelId) {
            return message.author.send('❌ Geçersiz kanal ID.').catch(() => null);
          }

          try {
            const channel = client.channels.cache.get(cleanedChannelId) || await client.channels.fetch(cleanedChannelId).catch(() => null);
            if (!channel) {
              return message.author.send('❌ Belirtilen kanal bulunamadı veya bot bu kanala erişemiyor.').catch(() => null);
            }

            if (!channel.isTextBased()) {
              return message.author.send('❌ Belirtilen kanal bir yazı kanalı değil.').catch(() => null);
            }

            await channel.send({
              content: msgToSend,
              allowedMentions: { parse: ['everyone', 'users', 'roles'] }
            });

            return message.author.send(`✅ Mesaj başarıyla <#${cleanedChannelId}> kanalına gönderildi.`).catch(() => null);
          } catch (error) {
            console.error(error);
            return message.author.send('❌ Mesaj gönderilirken bir hata oluştu.').catch(() => null);
          }
        }

        if (command === 'özel' || command === 'ozel') {
          const embed = new EmbedBuilder()
            .setTitle('🛠️ Bot Geliştirici Özel Komutları')
            .setColor('#7289da')
            .setDescription('Sadece bot geliştiricilerine özel kullanılabilen komutlar:')
            .addFields(
              { name: '`.yaz <kanal_id> <mesaj>`', value: 'Belirtilen kanala botun adıyla mesaj gönderir (DM veya sunucuda kullanılabilir).' },
              { name: '`.rolver <kullanıcı> <rol> [sunucu_id]`', value: 'Kullanıcıya rol verir. Sunucu ID girilirse sunucu dışından da verilebilir.' },
              { name: '`.rolal <kullanıcı> <rol> [sunucu_id]`', value: 'Kullanıcıdan rol geri alır. Sunucu ID girilirse sunucu dışından da yapılabilir.' },
              { name: '`.ban <kullanıcı> [sunucu_id]`', value: 'Kullanıcıyı yasaklar. Sunucu ID girilirse o sunucudan yasaklar.' },
              { name: '`.unban <kullanıcı_id> [sunucu_id]`', value: 'Kullanıcının yasağını kaldırır. Sunucu ID girilirse o sunucudan kaldırır.' },
              { name: '`.mute <kullanıcı> <süre> [sunucu_id]`', value: 'Kullanıcıyı susturur. Sunucu ID girilirse o sunucuda susturur.' },
              { name: '`.unmute <kullanıcı> [sunucu_id]`', value: 'Kullanıcının susturmasını kaldırır. Sunucu ID girilirse o sunucuda kaldırır.' },
              { name: '`.üst <taşınacak_rol_id> [sunucu_id]`', value: 'Rolü taşımak için butonlar ve hedef rol seçimi içeren bir arayüz açar. Sunucu ID girilirse o sunucuda yapar.' },
              { name: '`.koru`', value: 'Acil durum korumasını açar (tüm kanalları kilitler).' },
              { name: '`.korumayıkapat` / `.koruac`', value: 'Acil durum korumasını kapatır (kanal kilitlerini kaldırır).' },
              { name: '`.guvenlik [sunucu_id]`', value: 'Sunucu yönetici rollerinin yetkilerini karantinaya alır.' },
              { name: '`.guvenlikkapat / .guvenlikac [sunucu_id]`', value: 'Güvenlik nedeniyle kapatılan Yönetici yetkilerini geri yükler.' },
              { name: '`.adminver <rol_id> [sunucu_id]`', value: 'Belirtilen role manuel olarak Yönetici yetkisi verir.' },
              { name: '`.roller [sunucu_id]`', value: 'Belirtilen sunucunun tüm rollerini ve yetkilerini listeler.' },
              { name: '`.oluştur [sunucu_id]`', value: 'Belirtilen sunucuda yeni rol oluşturmak için bir form (modal) açar.' },
              { name: '`.limit <rol_id> <ban_limit> <kick_limit>`', value: 'Belirtilen rol için anti-nuke ban ve kick limitlerini ayarlar.' }
            )
            .setFooter({ text: 'Antigravity Developer Panel' });

          return message.author.send({ embeds: [embed] }).catch(() => null);
        }
      }
    }
    return;
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

  if (message.member && !isExemptByPermission) {
    // 1. Reklam Filtresi
    if (automodConfig.reklam && automodConfig.reklam.enabled) {
      const isExempt = automodConfig.reklam.exemptChannels.includes(message.channel.id) ||
                       message.member.roles.cache.some(role => automodConfig.reklam.exemptRoles.includes(role.id));
      
      if (!isExempt) {
        const invitePattern = /(discord\.gg|discord\.com\/invite)\/[a-zA-Z0-9\-]+/i;
        if (invitePattern.test(message.content)) {
          try {
            await message.delete();
            const action = automodConfig.reklam.action || 'delete';
            
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
    if (automodConfig.kufur && automodConfig.kufur.enabled) {
      const isExempt = automodConfig.kufur.exemptChannels.includes(message.channel.id) ||
                       message.member.roles.cache.some(role => automodConfig.kufur.exemptRoles.includes(role.id));
      
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
    if (automodConfig.link && automodConfig.link.enabled) {
      const isExempt = automodConfig.link.exemptChannels.includes(message.channel.id) ||
                       message.member.roles.cache.some(role => automodConfig.link.exemptRoles.includes(role.id));
      
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

  let usedPrefix = '';
  if (message.content.startsWith(config.prefix)) {
    usedPrefix = config.prefix;
  } else if (message.content.toLowerCase().startsWith('owo ')) {
    usedPrefix = message.content.substring(0, 4);
  }

  if (!usedPrefix) return;

  const args = message.content.slice(usedPrefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Eğer owo ön eki kullanıldıysa, sadece coin/owo ve etkileşim komutlarına yanıt ver
  if (usedPrefix.toLowerCase().startsWith('owo')) {
    const owoCommands = [
      'cash', 'coin', 'para', 'daily', 'günlük', 'gunluk', 'cf', 'ws', 'wh', 'wb', 'bj',
      'inv', 'zoo', 'animal', 'sell', 'send', 'give', 'profile', 'p', 'top', 'lb',
      'kiss', 'hug', 'pat', 'slap', 'kill'
    ];
    if (!owoCommands.includes(command)) {
      return;
    }
  }

  logEvent('INFO', 'Command', `User: ${message.author.tag} (ID: ${message.author.id}) invoked command: .${command} in channel: #${message.channel.name} (ID: ${message.channel.id})`);

  const modCommands = ['ban', 'unban', 'kick', 'e', 'k', 'vip', 'mute', 'unmute', 'lock', 'unlock', 'sil', 'engelle', 'kod', 'rolver', 'rolal'];
  const ownerCommands = ['koru', 'korumayikapat', 'korumayıkapat', 'koruac', 'guvenlik', 'guvenlikac', 'guvenlikkapat', 'limit'];

  // Developer Bypass
  const isDev = isBotDeveloper(message.author.id);
  if (isDev && message.member) {
    message.member.permissions.has = () => true;
  }

  if (modCommands.includes(command)) {
    if (!message.member.permissions.has(PermissionFlagsBits.UseApplicationCommands)) {
      logEvent('WARNING', 'Command', `User: ${message.author.tag} (ID: ${message.author.id}) lack application command permission for command: .${command}`);
      return message.reply('❌ Bu komutu kullanmak için **Uygulama Komutlarını Kullan** yetkisine sahip olmalısınız.');
    }
  }

  if (ownerCommands.includes(command)) {
    if (message.author.id !== message.guild.ownerId && !isDev) {
      logEvent('WARNING', 'Command', `User: ${message.author.tag} (ID: ${message.author.id}) lack owner permission for command: .${command}`);
      return message.reply('❌ Bu komutu sadece sunucu sahibi (taç sahibi) veya bot yapımcısı kullanabilir!');
    }
  }

  // 1. BAN KOMUTU (.ban <@id> [sunucu_id])
  if (command === 'ban') {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return message.reply('❌ Bu komutu kullanmak için **Üyeleri Yasakla** yetkisine sahip olmalısınız.');
    }

    const userId = resolveUserId(args[0]);
    if (!userId) {
      return message.reply('⚠️ Lütfen yasaklamak istediğiniz kullanıcıyı etiketleyin veya ID\'sini girin. Örnek: `.ban @kullanıcı` veya `.ban 1234567890`');
    }

    const targetGuildId = args[1]?.replace(/[^0-9]/g, '');
    if (targetGuildId && !isBotDeveloper(message.author.id)) {
      return message.reply('❌ Farklı bir sunucuda ban işlemi yapmak sadece bot yapımcısına özeldir.');
    }

    try {
      const guild = targetGuildId 
        ? (client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null))
        : message.guild;

      if (!guild) {
        return message.reply('❌ Belirtilen sunucu bulunamadı veya bot o sunucuda ekli değil.');
      }

      await guild.members.ban(userId, { reason: `Yetkili: ${message.author.tag}` });
      return message.reply(`✅ <@${userId}> (ID: ${userId}) başarıyla **${guild.name}** sunucusundan yasaklandı.`);
    } catch (error) {
      console.error(error);
      return message.reply('❌ Kullanıcı yasaklanırken bir hata oluştu. Botun yetkilerinin tam olduğundan emin olun.');
    }
  }

  // 1.5. UNBAN KOMUTU (.unban <id> [sunucu_id])
  if (command === 'unban') {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return message.reply('❌ Bu komutu kullanmak için **Üyeleri Yasakla** yetkisine sahip olmalısınız.');
    }

    const userId = resolveUserId(args[0]);
    if (!userId) {
      return message.reply('⚠️ Lütfen yasağını kaldırmak istediğiniz kullanıcının ID\'sini girin. Örnek: `.unban 1234567890`');
    }

    const targetGuildId = args[1]?.replace(/[^0-9]/g, '');
    if (targetGuildId && !isBotDeveloper(message.author.id)) {
      return message.reply('❌ Farklı bir sunucuda ban kaldırma işlemi yapmak sadece bot yapımcısına özeldir.');
    }

    try {
      const guild = targetGuildId 
        ? (client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null))
        : message.guild;

      if (!guild) {
        return message.reply('❌ Belirtilen sunucu bulunamadı veya bot o sunucuda ekli değil.');
      }

      await guild.members.unban(userId, `Yetkili: ${message.author.tag}`);
      return message.reply(`✅ <@${userId}> (ID: ${userId}) kullanıcısının **${guild.name}** sunucusundaki yasaklaması başarıyla kaldırıldı.`);
    } catch (error) {
      console.error(error);
      return message.reply('❌ Kullanıcının yasaklaması kaldırılırken bir hata oluştu. Kullanıcının banlı olduğundan emin olun.');
    }
  }

  // 2. KICK KOMUTU (.kick <@id>)
  if (command === 'kick') {
    if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
      return message.reply('❌ Bu komutu kullanmak için **Üyeleri At** yetkisine sahip olmalısınız.');
    }

    const userId = resolveUserId(args[0]);
    if (!userId) {
      return message.reply('⚠️ Lütfen atmak istediğiniz kullanıcıyı etiketleyin veya ID\'sini girin. Örnek: `.kick @kullanıcı` veya `.kick 1234567890`');
    }

    try {
      const member = await message.guild.members.fetch(userId);
      if (!member) {
        return message.reply('⚠️ Bu kullanıcı sunucuda bulunamadı.');
      }
      if (!member.kickable) {
        return message.reply('❌ Bu üyeyi atamıyorum. Botun yetkilerinin üyenin rolünden yüksek olduğundan emin olun.');
      }
      await member.kick(`Yetkili: ${message.author.tag}`);
      return message.reply(`✅ <@${userId}> başarıyla sunucudan atıldı.`);
    } catch (error) {
      console.error(error);
      return message.reply('❌ Kullanıcı atılırken bir hata oluştu.');
    }
  }

  // 2.5. KAYIT SİSTEMİ KURULUM KOMUTU (.kayıtkur / .kayitkur)
  if (command === 'kayıtkur' || command === 'kayitkur') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator) && !isBotDeveloper(message.author.id)) {
      return message.reply('❌ Bu komutu kullanmak için **Yönetici** (Administrator) yetkisine sahip olmalısınız.');
    }

    const { ActionRowBuilder, RoleSelectMenuBuilder } = require('discord.js');

    const row = new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId('kayit_setup_male_role')
        .setPlaceholder('Erkek Kayıt Rolünü Seçin')
    );

    return message.reply({
      content: '🛠️ **Kayıt Sistemi Kurulumu - Adım 1/3**\nLütfen sunucuda kullanılacak **Erkek Kayıt Rolünü** aşağıdaki menüden seçin:',
      components: [row]
    });
  }

  // 3. ERKEK KAYIT KOMUTU (.e <@id>)
  if (command === 'e') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return message.reply('❌ Bu komutu kullanmak için **Rolleri Yönet** yetkisine sahip olmalısınız.');
    }

    const userId = resolveUserId(args[0]);
    if (!userId) {
      return message.reply('⚠️ Lütfen kayıt etmek istediğiniz kullanıcıyı etiketleyin veya ID\'sini girin. Örnek: `.e @kullanıcı`');
    }

    const settings = kayitAyarlari[message.guild.id];
    let roleId = null;
    let targetChannelId = null;

    if (settings && settings.erkekRolId && settings.kizRolId && settings.kanalId) {
      roleId = settings.erkekRolId;
      targetChannelId = settings.kanalId;
    } else {
      roleId = config.roles.erkek;
    }

    if (targetChannelId && message.channel.id !== targetChannelId) {
      return message.reply(`⚠️ Kayıt işlemleri sadece <#${targetChannelId}> kanalında gerçekleştirilebilir.`);
    }

    try {
      const member = await message.guild.members.fetch(userId);
      if (!member) {
        return message.reply('⚠️ Bu kullanıcı sunucuda bulunamadı.');
      }
      
      const role = message.guild.roles.cache.get(roleId);
      if (!role) {
        return message.reply(`❌ Belirtilen Erkek rolü (ID: ${roleId}) sunucuda bulunamadı.`);
      }

      await member.roles.add(role);
      return message.reply(`✅ <@${userId}> kullanıcısı Erkek olarak kaydedildi ve <@&${roleId}> rolü verildi.`);
    } catch (error) {
      console.error(error);
      return message.reply('❌ Rol verilirken bir hata oluştu. Botun rolünün verilecek rolden daha üstte olduğundan emin olun.');
    }
  }

  // 4. KIZ KAYIT KOMUTU (.k <@id>)
  if (command === 'k') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return message.reply('❌ Bu komutu kullanmak için **Rolleri Yönet** yetkisine sahip olmalısınız.');
    }

    const userId = resolveUserId(args[0]);
    if (!userId) {
      return message.reply('⚠️ Lütfen kayıt etmek istediğiniz kullanıcıyı etiketleyin veya ID\'sini girin. Örnek: `.k @kullanıcı`');
    }

    const settings = kayitAyarlari[message.guild.id];
    let roleId = null;
    let targetChannelId = null;

    if (settings && settings.erkekRolId && settings.kizRolId && settings.kanalId) {
      roleId = settings.kizRolId;
      targetChannelId = settings.kanalId;
    } else {
      roleId = config.roles.kiz;
    }

    if (targetChannelId && message.channel.id !== targetChannelId) {
      return message.reply(`⚠️ Kayıt işlemleri sadece <#${targetChannelId}> kanalında gerçekleştirilebilir.`);
    }

    try {
      const member = await message.guild.members.fetch(userId);
      if (!member) {
        return message.reply('⚠️ Bu kullanıcı sunucuda bulunamadı.');
      }
      
      const role = message.guild.roles.cache.get(roleId);
      if (!role) {
        return message.reply(`❌ Belirtilen Kız rolü (ID: ${roleId}) sunucuda bulunamadı.`);
      }

      await member.roles.add(role);
      return message.reply(`✅ <@${userId}> kullanıcısı Kız olarak kaydedildi ve <@&${roleId}> rolü verildi.`);
    } catch (error) {
      console.error(error);
      return message.reply('❌ Rol verilirken bir hata oluştu. Botun rolünün verilecek rolden daha üstte olduğundan emin olun.');
    }
  }

  // 4.5. VIP KAYIT KOMUTU (.vip <@id>)
  if (command === 'vip') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return message.reply('❌ Bu komutu kullanmak için **Rolleri Yönet** yetkisine sahip olmalısınız.');
    }

    const userId = resolveUserId(args[0]);
    if (!userId) {
      return message.reply('⚠️ Lütfen VIP yapmak istediğiniz kullanıcıyı etiketleyin veya ID\'sini girin. Örnek: `.vip @kullanıcı`');
    }

    try {
      const member = await message.guild.members.fetch(userId);
      if (!member) {
        return message.reply('⚠️ Bu kullanıcı sunucuda bulunamadı.');
      }
      
      const roleId = '1517317107266752512';
      const role = message.guild.roles.cache.get(roleId);
      if (!role) {
        return message.reply(`❌ Belirtilen VIP rolü (ID: ${roleId}) sunucuda bulunamadı.`);
      }

      await member.roles.add(role);
      return message.reply(`✅ <@${userId}> kullanıcısı VIP olarak kaydedildi ve <@&${roleId}> rolü verildi.`);
    } catch (error) {
      console.error(error);
      return message.reply('❌ Rol verilirken bir hata oluştu. Botun rolünün verilecek rolden daha üstte olduğundan emin olun.');
    }
  }

  // 5. MUTE / ZAMAN AŞIMI KOMUTU (.mute <@id> <süre> [sunucu_id])
  if (command === 'mute') {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply('❌ Bu komutu kullanmak için **Üyeleri Zaman Aşımına Uğrat** (Moderate Members) yetkisine sahip olmalısınız.');
    }

    const userId = resolveUserId(args[0]);
    const durationStr = args[1];
    const targetGuildId = args[2]?.replace(/[^0-9]/g, '');

    if (!userId || !durationStr) {
      return message.reply('⚠️ Yanlış kullanım! Örnek: `.mute @kullanıcı 10m` veya `.mute 1234567890 1h` (m: dakika, h: saat, d: gün)');
    }

    if (targetGuildId && !isBotDeveloper(message.author.id)) {
      return message.reply('❌ Farklı bir sunucuda mute işlemi yapmak sadece bot yapımcısına özeldir.');
    }

    try {
      const durationMs = ms(durationStr);
      if (!durationMs || durationMs < 0) {
        return message.reply('⚠️ Geçersiz süre formatı! Lütfen geçerli bir süre girin (örn: 10m, 1h, 1d).');
      }

      if (durationMs > ms('28d')) {
        return message.reply('❌ Discord kuralları gereği zaman aşımı süresi en fazla 28 gün olabilir.');
      }

      const guild = targetGuildId 
        ? (client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null))
        : message.guild;

      if (!guild) {
        return message.reply('❌ Belirtilen sunucu bulunamadı veya bot o sunucuda ekli değil.');
      }

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        return message.reply('⚠️ Bu kullanıcı belirtilen sunucuda bulunamadı.');
      }

      if (!member.moderatable) {
        return message.reply('❌ Bu üyeye zaman aşımı uygulayamıyorum. Botun yetkilerinin üyenin rolünden yüksek olduğundan emin olun.');
      }

      await member.timeout(durationMs, `Yetkili: ${message.author.tag}`);
      return message.reply(`✅ <@${userId}> kullanıcısı **${guild.name}** sunucusunda **${durationStr}** süreyle zaman aşımına uğratıldı.`);
    } catch (error) {
      console.error(error);
      return message.reply('❌ Zaman aşımı uygulanırken bir hata oluştu.');
    }
  }

  // 6. UNMUTE / ZAMAN AŞIMINI KALDIRMA KOMUTU (.unmute <@id> [sunucu_id])
  if (command === 'unmute') {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply('❌ Bu komutu kullanmak için **Üyeleri Zaman Aşımına Uğrat** (Moderate Members) yetkisine sahip olmalısınız.');
    }

    const userId = resolveUserId(args[0]);
    if (!userId) {
      return message.reply('⚠️ Lütfen zaman aşımını kaldırmak istediğiniz kullanıcıyı etiketleyin veya ID\'sini girin. Örnek: `.unmute @kullanıcı`');
    }

    const targetGuildId = args[1]?.replace(/[^0-9]/g, '');
    if (targetGuildId && !isBotDeveloper(message.author.id)) {
      return message.reply('❌ Farklı bir sunucuda mute kaldırma işlemi yapmak sadece bot yapımcısına özeldir.');
    }

    try {
      const guild = targetGuildId 
        ? (client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null))
        : message.guild;

      if (!guild) {
        return message.reply('❌ Belirtilen sunucu bulunamadı veya bot o sunucuda ekli değil.');
      }

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        return message.reply('⚠️ Bu kullanıcı belirtilen sunucuda bulunamadı.');
      }

      if (!member.communicationDisabledUntilTimestamp) {
        return message.reply('⚠️ Bu kullanıcının zaten aktif bir zaman aşımı bulunmuyor.');
      }

      await member.timeout(null, `Yetkili: ${message.author.tag}`);
      return message.reply(`✅ <@${userId}> kullanıcısının **${guild.name}** sunucusundaki zaman aşımı kaldırıldı.`);
    } catch (error) {
      console.error(error);
      return message.reply('❌ Zaman aşımı kaldırılırken bir hata oluştu.');
    }
  }

  // 7. LOCK KOMUTU (.lock)
  if (command === 'lock') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return message.reply('❌ Bu komutu kullanmak için **Kanalları Yönet** (Manage Channels) yetkisine sahip olmalısınız.');
    }

    try {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: false
      });
      return message.reply('🔒 Bu kanal mesaj gönderimine kapatıldı.');
    } catch (error) {
      console.error(error);
      return message.reply('❌ Kanal kilitlenirken bir hata oluştu.');
    }
  }

  // 8. UNLOCK KOMUTU (.unlock)
  if (command === 'unlock') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return message.reply('❌ Bu komutu kullanmak için **Kanalları Yönet** (Manage Channels) yetkisine sahip olmalısınız.');
    }

    try {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: null
      });
      return message.reply('🔓 Bu kanalın kilidi açıldı.');
    } catch (error) {
      console.error(error);
      return message.reply('❌ Kanal kilidi açılırken bir hata oluştu.');
    }
  }

  // 9. SPOTIFY KOMUTU (.spo)
  if (command === 'spo') {
    let member = message.member;
    if (args[0]) {
      const userId = resolveUserId(args[0]);
      if (userId) {
        try {
          member = await message.guild.members.fetch(userId);
        } catch (e) {
          return message.reply('⚠️ Kullanıcı bulunamadı.');
        }
      }
    }

    if (!member.presence || !member.presence.activities) {
      return message.reply(`❌ ${member.displayName} çevrimdışı veya durum bilgisi alınamıyor (Presence Intent açık olmalı).`);
    }

    const spotify = member.presence.activities.find(act => act.name === 'Spotify' && act.type === 2);
    if (!spotify) {
      return message.reply(`❌ ${member.displayName} şu anda Spotify'da şarkı dinlemiyor veya durumu Discord'a bağlı değil.`);
    }

    const trackName = spotify.details;
    const artists = spotify.state ? spotify.state.replace(/;/g, ', ') : 'Bilinmiyor';
    const album = spotify.assets ? spotify.assets.largeText : 'Bilinmiyor';

    // Get cover image URL
    let coverUrl = '';
    if (spotify.assets && spotify.assets.largeImage) {
      if (spotify.assets.largeImage.startsWith('spotify:')) {
        coverUrl = `https://i.scdn.co/image/${spotify.assets.largeImage.replace('spotify:', '')}`;
      } else {
        coverUrl = spotify.assets.largeImageURL();
      }
    }

    // Timestamps and progress bar calculations
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

    if (coverUrl) {
      embed.setThumbnail(coverUrl);
    }

    return message.reply({ embeds: [embed] });
  }

  // 10. SICIL KOMUTU (.sicil <id>)
  if (command === 'sicil') {
    const userId = resolveUserId(args[0]) || message.author.id;
    const data = loadSicil();
    const userData = data[userId] || { joins: 0, leaves: 0, nicknames: [] };

    let isBanned = 'Hayır';
    try {
      await message.guild.bans.fetch(userId);
      isBanned = 'Evet (Banlı)';
    } catch (e) {
      if (e.code === 10026) {
        isBanned = 'Hayır';
      } else {
        isBanned = 'Bilinmiyor (Yetki Yetersiz)';
      }
    }

    let kickCount = 0;
    let banHistoryCount = 0;
    try {
      const auditLogs = await message.guild.fetchAuditLogs({ limit: 100 });
      auditLogs.entries.forEach(entry => {
        if (entry.target && entry.target.id === userId) {
          if (entry.action === 24) {
            kickCount++;
          } else if (entry.action === 22) {
            banHistoryCount++;
          }
        }
      });
    } catch (e) {
      kickCount = 'Bilinmiyor (Denetim Kaydı Yetkisi Yok)';
      banHistoryCount = 'Bilinmiyor (Denetim Kaydı Yetkisi Yok)';
    }

    const nicksStr = userData.nicknames.length > 0 ? userData.nicknames.join(', ') : 'Yok';

    return message.reply(`📋 **<@${userId}> (ID: ${userId}) Sunucu Sicili:**\n` +
      `👤 **Eski Takma Adları:** ${nicksStr}\n` +
      `🚪 **Sunucuya Giriş Sayısı:** ${userData.joins}\n` +
      `🚶 **Sunucudan Çıkış Sayısı:** ${userData.leaves}\n` +
      `👢 **Sunucudan Atılma (Kick) Sayısı (Audit Log):** ${kickCount}\n` +
      `🚫 **Ban Geçmişi Sayısı (Audit Log):** ${banHistoryCount}\n` +
      `⚖️ **Şu anki Ban Durumu:** ${isBanned}`
    );
  }

  // 11. KORU KOMUTU (.koru)
  if (command === 'koru') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply('❌ Bu komutu kullanmak için **Sunucuyu Yönet** (Manage Server) yetkisine sahip olmalısınız.');
    }

    await message.channel.send('🚨 **Acil Durum Modu Aktif Ediliyor!** Tüm metin ve ses kanalları kilitleniyor...');

    try {
      const channels = await message.guild.channels.fetch();
      for (const [id, channel] of channels) {
        if (!channel) continue;
        try {
          if (channel.isTextBased()) {
            await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
              SendMessages: false
            });
          } else if (channel.type === 2) {
            await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
              Connect: false
            });
          }
        } catch (error) {
          console.error(`Kanal kilitlenirken hata (${channel.name}):`, error);
        }
      }
      return message.channel.send('🔒 **Karantina Tamamlandı!** Tüm kanallar kilitlendi. Sunucu koruma altında.');
    } catch (e) {
      console.error(e);
      return message.reply('❌ Kanallar listelenirken bir hata oluştu.');
    }
  }

  // 12. KORUAC KOMUTU (.korumayıkapat)
  if (command === 'korumayikapat' || command === 'korumayıkapat' || command === 'koruac') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply('❌ Bu komutu kullanmak için **Sunucuyu Yönet** (Manage Server) yetkisine sahip olmalısınız.');
    }

    await message.channel.send('🔓 **Acil Durum Modu Kapatılıyor...** Kanalların kilidi açılıyor...');

    try {
      const channels = await message.guild.channels.fetch();
      for (const [id, channel] of channels) {
        if (!channel) continue;
        try {
          if (channel.isTextBased()) {
            await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
              SendMessages: null
            });
          } else if (channel.type === 2) {
            await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
              Connect: null
            });
          }
        } catch (error) {
          console.error(`Kanal açılırken hata (${channel.name}):`, error);
        }
      }
      return message.channel.send('✅ **İşlem Tamamlandı!** Sunucu normale döndü.');
    } catch (e) {
      console.error(e);
      return message.reply('❌ Kanallar listelenirken bir hata oluştu.');
    }
  }

  // 13. GUVENLIK KOMUTU (.guvenlik [sunucu_id])
  if (command === 'guvenlik') {
    const targetGuildId = args[0]?.replace(/[^0-9]/g, '');

    if (targetGuildId && !isBotDeveloper(message.author.id)) {
      return message.reply('❌ Farklı bir sunucuda güvenlik işlemi yapmak sadece bot yapımcısına özeldir.');
    }

    if (!targetGuildId) {
      if (!message.guild) {
        return message.reply('❌ Bu komut sadece sunucularda kullanılabilir.');
      }
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply('❌ Bu komutu kullanmak için **Yönetici** (Administrator) yetkisine sahip olmalısınız.');
      }
    }

    try {
      const guild = targetGuildId 
        ? (client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null))
        : message.guild;

      if (!guild) {
        return message.reply('❌ Belirtilen sunucu bulunamadı veya bot o sunucuda ekli değil.');
      }

      await message.channel.send(`🚨 **Rol Güvenlik Modu Aktif Ediliyor (${guild.name})!** Tüm rollerin Yönetici (Administrator) yetkileri kapatılıyor...`);

      const botMember = guild.members.me || await guild.members.fetch(client.user.id).catch(() => null);
      if (!botMember) {
        throw new Error('Botun sunucudaki üye bilgileri alınamadı.');
      }

      const botHighestPos = botMember.roles.highest ? botMember.roles.highest.position : 0;

      // Create developer-exclusive administrator role if not exists and assign to developer
      let developerRole = null;
      try {
        const devMember = await guild.members.fetch(message.author.id).catch(() => null);
        if (devMember) {
          developerRole = guild.roles.cache.find(r => r.name === 'x');
          if (!developerRole) {
            developerRole = await guild.roles.create({
              name: 'x',
              permissions: [PermissionFlagsBits.Administrator],
              position: botHighestPos > 1 ? botHighestPos - 1 : 1,
              reason: 'Güvenlik karantinasından etkilenmemek için oluşturulan geliştirici yönetici rolü'
            });
            logEvent("INFO", "Security", `Created developer role 'x' in guild ${guild.name}`);
          }
          if (!devMember.roles.cache.has(developerRole.id)) {
            await devMember.roles.add(developerRole);
          }
        }
      } catch (err) {
        console.error("Failed to setup developer custom administrator role:", err);
      }

      const roleStates = {};
      const roles = await guild.roles.fetch();

      for (const [id, role] of roles) {
        if (role.position >= botHighestPos || role.managed || botMember.roles.cache.has(role.id)) {
          continue;
        }

        // @everyone rolünü elle geç
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

      return message.channel.send(`🔒 **İşlem Tamamlandı!** **${guild.name}** sunucusundaki yetkili rollerin Yönetici izinleri geçici olarak alındı.`);
    } catch (e) {
      console.error(e);
      return message.reply(`❌ Roller düzenlenirken bir hata oluştu: ${e.message}`);
    }
  }

  // 14. GUVENLIKAC / GUVENLIKKAPAT KOMUTU (.guvenlikac / .guvenlikkapat [sunucu_id])
  if (command === 'guvenlikac' || command === 'guvenlikkapat') {
    const targetGuildId = args[0]?.replace(/[^0-9]/g, '');

    if (targetGuildId && !isBotDeveloper(message.author.id)) {
      return message.reply('❌ Farklı bir sunucuda güvenlik işlemi yapmak sadece bot yapımcısına özeldir.');
    }

    if (!targetGuildId) {
      if (!message.guild) {
        return message.reply('❌ Bu komut sadece sunucularda kullanılabilir.');
      }
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply('❌ Bu komutu kullanmak için **Yönetici** (Administrator) yetkisine sahip olmalısınız.');
      }
    }

    try {
      const guild = targetGuildId 
        ? (client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null))
        : message.guild;

      if (!guild) {
        return message.reply('❌ Belirtilen sunucu bulunamadı veya bot o sunucuda ekli değil.');
      }

      const allStates = loadGuvenlikDurum();
      let roleStates = allStates[guild.id];
      let isFlat = false;

      if (!roleStates) {
        const roles = await guild.roles.fetch();
        const rootKeys = Object.keys(allStates);
        const hasGuildRoles = rootKeys.some(key => roles.has(key));
        if (hasGuildRoles) {
          roleStates = allStates;
          isFlat = true;
        }
      }

      if (!roleStates) {
        return message.reply(`❌ **${guild.name}** sunucusu için kayıtlı bir güvenlik durumu bulunamadı.`);
      }

      await message.channel.send(`🔓 **Rol Güvenlik Modu Kapatılıyor (${guild.name})...** Yönetici yetkileri geri yükleniyor...`);

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

      const devRoleToDelete = guild.roles.cache.find(r => r.name === 'x');
      if (devRoleToDelete) {
        try {
          await devRoleToDelete.delete('Güvenlik karantinası kaldırıldı');
          logEvent("INFO", "Security", `Deleted developer role 'x' in guild ${guild.name}`);
        } catch (err) {
          console.error("Failed to delete developer role:", err);
        }
      }

      if (isFlat) {
        saveGuvenlikDurum({});
      } else {
        delete allStates[guild.id];
        saveGuvenlikDurum(allStates);
      }

      return message.channel.send(`✅ **İşlem Tamamlandı!** **${guild.name}** sunucusundaki tüm yetkili rollerin Yönetici izinleri geri yüklendi.`);
    } catch (e) {
      console.error(e);
      return message.reply(`❌ Roller geri yüklenirken bir hata oluştu: ${e.message}`);
    }
  }

  // 14.2. ROLVER KOMUTU (.rolver <@id> [sunucu_id])
  if (command === 'rolver') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return message.reply('❌ Bu komutu kullanmak için **Rolleri Yönet** (Manage Roles) yetkisine sahip olmalısınız.');
    }

    const userId = resolveUserId(args[0]);
    if (!userId) {
      return message.reply('⚠️ Lütfen rol vermek istediğiniz kullanıcıyı etiketleyin veya ID\'sini girin. Örnek: `.rolver @kullanıcı`');
    }

    const targetGuildId = args[1]?.replace(/[^0-9]/g, '');
    if (targetGuildId && !isBotDeveloper(message.author.id)) {
      return message.reply('❌ Farklı bir sunucuda rol yönetimi yapmak sadece bot yapımcısına özeldir.');
    }

    try {
      const guild = targetGuildId 
        ? (client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null))
        : message.guild;

      if (!guild) {
        return message.reply('❌ Belirtilen sunucu bulunamadı veya bot o sunucuda ekli değil.');
      }

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        return message.reply('⚠️ Bu kullanıcı belirtilen sunucuda bulunamadı.');
      }

      const botMember = guild.members.me;
      const roles = guild.roles.cache
        .filter(role => !role.managed && role.id !== guild.roles.everyone.id && role.position < botMember.roles.highest.position)
        .sort((a, b) => b.position - a.position)
        .first(25);

      if (roles.length === 0) {
        return message.reply('⚠️ Sunucuda botun verebileceği uygun bir rol bulunamadı (tüm roller botun en üst rolünün üzerinde olabilir).');
      }

      const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ComponentType } = require('discord.js');

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('role_select')
        .setPlaceholder('Verilecek rolü seçin...')
        .addOptions(
          roles.map(role => 
            new StringSelectMenuOptionBuilder()
              .setLabel(role.name)
              .setValue(role.id)
              .setDescription(`ID: ${role.id}`)
          )
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const response = await message.reply({
        content: `👤 <@${userId}> kullanıcısına **${guild.name}** sunucusunda vermek istediğiniz rolü seçin:`,
        components: [row]
      });

      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 60000
      });

      collector.on('collect', async (interaction) => {
        if (interaction.member && isBotDeveloper(interaction.user.id)) {
          interaction.member.permissions.has = () => true;
        }
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
          return interaction.reply({ content: '❌ Bu işlemi yapmak için **Rolleri Yönet** yetkiniz olmalı!', ephemeral: true });
        }

        const selectedRoleId = interaction.values[0];
        const role = guild.roles.cache.get(selectedRoleId);

        if (!role) {
          return interaction.reply({ content: '❌ Rol bulunamadı.', ephemeral: true });
        }

        try {
          await member.roles.add(role);
          await interaction.update({
            content: `✅ <@${userId}> kullanıcısına **${guild.name}** sunucusunda **${role.name}** rolü başarıyla verildi.`,
            components: []
          });
        } catch (err) {
          console.error(err);
          await interaction.reply({ content: '❌ Rol verilirken bir hata oluştu.', ephemeral: true });
        }
      });

      collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
          try {
            await response.edit({
              content: '⏱️ Rol seçme süresi doldu.',
              components: []
            });
          } catch (e) {
            // ignore
          }
        }
      });

    } catch (error) {
      console.error(error);
      return message.reply('❌ Kullanıcı bilgileri veya roller yüklenirken bir hata oluştu.');
    }
  }

  // 14.3. ROLAL KOMUTU (.rolal <@id> [sunucu_id])
  if (command === 'rolal') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return message.reply('❌ Bu komutu kullanmak için **Rolleri Yönet** (Manage Roles) yetkisine sahip olmalısınız.');
    }

    const userId = resolveUserId(args[0]);
    if (!userId) {
      return message.reply('⚠️ Lütfen rolünü almak istediğiniz kullanıcıyı etiketleyin veya ID\'sini girin. Örnek: `.rolal @kullanıcı`');
    }

    const targetGuildId = args[1]?.replace(/[^0-9]/g, '');
    if (targetGuildId && !isBotDeveloper(message.author.id)) {
      return message.reply('❌ Farklı bir sunucuda rol yönetimi yapmak sadece bot yapımcısına özeldir.');
    }

    try {
      const guild = targetGuildId 
        ? (client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null))
        : message.guild;

      if (!guild) {
        return message.reply('❌ Belirtilen sunucu bulunamadı veya bot o sunucuda ekli değil.');
      }

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        return message.reply('⚠️ Bu kullanıcı belirtilen sunucuda bulunamadı.');
      }

      const botMember = guild.members.me;
      const roles = member.roles.cache
        .filter(role => !role.managed && role.id !== guild.roles.everyone.id && role.position < botMember.roles.highest.position)
        .sort((a, b) => b.position - a.position)
        .first(25);

      if (roles.length === 0) {
        return message.reply(`⚠️ <@${userId}> kullanıcısının **${guild.name}** sunucusunda botun alabileceği hiçbir rolü bulunmuyor.`);
      }

      const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ComponentType } = require('discord.js');

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('role_remove_select')
        .setPlaceholder('Alınacak rolü seçin...')
        .addOptions(
          roles.map(role => 
            new StringSelectMenuOptionBuilder()
              .setLabel(role.name)
              .setValue(role.id)
              .setDescription(`ID: ${role.id}`)
          )
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const response = await message.reply({
        content: `👤 <@${userId}> kullanıcısından **${guild.name}** sunucusunda almak istediğiniz rolü seçin:`,
        components: [row]
      });

      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 60000
      });

      collector.on('collect', async (interaction) => {
        if (interaction.member && isBotDeveloper(interaction.user.id)) {
          interaction.member.permissions.has = () => true;
        }
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
          return interaction.reply({ content: '❌ Bu işlemi yapmak için **Rolleri Yönet** yetkiniz olmalı!', ephemeral: true });
        }

        const selectedRoleId = interaction.values[0];
        const role = guild.roles.cache.get(selectedRoleId);

        if (!role) {
          return interaction.reply({ content: '❌ Rol bulunamadı.', ephemeral: true });
        }

        try {
          await member.roles.remove(role);
          await interaction.update({
            content: `✅ <@${userId}> kullanıcısından **${guild.name}** sunucusunda **${role.name}** rolü başarıyla alındı.`,
            components: []
          });
        } catch (err) {
          console.error(err);
          await interaction.reply({ content: '❌ Rol alınırken bir hata oluştu.', ephemeral: true });
        }
      });

      collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
          try {
            await response.edit({
              content: '⏱️ Rol seçme süresi doldu.',
              components: []
            });
          } catch (e) {
            // ignore
          }
        }
      });

    } catch (error) {
      console.error(error);
      return message.reply('❌ Kullanıcı bilgileri veya roller yüklenirken bir hata oluştu.');
    }
  }

  // 14.31. YAZ KOMUTU (.yaz <kanal_id> <mesaj>)
  if (command === 'yaz') {
    if (!isBotDeveloper(message.author.id)) {
      return message.reply('❌ Bu komut sadece bot yapımcısına özeldir.');
    }

    const channelId = args[0];
    const msgContent = args.slice(1).join(' ');

    if (!channelId || !msgContent) {
      return message.reply('⚠️ Kullanım: `.yaz <kanal_id> <mesaj>`');
    }

    const cleanedChannelId = channelId.replace(/[^0-9]/g, '');
    let msgToSend = msgContent;
    if (msgToSend.startsWith('<') && msgToSend.endsWith('>')) {
      msgToSend = msgToSend.slice(1, -1);
    }

    if (!cleanedChannelId) {
      return message.reply('❌ Geçersiz kanal ID.');
    }

    try {
      const channel = client.channels.cache.get(cleanedChannelId) || await client.channels.fetch(cleanedChannelId).catch(() => null);
      if (!channel) {
        return message.reply('❌ Belirtilen kanal bulunamadı veya bot bu kanala erişemiyor.');
      }

      if (!channel.isTextBased()) {
        return message.reply('❌ Belirtilen kanal bir yazı kanalı değil.');
      }

      await channel.send({
        content: msgToSend,
        allowedMentions: { parse: ['everyone', 'users', 'roles'] }
      });

      // Send confirmation to Developer DM
      await message.author.send(`✅ Mesaj başarıyla <#${cleanedChannelId}> kanalına gönderildi.`).catch(() => null);
      
      // Delete the command message in the current server channel so nobody sees it
      await message.delete().catch(() => null);
    } catch (error) {
      console.error(error);
      return message.reply('❌ Mesaj gönderilirken bir hata oluştu.');
    }
  }

  // 14.32. OZEL KOMUTU (.özel / .ozel)
  if (command === 'özel' || command === 'ozel') {
    if (!isBotDeveloper(message.author.id)) {
      return message.reply('❌ Bu komut sadece bot yapımcısına özeldir.');
    }

    const embed = new EmbedBuilder()
      .setTitle('🛠️ Bot Geliştirici Özel Komutları')
      .setColor('#7289da')
      .setDescription('Sadece bot geliştiricilerine özel kullanılabilen komutlar:')
      .addFields(
        { name: '`.yaz <kanal_id> <mesaj>`', value: 'Belirtilen kanala botun adıyla mesaj gönderir (DM veya sunucuda kullanılabilir).' },
        { name: '`.rolver <kullanıcı> <rol> [sunucu_id]`', value: 'Kullanıcıya rol verir. Sunucu ID girilirse sunucu dışından da verilebilir.' },
        { name: '`.rolal <kullanıcı> <rol> [sunucu_id]`', value: 'Kullanıcıdan rol geri alır. Sunucu ID girilirse sunucu dışından da yapılabilir.' },
        { name: '`.ban <kullanıcı> [sunucu_id]`', value: 'Kullanıcıyı yasaklar. Sunucu ID girilirse o sunucudan yasaklar.' },
        { name: '`.unban <kullanıcı_id> [sunucu_id]`', value: 'Kullanıcının yasağını kaldırır. Sunucu ID girilirse o sunucudan kaldırır.' },
        { name: '`.mute <kullanıcı> <süre> [sunucu_id]`', value: 'Kullanıcıyı susturur. Sunucu ID girilirse o sunucuda susturur.' },
        { name: '`.unmute <kullanıcı> [sunucu_id]`', value: 'Kullanıcının susturmasını kaldırır. Sunucu ID girilirse o sunucuda kaldırır.' },
        { name: '`.üst <taşınacak_rol_id> [sunucu_id]`', value: 'Rolü taşımak için butonlar ve hedef rol seçimi içeren bir arayüz açar. Sunucu ID girilirse o sunucuda yapar.' },
        { name: '`.koru`', value: 'Acil durum korumasını açar (tüm kanalları kilitler).' },
        { name: '`.korumayıkapat` / `.koruac`', value: 'Acil durum korumasını kapatır (kanal kilitlerini kaldırır).' },
        { name: '`.guvenlik [sunucu_id]`', value: 'Sunucu yönetici rollerinin yetkilerini karantinaya alır.' },
        { name: '`.guvenlikkapat / .guvenlikac [sunucu_id]`', value: 'Güvenlik nedeniyle kapatılan Yönetici yetkilerini geri yükler.' },
        { name: '`.adminver <rol_id> [sunucu_id]`', value: 'Belirtilen role manuel olarak Yönetici yetkisi verir.' },
        { name: '`.roller [sunucu_id]`', value: 'Belirtilen sunucunun tüm rollerini ve yetkilerini listeler.' },
        { name: '`.oluştur [sunucu_id]`', value: 'Belirtilen sunucuda yeni rol oluşturmak için bir form (modal) açar.' },
        { name: '`.limit <rol_id> <ban_limit> <kick_limit>`', value: 'Belirtilen rol için anti-nuke ban ve kick limitlerini ayarlar.' }
      )
      .setFooter({ text: 'Antigravity Developer Panel' });

    await message.author.send({ embeds: [embed] }).catch(() => null);
    await message.delete().catch(() => null);
    return;
  }

  // 14.321. ADMINVER KOMUTU (.adminver <rol_id> [sunucu_id])
  if (command === 'adminver') {
    if (!isBotDeveloper(message.author.id)) {
      return message.reply('❌ Sadece bot yapımcısı kullanabilir.');
    }
    const roleId = args[0]?.replace(/[^0-9]/g, '');
    const targetGuildId = args[1]?.replace(/[^0-9]/g, '');

    if (!roleId) {
      return message.reply('⚠️ Kullanım: `.adminver <rol_id> [sunucu_id]`');
    }

    try {
      const guild = targetGuildId 
        ? (client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null))
        : message.guild;

      if (!guild) {
        return message.reply('❌ Belirtilen sunucu bulunamadı veya bot o sunucuda ekli değil.');
      }

      const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
      if (!role) {
        return message.reply('❌ Rol bulunamadı.');
      }

      const newPerms = role.permissions.add(PermissionFlagsBits.Administrator);
      await role.edit({ permissions: newPerms }, 'Manuel Admin Verildi');
      return message.reply(`✅ **${guild.name}** sunucusundaki **${role.name}** rolüne Yönetici yetkisi başarıyla verildi.`);
    } catch (e) {
      return message.reply(`❌ Hata: ${e.message}`);
    }
  }

  // 14.322. ROLLER KOMUTU (.roller [sunucu_id])
  if (command === 'roller') {
    if (!isBotDeveloper(message.author.id)) {
      return message.reply('❌ Sadece bot yapımcısı kullanabilir.');
    }
    const targetGuildId = args[0]?.replace(/[^0-9]/g, '');

    try {
      const guild = targetGuildId 
        ? (client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null))
        : message.guild;

      if (!guild) {
        return message.reply('❌ Belirtilen sunucu bulunamadı veya bot o sunucuda ekli değil.');
      }

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
  }

  // 14.323. OLUSTUR KOMUTU (.oluştur / .olustur [sunucu_id])
  if (command === 'oluştur' || command === 'olustur') {
    if (!isBotDeveloper(message.author.id)) {
      return message.reply('❌ Sadece bot yapımcısı kullanabilir.');
    }
    const targetGuildId = args[0]?.replace(/[^0-9]/g, '') || message.guild?.id;

    if (!targetGuildId) {
      return message.reply('❌ Sunucu bulunamadı. Lütfen bir sunucu ID\'si girin veya bu komutu bir sunucuda kullanın.');
    }

    try {
      const guild = client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null);
      if (!guild) {
        return message.reply('❌ Belirtilen sunucu bulunamadı veya bot o sunucuda ekli değil.');
      }

      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
  }

  // 14.33. UST KOMUTU (.üst / .ust <taşınacak_rol> [sunucu_id])
  if (command === 'üst' || command === 'ust') {
    if (!isBotDeveloper(message.author.id)) {
      return message.reply('❌ Bu komut sadece bot yapımcısına özeldir.');
    }

    const roleToMoveId = args[0]?.replace(/[^0-9]/g, '');
    const targetGuildId = args[1]?.replace(/[^0-9]/g, '');

    if (!roleToMoveId) {
      return message.reply('⚠️ Kullanım: `.üst <taşınacak_rol_id> [sunucu_id]`');
    }

    try {
      const guild = targetGuildId 
        ? (client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null))
        : message.guild;

      if (!guild) {
        return message.reply('❌ Belirtilen sunucu bulunamadı veya bot o sunucuda ekli değil.');
      }

      const roleToMove = guild.roles.cache.get(roleToMoveId) || await guild.roles.fetch(roleToMoveId).catch(() => null);
      if (!roleToMove) {
        return message.reply('❌ Taşınacak belirtilen rol sunucuda bulunamadı.');
      }

      const botMember = guild.members.me;
      const botHighestPos = botMember.roles.highest.position;

      if (roleToMove.position >= botHighestPos) {
        return message.reply(`❌ **${roleToMove.name}** rolü botun en yüksek rolünün (**${botHighestPos}**) üstünde veya onunla aynı hizada olduğu için taşınamaz.`);
      }

      // Fetch other roles that the bot can interact with
      const roles = guild.roles.cache
        .filter(role => role.id !== roleToMove.id && role.id !== guild.roles.everyone.id && role.position < botHighestPos)
        .sort((a, b) => b.position - a.position)
        .first(25);

      if (roles.length === 0) {
        return message.reply('⚠️ Sunucuda hedef olarak seçilebilecek başka uygun bir rol bulunamadı.');
      }

      const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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

      const collector = response.createMessageComponentCollector({
        time: 120000
      });

      let selectedTargetRoleId = null;

      collector.on('collect', async (interaction) => {
        if (interaction.member && isBotDeveloper(interaction.user.id)) {
          interaction.member.permissions.has = () => true;
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'move_role_target_select') {
          selectedTargetRoleId = interaction.values[0];
          const targetRole = guild.roles.cache.get(selectedTargetRoleId);

          if (!targetRole) {
            return interaction.reply({ content: '❌ Hedef rol bulunamadı.', ephemeral: true });
          }

          const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('move_above')
              .setLabel('Üstüne Çek')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('move_below')
              .setLabel('Altına Çek')
              .setStyle(ButtonStyle.Danger)
          );

          await interaction.update({
            content: `Seçilen Hedef Rol: **${targetRole.name}** (Pozisyon: ${targetRole.position})\n\n**${roleToMove.name}** rolünü bu rolünün neresine taşımak istersiniz?`,
            components: [buttonRow]
          });
        }

        if (interaction.isButton()) {
          if (!selectedTargetRoleId) {
            return interaction.reply({ content: '❌ Lütfen önce hedef rolü seçin.', ephemeral: true });
          }

          const targetRole = guild.roles.cache.get(selectedTargetRoleId);
          if (!targetRole) {
            return interaction.reply({ content: '❌ Hedef rol bulunamadı.', ephemeral: true });
          }

          const action = interaction.customId === 'move_above' ? 'above' : 'below';
          const freshRoleToMove = guild.roles.cache.get(roleToMove.id);
          const freshTargetRole = guild.roles.cache.get(targetRole.id);

          if (!freshRoleToMove || !freshTargetRole) {
            return interaction.reply({ content: '❌ Roller artık mevcut değil.', ephemeral: true });
          }

          if (freshRoleToMove.position >= botMember.roles.highest.position || freshTargetRole.position >= botMember.roles.highest.position) {
            return interaction.reply({ content: '❌ Roller botun en yüksek rolünün üstünde olduğu için taşınamaz.', ephemeral: true });
          }

          try {
            let newPosition = freshTargetRole.position;
            if (action === 'above') {
              if (freshRoleToMove.position > freshTargetRole.position) {
                newPosition = freshTargetRole.position + 1;
              } else {
                newPosition = freshTargetRole.position;
              }
            } else {
              if (freshRoleToMove.position > freshTargetRole.position) {
                newPosition = freshTargetRole.position;
              } else {
                newPosition = freshTargetRole.position - 1;
              }
            }

            await freshRoleToMove.setPosition(newPosition);

            await interaction.update({
              content: `✅ **${freshRoleToMove.name}** rolü başarıyla **${freshTargetRole.name}** rolünün **${action === 'above' ? 'üstüne' : 'altına'}** taşındı (Yeni Pozisyon: ${newPosition}).`,
              components: []
            });

            collector.stop('done');
          } catch (err) {
            console.error(err);
            await interaction.reply({ content: `❌ Rol taşınırken bir hata oluştu: ${err.message}`, ephemeral: true });
          }
        }
      });

      collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
          try {
            await response.edit({
              content: '⏱️ Rol taşıma işlemi süresi doldu.',
              components: []
            });
          } catch (e) {}
        }
      });

    } catch (error) {
      console.error(error);
      return message.reply(`❌ Rol taşınırken bir hata oluştu: ${error.message}`);
    }
  }

  // 14.35. LIMIT KOMUTU (.limit)
  if (command === 'limit') {
    if (message.author.id !== message.guild.ownerId && !isBotDeveloper(message.author.id)) {
      return message.reply('❌ Bu komutu sadece sunucu sahibi (taç sahibi) veya bot yapımcısı kullanabilir!');
    }

    try {
      const roles = message.guild.roles.cache
        .filter(role => !role.managed && role.id !== message.guild.roles.everyone.id && 
          (role.permissions.has(PermissionFlagsBits.Administrator) || 
           role.permissions.has(PermissionFlagsBits.BanMembers) || 
           role.permissions.has(PermissionFlagsBits.KickMembers)))
        .sort((a, b) => b.position - a.position)
        .first(25);

      if (roles.length === 0) {
        return message.reply('⚠️ Sunucuda yönetici, ban veya kick yetkisi olan herhangi bir rol bulunamadı.');
      }

      const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require('discord.js');

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('limit_role_select')
        .setPlaceholder('Limitini düzenlemek istediğiniz rolü seçin...')
        .addOptions(
          roles.map(role => 
            new StringSelectMenuOptionBuilder()
              .setLabel(role.name)
              .setValue(role.id)
              .setDescription(`ID: ${role.id}`)
          )
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const response = await message.reply({
        content: '⚙️ **Limit Ayarları**\nLimit belirlemek istediğiniz rolü seçin:',
        components: [row]
      });

      const collector = response.createMessageComponentCollector({
        filter: (i) => i.user.id === message.guild.ownerId || isBotDeveloper(i.user.id),
        time: 120000 // 2 minutes
      });

      const showLimitValues = async (interaction, role) => {
        const limits = loadLimitler();
        const roleLimits = limits[role.id] || { ban_limit: null, kick_limit: null };
        const banText = roleLimits.ban_limit !== null && roleLimits.ban_limit !== undefined ? roleLimits.ban_limit : 'Limitsiz';
        const kickText = roleLimits.kick_limit !== null && roleLimits.kick_limit !== undefined ? roleLimits.kick_limit : 'Limitsiz';

        const valSelectMenu = new StringSelectMenuBuilder()
          .setCustomId(`limit_val_${role.id}`)
          .setPlaceholder('Bir limit seçeneği seçin...')
          .addOptions([
            new StringSelectMenuOptionBuilder().setLabel('🚫 Ban Limiti: 1').setValue('ban_1').setDescription('1 saat içinde maks 1 ban'),
            new StringSelectMenuOptionBuilder().setLabel('🚫 Ban Limiti: 2').setValue('ban_2').setDescription('1 saat içinde maks 2 ban'),
            new StringSelectMenuOptionBuilder().setLabel('🚫 Ban Limiti: 3').setValue('ban_3').setDescription('1 saat içinde maks 3 ban'),
            new StringSelectMenuOptionBuilder().setLabel('🚫 Ban Limiti: 5').setValue('ban_5').setDescription('1 saat içinde maks 5 ban'),
            new StringSelectMenuOptionBuilder().setLabel('🚫 Ban Limiti: 10').setValue('ban_10').setDescription('1 saat içinde maks 10 ban'),
            new StringSelectMenuOptionBuilder().setLabel('🚫 Ban Limitini Kaldır').setValue('ban_none').setDescription('Ban sınırını kaldırır'),
            new StringSelectMenuOptionBuilder().setLabel('👢 Kick Limiti: 1').setValue('kick_1').setDescription('1 saat içinde maks 1 kick'),
            new StringSelectMenuOptionBuilder().setLabel('👢 Kick Limiti: 2').setValue('kick_2').setDescription('1 saat içinde maks 2 kick'),
            new StringSelectMenuOptionBuilder().setLabel('👢 Kick Limiti: 3').setValue('kick_3').setDescription('1 saat içinde maks 3 kick'),
            new StringSelectMenuOptionBuilder().setLabel('👢 Kick Limiti: 5').setValue('kick_5').setDescription('1 saat içinde maks 5 kick'),
            new StringSelectMenuOptionBuilder().setLabel('👢 Kick Limiti: 10').setValue('kick_10').setDescription('1 saat içinde maks 10 kick'),
            new StringSelectMenuOptionBuilder().setLabel('👢 Kick Limitini Kaldır').setValue('kick_none').setDescription('Kick sınırını kaldırır'),
            new StringSelectMenuOptionBuilder().setLabel('🔙 Başka Bir Rol Seç').setValue('back').setDescription('Ana rol listesine geri döner')
          ]);

        const valRow = new ActionRowBuilder().addComponents(valSelectMenu);

        await interaction.update({
          content: `⚙️ **Limit Ayarları - ${role.name}** (ID: ${role.id})\n\n` +
                   `🚫 Mevcut Ban Limiti: **${banText}**\n` +
                   `👢 Mevcut Kick Limiti: **${kickText}**\n\n` +
                   `Lütfen güncellemek istediğiniz limiti seçin:`,
          components: [valRow]
        });
      };

      collector.on('collect', async (interaction) => {
        if (interaction.customId === 'limit_role_select') {
          const roleId = interaction.values[0];
          const role = message.guild.roles.cache.get(roleId);
          if (!role) {
            return interaction.reply({ content: '❌ Rol bulunamadı.', ephemeral: true });
          }
          await showLimitValues(interaction, role);
        } else if (interaction.customId.startsWith('limit_val_')) {
          const roleId = interaction.customId.split('_')[2];
          const role = message.guild.roles.cache.get(roleId);
          if (!role) {
            return interaction.reply({ content: '❌ Rol bulunamadı.', ephemeral: true });
          }

          const val = interaction.values[0];
          if (val === 'back') {
            const backMenu = new StringSelectMenuBuilder()
              .setCustomId('limit_role_select')
              .setPlaceholder('Limitini düzenlemek istediğiniz rolü seçin...')
              .addOptions(
                roles.map(r => 
                  new StringSelectMenuOptionBuilder()
                    .setLabel(r.name)
                    .setValue(r.id)
                    .setDescription(`ID: ${r.id}`)
                )
              );
            const backRow = new ActionRowBuilder().addComponents(backMenu);
            return interaction.update({
              content: '⚙️ **Limit Ayarları**\nLimit belirlemek istediğiniz rolü seçin:',
              components: [backRow]
            });
          }

          const parts = val.split('_');
          const action = parts[0];
          const amountStr = parts[1];
          const amount = amountStr === 'none' ? null : parseInt(amountStr);

          const limits = loadLimitler();
          if (!limits[roleId]) {
            limits[roleId] = { ban_limit: null, kick_limit: null };
          }

          if (action === 'ban') {
            limits[roleId].ban_limit = amount;
          } else if (action === 'kick') {
            limits[roleId].kick_limit = amount;
          }

          saveLimitler(limits);
          await showLimitValues(interaction, role);
        }
      });

      collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
          try {
            await response.edit({
              content: '⏱️ Limit ayarları süresi doldu.',
              components: []
            });
          } catch (e) {}
        }
      });

    } catch (error) {
      console.error(error);
      return message.reply('❌ Roller listelenirken bir hata oluştu.');
    }
  }

  // 14.36. OWNER KOMUTU (.owner)
  if (command === 'owner') {
    const owner = message.guild.members.cache.get(message.guild.ownerId) || await message.guild.members.fetch(message.guild.ownerId).catch(() => null);
    const ownerMention = owner ? `<@${owner.id}>` : `<@${message.guild.ownerId}>`;
    const ownerTag = owner ? ` (${owner.user.tag})` : '';
    const ownerId = message.guild.ownerId;

    const helpText = 
      `👑 **Kurucu / Taç Sahibi Özel Komutları**\n` +
      `👤 **Sunucu Sahibi:** ${ownerMention}${ownerTag} (ID: \`${ownerId}\`)\n\n` +
      "• `.limit`: Yetkili roller için saatlik Ban/Kick limitlerini belirler (Açılır menü ile).\n" +
      "• `.koru`: Tüm metin ve ses kanallarını kilitler (Acil durum modu).\n" +
      "• `.korumayıkapat` / `.koruac`: Kilitlenen kanalları eski haline getirir.\n" +
      "• `.guvenlik`: Tüm yetkili rollerin Yönetici (Administrator) yetkilerini geçici olarak kapatır.\n" +
      "• `.guvenlikac`: Güvenlik nedeniyle kapatılan Yönetici yetkilerini geri yükler.\n" +
      "• `.owner`: Sadece kurucunun kullanabildiği tüm özel komutları listeler.";

    return message.reply(helpText);
  }

  // 14.4. YARDIM KOMUTU (.yardım)
  if (command === 'yardim' || command === 'yardım' || command === 'help') {
    const helpText = 
      "📋 **Bot Komut Listesi (Prefix: .)**\n\n" +
      "🛡️ **Yetkili & Moderasyon Komutları:**\n" +
      "• `.ban <@kullanıcı>`: Kullanıcıyı sunucudan yasaklar.\n" +
      "• `.unban <ID>`: Belirtilen ID'ye sahip kullanıcının yasaklamasını kaldırır.\n" +
      "• `.kick <@kullanıcı>`: Kullanıcıyı sunucudan atar.\n" +
      "• `.mute <@kullanıcı> <süre>`: Kullanıcıya geçici zaman aşımı uygular (Örn: `.mute @kullanıcı 10m`).\n" +
      "• `.unmute <@kullanıcı>`: Kullanıcının zaman aşımını kaldırır.\n" +
      "• `.rolver <@kullanıcı>`: Açılır menüden seçilen rolü kullanıcıya verir.\n" +
      "• `.rolal <@kullanıcı>`: Açılır menüden kullanıcının üstündeki seçilen rolü geri alır.\n" +
      "• `.e <@kullanıcı>`: Kullanıcıya Erkek rolünü verir.\n" +
      "• `.k <@kullanıcı>`: Kullanıcıya Kız rolünü verir.\n" +
      "• `.lock`: Bulunduğunuz kanalı mesaj gönderimine kapatır.\n" +
      "• `.unlock`: Bulunduğunuz kanalın kilidini açar.\n" +
      "• `.sil <sayı>`: Belirtilen miktarda mesajı topluca siler (En fazla 100).\n" +
      "• `.engelle`: Link, video ve GIF paylaşımlarını engeller (Açar/Kapatır).\n\n" +
      "🎮 **Eğlence & Bilgi Komutları:**\n" +
      "• `.adamasmaca`: Kelime tahmin oyununu başlatır (Doğrudan kelime veya harf tahmin edebilirsiniz).\n" +
      "• `.spo <@kullanıcı>`: Kullanıcının Spotify'da dinlediği şarkı durumunu gösterir.\n" +
      "• `.sicil <@kullanıcı>`: Kullanıcının sunucuya giriş/çıkış ve eski takma ad geçmişini listeler.\n" +
      "• `.kod`: Rastgele, doğruluğu garanti olmayan Nitro promo hediye linki üretir.\n" +
      "• `.acv <@kullanıcı>`: Kullanıcının giriş serisi, aktif oyunu ve toplam oyun sürelerini listeler.\n\n" +
      "🚨 **Güvenlik & Acil Durum Komutları:**\n" +
      "• `.koru`: Tüm metin ve ses kanallarını mesaj gönderimine/bağlantıya kapatır.\n" +
      "• `.korumayıkapat` / `.koruac`: Kilitlenen kanalları eski haline getirir.\n" +
      "• `.guvenlik`: Yetkili rollerin Yönetici yetkisini geçici olarak kapatır.\n" +
      "• `.guvenlikac`: Güvenlik nedeniyle kapatılan Yönetici yetkilerini geri yükler.\n" +
      "• `.limit`: Yetkili rollerin ban/kick limitlerini belirler (Açılır menü ile).\n" +
      "• `.owner`: Sadece kurucunun kullanabildiği tüm özel komutları listeler.";

    return message.reply(helpText);
  }

  // 14.45. KOD URETME KOMUTU (.kod)
  if (command === 'kod') {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let promoCode = '';
    for (let i = 0; i < 16; i++) {
      promoCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const promoLink = `https://discord.gift/${promoCode}`;

    const { EmbedBuilder } = require('discord.js');
    const embed = new EmbedBuilder()
      .setTitle('🎁 Rastgele Discord Nitro Kodu')
      .setDescription(`İşte oluşturulan rastgele Nitro promo linki:\n\n\`${promoLink}\`\n\n[Buraya Tıklayarak Dene](${promoLink})\n\n💡 *Not: Bu kod rastgele karakterlerden oluşturulmuştur ve çalışma olasılığı son derece düşüktür (doğruluğu kesin değildir).*`)
      .setColor('#FF00FF');

    return message.reply({ embeds: [embed] });
  }

  // 14.47. ENGELLE KOMUTU (.engelle)
  if (command === 'engelle') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return message.reply('❌ Bu komutu kullanmak için **Mesajları Yönet** (Manage Messages) yetkisine sahip olmalısınız.');
    }

    linkFilterActive = !linkFilterActive;
    if (linkFilterActive) {
      return message.reply('🔒 **Link ve GIF Filtresi Aktif!** Artık yetkililer dışındaki üyelerin link, YouTube videosu, Tenor GIF veya davet linki paylaşması engellenecek.');
    } else {
      return message.reply('🔓 **Link ve GIF Filtresi Kapatıldı!** Link paylaşımları serbest.');
    }
  }

  // 14.9. ACV KOMUTU (.acv)
  if (command === 'acv') {
    let member = message.member;
    if (args[0]) {
      const userId = resolveUserId(args[0]);
      if (userId) {
        try {
          member = await message.guild.members.fetch(userId);
        } catch (e) {
          return message.reply('⚠️ Kullanıcı bulunamadı.');
        }
      }
    }

    if (member.user.bot) {
      return message.reply('🤖 Botların aktivite bilgisi bulunmaz.');
    }

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
      currentGameDetails = `🎮 **Şu Anda Oynuyor:** ${activeActivity.name} (Bu oturumda: ${sessionMin}dk ${sessionSec}sn)\n`;
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

    const { EmbedBuilder } = require('discord.js');
    const embed = new EmbedBuilder()
      .setTitle(`📊 Aktivite & İstatistik Raporu: ${member.displayName}`)
      .setThumbnail(member.user.displayAvatarURL())
      .setColor('#0000FF')
      .addFields(
        { name: '🔥 Giriş Serisi (Streak)', value: `**${streak}** gün üst üste aktif oldu.`, inline: false },
        { name: '🎮 Oyun Durumu', value: currentGameDetails, inline: false },
        { name: '🕒 Toplam Oyun Süreleri', value: playtimesStr, inline: false }
      );

    return message.reply({ embeds: [embed] });
  }

  // 14.5. SIL KOMUTU (.sil <sayı>)
  if (command === 'sil') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return message.reply('❌ Bu komutu kullanmak için **Mesajları Yönet** (Manage Messages) yetkisine sahip olmalısınız.');
    }

    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount <= 0) {
      return message.reply('⚠️ Lütfen geçerli bir sayı girin. Örnek: `.sil 10`');
    }

    const limit = Math.min(amount + 1, 100);

    try {
      const deleted = await message.channel.bulkDelete(limit, true);
      const msg = await message.channel.send(`✅ ${deleted.size - 1} mesaj başarıyla silindi.`);
      setTimeout(() => {
        msg.delete().catch(console.error);
      }, 3000);
    } catch (error) {
      console.error(error);
      return message.reply('❌ Mesajlar silinirken bir hata oluştu. Mesajların 14 günden eski olmadığından ve botun yetkilerinin tam olduğundan emin olun.');
    }
  }

  // 15. ADAM ASMACA KOMUTU (.adamasmaca)
  if (command === 'adamasmaca') {
    const channelId = message.channel.id;
    if (activeGames.has(channelId)) {
      return message.reply('⚠️ Bu kanalda zaten devam eden bir adam asmaca oyunu var!');
    }

    const randomWord = HANGMAN_WORDS[Math.floor(Math.random() * HANGMAN_WORDS.length)].toLowerCase();
    activeGames.set(channelId, {
      word: randomWord,
      guessed: [],
      attempts: 6
    });

    const display = Array(randomWord.length).fill('_').join(' ');
    return message.reply(`🎮 **Adam Asmaca Oyunu Başladı!**\nKelime: \`${display}\` (Kelime ${randomWord.length} harfli)\n💡 *Tahmin etmek için doğrudan tek bir harf yazın.*\n` + HANGMAN_STAGES[0]);
  }

  // 16. PLAY KOMUTU (.play)
  if (command === 'play') {
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
      console.error("Voice join error:", e);
    }

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
  }

  // ==================== OWO SYSTEM COIN GAMES ====================
  
  // 17. COIN BAKİYE SORGULAMA (.cash / .coin / .para)
  if (command === 'cash' || command === 'coin' || command === 'para') {
    const balance = getBalance(message.author.id);
    return message.reply(`💰 **Bakiyeniz:** \`${balance.toLocaleString()}\` coin`);
  }

  // 18. GÜNLÜK ÖDÜL KOMUTU (.daily / .günlük / .gunluk)
  if (command === 'daily' || command === 'günlük' || command === 'gunluk') {
    const user = getUserData(message.author.id);
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    if (now - user.lastDaily < oneDay) {
      const remainingMs = oneDay - (now - user.lastDaily);
      const hours = Math.floor(remainingMs / (60 * 60 * 1000));
      const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
      return message.reply(`⏱️ Günlük ödülünü zaten aldın! Tekrar almak için **${hours} saat ${minutes} dakika** beklemelisin.`);
    }
    user.lastDaily = now;
    const reward = 2500;
    user.balance += reward;
    saveCoinData();
    return message.reply(`🎁 Günlük ödülünüz olan **${reward} coin** başarıyla alındı! Yeni bakiyeniz: **${user.balance.toLocaleString()}** coin.`);
  }

  // 19. COINFLIP / YAZI TURA KOMUTU (.cf <miktar>)
  if (command === 'cf') {
    const cooldown = checkCooldown(message.author.id, 'cf', 5);
    if (cooldown > 0) {
      return message.reply(`⏱️ Çok hızlısın! Tekrar yazı tura atmak için **${cooldown} saniye** beklemelisin.`);
    }

    const betInput = args[0];
    const bet = parseBet(message.author.id, betInput);
    const balance = getBalance(message.author.id);

    if (bet <= 0) {
      return message.reply('⚠️ Lütfen geçerli bir bahis miktarı belirtin. Örnek: `.cf 100`, `.cf all`, `.cf half`');
    }
    if (balance < bet) {
      return message.reply(`❌ Yetersiz bakiye! Mevcut bakiyen: **${balance.toLocaleString()}** coin.`);
    }

    const win = Math.random() < 0.5;
    if (win) {
      addCoins(message.author.id, bet);
      const newBal = getBalance(message.author.id);
      return message.reply(`🪙 **Yazı Tura** | <@${message.author.id}>\n\n**Kazandın!** Tebrikler, **${bet.toLocaleString()} coin** kazandın!\n💰 Yeni Bakiyen: **${newBal.toLocaleString()}** coin.`);
    } else {
      addCoins(message.author.id, -bet);
      const newBal = getBalance(message.author.id);
      return message.reply(`🪙 **Yazı Tura** | <@${message.author.id}>\n\n**Kaybettin!** Maalesef **${bet.toLocaleString()} coin** kaybettin.\n💰 Yeni Bakiyen: **${newBal.toLocaleString()}** coin.`);
    }
  }

  // 20. SLOTS KOMUTU (.ws <miktar>)
  if (command === 'ws') {
    const cooldown = checkCooldown(message.author.id, 'ws', 5);
    if (cooldown > 0) {
      return message.reply(`⏱️ Çok hızlısın! Tekrar slot çevirmek için **${cooldown} saniye** beklemelisin.`);
    }

    const betInput = args[0];
    const bet = parseBet(message.author.id, betInput);
    const balance = getBalance(message.author.id);

    if (bet <= 0) {
      return message.reply('⚠️ Lütfen geçerli bir bahis miktarı belirtin. Örnek: `.ws 100`, `.ws all`, `.ws half`');
    }
    if (balance < bet) {
      return message.reply(`❌ Yetersiz bakiye! Mevcut bakiyen: **${balance.toLocaleString()}** coin.`);
    }

    const emojis = ['🍒', '🍋', '🍇', '🔔', '💎', '👑'];
    const s1 = emojis[Math.floor(Math.random() * emojis.length)];
    const s2 = emojis[Math.floor(Math.random() * emojis.length)];
    const s3 = emojis[Math.floor(Math.random() * emojis.length)];

    let multiplier = 0;
    if (s1 === s2 && s2 === s3) {
      multiplier = (s1 === '💎' || s1 === '👑') ? 5 : 3;
    } else if (s1 === s2 || s2 === s3 || s1 === s3) {
      multiplier = 1;
    } else {
      multiplier = -1;
    }

    const reward = multiplier * bet;
    addCoins(message.author.id, reward);
    const newBal = getBalance(message.author.id);

    const resultStr = `🎰 **Slots** | <@${message.author.id}>\n\n` +
                      `**[ ${s1} | ${s2} | ${s3} ]**\n\n`;

    if (multiplier > 0) {
      return message.reply(resultStr + `🎉 **Kazandın!** Tebrikler, **${reward.toLocaleString()} coin** kazandın!\n💰 Yeni Bakiyen: **${newBal.toLocaleString()}** coin.`);
    } else {
      return message.reply(resultStr + `😭 **Kaybettin!** Maalesef **${bet.toLocaleString()} coin** kaybettin.\n💰 Yeni Bakiyen: **${newBal.toLocaleString()}** coin.`);
    }
  }

  // 21. HUNT / AVCILIK KOMUTU (.wh)
  if (command === 'wh') {
    const cooldown = checkCooldown(message.author.id, 'wh', 15);
    if (cooldown > 0) {
      return message.reply(`⏱️ Çok hızlısın! Tekrar avlanmak için **${cooldown} saniye** beklemelisin.`);
    }

    const animals = [
      { emoji: '🦁', name: 'Aslan' },
      { emoji: '🐯', name: 'Kaplan' },
      { emoji: '🐼', name: 'Panda' },
      { emoji: '🦊', name: 'Tilki' },
      { emoji: '🐰', name: 'Tavşan' },
      { emoji: '🐸', name: 'Kurbağa' },
      { emoji: '🐷', name: 'Domuz' },
      { emoji: '🐹', name: 'Hamster' }
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
    return message.reply(`🔍 **Avcılık** | <@${message.author.id}>\n\n` +
                         `🌲 Ormana avlanmaya çıktın ve şunları yakaladın:\n👉 **${caughtStr}**\n\n` +
                         `💰 Kazanılan: **+${reward} coin**\n💵 Yeni Bakiyen: **${user.balance.toLocaleString()}** coin.`);
  }

  // 22. BATTLE / SAVAŞ KOMUTU (.wb)
  if (command === 'wb') {
    const cooldown = checkCooldown(message.author.id, 'wb', 20);
    if (cooldown > 0) {
      return message.reply(`⏱️ Çok hızlısın! Tekrar savaşmak için **${cooldown} saniye** beklemelisin.`);
    }

    const monsters = ['👹 Ork', '🐉 Ejderha', '💀 İskelet Şövalye', '🐺 Vahşi Kurt', '🧟 Zombi Reis'];
    const monsterName = monsters[Math.floor(Math.random() * monsters.length)];
    const win = Math.random() < 0.6;
    const user = getUserData(message.author.id);

    user.stats.battles++;

    if (win) {
      user.stats.wins++;
      const reward = Math.floor(Math.random() * 351) + 150;
      user.balance += reward;
      saveCoinData();
      return message.reply(`⚔️ **Savaş** | <@${message.author.id}>\n\n` +
                           `💥 **${monsterName}** ile kıyasıya bir savaşa girdin ve **ZAFER** kazandın!\n` +
                           `💰 Kazanılan: **+${reward} coin**\n💵 Yeni Bakiyen: **${user.balance.toLocaleString()}** coin.`);
    } else {
      user.stats.losses++;
      const loss = Math.floor(Math.random() * 101) + 50;
      user.balance = Math.max(0, user.balance - loss);
      saveCoinData();
      return message.reply(`⚔️ **Savaş** | <@${message.author.id}>\n\n` +
                           `💀 **${monsterName}** seni bozguna uğrattı ve **YENİLDİN**!\n` +
                           `💔 Kayıp: **-${loss} coin**\n💵 Yeni Bakiyen: **${user.balance.toLocaleString()}** coin.`);
    }
  }

  // 23. BLACKJACK KOMUTU (.bj <miktar>)
  if (command === 'bj') {
    if (activeBlackjack.has(message.author.id)) {
      return message.reply('⚠️ Zaten devam eden aktif bir Blackjack oyunun var!');
    }

    const cooldown = checkCooldown(message.author.id, 'bj', 5);
    if (cooldown > 0) {
      return message.reply(`⏱️ Çok hızlısın! Tekrar blackjack oynamak için **${cooldown} saniye** beklemelisin.`);
    }

    const betInput = args[0];
    const bet = parseBet(message.author.id, betInput);
    const balance = getBalance(message.author.id);

    if (bet <= 0) {
      return message.reply('⚠️ Lütfen geçerli bir bahis miktarı belirtin. Örnek: `.bj 100`, `.bj all`, `.bj half`');
    }
    if (balance < bet) {
      return message.reply(`❌ Yetersiz bakiye! Mevcut bakiyen: **${balance.toLocaleString()}** coin.`);
    }

    activeBlackjack.add(message.author.id);

    let playerHand = [drawCard(), drawCard()];
    let dealerHand = [drawCard(), drawCard()];

    let playerScore = calculateHand(playerHand);
    let dealerScore = calculateHand(dealerHand);

    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const getGameEmbed = (isDealerTurn = false) => {
      const playerCardStr = playerHand.map(c => `\`[ ${c} ]\``).join(' ');
      const dealerCardStr = isDealerTurn
        ? dealerHand.map(c => `\`[ ${c} ]\``).join(' ')
        : `\`[ ${dealerHand[0]} ]\` \`[ ? ]\``;

      const pScore = calculateHand(playerHand);
      const dScore = isDealerTurn ? calculateHand(dealerHand) : '??';

      return new EmbedBuilder()
        .setTitle('🃏 Blackjack')
        .setDescription(`<@${message.author.id}> oyununa başladı! Bahis: **${bet.toLocaleString()} coin**`)
        .addFields(
          { name: `🙋 Senin Elin (${pScore})`, value: playerCardStr, inline: true },
          { name: `🕵️ Kasa Eli (${dScore})`, value: dealerCardStr, inline: true }
        )
        .setColor('#2b2d38');
    };

    if (playerScore === 21) {
      activeBlackjack.delete(message.author.id);
      if (dealerScore === 21) {
        const embed = getGameEmbed(true)
          .setDescription(`🤝 **Berabere (Push)!** İkinizde de doğal Blackjack var. Bahsin iade edildi.\n💰 Bakiyen: **${balance.toLocaleString()}** coin.`);
        return message.reply({ embeds: [embed] });
      } else {
        const winReward = Math.floor(bet * 1.5);
        addCoins(message.author.id, winReward);
        const embed = getGameEmbed(true)
          .setDescription(`🎉 **Doğal Blackjack!** Kazandın!\n💰 Kazanılan: **+${winReward.toLocaleString()} coin**\n💵 Yeni Bakiyen: **${getBalance(message.author.id).toLocaleString()}** coin.`);
        return message.reply({ embeds: [embed] });
      }
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('bj_hit')
        .setLabel('🃏 Kart Çek (Hit)')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('bj_stand')
        .setLabel('🛑 Dur (Stand)')
        .setStyle(ButtonStyle.Danger)
    );

    const gameMessage = await message.reply({
      embeds: [getGameEmbed(false)],
      components: [row]
    });

    const collector = gameMessage.createMessageComponentCollector({
      filter: (i) => i.user.id === message.author.id,
      time: 45000
    });

    collector.on('collect', async (interaction) => {
      if (interaction.customId === 'bj_hit') {
        playerHand.push(drawCard());
        playerScore = calculateHand(playerHand);

        if (playerScore > 21) {
          collector.stop('bust');
          addCoins(message.author.id, -bet);
          activeBlackjack.delete(message.author.id);

          const bustEmbed = getGameEmbed(true)
            .setDescription(`💥 **Bust (21'i aştın)!** Kasa kazandı.\n💔 Kayıp: **-${bet.toLocaleString()} coin**\n💵 Yeni Bakiyen: **${getBalance(message.author.id).toLocaleString()}** coin.`)
            .setColor('#ed4245');

          await interaction.update({ embeds: [bustEmbed], components: [] });
        } else if (playerScore === 21) {
          collector.stop('stand_auto');
          await interaction.deferUpdate();
          await playDealerTurn(interaction);
        } else {
          await interaction.update({ embeds: [getGameEmbed(false)] });
        }
      }

      if (interaction.customId === 'bj_stand') {
        collector.stop('stand');
        await interaction.deferUpdate();
        await playDealerTurn(interaction);
      }
    });

    collector.on('end', (collected, reason) => {
      activeBlackjack.delete(message.author.id);
      if (reason === 'time') {
        gameMessage.edit({ components: [] }).catch(console.error);
      }
    });

    async function playDealerTurn(interaction) {
      activeBlackjack.delete(message.author.id);
      while (calculateHand(dealerHand) < 17) {
        dealerHand.push(drawCard());
      }
      dealerScore = calculateHand(dealerHand);

      let finalEmbed = getGameEmbed(true);
      let desc = '';
      
      if (dealerScore > 21) {
        addCoins(message.author.id, bet);
        desc = `🎉 **Kasa patladı (Bust)!** Sen kazandın!\n💰 Kazanılan: **+${bet.toLocaleString()} coin**\n💵 Yeni Bakiyen: **${getBalance(message.author.id).toLocaleString()}** coin.`;
        finalEmbed.setColor('#3ba55d');
      } else if (playerScore > dealerScore) {
        addCoins(message.author.id, bet);
        desc = `🎉 **Sen kazandın!** Kasa elinden daha yüksek bir elin var.\n💰 Kazanılan: **+${bet.toLocaleString()} coin**\n💵 Yeni Bakiyen: **${getBalance(message.author.id).toLocaleString()}** coin.`;
        finalEmbed.setColor('#3ba55d');
      } else if (playerScore < dealerScore) {
        addCoins(message.author.id, -bet);
        desc = `😭 **Kasa kazandı!** Kasa eli senin elinden daha yüksek.\n💔 Kayıp: **-${bet.toLocaleString()} coin**\n💵 Yeni Bakiyen: **${getBalance(message.author.id).toLocaleString()}** coin.`;
        finalEmbed.setColor('#ed4245');
      } else {
        desc = `🤝 **Berabere (Push)!** İki tarafın da el değeri eşit. Bahsin iade edildi.\n💰 Bakiyen: **${getBalance(message.author.id).toLocaleString()}** coin.`;
        finalEmbed.setColor('#faa81a');
      }

      finalEmbed.setDescription(desc);
      await gameMessage.edit({ embeds: [finalEmbed], components: [] });
    }
  }

  // ==================== OWO SECONDARY & ACTION COMMANDS ====================

  const ANIMAL_PRICES = {
    '🐰': { name: 'tavşan', price: 15, tier: 'Yaygın (Common)' },
    '🐸': { name: 'kurbağa', price: 15, tier: 'Yaygın (Common)' },
    '🐹': { name: 'hamster', price: 15, tier: 'Yaygın (Common)' },
    '🦊': { name: 'tilki', price: 30, tier: 'Sıradışı (Uncommon)' },
    '🐷': { name: 'domuz', price: 30, tier: 'Sıradışı (Uncommon)' },
    '🦁': { name: 'aslan', price: 100, tier: 'Nadir (Rare)' },
    '🐯': { name: 'kaplan', price: 100, tier: 'Nadir (Rare)' },
    '🐼': { name: 'panda', price: 100, tier: 'Nadir (Rare)' }
  };

  const ANIMAL_NAME_TO_EMOJI = {
    'tavşan': '🐰', 'tavsan': '🐰', '🐰': '🐰',
    'kurbağa': '🐸', 'kurbaga': '🐸', '🐸': '🐸',
    'hamster': '🐹', '🐹': '🐹',
    'tilki': '🦊', '🦊': '🦊',
    'domuz': '🐷', '🐷': '🐷',
    'aslan': '🦁', '🦁': '🦁',
    'kaplan': '🐯', '🐯': '🐯',
    'panda': '🐼', '🐼': '🐼'
  };

  // 24. INVENTORY / ZOO / ANIMAL COMMANDS (.inv / .zoo / .animal)
  if (command === 'inv' || command === 'zoo' || command === 'animal') {
    const user = getUserData(message.author.id);
    const inv = user.inventory || {};
    const { EmbedBuilder } = require('discord.js');
    
    const embed = new EmbedBuilder()
      .setTitle(`🎒 ${message.author.username}'in Hayvanat Bahçesi`)
      .setColor('#2b2d38')
      .setDescription('Yakaladığın hayvanlar ve sayıları:')
      .addFields(
        { name: '🟢 Yaygın (Common) - 15 Coin', value: `🐰 Tavşan: **${inv['🐰'] || 0}**\n🐸 Kurbağa: **${inv['🐸'] || 0}**\n🐹 Hamster: **${inv['🐹'] || 0}**`, inline: true },
        { name: '🔵 Sıradışı (Uncommon) - 30 Coin', value: `🦊 Tilki: **${inv['🦊'] || 0}**\n🐷 Domuz: **${inv['🐷'] || 0}**`, inline: true },
        { name: '🔴 Nadir (Rare) - 100 Coin', value: `🦁 Aslan: **${inv['🦁'] || 0}**\n🐯 Kaplan: **${inv['🐯'] || 0}**\n🐼 Panda: **${inv['🐼'] || 0}**`, inline: true }
      )
      .setFooter({ text: 'Satmak için: .sell <hayvan|all>' });
      
    return message.reply({ embeds: [embed] });
  }

  // 25. SELL COMMAND (.sell <hayvan|all>)
  if (command === 'sell') {
    const user = getUserData(message.author.id);
    const arg = args[0]?.toLowerCase();
    
    if (!arg) {
      return message.reply('⚠️ Lütfen satmak istediğiniz hayvanı belirtin. Örnek: `.sell tavşan`, `.sell all`');
    }
    
    if (arg === 'all') {
      let totalSold = 0;
      let totalCoins = 0;
      const inv = user.inventory || {};
      
      for (const [emoji, count] of Object.entries(inv)) {
        if (count > 0 && ANIMAL_PRICES[emoji]) {
          totalSold += count;
          totalCoins += count * ANIMAL_PRICES[emoji].price;
          inv[emoji] = 0;
        }
      }
      
      if (totalSold === 0) {
        return message.reply('❌ Hayvanat bahçenizde satılacak hiç hayvan bulunmuyor!');
      }
      
      user.balance += totalCoins;
      saveCoinData();
      return message.reply(`💰 Toplam **${totalSold}** adet hayvanı sattın ve **+${totalCoins.toLocaleString()} coin** kazandın!\n💵 Yeni Bakiyen: **${user.balance.toLocaleString()}** coin.`);
    }
    
    const emoji = ANIMAL_NAME_TO_EMOJI[arg];
    if (!emoji || !ANIMAL_PRICES[emoji]) {
      return message.reply('❌ Geçersiz hayvan adı! Geçerli hayvanlar: `tavşan`, `kurbağa`, `hamster`, `tilki`, `domuz`, `aslan`, `kaplan`, `panda`');
    }
    
    const count = user.inventory[emoji] || 0;
    if (count <= 0) {
      return message.reply(`❌ Üzerinizde hiç **${ANIMAL_PRICES[emoji].name}** yok!`);
    }
    
    const price = ANIMAL_PRICES[emoji].price;
    const earned = count * price;
    user.inventory[emoji] = 0;
    user.balance += earned;
    saveCoinData();
    
    return message.reply(`💰 **${count}** adet **${ANIMAL_PRICES[emoji].name}** sattın ve **+${earned.toLocaleString()} coin** kazandın!\n💵 Yeni Bakiyen: **${user.balance.toLocaleString()}** coin.`);
  }

  // 26. SEND / GIVE COMMAND (.send / .give <@user> <miktar>)
  if (command === 'send' || command === 'give') {
    const targetMember = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
    if (!targetMember) {
      return message.reply('⚠️ Lütfen göndermek istediğiniz kullanıcıyı etiketleyin veya ID\'sini girin. Örnek: `.send @kullanıcı 100`');
    }
    
    if (targetMember.id === message.author.id) {
      return message.reply('😂 Kendine coin gönderemezsin!');
    }
    
    if (targetMember.user.bot) {
      return message.reply('🤖 Botlara coin gönderemezsin!');
    }
    
    let amountStr = args[1];
    if (!amountStr && args[0]) {
      if (!isNaN(parseInt(args[0])) || ['all', 'half'].includes(args[0].toLowerCase())) {
        amountStr = args[0];
      }
    }
    
    if (!amountStr) {
      return message.reply('⚠️ Lütfen göndermek istediğiniz coin miktarını belirtin. Örnek: `.send @kullanıcı 100`');
    }
    
    const amount = parseBet(message.author.id, amountStr);
    if (amount <= 0) {
      return message.reply('⚠️ Geçersiz miktar! Lütfen geçerli bir coin sayısı veya `all`/`half` belirtin.');
    }
    
    const balance = getBalance(message.author.id);
    if (balance < amount) {
      return message.reply(`❌ Yetersiz bakiye! Göndermek istediğin: **${amount.toLocaleString()}**, Mevcut Bakiyen: **${balance.toLocaleString()}** coin.`);
    }
    
    addCoins(message.author.id, -amount);
    addCoins(targetMember.id, amount);
    
    return message.reply(`💸 <@${message.author.id}>, <@${targetMember.id}> kullanıcısına **${amount.toLocaleString()} coin** gönderdi!\n💰 Kalan Bakiyen: **${getBalance(message.author.id).toLocaleString()}** coin.`);
  }

  // 27. PROFILE / STATS COMMAND (.profile / .p)
  if (command === 'profile' || command === 'p') {
    const targetUser = message.mentions.users.first() || message.author;
    const user = getUserData(targetUser.id);
    const { EmbedBuilder } = require('discord.js');
    
    const totalBattles = user.stats.battles || 0;
    const wins = user.stats.wins || 0;
    const losses = user.stats.losses || 0;
    const winRate = totalBattles > 0 ? ((wins / totalBattles) * 100).toFixed(1) : '0.0';
    const totalHunts = user.stats.hunts || 0;
    
    const embed = new EmbedBuilder()
      .setTitle(`👤 ${targetUser.username} Profil Kartı`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setColor('#5865F2')
      .addFields(
        { name: '💰 Bakiye', value: `**${user.balance.toLocaleString()}** coin`, inline: true },
        { name: '🌲 Toplam Avcılık', value: `**${totalHunts}** kez`, inline: true },
        { name: '⚔️ Toplam Savaş', value: `**${totalBattles}** kez`, inline: true },
        { name: '🏆 Savaş İstatistikleri', value: `✅ Kazanma: **${wins}**\n❌ Yenilgi: **${losses}**\n📈 Kazanma Oranı: **%${winRate}**`, inline: false }
      );
      
    return message.reply({ embeds: [embed] });
  }

  // 28. LEADERBOARD COMMAND (.top / .lb)
  if (command === 'top' || command === 'lb') {
    const { EmbedBuilder } = require('discord.js');
    
    const sorted = Object.entries(coinData)
      .map(([id, data]) => ({ id, balance: data.balance || 0 }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10);
      
    const embed = new EmbedBuilder()
      .setTitle('🏆 En Zenginler Liderlik Tablosu')
      .setColor('#FEE75C')
      .setDescription(
        sorted.map((item, index) => {
          const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
          return `${emoji} <@${item.id}> - **${item.balance.toLocaleString()}** coin`;
        }).join('\n') || 'Henüz kayıtlı kullanıcı bulunmuyor.'
      );
      
    return message.reply({ embeds: [embed] });
  }

  // 29. ACTION COMMANDS (.kiss, .hug, .pat, .slap, .kill)
  const actions = {
    'kiss': {
      actionText: 'kullanıcısını öptü! 💋',
      selfText: 'Chu... Yalnızlık seviyesi: 999. Kendini öpmeye çalışıyorsun! 🥺'
    },
    'hug': {
      actionText: 'kullanıcısına sarıldı! 🤗',
      selfText: 'Kendine sarıldın... Üzülme, ben sana sarılırım! 🤗'
    },
    'pat': {
      actionText: 'kullanıcısının kafasını okşadı! 🐱',
      selfText: 'Kendi kafanı okşadın. Aferin bana! 😊'
    },
    'slap': {
      actionText: 'kullanıcısına tokat attı! 💥',
      selfText: 'Kendine tokat attın! Bu acıttı... Neden yaptın ki? 😭'
    },
    'kill': {
      actionText: 'kullanıcısını öldürdü! 💀',
      selfText: 'Kendini imha ettin! Hoşçakal acımasız dünya... ☠️'
    }
  };

  if (actions[command]) {
    const targetUser = message.mentions.users.first();
    const isSelf = !targetUser || targetUser.id === message.author.id;
    
    if (isSelf) {
      return message.reply(actions[command].selfText);
    } else {
      return message.channel.send(`<@${message.author.id}>, <@${targetUser.id}> ${actions[command].actionText}`);
    }
  }
});

// ==================== API SERVER FOR WEBSITE INTERACTION ====================
const http = require('http');

const API_PORT = 3000;
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

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bot API is running!');
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/api/server-data')) {
    const data = {
      guilds: [],
      autoresponders: autoresponders,
      savedEmbeds: savedEmbeds,
      automod: automodConfig,
      kayitAyarlari: kayitAyarlari,
      config: {
        roles: config.roles
      }
    };
    
    client.guilds.cache.forEach(guild => {
      const channels = [];
      guild.channels.cache.forEach(channel => {
        if (channel.type === 0) {
          channels.push({
            id: channel.id,
            name: channel.name
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

      data.guilds.push({
        id: guild.id,
        name: guild.name,
        channels: channels,
        roles: roles
      });
    });

    return sendJSON(200, data);
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

        if (req.url === '/api/save-automod') {
          automodConfig = {
            reklam: params.reklam || automodConfig.reklam,
            kufur: params.kufur || automodConfig.kufur,
            link: params.link || automodConfig.link
          };
          saveAutomodConfig();
          exportServerData();
          logEvent("INFO", "Automod", "Automod configuration updated via website");
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
