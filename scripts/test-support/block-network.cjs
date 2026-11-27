// Preload in codegen subprocesses so an accidental live schema fetch fails offline.
const net = require("node:net");
function blocked() {
  console.error("OFFLINE_TEST_NETWORK_ATTEMPT");
  throw new Error("Network access is disabled for offline codegen tests");
}
net.Socket.prototype.connect = blocked;
globalThis.fetch = blocked;
