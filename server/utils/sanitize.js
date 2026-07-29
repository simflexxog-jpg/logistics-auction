// Simple input sanitizers
function stripLikeWildcards(s) {
  if (!s || typeof s !== 'string') return '';
  // remove % and _ which are SQL LIKE wildcards to prevent wildcard injection
  return s.replace(/[%_]/g, '').trim();
}

module.exports = {
  stripLikeWildcards,
};
