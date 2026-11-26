<script setup lang="ts">
import { ref } from "vue"
import { useSendPayment } from "@use-stellar/vue"
import { txUrl } from "../explorer"

defineProps<{
  /** A wallet is connected and on testnet. */
  canSign: boolean
}>()
const emit = defineEmits<{ sent: [] }>()

const destination = ref("")
const amount = ref("")
const memo = ref("")
const payment = useSendPayment()
const thrown = ref("")

async function send() {
  thrown.value = ""
  try {
    const result = await payment.send({
      to: destination.value.trim(),
      asset: "XLM",
      // Sent as typed. An amount never goes through a JavaScript number.
      amount: amount.value.trim(),
      ...(memo.value.trim() ? { memo: memo.value.trim() } : {}),
    })
    if (result.status === "success") emit("sent")
  } catch (error) {
    // `payment.error` holds what the composable caught; this is anything else.
    if (!payment.error.value) thrown.value = error instanceof Error ? error.message : String(error)
  }
}
</script>

<template>
  <section aria-labelledby="payment-heading">
    <h2 id="payment-heading">Send payment</h2>
    <p>Sends test XLM from the connected wallet. Your wallet shows the transaction before you sign it.</p>

    <form @submit.prevent="send">
      <label>
        Destination
        <input
          v-model="destination"
          placeholder="G…"
          required
          pattern="G[A-Z2-7]{55}"
          autocomplete="off"
          spellcheck="false"
        />
      </label>
      <label>
        Amount in XLM
        <input
          v-model="amount"
          inputmode="decimal"
          placeholder="1.5"
          required
          pattern="\d+(\.\d{1,7})?"
          title="A positive number with at most 7 decimal places"
          autocomplete="off"
        />
      </label>
      <label>
        Memo (optional, at most 28 bytes)
        <input v-model="memo" maxlength="28" autocomplete="off" />
      </label>
      <button :disabled="!canSign || payment.loading.value">
        {{ payment.loading.value ? "Sending…" : "Send XLM" }}
      </button>
    </form>

    <p v-if="!canSign">Connect a wallet on testnet to send.</p>
    <p v-if="payment.error.value" class="error" role="alert">{{ payment.error.value.message }}</p>
    <p v-if="thrown" class="error" role="alert">{{ thrown }}</p>
    <p v-if="payment.result.value?.status === 'success'" role="status">
      Sent:
      <a :href="txUrl(payment.result.value.hash)" target="_blank" rel="noopener noreferrer">
        {{ payment.result.value.hash }}
      </a>
    </p>
  </section>
</template>
