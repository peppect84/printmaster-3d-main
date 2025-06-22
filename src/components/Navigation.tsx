
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

const Navigation = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
      isScrolled ? 'bg-white/95 backdrop-blur-md shadow-lg' : 'bg-transparent'
    }`}>
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="font-display font-bold text-2xl text-gray-900">
            PrintMaster<span className="text-primary">3D</span>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <button
              onClick={() => scrollToSection('home')}
              className="text-gray-600 hover:text-primary transition-colors"
            >
              Home
            </button>
            <button
              onClick={() => scrollToSection('about')}
              className="text-gray-600 hover:text-primary transition-colors"
            >
              Chi Siamo
            </button>
            <button
              onClick={() => scrollToSection('products')}
              className="text-gray-600 hover:text-primary transition-colors"
            >
              Prodotti
            </button>
            <button
              onClick={() => scrollToSection('testimonials')}
              className="text-gray-600 hover:text-primary transition-colors"
            >
              Testimonianze
            </button>
          </div>

          <Button
            onClick={() => scrollToSection('contact')}
            className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Contattaci
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
