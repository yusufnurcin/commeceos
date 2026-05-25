import type { Config } from "tailwindcss";
import uiPreset from "@commerce-os/ui-system/tailwind-preset";

const config = {
  presets: [uiPreset],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui-system/src/**/*.{ts,tsx}"]
} satisfies Config;

export default config;
