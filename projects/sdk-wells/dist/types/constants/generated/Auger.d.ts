import type { BaseContract, BigNumber, BytesLike, CallOverrides, ContractTransaction, PayableOverrides, PopulatedTransaction, Signer, utils } from "ethers";
import type { FunctionFragment, Result } from "@ethersproject/abi";
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
export interface AugerInterface extends utils.Interface {
    functions: {
        "bore(string,string,address[],(address,bytes),(address,bytes)[])": FunctionFragment;
    };
    getFunction(nameOrSignatureOrTopic: "bore"): FunctionFragment;
    encodeFunctionData(functionFragment: "bore", values: [
        PromiseOrValue<string>,
        PromiseOrValue<string>,
        PromiseOrValue<string>[],
        CallStruct,
        CallStruct[]
    ]): string;
    decodeFunctionResult(functionFragment: "bore", data: BytesLike): Result;
    events: {};
}
export interface Auger extends BaseContract {
    connect(signerOrProvider: Signer | Provider | string): this;
    attach(addressOrName: string): this;
    deployed(): Promise<this>;
    interface: AugerInterface;
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
        bore(name: PromiseOrValue<string>, symbol: PromiseOrValue<string>, tokens: PromiseOrValue<string>[], wellFunction: CallStruct, pumps: CallStruct[], overrides?: PayableOverrides & {
            from?: PromiseOrValue<string>;
        }): Promise<ContractTransaction>;
    };
    bore(name: PromiseOrValue<string>, symbol: PromiseOrValue<string>, tokens: PromiseOrValue<string>[], wellFunction: CallStruct, pumps: CallStruct[], overrides?: PayableOverrides & {
        from?: PromiseOrValue<string>;
    }): Promise<ContractTransaction>;
    callStatic: {
        bore(name: PromiseOrValue<string>, symbol: PromiseOrValue<string>, tokens: PromiseOrValue<string>[], wellFunction: CallStruct, pumps: CallStruct[], overrides?: CallOverrides): Promise<string>;
    };
    filters: {};
    estimateGas: {
        bore(name: PromiseOrValue<string>, symbol: PromiseOrValue<string>, tokens: PromiseOrValue<string>[], wellFunction: CallStruct, pumps: CallStruct[], overrides?: PayableOverrides & {
            from?: PromiseOrValue<string>;
        }): Promise<BigNumber>;
    };
    populateTransaction: {
        bore(name: PromiseOrValue<string>, symbol: PromiseOrValue<string>, tokens: PromiseOrValue<string>[], wellFunction: CallStruct, pumps: CallStruct[], overrides?: PayableOverrides & {
            from?: PromiseOrValue<string>;
        }): Promise<PopulatedTransaction>;
    };
}
