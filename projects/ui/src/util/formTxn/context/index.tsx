import React, { useMemo } from 'react';
import { BeanstalkSDK } from '@beanstalk/sdk';
import useSdk from '~/hooks/sdk';
import { FC } from '~/types';
import { TxnBuilder } from '../TxnBuilder';

const useFormTxnBuilderInit = ({ sdk }: { sdk: BeanstalkSDK }) => {
  const formTxnBuilder = useMemo(() => new TxnBuilder(sdk), [sdk]);
  return formTxnBuilder;
};

const FormTxnBuilderContext = React.createContext<
  ReturnType<typeof useFormTxnBuilderInit> | undefined
>(undefined);

export const useFormTxnBuilder = () => {
  const context = React.useContext(FormTxnBuilderContext);

  if (context === undefined) {
    throw new Error(
      'useFormTxnBuilder must be used within a FormTxnBuilderProvider'
    );
  }

  return context;
};

export const FormTxnBuilderProvider: FC<{}> = ({ children }) => {
  const sdk = useSdk();
  const values = useFormTxnBuilderInit({ sdk });

  return (
    <FormTxnBuilderContext.Provider value={values}>
      {children}
    </FormTxnBuilderContext.Provider>
  );
};
