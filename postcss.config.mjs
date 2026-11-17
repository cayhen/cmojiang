/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    // Safari still needs prefixes for some properties, e.g. -webkit-user-select:
    // without it select-none does nothing on iPhone.
    autoprefixer: {},
  },
};

export default config;
