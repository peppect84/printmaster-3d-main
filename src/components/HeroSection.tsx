
import { Button } from '@/components/ui/button';

const HeroSection = () => {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="home" className="min-h-screen flex items-center bg-gradient-to-br from-gray-50 to-white pt-20">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 animate-fade-in">
            <h1 className="text-5xl lg:text-6xl font-display font-bold text-gray-900 leading-tight">
              Oggetti <span className="gradient-text">Stampati in 3D</span> di Alta Qualità
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed">
              Realizziamo prodotti unici utilizzando <strong>filamenti di alta qualità e resistenti</strong>, 
              con un approccio artigianale che garantisce precisione e durata in ogni creazione.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={() => scrollToSection('products')}
                size="lg"
                className="bg-primary hover:bg-primary/90 text-white px-8 py-4 text-lg rounded-lg transition-all hover:scale-105"
              >
                Scopri i Prodotti
              </Button>
              <Button
                onClick={() => scrollToSection('contact')}
                variant="outline"
                size="lg"
                className="border-2 border-primary text-primary hover:bg-primary hover:text-white px-8 py-4 text-lg rounded-lg transition-all"
              >
                Richiedi Preventivo
              </Button>
            </div>
          </div>
          
          <div className="relative animate-scale-in">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-blue-600/20 rounded-3xl blur-3xl"></div>
            <img
              src="https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=600&h=400&fit=crop&crop=center"
              alt="Robot stampato in 3D di alta qualità che dimostra la precisione della nostra tecnologia di stampa"
              className="relative rounded-3xl shadow-2xl w-full h-[400px] object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
