<script setup lang="ts">
import { ref } from "vue"
import { useAddTrustline } from "@use-stellar/vue"
import { txUrl } from "../explorer"

defineProps<{
  /** A wallet is connected and on testnet. */
  canSign: boolean
}>()
const emit = defineEmits<{ added: [] }>()

// Circle's USDC on testnet. A testnet issuer, never a mainnet one.
const TESTNET_USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"

const code = ref("USDC")
const issuer = ref(TESTNET_USDC_ISSUER)
const limit = ref("")
const trustline = useAddTrustline()
const thrown = ref("")

async function add() {
  thrown.value = ""
  try {
    const result = await trustline.addTrustline({
      asset: { code: code.value.trim(), issuer: issuer.value.trim() },
      ...(limit.value.trim() ? { limit: limit.value.trim() } : {}),
    })
    if (result.status === "success") emit("added")
  } catch (error) {
    if (!trustline.error.value) thrown.value = error instanceof Error ? error.message : String(error)
  }
}
</script>

<template>
  <section aria-labelledby="trustline-heading">
    <h2 id="trustline-heading">Add trustline</h2>
    <p>
      An account must trust an asset's issuer before it can hold the asset. The form starts with testnet USDC;
      any testnet asset works.
    </p>

    <form @submit.prevent="add">
      <label>
        Asset code
        <input v-model="code" required pattern="[A-Za-z0-9]{1,12}" autocomplete="off" spellcheck="false" />
      </label>
      <label>
        Issuer
        <input v-model="issuer" required pattern="G[A-Z2-7]{55}" autocomplete="off" spellcheck="false" />
      </label>
      <label>
        Limit (optional: empty means the most the network allows)
        <input
          v-model="limit"
          inputmode="decimal"
          pattern="\d+(\.\d{1,7})?"
          title="A positive number with at most 7 decimal places"
          autocomplete="off"
        />
      </label>
      <button :disabled="!canSign || trustline.loading.value">
        {{ trustline.loading.value ? "Adding…" : "Add trustline" }}
      </button>
    </form>

    <p v-if="!canSign">Connect a wallet on testnet to add a trustline.</p>
    <p v-if="trustline.error.value" class="error" role="alert">{{ trustline.error.value.message }}</p>
    <p v-if="thrown" class="error" role="alert">{{ thrown }}</p>
    <p v-if="trustline.result.value?.status === 'success'" role="status">
      Trustline added:
      <a :href="txUrl(trustline.result.value.hash)" target="_blank" rel="noopener noreferrer">
        {{ trustline.result.value.hash }}
      </a>
    </p>
  </section>
</template>
