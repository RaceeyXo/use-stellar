// USE_STELLAR_FIXTURE_SECURE_STORE
const values = new Map()
module.exports = {
  marker: "USE_STELLAR_FIXTURE_SECURE_STORE",
  getItemAsync: async key => values.get(key) ?? null,
  setItemAsync: async (key, value) => {
    values.set(key, value)
  },
  deleteItemAsync: async key => {
    values.delete(key)
  },
}
