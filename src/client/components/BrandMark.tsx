import { cn } from "cn";

/**
 * The Quiet Coyote hand mark. The dark variant is cream so the mark stays
 * visible on the pine-black dark theme.
 */
export function BrandMark({
  className,
  alt = "",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <>
      <img
        src="/transparent-logo.png"
        alt={alt}
        className={cn("dark:hidden", className)}
      />
      <img
        src="/transparent-logo-dark.png"
        alt={alt}
        className={cn("hidden dark:block", className)}
      />
    </>
  );
}
