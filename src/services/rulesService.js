const { state } = require('../state');
const { addEvent } = require('../realtime/events');
const {
  deleteUserRule,
  getSeedRules,
  loadUserRules,
  seedUserRules,
  setUserRule,
  updateRuleEnabled,
} = require('../repositories/rulesRepository');
const { getMinecraftCommands } = require('../utils/minecraft');

function createRuleId(trigger) {
  return `${Date.now()}-${String(trigger).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

function normalizeRule(input) {
  const eventType = String(input.eventType || 'gift').trim().toLowerCase();
  const trigger = String(input.trigger || '').trim();
  const command = getMinecraftCommands(input.command).join('\n');
  const target = String(input.target || trigger).trim();
  const voiceEnabled = input.voiceEnabled === true;
  const voiceMessage = String(input.voiceMessage || '').trim();

  if (!['gift', 'like', 'follow', 'member', 'share', 'chat'].includes(eventType)) {
    throw new Error('Rule event type is invalid.');
  }

  if (!trigger) {
    throw new Error('Rule trigger is required.');
  }

  if (!command) {
    throw new Error('Minecraft command is required.');
  }

  return {
    id: input.id || createRuleId(trigger),
    eventType,
    trigger,
    command,
    target: target || trigger,
    enabled: input.enabled !== false,
    voiceEnabled,
    voiceMessage,
  };
}

async function loadNormalizedUserRules(uid) {
  const rules = await loadUserRules(uid);
  return rules.map((rule) => normalizeRule(rule));
}

async function ensureUserRules(uid) {
  const rules = await loadNormalizedUserRules(uid);
  if (rules.length > 0) {
    return rules;
  }

  await seedUserRules(uid, getSeedRules().map((item) => normalizeRule(item)));
  return loadNormalizedUserRules(uid);
}

function getActiveRules() {
  return state.rules.filter((rule) => rule.enabled !== false);
}

async function getOverlayRules(uid) {
  const targetUid = String(uid || '').trim();
  if (!targetUid) {
    return getActiveRules();
  }

  return (await loadNormalizedUserRules(targetUid)).filter((rule) => rule.enabled !== false);
}

async function saveRule(uid, rule) {
  const existingIndex = state.rules.findIndex(
    (item) => (item.eventType || 'gift') === rule.eventType
      && item.trigger.toLowerCase() === rule.trigger.toLowerCase(),
  );

  if (existingIndex >= 0) {
    const nextRule = { ...state.rules[existingIndex], ...rule };
    state.rules[existingIndex] = nextRule;
    await setUserRule(uid, nextRule);
  } else {
    state.rules.push(rule);
    await setUserRule(uid, rule, { merge: true, create: true });
  }

  addEvent('rule_saved', {
    source: 'rules',
    detail: `${rule.trigger} -> ${rule.command}`,
  });

  return existingIndex >= 0 ? state.rules[existingIndex] : rule;
}

async function replaceRule(uid, ruleId, input) {
  const index = state.rules.findIndex((rule) => rule.id === ruleId);
  if (index < 0) {
    return null;
  }

  const rule = normalizeRule({ ...input, id: ruleId });
  state.rules[index] = rule;
  await setUserRule(uid, rule);
  addEvent('rule_saved', {
    source: 'rules',
    detail: `${rule.trigger} -> ${rule.command}`,
  });

  return rule;
}

async function setRuleEnabled(uid, ruleId, enabled) {
  const rule = state.rules.find((item) => item.id === ruleId);
  if (!rule) {
    return null;
  }

  rule.enabled = enabled !== false;
  await updateRuleEnabled(uid, rule.id, rule.enabled);
  addEvent('rule_updated', {
    source: 'rules',
    detail: `${rule.trigger} ${rule.enabled ? 'enabled' : 'disabled'}`,
  });

  return rule;
}

async function removeRule(uid, ruleId) {
  const before = state.rules.length;
  state.rules = state.rules.filter((rule) => rule.id !== ruleId);
  await deleteUserRule(uid, ruleId);
  addEvent('rule_updated', {
    source: 'rules',
    detail: `Rule ${ruleId} deleted`,
  });
  return before !== state.rules.length;
}

module.exports = {
  ensureUserRules,
  getOverlayRules,
  normalizeRule,
  removeRule,
  replaceRule,
  saveRule,
  setRuleEnabled,
};
