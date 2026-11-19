import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pg는 서버에서만 쓰므로 번들에 넣지 않는다.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
