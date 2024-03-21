import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "src",
        replacement: path.resolve(__dirname, "src")
      }
    ]
  },
  define: {
    global: {} // fix "global is not defined" error for Wallet Connect
  }
});
