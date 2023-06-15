// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
import "../AppStorage.sol";
import {LibTokenSilo} from "~/libraries/Silo/LibTokenSilo.sol";
import {LibBytes} from "~/libraries/LibBytes.sol";
import {LibBytes64} from "~/libraries/LibBytes64.sol";
import {IBean} from "~/interfaces/IBean.sol";
import {LibStrings} from "~/libraries/LibStrings.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";


/**
 * @title MetadataImage
 * @author Brean
 * @notice Contains image metadata for ERC1155 deposits.
 * @dev fully on-chain generated SVG.
 */

contract MetadataImage {
    AppStorage internal s;

    using LibStrings for uint256;

    string constant LEAF_COLOR_0 = '#A8C83A';
    string constant LEAF_COLOR_1 = '#89A62F';

    function imageURI(uint256 depositId) public view returns (string memory){
        return string(abi.encodePacked("data:image/svg+xml;base64,",LibBytes64.encode(bytes(generateImage(depositId)))));
    }

    function generateImage(uint256 depositId) internal view returns (string memory) {
        (address token, int96 stem) = LibBytes.unpackAddressAndStem(depositId);
        int96 stemTip = LibTokenSilo.stemTipForToken(token);
        return string(
            abi.encodePacked(
                '<svg class="svgBody" width="255" height="350" viewBox="0 0 255 350" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">',
                defs(),
                back(),
                printPlots(stemTip),
                blackBars(token),
                '</svg>'
            )
        );
    }
    function back() internal view returns(string memory){
        return string(abi.encodePacked(
            '<rect width="255" height="350" rx="10" fill="',
            '#253326',
            '"/>'
        ));
    }
    function defs() internal view returns(string memory){
        return string(abi.encodePacked(
            '<defs>',
            plot(),
            fullLeafPlot(),
            emptyPlot(),
            partialLeafPlot(),
            bar(),
            leaf(),
            silo(),
            beanToken(),
            // mask(),
            leafRow(),
            '</defs>'
        ));
    }

    function mask() internal pure returns (string memory) {
        return string(abi.encodePacked(
            '<clipPath id="borderMask">',
            border(),
            '</clipPath>'
        ));
    }

    function border() internal pure returns (string memory) {
        return '<rect x="8" y="8" width="240" height="335" rx="6" stroke="#9BCAA0" stroke-width="2" fill="none"/>';
    }

    function leafRow() internal pure returns (string memory){
        return string(abi.encodePacked(
            '<g id="leafRow">',
            '<use xlink:href="#leaf" x="0" y="0"/>',
            '<use xlink:href="#leaf" x="-12" y="-7"/>',
            '<use xlink:href="#leaf" x="-24" y="-14"/>',
            '<use xlink:href="#leaf" x="-36" y="-21"/>',
            '</g>'
        ));
    }

    function fullLeafPlot() internal view returns (string memory) {
        return string(abi.encodePacked(
            '<g id="fullLeafPlot">',
            useAssetTransform('plot',-35,0),
            useAssetTransformFill('leafRow',-35,0, LEAF_COLOR_0),
            useAssetTransformFill('leafRow',-47,7, LEAF_COLOR_1),
            useAssetTransformFill('leafRow',-60,14, LEAF_COLOR_0),
            useAssetTransformFill('leafRow',-73,21, LEAF_COLOR_1),
            '</g>'
        ));
    }

    function emptyPlot() internal pure returns (string memory) {
        return string(abi.encodePacked(
            '<g id="emptyPlot">',
            useAssetTransform('plot',-35,0),
            '</g>'
        ));
    }

    function partialLeafPlot() internal view returns (string memory) {
        return string(abi.encodePacked(
            '<g id="partialLeafPlot">',
            useAssetTransform('plot',-35,0),
            useAssetTransformFill('leafRow',-35,0, LEAF_COLOR_0),
            useAssetTransformFill('leafRow',-47,7, LEAF_COLOR_1),
            '</g>'
        ));
    }

    function printPlots(int96 stalkPerBDV) internal view returns (string memory) {
        return string(abi.encodePacked(
            '<use xlink:href="#silo" x="99" y="55"/>',
            '<g id="allPlot" clip-path="url(#borderMask)">',
                plotLogic(stalkPerBDV),
            '</g>'
        ));
    }

    function plotLogic(int96 stalkPerBDV) internal pure returns (string memory) {

        int256[2][21] memory XYPLOT = [

        [int256(-69),-164], // 20
        [int256(69),-164], // 19

        [int256(0),-124], // 13
        [int256(138),-124], // 18
        [int256(-138),-124], // 21

        [int256(-69),-84], // 14
        [int256(69),-84], // 12

        [int256(-138),-44], // 15
        [int256(0),-44], // 5
        [int256(138),-44], // 11

        [int256(-69),-4], // 6
        [int256(69),-4], // 4

        [int256(-138),36], // 7
        [int256(138),36], // 3

        [int256(-69),76], // 8 
        [int256(69),76], // 2

        [int256(-138),116], // 16
        [int256(0),116], // 1
        [int256(138),116], // 10
            
        [int256(69),156], // 9
        [int256(-69),156] // 17
        
        ];
        // 20 plots are generated: 
        // 1 plot is filled 100% at start. 
        // for every 2% absolute growth in stalk (0.02 stalk per BDV), one sprout is planted.
        // this means every plot is a growth of 32% (linearly).
        // there are 3 sets of plots, with varying amount of sprouts:
        uint256[21] memory order = [uint256(20),19,13,18,21,14,12,15,5,11,6,4,7,3,8,2,16,1,10,9,17];

        bytes memory _plot;
        uint256 numPlots = 21;
    
        uint256 numPlotsToFill = uint256(stalkPerBDV);
        
        for(uint256 i = 0; i < numPlots; ++i) {
            uint256 plotNo = order[i];
            if(plotNo < numPlotsToFill){
                _plot = abi.encodePacked(
                    _plot,
                    useAsset(
                        'fullLeafPlot',
                        XYPLOT[i][0],
                        XYPLOT[i][1]
                    )
                );
            } else if(plotNo == numPlotsToFill) {
                _plot = abi.encodePacked(
                    _plot,
                    useAsset(
                        'partialLeafPlot',
                        XYPLOT[i][0],
                        XYPLOT[i][1]
                    )
                );
            } else {
                _plot = abi.encodePacked(
                    _plot,
                    useAsset(
                        'emptyPlot',
                        XYPLOT[i][0],
                        XYPLOT[i][1]
                    )
                );
            }
            if(i == 11){
                _plot= abi.encodePacked(
                    _plot,
                    '<use xlink:href="#silo" x="47" y="55" transform="scale(1.7)"/>'
                );
            }
        }
        return string(_plot);
    }

    function useAsset(string memory assetName, int256 x, int256 y) internal pure returns (string memory) { 
        return string(abi.encodePacked(
            '<use xlink:href="#',
            assetName,
            '" x="',
            helperFunction1(x),
            '" y="',
            helperFunction1(y),
            '" />'
        ));
    }

    function useAssetFill(string memory assetName, int256 x, int256 y, string memory color) internal pure returns (string memory) { 
        return string(abi.encodePacked(
            '<use xlink:href="#',
            assetName,
            '" x="',
            helperFunction1(x),
            '" y="',
            helperFunction1(y),
            '" fill="',
            color,
            '" />'
        ));
    }

    function plot() internal pure returns (string memory) {
        return string(
            abi.encodePacked(
                '<g id="plot">',
                '<path d="M79.5728 129.265L127.469 156.833L175.443 129.245L127.469 101.697L79.5728 129.265Z" fill="#944A27"/>',
                '<path d="M79.5332 133.426L79.5727 129.265L127.469 156.833L127.507 160.908L79.5332 133.426Z" fill="#75391F"/>',
                '<path d="M175.467 133.4L175.443 129.245L127.469 156.833L127.507 160.908L175.467 133.4Z" fill="#67331E"/>',
                "</g>"
            )
        );
    }

    function bar() internal pure returns (string memory) {
        return string(
            abi.encodePacked(
                '<g id="bar">',
                '<rect x="39" y="248" width="177" height="17" rx="5" fill="#8B938C" fill-opacity="0.1"/>',
                '</g>'
            )
        );
    }

    function leaf() internal pure returns (string memory) { 
        return string(
            abi.encodePacked(
                '<g id="leaf">',
                '<path d="M171.884 118.983a4.932 4.932 0 0 1-1.018 2.606 4.715 4.715 0 0 1-1.878 1.439c-.465.195-1.735.727-2.364.176-.246 3.298-1.593 6.512-2.253 7.954a4.532 4.532 0 0 1-.313-.933c-.211-.975-.038-1.763.078-2.295.202-.921.353-1.612.467-2.14-1.177.694-2.642.569-3.558-.272-.796-.732-1.083-1.921-.743-3.034.498.011 1.939.109 3.247 1.167a5.13 5.13 0 0 1 1.21 1.413c.159-.74.199-.958.238-1.179.209-1.213.322-1.872.274-2.724a7.73 7.73 0 0 0-.908-3.177c-.772.415-1.789.196-2.378-.304-.339-.287-.556-.682-.764-1.692a12.739 12.739 0 0 1-.176-3.909c.789.603 1.47 1.019 1.937 1.283.944.536 1.344.639 1.761 1.167.152.193.649.842.586 1.751-.011.172-.053.795-.464 1.293a6.83 6.83 0 0 1 1.384 2.227c.14.368.242.744.311 1.15.107-.207.261-.439.511-.722.453-.513.87-.992 1.604-1.284.683-.272 1.28-.249 1.723-.234a5.302 5.302 0 0 1 1.486.273Z"/>',
                '</g>'
            )
        );
    }

    function silo() internal pure returns (string memory) {
        return string(
            abi.encodePacked(
                '<g id="silo">',
                '<path d="M57.108 71.29c.188-11.653-12.01-21.303-27.243-21.552-15.234-.25-27.736 8.995-27.923 20.649-.187 11.654 12.01 21.304 27.244 21.553 15.233.25 27.735-8.995 27.922-20.65Z" fill="#666"/>',
                '<path d="M.464 19.544c.699 16.585 1.4 33.169 2.098 49.752.021 2.381.48 4.278.883 5.539.277.86.741 2.275 1.778 3.867.494.759 1.212 1.7 3.002 3.332 1.739 1.586 3.35 3.056 5.732 4.398 3.293 1.855 6.151 2.396 8.791 2.896 1.855.35 5.149.948 9.488.556a32.707 32.707 0 0 0 9.315-2.287c1.862-.759 4.642-1.917 7.633-4.4 1.348-1.12 3.448-2.897 5.197-5.95a20.114 20.114 0 0 0 2.25-5.998c.21-17.552.42-35.104.632-52.657l-56.8.952h.001Z" fill="#B3B3B3"/>',
                '<path d="M57.48 19.482C57.645 9.24 44.978.727 29.187.468 13.397.21.463 8.303.298 18.546.134 28.788 12.8 37.3 28.591 37.56c15.79.258 28.724-7.835 28.889-18.078Z" fill="#CCC"/>',
                '<path d="M30.314 7.137c.009-.561-.68-1.028-1.538-1.042-.859-.014-1.562.43-1.571.991-.01.562.68 1.028 1.538 1.042.859.015 1.562-.43 1.57-.99Z" fill="#666"/>',
                '<path d="M6.414 28.89a15.777 15.777 0 0 1-2.093-2.146c-.856-1.063-2.453-3.093-2.975-6.112a11.765 11.765 0 0 1-.093-3.307l25.43-9.976c.043.142.188.555.604.868.46.346.947.34 1.086.334L6.413 28.888v.002Z" fill="#E6E6E6"/>',
                '<path opacity=".33" d="M1.477 16.029c.25-.931.706-2.258 1.57-3.695.655-1.092 1.292-1.825 1.76-2.358.584-.665 1.776-1.934 3.679-3.29 2.953-2.105 5.696-3.05 7.723-3.73a37.35 37.35 0 0 1 6.485-1.547l5.242 4.316a1.48 1.48 0 0 0-1.214.967L1.48 16.03h-.002Z" fill="#999"/>',
                '<path opacity=".44" d="M1.81 26.532c.206.494.484 1.05.86 1.63a10.266 10.266 0 0 0 2.278 2.486L6.552 78.22a17.272 17.272 0 0 1-3-7.413L1.81 26.532Z" fill="#E6E6E6"/>',
                '<path d="m33.092 49.441-6.381 15.211s-6.078-11.159 6.381-15.21Z" fill="#8E8E8E"/>',
                '<path d="m26.725 64.858-.091-.175c-.026-.049-2.634-4.923-.867-9.37 1.057-2.717 3.518-4.725 7.3-5.946l.187-.061-6.53 15.552Zm6.212-15.268c-3.621 1.217-5.991 3.168-7.022 5.798-1.538 3.908.355 8.166.788 9.054l6.234-14.852ZM28.093 63.737l4.484-10.87s7.365 6.337-4.484 10.87Z" fill="#8E8E8E"/>'
                "</g>"
            )
        );
    }

    function viewGrownStalk(uint256 bdv, address token) internal view returns (string memory) {
        uint256 grownStalk = bdv * uint256(LibTokenSilo.stemTipForToken(token)) / 1e10;
        return string(
            abi.encodePacked(
                '<text x="205" y="261" font-size="14" fill="#33B074" font-family="Futura PT, sans-serif" text-anchor="end">',
                '+ ',
                grownStalk.toString(),
                '</text>'
            )
        );
    }

    function viewStalk(uint256 bdv, address token) internal view returns (string memory) {
        uint256 stalk = bdv * LibTokenSilo.stalkIssuedPerBdv(token) / 1e10;
        return string(
            abi.encodePacked(
                '<text x="205" y="283" font-size="14" fill="#A8C83A" font-family="Futura PT, sans-serif" text-anchor="end">',
                stalk.toString(),
                '</text>'
            )
        );
    }

    function viewSeeds(uint256 bdv, address token) internal view returns (string memory) {
        uint256 seeds = bdv * LibTokenSilo.stalkEarnedPerSeason(token) / 1e12;
        return string(
            abi.encodePacked(
                '<text x="205" y="305" font-size="14" fill="white" font-family="Futura PT, sans-serif" text-anchor="end">',
                seeds.toString(),
                '</text>'
            )
        );
    }

    function viewBDV(uint256 _bdv) internal pure returns (string memory) {
        return string(
            abi.encodePacked(
                '<text x="128" y="68" font-size="25" fill="White" text-anchor="middle" font-family="Futura PT, sans-serif">',
                (_bdv/1e6).toString(),
                '</text>'
            )
        );
    }

    function beanToken() internal pure returns (string memory){
        return string(abi.encodePacked(
            '<g id="bean">',
            '<rect width="12" height="12" rx="6" fill="#46B955"/><path d="m7.687 1.265-3.504 9.36S.298 3.999 7.687 1.266Zm-2.691 8.78 2.462-6.691s4.538 3.67-2.462 6.691Z" fill="#fff"/>',
            '</g>'
            )
        );
    }

    function bean3CRVToken() internal pure returns (string memory){
        return string(abi.encodePacked(
            '<g id="bean3CRV">',
            '<rect width="12" height="12" rx="6" fill="#46B955"/><path d="m7.687 1.265-3.504 9.36S.298 3.999 7.687 1.266Zm-2.691 8.78 2.462-6.691s4.538 3.67-2.462 6.691Z" fill="#fff"/>',
            '</g>'
            )
        );
    }

    function urBeanToken() internal pure returns (string memory){
        return string(abi.encodePacked(
            '<g id="urBean">',
            '<rect width="12" height="12" rx="6" fill="#46B955"/><path d="m7.687 1.265-3.504 9.36S.298 3.999 7.687 1.266Zm-2.691 8.78 2.462-6.691s4.538 3.67-2.462 6.691Z" fill="#fff"/>',
            '</g>'
            )
        );
    }

    function urBean3CRVToken() internal pure returns (string memory){
        return string(abi.encodePacked(
            '<g id="urBean3CRV">',
            '<rect width="12" height="12" rx="6" fill="#46B955"/><path d="m7.687 1.265-3.504 9.36S.298 3.999 7.687 1.266Zm-2.691 8.78 2.462-6.691s4.538 3.67-2.462 6.691Z" fill="#fff"/>',
            '</g>'
            )
        );
    }

    function urBeanETHToken() internal pure returns (string memory){
        return string(abi.encodePacked(
            '<g id="urBeanETH">',
            '<rect width="12" height="12" rx="6" fill="#46B955"/><path d="m7.687 1.265-3.504 9.36S.298 3.999 7.687 1.266Zm-2.691 8.78 2.462-6.691s4.538 3.67-2.462 6.691Z" fill="#fff"/>',
            '</g>'
            )
        );
    }

    function beanETHToken() internal pure returns (string memory){
        return string(
            abi.encodePacked(
            '<g id="beanETH">',
            '<rect width="12" height="12" rx="6" fill="#46B955"/><path d="m7.687 1.265-3.504 9.36S.298 3.999 7.687 1.266Zm-2.691 8.78 2.462-6.691s4.538 3.67-2.462 6.691Z" fill="#fff"/>',
            '</g>'
            )
        );
    }

    function useAssetTransform(string memory assetName, int256 x, int256 y) internal pure returns (string memory) { 
        return string(abi.encodePacked(
            '<use xlink:href="#',
            assetName,
            '" x="',
            helperFunction1(x),
            '" y="',
            helperFunction1(y),
            '" transform="scale(1.4)"/>'
        ));
    }

    function useAssetTransformFill(string memory assetName, int256 x, int256 y, string memory color) internal pure returns (string memory) { 
        return string(abi.encodePacked(
            '<use xlink:href="#',
            assetName,
            '" x="',
            helperFunction1(x),
            '" y="',
            helperFunction1(y),
            '" fill="',
            color,
            '" transform="scale(1.4)"/>'
        ));
    }

    function blackBars(address token) internal view returns(string memory) {
        return string(
            abi.encodePacked(
                '<rect x="0" y="0" width="255" height="20" rx="5" fill="Black"/>',
                tokenName(token),
                useAsset('bean', 76, 4),
                '<rect x="0" y="330" width="255" height="20" rx="5" fill="Black"/>',
                movingTokenAddress(token)
            )
        );
    }

    function tokenName(address token) internal view returns (string memory) {
        return string(
            abi.encodePacked(
                '<text x="127" y="15" font-size="12" fill="White" text-anchor="middle" font-family="Futura PT, sans-serif">',
                string(ERC20(token).name()),
                ' Deposit',
                '</text>'
            )
        );
    }

    function movingTokenAddress(address token) internal view returns (string memory) {
        return string(
            abi.encodePacked(
                '<text x="127" y="343" font-size="10" fill="White" text-anchor="middle" font-family="Futura PT, sans-serif">',
                '<tspan><animate attributeName="x" from="375" to="50" dur="10s" repeatCount="indefinite" />',
                LibStrings.toHexString(token),
                '</tspan>',
                '</text>'
                '<text x="127" y="343" font-size="10" fill="White" text-anchor="middle" font-family="Futura PT, sans-serif">',
                '<tspan><animate attributeName="x" from="50" to="-275" dur="10s" repeatCount="indefinite" />',
                LibStrings.toHexString(token),
                '</tspan>',
                '</text>'
            )
        );
    }

    function helperFunction1(int256 x) internal pure returns (string memory) {
        if(x < 0){
            return string(abi.encodePacked(
                '-',
                uint256(-x).toString()
            ));
        } else {
            return uint256(x).toString();
        }        
    }
}