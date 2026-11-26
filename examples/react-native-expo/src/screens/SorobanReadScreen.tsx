import { useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { useSorobanContract, useWallet } from "@use-stellar/react-native"
import { Address } from "@stellar/stellar-sdk"

export function SorobanReadScreen() {
  const { connected, address } = useWallet()
  const [contractId, setContractId] = useState("")
  const [method, setMethod] = useState("get_count")

  // Only enable when wallet is connected and both fields have values
  const enableQuery = connected && Boolean(contractId.trim()) && Boolean(method.trim())

  const { data, loading, error, refetch } = useSorobanContract<bigint>({
    contractId: enableQuery ? contractId.trim() : "",
    method: enableQuery ? method.trim() : "",
    args: address ? [new Address(address).toScVal()] : [],
  })

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Soroban read-only call (testnet)</Text>

      {!connected ? (
        <Text style={styles.meta}>Connect a wallet to try Soroban calls</Text>
      ) : (
        <>
          <Text style={styles.meta}>Contract simulation as: {address?.slice(0, 10)}…</Text>

          <Text style={styles.label}>Contract ID (C-prefixed)</Text>
          <TextInput
            style={styles.input}
            placeholder="Contract address"
            autoCapitalize="none"
            value={contractId}
            onChangeText={setContractId}
            editable={!loading}
          />

          <Text style={styles.label}>Method name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., get_count, get_data"
            autoCapitalize="none"
            value={method}
            onChangeText={setMethod}
            editable={!loading}
          />

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator />
              <Text>Simulating…</Text>
            </View>
          )}

          {data !== null && !loading && (
            <View style={styles.result}>
              <Text style={styles.resultLabel}>Result:</Text>
              <Text style={styles.resultValue}>{data.toString()}</Text>
            </View>
          )}

          {error && <Text style={styles.error}>{error.message}</Text>}

          <Pressable
            style={styles.button}
            disabled={!enableQuery || loading}
            onPress={() => void refetch()}
          >
            <Text style={styles.buttonLabel}>{loading ? "Simulating…" : "Call method"}</Text>
          </Pressable>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { gap: 12, padding: 16 },
  title: { fontSize: 20, fontWeight: "600" },
  meta: { color: "#555", fontSize: 12 },
  label: { fontSize: 12, fontWeight: "500", marginTop: 8 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 14 },
  loadingContainer: { alignItems: "center", gap: 8, paddingVertical: 12 },
  result: { backgroundColor: "#f0f0f0", padding: 12, borderRadius: 8, gap: 4 },
  resultLabel: { fontSize: 12, color: "#666" },
  resultValue: { fontSize: 16, fontWeight: "600", color: "#0a7cff" },
  button: { backgroundColor: "#0a7cff", padding: 12, borderRadius: 8, marginTop: 8 },
  buttonLabel: { color: "#fff", textAlign: "center", fontWeight: "500" },
  error: { color: "#b00020" },
})
