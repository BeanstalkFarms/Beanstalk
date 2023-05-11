import React, { useEffect, useMemo, useState } from "react";
import { Location, Route, Routes, useLocation } from "react-router-dom";
import { NotFound } from "src/pages/404";
import { Home } from "src/pages/Home";
import { Dev } from "src/pages/Dev";
import { SwapPage } from "src/pages/Swap";
import { Well } from "src/pages/Well";
import { Wells } from "src/pages/Wells";
import { Frame } from "src/components/Frame/Frame";
import { Build } from "src/pages/Build";

export const App = ({}) => {
  const [prevLocation, setPrevLocation] = useState<Location>();
  const [curLocation, setCurLocation] = useState<Location>();
  const location = useLocation();
  useEffect(() => {
    if (curLocation! !== location) {
      setCurLocation(location);
    }
    if (prevLocation! !== curLocation) {
      setPrevLocation(curLocation);
    }
  }, [location]);
  // console.log("loc", location?.pathname, "cur: ", curLocation?.pathname, "prev ", prevLocation?.pathname);
  // console.log(location);
  const routes = useMemo<Record<string, JSX.Element>>(() => {
    return {
      "/wells": <Wells />,
      "/build": <Build />,
      "/swap": <SwapPage />
    };
  }, []);
  return (
    <Frame routes={routes}>
      {/* <Routes>
        <Route index element={<Home />} />
        <Route path="/wells" element={<Wells />} />
        <Route path="/wells/:address" element={<Well />} />
        <Route path="/build" element={<Build />} />
        <Route path="/swap" element={<SwapPage />} />
        <Route path="/dev" element={<Dev />} />
        <Route path="*" element={<NotFound />} />
      </Routes> */}
    </Frame>
  );
};
