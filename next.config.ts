import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "sequelize", "sqlite3"],
};

export default nextConfig;
