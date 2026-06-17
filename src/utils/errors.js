function normalizeError(error) {
  return error instanceof Error ? error.message : String(error);
}

function createHttpError(statusCode, message, options = {}) {
  const detail = message === undefined || message === null ? 'Operation failed' : normalizeError(message);
  const error = new Error(detail);
  error.statusCode = statusCode;
  error.code = options.code || statusCode;
  error.expose = options.expose !== false;
  return error;
}

module.exports = {
  createHttpError,
  normalizeError,
};
