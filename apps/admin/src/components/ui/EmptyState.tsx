import React from 'react'
import { Box } from 'lucide-react'

interface EmptyStateProps {
  message?: string
}

export function EmptyState({ message = 'No data found.' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-2 p-6">
      <Box className="h-6 w-6" />
      <p>{message}</p>
    </div>
  )
}
