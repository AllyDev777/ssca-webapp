// Startup file for cPanel "Setup Node.js App" (Phusion Passenger / LiteSpeed).
// Set "Application startup file" to: server.cjs
// Not needed on a VPS — there, just run `npm start`.
//
// CommonJS (.cjs) on purpose: cPanel's launcher loads the startup file with require().
// Run `npm run build` first; this only serves the finished build.

const { createServer } = require("node:http");
const next = require("next");

const port = Number(process.env.PORT) || 3000;
// Reads next.config.ts and .env.local from this folder (incl. NEXT_PUBLIC_BASE_PATH).
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => handle(req, res)).listen(port, () => {
      console.log(`SSCA app ready on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start the SSCA app:", err);
    process.exit(1);
  });
