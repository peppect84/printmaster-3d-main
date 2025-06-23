// server/index.ts
import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import formidable from 'formidable';
import nodemailer from 'nodemailer';
import fs from 'fs';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config({ path: '../.env.local' });

const app = express();
const port = process.env.PORT || 5000;

// *** INIZIO MODIFICA CORS EFFETTUATA ***
const allowedOrigins = [
  'http://localhost:8080', // Per lo sviluppo locale se usi questa porta
  'http://localhost:5173', // Per lo sviluppo locale se usi questa porta Vite
  'https://printmaster3d.netlify.app' // Il tuo dominio Netlify reale
];

app.use(cors({
  origin: function (origin, callback) {
    // Permetti richieste senza origin (es. curl, postman, app native)
    if (!origin) return callback(null, true);
    // Permetti solo gli origin specificati
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}.`;
      console.error(msg); // Logga questo errore per debug su Render
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Includi OPTIONS per le preflight requests di CORS
  allowedHeaders: ['Content-Type', 'Authorization'], // Specifica gli header che il tuo frontend potrebbe inviare
  credentials: true // Necessario se usi cookie o sessioni (anche se qui non strettamente richiesto)
}));

// La riga app.options separata non è più necessaria con la configurazione app.use(cors) sopra
// che include i metodi 'OPTIONS'. Quindi questa riga è stata rimossa/ignorata.
// *** FINE MODIFICA CORS EFFETTUATA ***


interface FormidableRequest extends Request {
  fields?: formidable.Fields;
  files?: formidable.Files;
}

const sendEmailHandler: RequestHandler = async (req: FormidableRequest, res: Response) => {
  try {
    const data: { fields: formidable.Fields; files: formidable.Files } = await new Promise((resolve, reject) => {
      const uploadDir = './temp_uploads';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir);
      }

      const form = formidable({
        multiples: false,
        maxFileSize: 10 * 1024 * 1024,
        uploadDir: uploadDir,
        keepExtensions: true,
      });

      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error('Formidable parse error:', err);
          if (err.code === formidable.errors.biggerThanMaxFileSize) {
            res.status(400).json({ message: 'File is too large (max 10MB)', error: err.message });
          } else {
            res.status(500).json({ message: 'Error parsing form data', error: err.message });
          }
          return;
        }
        resolve({ fields, files });
      });
    });

    const name = Array.isArray(data.fields.name) ? data.fields.name[0] : String(data.fields.name || '');
    const email = Array.isArray(data.fields.email) ? data.fields.email[0] : String(data.fields.email || '');
    const message = Array.isArray(data.fields.message) ? data.fields.message[0] : String(data.fields.message || '');

    const file = Array.isArray(data.files.file)
                   ? data.files.file[0]
                   : (data.files.file !== undefined ? data.files.file as formidable.File : null);


    if (!name || !email || !message) {
      res.status(400).json({ message: 'Missing required fields' });
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    let attachments = [];
    if (file) {
      try {
          const filePath = file.filepath;
          if (!fs.existsSync(filePath)) {
            throw new Error(`File not found at ${filePath}`);
          }
          const fileContent = fs.readFileSync(filePath);
          attachments.push({
              filename: file.originalFilename || 'attachment',
              content: fileContent,
              contentType: file.mimetype || 'application/octet-stream',
          });
      } catch (readErr) {
          console.error('Error reading temporary file:', readErr);
          if (file) {
            fs.unlink(file.filepath, (err) => {
              if (err) console.error('Errore durante l\'eliminazione del file temporaneo dopo errore lettura:', err);
            });
          }
          res.status(500).json({ message: 'Error processing attachment', error: (readErr as Error).message });
          return;
      }
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'tecnolife46@gmail.com',
      replyTo: email,
      subject: `Nuova richiesta da ${name} - PrintMaster 3D`,
      html: `
        <p><strong>Nome:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Messaggio:</strong></p>
        <p>${message}</p>
      `,
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    await transporter.sendMail(mailOptions);
    if (file) {
      fs.unlink(file.filepath, (err) => {
        if (err) console.error('Errore durante l\'eliminazione del file temporaneo:', err);
      });
    }
    res.status(200).json({ message: 'Email sent successfully!' });

  } catch (error) {
    console.error('Errore generale nel server API:', error);
    const tempFile = (error as any)?.file;
    if (tempFile && tempFile.filepath) {
      fs.unlink(tempFile.filepath, (unlinkErr) => {
        if (unlinkErr) console.error('Errore durante l\'eliminazione del file temporaneo in caso di errore:', unlinkErr);
      });
    }
    res.status(500).json({ message: 'Error sending email', error: (error as Error).message });
  }
};

app.post('/api/send-email', sendEmailHandler);

app.listen(port, () => {
  console.log(`Server API listening on port ${port}`);
});