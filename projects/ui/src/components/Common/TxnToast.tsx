import React, { useCallback } from 'react';
import { ContractReceipt, ContractTransaction } from 'ethers';
import toast from 'react-hot-toast';
import { Box, IconButton, Link, Typography } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import useChainConstant from '~/hooks/chain/useChainConstant';
import { parseError } from '~/util';
import { CHAIN_INFO } from '~/constants';

function dismissErrors(id?: any) {
  if (id) {
    toast.dismiss(id);
  } else {
    toast.dismiss();
  }
}

export function ToastAlert({ desc, hash, msg, id }: { desc?: string, hash?: string, msg?: string, id?: any }) {
  const handleClick = useCallback(() => (id !== null ? dismissErrors(id) : dismissErrors()), [id]);
  const chainInfo = useChainConstant(CHAIN_INFO);
  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
      <Typography sx={{ pl: 1, pr: 2, flex: 1, textAlign: 'center' }}>
        <span>
          {desc}
          {hash && (
            <>
              &nbsp;
              <Link href={`${chainInfo.explorer}/tx/${hash}`} target="_blank" rel="noreferrer">View on Etherscan</Link>
            </>
          )}
        </span>
        {msg && (
          <Box
            display="inline"
            sx={{ 
              wordBreak: 'break-all',
              '&:first-letter': { textTransform: 'capitalize' },
            }}
          >
            {msg}
          </Box>
        )}
      </Typography>
      {msg && (
        <IconButton
          sx={{
            backgroundColor: 'transparent',
            p: 0,
            width: '20px',
            height: '20px',
            '& svg': {
              width: '18px',
              height: '18px',
            }
          }}
          size="small"
          onClick={handleClick}
        >
          <ClearIcon />
        </IconButton>
      )}
    </Box>
  );
}

ToastAlert.defaultProps = {
  hash: undefined,
};

type ToastMessages = {
  loading: string;
  success: string;
  error?: string;
}

/**
 * A lightweight wrapper around react-hot-toast
 * to minimize repetitive Toast code when issuing transactions.
 */
export default class TransactionToast {
  /** */
  messages: ToastMessages;

  /** */
  toastId: any;

  constructor(messages: ToastMessages) {
    this.messages = messages;
    this.toastId = toast.loading(
      <ToastAlert
        desc={this.messages.loading}
      />, {
        duration: Infinity,
      }
    );
  }

  /**
   * Shows a loading message with Etherscan txn link while
   * a transaction is confirming
   * @param response The ethers.ContractTransaction response
   */
  confirming(response: ContractTransaction) {
    toast.loading(
      <ToastAlert
        desc={this.messages.loading}
        hash={response.hash}
        id={this.toastId}
      />,
      {
        id: this.toastId,
        duration: Infinity,
      }
    );
  }

  /**
   * After a transaction confirms, show a success message
   * and set a timeout duration for the toast.
   * @param value The ethers.ContractReceipt confirming the txn.
   */
  success(value?: ContractReceipt) {
    toast.success(
      <ToastAlert
        desc={this.messages.success}
        hash={value?.transactionHash}
        id={this.toastId}
      />,
      {
        id: this.toastId,
        duration: 5000,
      }
    );
  }

  error(error: any) {
    const duration = Infinity;
    const msg = parseError(error);
    toast.error(
      <ToastAlert
        desc={this.messages.error}
        msg={msg}
        id={this.toastId}
      />,
      {
        id: this.toastId,
        duration: duration
      }
    );
    return msg;
  }
}
