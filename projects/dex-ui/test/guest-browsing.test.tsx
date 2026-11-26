import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "jotai";
import { Link, MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createConfig, http, useChainId, WagmiProvider } from "wagmi";
import { connect, disconnect } from "wagmi/actions";
import { mainnet, arbitrum } from "wagmi/chains";
import { mock } from "wagmi/connectors";

import { ForceSupportedChainId } from "src/components/App/ForceSupportedChainId";
import { SdkProvider } from "src/state/providers/SdkProvider";
import { useSdkChainId } from "src/utils/chain";

// The SDK uses a public provider; no live RPC or wallet is needed by these tests.
vi.mock("src/utils/wagmi/urls", () => ({ getRpcUrl: () => "https://rpc.invalid" }));
vi.mock("connectkit", () => ({
  useModal: () => ({ openSwitchNetworks: vi.fn(), setOpen: vi.fn() }),
  ConnectKitButton: { Custom: ({ children }: any) => children({}) }
}));

afterEach(cleanup);

function setup(
  path: string,
  initialChainId: 1 | 42161 = 1,
  status: "disconnected" | "connected" | "connecting" | "reconnecting" = "disconnected"
) {
  const config = createConfig({
    chains: [mainnet, arbitrum],
    connectors: [mock({ accounts: ["0x0000000000000000000000000000000000000001"] })],
    transports: { 1: http("https://ethereum.invalid"), 42161: http("https://arbitrum.invalid") },
    storage: null
  });
  config.setState((state) => ({ ...state, chainId: initialChainId, status }));
  function CurrentNetwork() {
    return (
      <>
        <output data-testid="network">{useChainId()}</output>
        <output data-testid="sdk-network">{useSdkChainId()}</output>
      </>
    );
  }
  render(
    <WagmiProvider config={config} reconnectOnMount={false}>
      <QueryClientProvider client={new QueryClient()}>
        <Provider>
          <MemoryRouter initialEntries={[path]}>
            <SdkProvider>
              <ForceSupportedChainId />
              <CurrentNetwork />
            </SdkProvider>
            <Link to="/wells/1">Ethereum pools</Link>
            <Link to="/wells/42161">Arbitrum pools</Link>
          </MemoryRouter>
        </Provider>
      </QueryClientProvider>
    </WagmiProvider>
  );
  return config;
}

describe("guest pool browsing", () => {
  it.each(["/wells/42161", "/wells/42161/0x123", "/wells/42161/0x123/liquidity"])(
    "selects the public Arbitrum network without a wallet at %s",
    async (path) => {
      setup(path);
      await waitFor(() => expect(screen.getByTestId("sdk-network").textContent).toBe("42161"));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByTestId("network").textContent).toBe("42161");
    }
  );

  it("selects Ethereum when a previous visit left Arbitrum selected", async () => {
    setup("/wells/1", 42161);
    await waitFor(() => expect(screen.getByTestId("sdk-network").textContent).toBe("1"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("follows pool network navigation while disconnected", async () => {
    setup("/wells/1");
    fireEvent.click(screen.getByText("Arbitrum pools"));
    await waitFor(() => expect(screen.getByTestId("sdk-network").textContent).toBe("42161"));
    fireEvent.click(screen.getByText("Ethereum pools"));
    await waitFor(() => expect(screen.getByTestId("sdk-network").textContent).toBe("1"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the selected network on pages without a network in the URL", () => {
    setup("/", 42161);
    expect(screen.getByTestId("network").textContent).toBe("42161");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("still rejects unsupported networks", () => {
    setup("/wells/999");
    expect(screen.getByText("This network is not supported")).toBeTruthy();
    expect(screen.getByTestId("network").textContent).toBe("1");
  });

  it("does not select a development fork absent from the configured networks", () => {
    setup("/wells/1337");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByTestId("network").textContent).toBe("1");
  });

  it.each(["connected", "connecting", "reconnecting"] as const)(
    "does not switch a %s wallet automatically",
    (status) => {
      setup("/wells/42161", 1, status);
      expect(screen.getByTestId("network").textContent).toBe("1");
      expect(screen.getByRole("dialog")).toBeTruthy();
    }
  );

  it("resumes guest browsing after disconnecting a wallet on another network", async () => {
    const config = setup("/wells/1");
    await act(async () => {
      await connect(config, { connector: config.connectors[0] });
    });
    fireEvent.click(screen.getByText("Arbitrum pools"));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    expect(screen.getByTestId("sdk-network").textContent).toBe("1");
    await act(async () => {
      await disconnect(config);
    });
    await waitFor(() => expect(screen.getByTestId("sdk-network").textContent).toBe("42161"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("waits until a failed reconnection has finished before selecting the guest network", async () => {
    const config = setup("/wells/42161", 1, "reconnecting");
    expect(screen.getByTestId("network").textContent).toBe("1");
    act(() => config.setState((state) => ({ ...state, status: "disconnected" })));
    await waitFor(() => expect(screen.getByTestId("sdk-network").textContent).toBe("42161"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
