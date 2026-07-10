// middlewares/validate.middleware.js

import { ValidationError } from '../utils/errors.js';

/**
 * @param {import('joi').Schema} schema
 * @param {'body'|'query'|'params'} source
 */
export const validate = (schema, source = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[source], {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
    return next(new ValidationError('Request validation failed.', details));
  }

  req[source] = value;
  next();
};
