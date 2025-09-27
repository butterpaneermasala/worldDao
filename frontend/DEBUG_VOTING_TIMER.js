// Add this to your VotingGallery.js component for debugging
// Place it inside the checkVotingStatus function after getting contract info

const debugVotingTimer = () => {
    console.log('🔍 VOTING TIMER DEBUG:');
    console.log('Contract Address:', process.env.NEXT_PUBLIC_VOTING_ADDRESS);
    console.log('isVotingOpen:', isVotingOpen);
    console.log('Phase Info:', phaseInfo);
    console.log('End Time (timestamp):', phaseInfo.endTime);
    console.log('End Time (human):', new Date(phaseInfo.endTime * 1000).toLocaleString());
    console.log('Current Time (timestamp):', Math.floor(Date.now() / 1000));
    console.log('Current Time (human):', new Date().toLocaleString());
    console.log('Time Left (seconds):', timeLeft);
    console.log('Formatted Display:', formatTimeLeft(timeLeft));
    console.log('---');
};

// Call this function after setting phaseInfo
debugVotingTimer();