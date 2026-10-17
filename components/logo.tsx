import Image from "next/image";
import { cn } from "cn";
import horizontal from "./brand/logo-horizontal.png";
import mark from "./brand/logo-mark.png";
import stacked from "./brand/logo-stacked.png";

const ALT = "MaidCare Cleaning Service";

// The company logo. "horizontal" (house + wordmark side by side) for the
// header, "stacked" (wordmark under the house) for the sign-in page. With
// `compact`, phones get just the house so the header fits.
export function Logo({
  variant = "horizontal",
  compact = false,
  className,
}: {
  variant?: "horizontal" | "stacked";
  compact?: boolean;
  className?: string;
}) {
  if (variant === "stacked") {
    return <Image src={stacked} alt={ALT} preload className={cn("h-auto w-56", className)} />;
  }
  return (
    <span className={cn("inline-flex shrink-0 items-center", className)}>
      <Image
        src={horizontal}
        alt={ALT}
        preload
        className={cn("h-13 w-auto max-w-none", compact && "max-sm:hidden")}
      />
      {compact && <Image src={mark} alt={ALT} preload className="h-10 w-auto max-w-none sm:hidden" />}
    </span>
  );
}
