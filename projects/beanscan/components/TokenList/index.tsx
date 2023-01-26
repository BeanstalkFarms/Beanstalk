import EvmValue from "components/EvmValue";
import { ethers } from "ethers";

const TokenList : React.FC<React.PropsWithChildren<{ tokens: string[], values?: (string | ethers.BigNumber)[] }>> = ({ tokens, values}) => {
  return (
    <ul>
      {tokens.map((token, i) => (
        <li key={i} className="flex flex-row justify-between">
          <EvmValue>{token}</EvmValue>
          {values && values[i] ? <span>{values[i]?.toString()}</span> : null}
        </li>
      ))}
    </ul>
  )
}
export default TokenList;