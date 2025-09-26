import React from 'react';
import { useNavigate } from 'react-router-dom';

function LandingPage() {
  const navigate = useNavigate();
  return (
    <div className="landing-container">
      <div className="content">
        <h1 className="title">worldDao</h1>
        <p className="subtitle">Enter the decentralized future</p>
        <button className="dive-button" onClick={() => navigate('/dashboard')}>
          dive into worldDao
        </button>
      </div>
      <div className="background-pattern"></div>
    </div>
  );
}

export default LandingPage;
