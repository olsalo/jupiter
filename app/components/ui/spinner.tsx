import React from "react";
import { cn } from "@coss/ui/lib/utils";
import Icon from "../icons";

// We use React.ComponentProps<typeof Icon> to inherit size, stroke, etc.
// We Omit 'name' because this specific component hardcodes it to "loader"
interface SpinnerProps extends Omit<React.ComponentProps<typeof Icon>, "name"> {
  className?: string;
}

function Spinner({ className, ...props }: SpinnerProps) {
  return (
    <Icon
      name="loader"
      aria-label="Loading"
      className={cn("animate-spin", className)}
      role="status"
      {...props}
    />
  );
}

export { Spinner };