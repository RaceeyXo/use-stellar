/** @jest-environment jsdom */

import { createSSRApp, defineComponent, h, nextTick } from "vue"
import { renderToString } from "@vue/server-renderer"
import { createStellarPlugin } from "../plugin"
import { useBalance } from "../useBalance"
import { useClaimableBalance } from "../useClaimableBalance"
import { usePaymentHistory } from "../usePaymentHistory"
import { usePayments } from "../usePayments"

const IdleView = defineComponent({
  setup() {
    const balance = useBalance({ address: null })
    const claimable = useClaimableBalance({ address: null })
    const payments = usePayments({ address: null })
    const history = usePaymentHistory({ address: null })
    return () =>
      h("main", [
        h("span", balance.loading.value ? "loading" : "idle"),
        h("span", String(claimable.balances.value.length)),
        h("span", String(payments.payments.value.length)),
        h("span", String(history.payments.value.length)),
      ])
  },
})

test("idle composables hydrate without mismatch warnings or storage access", async () => {
  const getItem = jest.spyOn(Storage.prototype, "getItem")
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {})
  const error = jest.spyOn(console, "error").mockImplementation(() => {})
  const serverApp = createSSRApp(IdleView).use(createStellarPlugin())
  const html = await renderToString(serverApp)
  const container = document.createElement("div")
  container.innerHTML = html
  document.body.appendChild(container)

  const clientApp = createSSRApp(IdleView).use(createStellarPlugin())
  clientApp.mount(container)
  await nextTick()

  const diagnostics = [...warn.mock.calls, ...error.mock.calls].flat().join(" ")
  expect(diagnostics.toLowerCase()).not.toContain("hydration")
  expect(container.textContent).toBe("idle000")
  expect(getItem).not.toHaveBeenCalled()

  clientApp.unmount()
  container.remove()
  warn.mockRestore()
  error.mockRestore()
  getItem.mockRestore()
})
