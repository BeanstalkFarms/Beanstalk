import type { AppProps } from 'next/app'
import Container from 'components/layout/Container';
import { WagmiConfig, createClient } from 'wagmi'
import { ethers, getDefaultProvider } from 'ethers'
import '../styles/globals.css'
 
const client = createClient({
  autoConnect: true,
  provider: new ethers.providers.JsonRpcProvider("http://localhost:8545", { name: 'localhost', chainId: 1 }),
})

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <WagmiConfig client={client}>
      <Container>
        <Component {...pageProps} />
      </Container>
    </WagmiConfig>
  );
}

export default MyApp
