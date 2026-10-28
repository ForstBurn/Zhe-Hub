/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Phaser and LiveKit are dynamically imported from client effects. Keeping
  // them transpiled by Next avoids bundler differences between dev and prod.
  transpilePackages: ["phaser", "@livekit/components-react", "livekit-client"],
};

export default nextConfig;
