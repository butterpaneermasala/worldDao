import { createWeb3Modal } from '@web3modal/wagmi/react'
import { defaultWagmiConfig } from '@web3modal/wagmi/react/config'
import { WagmiProvider } from 'wagmi'
import { worldchainSepolia, worldchain } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Get projectId from WalletConnect Cloud
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id'

if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) {
    console.warn('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID not set - using demo project ID. Get your project ID from https://cloud.walletconnect.com/');
}

// Define custom World Chain networks
const worldChainSepolia = {
    id: 4801,
    name: 'World Chain Sepolia',
    network: 'worldchain-sepolia',
    nativeCurrency: {
        decimals: 18,
        name: 'Ether',
        symbol: 'ETH',
    },
    rpcUrls: {
        public: { http: ['https://worldchain-sepolia.g.alchemy.com/public'] },
        default: { http: ['https://worldchain-sepolia.g.alchemy.com/public'] },
    },
    blockExplorers: {
        default: { name: 'Explorer', url: 'https://worldchain-sepolia.explorer.alchemy.com' },
    },
}

const worldChainMainnet = {
    id: 480,
    name: 'World Chain',
    network: 'worldchain',
    nativeCurrency: {
        decimals: 18,
        name: 'Ether',
        symbol: 'ETH',
    },
    rpcUrls: {
        public: { http: ['https://worldchain-mainnet.g.alchemy.com/public'] },
        default: { http: ['https://worldchain-mainnet.g.alchemy.com/public'] },
    },
    blockExplorers: {
        default: { name: 'Explorer', url: 'https://worldchain-mainnet.explorer.alchemy.com' },
    },
}

// Create wagmi config
const metadata = {
    name: 'WorldDAO',
    description: 'Decentralized Autonomous Organization for World Chain',
    url: 'https://worlddao.org', // origin must match your domain & subdomain
    icons: ['https://avatars.githubusercontent.com/u/37784886']
}

const chains = [worldChainSepolia, worldChainMainnet]

const config = defaultWagmiConfig({
    chains,
    projectId,
    metadata,
})

// Create modal
const web3modal = createWeb3Modal({
    wagmiConfig: config,
    projectId,
    enableAnalytics: true, // Optional - defaults to your Cloud configuration
    enableOnramp: true // Optional - false as default
})

// Create a client
const queryClient = new QueryClient()

export { config, queryClient, web3modal }

// Web3Modal Provider Component
export function Web3ModalProvider({ children }) {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </WagmiProvider>
    )
}