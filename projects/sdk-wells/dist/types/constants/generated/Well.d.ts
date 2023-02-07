import type { BaseContract, BigNumber, BigNumberish, BytesLike, CallOverrides, ContractTransaction, Overrides, PopulatedTransaction, Signer, utils } from "ethers";
import type { FunctionFragment, Result, EventFragment } from "@ethersproject/abi";
import type { Listener, Provider } from "@ethersproject/providers";
import type { TypedEventFilter, TypedEvent, TypedListener, OnEvent, PromiseOrValue } from "./common";
export declare type CallStruct = {
    target: PromiseOrValue<string>;
    data: PromiseOrValue<BytesLike>;
};
export declare type CallStructOutput = [string, string] & {
    target: string;
    data: string;
};
export interface WellInterface extends utils.Interface {
    functions: {
        "DOMAIN_SEPARATOR()": FunctionFragment;
        "addLiquidity(uint256[],uint256,address)": FunctionFragment;
        "allowance(address,address)": FunctionFragment;
        "approve(address,uint256)": FunctionFragment;
        "auger()": FunctionFragment;
        "balanceOf(address)": FunctionFragment;
        "decimals()": FunctionFragment;
        "decreaseAllowance(address,uint256)": FunctionFragment;
        "firstPumpBytes()": FunctionFragment;
        "firstPumpTarget()": FunctionFragment;
        "getAddLiquidityOut(uint256[])": FunctionFragment;
        "getRemoveLiquidityImbalancedIn(uint256[])": FunctionFragment;
        "getRemoveLiquidityOneTokenOut(uint256,address)": FunctionFragment;
        "getRemoveLiquidityOut(uint256)": FunctionFragment;
        "getReserves()": FunctionFragment;
        "getSwapIn(address,address,uint256)": FunctionFragment;
        "getSwapOut(address,address,uint256)": FunctionFragment;
        "increaseAllowance(address,uint256)": FunctionFragment;
        "name()": FunctionFragment;
        "nonces(address)": FunctionFragment;
        "numberOfPumps()": FunctionFragment;
        "numberOfTokens()": FunctionFragment;
        "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)": FunctionFragment;
        "pumps()": FunctionFragment;
        "removeLiquidity(uint256,uint256[],address)": FunctionFragment;
        "removeLiquidityImbalanced(uint256,uint256[],address)": FunctionFragment;
        "removeLiquidityOneToken(uint256,address,uint256,address)": FunctionFragment;
        "skim(address)": FunctionFragment;
        "swapFrom(address,address,uint256,uint256,address)": FunctionFragment;
        "swapTo(address,address,uint256,uint256,address)": FunctionFragment;
        "symbol()": FunctionFragment;
        "token(uint256)": FunctionFragment;
        "tokens()": FunctionFragment;
        "totalSupply()": FunctionFragment;
        "transfer(address,uint256)": FunctionFragment;
        "transferFrom(address,address,uint256)": FunctionFragment;
        "well()": FunctionFragment;
        "wellFunction()": FunctionFragment;
        "wellFunctionAddress()": FunctionFragment;
        "wellFunctionBytes()": FunctionFragment;
    };
    getFunction(nameOrSignatureOrTopic: "DOMAIN_SEPARATOR" | "addLiquidity" | "allowance" | "approve" | "auger" | "balanceOf" | "decimals" | "decreaseAllowance" | "firstPumpBytes" | "firstPumpTarget" | "getAddLiquidityOut" | "getRemoveLiquidityImbalancedIn" | "getRemoveLiquidityOneTokenOut" | "getRemoveLiquidityOut" | "getReserves" | "getSwapIn" | "getSwapOut" | "increaseAllowance" | "name" | "nonces" | "numberOfPumps" | "numberOfTokens" | "permit" | "pumps" | "removeLiquidity" | "removeLiquidityImbalanced" | "removeLiquidityOneToken" | "skim" | "swapFrom" | "swapTo" | "symbol" | "token" | "tokens" | "totalSupply" | "transfer" | "transferFrom" | "well" | "wellFunction" | "wellFunctionAddress" | "wellFunctionBytes"): FunctionFragment;
    encodeFunctionData(functionFragment: "DOMAIN_SEPARATOR", values?: undefined): string;
    encodeFunctionData(functionFragment: "addLiquidity", values: [
        PromiseOrValue<BigNumberish>[],
        PromiseOrValue<BigNumberish>,
        PromiseOrValue<string>
    ]): string;
    encodeFunctionData(functionFragment: "allowance", values: [PromiseOrValue<string>, PromiseOrValue<string>]): string;
    encodeFunctionData(functionFragment: "approve", values: [PromiseOrValue<string>, PromiseOrValue<BigNumberish>]): string;
    encodeFunctionData(functionFragment: "auger", values?: undefined): string;
    encodeFunctionData(functionFragment: "balanceOf", values: [PromiseOrValue<string>]): string;
    encodeFunctionData(functionFragment: "decimals", values?: undefined): string;
    encodeFunctionData(functionFragment: "decreaseAllowance", values: [PromiseOrValue<string>, PromiseOrValue<BigNumberish>]): string;
    encodeFunctionData(functionFragment: "firstPumpBytes", values?: undefined): string;
    encodeFunctionData(functionFragment: "firstPumpTarget", values?: undefined): string;
    encodeFunctionData(functionFragment: "getAddLiquidityOut", values: [PromiseOrValue<BigNumberish>[]]): string;
    encodeFunctionData(functionFragment: "getRemoveLiquidityImbalancedIn", values: [PromiseOrValue<BigNumberish>[]]): string;
    encodeFunctionData(functionFragment: "getRemoveLiquidityOneTokenOut", values: [PromiseOrValue<BigNumberish>, PromiseOrValue<string>]): string;
    encodeFunctionData(functionFragment: "getRemoveLiquidityOut", values: [PromiseOrValue<BigNumberish>]): string;
    encodeFunctionData(functionFragment: "getReserves", values?: undefined): string;
    encodeFunctionData(functionFragment: "getSwapIn", values: [
        PromiseOrValue<string>,
        PromiseOrValue<string>,
        PromiseOrValue<BigNumberish>
    ]): string;
    encodeFunctionData(functionFragment: "getSwapOut", values: [
        PromiseOrValue<string>,
        PromiseOrValue<string>,
        PromiseOrValue<BigNumberish>
    ]): string;
    encodeFunctionData(functionFragment: "increaseAllowance", values: [PromiseOrValue<string>, PromiseOrValue<BigNumberish>]): string;
    encodeFunctionData(functionFragment: "name", values?: undefined): string;
    encodeFunctionData(functionFragment: "nonces", values: [PromiseOrValue<string>]): string;
    encodeFunctionData(functionFragment: "numberOfPumps", values?: undefined): string;
    encodeFunctionData(functionFragment: "numberOfTokens", values?: undefined): string;
    encodeFunctionData(functionFragment: "permit", values: [
        PromiseOrValue<string>,
        PromiseOrValue<string>,
        PromiseOrValue<BigNumberish>,
        PromiseOrValue<BigNumberish>,
        PromiseOrValue<BigNumberish>,
        PromiseOrValue<BytesLike>,
        PromiseOrValue<BytesLike>
    ]): string;
    encodeFunctionData(functionFragment: "pumps", values?: undefined): string;
    encodeFunctionData(functionFragment: "removeLiquidity", values: [
        PromiseOrValue<BigNumberish>,
        PromiseOrValue<BigNumberish>[],
        PromiseOrValue<string>
    ]): string;
    encodeFunctionData(functionFragment: "removeLiquidityImbalanced", values: [
        PromiseOrValue<BigNumberish>,
        PromiseOrValue<BigNumberish>[],
        PromiseOrValue<string>
    ]): string;
    encodeFunctionData(functionFragment: "removeLiquidityOneToken", values: [
        PromiseOrValue<BigNumberish>,
        PromiseOrValue<string>,
        PromiseOrValue<BigNumberish>,
        PromiseOrValue<string>
    ]): string;
    encodeFunctionData(functionFragment: "skim", values: [PromiseOrValue<string>]): string;
    encodeFunctionData(functionFragment: "swapFrom", values: [
        PromiseOrValue<string>,
        PromiseOrValue<string>,
        PromiseOrValue<BigNumberish>,
        PromiseOrValue<BigNumberish>,
        PromiseOrValue<string>
    ]): string;
    encodeFunctionData(functionFragment: "swapTo", values: [
        PromiseOrValue<string>,
        PromiseOrValue<string>,
        PromiseOrValue<BigNumberish>,
        PromiseOrValue<BigNumberish>,
        PromiseOrValue<string>
    ]): string;
    encodeFunctionData(functionFragment: "symbol", values?: undefined): string;
    encodeFunctionData(functionFragment: "token", values: [PromiseOrValue<BigNumberish>]): string;
    encodeFunctionData(functionFragment: "tokens", values?: undefined): string;
    encodeFunctionData(functionFragment: "totalSupply", values?: undefined): string;
    encodeFunctionData(functionFragment: "transfer", values: [PromiseOrValue<string>, PromiseOrValue<BigNumberish>]): string;
    encodeFunctionData(functionFragment: "transferFrom", values: [
        PromiseOrValue<string>,
        PromiseOrValue<string>,
        PromiseOrValue<BigNumberish>
    ]): string;
    encodeFunctionData(functionFragment: "well", values?: undefined): string;
    encodeFunctionData(functionFragment: "wellFunction", values?: undefined): string;
    encodeFunctionData(functionFragment: "wellFunctionAddress", values?: undefined): string;
    encodeFunctionData(functionFragment: "wellFunctionBytes", values?: undefined): string;
    decodeFunctionResult(functionFragment: "DOMAIN_SEPARATOR", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "addLiquidity", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "allowance", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "approve", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "auger", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "balanceOf", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "decimals", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "decreaseAllowance", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "firstPumpBytes", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "firstPumpTarget", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getAddLiquidityOut", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getRemoveLiquidityImbalancedIn", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getRemoveLiquidityOneTokenOut", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getRemoveLiquidityOut", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getReserves", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getSwapIn", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getSwapOut", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "increaseAllowance", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "name", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "nonces", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "numberOfPumps", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "numberOfTokens", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "permit", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "pumps", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "removeLiquidity", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "removeLiquidityImbalanced", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "removeLiquidityOneToken", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "skim", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "swapFrom", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "swapTo", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "symbol", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "token", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "tokens", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "totalSupply", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "transfer", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "transferFrom", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "well", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "wellFunction", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "wellFunctionAddress", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "wellFunctionBytes", data: BytesLike): Result;
    events: {
        "AddLiquidity(uint256[],uint256)": EventFragment;
        "Approval(address,address,uint256)": EventFragment;
        "RemoveLiquidity(uint256,uint256[])": EventFragment;
        "RemoveLiquidityOneToken(uint256,address,uint256)": EventFragment;
        "Swap(address,address,uint256,uint256)": EventFragment;
        "Transfer(address,address,uint256)": EventFragment;
    };
    getEvent(nameOrSignatureOrTopic: "AddLiquidity"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "Approval"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "RemoveLiquidity"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "RemoveLiquidityOneToken"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "Swap"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "Transfer"): EventFragment;
}
export interface AddLiquidityEventObject {
    tokenAmountsIn: BigNumber[];
    lpAmountOut: BigNumber;
}
export declare type AddLiquidityEvent = TypedEvent<[
    BigNumber[],
    BigNumber
], AddLiquidityEventObject>;
export declare type AddLiquidityEventFilter = TypedEventFilter<AddLiquidityEvent>;
export interface ApprovalEventObject {
    owner: string;
    spender: string;
    value: BigNumber;
}
export declare type ApprovalEvent = TypedEvent<[
    string,
    string,
    BigNumber
], ApprovalEventObject>;
export declare type ApprovalEventFilter = TypedEventFilter<ApprovalEvent>;
export interface RemoveLiquidityEventObject {
    lpAmountIn: BigNumber;
    tokenAmountsOut: BigNumber[];
}
export declare type RemoveLiquidityEvent = TypedEvent<[
    BigNumber,
    BigNumber[]
], RemoveLiquidityEventObject>;
export declare type RemoveLiquidityEventFilter = TypedEventFilter<RemoveLiquidityEvent>;
export interface RemoveLiquidityOneTokenEventObject {
    lpAmountIn: BigNumber;
    tokenOut: string;
    tokenAmountOut: BigNumber;
}
export declare type RemoveLiquidityOneTokenEvent = TypedEvent<[
    BigNumber,
    string,
    BigNumber
], RemoveLiquidityOneTokenEventObject>;
export declare type RemoveLiquidityOneTokenEventFilter = TypedEventFilter<RemoveLiquidityOneTokenEvent>;
export interface SwapEventObject {
    fromToken: string;
    toToken: string;
    amountIn: BigNumber;
    amountOut: BigNumber;
}
export declare type SwapEvent = TypedEvent<[
    string,
    string,
    BigNumber,
    BigNumber
], SwapEventObject>;
export declare type SwapEventFilter = TypedEventFilter<SwapEvent>;
export interface TransferEventObject {
    from: string;
    to: string;
    value: BigNumber;
}
export declare type TransferEvent = TypedEvent<[
    string,
    string,
    BigNumber
], TransferEventObject>;
export declare type TransferEventFilter = TypedEventFilter<TransferEvent>;
export interface Well extends BaseContract {
    connect(signerOrProvider: Signer | Provider | string): this;
    attach(addressOrName: string): this;
    deployed(): Promise<this>;
    interface: WellInterface;
    queryFilter<TEvent extends TypedEvent>(event: TypedEventFilter<TEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TEvent>>;
    listeners<TEvent extends TypedEvent>(eventFilter?: TypedEventFilter<TEvent>): Array<TypedListener<TEvent>>;
    listeners(eventName?: string): Array<Listener>;
    removeAllListeners<TEvent extends TypedEvent>(eventFilter: TypedEventFilter<TEvent>): this;
    removeAllListeners(eventName?: string): this;
    off: OnEvent<this>;
    on: OnEvent<this>;
    once: OnEvent<this>;
    removeListener: OnEvent<this>;
    functions: {
        DOMAIN_SEPARATOR(overrides?: CallOverrides): Promise<[string]>;
        addLiquidity(tokenAmountsIn: PromiseOrValue<BigNumberish>[], minLpAmountOut: PromiseOrValue<BigNumberish>, recipient: PromiseOrValue<string>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<ContractTransaction>;
        allowance(owner: PromiseOrValue<string>, spender: PromiseOrValue<string>, overrides?: CallOverrides): Promise<[BigNumber]>;
        approve(spender: PromiseOrValue<string>, amount: PromiseOrValue<BigNumberish>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<ContractTransaction>;
        auger(overrides?: CallOverrides): Promise<[string]>;
        balanceOf(account: PromiseOrValue<string>, overrides?: CallOverrides): Promise<[BigNumber]>;
        decimals(overrides?: CallOverrides): Promise<[number]>;
        decreaseAllowance(spender: PromiseOrValue<string>, subtractedValue: PromiseOrValue<BigNumberish>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<ContractTransaction>;
        firstPumpBytes(overrides?: CallOverrides): Promise<[string] & {
            _bytes: string;
        }>;
        firstPumpTarget(overrides?: CallOverrides): Promise<[string] & {
            _target: string;
        }>;
        getAddLiquidityOut(tokenAmountsIn: PromiseOrValue<BigNumberish>[], overrides?: CallOverrides): Promise<[BigNumber] & {
            lpAmountOut: BigNumber;
        }>;
        getRemoveLiquidityImbalancedIn(tokenAmountsOut: PromiseOrValue<BigNumberish>[], overrides?: CallOverrides): Promise<[BigNumber] & {
            lpAmountIn: BigNumber;
        }>;
        getRemoveLiquidityOneTokenOut(lpAmountIn: PromiseOrValue<BigNumberish>, tokenOut: PromiseOrValue<string>, overrides?: CallOverrides): Promise<[BigNumber] & {
            tokenAmountOut: BigNumber;
        }>;
        getRemoveLiquidityOut(lpAmountIn: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<[BigNumber[]] & {
            tokenAmountsOut: BigNumber[];
        }>;
        getReserves(overrides?: CallOverrides): Promise<[BigNumber[]] & {
            reserves: BigNumber[];
        }>;
        getSwapIn(fromToken: PromiseOrValue<string>, toToken: PromiseOrValue<string>, amountOut: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<[BigNumber] & {
            amountIn: BigNumber;
        }>;
        getSwapOut(fromToken: PromiseOrValue<string>, toToken: PromiseOrValue<string>, amountIn: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<[BigNumber] & {
            amountOut: BigNumber;
        }>;
        increaseAllowance(spender: PromiseOrValue<string>, addedValue: PromiseOrValue<BigNumberish>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<ContractTransaction>;
        name(overrides?: CallOverrides): Promise<[string]>;
        nonces(owner: PromiseOrValue<string>, overrides?: CallOverrides): Promise<[BigNumber]>;
        numberOfPumps(overrides?: CallOverrides): Promise<[BigNumber] & {
            _numberOfPumps: BigNumber;
        }>;
        numberOfTokens(overrides?: CallOverrides): Promise<[BigNumber] & {
            __numberOfTokens: BigNumber;
        }>;
        permit(owner: PromiseOrValue<string>, spender: PromiseOrValue<string>, value: PromiseOrValue<BigNumberish>, deadline: PromiseOrValue<BigNumberish>, v: PromiseOrValue<BigNumberish>, r: PromiseOrValue<BytesLike>, s: PromiseOrValue<BytesLike>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<ContractTransaction>;
        pumps(overrides?: CallOverrides): Promise<[CallStructOutput[]]>;
        removeLiquidity(lpAmountIn: PromiseOrValue<BigNumberish>, minTokenAmountsOut: PromiseOrValue<BigNumberish>[], recipient: PromiseOrValue<string>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<ContractTransaction>;
        removeLiquidityImbalanced(maxLpAmountIn: PromiseOrValue<BigNumberish>, tokenAmountsOut: PromiseOrValue<BigNumberish>[], recipient: PromiseOrValue<string>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<ContractTransaction>;
        removeLiquidityOneToken(lpAmountIn: PromiseOrValue<BigNumberish>, tokenOut: PromiseOrValue<string>, minTokenAmountOut: PromiseOrValue<BigNumberish>, recipient: PromiseOrValue<string>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<ContractTransaction>;
        skim(recipient: PromiseOrValue<string>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<ContractTransaction>;
        swapFrom(fromToken: PromiseOrValue<string>, toToken: PromiseOrValue<string>, amountIn: PromiseOrValue<BigNumberish>, minAmountOut: PromiseOrValue<BigNumberish>, recipient: PromiseOrValue<string>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<ContractTransaction>;
        swapTo(fromToken: PromiseOrValue<string>, toToken: PromiseOrValue<string>, maxAmountIn: PromiseOrValue<BigNumberish>, amountOut: PromiseOrValue<BigNumberish>, recipient: PromiseOrValue<string>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<ContractTransaction>;
        symbol(overrides?: CallOverrides): Promise<[string]>;
        token(i: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<[string] & {
            _token: string;
        }>;
        tokens(overrides?: CallOverrides): Promise<[string[]] & {
            ts: string[];
        }>;
        totalSupply(overrides?: CallOverrides): Promise<[BigNumber]>;
        transfer(to: PromiseOrValue<string>, amount: PromiseOrValue<BigNumberish>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<ContractTransaction>;
        transferFrom(from: PromiseOrValue<string>, to: PromiseOrValue<string>, amount: PromiseOrValue<BigNumberish>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<ContractTransaction>;
        well(overrides?: CallOverrides): Promise<[
            string[],
            CallStructOutput,
            CallStructOutput[],
            string
        ] & {
            _tokens: string[];
            _wellFunction: CallStructOutput;
            _pumps: CallStructOutput[];
            _auger: string;
        }>;
        wellFunction(overrides?: CallOverrides): Promise<[CallStructOutput]>;
        wellFunctionAddress(overrides?: CallOverrides): Promise<[string] & {
            __address: string;
        }>;
        wellFunctionBytes(overrides?: CallOverrides): Promise<[string] & {
            _bytes: string;
        }>;
    };
    DOMAIN_SEPARATOR(overrides?: CallOverrides): Promise<string>;
    addLiquidity(tokenAmountsIn: PromiseOrValue<BigNumberish>[], minLpAmountOut: PromiseOrValue<BigNumberish>, recipient: PromiseOrValue<string>, overrides?: Overrides & {
        from?: PromiseOrValue<string>;
    }): Promise<ContractTransaction>;
    allowance(owner: PromiseOrValue<string>, spender: PromiseOrValue<string>, overrides?: CallOverrides): Promise<BigNumber>;
    approve(spender: PromiseOrValue<string>, amount: PromiseOrValue<BigNumberish>, overrides?: Overrides & {
        from?: PromiseOrValue<string>;
    }): Promise<ContractTransaction>;
    auger(overrides?: CallOverrides): Promise<string>;
    balanceOf(account: PromiseOrValue<string>, overrides?: CallOverrides): Promise<BigNumber>;
    decimals(overrides?: CallOverrides): Promise<number>;
    decreaseAllowance(spender: PromiseOrValue<string>, subtractedValue: PromiseOrValue<BigNumberish>, overrides?: Overrides & {
        from?: PromiseOrValue<string>;
    }): Promise<ContractTransaction>;
    firstPumpBytes(overrides?: CallOverrides): Promise<string>;
    firstPumpTarget(overrides?: CallOverrides): Promise<string>;
    getAddLiquidityOut(tokenAmountsIn: PromiseOrValue<BigNumberish>[], overrides?: CallOverrides): Promise<BigNumber>;
    getRemoveLiquidityImbalancedIn(tokenAmountsOut: PromiseOrValue<BigNumberish>[], overrides?: CallOverrides): Promise<BigNumber>;
    getRemoveLiquidityOneTokenOut(lpAmountIn: PromiseOrValue<BigNumberish>, tokenOut: PromiseOrValue<string>, overrides?: CallOverrides): Promise<BigNumber>;
    getRemoveLiquidityOut(lpAmountIn: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<BigNumber[]>;
    getReserves(overrides?: CallOverrides): Promise<BigNumber[]>;
    getSwapIn(fromToken: PromiseOrValue<string>, toToken: PromiseOrValue<string>, amountOut: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<BigNumber>;
    getSwapOut(fromToken: PromiseOrValue<string>, toToken: PromiseOrValue<string>, amountIn: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<BigNumber>;
    increaseAllowance(spender: PromiseOrValue<string>, addedValue: PromiseOrValue<BigNumberish>, overrides?: Overrides & {
        from?: PromiseOrValue<string>;
    }): Promise<ContractTransaction>;
    name(overrides?: CallOverrides): Promise<string>;
    nonces(owner: PromiseOrValue<string>, overrides?: CallOverrides): Promise<BigNumber>;
    numberOfPumps(overrides?: CallOverrides): Promise<BigNumber>;
    numberOfTokens(overrides?: CallOverrides): Promise<BigNumber>;
    permit(owner: PromiseOrValue<string>, spender: PromiseOrValue<string>, value: PromiseOrValue<BigNumberish>, deadline: PromiseOrValue<BigNumberish>, v: PromiseOrValue<BigNumberish>, r: PromiseOrValue<BytesLike>, s: PromiseOrValue<BytesLike>, overrides?: Overrides & {
        from?: PromiseOrValue<string>;
    }): Promise<ContractTransaction>;
    pumps(overrides?: CallOverrides): Promise<CallStructOutput[]>;
    removeLiquidity(lpAmountIn: PromiseOrValue<BigNumberish>, minTokenAmountsOut: PromiseOrValue<BigNumberish>[], recipient: PromiseOrValue<string>, overrides?: Overrides & {
        from?: PromiseOrValue<string>;
    }): Promise<ContractTransaction>;
    removeLiquidityImbalanced(maxLpAmountIn: PromiseOrValue<BigNumberish>, tokenAmountsOut: PromiseOrValue<BigNumberish>[], recipient: PromiseOrValue<string>, overrides?: Overrides & {
        from?: PromiseOrValue<string>;
    }): Promise<ContractTransaction>;
    removeLiquidityOneToken(lpAmountIn: PromiseOrValue<BigNumberish>, tokenOut: PromiseOrValue<string>, minTokenAmountOut: PromiseOrValue<BigNumberish>, recipient: PromiseOrValue<string>, overrides?: Overrides & {
        from?: PromiseOrValue<string>;
    }): Promise<ContractTransaction>;
    skim(recipient: PromiseOrValue<string>, overrides?: Overrides & {
        from?: PromiseOrValue<string>;
    }): Promise<ContractTransaction>;
    swapFrom(fromToken: PromiseOrValue<string>, toToken: PromiseOrValue<string>, amountIn: PromiseOrValue<BigNumberish>, minAmountOut: PromiseOrValue<BigNumberish>, recipient: PromiseOrValue<string>, overrides?: Overrides & {
        from?: PromiseOrValue<string>;
    }): Promise<ContractTransaction>;
    swapTo(fromToken: PromiseOrValue<string>, toToken: PromiseOrValue<string>, maxAmountIn: PromiseOrValue<BigNumberish>, amountOut: PromiseOrValue<BigNumberish>, recipient: PromiseOrValue<string>, overrides?: Overrides & {
        from?: PromiseOrValue<string>;
    }): Promise<ContractTransaction>;
    symbol(overrides?: CallOverrides): Promise<string>;
    token(i: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<string>;
    tokens(overrides?: CallOverrides): Promise<string[]>;
    totalSupply(overrides?: CallOverrides): Promise<BigNumber>;
    transfer(to: PromiseOrValue<string>, amount: PromiseOrValue<BigNumberish>, overrides?: Overrides & {
        from?: PromiseOrValue<string>;
    }): Promise<ContractTransaction>;
    transferFrom(from: PromiseOrValue<string>, to: PromiseOrValue<string>, amount: PromiseOrValue<BigNumberish>, overrides?: Overrides & {
        from?: PromiseOrValue<string>;
    }): Promise<ContractTransaction>;
    well(overrides?: CallOverrides): Promise<[
        string[],
        CallStructOutput,
        CallStructOutput[],
        string
    ] & {
        _tokens: string[];
        _wellFunction: CallStructOutput;
        _pumps: CallStructOutput[];
        _auger: string;
    }>;
    wellFunction(overrides?: CallOverrides): Promise<CallStructOutput>;
    wellFunctionAddress(overrides?: CallOverrides): Promise<string>;
    wellFunctionBytes(overrides?: CallOverrides): Promise<string>;
    callStatic: {
        DOMAIN_SEPARATOR(overrides?: CallOverrides): Promise<string>;
        addLiquidity(tokenAmountsIn: PromiseOrValue<BigNumberish>[], minLpAmountOut: PromiseOrValue<BigNumberish>, recipient: PromiseOrValue<string>, overrides?: CallOverrides): Promise<BigNumber>;
        allowance(owner: PromiseOrValue<string>, spender: PromiseOrValue<string>, overrides?: CallOverrides): Promise<BigNumber>;
        approve(spender: PromiseOrValue<string>, amount: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<boolean>;
        auger(overrides?: CallOverrides): Promise<string>;
        balanceOf(account: PromiseOrValue<string>, overrides?: CallOverrides): Promise<BigNumber>;
        decimals(overrides?: CallOverrides): Promise<number>;
        decreaseAllowance(spender: PromiseOrValue<string>, subtractedValue: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<boolean>;
        firstPumpBytes(overrides?: CallOverrides): Promise<string>;
        firstPumpTarget(overrides?: CallOverrides): Promise<string>;
        getAddLiquidityOut(tokenAmountsIn: PromiseOrValue<BigNumberish>[], overrides?: CallOverrides): Promise<BigNumber>;
        getRemoveLiquidityImbalancedIn(tokenAmountsOut: PromiseOrValue<BigNumberish>[], overrides?: CallOverrides): Promise<BigNumber>;
        getRemoveLiquidityOneTokenOut(lpAmountIn: PromiseOrValue<BigNumberish>, tokenOut: PromiseOrValue<string>, overrides?: CallOverrides): Promise<BigNumber>;
        getRemoveLiquidityOut(lpAmountIn: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<BigNumber[]>;
        getReserves(overrides?: CallOverrides): Promise<BigNumber[]>;
        getSwapIn(fromToken: PromiseOrValue<string>, toToken: PromiseOrValue<string>, amountOut: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<BigNumber>;
        getSwapOut(fromToken: PromiseOrValue<string>, toToken: PromiseOrValue<string>, amountIn: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<BigNumber>;
        increaseAllowance(spender: PromiseOrValue<string>, addedValue: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<boolean>;
        name(overrides?: CallOverrides): Promise<string>;
        nonces(owner: PromiseOrValue<string>, overrides?: CallOverrides): Promise<BigNumber>;
        numberOfPumps(overrides?: CallOverrides): Promise<BigNumber>;
        numberOfTokens(overrides?: CallOverrides): Promise<BigNumber>;
        permit(owner: PromiseOrValue<string>, spender: PromiseOrValue<string>, value: PromiseOrValue<BigNumberish>, deadline: PromiseOrValue<BigNumberish>, v: PromiseOrValue<BigNumberish>, r: PromiseOrValue<BytesLike>, s: PromiseOrValue<BytesLike>, overrides?: CallOverrides): Promise<void>;
        pumps(overrides?: CallOverrides): Promise<CallStructOutput[]>;
        removeLiquidity(lpAmountIn: PromiseOrValue<BigNumberish>, minTokenAmountsOut: PromiseOrValue<BigNumberish>[], recipient: PromiseOrValue<string>, overrides?: CallOverrides): Promise<BigNumber[]>;
        removeLiquidityImbalanced(maxLpAmountIn: PromiseOrValue<BigNumberish>, tokenAmountsOut: PromiseOrValue<BigNumberish>[], recipient: PromiseOrValue<string>, overrides?: CallOverrides): Promise<BigNumber>;
        removeLiquidityOneToken(lpAmountIn: PromiseOrValue<BigNumberish>, tokenOut: PromiseOrValue<string>, minTokenAmountOut: PromiseOrValue<BigNumberish>, recipient: PromiseOrValue<string>, overrides?: CallOverrides): Promise<BigNumber>;
        skim(recipient: PromiseOrValue<string>, overrides?: CallOverrides): Promise<BigNumber[]>;
        swapFrom(fromToken: PromiseOrValue<string>, toToken: PromiseOrValue<string>, amountIn: PromiseOrValue<BigNumberish>, minAmountOut: PromiseOrValue<BigNumberish>, recipient: PromiseOrValue<string>, overrides?: CallOverrides): Promise<BigNumber>;
        swapTo(fromToken: PromiseOrValue<string>, toToken: PromiseOrValue<string>, maxAmountIn: PromiseOrValue<BigNumberish>, amountOut: PromiseOrValue<BigNumberish>, recipient: PromiseOrValue<string>, overrides?: CallOverrides): Promise<BigNumber>;
        symbol(overrides?: CallOverrides): Promise<string>;
        token(i: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<string>;
        tokens(overrides?: CallOverrides): Promise<string[]>;
        totalSupply(overrides?: CallOverrides): Promise<BigNumber>;
        transfer(to: PromiseOrValue<string>, amount: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<boolean>;
        transferFrom(from: PromiseOrValue<string>, to: PromiseOrValue<string>, amount: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<boolean>;
        well(overrides?: CallOverrides): Promise<[
            string[],
            CallStructOutput,
            CallStructOutput[],
            string
        ] & {
            _tokens: string[];
            _wellFunction: CallStructOutput;
            _pumps: CallStructOutput[];
            _auger: string;
        }>;
        wellFunction(overrides?: CallOverrides): Promise<CallStructOutput>;
        wellFunctionAddress(overrides?: CallOverrides): Promise<string>;
        wellFunctionBytes(overrides?: CallOverrides): Promise<string>;
    };
    filters: {
        "AddLiquidity(uint256[],uint256)"(tokenAmountsIn?: null, lpAmountOut?: null): AddLiquidityEventFilter;
        AddLiquidity(tokenAmountsIn?: null, lpAmountOut?: null): AddLiquidityEventFilter;
        "Approval(address,address,uint256)"(owner?: PromiseOrValue<string> | null, spender?: PromiseOrValue<string> | null, value?: null): ApprovalEventFilter;
        Approval(owner?: PromiseOrValue<string> | null, spender?: PromiseOrValue<string> | null, value?: null): ApprovalEventFilter;
        "RemoveLiquidity(uint256,uint256[])"(lpAmountIn?: null, tokenAmountsOut?: null): RemoveLiquidityEventFilter;
        RemoveLiquidity(lpAmountIn?: null, tokenAmountsOut?: null): RemoveLiquidityEventFilter;
        "RemoveLiquidityOneToken(uint256,address,uint256)"(lpAmountIn?: null, tokenOut?: null, tokenAmountOut?: null): RemoveLiquidityOneTokenEventFilter;
        RemoveLiquidityOneToken(lpAmountIn?: null, tokenOut?: null, tokenAmountOut?: null): RemoveLiquidityOneTokenEventFilter;
        "Swap(address,address,uint256,uint256)"(fromToken?: null, toToken?: null, amountIn?: null, amountOut?: null): SwapEventFilter;
        Swap(fromToken?: null, toToken?: null, amountIn?: null, amountOut?: null): SwapEventFilter;
        "Transfer(address,address,uint256)"(from?: PromiseOrValue<string> | null, to?: PromiseOrValue<string> | null, value?: null): TransferEventFilter;
        Transfer(from?: PromiseOrValue<string> | null, to?: PromiseOrValue<string> | null, value?: null): TransferEventFilter;
    };
    estimateGas: {
        DOMAIN_SEPARATOR(overrides?: CallOverrides): Promise<BigNumber>;
        addLiquidity(tokenAmountsIn: PromiseOrValue<BigNumberish>[], minLpAmountOut: PromiseOrValue<BigNumberish>, recipient: PromiseOrValue<string>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<BigNumber>;
        allowance(owner: PromiseOrValue<string>, spender: PromiseOrValue<string>, overrides?: CallOverrides): Promise<BigNumber>;
        approve(spender: PromiseOrValue<string>, amount: PromiseOrValue<BigNumberish>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<BigNumber>;
        auger(overrides?: CallOverrides): Promise<BigNumber>;
        balanceOf(account: PromiseOrValue<string>, overrides?: CallOverrides): Promise<BigNumber>;
        decimals(overrides?: CallOverrides): Promise<BigNumber>;
        decreaseAllowance(spender: PromiseOrValue<string>, subtractedValue: PromiseOrValue<BigNumberish>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<BigNumber>;
        firstPumpBytes(overrides?: CallOverrides): Promise<BigNumber>;
        firstPumpTarget(overrides?: CallOverrides): Promise<BigNumber>;
        getAddLiquidityOut(tokenAmountsIn: PromiseOrValue<BigNumberish>[], overrides?: CallOverrides): Promise<BigNumber>;
        getRemoveLiquidityImbalancedIn(tokenAmountsOut: PromiseOrValue<BigNumberish>[], overrides?: CallOverrides): Promise<BigNumber>;
        getRemoveLiquidityOneTokenOut(lpAmountIn: PromiseOrValue<BigNumberish>, tokenOut: PromiseOrValue<string>, overrides?: CallOverrides): Promise<BigNumber>;
        getRemoveLiquidityOut(lpAmountIn: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<BigNumber>;
        getReserves(overrides?: CallOverrides): Promise<BigNumber>;
        getSwapIn(fromToken: PromiseOrValue<string>, toToken: PromiseOrValue<string>, amountOut: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<BigNumber>;
        getSwapOut(fromToken: PromiseOrValue<string>, toToken: PromiseOrValue<string>, amountIn: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<BigNumber>;
        increaseAllowance(spender: PromiseOrValue<string>, addedValue: PromiseOrValue<BigNumberish>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<BigNumber>;
        name(overrides?: CallOverrides): Promise<BigNumber>;
        nonces(owner: PromiseOrValue<string>, overrides?: CallOverrides): Promise<BigNumber>;
        numberOfPumps(overrides?: CallOverrides): Promise<BigNumber>;
        numberOfTokens(overrides?: CallOverrides): Promise<BigNumber>;
        permit(owner: PromiseOrValue<string>, spender: PromiseOrValue<string>, value: PromiseOrValue<BigNumberish>, deadline: PromiseOrValue<BigNumberish>, v: PromiseOrValue<BigNumberish>, r: PromiseOrValue<BytesLike>, s: PromiseOrValue<BytesLike>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<BigNumber>;
        pumps(overrides?: CallOverrides): Promise<BigNumber>;
        removeLiquidity(lpAmountIn: PromiseOrValue<BigNumberish>, minTokenAmountsOut: PromiseOrValue<BigNumberish>[], recipient: PromiseOrValue<string>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<BigNumber>;
        removeLiquidityImbalanced(maxLpAmountIn: PromiseOrValue<BigNumberish>, tokenAmountsOut: PromiseOrValue<BigNumberish>[], recipient: PromiseOrValue<string>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<BigNumber>;
        removeLiquidityOneToken(lpAmountIn: PromiseOrValue<BigNumberish>, tokenOut: PromiseOrValue<string>, minTokenAmountOut: PromiseOrValue<BigNumberish>, recipient: PromiseOrValue<string>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<BigNumber>;
        skim(recipient: PromiseOrValue<string>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<BigNumber>;
        swapFrom(fromToken: PromiseOrValue<string>, toToken: PromiseOrValue<string>, amountIn: PromiseOrValue<BigNumberish>, minAmountOut: PromiseOrValue<BigNumberish>, recipient: PromiseOrValue<string>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<BigNumber>;
        swapTo(fromToken: PromiseOrValue<string>, toToken: PromiseOrValue<string>, maxAmountIn: PromiseOrValue<BigNumberish>, amountOut: PromiseOrValue<BigNumberish>, recipient: PromiseOrValue<string>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<BigNumber>;
        symbol(overrides?: CallOverrides): Promise<BigNumber>;
        token(i: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<BigNumber>;
        tokens(overrides?: CallOverrides): Promise<BigNumber>;
        totalSupply(overrides?: CallOverrides): Promise<BigNumber>;
        transfer(to: PromiseOrValue<string>, amount: PromiseOrValue<BigNumberish>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<BigNumber>;
        transferFrom(from: PromiseOrValue<string>, to: PromiseOrValue<string>, amount: PromiseOrValue<BigNumberish>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<BigNumber>;
        well(overrides?: CallOverrides): Promise<BigNumber>;
        wellFunction(overrides?: CallOverrides): Promise<BigNumber>;
        wellFunctionAddress(overrides?: CallOverrides): Promise<BigNumber>;
        wellFunctionBytes(overrides?: CallOverrides): Promise<BigNumber>;
    };
    populateTransaction: {
        DOMAIN_SEPARATOR(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        addLiquidity(tokenAmountsIn: PromiseOrValue<BigNumberish>[], minLpAmountOut: PromiseOrValue<BigNumberish>, recipient: PromiseOrValue<string>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<PopulatedTransaction>;
        allowance(owner: PromiseOrValue<string>, spender: PromiseOrValue<string>, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        approve(spender: PromiseOrValue<string>, amount: PromiseOrValue<BigNumberish>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<PopulatedTransaction>;
        auger(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        balanceOf(account: PromiseOrValue<string>, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        decimals(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        decreaseAllowance(spender: PromiseOrValue<string>, subtractedValue: PromiseOrValue<BigNumberish>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<PopulatedTransaction>;
        firstPumpBytes(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        firstPumpTarget(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getAddLiquidityOut(tokenAmountsIn: PromiseOrValue<BigNumberish>[], overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getRemoveLiquidityImbalancedIn(tokenAmountsOut: PromiseOrValue<BigNumberish>[], overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getRemoveLiquidityOneTokenOut(lpAmountIn: PromiseOrValue<BigNumberish>, tokenOut: PromiseOrValue<string>, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getRemoveLiquidityOut(lpAmountIn: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getReserves(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getSwapIn(fromToken: PromiseOrValue<string>, toToken: PromiseOrValue<string>, amountOut: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getSwapOut(fromToken: PromiseOrValue<string>, toToken: PromiseOrValue<string>, amountIn: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        increaseAllowance(spender: PromiseOrValue<string>, addedValue: PromiseOrValue<BigNumberish>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<PopulatedTransaction>;
        name(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        nonces(owner: PromiseOrValue<string>, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        numberOfPumps(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        numberOfTokens(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        permit(owner: PromiseOrValue<string>, spender: PromiseOrValue<string>, value: PromiseOrValue<BigNumberish>, deadline: PromiseOrValue<BigNumberish>, v: PromiseOrValue<BigNumberish>, r: PromiseOrValue<BytesLike>, s: PromiseOrValue<BytesLike>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<PopulatedTransaction>;
        pumps(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        removeLiquidity(lpAmountIn: PromiseOrValue<BigNumberish>, minTokenAmountsOut: PromiseOrValue<BigNumberish>[], recipient: PromiseOrValue<string>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<PopulatedTransaction>;
        removeLiquidityImbalanced(maxLpAmountIn: PromiseOrValue<BigNumberish>, tokenAmountsOut: PromiseOrValue<BigNumberish>[], recipient: PromiseOrValue<string>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<PopulatedTransaction>;
        removeLiquidityOneToken(lpAmountIn: PromiseOrValue<BigNumberish>, tokenOut: PromiseOrValue<string>, minTokenAmountOut: PromiseOrValue<BigNumberish>, recipient: PromiseOrValue<string>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<PopulatedTransaction>;
        skim(recipient: PromiseOrValue<string>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<PopulatedTransaction>;
        swapFrom(fromToken: PromiseOrValue<string>, toToken: PromiseOrValue<string>, amountIn: PromiseOrValue<BigNumberish>, minAmountOut: PromiseOrValue<BigNumberish>, recipient: PromiseOrValue<string>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<PopulatedTransaction>;
        swapTo(fromToken: PromiseOrValue<string>, toToken: PromiseOrValue<string>, maxAmountIn: PromiseOrValue<BigNumberish>, amountOut: PromiseOrValue<BigNumberish>, recipient: PromiseOrValue<string>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<PopulatedTransaction>;
        symbol(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        token(i: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        tokens(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        totalSupply(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        transfer(to: PromiseOrValue<string>, amount: PromiseOrValue<BigNumberish>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<PopulatedTransaction>;
        transferFrom(from: PromiseOrValue<string>, to: PromiseOrValue<string>, amount: PromiseOrValue<BigNumberish>, overrides?: Overrides & {
            from?: PromiseOrValue<string>;
        }): Promise<PopulatedTransaction>;
        well(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        wellFunction(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        wellFunctionAddress(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        wellFunctionBytes(overrides?: CallOverrides): Promise<PopulatedTransaction>;
    };
}
