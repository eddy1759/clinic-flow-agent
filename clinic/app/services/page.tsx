import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stethoscope, Heart, Brain, Baby, Eye, Bone } from "lucide-react";

export default function ServicesPage() {
  const services = [
    { name: "General Practice", icon: Stethoscope, desc: "Comprehensive care for all ages." },
    { name: "Cardiology", icon: Heart, desc: "Expert heart health and diagnostics." },
    { name: "Neurology", icon: Brain, desc: "Advanced care for brain and nervous system." },
    { name: "Pediatrics", icon: Baby, desc: "Specialized care for infants and children." },
    { name: "Ophthalmology", icon: Eye, desc: "Complete eye care and surgery." },
    { name: "Orthopedics", icon: Bone, desc: "Bone, joint, and muscle health." },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-800 mb-4">Our Medical Services</h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            We offer a wide range of specialized medical services to ensure the best health outcomes for you and your family.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, i) => (
            <Card key={i} className="hover:shadow-lg transition-shadow border-slate-200">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                  <service.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl text-slate-800">{service.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-500">{service.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
