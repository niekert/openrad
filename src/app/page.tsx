import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import Modalities from "@/components/landing/Modalities";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";
import Formats from "@/components/landing/Formats";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <Header />
      <main>
        <Hero />
        <Modalities />
        <HowItWorks />
        <Features />
        <Formats />
      </main>
      <Footer />
    </div>
  );
}
