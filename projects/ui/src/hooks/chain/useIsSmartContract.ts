import { useState, useEffect } from "react";
import useAccount from "../ledger/useAccount";
import { useChainId } from "wagmi";
import { getBytecode } from "viem/actions";
import { client } from "~/util/wagmi/config";

export default function useIsSmartContract() {

    const account = useAccount();
    const chainId = useChainId();
    const [isContract, setIsContract] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        async function contractCheck() {
            if (isLoading) return;
            if (!account) {
                setIsContract(false)
            } else {
                setIsLoading(true);
                const _isContract = await getBytecode(client, { address: account as `0x${string}` })
                if (_isContract === "0x") {
                    setIsContract(false);
                } else {
                    setIsContract(true);
                }
                setIsLoading(false);
            }
        };
        contractCheck()
    }, [account, chainId])

    return isContract
}