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

contract Root is UUPSUpgradeable, ERC20PermitUpgradeable, OwnableUpgradeable {
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
        bytes32 _snapshotId
    ) external onlyOwner {
        if (_delegate == address(0)) {
            IDelegation(_delegateContract).clearDelegate(_snapshotId);
        } else {
            IDelegation(_delegateContract).setDelegate(_snapshotId, _delegate);
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

    function depositsWithTokenPermit(
        DepositTransfer[] calldata depositTransfers,
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

        return _deposits(depositTransfers);
    }

    function depositsWithTokensPermit(
        DepositTransfer[] calldata depositTransfers,
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

        return _deposits(depositTransfers);
    }

    function deposits(DepositTransfer[] calldata depositTransfers)
        public
        virtual
        returns (uint256)
    {
        return _deposits(depositTransfers);
    }

    function withdraws(DepositTransfer[] calldata depositTransfers)
        public
        virtual
        returns (uint256)
    {
        (
            uint256 shares,
            uint256 bdv,
            uint256 stalk,
            uint256 seed
        ) = _transferDeposits(depositTransfers, false);
        _burn(msg.sender, shares);
        emit Withdraws(msg.sender, depositTransfers, bdv, stalk, seed, shares);
        return shares;
    }

    function _deposits(DepositTransfer[] memory depositTransfers)
        internal
        returns (uint256)
    {
        (
            uint256 shares,
            uint256 bdv,
            uint256 stalk,
            uint256 seed
        ) = _transferDeposits(depositTransfers, true);
        _mint(msg.sender, shares);
        emit Deposits(msg.sender, depositTransfers, bdv, stalk, seed, shares);
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