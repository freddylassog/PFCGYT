import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  agentRules: false,
  serverExternalPackages: ['exceljs', 'postgres'],
  // Los archivos SQL se leen en tiempo de ejecución para actualizar la base de datos.
  outputFileTracingIncludes: { '/**': ['./supabase/migrations/**'] },
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
  },
};

export default nextConfig;
