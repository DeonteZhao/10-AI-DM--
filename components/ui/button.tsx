import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  "riso-action inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none text-sm font-bold tracking-[0.08em] text-[var(--ink-color)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none aria-invalid:border-destructive aria-invalid:shadow-[0_0_0_2px_var(--paper-light),4px_4px_0_var(--destructive)]",
  {
    variants: {
      variant: {
        default: "bg-[var(--paper-light)] text-[var(--ink-color)]",
        destructive:
          "border-[var(--accent-color)] bg-[var(--accent-color)] text-[var(--paper-light)] hover:text-[var(--paper-light)] hover:shadow-[4px_4px_0_var(--ink-color)]",
        outline:
          "bg-transparent shadow-none hover:bg-[var(--highlight-color)]",
        secondary:
          "bg-theme-bg text-[var(--ink-color)]",
        ghost:
          "border-transparent bg-transparent shadow-none hover:bg-[var(--highlight-color)] hover:text-[var(--accent-color)]",
        link: "border-transparent bg-transparent px-0 py-0 shadow-none underline-offset-4 hover:text-[var(--accent-color)] hover:underline",
      },
      size: {
        default: "min-h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "min-h-9 gap-1.5 px-3 py-1.5 has-[>svg]:px-2.5",
        lg: "min-h-11 px-6 py-3 has-[>svg]:px-4",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
