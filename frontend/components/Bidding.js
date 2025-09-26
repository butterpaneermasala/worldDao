import React from 'react';
import Link from 'next/link';

export default function Bidding() {
  return (
    <div className="fullscreen-overlay">
      <div className="fullscreen-topbar">
        <div className="right-title">bidding page</div>
        <Link className="close-button" href="/dashboard">close</Link>
      </div>
      <div style={{ color: '#ccc' }}>Bidding section fullscreen placeholder</div>
    </div>
  );
}
