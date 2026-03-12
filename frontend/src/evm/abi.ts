// Human-readable ABIs for ethers v6

export const FACTORY_ABI = [
  'function createSplit(string _name, address[] _wallets, uint16[] _shares) returns (address split)',
  'function predictAddress(address _creator, string _name) view returns (address)',
  'function implementation() view returns (address)',
  'event SplitCreated(address indexed splitAddress, address indexed creator, string name)',
];

export const SPLIT_ABI = [
  'function name() view returns (string)',
  'function creator() view returns (address)',
  'function totalReceived() view returns (uint256)',
  'function createdAt() view returns (uint256)',
  'function closed() view returns (bool)',
  'function recipientCount() view returns (uint256)',
  'function recipients(uint256) view returns (address wallet, uint16 shareBps, uint256 claimed)',
  'function getAllRecipients() view returns (address[] wallets, uint16[] shares, uint256[] claimed)',
  'function distribute()',
  'function claim()',
  'function closeSplit()',
  'event Initialized(string name, address indexed creator)',
  'event Distributed(uint256 amount)',
  'event Claimed(address indexed recipient, uint256 amount)',
  'event SplitClosed(address indexed creator)',
];
