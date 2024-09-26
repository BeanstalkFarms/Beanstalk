// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "./Internalizer.sol";
import {LibRedundantMath128} from "contracts/libraries/LibRedundantMath128.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {IBeanstalk} from "./Internalizer.sol";

/**
 * @author publius
 * @title Barn Raiser
 */

// Inherits Internalizer thus inherits ERC1155Upgradeable and the uri function
// The end Fert Facet only gets the interface of this contract
contract Fertilizer is Internalizer {
    event ClaimFertilizer(uint256[] ids, uint256 beans);

    using LibRedundantMath256 for uint256;
    using LibRedundantMath128 for uint128;

    /**
     * @notice Initializes the contract.
     * @dev In a future update, the metadata will be fully on chain,
     * and thus the uri will not need to be updated.
     */
    function init() external initializer {
        __Internallize_init("");
    }

    /**
     * @notice Calculates and updates the amount of beans a user should receive
     * given a set of fertilizer ids. Callable only by the Beanstalk contract.
     * @param account - the user to update
     * @param ids - an array of fertilizer ids
     * @param bpf - the current beans per fertilizer
     */
    function beanstalkUpdate(
        address account,
        uint256[] memory ids,
        uint128 bpf
    ) external onlyOwner returns (uint256) {
        return __update(account, ids, uint256(bpf));
    }

    /**
     * @notice Mints a fertilizer to an account using a users specified balance
     * Called from FertilizerFacet.mintFertilizer()
     * @param account - the account to mint to
     * @param id - the id of the fertilizer to mint
     * @param amount - the amount of fertilizer to mint
     * @param bpf - the current beans per fertilizer
     */
    function beanstalkMint(
        address account,
        uint256 id,
        uint128 amount,
        uint128 bpf
    ) external onlyOwner {
        if (_balances[id][account].amount > 0) {
            uint256[] memory ids = new uint256[](1);
            ids[0] = id;
            _update(account, ids, bpf);
        }
        _balances[id][account].lastBpf = bpf;
        _safeMint(account, id, amount, bytes("0"));
    }

    /**
     * @notice hadles state updates before a fertilizer transfer
     * @param from - the account to transfer from
     * @param to - the account to transfer to
     * @param ids - an array of fertilizer ids
     */
    function _beforeTokenTransfer(
        address, // operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory, // amounts
        bytes memory // data
    ) internal virtual override {
        uint256 bpf = uint256(IBeanstalk(owner()).beansPerFertilizer());
        if (from != address(0)) _update(from, ids, bpf);
        _update(to, ids, bpf);
    }

    /**
     * @notice Calculates and transfers the rewarded beans
     * from a set of fertilizer ids to an account's internal balance
     * @param account - the user to update
     * @param ids - an array of fertilizer ids
     * @param bpf - the beans per fertilizer
     */
    function _update(address account, uint256[] memory ids, uint256 bpf) internal {
        uint256 amount = __update(account, ids, bpf);
        if (amount > 0) IBeanstalk(owner()).payFertilizer(account, amount);
    }

    /**
     * @notice Calculates and updates the amount of beans a user should receive
     * given a set of fertilizer ids and the current outstanding total beans per fertilizer
     * @param account - the user to update
     * @param ids - the fertilizer ids
     * @param bpf - the current beans per fertilizer
     * @return beans - the amount of beans to reward the fertilizer owner
     */
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

    /**
     * @notice Returns the balance of fertilized beans of a fertilizer owner given
      a set of fertilizer ids
     * @param account - the fertilizer owner
     * @param ids - the fertilizer ids 
     * @return beans - the amount of fertilized beans the fertilizer owner has
     */
    function balanceOfFertilized(
        address account,
        uint256[] memory ids
    ) external view returns (uint256 beans) {
        uint256 bpf = uint256(IBeanstalk(owner()).beansPerFertilizer());
        for (uint256 i; i < ids.length; ++i) {
            uint256 stopBpf = bpf < ids[i] ? bpf : ids[i];
            uint256 deltaBpf = stopBpf - _balances[ids[i]][account].lastBpf;
            beans = beans.add(deltaBpf.mul(_balances[ids[i]][account].amount));
        }
    }

    /**
     * @notice Returns the balance of unfertilized beans of a fertilizer owner given
      a set of fertilizer ids
     * @param account - the fertilizer owner
     * @param ids - the fertilizer ids 
     * @return beans - the amount of unfertilized beans the fertilizer owner has
     */
    function balanceOfUnfertilized(
        address account,
        uint256[] memory ids
    ) external view returns (uint256 beans) {
        uint256 bpf = uint256(IBeanstalk(owner()).beansPerFertilizer());
        for (uint256 i; i < ids.length; ++i) {
            if (ids[i] > bpf)
                beans = beans.add(ids[i].sub(bpf).mul(_balances[ids[i]][account].amount));
        }
    }

    /**
     @notice Returns the value remaining to recapitalize beanstalk
     */
    function remaining() public view returns (uint256) {
        return IBeanstalk(owner()).remainingRecapitalization();
    }

    /**
     @notice Returns the id a fertilizer will receive when minted
    */
    function getMintId() public view returns (uint256) {
        return uint256(IBeanstalk(owner()).getEndBpf());
    }
}
