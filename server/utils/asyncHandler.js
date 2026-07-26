/**
 * AsyncHandler utility
 * Wraps async route handlers to catch errors and pass to error handling middleware
 * Prevents "UnhandledPromiseRejectionWarning" errors
 */

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = asyncHandler;
