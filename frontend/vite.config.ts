import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [react()],
  define: {
    __API_BASE_URL__: JSON.stringify(
      mode === "production"
        ? "https://invoice-api.gdsgroup.tech"
        : "http://localhost:3000",
    ),
    __FEISHU_MODE__: JSON.stringify(mode === "production" ? "real" : "mock"),
  },
  build: {
    rollupOptions: {
      // @lark-opdev/block-bitable-api is only available in feishu-block webpack build
      external: ["@lark-opdev/block-bitable-api"],
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
}));
