import * as React from "react";

import { cn } from "./utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "riso-field file:text-foreground placeholder:text-[var(--ink-color)] placeholder:opacity-45 selection:bg-[var(--accent-color)] selection:text-[var(--paper-light)] flex min-h-10 w-full min-w-0 rounded-none px-3 py-2 text-base font-semibold tracking-[0.04em] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "aria-invalid:border-destructive aria-invalid:shadow-[0_0_0_2px_var(--paper-light),4px_4px_0_var(--destructive)]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
