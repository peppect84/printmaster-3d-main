import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Upload, X } from 'lucide-react'; // Assicurati che questa riga sia uncommentata

const ContactSection = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validazione dimensione file (es. 10MB)
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      if (selectedFile.size > MAX_FILE_SIZE) {
        toast({
          title: 'File troppo grande',
          description: 'La dimensione massima è 10MB',
          variant: 'destructive'
        });
        e.target.value = ''; // Resetta l'input file
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Resetta l'input file HTML
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const data = new FormData();
    data.append('name', formData.name);
    data.append('email', formData.email);
    data.append('message', formData.message);
    if (file) {
      data.append('file', file);
    }

    try {
      // ***** QUI C'E' LA MODIFICA CHIAVE *****
      // Invia alla tua API Route di Express
      const response = await fetch('https://printmaster-3d-main.onrender.com/api/send-email', {
        method: 'POST',
        body: data,
      });

      // Il blocco '};' extra qui sotto è stato rimosso
      // }; // <--- QUESTO ERA L'ERRORE DI SINTASSI CHE HO RIMOSSO

      if (response.ok) {
        toast({
          title: 'Messaggio inviato!',
          description: 'Grazie per averci contattato. Ti risponderemo presto.'
        });
        setFormData({ name: '', email: '', message: '' });
        handleRemoveFile(); // Pulisci il file dopo l'invio
      } else {
        // Tentiamo di leggere la risposta JSON anche in caso di errore
        // Il tuo server Express è stato configurato per inviare JSON in caso di errore
        const errorData = await response.json();
        console.error('Errore invio form:', errorData.message || JSON.stringify(errorData));
        throw new Error(errorData.message || 'Errore sconosciuto dal server');
      }
    } catch (err) {
      console.error('Errore nel catch (rete o parsing JSON):', err);
      toast({
        title: 'Errore',
        description: 'Invio fallito. Riprova o contattaci via email. ' + (err as Error).message,
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Contattaci
            </h2>
            <p className="text-xl text-gray-600">
              Hai un progetto in mente? Richiedi un{' '}
              <strong>preventivo gratuito</strong>
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-6">
                Inizia il Tuo Progetto
              </h3>
              <p className="text-gray-600 mb-8">
                Condividi la tua idea per una consulenza personalizzata.
              </p>

              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="font-semibold">Email</div>
                    <div>tecnolife46@gmail.com</div>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="font-semibold">Telefono</div>
                    <div>+39 392 00 40 650</div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <form
                onSubmit={handleSubmit}
                className="bg-white rounded-2xl p-8 shadow-lg space-y-6"
              >
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Nome e Cognome *
                  </label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Il tuo nome completo"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Email *
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="la-tua-email@esempio.com"
                  />
                </div>

                <div>
                  <label
                    htmlFor="message"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Messaggio *
                  </label>
                  <Textarea
                    id="message"
                    name="message"
                    rows={5}
                    required
                    value={formData.message}
                    onChange={handleInputChange}
                    placeholder="Descrivi il tuo progetto..."
                  />
                </div>

                {/* Sezione per l'upload del file */}
                <div>
                  <label
                    htmlFor="file"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Allega file (opzionale)
                  </label>
                  <div className="relative">
                    <input
                      id="file"
                      name="file"
                      type="file"
                      onChange={handleFileChange}
                      ref={fileInputRef}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.dwg,.step,.stl"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all"
                    />
                    <Upload className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Formati supportati: PDF, DOC, JPG, PNG, DWG, STEP, STL (max 10MB)
                  </p>
                  {file && (
                    <div className="flex items-center justify-between mt-2 px-3 py-2 bg-gray-50 rounded-md">
                      <span className="text-sm text-gray-700 truncate max-w-xs">
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        aria-label="Rimuovi file"
                        className="text-gray-500 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? 'Invio in corso...' : 'Invia Richiesta'}
                </Button>

                <p className="text-sm text-gray-500 text-center">
                  * Campi obbligatori
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;