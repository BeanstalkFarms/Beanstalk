"use client"

export default function InspectWellAddressError({
  error,
  reset
} : { error: Error, reset: () => void }) {
  return (
    <div>
      {error.message}
    </div>
  )
}
