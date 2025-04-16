'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'

function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={`h-5 w-5 animate-spin ${className ?? 'text-primary'}`}
      aria-label="Loading"
      role="img"
    />
  )
}

export { Spinner }
