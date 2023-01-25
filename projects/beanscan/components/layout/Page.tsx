import React from "react";

const Page : React.FC<{
  children: React.ReactNode;
  rightHeader?: React.ReactNode;
}> = ({
  children,
  rightHeader
}) => {
  return (
    <div className="bg-gray-900 h-screen text-white flex flex-col">
      <div className="px-2 py-2 border-b border-gray-800 w-full flex flex-row items-center justify-between">
        <div>Beanstalk</div>
        <div className="flex flex-row items-center space-x-1 cursor">
          {rightHeader}
        </div>
      </div>
      <div className="h-full overflow-scroll flex flex-row space-x-4 p-4">
        {children}
      </div>
      <div className="px-2 py-2 border-t text-sm text-gray-600 border-gray-800 w-full">
        Connected to {process.env.NEXT_PUBLIC_RPC_URL || 'unknown'} ({process.env.NEXT_PUBLIC_CHAIN_ID || '?'})
      </div>
    </div>
  )
}

export default Page;