// /*
//  SPDX-License-Identifier: MIT
// */

import "../AppStorage.sol";

pragma experimental ABIEncoderV2;
pragma solidity =0.7.6;

contract StateFacet {
    struct Deposit {
        address token;
        uint32 season;
        uint256 amount;
        uint256 bdv;
    }

    AppStorage internal s;

    function getDeposits(address account, address token, uint32 start, uint32 length)
        external
        view
        returns (Deposit[] memory deposits)
    {
        // deposits = new uint256();
        uint numberOfDeposits = 0;
        for (uint32 i = start; i < length; ++i) {
            if (s.a[account].deposits[token][i].amount > 0) numberOfDeposits++;
        }
        deposits = new Deposit[](numberOfDeposits);

        uint256 j = 0;

        for (uint32 i = start; i < length; ++i) {
            if (s.a[account].deposits[token][i].amount > 0) {
                Deposit memory dep;
                dep.token = token;
                dep.season = start;
                dep.amount = s.a[account].deposits[token][i].amount;
                dep.bdv = s.a[account].deposits[token][i].bdv;
                deposits[j] = dep;
                j++;
            }
        }
        return deposits;

    }
}
