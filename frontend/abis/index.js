// Core ABI exports
import VotingABI from './Voting.json';
import NFTAuctionABI from './NFTAuction.json';
import NFTMinterABI from './NFTMinter.json';
import DailyAuctionABI from './DailyAuction.json';
import TreasuryABI from './Treasury.json';
import CandidateContractABI from './CandidateContract.json';
import WorldChainGovernorABI from './WorldChainGovernor.json';

// Contract addresses
export const ADDRESSES = {
    Voting: '0xe8f5cc47813466c67196b20504c1decb8b8f913c',
    NFTAuction: '0x41f8031297ec34b9ba0771e149d272977ed43d35',
    NFTMinter: '0x277b3a1dd185713c32c1fb5958e7188219bfc002',
    Treasury: '0x09d96fcc17b16752ec3673ea85b9a6fea697f697',
    CandidateContract: '0xB28Ba0b7c34832528154ce4a7AcC12b08A004d5D',
    WorldChainGovernor: '0x627e9A7DF8e3860B14B95cf7Cf0D7eE120163dD8',
    WorldNFT: '0x5BCAEf9a3059340f39e640875fE803422b5100C8'
};

export {
    VotingABI,
    NFTAuctionABI,
    NFTMinterABI,
    DailyAuctionABI,
    TreasuryABI,
    CandidateContractABI,
    WorldChainGovernorABI
};

// Default export for convenience
export default {
    Voting: VotingABI,
    NFTAuction: NFTAuctionABI,
    NFTMinter: NFTMinterABI,
    DailyAuction: DailyAuctionABI,
    CandidateContract: CandidateContractABI,
    WorldChainGovernor: WorldChainGovernorABI,
    Treasury: TreasuryABI
};