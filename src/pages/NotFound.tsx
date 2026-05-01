import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NexusLogo } from "@/components/brand/NexusLogo";

const NotFound = () => (
  <div className="min-h-screen flex items-center justify-center bg-background p-6">
    <div className="text-center max-w-md">
      <NexusLogo size="lg" href="" />
      <p className="font-display text-[140px] leading-none font-bold text-gradient-primary mt-8">404</p>
      <h1 className="font-display text-2xl font-bold mb-3">Page not found</h1>
      <p className="text-foreground-dim mb-8">The page you're looking for doesn't exist or has been moved.</p>
      <Button asChild className="rounded-full bg-primary hover:bg-primary-glow shadow-glow">
        <Link to="/"><ArrowLeft className="w-4 h-4 mr-2" /> Back home</Link>
      </Button>
    </div>
  </div>
);

export default NotFound;
