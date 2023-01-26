"use client";

import { useForm } from 'react-hook-form'

interface SearchHexFormData {
  value: string;
}

const SearchHex : React.FC<{ 
  onSubmit: (data: SearchHexFormData) => void;
  placeholder?: string;
}> = ({ 
  onSubmit,
  placeholder = "Search by address..."
}) => {
  const { register, handleSubmit } = useForm<SearchHexFormData>();
  return (
    <div className="bg-black rounded-2xl overflow-hidden">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-row items-center h-12">
        <input type="text" {...register('value')} placeholder={placeholder} className="bg-transparent block flex-1 h-full px-4 rounded-l-2xl text-white" />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 h-full">
          Search
        </button>
      </form>
    </div>
  )
};

export default SearchHex;