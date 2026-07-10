// middlewares/mongoSanitize.middleware.js
//
// Defense against NoSQL injection via operator-injection payloads like
// { "email": { "$ne": null } } or dotted keys used to reach into embedded
// documents unexpectedly. Recursively strips any object key that starts
// with '$' or contains '.', from body/query/params, in place.

function sanitizeValue(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const clean = {};
    for (const [key, val] of Object.entries(value)) {
      if (key.startsWith('$') || key.includes('.')) continue; // drop dangerous key entirely
      clean[key] = sanitizeValue(val);
    }
    return clean;
  }
  return value;
}

export const mongoSanitize = (req, res, next) => {
  // Overwrite request properties safely using Object.defineProperty 
  // to bypass Express's internal read-only getters for query/params.
  ['body', 'query', 'params'].forEach((prop) => {
    if (req[prop]) {
      Object.defineProperty(req, prop, {
        value: sanitizeValue(req[prop]),
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
  });
  
  next();
};