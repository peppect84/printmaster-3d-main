
const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <div className="font-display font-bold text-2xl mb-4">
              PrintMaster<span className="text-primary">3D</span>
            <div>di Licciardello G.</div>
            </div>
            <p className="text-gray-400 leading-relaxed mb-4">
              Stampa 3D professionale con filamenti di alta qualità. 
              Trasformiamo le tue idee in realtà con precisione artigianale.
            </p>
            <div className="text-sm text-gray-500">
              © 2024 PrintMaster 3D. Tutti i diritti riservati.
            </div>
          </div>

          <div>
            <h3 className="font-display font-semibold text-lg mb-4">Servizi</h3>
            <ul className="space-y-2 text-gray-400">
              <li>Stampa 3D Professionale</li>
              <li>Prototipazione Rapida</li>
              <li>Prodotti Personalizzati</li>
              <li>Consulenza Tecnica</li>
            </ul>
          </div>

          <div>
            <h3 className="font-display font-semibold text-lg mb-4">Contatti</h3>
            <div className="space-y-2 text-gray-400">
              <div>📧 tecnolife46@gmail.com</div>
              <div>📞 +39 392 00 40 650</div>
              <div>🕒 Lun-Ven: 9:00-12:30 16:00-19:00</div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-500">
          <p>Realizzato con passione per l'innovazione e la qualità artigianale</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
