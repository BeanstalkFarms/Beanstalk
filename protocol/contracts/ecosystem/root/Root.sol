/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable-8/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable-8/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable-8/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable-8/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable-8/utils/math/MathUpgradeable.sol";

import "~/interfaces/IBeanstalk.sol";
import "~/interfaces/IDelegation.sol";

/// @notice Silo deposit transfer
/// @param token a whitelisted silo token address
/// @param grownStalkPerBdvs a list of deposit grownStalkPerBdvs
/// @param amounts a list of deposit amount
struct DepositTransfer {
    address token;
    uint32[] grownStalkPerBdvs;
    uint256[] amounts;
}

/// @title Root FDBDV
/// @author 0xkokonut, mistermanifold, publius
contract Root is UUPSUpgradeable, ERC20PermitUpgradeable, OwnableUpgradeable {
    using MathUpgradeable for uint256;

    /// @notice This event will emit after the user mint Root token
    /// @param account minting user
    /// @param deposits silo deposits transferred into contract
    /// @param bdv total bdv used for deposits
    /// @param stalk total stalk for deposits
    /// @param stalkPerBdvPerSeasons total stalkPerBdvPerSeasons for deposits
    /// @param shares total shares minted
    event Mint(
        address indexed account,
        DepositTransfer[] deposits,
        uint256 bdv,
        uint256 stalk,
        uint256 stalkPerBdvPerSeasons,
        uint256 shares
    );

    /// @notice This event will emit after the user redeem Root token
    /// @param account redeeming user
    /// @param deposits silo deposits transferred to the user
    /// @param bdv total bdv for deposits
    /// @param stalk total stalk for deposits
    /// @param stalkPerBdvPerSeasons total stalkPerBdvPerSeasons for deposits
    /// @param shares total shares burned
    event Redeem(
        address indexed account,
        DepositTransfer[] deposits,
        uint256 bdv,
        uint256 stalk,
        uint256 stalkPerBdvPerSeasons,
        uint256 shares
    );

    /// @notice This event will emit after the owner whitelist a silo token
    /// @param token address of a silo token
    event AddWhitelistToken(address indexed token);

    /// @notice This event will emit after the owner remove a silo token from whitelist
    /// @param token address of a silo token
    event RemoveWhitelistToken(address indexed token);

    /// @notice Beanstalk address
    address public constant BEANSTALK_ADDRESS =
        0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5;

    /// @notice Decimal precision of this contract token
    uint256 private constant PRECISION = 1e18;

    /// @notice A mapping of whitelisted token
    /// @return whitelisted mapping of all whitelisted token
    mapping(address => bool) public whitelisted;

    /// @notice The total bdv of the silo deposits in the contract
    /// @dev only get updated on mint/earn/redeem
    /// @return underlyingBdv total bdv of the silo deposit(s) in the contract
    uint256 public underlyingBdv;

    /// @notice Nominated candidate to be the owner of the contract
    /// @dev The nominated candidate need to call the claimOwnership function
    /// @return ownerCandidate The nomindated candidate to become the new owner of the contract
    address public ownerCandidate;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the contract
    /// @param name The name of this ERC-20 contract
    /// @param symbol The symbol of this ERC-20 contract
    function initialize(string calldata name, string calldata symbol)
        external
        initializer
    {
        __ERC20_init(name, symbol);
        __ERC20Permit_init(name);
        __Ownable_init();
    }

    /// @notice Renounce ownership of contract
    /// @dev Not possible with this smart contract
    function renounceOwnership() public virtual override onlyOwner {
        revert("Ownable: Can't renounceOwnership here");
    }

    /// @notice Nominate a candidate to become the new owner of the contract
    /// @dev The nominated candidate need to call claimOwnership function
    function transferOwnership(address newOwner)
        public
        virtual
        override
        onlyOwner
    {
        require(
            newOwner != address(0),
            "Ownable: Non-zero owner address required"
        );
        ownerCandidate = newOwner;
    }

    /// @notice Nominated candidate claim ownership
    function claimOwnership() external {
        require(
            msg.sender == ownerCandidate,
            "Ownable: sender must be ownerCandidate to accept ownership"
        );
        _transferOwnership(ownerCandidate);
        ownerCandidate = address(0);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    /// @notice Owner whitelist a silo token
    /// @param token Silo token to be add to the whitelist
    function addWhitelistToken(address token) external onlyOwner {
        require(token != address(0), "Non-zero token address required");
        whitelisted[token] = true;
        emit AddWhitelistToken(token);
    }

    /// @notice Remove silo token from the whitelist
    /// @param token Silo token to be remove from the whitelist
    function removeWhitelistToken(address token) external onlyOwner {
        require(token != address(0), "Non-zero token address required");
        delete whitelisted[token];
        emit RemoveWhitelistToken(token);
    }

    /// @notice Delegate snapshot voting power
    /// @param _delegateContract snapshot delegate contract
    /// @param _delegate account to delegate voting power
    /// @param _snapshotId snapshot space key
    function setDelegate(
        address _delegateContract,
        address _delegate,
        bytes32 _snapshotId
    ) external onlyOwner {
        require(
            _delegateContract != address(0),
            "Non-zero delegate address required"
        );
        if (_delegate == address(0)) {
            IDelegation(_delegateContract).clearDelegate(_snapshotId);
        } else {
            IDelegation(_delegateContract).setDelegate(_snapshotId, _delegate);
        }
    }

    /// @notice Update bdv of a silo deposit and underlyingBdv
    /// @dev Will revert if bdv doesn't increase
    function updateBdv(address token, uint32 grownStalkPerBdv) external {
        _updateBdv(token, grownStalkPerBdv);
    }

    /// @notice Update Bdv of multiple silo deposits and underlyingBdv
    /// @dev Will revert if the bdv of the deposits doesn't increase
    function updateBdvs(address[] calldata tokens, uint32[] calldata grownStalkPerBdvs)
        external
    {
        for (uint256 i; i < tokens.length; ++i) {
            _updateBdv(tokens[i], grownStalkPerBdvs[i]);
        }
    }

    /// @notice Update silo deposit bdv and underlyingBdv
    /// @dev Will revert if the BDV doesn't increase
    function _updateBdv(address token, uint32 grownStalkPerBdv) internal {
        require(token != address(0), "Bdv: Non-zero token address required");
        (uint256 amount, ) = IBeanstalk(BEANSTALK_ADDRESS).getDeposit(
            address(this),
            token,
            grownStalkPerBdv
        );
        uint32[] memory grownStalkPerBdvs = new uint32[](1);
        grownStalkPerBdvs[0] = grownStalkPerBdv;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        (, , , uint256 fromBdv, uint256 toBdv) = IBeanstalk(BEANSTALK_ADDRESS)
            .convert(
                abi.encode(ConvertKind.LAMBDA_LAMBDA, amount, token),
                grownStalkPerBdvs,
                amounts
            );
        underlyingBdv += toBdv - fromBdv;
    }

    /// @notice Return the ratio of underlyingBdv per ROOT token
    function bdvPerRoot() external view returns (uint256) {
        return (underlyingBdv * PRECISION) / totalSupply();
    }

    /// @notice Call plant function on Beanstalk
    /// @dev Anyone can call this function on behalf of the contract
    function earn() external {
        uint256 beans = IBeanstalk(BEANSTALK_ADDRESS).plant();
        underlyingBdv += beans;
    }

    /// @dev return the min value of the three input values
    function _min(
        uint256 num1,
        uint256 num2,
        uint256 num3
    ) internal pure returns (uint256) {
        num1 = MathUpgradeable.min(num1, num2);
        return MathUpgradeable.min(num1, num3);
    }

    /// @dev return the max value of the three input values
    function _max(
        uint256 num1,
        uint256 num2,
        uint256 num3
    ) internal pure returns (uint256) {
        num1 = MathUpgradeable.max(num1, num2);
        return MathUpgradeable.max(num1, num3);
    }

    /// @notice Mint ROOT token using silo deposit(s) with a silo deposit permit
    /// @dev Make sure any token inside of DepositTransfer have sufficient approval either via permit in the arg or existing approval
    /// @param depositTransfers silo deposit(s) to mint ROOT token
    /// @param mode Transfer ROOT token to
    /// @param minRootsOut Minimum number of ROOT token to receive
    /// @param token a silo deposit token address
    /// @param value a silo deposit amount
    /// @param deadline permit expiration
    /// @param v permit signature
    /// @param r permit signature
    /// @param s permit signature
    function mintWithTokenPermit(
        DepositTransfer[] calldata depositTransfers,
        To mode,
        uint256 minRootsOut,
        address token,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external virtual returns (uint256) {
        IBeanstalk(BEANSTALK_ADDRESS).permitDeposit(
            msg.sender,
            address(this),
            token,
            value,
            deadline,
            v,
            r,
            s
        );

        return _transferAndMint(depositTransfers, mode, minRootsOut);
    }

    /// @notice Mint ROOT token using silo deposit(s) with silo deposit tokens and values permit
    /// @param depositTransfers silo deposit(s) to mint ROOT token
    /// @param mode Transfer ROOT token to
    /// @param minRootsOut Minimum number of ROOT token to receive
    /// @param tokens a list of silo deposit token address
    /// @param values a list of silo deposit amount
    /// @param deadline permit expiration
    /// @param v permit signature
    /// @param r permit signature
    /// @param s permit signature
    function mintWithTokensPermit(
        DepositTransfer[] calldata depositTransfers,
        To mode,
        uint256 minRootsOut,
        address[] calldata tokens,
        uint256[] calldata values,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external virtual returns (uint256) {
        IBeanstalk(BEANSTALK_ADDRESS).permitDeposits(
            msg.sender,
            address(this),
            tokens,
            values,
            deadline,
            v,
            r,
            s
        );

        return _transferAndMint(depositTransfers, mode, minRootsOut);
    }

    /// @notice Mint ROOT token using silo deposit(s)
    /// @param depositTransfers silo deposit(s) to mint ROOT token
    /// @param mode Transfer ROOT token to
    /// @param minRootsOut Minimum number of ROOT token to receive
    function mint(
        DepositTransfer[] calldata depositTransfers,
        To mode,
        uint256 minRootsOut
    ) external virtual returns (uint256) {
        return _transferAndMint(depositTransfers, mode, minRootsOut);
    }

    /// @notice Redeem ROOT token for silo deposit(s) with farm balance permit
    /// @param depositTransfers silo deposit(s) receive
    /// @param mode Burn ROOT token from
    /// @param maxRootsIn Maximum number of ROOT token to burn
    /// @param token ROOT address
    /// @param value amount of ROOT approved
    /// @param deadline permit expiration
    /// @param v permit signature
    /// @param r permit signature
    /// @param s permit signature
    function redeemWithFarmBalancePermit(
        DepositTransfer[] calldata depositTransfers,
        From mode,
        uint256 maxRootsIn,
        address token,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external virtual returns (uint256) {
        IBeanstalk(BEANSTALK_ADDRESS).permitToken(
            msg.sender,
            address(this),
            token,
            value,
            deadline,
            v,
            r,
            s
        );
        return _transferAndRedeem(depositTransfers, mode, maxRootsIn);
    }

    /// @notice Redeem ROOT token for silo deposit(s)
    /// @param depositTransfers silo deposit(s) receive
    /// @param mode Burn ROOT token from
    /// @param maxRootsIn Maximum number of ROOT token to burn
    function redeem(
        DepositTransfer[] calldata depositTransfers,
        From mode,
        uint256 maxRootsIn
    ) external virtual returns (uint256) {
        return _transferAndRedeem(depositTransfers, mode, maxRootsIn);
    }

    /// @notice Burn ROOT token to exchange for silo deposit(s)
    function _transferAndRedeem(
        DepositTransfer[] calldata depositTransfers,
        From mode,
        uint256 maxRootsIn
    ) internal returns (uint256) {
        (
            uint256 shares,
            uint256 bdv,
            uint256 stalk,
            uint256 stalkPerBdvPerSeasons
        ) = _transferDeposits(depositTransfers, false);

        require(
            shares <= maxRootsIn,
            "Redeem: shares is greater than maxRootsIn"
        );

        // Default mode is EXTERNAL
        address burnAddress = msg.sender;
        // Transfer token from beanstalk internal to this contract and burn
        if (mode == From.INTERNAL) {
            burnAddress = address(this);
            IBeanstalk(BEANSTALK_ADDRESS).transferInternalTokenFrom(
                this,
                msg.sender,
                burnAddress,
                shares,
                To.EXTERNAL
            );
        }
        _burn(burnAddress, shares);
        emit Redeem(msg.sender, depositTransfers, bdv, stalk, stalkPerBdvPerSeasons, shares);
        return shares;
    }

    /// @notice Transfer silo deposit(s) to exchange ROOT token
    function _transferAndMint(
        DepositTransfer[] calldata depositTransfers,
        To mode,
        uint256 minRootsOut
    ) internal returns (uint256) {
        (
            uint256 shares,
            uint256 bdv,
            uint256 stalk,
            uint256 stalkPerBdvPerSeasons
        ) = _transferDeposits(depositTransfers, true);

        require(shares >= minRootsOut, "Mint: shares is less than minRootsOut");

        // Transfer mint tokens to beanstalk internal balance
        if (mode == To.INTERNAL) {
            _mint(address(this), shares);
            _approve(address(this), BEANSTALK_ADDRESS, shares);
            IBeanstalk(BEANSTALK_ADDRESS).transferToken(
                this,
                msg.sender,
                shares,
                From.EXTERNAL,
                To.INTERNAL
            );
        } else if (mode == To.EXTERNAL) {
            _mint(msg.sender, shares);
        }

        emit Mint(msg.sender, depositTransfers, bdv, stalk, stalkPerBdvPerSeasons, shares);
        return shares;
    }

    /// @notice Transfer Silo Deposit(s) between user/ROOT contract and update
    /// @return shares number of shares will be mint/burn
    /// @return bdv total bdv of depositTransfers
    /// @return stalk total stalk of depositTransfers
    /// @return stalkPerBdvPerSeasons total stalkPerBdvPerSeasons of depositTransfers
    function _transferDeposits(
        DepositTransfer[] calldata depositTransfers,
        bool isDeposit
    )
        internal
        returns (
            uint256 shares,
            uint256 bdv,
            uint256 stalk,
        )
    {
        IBeanstalk(BEANSTALK_ADDRESS).update(address(this));
        
        uint256 balanceOfStalkBefore = IBeanstalk(BEANSTALK_ADDRESS)
            .balanceOfStalk(address(this));

        for (uint256 i; i < depositTransfers.length; ++i) {
            require(
                whitelisted[depositTransfers[i].token],
                "Token is not whitelisted"
            );

            uint256[] memory bdvs = _transferDeposit(
                depositTransfers[i],
                isDeposit
            );
            for (uint256 j; j < bdvs.length; ++j) {
                bdv += bdvs[j];
            }
        }

        
        uint256 balanceOfStalkAfter = IBeanstalk(BEANSTALK_ADDRESS)
            .balanceOfStalk(address(this));

        uint256 underlyingBdvAfter;
        if (isDeposit) {
            underlyingBdvAfter = underlyingBdv + bdv;
            stalk = balanceOfStalkAfter - balanceOfStalkBefore;
        } else {
            underlyingBdvAfter = underlyingBdv - bdv;
            stalk = balanceOfStalkBefore - balanceOfStalkAfter;
        }
        uint256 supply = totalSupply();
        if (supply == 0) {
            shares = stalk * 1e8; // Stalk is 1e10 so we want to initialize the initial supply to 1e18
        } else if (isDeposit) {
            shares =
                supply.mulDiv(
                    _min(
                        underlyingBdvAfter.mulDiv(
                            PRECISION,
                            underlyingBdv,
                            MathUpgradeable.Rounding.Down
                        ),
                        balanceOfStalkAfter.mulDiv(
                            PRECISION,
                            balanceOfStalkBefore,
                            MathUpgradeable.Rounding.Down
                        ),
                    ),
                    PRECISION,
                    MathUpgradeable.Rounding.Down
                ) -
                supply;
        } else {
            shares =
                supply -
                supply.mulDiv(
                    _min(
                        underlyingBdvAfter.mulDiv(
                            PRECISION,
                            underlyingBdv,
                            MathUpgradeable.Rounding.Up
                        ),
                        balanceOfStalkAfter.mulDiv(
                            PRECISION,
                            balanceOfStalkBefore,
                            MathUpgradeable.Rounding.Up
                        ),
                    ),
                    PRECISION,
                    MathUpgradeable.Rounding.Up
                );
        }

        underlyingBdv = underlyingBdvAfter;
    }

    /// @notice Transfer silo deposit(s) between contract/user
    function _transferDeposit(
        DepositTransfer calldata depositTransfer,
        bool isDeposit
    ) internal returns (uint256[] memory bdvs) {
        bdvs = IBeanstalk(BEANSTALK_ADDRESS).transferDeposits(
            isDeposit ? msg.sender : address(this),
            isDeposit ? address(this) : msg.sender,
            depositTransfer.token,
            depositTransfer.amounts
        );
    }
}
