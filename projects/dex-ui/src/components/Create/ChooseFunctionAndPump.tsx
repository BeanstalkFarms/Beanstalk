import React from "react";
import { useCreateWell } from "../CreateWellProvider";
import { Form, useForm } from "react-hook-form";

export const ChooseFunctionAndPump = () => {
  const { setFunctionAndPump } = useCreateWell();

  const form = useForm();

  return <Form {...form}></Form>;
};
