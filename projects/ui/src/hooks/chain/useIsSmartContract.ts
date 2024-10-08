import { useState, useEffect } from "react";
import useAccount from "../ledger/useAccount";
import useSdk from "../sdk";

export default function useIsSmartContract() {

    const account = useAccount();
    const sdk = useSdk();
    const [isContract, setIsContract] = useState(false);

    useEffect(() => {
        async function contractCheck() {
            if (!account) {
                setIsContract(false)
            } else {
                const _isContract = await sdk.provider.getCode(account);
                if (_isContract === "0x") {
                    setIsContract(false);
                } else {
                    setIsContract(true);
                }
            }
        };
        contractCheck()
    }, [account])

    return isContract

}