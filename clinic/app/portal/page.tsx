import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

export default function PortalPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-0">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-2">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-800">Patient Portal</CardTitle>
            <CardDescription>Securely access your medical records</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Email or Username</label>
              <input className="border rounded-lg px-4 py-3 w-full focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" placeholder="Enter your email" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Password</label>
              <input type="password" className="border rounded-lg px-4 py-3 w-full focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" placeholder="Enter your password" />
            </div>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-600">
                <input type="checkbox" className="rounded border-slate-300 text-primary focus:ring-primary" />
                Remember me
              </label>
              <a href="#" className="text-primary hover:underline">Forgot password?</a>
            </div>
            <Button className="w-full bg-primary hover:bg-primary/90 h-12 text-base">Sign In</Button>
            <div className="text-center text-sm text-slate-500 mt-4">
              Don't have an account? <a href="#" className="text-primary font-medium hover:underline">Register now</a>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
