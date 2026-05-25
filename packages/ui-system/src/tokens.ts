export const designSystemTokens = {
  radius: "0.5rem",
  fontSans: "Inter, ui-sans-serif, system-ui, sans-serif",
  shellBackground: "hsl(var(--background))",
  shellForeground: "hsl(var(--foreground))"
} as const;

export type DesignSystemTokenName = keyof typeof designSystemTokens;
