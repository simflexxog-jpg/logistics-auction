const { ZodError } = require('zod');

// validator middleware factory: provide a zod schema and target 'body'|'query'|'params'
module.exports = (schema, target = 'body') => (req, res, next) => {
  try {
    const parsed = schema.parse(req[target]);
    req[target] = parsed;
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Validation failed', issues: err.errors });
    }
    next(err);
  }
};
