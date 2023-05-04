import React from 'react';
import { FormTxnBuilderContext } from '~/components/Common/Form/FormTxnProvider';

const useFormTxnContext = () => {
  const context = React.useContext(FormTxnBuilderContext);

  if (context === undefined) {
    throw new Error(
      'useFormTxnBuilder must be used within a FormTxnBuilderProvider'
    );
  }

  return context;
};

export default useFormTxnContext;
