// utils/validation.js
function resolveUserId(arg) {
  if (!arg) return null;
  // Accept mentions like <@1234567890> or raw IDs
  const match = arg.match(/^<@!?(\d+)>$/);
  if (match) return match[1];
  if (/^\d{17,20}$/.test(arg)) return arg;
  return null;
}

function parseNumber(arg, name = 'value') {
  const num = Number(arg);
  if (isNaN(num)) return { error: `⚠️ ${name} bir sayı olmalı.` };
  return { value: num };
}

module.exports = { resolveUserId, parseNumber };
