import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Mail, Clock } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-800 mb-4">Contact Us</h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            We are here to help. Reach out to us for appointments, inquiries, or emergencies.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
          {/* Contact Info */}
          <div className="space-y-6">
             <Card className="border-slate-200 shadow-sm">
               <CardContent className="p-6 flex items-start gap-4">
                 <div className="bg-primary/10 p-3 rounded-lg">
                   <MapPin className="h-6 w-6 text-primary" />
                 </div>
                 <div>
                   <h3 className="font-semibold text-slate-800 mb-1">Our Location</h3>
                   <p className="text-slate-600">123 Health Avenue, Medical District<br/>Cityville, ST 12345</p>
                 </div>
               </CardContent>
             </Card>

             <Card className="border-slate-200 shadow-sm">
               <CardContent className="p-6 flex items-start gap-4">
                 <div className="bg-primary/10 p-3 rounded-lg">
                   <Phone className="h-6 w-6 text-primary" />
                 </div>
                 <div>
                   <h3 className="font-semibold text-slate-800 mb-1">Phone Numbers</h3>
                   <p className="text-slate-600">Main: (555) 123-4567</p>
                   <p className="text-slate-600">Emergency: (555) 911-0000</p>
                 </div>
               </CardContent>
             </Card>

             <Card className="border-slate-200 shadow-sm">
               <CardContent className="p-6 flex items-start gap-4">
                 <div className="bg-primary/10 p-3 rounded-lg">
                   <Mail className="h-6 w-6 text-primary" />
                 </div>
                 <div>
                   <h3 className="font-semibold text-slate-800 mb-1">Email</h3>
                   <p className="text-slate-600">info@cityhealthclinic.com</p>
                   <p className="text-slate-600">appointments@cityhealthclinic.com</p>
                 </div>
               </CardContent>
             </Card>
             
             <Card className="border-slate-200 shadow-sm">
               <CardContent className="p-6 flex items-start gap-4">
                 <div className="bg-primary/10 p-3 rounded-lg">
                   <Clock className="h-6 w-6 text-primary" />
                 </div>
                 <div>
                   <h3 className="font-semibold text-slate-800 mb-1">Working Hours</h3>
                   <p className="text-slate-600">Mon - Fri: 8:00 AM - 8:00 PM</p>
                   <p className="text-slate-600">Sat - Sun: 9:00 AM - 5:00 PM</p>
                 </div>
               </CardContent>
             </Card>
          </div>

          {/* Contact Form */}
          <Card className="border-slate-200 shadow-lg">
            <CardHeader>
              <CardTitle>Send us a Message</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input className="border rounded-lg px-4 py-2 w-full" placeholder="First Name" />
                <input className="border rounded-lg px-4 py-2 w-full" placeholder="Last Name" />
              </div>
              <input className="border rounded-lg px-4 py-2 w-full" placeholder="Email Address" />
              <input className="border rounded-lg px-4 py-2 w-full" placeholder="Subject" />
              <textarea className="border rounded-lg px-4 py-2 w-full h-32" placeholder="Your Message"></textarea>
              <Button className="w-full bg-primary hover:bg-primary/90">Send Message</Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
