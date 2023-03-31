import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { Drawer, Stack, Box, Typography, DrawerProps } from '@mui/material';
import { Form, FormikFormProps } from 'formik';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import useToggle from '~/hooks/display/useToggle';
import Row from '../Row';
import Centered from '~/components/Common/ZeroState/Centered';

function useFormDrawer(siblingRef: React.RefObject<HTMLDivElement>) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const [open, setOpen, setClose] = useToggle();

  /**
   * Updates the height of the parent container and the drawer
   * based on the open state and the sibling's & drawer's height changes.
   * We use 'useLayoutEffect' here to update the heights of the drawer / parent
   * before React renders the drawer
   */
  useLayoutEffect(() => {
    const parent = parentRef.current;
    const sibling = siblingRef.current;
    const drawer = drawerRef.current;

    if (!parent || !sibling || !drawer) return;

    const updateHeights = () => {
      if (!open) {
        parent.style.height = '100%';
      } else {
        // +2 to account for the border
        const drawerHeight = drawer.scrollHeight + 2;
        const siblingHeight = sibling.offsetHeight;

        if (siblingHeight === drawerHeight) return;

        /// If the sibling is taller than the drawer, set the parent's height to the drawer's height
        if (siblingHeight < drawerHeight) {
          parent.style.height = `${drawerHeight}px`;
          // reset the height of the drawer
          drawer.style.height = 'auto';
        }
      }
    };

    // Observe drawer height changes
    const childResizeObserver = new ResizeObserver(() => {
      updateHeights();
    });
    // Observe drawer sibling's height changes
    const siblingResizeObserver = new ResizeObserver(() => {
      updateHeights();
    });

    childResizeObserver.observe(drawer);
    siblingResizeObserver.observe(sibling);

    // Cleanup
    return () => {
      childResizeObserver.disconnect();
      siblingResizeObserver.disconnect();
    };
  }, [open, siblingRef]);

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
 * Wrapper around Formik's Form component.
 * The height of the drawer & parent container are dynamically updated
 * based on the open state and the sibling's & drawer's height changes.
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
    <FormDrawerContext.Provider value={value}>
      <Form {...formProps}>
        <Box position="relative" ref={value.parentRef}>
          {children}
        </Box>
      </Form>
    </FormDrawerContext.Provider>
  );
};

/**
 * Toggle icon for the drawer.
 * NOTE: Must be rendered within FormDrawerContext Provider.
 */
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
 * Renders a MUI Drawer on top of a sibling element within shared parent container.
 * NOTE: Must be rendered within FormDrawerContext Provider.
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
      enter: isNum ? dur : dur?.enter || 200,
      exit: isNum ? dur : dur?.exit || 300,
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
            bottom: '0px',
            position: 'absolute',
            borderRadius: 1,
            backgroundColor: 'primary.light',
            zIndex: 1300,
            border: '1px solid',
            borderColor: 'primary.light',
            boxSizing: 'border-box',
            overflow: 'hidden',
          },
        },
      }}
      transitionDuration={transitionDuration}
    >
      <Box ref={drawerRef} width="100%">
        <Stack
          p={1}
          gap={1}
          sx={{ boxSizing: 'border-box', overflow: 'hidden' }}
        >
          <Row justifyContent="space-between" width="100%">
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
          <Box>{open ? children : null}</Box>
        </Stack>
      </Box>
    </Drawer>
  );
};

FormWithDrawer.Toggle = ToggleIcon;

FormWithDrawer.Drawer = React.memo(NestedFormDrawer);

export default FormWithDrawer;
