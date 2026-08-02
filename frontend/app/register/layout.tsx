import { SiteHeader } from "../site-header";

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col">
      <SiteHeader showCta={false} />
      {children}
    </div>
  );
}
