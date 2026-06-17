/**
 * @typedef {Object} ApiErrorDetail
 * @property {number|string} code - HTTP status code or application error code.
 * @property {string} detail - Human-readable error detail.
 */

/**
 * @typedef {Object} PaginationMeta
 * @property {number} page - Current page number.
 * @property {number} limit - Items per page.
 * @property {number} total - Total number of items.
 * @property {number} totalPages - Total number of pages.
 */

/**
 * @typedef {PaginationMeta|Object|null} ApiMeta
 */

/**
 * @typedef {Object} ApiResponseBody
 * @property {boolean} success - Indicates whether the operation completed successfully.
 * @property {string} message - Human-readable response message.
 * @property {*} data - Response payload for successful operations, otherwise null.
 * @property {ApiErrorDetail|null} error - Error payload for failed operations, otherwise null.
 * @property {ApiMeta} meta - Optional metadata, commonly pagination data.
 * @property {string} timestamp - ISO 8601 timestamp generated when the response is created.
 */

class ApiResponse {
  /**
   * Builds the base response envelope.
   *
   * @param {Object} options
   * @param {boolean} options.success
   * @param {string} options.message
   * @param {*} [options.data=null]
   * @param {ApiErrorDetail|null} [options.error=null]
   * @param {ApiMeta} [options.meta=null]
   * @returns {ApiResponseBody}
   */
  static build({
    success,
    message,
    data = null,
    error = null,
    meta = null,
  }) {
    return {
      success,
      message,
      data,
      error,
      meta,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * @param {Object} [options]
   * @param {string} [options.message='Operation completed successfully']
   * @param {*} [options.data={}]
   * @param {ApiMeta} [options.meta=null]
   * @returns {ApiResponseBody}
   */
  static success({ message = 'Operation completed successfully', data = {}, meta = null } = {}) {
    return ApiResponse.build({
      success: true,
      message,
      data,
      error: null,
      meta,
    });
  }

  /**
   * @param {Object} [options]
   * @param {string} [options.message='Resource created successfully']
   * @param {*} [options.data={}]
   * @param {ApiMeta} [options.meta=null]
   * @returns {ApiResponseBody}
   */
  static created({ message = 'Resource created successfully', data = {}, meta = null } = {}) {
    return ApiResponse.success({ message, data, meta });
  }

  /**
   * @param {Object} [options]
   * @param {string} [options.message='Bad request']
   * @param {string} [options.detail='Bad request']
   * @param {number|string} [options.code=400]
   * @param {ApiMeta} [options.meta=null]
   * @returns {ApiResponseBody}
   */
  static badRequest({
    message = 'Bad request',
    detail = 'Bad request',
    code = 400,
    meta = null,
  } = {}) {
    return ApiResponse.failure({ message, detail, code, meta });
  }

  /**
   * @param {Object} [options]
   * @param {string} [options.message='Unauthorized']
   * @param {string} [options.detail='Unauthorized']
   * @param {number|string} [options.code=401]
   * @param {ApiMeta} [options.meta=null]
   * @returns {ApiResponseBody}
   */
  static unauthorized({
    message = 'Unauthorized',
    detail = 'Unauthorized',
    code = 401,
    meta = null,
  } = {}) {
    return ApiResponse.failure({ message, detail, code, meta });
  }

  /**
   * @param {Object} [options]
   * @param {string} [options.message='Forbidden']
   * @param {string} [options.detail='Forbidden']
   * @param {number|string} [options.code=403]
   * @param {ApiMeta} [options.meta=null]
   * @returns {ApiResponseBody}
   */
  static forbidden({
    message = 'Forbidden',
    detail = 'Forbidden',
    code = 403,
    meta = null,
  } = {}) {
    return ApiResponse.failure({ message, detail, code, meta });
  }

  /**
   * @param {Object} [options]
   * @param {string} [options.message='Not found']
   * @param {string} [options.detail='Resource not found']
   * @param {number|string} [options.code=404]
   * @param {ApiMeta} [options.meta=null]
   * @returns {ApiResponseBody}
   */
  static notFound({
    message = 'Not found',
    detail = 'Resource not found',
    code = 404,
    meta = null,
  } = {}) {
    return ApiResponse.failure({ message, detail, code, meta });
  }

  /**
   * @param {Object} [options]
   * @param {string} [options.message='Validation error']
   * @param {string} [options.detail='Validation error']
   * @param {number|string} [options.code=422]
   * @param {ApiMeta} [options.meta=null]
   * @returns {ApiResponseBody}
   */
  static validationError({
    message = 'Validation error',
    detail = 'Validation error',
    code = 422,
    meta = null,
  } = {}) {
    return ApiResponse.failure({ message, detail, code, meta });
  }

  /**
   * @param {Object} [options]
   * @param {string} [options.message='Operation failed']
   * @param {string} [options.detail='Internal server error']
   * @param {number|string} [options.code=500]
   * @param {ApiMeta} [options.meta=null]
   * @returns {ApiResponseBody}
   */
  static error({
    message = 'Operation failed',
    detail = 'Internal server error',
    code = 500,
    meta = null,
  } = {}) {
    return ApiResponse.failure({ message, detail, code, meta });
  }

  /**
   * @param {Object} options
   * @param {string} options.message
   * @param {string} options.detail
   * @param {number|string} options.code
   * @param {ApiMeta} [options.meta=null]
   * @returns {ApiResponseBody}
   */
  static failure({ message, detail, code, meta = null }) {
    return ApiResponse.build({
      success: false,
      message,
      data: null,
      error: {
        code,
        detail,
      },
      meta,
    });
  }
}

module.exports = {
  ApiResponse,
};
