import React from "react";
import { useTranslation } from "react-i18next"
import { cn } from "@coss/ui/lib/utils";
import Icon from "../icons";

// We use React.ComponentProps<typeof Icon> to inherit size, stroke, etc.
// We Omit 'name' because this specific component hardcodes it to "loader"
interface SpinnerProps extends Omit<React.ComponentProps<typeof Icon>, "name"> {
  className?: string;
}

function Spinner({ className, ...props }: SpinnerProps) {
  const { t } = useTranslation()
  return (
    <Icon
      name="loader"
      aria-label={t("loading")}
      className={cn("animate-spin", className)}
      role="status"
      {...props}
    />
  );
}

export { Spinner };