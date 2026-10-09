import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vitest/config'
import { brand } from './src/config/brand.ts'

// Puts the brand name and theme color into index.html (the tab title and phone browser color).
const brandHtml: Plugin = {
  name: 'brand-html',
  transformIndexHtml: (html) => html.replaceAll('%APP_NAME%', brand.fullName).replaceAll('%THEME_COLOR%', brand.themeColor),
}

export default defineConfig({
  plugins: [react(), tailwindcss(), brandHtml],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
