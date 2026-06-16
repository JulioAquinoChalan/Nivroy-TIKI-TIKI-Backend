function disableCache(res) {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store',
  });
}

function getRequestHeader(req, name) {
  return String(req.get(name) || '').trim();
}

module.exports = {
  disableCache,
  getRequestHeader,
};
