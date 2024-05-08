// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;
interface IProxyAdmin {
    function upgrade(address proxy, address implementation) external;
}
