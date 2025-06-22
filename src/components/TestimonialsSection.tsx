const TestimonialsSection = () => {
  const testimonials = [
    {
      id: 1,
      name: "Dr. Elena Conti",
      role: "Responsabile R&D, TechSolutions",
      // Modifica qui: usa <strong> invece di **
      content: "Siamo rimasti impressionati dalla <strong>qualità costante e dalla resistenza dei prototipi</strong> che ci avete fornito. I filamenti utilizzati sono davvero di alta gamma e hanno superato i nostri test di stress più rigorosi. Un partner affidabile per lo sviluppo prodotto!",
      rating: 5
    },
    {
      id: 2,
      name: "Luca Ferrara",
      role: "Designer Prodotto Indipendente",
      // Modifica qui: usa <strong> invece di **
      content: "La <strong>precisione è sbalorditiva</strong>. Ho lavorato con diversi fornitori, ma l'attenzione ai dettagli e la fedeltà del prodotto finale al mio design originale sono eccezionali. Il team è stato anche molto disponibile per alcune modifiche last-minute. Ottimo lavoro!",
      rating: 4
    },
    {
      id: 3,
      name: "Martina Russo",
      role: "CEO, InnovaCraft Startup",
      // Modifica qui: usa <strong> invece di **
      content: "Grazie alle stampe 3D di alta qualità, abbiamo potuto presentare un <strong>prototipo visivamente impeccabile</strong> ai nostri investitori, che sono rimasti molto colpiti. Il servizio è stato professionale e i tempi di consegna, seppur con un leggero ritardo su un ordine, sono stati generalmente rispettati. Ci affideremo ancora a voi.",
      rating: 4
    },
    {
      id: 4,
      name: "Giovanni Esposito",
      role: "Architetto Paesaggista",
      // Modifica qui: usa <strong> invece di **
      content: "Ho utilizzato i vostri servizi per modelli architettonici complessi e il risultato è stato <strong>superiore alle aspettative</strong>. La capacità di riprodurre texture e dettagli minuti è sorprendente. Unico piccolo appunto, il costo è un po' più alto della media, ma ne vale la pena per la qualità finale.",
      rating: 4
    },
    {
      id: 5,
      name: "Sara Leone",
      role: "Artigiana Gioielliera",
      // Modifica qui: usa <strong> invece di **
      content: "La possibilità di creare stampi e prototipi con questa precisione ha <strong>rivoluzionato il mio processo creativo</strong>. Ho riscontrato una leggera curva di apprendimento inizale con i file di stampa, ma il supporto clienti è stato eccezionale nell'aiutarmi. Consiglio vivamente per chi cerca alta fedeltà nei dettagli.",
      rating: 5
    }
  ];

  const renderStars = (rating: number) => {
    return [...Array(5)].map((_, i) => (
      <svg
        key={i}
        className={`w-5 h-5 ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ));
  };

  return (
    <section id="testimonials" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 animate-on-scroll">
          <h2 className="text-4xl lg:text-5xl font-display font-bold text-gray-900 mb-6">
            Cosa Dicono i Nostri Clienti
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            La soddisfazione dei nostri clienti è la testimonianza della qualità artigianale
            e dell'affidabilità dei nostri prodotti stampati in 3D.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.id}
              className="bg-gray-50 rounded-2xl p-8 hover:shadow-lg transition-all duration-300 animate-on-scroll"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex mb-4">
                {renderStars(testimonial.rating)}
              </div>

              <blockquote className="text-gray-700 mb-6 leading-relaxed italic">
                {/* Usa dangerouslySetInnerHTML per renderizzare l'HTML */}
                <span dangerouslySetInnerHTML={{ __html: `"${testimonial.content}"` }} />
              </blockquote>

              <div className="border-t pt-4">
                <div className="font-display font-semibold text-gray-900">
                  {testimonial.name}
                </div>
                <div className="text-primary text-sm">
                  {testimonial.role}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;