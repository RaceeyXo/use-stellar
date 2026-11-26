<script setup lang="ts">
import { ref } from "vue"
import { useSorobanContract } from "@use-stellar/vue"

// What the form holds, and what was last asked for. The call runs for the
// second pair only, so typing does not fire a simulation on every key.
const contractId = ref("")
const method = ref("")
const selectedContract = ref("")
const selectedMethod = ref("")
const contract = useSorobanContract({ contractId: selectedContract, method: selectedMethod })

function read() {
  selectedContract.value = contractId.value.trim()
  selectedMethod.value = method.value.trim()
  contract.refetch()
}

/** A contract value as text. Soroban integers are bigints, which JSON cannot print. */
function display(value: unknown): string {
  return (
    JSON.stringify(value, (_key, item: unknown) => (typeof item === "bigint" ? item.toString() : item), 2) ??
    "null"
  )
}
</script>

<template>
  <section aria-labelledby="contract-heading">
    <h2 id="contract-heading">Soroban read</h2>
    <p>
      Simulates a read-only method of a testnet contract. Nothing is signed or submitted, so no wallet is
      needed. Use a method that takes no arguments.
    </p>

    <form @submit.prevent="read">
      <label>
        Contract ID
        <input
          v-model="contractId"
          placeholder="C…"
          required
          pattern="C[A-Z2-7]{55}"
          autocomplete="off"
          spellcheck="false"
        />
      </label>
      <label>
        Method
        <input v-model="method" placeholder="decimals" required autocomplete="off" spellcheck="false" />
      </label>
      <button :disabled="contract.loading.value">
        {{ contract.loading.value ? "Reading…" : "Read contract" }}
      </button>
    </form>

    <p v-if="contract.error.value" class="error" role="alert">{{ contract.error.value.message }}</p>
    <pre v-if="selectedContract && contract.data.value !== null" aria-label="Result">{{
      display(contract.data.value)
    }}</pre>
  </section>
</template>
