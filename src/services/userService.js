const { state } = require('../state');
const { ensureUserRules } = require('./rulesService');

async function setActiveUser(user) {
  if (!user?.uid) {
    state.currentUserId = '';
    state.currentUserEmail = '';
    state.rules = [];
    return;
  }

  if (state.currentUserId === user.uid && state.rules.length > 0) {
    return;
  }

  state.currentUserId = user.uid;
  state.currentUserEmail = user.email || '';
  state.rules = await ensureUserRules(user.uid);
}

module.exports = {
  setActiveUser,
};
