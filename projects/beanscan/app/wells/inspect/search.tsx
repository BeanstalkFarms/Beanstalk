"use client";

import SearchHex from "components/SearchHex"
import { useRouter } from "next/navigation"

const Search : React.FC = () => {
  const router = useRouter();
  return (
    <SearchHex onSubmit={(data) => router.push(`/wells/inspect/${data.value}`)} />
  );
}

export default Search;