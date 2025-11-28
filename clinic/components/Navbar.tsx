import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";

export function Navbar() {
  return (
    <header className="bg-white border-b px-8 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
      <Link href="/" className="flex items-center gap-2 group">
        <div className="bg-primary p-2 rounded-lg group-hover:bg-primary/90 transition-colors">
          <Activity className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-bold text-slate-800 tracking-tight group-hover:text-primary transition-colors">City Health Clinic</span>
      </Link>
      
      <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
        <Link href="/" className="hover:text-primary transition-colors">Home</Link>
        <Link href="/services" className="hover:text-primary transition-colors">Services</Link>
        <Link href="/doctors" className="hover:text-primary transition-colors">Doctors</Link>
        <Link href="/contact" className="hover:text-primary transition-colors">Contact</Link>
      </nav>
      
      <div className="flex items-center gap-4">
         <Link href="/portal">
           <Button variant="outline" className="rounded-full border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-primary hover:border-primary/20">
             Patient Portal
           </Button>
         </Link>
      </div>
    </header>
  );
}
