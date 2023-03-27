import React, { useEffect, useMemo, useRef } from 'react';
import { Drawer, Stack, Box, Typography, DrawerProps } from '@mui/material';
import Row from '../Row';
import useToggle from '~/hooks/display/useToggle';
import { Form, FormikFormProps } from 'formik';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import Centered from '~/components/Common/ZeroState/Centered';

function useFormDrawer(siblingRef: React.RefObject<HTMLDivElement>) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const [open, setOpen, setClose] = useToggle();

  // Updates the height of the parent container and the drawer
  // based on the open state and the sibling's & drawer's height changes.
  useEffect(() => {
    const parent = parentRef.current;
    const sibling = siblingRef.current;
    const drawer = drawerRef.current;

    if (!parent || !sibling || !drawer) return;

    const updateHeight = () => {
      if (!open) {
        parent.style.height = '100%';
      } else {
        const drawerHeight = drawer.scrollHeight + 2;
        const siblingHeight = sibling.offsetHeight;

        if (siblingHeight === drawerHeight) return;

        if (siblingHeight > drawerHeight) {
          drawer.style.height = `${parent.offsetHeight}px`;
        } else {
          parent.style.height = `${drawerHeight}px`;
          // reset the height of the drawer
          drawer.style.height = 'auto';
        }
      }
    };

    // Observe drawer height changes
    const childResizeObserver = new ResizeObserver(() => {
      updateHeight();
    });
    // Observe drawer sibling's height changes
    const siblingResizeObserver = new ResizeObserver(() => {
      updateHeight();
    });

    childResizeObserver.observe(drawer);
    siblingResizeObserver.observe(sibling);

    // Cleanup
    return () => {
      childResizeObserver.disconnect();
      siblingResizeObserver.disconnect();
    };
  }, [open]);

  return {
    open,
    setOpen,
    setClose,
    drawerRef,
    parentRef,
  };
}

const FormDrawerContext = React.createContext<
  ReturnType<typeof useFormDrawer> | undefined
>(undefined);

const useFormDrawerContext = () => {
  const context = React.useContext(FormDrawerContext);

  if (!context) {
    throw new Error(
      'useFormDrawerContext must be used within a FormDrawerProvider'
    );
  }
  return context;
};

/**
 * Formik Form Wrapper for forms that need a drawer
 * The height of the drawer & parent container are updated
 * based on the sibling's height changes & the open state.
 *
 * Components
 * - Drawer
 * - Toggle
 */
const FormWithDrawer = ({
  children,
  siblingRef,
  ...formProps
}: {
  children: React.ReactNode;
  siblingRef: React.RefObject<HTMLDivElement>;
} & FormikFormProps) => {
  const value = useFormDrawer(siblingRef);

  return (
    <Form {...formProps}>
      <FormDrawerContext.Provider value={value}>
        <Box position="relative" ref={value.parentRef}>
          {children}
        </Box>
      </FormDrawerContext.Provider>
    </Form>
  );
};

const ToggleIcon: React.FC<{ ms?: number }> = ({ ms = 150 }) => {
  const { open, setOpen, setClose } = useFormDrawerContext();

  const sharedSx = {
    color: 'text.secondary',
    height: '14px',
    width: '14px',
    transition: `all ${ms}ms linear`,
    '&:hover': {
      transform: 'rotate(180deg)',
    },
  };

  return (
    <Centered
      sx={{
        cursor: 'pointer',
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        backgroundColor: 'white',
      }}
      onClick={open ? setClose : setOpen}
    >
      {open && <ExpandLessIcon sx={sharedSx} />}
      {!open && <ExpandMoreIcon sx={sharedSx} />}
    </Centered>
  );
};

/**
 * NestedFormDrawer is a React component that renders a Drawer/Modal
 * on top of a sibling element within a parent container. The component
 * ensures that the parent container's height adapts to the height of the
 * Drawer or the sibling element, depending on the state of the Drawer.
 */
const NestedFormDrawer: React.FC<{
  /** */
  children: React.ReactNode;
  /** */
  title?: string | JSX.Element;
  /** */
  transitionDuration?: DrawerProps['transitionDuration'];
}> = ({ children, title, transitionDuration: _transitionDuration }) => {
  const { open, setClose, drawerRef } = useFormDrawerContext();

  const transitionDuration = useMemo(() => {
    const dur = _transitionDuration;
    const isNum = typeof dur === 'number';

    return {
      enter: isNum ? dur : dur?.enter || 100,
      exit: isNum ? dur : dur?.exit || 200,
    };
  }, [_transitionDuration]);

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={setClose}
      variant="persistent"
      sx={{
        '&.MuiDrawer-root': {
          '& .MuiDrawer-paper': {
            top: '0px',
            left: '0px',
            bottom: '0px',
            right: '0px',
            position: 'absolute',
            borderRadius: 1,
            backgroundColor: 'primary.light',
            zIndex: 1300,
            border: '1px solid',
            borderColor: 'primary.light',
            boxSizing: 'border-box',
          },
        },
      }}
      transitionDuration={transitionDuration}
    >
      <Box ref={drawerRef} width="100%">
        <Stack p={1} gap={1} sx={{ boxSizing: 'border-box', height: '100%' }}>
          <Row justifyContent="space-between">
            <Box>
              {title ? (
                typeof title === 'string' ? (
                  <Typography variant="h4" color="primary.main">
                    {title}
                  </Typography>
                ) : (
                  title
                )
              ) : null}
            </Box>
            <ToggleIcon />
          </Row>
          {children}
        </Stack>
      </Box>
    </Drawer>
  );
};

FormWithDrawer.Toggle = ToggleIcon;

FormWithDrawer.Drawer = React.memo(NestedFormDrawer);

export default FormWithDrawer;
