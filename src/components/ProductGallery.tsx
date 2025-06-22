
const ProductGallery = () => {
  const products = [
    {
      id: 1,
      title: "Componenti Tecnologici",
      description: "Parti di ricambio e componenti personalizzati per dispositivi elettronici",
      image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=300&fit=crop&crop=center",
      category: "Tecnologia"
    },
    {
      id: 2,
      title: "Modelli Robotici",
      description: "Robot e automazioni realizzati con filamenti ultra-resistenti",
      image: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=400&h=300&fit=crop&crop=center",
      category: "Robotica"
    },
    {
      id: 3,
      title: "Droni Personalizzati",
      description: "Droni e componenti per volo con strutture ottimizzate",
      image: "https://images.unsplash.com/photo-1487887235947-a955ef187fcc?w=400&h=300&fit=crop&crop=center",
      category: "Aeronautica"
    },
    {
      id: 4,
      title: "Prototipi Industriali",
      description: "Prototipi funzionali per test e sviluppo prodotti",
      image: "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=400&h=300&fit=crop&crop=center",
      category: "Prototipazione"
    },
    {
      id: 5,
      title: "Accessori Design",
      description: "Oggetti di design personalizzabili per casa e ufficio",
      image: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=400&h=300&fit=crop&crop=center",
      category: "Design"
    },
    {
      id: 6,
      title: "Strumenti Professionali",
      description: "Utensili e strumenti su misura per applicazioni specifiche",
      image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop&crop=center",
      category: "Professionale"
    }
  ];

  return (
    <section id="products" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 animate-on-scroll">
          <h2 className="text-4xl lg:text-5xl font-display font-bold text-gray-900 mb-6">
            I Nostri Prodotti
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Ogni oggetto è realizzato con <strong>filamenti di alta qualità</strong> e attenzione artigianale 
            per garantire resistenza, precisione e durata nel tempo.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product, index) => (
            <div
              key={product.id}
              className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 hover:scale-105 animate-on-scroll group"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="relative overflow-hidden">
                <img
                  src={product.image}
                  alt={`${product.title} - Stampa 3D di alta qualità con filamenti resistenti`}
                  className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute top-4 left-4">
                  <span className="bg-primary text-white px-3 py-1 rounded-full text-sm font-medium">
                    {product.category}
                  </span>
                </div>
              </div>
              
              <div className="p-6">
                <h3 className="text-xl font-display font-semibold text-gray-900 mb-3">
                  {product.title}
                </h3>
                <p className="text-gray-600 leading-relaxed mb-4">
                  {product.description}
                </p>
                <div className="flex items-center text-primary hover:text-primary/80 cursor-pointer transition-colors">
                  <span className="font-medium">Scopri di più</span>
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProductGallery;
