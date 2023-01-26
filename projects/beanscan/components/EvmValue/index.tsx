import { ethers } from "ethers";

const EvmValue : React.FC<{
  children: string;
  label?: string;
  truncate?: number
}> = ({
  label,
  children,
  truncate = 12
}) => {
  const isAddress = ethers.utils.isAddress(children);
  return (
    <a href={`https://etherscan.io/address/${children}`} target="_blank" rel="noreferrer">
      {label || children.substring(0, truncate)}
    </a>
  )
}
export default EvmValue;