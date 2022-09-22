pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable-8/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
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

contract FDBDV is UUPSUpgradeable, ERC20PermitUpgradeable, OwnableUpgradeable {
    using MathUpgradeable for uint256;

    event Deposits(
        address indexed account,
        DepositTransfer[] deposits,
        uint256 bdv,
        uint256 stalk,
        uint256 seeds,
        uint256 shares
    );

    event Withdraws(
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

    function initialize(string memory name, string memory symbol)
        public
        initializer
    {
        __ERC20_init(name, symbol);
        __ERC20Permit_init(name);
        __Ownable_init();
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
        bytes32 snapshotId
    ) external onlyOwner {
        if (_delegate == address(0)) {
            IDelegation(_delegateContract).clearDelegate(snapshotId);
        } else {
            IDelegation(_delegateContract).setDelegate(snapshotId, _delegate);
        }
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

    function deposits(DepositTransfer[] calldata _deposits)
        public
        virtual
        returns (uint256)
    {
        (
            uint256 shares,
            uint256 bdv,
            uint256 stalk,
            uint256 seed
        ) = _transferDeposits(_deposits, true);
        _mint(msg.sender, shares);
        emit Deposits(msg.sender, _deposits, bdv, stalk, seed, shares);
        return shares;
    }

    function withdraws(DepositTransfer[] calldata _deposits)
        public
        virtual
        returns (uint256)
    {
        (
            uint256 shares,
            uint256 bdv,
            uint256 stalk,
            uint256 seed
        ) = _transferDeposits(_deposits, false);
        _burn(msg.sender, shares);
        emit Withdraws(msg.sender, _deposits, bdv, stalk, seed, shares);
        return shares;
    }

    function _transferDeposits(
        DepositTransfer[] memory _deposits,
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
        uint256 balanceOfSeedBefore = IBeanstalk(BEANSTALK_ADDRESS)
            .balanceOfSeeds(address(this));
        uint256 balanceOfStalkBefore = IBeanstalk(BEANSTALK_ADDRESS)
            .balanceOfStalk(address(this));

        for (uint256 i; i < _deposits.length; ++i) {
            require(
                whitelisted[_deposits[i].token],
                "Token is not whitelisted"
            );

            uint256[] memory bdvs = IBeanstalk(BEANSTALK_ADDRESS)
                .transferDeposits(
                    isDeposit ? msg.sender : address(this),
                    isDeposit ? address(this) : msg.sender,
                    _deposits[i].token,
                    _deposits[i].seasons,
                    _deposits[i].amounts
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
            shares = supply.mulDiv(
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
            );
        } else {
            shares = supply.mulDiv(
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
