import React from "react"

import { cn } from "@/lib/utils"

const Progress = ({ value = 0, className, ...props }) => {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={cn("w-full rounded-md bg-muted h-2 overflow-hidden", className)} {...props}>
      <div
        className="h-full bg-primary"
        style={{ width: `${pct}%`, transition: "width 200ms ease" }}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        role="progressbar"
      />
    </div>
  )
}

export { Progress }

export default Progress
