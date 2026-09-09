import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  agentRules: false,
  serverExternalPackages: ['exceljs', 'postgres'],
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
  },
};

export default nextConfig;
