// Simple input sanitizers
function stripLikeWildcards(s) {
  if (!s || typeof s !== 'string') return '';
  // remove % and _ which are SQL LIKE wildcards to prevent wildcard injection
  return s.replace(/[%_]/g, '').trim();
}

function maskSensitiveValue(value, fallback = '[redacted]') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    if (value.length <= 4) return fallback;
    return `${value.slice(0, 2)}***${value.slice(-2)}`;
  }
  return value;
}

function sanitizeUserPayload(user) {
  if (!user) return user;
  const payload = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
  if (payload.email) payload.email = maskSensitiveValue(payload.email);
  if (payload.phone) payload.phone = maskSensitiveValue(payload.phone);
  return payload;
}

module.exports = {
  stripLikeWildcards,
  maskSensitiveValue,
  sanitizeUserPayload,
};
