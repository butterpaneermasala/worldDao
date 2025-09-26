import React from 'react';
import { useRouter } from 'next/router';

export default function Landing() {
  const router = useRouter();
  return (
    <div className="landing-container">
      <div className="content">
        <h1 className="title">worldDao</h1>
        <p className="subtitle">Enter the decentralized future</p>
        <button className="dive-button" onClick={() => router.push('/dashboard')}>
          dive into worldDao
        </button>
      </div>
      <div className="background-pattern" />
    </div>
  );
}
