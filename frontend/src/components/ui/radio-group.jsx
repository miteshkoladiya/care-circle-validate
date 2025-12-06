import React from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"

import { cn } from "@/lib/utils"

const RadioGroup = React.forwardRef(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root
    ref={ref}
    className={cn("flex items-center gap-2", className)}
    {...props}
  />
))
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName || "RadioGroup"

const RadioGroupItem = React.forwardRef(({ className, children, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      "inline-flex h-5 w-5 items-center justify-center rounded-full border border-input bg-background text-current focus:outline-none focus:ring-2 focus:ring-ring",
      className
    )}
    {...props}
  >
    <RadioGroupPrimitive.Indicator className={cn("h-2.5 w-2.5 rounded-full bg-primary")}>{/* visual indicator */}</RadioGroupPrimitive.Indicator>
  </RadioGroupPrimitive.Item>
))
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName || "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
