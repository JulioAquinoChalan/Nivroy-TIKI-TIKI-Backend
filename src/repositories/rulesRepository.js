const fs = require('fs');
const { FieldValue } = require('firebase-admin/firestore');
const { LEGACY_RULES_FILE } = require('../config');
const { firestore } = require('../firebase/admin');

const defaultRules = [
  { id: 'rose', eventType: 'gift', trigger: 'Rose', command: 'execute at @a run summon minecraft:creeper ~ ~ ~', target: 'Creeper', enabled: true },
  { id: 'heart-me', eventType: 'gift', trigger: 'Heart Me', command: 'execute at @a run summon minecraft:zombie ~ ~ ~', target: 'Zombie', enabled: true },
  { id: 'gg', eventType: 'gift', trigger: 'GG', command: 'execute at @a run summon minecraft:skeleton ~ ~ ~', target: 'Skeleton', enabled: true },
  { id: 'like', eventType: 'like', trigger: 'Like', command: 'execute at @a run summon minecraft:zombie ~ ~ ~', target: 'Zombie', enabled: true },
];

function getSeedRules() {
  try {
    if (!fs.existsSync(LEGACY_RULES_FILE)) {
      return defaultRules;
    }

    const parsed = JSON.parse(fs.readFileSync(LEGACY_RULES_FILE, 'utf8'));
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultRules;
  } catch (error) {
    console.error(`Could not load legacy rules seed: ${error.message}`);
    return defaultRules;
  }
}

function getUserRulesCollection(uid) {
  return firestore.collection('users').doc(uid).collection('rules');
}

async function loadUserRules(uid) {
  const snapshot = await getUserRulesCollection(uid).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function seedUserRules(uid, rules) {
  const batch = firestore.batch();
  const now = FieldValue.serverTimestamp();
  for (const rule of rules) {
    batch.set(getUserRulesCollection(uid).doc(rule.id), {
      ...rule,
      createdAt: now,
      updatedAt: now,
    });
  }
  await batch.commit();
}

async function setUserRule(uid, rule, { merge = true, create = false } = {}) {
  const now = FieldValue.serverTimestamp();
  await getUserRulesCollection(uid).doc(rule.id).set({
    ...rule,
    ...(create ? { createdAt: now } : {}),
    updatedAt: now,
  }, { merge });
}

async function updateRuleEnabled(uid, ruleId, enabled) {
  await getUserRulesCollection(uid).doc(ruleId).set({
    enabled,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function deleteUserRule(uid, ruleId) {
  await getUserRulesCollection(uid).doc(ruleId).delete();
}

module.exports = {
  deleteUserRule,
  getSeedRules,
  loadUserRules,
  seedUserRules,
  setUserRule,
  updateRuleEnabled,
};
