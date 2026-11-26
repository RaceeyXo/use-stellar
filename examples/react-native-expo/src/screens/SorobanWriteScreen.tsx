import { useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { useSorobanWrite, useWallet } from "@use-stellar/react-native"
import { nativeToScVal } from "@stellar/stellar-sdk"

export function SorobanWriteScreen() {
  const { connected, address } = useWallet()
  const { invoke, loading, error, result } = useSorobanWrite<bigint>()

  const [contractId, setContractId] = useState("")
  const [method, setMethod] = useState("increment")
  const [amount, setAmount] = useState("1")

  const enableInvoke = connected && Boolean(contractId.trim()) && Boolean(method.trim())

  const handleInvoke = async () => {
    if (!enableInvoke || loading) return

    try {
      const args = amount.trim() ? [nativeToScVal(BigInt(amount), { type: "u32" })] : []

      await invoke({
        contractId: contractId.trim(),
        method: method.trim(),
        args,
        fee: "100",
        timeout: 30000,
      })
    } catch (err) {
      // Error is already set in the hook state
    }
  }

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Soroban contract write (testnet)</Text>

      {!connected ? (
        <Text style={styles.meta}>Connect a wallet to submit contract calls</Text>
      ) : (
        <>
          <Text style={styles.meta}>Signing as: {address?.slice(0, 10)}…</Text>

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
            placeholder="e.g., increment, transfer"
            autoCapitalize="none"
            value={method}
            onChangeText={setMethod}
            editable={!loading}
          />

          <Text style={styles.label}>Argument (optional u32)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 1 (leave blank for no args)"
            keyboardType="number-pad"
            value={amount}
            onChangeText={setAmount}
            editable={!loading}
          />

          {loading && (
            <View style={styles.statusContainer}>
              <ActivityIndicator />
              <Text>Submitting transaction…</Text>
            </View>
          )}

          {result && (
            <View style={styles.successBox}>
              <Text style={styles.successLabel}>Transaction submitted!</Text>
              <Text style={styles.resultText}>Hash:</Text>
              <Text style={styles.hash}>{result.hash}</Text>
              {result.result !== undefined && (
                <>
                  <Text style={styles.resultText}>Result:</Text>
                  <Text style={styles.resultValue}>{String(result.result)}</Text>
                </>
              )}
            </View>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorLabel}>Error</Text>
              <Text style={styles.error}>{error.message}</Text>
            </View>
          )}

          <Pressable
            style={styles.button}
            disabled={!enableInvoke || loading}
            onPress={handleInvoke}
          >
            <Text style={styles.buttonLabel}>
              {loading ? "Submitting…" : "Invoke method"}
            </Text>
          </Pressable>

          <Text style={styles.note}>
            Note: Testnet contracts must be deployed first. Use Friendbot to fund your account
            before submitting transactions.
          </Text>
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
  statusContainer: { alignItems: "center", gap: 8, paddingVertical: 12 },
  successBox: { backgroundColor: "#e8f5e9", padding: 12, borderRadius: 8, gap: 8 },
  successLabel: { fontSize: 14, fontWeight: "600", color: "#2e7d32" },
  errorBox: { backgroundColor: "#ffebee", padding: 12, borderRadius: 8, gap: 8 },
  errorLabel: { fontSize: 14, fontWeight: "600", color: "#c62828" },
  resultText: { fontSize: 12, color: "#666" },
  resultValue: { fontSize: 14, fontWeight: "500", color: "#0a7cff" },
  hash: { fontSize: 12, fontFamily: "monospace", color: "#666" },
  button: { backgroundColor: "#0a7cff", padding: 12, borderRadius: 8, marginTop: 8 },
  buttonLabel: { color: "#fff", textAlign: "center", fontWeight: "500" },
  error: { color: "#b00020", fontSize: 12 },
  note: { fontSize: 11, color: "#999", fontStyle: "italic", marginTop: 8 },
})
