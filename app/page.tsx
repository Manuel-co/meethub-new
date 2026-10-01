import Nav from "@/components/Sections/Nav";
import Hero from "@/components/Sections/Hero";
import Works from "@/components/Sections/Works";
import Features from "@/components/Sections/Features";
import Testimonials from "@/components/Sections/Testimonials";
import Fqa from "@/components/Sections/Fqa";
import Footer from "@/components/Sections/Footer";

export default function Home() {
  return (
    <main className="flex flex-col min-h-screen">
      <Nav />
      <Hero />
      <Works />
      <Features />
      <Testimonials />
      <Fqa />
      <Footer />
    </main>
  );
}
