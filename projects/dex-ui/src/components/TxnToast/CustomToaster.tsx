import React, { useEffect, useState } from "react";
import { ToastBar, Toaster } from "react-hot-toast";
import { Error, Success } from "../Icons";
import { size } from "src/breakpoints";

function useMedia(query: string) {
  const [matches, setMatches] = useState(window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    media.addListener(listener);
    return () => media.removeListener(listener);
  }, [query, matches]);

  return matches;
}

export default function CustomToaster() {
  const mobile = useMedia(`(max-width: ${size.mobile})`);

  return (
    <Toaster
      containerStyle={!mobile ? { position: "fixed", top: 136, right: 24 } : {}}
      toastOptions={{
        duration: 4000,
        position: mobile ? "bottom-center" : "top-right",
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
          minWidth: mobile ? "calc(100% - 12px)" : 300,
          maxWidth: mobile ? "calc(100% - 12px)" : 300,
          marginBottom: mobile ? 48 : 0,
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
}
