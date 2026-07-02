const fs = require('fs');
const path = require('path');

function logEvent(level, category, message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level}] [${category}] ${message}\n`;
  const logPath = path.join(__dirname, '..', 'bot.log');
  fs.appendFile(logPath, logLine, err => {
    if (err) console.error('Failed to write log:', err);
  });
  console.log(logLine.trim());
}

module.exports = { logEvent };
