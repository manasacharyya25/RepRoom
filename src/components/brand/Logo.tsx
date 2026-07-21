import Image from "next/image";
import Link from "next/link";

const LOGO_SRC = "/logo.png";
const BRAND_NAME_SRC = "/brand-name.png";

type BrandMarkProps = {
  className?: string;
  size?: number;
};

export function BrandMark({ className, size = 34 }: BrandMarkProps) {
  return (
    <Image
      alt=""
      aria-hidden
      className={className ? `landing-logo-mark ${className}` : "landing-logo-mark"}
      height={size}
      priority
      src={LOGO_SRC}
      width={size}
    />
  );
}

type BrandNameProps = {
  className?: string;
  /** Rendered height in CSS pixels; width scales from the asset aspect. */
  height?: number;
};

export function BrandName({ className, height = 28 }: BrandNameProps) {
  // brand-name.png is 776×322 (~2.41:1), including the tagline.
  const width = Math.round(height * (776 / 322));
  return (
    <Image
      alt="RhoQ"
      className={className ? `landing-logo-wordmark ${className}` : "landing-logo-wordmark"}
      height={height}
      priority
      src={BRAND_NAME_SRC}
      width={width}
    />
  );
}

type LogoProps = {
  href?: string;
  /** When false, only the RhoQ wordmark is shown (no RQ mark). */
  showMark?: boolean;
};

export function Logo({ href = "/" }: LogoProps) {
  return (
    <Link className="landing-logo" href={href} aria-label="RhoQ home">
      <BrandName height={36} />
    </Link>
  );
}
