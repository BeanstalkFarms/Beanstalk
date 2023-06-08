import React from "react";
import { ToastBar, Toaster, resolveValue } from "react-hot-toast";
import { FC } from "src/types";
import { Error, Success } from "../Icons";

export const CustomToaster: FC<{}> = () => (
  <Toaster
    containerStyle={{
      // TODO: these need to be adjusted for mobile, also this is strange
      position: "fixed",
      top: 136,
      right: 24
    }}
    toastOptions={{
      duration: 4000,
      position: "top-right",
      iconTheme: {
        primary: "white",
        secondary: "black"
      },
      loading: {
        duration: Infinity
      },
      success: {
        duration: 4000,
        icon: (
          <div>
            <Success color="#46b955" width={16} height={16} />
          </div>
        )
      },
      error: {
        duration: Infinity,
        icon: (
          <div>
            <Error color="#ef4444" width={16} height={16} />
          </div>
        )
      },
      style: {
        display: "flex",
        justifyContent: "flex-start",
        alignItems: "center",
        minWidth: 300,
        maxWidth: 300,
        minHeight: 34,
        borderRadius: 0,
        outline: "0.5px solid #000",
        boxShadow: "none",
        transition: "margin-right 0.4s ease-in-out"
      }
    }}
  >
    {(t) => {
      return <ToastBar toast={t} />;
    }}
  </Toaster>
);
