const path = require('path');

module.exports = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@/core': path.resolve(__dirname, 'src/core'),
      '@/data': path.resolve(__dirname, 'src/data'),
      '@/banking': path.resolve(__dirname, 'src/banking'),
      '@/treasury': path.resolve(__dirname, 'src/treasury'),
      '@/ui': path.resolve(__dirname, 'src/ui'),
      '@/integration': path.resolve(__dirname, 'src/integration'),
      '@/analytics': path.resolve(__dirname, 'src/analytics'),
      '@/shared': path.resolve(__dirname, 'src/shared')
    }
  }
}; 