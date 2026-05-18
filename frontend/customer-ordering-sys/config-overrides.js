const { override, addBabelPlugin } = require('customize-cra');

module.exports = {
  webpack: override(
    addBabelPlugin('@babel/plugin-transform-class-static-block')
  ),
  jest: function(config) {
    config.transformIgnorePatterns = [
      "node_modules/(?!(msw|rettime|strict-event-emitter|headers-polyfill|@open-draft|until-async)/)"
    ];
    
    // Inject babel plugin for Jest
    const babelJestTransform = config.transform['^.+\\.(js|jsx|mjs|cjs|ts|tsx)$'];
    if (typeof babelJestTransform === 'string') {
        // default CRA behavior
    } else if (Array.isArray(babelJestTransform)) {
        // Inject plugin
        if (babelJestTransform[1] && babelJestTransform[1].plugins) {
             babelJestTransform[1].plugins.push('@babel/plugin-transform-class-static-block');
        } else {
             babelJestTransform[1] = {
                 ...babelJestTransform[1],
                 plugins: ['@babel/plugin-transform-class-static-block']
             };
        }
    }
    return config;
  }
};
