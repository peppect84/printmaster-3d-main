
const AboutSection = () => {
  return (
    <section id="about" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 animate-on-scroll">
            <h2 className="text-4xl lg:text-5xl font-display font-bold text-gray-900 mb-6">
              Chi Siamo
            </h2>
            <p className="text-xl text-gray-600 leading-relaxed">
              La passione per l'innovazione incontra la qualità artigianale
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-on-scroll">
              <img
                src="https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=400&fit=crop&crop=center"
                alt="Tecnologia avanzata di stampa 3D con circuiti di precisione"
                className="rounded-2xl shadow-xl w-full h-[400px] object-cover"
              />
            </div>

            <div className="space-y-6 animate-on-scroll">
              <h3 className="text-2xl font-display font-semibold text-gray-900">
                Qualità e Precisione in Ogni Dettaglio
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Siamo specialisti nella <strong>stampa 3D di alta qualità</strong>, utilizzando esclusivamente 
                <strong> filamenti resistenti e certificati</strong> per garantire prodotti durevoli nel tempo.
              </p>
              <p className="text-gray-600 leading-relaxed">
                La nostra esperienza artigianale si combina con tecnologie all'avanguardia per creare 
                oggetti unici, personalizzabili e perfetti per ogni esigenza.
              </p>
              
              <div className="grid grid-cols-2 gap-6 pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-2">5+</div>
                  <div className="text-gray-600">Anni di Esperienza</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-2">1000+</div>
                  <div className="text-gray-600">Prodotti Realizzati</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
