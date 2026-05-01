import { Link } from "react-router-dom";
import { NexusLogo } from "@/components/brand/NexusLogo";

const cols = [
  {
    title: "Platform",
    links: [
      { to: "/about", label: "About" },
      { to: "/success-stories", label: "Success stories" },
      { to: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Account",
    links: [
      { to: "/login", label: "Sign in" },
      { to: "/signup", label: "Create account" },
      { to: "/forgot-password", label: "Forgot password" },
    ],
  },
  {
    title: "Legal",
    links: [
      { to: "/privacy", label: "Privacy" },
      { to: "/terms", label: "Terms" },
      { to: "/refund-policy", label: "Refund policy" },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="relative border-t border-border/50 bg-background-elevated/30">
      <div className="container py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          <div className="col-span-2 md:col-span-1">
            <NexusLogo />
            <p className="mt-4 text-sm text-foreground-muted max-w-xs">
              Cinematic HSC learning. Physics, Chemistry & Higher Math — taught right.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="text-sm font-semibold text-foreground mb-4">{c.title}</h4>
              <ul className="space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="text-sm text-foreground-muted hover:text-foreground transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-6 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-foreground-muted">© {new Date().getFullYear()} NexusEdu. All rights reserved.</p>
          <p className="text-xs text-foreground-muted font-bangla">তোমার শিক্ষার নতুন দিগন্ত</p>
        </div>
      </div>
    </footer>
  );
}
