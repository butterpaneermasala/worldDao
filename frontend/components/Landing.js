import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  initMiniKit, 
  isMiniKitReady, 
  verifyForGovernance,
  getMiniKitStatus,
  connectWallet 
} from '@/lib/web3';

export default function Landing() {
  const router = useRouter();
  const [isVerifying, setIsVerifying] = useState(false);
  const [miniKitReady, setMiniKitReady] = useState(false);

  useEffect(() => {
    const initializeMiniKit = async () => {
      try {
        await initMiniKit();
        setMiniKitReady(isMiniKitReady());
      } catch (error) {
        console.log('MiniKit initialization failed:', error);
      }
    };

    initializeMiniKit();
  }, []);

  const handleDiveInClick = async () => {
    setIsVerifying(true);
    
    try {
      // Check if we're in World App
      const status = getMiniKitStatus();
      
      if (status.isWorldApp && miniKitReady) {
        console.log('🌍 Verifying with World ID...');
        
        // Use MiniKit verify function for World ID verification
        const verificationResult = await verifyForGovernance('access_dao', 'landing_entry');
        
        if (verificationResult && verificationResult.proof) {
          console.log('✅ World ID verification successful');
          // Navigate to dashboard after successful verification
          router.push('/dashboard');
        } else {
          console.log('❌ World ID verification failed or cancelled');
          // Still allow navigation for now (you can change this behavior)
          router.push('/dashboard');
        }
      } else {
        console.log('🔗 Not in World App, connecting wallet...');
        
        // For regular browsers, connect wallet first
        try {
          await connectWallet();
          router.push('/dashboard');
        } catch (walletError) {
          console.log('Wallet connection failed, proceeding to dashboard:', walletError);
          // Allow navigation even if wallet connection fails
          router.push('/dashboard');
        }
      }
    } catch (error) {
      console.error('Authentication error:', error);
      // Allow navigation even if verification fails for better UX
      router.push('/dashboard');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="landing-container">
      <div className="content">
        <h1 className="title">worldDao</h1>
        <p className="subtitle">Enter the decentralized future</p>
        <button 
          className="dive-button" 
          onClick={handleDiveInClick}
          disabled={isVerifying}
        >
          {isVerifying ? 'Verifying...' : 'dive into worldDao'}
        </button>
        {miniKitReady && (
          <p className="world-app-indicator">🌍 World App Detected</p>
        )}
      </div>
      <div className="background-pattern" />
    </div>
  );
}
