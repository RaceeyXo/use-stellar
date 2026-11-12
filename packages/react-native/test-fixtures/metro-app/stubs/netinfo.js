// Stand-in for an installed `@react-native-community/netinfo`.
module.exports = {
  marker: "USE_STELLAR_FIXTURE_NETINFO",
  addEventListener: () => () => {},
  fetch: async () => ({ isConnected: true }),
}
