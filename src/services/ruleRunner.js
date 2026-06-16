const { state } = require('../state');
const { addEvent } = require('../realtime/events');
const { sendMinecraftCommand } = require('./minecraftService');
const { getMinecraftCommands } = require('../utils/minecraft');

function matchesRuleEvent(rule, event) {
  if (!rule.enabled || rule.eventType !== event.type) {
    return false;
  }

  const trigger = String(rule.trigger || '').trim().toLowerCase();
  if (
    !trigger
    || ['like', 'follow', 'member', 'share'].includes(rule.eventType)
  ) {
    return true;
  }

  const detail = String(event.detail || '').trim().toLowerCase();
  return detail === trigger || detail.includes(trigger);
}

function getCommandForEvent(command, event) {
  const username = event.user || state.currentTikTokUser || 'unknown';
  return String(command || '')
    .replaceAll('{user}', username)
    .replaceAll('{username}', username)
    .replaceAll('{detail}', event.detail || '');
}

async function runRulesForEvent(event) {
  if (!state.currentUserId || !state.minecraftConnection.provider) {
    return;
  }

  const matchedRules = state.rules.filter((rule) => matchesRuleEvent(rule, event));
  for (const rule of matchedRules) {
    const command = getCommandForEvent(rule.command, event);
    const results = await sendMinecraftCommand(command);
    addEvent('command_sent', {
      source: 'minecraft',
      provider: state.minecraftConnection.provider,
      ruleId: rule.id,
      detail: `${rule.trigger} -> ${getMinecraftCommands(command).join(' | ')}`,
      results,
    });
  }
}

module.exports = {
  runRulesForEvent,
};
