// Standalone config module with zero app-level imports. API_BASE previously
// lived in App.js and was re-exported from there, which created a circular
// import: App.js -> WorkspaceShell -> (Home/Chats/People/Status/Files)View
// -> utils/media.js -> back to App.js for API_BASE. In the production
// bundle that cycle surfaced as "Cannot access '<var>' before
// initialization" the moment any view rendered, breaking the entire
// authenticated app (blank/crashed workspace). Moving API_BASE here — a
// leaf module nothing else depends on — breaks the cycle for good.
// export const API_BASE = 'http://localhost:8000/api';
export const API_BASE = 'https://zoho-collabspace.onrender.com/api';