// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;


import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Fertilizer1155.sol";
import "~/libraries/LibSafeMath32.sol";
import "~/libraries/LibSafeMath128.sol";

/**
 * @author publius
 * @title Fertilizer before the Unpause
 */

contract Internalizer is OwnableUpgradeable, ReentrancyGuardUpgradeable, Fertilizer1155 {

    using SafeERC20Upgradeable for IERC20;
    using LibSafeMath128 for uint128;

    struct Balance {
        uint128 amount;
        uint128 lastBpf;
    }

    function __Internallize_init(string memory uri_) internal {
        __Ownable_init();
        __ERC1155_init(uri_);
        __ReentrancyGuard_init();
    }

    mapping(uint256 => mapping(address => Balance)) internal _balances;

    string private _uri;

    function uri(uint256 _id) external view virtual override returns (string memory) {
        return string(abi.encodePacked(_uri, StringsUpgradeable.toString(_id)));
    }

    function setURI(string calldata newuri) public onlyOwner {
        _uri = newuri;
    }

    function name() public pure returns (string memory) {
        return "Fertilizer";
    }

    function symbol() public pure returns (string memory) {
        return "FERT";
    }

    function balanceOf(address account, uint256 id) public view virtual override returns (uint256) {
        require(account != address(0), "ERC1155: balance query for the zero address");
        return _balances[id][account].amount;
    }

    function lastBalanceOf(address account, uint256 id) public view returns (Balance memory) {
        require(account != address(0), "ERC1155: balance query for the zero address");
        return _balances[id][account];
    }

    function lastBalanceOfBatch(address[] memory accounts, uint256[] memory ids) external view returns (Balance[] memory balances) {
        balances = new Balance[](accounts.length);
        for (uint256 i; i < accounts.length; ++i) {
            balances[i] = lastBalanceOf(accounts[i], ids[i]);
        }
    }

    function _transfer(
        address from,
        address to,
        uint256 id,
        uint256 amount
    ) internal virtual override {
        uint128 _amount = uint128(amount);
        if (from != address(0)) {
            uint128 fromBalance = _balances[id][from].amount;
            require(uint256(fromBalance) >= amount, "ERC1155: insufficient balance for transfer");
            // Because we know fromBalance >= amount, we know amount < type(uint128).max
            _balances[id][from].amount = fromBalance - _amount;
        }
        _balances[id][to].amount = _balances[id][to].amount.add(_amount);
    }
}