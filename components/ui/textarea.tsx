import * as React from "react";

import { cn } from "./utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "riso-field resize-none placeholder:text-[var(--ink-color)] placeholder:opacity-45 flex field-sizing-content min-h-16 w-full rounded-none px-3 py-2 text-base font-semibold tracking-[0.04em] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "aria-invalid:border-destructive aria-invalid:shadow-[0_0_0_2px_var(--paper-light),4px_4px_0_var(--destructive)]",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
