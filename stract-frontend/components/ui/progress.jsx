"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "@base-ui/react/progress"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  ...props
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-secondary dark:bg-muted", className)}
      {...props}
    >
      <ProgressPrimitive.Track className="h-full w-full flex-1 bg-secondary dark:bg-muted">
        <ProgressPrimitive.Indicator
          className="h-full w-full flex-1 bg-primary transition-all duration-300 ease-in-out"
          style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  )
}

export { Progress }
