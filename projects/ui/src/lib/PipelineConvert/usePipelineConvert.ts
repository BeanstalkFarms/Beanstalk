import { useCallback, useEffect, useState } from 'react';
import { ERC20Token, AdvancedPipeStruct } from '@beanstalk/sdk';
import useSdk from '~/hooks/sdk';

function getAdvancedPipeCalls(
  inputToken: ERC20Token,
  outputToken: ERC20Token
): AdvancedPipeStruct[] {
  return [];
}

export interface IUsePipelineConvertReturn {
  // Whether the pipeline convert can run it's estimates
  runMode: boolean;
  // The target token to convert to
  setTarget: (token: ERC20Token) => void;
}

export function usePipelineConvert(
  inputToken: ERC20Token,
  _outputToken: ERC20Token
): IUsePipelineConvertReturn {
  const sdk = useSdk();

  const [target, handleSetTarget] = useState<ERC20Token>(_outputToken);
  const [runMode, setRunMode] = useState(false);

  const zeroX = sdk.zeroX;

  useEffect(() => {
    setRunMode(target.isLP && inputToken.isLP);
  }, [inputToken.isLP, target.isLP]);

  // Error validation
  useEffect(() => {
    const tk = sdk.tokens.findByAddress(inputToken.address);
    if (!tk || !sdk.tokens.siloWhitelist.has(tk)) {
      throw new Error(
        `Token ${inputToken.address} is not whitelisted in the Silo.`
      );
    }
  }, [inputToken.address, sdk.tokens]);

  const setTarget = useCallback(
    (token: ERC20Token) => {
      if (sdk.tokens.siloWhitelist.has(token)) {
        handleSetTarget(token);
      } else {
        throw new Error(
          `Token ${token.symbol} is not whitelisted in the Silo.`
        );
      }
    },
    [sdk.tokens.siloWhitelist]
  );

  return { runMode, setTarget };
}

export function useConvertPaths() {}
