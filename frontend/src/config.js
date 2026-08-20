// Standalone config module with zero app-level imports. API_BASE previously
// lived in App.js and was re-exported from there, which created a circular
// import: App.js -> WorkspaceShell -> (Home/Chats/People/Status/Files)View
// -> utils/media.js -> back to App.js for API_BASE. In the production
// bundle that cycle surfaced as "Cannot access '<var>' before
// initialization" the moment any view rendered, breaking the entire
// authenticated app (blank/crashed workspace). Moving API_BASE here — a
// leaf module nothing else depends on — breaks the cycle for good.
//
// Was hardcoded to http://localhost:8000/api — meaning the Vercel-deployed
// frontend was permanently trying to reach a backend on the visitor's own
// machine, which of course never exists. CRA bakes REACT_APP_* env vars
// into the build at build time, so on Vercel this must be set as a Project
// Environment Variable (Settings -> Environment Variables) named
// REACT_APP_API_URL, e.g. https://your-service.onrender.com/api — then
// redeploy (Vercel does NOT retroactively apply env vars to an existing
// build). Local dev is untouched: no env var set -> falls back to
// localhost:8000/api exactly as before.
export const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Derived once from API_BASE so the Socket.IO connection (App.js) always
// points at the same backend as the REST API — strips a trailing "/api".
export const SOCKET_URL = API_BASE.replace(/\/api\/?$/, '');
