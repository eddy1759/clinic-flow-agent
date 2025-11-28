import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DoctorsPage() {
  const doctors = [
    { name: "Dr. Sarah Smith", specialty: "Cardiologist", exp: "15 Years Experience" },
    { name: "Dr. James Wilson", specialty: "Neurologist", exp: "12 Years Experience" },
    { name: "Dr. Emily Chen", specialty: "Pediatrician", exp: "8 Years Experience" },
    { name: "Dr. Michael Brown", specialty: "Orthopedic Surgeon", exp: "20 Years Experience" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-800 mb-4">Meet Our Specialists</h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Our team of experienced doctors is dedicated to providing compassionate and top-quality care.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {doctors.map((doc, i) => (
            <Card key={i} className="hover:shadow-lg transition-shadow border-slate-200 overflow-hidden">
              <div className="h-48 bg-slate-200 w-full flex items-center justify-center text-slate-400">
                {/* Placeholder for Doctor Image */}
                <span className="text-4xl">👨‍⚕️</span>
              </div>
              <CardHeader className="text-center">
                <CardTitle className="text-lg text-slate-800">{doc.name}</CardTitle>
                <p className="text-primary font-medium text-sm">{doc.specialty}</p>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-slate-500 text-sm mb-4">{doc.exp}</p>
                <Button variant="outline" className="w-full border-primary/20 text-primary hover:bg-primary hover:text-white">
                  View Profile
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
