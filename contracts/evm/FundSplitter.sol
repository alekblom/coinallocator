// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FundSplitter
 * @notice Implementation contract for fund splitting. Deployed as EIP-1167 minimal proxies by FundSplitterFactory.
 * @dev Each clone is initialized once with recipients and share percentages.
 */
contract FundSplitter {
    struct Recipient {
        address payable wallet;
        uint16 shareBps; // basis points (0-10000)
        uint256 claimed;
    }

    string public name;
    address public creator;
    Recipient[] public recipients;
    uint256 public totalReceived;
    uint256 public createdAt;
    bool public initialized;
    bool public closed;

    event Initialized(string name, address indexed creator);
    event Distributed(uint256 amount);
    event Claimed(address indexed recipient, uint256 amount);
    event SplitClosed(address indexed creator);

    modifier onlyCreator() {
        require(msg.sender == creator, "Only creator");
        _;
    }

    /**
     * @notice Initialize the split (called by factory after clone).
     */
    function initialize(
        string calldata _name,
        address _creator,
        address payable[] calldata _wallets,
        uint16[] calldata _shares
    ) external {
        require(!initialized, "Already initialized");
        require(_wallets.length == _shares.length, "Length mismatch");
        require(_wallets.length >= 1 && _wallets.length <= 10, "1-10 recipients");

        uint16 totalBps;
        for (uint256 i = 0; i < _wallets.length; i++) {
            require(_wallets[i] != address(0), "Zero address");
            require(_shares[i] > 0, "Zero share");

            // Check for duplicates
            for (uint256 j = 0; j < i; j++) {
                require(_wallets[i] != _wallets[j], "Duplicate wallet");
            }

            recipients.push(Recipient({
                wallet: _wallets[i],
                shareBps: _shares[i],
                claimed: 0
            }));
            totalBps += _shares[i];
        }
        require(totalBps == 10000, "Shares must total 10000 bps");

        name = _name;
        creator = _creator;
        createdAt = block.timestamp;
        initialized = true;

        emit Initialized(_name, _creator);
    }

    /**
     * @notice Accept ETH deposits.
     */
    receive() external payable {
        require(initialized, "Not initialized");
        require(!closed, "Split closed");
        totalReceived += msg.value;
    }

    /**
     * @notice Push-distribute all current balance to recipients proportionally.
     */
    function distribute() external {
        require(initialized, "Not initialized");
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");

        uint256 distributed;
        for (uint256 i = 0; i < recipients.length; i++) {
            uint256 share = (balance * recipients[i].shareBps) / 10000;
            if (i == recipients.length - 1) {
                // Last recipient gets remainder to avoid dust
                share = balance - distributed;
            }
            recipients[i].claimed += share;
            distributed += share;
            recipients[i].wallet.transfer(share);
        }

        emit Distributed(balance);
    }

    /**
     * @notice Pull model: msg.sender claims their entitled share of undistributed funds.
     */
    function claim() external {
        require(initialized, "Not initialized");

        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i].wallet == msg.sender) {
                uint256 entitled = (totalReceived * recipients[i].shareBps) / 10000;
                uint256 claimable = entitled - recipients[i].claimed;
                require(claimable > 0, "Nothing to claim");

                recipients[i].claimed += claimable;
                recipients[i].wallet.transfer(claimable);

                emit Claimed(msg.sender, claimable);
                return;
            }
        }
        revert("Not a recipient");
    }

    /**
     * @notice Creator closes the split (emits event, no selfdestruct per EIP-6780).
     */
    function closeSplit() external onlyCreator {
        require(!closed, "Already closed");
        closed = true;

        // Distribute remaining balance if any
        uint256 balance = address(this).balance;
        if (balance > 0) {
            uint256 distributed;
            for (uint256 i = 0; i < recipients.length; i++) {
                uint256 share = (balance * recipients[i].shareBps) / 10000;
                if (i == recipients.length - 1) {
                    share = balance - distributed;
                }
                recipients[i].claimed += share;
                distributed += share;
                recipients[i].wallet.transfer(share);
            }
        }

        emit SplitClosed(msg.sender);
    }

    /**
     * @notice View helper returning all recipients data.
     */
    function getAllRecipients() external view returns (
        address[] memory wallets,
        uint16[] memory shares,
        uint256[] memory claimed
    ) {
        uint256 len = recipients.length;
        wallets = new address[](len);
        shares = new uint16[](len);
        claimed = new uint256[](len);

        for (uint256 i = 0; i < len; i++) {
            wallets[i] = recipients[i].wallet;
            shares[i] = recipients[i].shareBps;
            claimed[i] = recipients[i].claimed;
        }
    }

    function recipientCount() external view returns (uint256) {
        return recipients.length;
    }
}
