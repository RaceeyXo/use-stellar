<script setup lang="ts">
import { computed } from "vue"
import { usePaymentHistory } from "@use-stellar/vue"
import { assetCode, short, txUrl } from "../explorer"

const PAGE_SIZE = 5

const props = defineProps<{ address: string | null }>()
const address = computed(() => props.address)
const history = usePaymentHistory({ address, limit: PAGE_SIZE, order: "desc" })

defineExpose({ refetch: () => history.refetch() })
</script>

<template>
  <section aria-labelledby="history-heading">
    <h2 id="history-heading">Payment history</h2>
    <p>The account's payments, newest first, {{ PAGE_SIZE }} to a page.</p>

    <p v-if="!address">Connect a wallet or type an address above.</p>
    <template v-else>
      <p v-if="history.loading.value" role="status">Loading payments…</p>
      <p v-if="history.error.value" class="error" role="alert">{{ history.error.value.message }}</p>
      <p v-if="!history.loading.value && !history.error.value && !history.payments.value.length">
        No payments on this page.
      </p>

      <table v-if="history.payments.value.length">
        <caption>
          Payments of the account
        </caption>
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Direction</th>
            <th scope="col">Amount</th>
            <th scope="col">Other account</th>
            <th scope="col">Transaction</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="payment in history.payments.value" :key="payment.id">
            <td>{{ payment.createdAt }}</td>
            <td>{{ payment.direction === "incoming" ? "Received" : "Sent" }}</td>
            <td>{{ payment.amount }} {{ assetCode(payment.asset) }}</td>
            <td>
              <code>{{ short(payment.direction === "incoming" ? payment.from : payment.to) }}</code>
            </td>
            <td>
              <a :href="txUrl(payment.txHash)" target="_blank" rel="noopener noreferrer">{{ short(payment.txHash) }}</a>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="actions">
        <button type="button" :disabled="history.loading.value || !history.hasPrev.value" @click="history.fetchPrev()">
          Newer
        </button>
        <button type="button" :disabled="history.loading.value || !history.hasNext.value" @click="history.fetchNext()">
          Older
        </button>
        <button type="button" class="quiet" :disabled="history.loading.value" @click="history.refetch()">
          Refresh
        </button>
      </div>
    </template>
  </section>
</template>
