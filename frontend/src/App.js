import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import './App.css';
import LandingPage from './components/LandingPage';
import DashboardPage from './components/DashboardPage';
import VotingPage from './components/VotingPage';
import BiddingPage from './components/BiddingPage';

function App() {
  const [items, setItems] = useState([]); // shared across routes

  const pinataConfig = {
    jwt: process.env.REACT_APP_PINATA_JWT || process.env.REACT_APP_PINATA_JWT_TOKEN,
    apiKey: process.env.REACT_APP_PINATA_API_KEY,
    apiSecret: process.env.REACT_APP_PINATA_API_SECRET,
    groupId: process.env.REACT_APP_PINATA_GROUP_ID,
    apiVersion: (process.env.REACT_APP_PINATA_API_VERSION || '').trim(),
    gatewayBase: (process.env.REACT_APP_PINATA_GATEWAY_BASE || 'https://gateway.pinata.cloud/ipfs/').replace(/\/$/, '/'),
  };

  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<DashboardPage items={items} setItems={setItems} pinataConfig={pinataConfig} />} />
        <Route path="/voting" element={<VotingPage items={items} />} />
        <Route path="/bidding" element={<BiddingPage />} />
      </Routes>
    </div>
  );
}
export default App;