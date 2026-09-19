// URL onde o back-end está rodando. Em produção, aponte para o serviço do
// back-end (ex.: https://api-granja.up.railway.app). Esta variável é lida no
// BUILD (rewrites são fixados no next build), então precisa existir no
// ambiente de build do front-end também, não só em runtime.
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Tudo que o navegador pedir em /api/* (login, sessão, dados) é repassado
  // ao back-end. Assim o usuário só enxerga UM endereço (o do front-end), os
  // cookies de sessão ficam no mesmo domínio e não há necessidade de CORS.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
