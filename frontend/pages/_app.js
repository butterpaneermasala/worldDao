import '@/styles/globals.css'
import '@/styles/worlddao.css'

import React, { createContext, useMemo, useState } from 'react';
import { Web3ModalProvider } from '@/lib/web3modal';

export const AppContext = createContext({
  items: [],
  setItems: () => { },
  pinataConfig: {
    jwt: '',
    apiKey: '',
    apiSecret: '',
    groupId: '',
    apiVersion: '',
    gatewayBase: 'https://gateway.pinata.cloud/ipfs/',
  },
});

export default function App({ Component, pageProps }) {
  const [items, setItems] = useState([]);

  // Map CRA envs to Next.js public envs; Next.js will expose NEXT_PUBLIC_* to the browser
  const pinataConfig = useMemo(() => ({
    jwt: process.env.NEXT_PUBLIC_PINATA_JWT || process.env.NEXT_PUBLIC_PINATA_JWT_TOKEN,
    apiKey: process.env.NEXT_PUBLIC_PINATA_API_KEY,
    apiSecret: process.env.NEXT_PUBLIC_PINATA_API_SECRET,
    groupId: process.env.NEXT_PUBLIC_PINATA_GROUP_ID,
    apiVersion: (process.env.NEXT_PUBLIC_PINATA_API_VERSION || '').trim(),
    gatewayBase: (
      process.env.NEXT_PUBLIC_PINATA_GATEWAY_BASE ||
      process.env.PINATA_GATEWAY_BASE ||
      'https://gateway.pinata.cloud/ipfs/'
    ).replace(/\/$/, '/'),
  }), []);

  return (
    <Web3ModalProvider>
      <AppContext.Provider value={{ items, setItems, pinataConfig }}>
        <Component {...pageProps} />
      </AppContext.Provider>
    </Web3ModalProvider>
  );
}
