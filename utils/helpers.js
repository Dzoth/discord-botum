// utils/helpers.js
const { PermissionFlagsBits } = require('discord.js');
const { resolveUserId, parseNumber } = require('./validation');
const { logEvent } = require('./logger');

/** Ensure the command is used inside a guild */
function requireGuild(message) {
  if (!message.guild) {
    message.reply('Bu komut yalnızca sunucu içinde kullanılabilir.');
    return false;
  }
  return true;
}

/** Check if the user has the required permission(s). */
function ensurePermissions(message, needed) {
  if (!message.member.permissions.has(needed)) {
    const permName = typeof needed === 'string' ? needed : needed.toString();
    sendError(message, '❌', `Bu komutu kullanmak için **${permName}** yetkisine sahip olmalısınız.`);
    return false;
  }
  return true;
}

function sendSuccess(message, emoji, text) {
  return message.reply(`${emoji} ${text}`);
}

function sendError(message, emoji, text) {
  return message.reply(`${emoji} ${text}`);
}

module.exports = { requireGuild, ensurePermissions, sendSuccess, sendError, resolveUserId, parseNumber };
