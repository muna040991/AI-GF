import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
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
