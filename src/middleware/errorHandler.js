const { ApiResponse } = require('../utils/ApiResponse');
const { normalizeError } = require('../utils/errors');

/**
 * Wraps async Express route handlers so rejected promises reach errorHandler.
 *
 * @param {import('express').RequestHandler} handler
 * @returns {import('express').RequestHandler}
 */
function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

/**
 * Converts unknown route errors into the standard API response envelope.
 *
 * @param {Error & { status?: number, statusCode?: number, code?: number|string, expose?: boolean }} error
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  const statusCode = Number(error.statusCode || error.status || 500);
  const safeStatusCode = statusCode >= 400 && statusCode < 600 ? statusCode : 500;
  const detail = error.expose || safeStatusCode < 500
    ? normalizeError(error)
    : 'Internal server error';
  const code = error.code || safeStatusCode;

  if (safeStatusCode >= 500) {
    console.error(error);
  }

  const responseByStatus = {
    400: ApiResponse.badRequest,
    401: ApiResponse.unauthorized,
    403: ApiResponse.forbidden,
    404: ApiResponse.notFound,
    422: ApiResponse.validationError,
  };
  const responseBuilder = responseByStatus[safeStatusCode] || ApiResponse.error;

  res.status(safeStatusCode).json(responseBuilder({
    message: safeStatusCode >= 500 ? 'Operation failed' : detail,
    detail,
    code,
  }));
}

/**
 * Handles unmatched API routes with the standard response envelope.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {void}
 */
function notFoundHandler(req, res) {
  res.status(404).json(ApiResponse.notFound({
    message: 'Route not found',
    detail: `Route ${req.method} ${req.originalUrl} was not found.`,
  }));
}

module.exports = {
  asyncHandler,
  errorHandler,
  notFoundHandler,
};
