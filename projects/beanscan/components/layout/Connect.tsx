'use client';

import EvmValue from 'components/EvmValue';
import { ReactNode } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { InjectedConnector } from 'wagmi/connectors/injected'

import styles from "./Sidebar.module.scss";

const BUTTON_CLASS = "border border-gray-50 border-opacity-10 w-full text-center px-2 py-2 rounded-lg text-gray-300 hover:border-gray-600"

const Connect : React.FC = () => {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect({
    connector: new InjectedConnector(),
  })
  const { disconnect } = useDisconnect()
 
  let headerText : string | ReactNode = 'Account';
  let button;

  if (isConnected && address) {
    headerText = <EvmValue truncate={8}>{address}</EvmValue>;
    button = (
      <div className="space-y-1.5">
        <button onClick={() => disconnect()} className={BUTTON_CLASS}>Disconnect</button>
      </div>
    )
  } else {
    button = (
      <button onClick={() => connect()} className={BUTTON_CLASS}>
        Connect Wallet
      </button>
    );
  }
  return (
    <div>
      <h3 className={styles.sidebar_header}>{headerText}</h3>
      {button}
    </div>
  );
}

export default Connect;