const { EXAROTON_API_TOKEN, EXAROTON_SERVER_ID, TIKTOK_USERNAME } = require('./config');

const state = {
  tiktokConnected: false,
  currentUserId: '',
  currentUserEmail: '',
  currentTikTokUser: TIKTOK_USERNAME,
  minecraftConnection: {
    provider: EXAROTON_API_TOKEN && EXAROTON_SERVER_ID ? 'exaroton' : '',
    exarotonToken: EXAROTON_API_TOKEN,
    exarotonServerId: EXAROTON_SERVER_ID,
  },
  rules: [],
  events: [],
};

module.exports = {
  state,
};
