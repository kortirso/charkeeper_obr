import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  server: {
    cors: {
      origin: 'https://www.owlbear.rodeo',
    },
  },
  plugins: [solid()],
})
