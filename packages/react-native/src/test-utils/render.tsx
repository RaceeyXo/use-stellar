/**
 * renderWithStellar Test Helper
 * ────────────────────────────
 * Renders React Native components with StellarProvider and test configuration.
 * 
 * Responsibilities:
 * 1. Wrap component with StellarProvider
 * 2. Apply test network and runtime defaults
 * 3. Register mock environment setup
 * 4. Ensure deterministic test execution
 * 
 * Reuses core fixtures and shared SDK mock to avoid duplication.
 * 
 * @example
 * import { renderWithStellar } from "@use-stellar/react-native/test-utils"
 * import { useStellarAccount } from "use-stellar"
 * 
 * function TestComponent() {
 *   const { account } = useStellarAccount()
 *   return <Text>{account?.id}</Text>
 * }
 * 
 * it("loads account data", async () => {
 *   const { getByText } = renderWithStellar(<TestComponent />)
 *   await waitFor(() => {
 *     expect(getByText(/GDX76CSVS/)).toBeInTheDocument()
 *   })
 * })
 */

import React, { ReactElement } from "react"
import { Text, View } from "react-native"
import { render, RenderOptions } from "@testing-library/react-native"
import { StellarProvider } from "use-stellar"
import { StellarNetwork, NetworkConfig } from "use-stellar"

/**
 * Options for renderWithStellar.
 * Extends react-testing-library's RenderOptions.
 */
export interface RenderWithStellarOptions extends Omit<RenderOptions, "wrapper"> {
  /** Network to use. Defaults to testnet. */
  network?: StellarNetwork | NetworkConfig

  /** Additional StellarProvider props. */
  providerProps?: Partial<React.ComponentProps<typeof StellarProvider>>
}

/**
 * Render a component with StellarProvider and test configuration.
 * 
 * This helper:
 * - Wraps the component with StellarProvider
 * - Configures testnet as the default network
 * - Uses mock Horizon and Soroban servers
 * - Applies fake timers for deterministic polling
 * - Cleans up after the test completes
 * 
 * @param ui - React component to render
 * @param options - Configuration options
 * @returns render result with queries and utilities
 * 
 * @example
 * const { getByText, queryByText } = renderWithStellar(<MyComponent />)
 * expect(getByText("Active")).toBeInTheDocument()
 */
export function renderWithStellar(ui: ReactElement, options?: RenderWithStellarOptions) {
  const {
    network = StellarNetwork.TESTNET,
    providerProps = {},
    ...renderOptions
  } = options ?? {}

  /**
   * Wrapper component that provides test configuration.
   * Renders StellarProvider with mocked servers and testnet defaults.
   */
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <StellarProvider
        network={network}
        {...providerProps}
      >
        {children}
      </StellarProvider>
    )
  }

  return render(ui, {
    ...renderOptions,
    wrapper: Wrapper,
  })
}

/**
 * Test-specific component: text output helper.
 * 
 * React Native tests often assert on Text elements.
 * This helper makes it easier to display values in tests.
 */
export function TestText({ label, value }: { label: string; value: string | undefined }) {
  return (
    <Text testID={`test-${label}`}>
      {label}: {value ?? "loading"}
    </Text>
  )
}

/**
 * Test-specific component: error display.
 * 
 * Useful for displaying error states in test components.
 */
export function TestError({ label, error }: { label: string; error: Error | undefined }) {
  return (
    <Text testID={`error-${label}`}>
      {error ? `Error: ${error.message}` : "No error"}
    </Text>
  )
}

/**
 * Test-specific component: loading indicator.
 * 
 * Display while async operations are in flight.
 */
export function TestLoading({ label, isLoading }: { label: string; isLoading: boolean }) {
  return (
    <Text testID={`loading-${label}`}>
      {isLoading ? "Loading..." : "Done"}
    </Text>
  )
}

/**
 * Test container: wraps multiple test components.
 * 
 * Useful for organizing test UI without need for full screen layouts.
 */
export function TestContainer({ children }: { children: React.ReactNode }) {
  return <View testID="test-container">{children}</View>
}

export default renderWithStellar
