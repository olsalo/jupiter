"use client";

import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";

export type InputProps = Omit<
  InputPrimitive.Props & React.RefAttributes<HTMLInputElement>,
  "size"
> & {
  size?: "sm" | "default" | "lg" | number;
  unstyled?: boolean;
  nativeInput?: boolean;
};

export function Input({
  autoComplete = "off",
  autoCapitalize,
  autoCorrect,
  inputMode,
  spellCheck,
  className,
  size = "default",
  unstyled = false,
  nativeInput = false,
  style,
  ...props
}: InputProps): React.ReactElement {
  const isEmail = props.type === "email" || inputMode === "email" || autoComplete.split(/\s+/).includes("email")
  const inputClassName = cn(
    "h-8.5 w-full min-w-0 rounded-[inherit] px-[calc(--spacing(3)-1px)] leading-8.5 outline-none placeholder:text-muted-foreground/72 sm:h-7.5 sm:leading-7.5",
    "[color-scheme:light] [--autofill-background:color-mix(in_oklab,var(--foreground)_4%,var(--background))] autofill:caret-foreground autofill:shadow-[inset_0_0_0_1000px_var(--autofill-background)] autofill:[-webkit-text-fill-color:var(--foreground)] dark:[color-scheme:dark] dark:[--autofill-background:color-mix(in_oklab,var(--foreground)_8%,var(--background))]",
    size === "sm" &&
      "h-7.5 px-[calc(--spacing(2.5)-1px)] leading-7.5 sm:h-6.5 sm:leading-6.5",
    size === "lg" && "h-9.5 leading-9.5 sm:h-8.5 sm:leading-8.5",
    props.type === "search" &&
      "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none",
    props.type === "file" &&
      "text-muted-foreground file:me-3 file:bg-transparent file:font-medium file:text-foreground file:text-sm",
  );

  return (
    <span
      className={
        cn(
          unstyled && "rounded-[inherit]",
          !unstyled &&
            "relative inline-flex w-full rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base text-foreground shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-has-disabled:not-has-focus-visible:not-has-[[aria-invalid=true]]:before:shadow-[0_1px_--theme(--color-black/4%)] has-focus-visible:has-[[aria-invalid=true]]:border-destructive/64 has-focus-visible:has-[[aria-invalid=true]]:ring-destructive/16 has-[[aria-invalid=true]]:border-destructive/36 has-focus-visible:border-ring has-autofill:bg-foreground/4 has-disabled:opacity-64 has-[:disabled,:focus-visible,[aria-invalid='true']]:shadow-none has-focus-visible:ring-[3px] sm:text-sm dark:bg-input/32 dark:has-autofill:bg-foreground/8 dark:has-[[aria-invalid=true]]:ring-destructive/24 dark:not-has-disabled:not-has-focus-visible:not-has-[[aria-invalid=true]]:before:shadow-[0_-1px_--theme(--color-white/6%)]",
          className,
        ) || undefined
      }
      data-size={size}
      data-slot="input-control"
    >
      {nativeInput ? (
        <input
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize ?? (isEmail ? "none" : undefined)}
          autoCorrect={autoCorrect ?? (isEmail ? "off" : undefined)}
          inputMode={inputMode ?? (isEmail ? "email" : undefined)}
          spellCheck={spellCheck ?? (isEmail ? false : undefined)}
          className={inputClassName}
          data-slot="input"
          size={typeof size === "number" ? size : undefined}
          style={typeof style === "function" ? undefined : style}
          {...props}
        />
      ) : (
        <InputPrimitive
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize ?? (isEmail ? "none" : undefined)}
          autoCorrect={autoCorrect ?? (isEmail ? "off" : undefined)}
          inputMode={inputMode ?? (isEmail ? "email" : undefined)}
          spellCheck={spellCheck ?? (isEmail ? false : undefined)}
          className={inputClassName}
          data-slot="input"
          size={typeof size === "number" ? size : undefined}
          style={style}
          {...props}
        />
      )}
    </span>
  );
}

export { InputPrimitive };
