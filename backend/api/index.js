// Vercel serverless entry point — wraps the Express app from src/server.js.
// Vercel routes all incoming HTTP requests through this handler.
module.exports = require('../src/server');
