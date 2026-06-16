function getTikTokUniqueId(data) {
  return data?.uniqueId || data?.user?.uniqueId || data?.user?.displayId || data?.userId || 'unknown';
}

function getTikTokGiftName(data) {
  return data?.giftName || data?.gift?.name || data?.extendedGiftInfo?.name || data?.giftId || 'Unknown gift';
}

function getTikTokComment(data) {
  return String(data?.comment || data?.content || '').trim();
}

module.exports = {
  getTikTokComment,
  getTikTokGiftName,
  getTikTokUniqueId,
};
