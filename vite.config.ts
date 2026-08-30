/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// GitHub Pages serves project sites from a subpath; Vercel serves from the
// domain root and sets VERCEL=1 in its build environment.
export default defineConfig({
  base: process.env.VERCEL ? "/" : "/engine-visualizer/",
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
