// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./Internalizer.sol";

/**
 * @author publius
 * @title Barn Raiser 
 */

interface IBS {
    function payFertilizer(address account, uint256 amount) external;
    function beansPerFertilizer() external view returns (uint128);
    function getEndBpf() external view returns (uint128);
    function remainingRecapitalization() external view returns (uint256);
}

contract Fertilizer is Internalizer {

    event ClaimFertilizer(uint256[] ids, uint256 beans);

    using SafeERC20Upgradeable for IERC20;
    using SafeMathUpgradeable for uint256;
    using LibSafeMath128 for uint128;

    function beanstalkUpdate(
        address account,
        uint256[] memory ids,
        uint128 bpf
    ) external onlyOwner returns (uint256) {
        return __update(account, ids, uint256(bpf));
    }

    function beanstalkMint(address account, uint256 id, uint128 amount, uint128 bpf) external onlyOwner {
        if (_balances[id][account].amount > 0) {
            uint256[] memory ids = new uint256[](1);
            ids[0] = id;
            _update(account, ids, bpf);
        }
        _balances[id][account].lastBpf = bpf;
        _safeMint(
            account,
            id,
            amount,
            bytes('0')
        );
    }

    function _beforeTokenTransfer(
        address, // operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory, // amounts
        bytes memory // data
    ) internal virtual override {
        uint256 bpf = uint256(IBS(owner()).beansPerFertilizer());
        if (from != address(0)) _update(from, ids, bpf);
        _update(to, ids, bpf);
    }

    function _update(
        address account,
        uint256[] memory ids,
        uint256 bpf
    ) internal {
        uint256 amount = __update(account, ids, bpf);
        if (amount > 0) IBS(owner()).payFertilizer(account, amount);
    }

    function __update(
        address account,
        uint256[] memory ids,
        uint256 bpf
    ) internal returns (uint256 beans) {
        for (uint256 i; i < ids.length; ++i) {
            uint256 stopBpf = bpf < ids[i] ? bpf : ids[i];
            uint256 deltaBpf = stopBpf - _balances[ids[i]][account].lastBpf;
            if (deltaBpf > 0) {
                beans = beans.add(deltaBpf.mul(_balances[ids[i]][account].amount));
                _balances[ids[i]][account].lastBpf = uint128(stopBpf);
            }
        }
        emit ClaimFertilizer(ids, beans);
    }

    function balanceOfFertilized(address account, uint256[] memory ids) external view returns (uint256 beans) {
        uint256 bpf = uint256(IBS(owner()).beansPerFertilizer());
        for (uint256 i; i < ids.length; ++i) {
            uint256 stopBpf = bpf < ids[i] ? bpf : ids[i];
            uint256 deltaBpf = stopBpf - _balances[ids[i]][account].lastBpf;
            beans = beans.add(deltaBpf.mul(_balances[ids[i]][account].amount));
        }
    }

    function balanceOfUnfertilized(address account, uint256[] memory ids) external view returns (uint256 beans) {
        uint256 bpf = uint256(IBS(owner()).beansPerFertilizer());
        for (uint256 i; i < ids.length; ++i) {
            if (ids[i] > bpf) beans = beans.add(ids[i].sub(bpf).mul(_balances[ids[i]][account].amount));
        }
    }

    function remaining() public view returns (uint256) {
        return IBS(owner()).remainingRecapitalization();
    }

    function getMintId() public view returns (uint256) {
        return uint256(IBS(owner()).getEndBpf());
    }
}