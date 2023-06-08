import React from "react";
import { ToastBar, Toaster, resolveValue } from "react-hot-toast";
import { FC } from "src/types";
import { Error, Success } from "../Icons";

export const CustomToaster: FC<{}> = () => (
  <Toaster
    containerStyle={{
      // TODO: these need to be adjusted for mobile, also this is strange
      position: "relative",
      top: 48,
      left: -48
    }}
    toastOptions={{
      duration: 4000,
      position: "top-right",
      iconTheme: {
        primary: "white",
        secondary: "black"
      },
      loading: {
        duration: Infinity,
      },
      success: {
        duration: Infinity,
        icon: <Success color="#46b955" width={16}/>
      },
      error: {
        duration: Infinity,
        icon: null
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
        transition: "margin-right 0.4s ease-in-out",
        animation: "none"
      }
    }}
  >
    {(t) => {
      return (
        <ToastBar
          toast={t}
          style={{
            marginRight: t.visible ? 0 : -500
          }}
        />
      );
    }}
  </Toaster>
);
