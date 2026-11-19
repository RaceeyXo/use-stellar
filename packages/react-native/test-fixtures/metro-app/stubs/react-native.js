// Stand-in for `react-native`: the real package is Flow source that needs the
// React Native Babel preset, and nothing in this test depends on it.
module.exports = {
  AppState: { currentState: "active", addEventListener: () => ({ remove() {} }) },
  Linking: {
    openURL: async () => {},
    getInitialURL: async () => null,
    addEventListener: () => ({ remove() {} }),
  },
}
