import React from 'react'

// Minimal placeholder Select components used by pages.
export const Select = ({ children, ...props }) => <div {...props}>{children}</div>

export const SelectTrigger = React.forwardRef(({ children, ...props }, ref) => (
  <button ref={ref} {...props}>{children}</button>
))
SelectTrigger.displayName = 'SelectTrigger'

export const SelectContent = ({ children, ...props }) => <div {...props}>{children}</div>

export const SelectItem = React.forwardRef(({ children, value, ...props }, ref) => (
  <div ref={ref} role="option" data-value={value} {...props}>{children}</div>
))
SelectItem.displayName = 'SelectItem'

export const SelectValue = ({ children }) => <span>{children}</span>

export default Select
