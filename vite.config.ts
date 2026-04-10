import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/Relief-Map-ver-2/', // ADD THIS LINE
})
