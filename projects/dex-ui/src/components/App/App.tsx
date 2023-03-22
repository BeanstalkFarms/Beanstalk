import React from "react";
import { Route, Routes } from "react-router-dom";
import { NotFound } from "src/pages/404";
import { Home } from "src/pages/Home";
import { Silo } from "src/pages/Silo";
import { Swap } from "src/pages/Swap";
import { Well } from "src/pages/Well";
import { Wells } from "src/pages/Wells";
import { Frame } from "../Frame/Frame";

export const App = () => {
  return (
    <Frame>
      <Routes>
        <Route index element={<Home />} />
        <Route path="/swap" element={<Swap />} />
        <Route path="/wells" element={<Wells />} />
        <Route path="/wells/:address" element={<Well />} />
        <Route path="/silo" element={<Silo />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Frame>
  );
};
