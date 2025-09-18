export default {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'pisces.bbystatic.com' },
      { protocol: 'https', hostname: 'assets.bbystatic.com' },
      { protocol: 'https', hostname: 'images.bbystatic.com' },
      // Add more as they appear in your data
    ],
  },
};
