import type { Config } from "tailwindcss";
export default {
  content: { relative: true, files: ["./src/**/*.{ts,tsx}"] },
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
