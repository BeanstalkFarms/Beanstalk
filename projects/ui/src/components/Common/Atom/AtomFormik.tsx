import { FormikConfig, FormikProps, Formik, FormikValues } from 'formik';
import { WritableAtom, SetStateAction, useAtomValue } from 'jotai';
import React, { useMemo, useEffect } from 'react';

type BaseAtom<T> = WritableAtom<T, SetStateAction<T>, void>;

type FormComponentProps<T extends FormikValues> = FormikProps<T> & {
  atom: BaseAtom<T>;
};

function FormikAtomValueController<T extends FormikValues>({
  atom: _atom,
  values,
  setFieldValue,
  ...formikProps
}: FormComponentProps<T>) {
  const atomState = useAtomValue(_atom);

  const keys = useMemo(() => Object.keys(values), [values]);

  console.log('values: ', values);
  // const p = formikProps.getFieldProps('amount');
  // console.log('p: ', p);

  /**
   * update the form values when atom state changes
   */
  useEffect(() => {
    // if (!isEqual(atomState, values)) {
    //   Object.keys(values).forEach((k) => {
    //     try {
    //       if (k in atomState) {
    //         setFieldValue(k, { ...atomState[k] });
    //       }
    //     } catch (e: any) {
    //       console.log(e);
    //     }
    //   });
    // }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atomState]);

  return null;
}

export type IAtomFormik<T extends FormikValues> = FormikConfig<T> & {
  atom: BaseAtom<T>;
  children: (props: FormikProps<T>) => React.ReactNode;
};

function AtomFormik<T extends FormikValues>({
  atom: _atom,
  children,
  ...formProps
}: IAtomFormik<T>) {
  console.log('rerender...');
  return (
    <Formik<T> {...formProps}>
      {(formikProps: FormikProps<T>) => (
        <>
          <FormikAtomValueController {...formikProps} atom={_atom} />
          {children({ ...formikProps })}
        </>
      )}
    </Formik>
  );
}

export default AtomFormik;

// export function useUpdateFormikAtom<T>(fieldName: string, _atom: BaseAtom<T>) {
//   const atom = useAtom(_atom);
//   const k = useField(fieldName);

//   useEffect(() => {
//     if (k.)
//   }, [atom]);

// }

/**
 *
 * state1
 *  - update(atomState)
 *
 * formikState
 *
 *
 * formState
 *  - onChange => update(DisplayValue) => update(atomState)
 *  - useEffect, [atomState] => if (displayValue !== atomState) => update(displayValue)
 *
 *
 *
 */
