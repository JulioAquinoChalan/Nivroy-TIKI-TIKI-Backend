function sanitizeMinecraftName(value) {
  return String(value || 'unknown').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 16) || 'unknown';
}

function normalizeMinecraftCommand(command) {
  return String(command || '')
    .replace(/Count\s*:\s*1b/g, 'count:1')
    .replace(/Count\s*:\s*1/g, 'count:1');
}

function getMinecraftCommands(command) {
  return normalizeMinecraftCommand(command)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

module.exports = {
  getMinecraftCommands,
  normalizeMinecraftCommand,
  sanitizeMinecraftName,
};
