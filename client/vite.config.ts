import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// HTTPS is opt-in (npm run dev:https) rather than always-on, so the normal
// desktop dev loop stays free of self-signed-cert browser warnings. It's
// needed for testing voice input from a phone: browsers only grant
// microphone access in a "secure context" (HTTPS or localhost), and a plain
// http://<lan-ip> address doesn't qualify.
const useHttps = process.env.HTTPS === "true";

export default defineConfig({
  plugins: [react(), ...(useHttps ? [basicSsl()] : [])],
  server: {
    // "true" binds all network interfaces, not just loopback, so other
    // devices on the same local network (e.g. a phone) can reach the dev
    // server at this machine's LAN address. Still never touches the
    // internet — this is local-network-only, same offline guarantee.
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5174",
        changeOrigin: true,
      },
    },
  },
});
