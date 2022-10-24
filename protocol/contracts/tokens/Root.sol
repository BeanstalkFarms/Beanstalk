/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable-8/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable-8/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable-8/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable-8/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable-8/utils/math/MathUpgradeable.sol";

import "../interfaces/IBeanstalk.sol";
import "../interfaces/IDelegation.sol";

struct DepositTransfer {
    address token;
    uint32[] seasons;
    uint256[] amounts;
}

contract Root is UUPSUpgradeable, ERC20PermitUpgradeable, OwnableUpgradeable {
    using MathUpgradeable for uint256;

    event Mint(
        address indexed account,
        DepositTransfer[] deposits,
        uint256 bdv,
        uint256 stalk,
        uint256 seeds,
        uint256 shares
    );

    event Redeem(
        address indexed account,
        DepositTransfer[] deposits,
        uint256 bdv,
        uint256 stalk,
        uint256 seeds,
        uint256 shares
    );

    event AddWhitelistToken(address indexed token);
    event RemoveWhitelistToken(address indexed token);

    address public constant BEANSTALK_ADDRESS =
        0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5;
    uint256 private constant PRECISION = 1e18;
    mapping(address => bool) public whitelisted;
    uint256 public underlyingBdv;

    /// @notice Nominated candidate to be the owner of the contract
    /// @dev The nominated candidate need to call the claimOwnership function
    /// @return ownerCandidate The nomindated candidate to become the new owner of the contract
    address public ownerCandidate;


    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(string memory name, string memory symbol)
        public
        initializer
    {
        __ERC20_init(name, symbol);
        __ERC20Permit_init(name);
        __Ownable_init();
    }

    function renounceOwnership() public virtual override onlyOwner {
        revert("Ownable: Can't renounceOwnership here"); // not possible with this smart contract
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

    function addWhitelistToken(address token) public onlyOwner {
        whitelisted[token] = true;
        emit AddWhitelistToken(token);
    }

    function removeWhitelistToken(address token) public onlyOwner {
        delete whitelisted[token];
        emit RemoveWhitelistToken(token);
    }

    function setDelegate(
        address _delegateContract,
        address _delegate,
        bytes32 _snapshotId
    ) external onlyOwner {
        if (_delegate == address(0)) {
            IDelegation(_delegateContract).clearDelegate(_snapshotId);
        } else {
            IDelegation(_delegateContract).setDelegate(_snapshotId, _delegate);
        }
    }

    function convertLambdaToLambda(address token, uint32 season) public {
        _convertLambdaToLambda(token, season);
    }

    function convertLambdasToLambdas(address[] calldata tokens, uint32[] calldata seasons) public {
        for (uint256 i; i < tokens.length; ++i) {
            _convertLambdaToLambda(tokens[i], seasons[i]);
        }
    }

    function _convertLambdaToLambda(address token, uint32 season) internal {
        (uint256 amount,) = IBeanstalk(BEANSTALK_ADDRESS).getDeposit(address(this), token, season);
        uint32[] memory seasons = new uint32[](1);
        seasons[0] = season;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        (,,,uint256 fromBdv, uint256 toBdv) = IBeanstalk(BEANSTALK_ADDRESS).convert(
            abi.encode(ConvertKind.LAMBDA_LAMBDA, amount, token),
            seasons,
            amounts
        );
        underlyingBdv += toBdv - fromBdv;
    }

    function bdvPerRoot() public view returns (uint256) {
        return (underlyingBdv * PRECISION) / totalSupply();
    }

    function earn() public {
        uint256 beans = IBeanstalk(BEANSTALK_ADDRESS).plant();
        underlyingBdv += beans;
    }

    function min(
        uint256 num1,
        uint256 num2,
        uint256 num3
    ) internal pure returns (uint256) {
        num1 = MathUpgradeable.min(num1, num2);
        return MathUpgradeable.min(num1, num3);
    }

    function max(
        uint256 num1,
        uint256 num2,
        uint256 num3
    ) internal pure returns (uint256) {
        num1 = MathUpgradeable.max(num1, num2);
        return MathUpgradeable.max(num1, num3);
    }

    function mintWithTokenPermit(
        DepositTransfer[] calldata depositTransfers,
        To mode,
        address token,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public virtual returns (uint256) {
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

        return _transferAndMint(depositTransfers, mode);
    }

    function mintWithTokensPermit(
        DepositTransfer[] calldata depositTransfers,
        To mode,
        address[] memory tokens,
        uint256[] memory values,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public virtual returns (uint256) {
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

        return _transferAndMint(depositTransfers, mode);
    }

    function mint(DepositTransfer[] calldata depositTransfers, To mode)
        public
        virtual
        returns (uint256)
    {
        return _transferAndMint(depositTransfers, mode);
    }

    function redeemWithFarmBalancePermit(
        DepositTransfer[] calldata depositTransfers,
        From mode,
        address token,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public virtual returns (uint256) {
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
        return _transferAndRedeem(depositTransfers, mode);
    }

    function redeem(DepositTransfer[] calldata depositTransfers, From mode)
        public
        virtual
        returns (uint256)
    {
        return _transferAndRedeem(depositTransfers, mode);
    }

    function _transferAndRedeem(
        DepositTransfer[] memory depositTransfers,
        From mode
    ) internal returns (uint256) {
        (
            uint256 shares,
            uint256 bdv,
            uint256 stalk,
            uint256 seed
        ) = _transferDeposits(depositTransfers, false);

        // Default mode is EXTERNAL
        address burnAddress = msg.sender;
        // Transfer token from beanstalk internal to this contract and burn
        if (mode != From.EXTERNAL) {
            burnAddress = address(this);
            IBeanstalk(BEANSTALK_ADDRESS).transferTokenFrom(
                this,
                msg.sender,
                burnAddress,
                shares,
                mode,
                To.EXTERNAL
            );
        }
        _burn(burnAddress, shares);
        emit Redeem(msg.sender, depositTransfers, bdv, stalk, seed, shares);
        return shares;
    }

    function _transferAndMint(
        DepositTransfer[] memory depositTransfers,
        To mode
    ) internal returns (uint256) {
        (
            uint256 shares,
            uint256 bdv,
            uint256 stalk,
            uint256 seed
        ) = _transferDeposits(depositTransfers, true);

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

        emit Mint(msg.sender, depositTransfers, bdv, stalk, seed, shares);
        return shares;
    }

    function _transferDeposits(
        DepositTransfer[] memory depositTransfers,
        bool isDeposit
    )
        internal
        returns (
            uint256 shares,
            uint256 bdv,
            uint256 stalk,
            uint256 seed
        )
    {
        IBeanstalk(BEANSTALK_ADDRESS).update(address(this));
        uint256 balanceOfSeedBefore = IBeanstalk(BEANSTALK_ADDRESS)
            .balanceOfSeeds(address(this));
        uint256 balanceOfStalkBefore = IBeanstalk(BEANSTALK_ADDRESS)
            .balanceOfStalk(address(this));

        for (uint256 i; i < depositTransfers.length; ++i) {
            require(
                whitelisted[depositTransfers[i].token],
                "Token is not whitelisted"
            );

            uint256[] memory bdvs = IBeanstalk(BEANSTALK_ADDRESS)
                .transferDeposits(
                    isDeposit ? msg.sender : address(this),
                    isDeposit ? address(this) : msg.sender,
                    depositTransfers[i].token,
                    depositTransfers[i].seasons,
                    depositTransfers[i].amounts
                );
            for (uint256 j; j < bdvs.length; ++j) {
                bdv += bdvs[j];
            }
        }

        uint256 balanceOfSeedAfter = IBeanstalk(BEANSTALK_ADDRESS)
            .balanceOfSeeds(address(this));
        uint256 balanceOfStalkAfter = IBeanstalk(BEANSTALK_ADDRESS)
            .balanceOfStalk(address(this));

        uint256 underlyingBdvAfter;
        if (isDeposit) {
            underlyingBdvAfter = underlyingBdv + bdv;
            stalk = balanceOfStalkAfter - balanceOfStalkBefore;
            seed = balanceOfSeedAfter - balanceOfSeedBefore;
        } else {
            underlyingBdvAfter = underlyingBdv - bdv;
            stalk = balanceOfStalkBefore - balanceOfStalkAfter;
            seed = balanceOfSeedBefore - balanceOfSeedAfter;
        }
        uint256 supply = totalSupply();
        if (supply == 0) {
            shares = stalk;
        } else if (isDeposit) {
            shares =
                supply.mulDiv(
                    min(
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
                        balanceOfSeedAfter.mulDiv(
                            PRECISION,
                            balanceOfSeedBefore,
                            MathUpgradeable.Rounding.Down
                        )
                    ),
                    PRECISION,
                    MathUpgradeable.Rounding.Down
                ) -
                supply;
        } else {
            shares =
                supply -
                supply.mulDiv(
                    max(
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
                        balanceOfSeedAfter.mulDiv(
                            PRECISION,
                            balanceOfSeedBefore,
                            MathUpgradeable.Rounding.Up
                        )
                    ),
                    PRECISION,
                    MathUpgradeable.Rounding.Up
                );
        }

        underlyingBdv = underlyingBdvAfter;
    }
}
