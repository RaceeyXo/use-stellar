// Stand-in for an installed `@react-native-async-storage/async-storage`.
module.exports = {
  marker: "USE_STELLAR_FIXTURE_ASYNC_STORAGE",
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
}
