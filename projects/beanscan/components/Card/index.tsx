const Card : React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <div className="border border-gray-600 bg-zinc-800 rounded-xl p-3">
      {children}
    </div>
  )
}
export default Card;