// Stand-in for an installed `@walletconnect/react-native-compat` and
// `@walletconnect/sign-client`.
module.exports = {
  marker: "USE_STELLAR_FIXTURE_WALLETCONNECT",
  SignClient: { init: async () => ({}) },
}
