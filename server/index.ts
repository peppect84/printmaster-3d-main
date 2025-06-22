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

app.use(cors({
  origin: 'http://localhost:8080',
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

app.options('/api/send-email', cors({
  origin: 'http://localhost:8080',
  methods: ['POST'],
  allowedHeaders: ['Content-Type'],
}));

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
            // <--- MODIFICATO QUI: Non fare 'return reject' qui, ma invia subito la risposta e poi reject
            res.status(400).json({ message: 'File is too large (max 10MB)', error: err.message });
            return; // Interrompi l'esecuzione della callback
          }
          res.status(500).json({ message: 'Error parsing form data', error: err.message });
          return; // Interrompi l'esecuzione della callback
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
      // <--- MODIFICATO QUI: Non fare 'return' per res.status().json()
      res.status(400).json({ message: 'Missing required fields' });
      return; // Interrompi l'esecuzione della funzione
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
          // <--- MODIFICATO QUI: Non fare 'return' per res.status().json()
          res.status(500).json({ message: 'Error processing attachment', error: (readErr as Error).message });
          return; // Interrompi l'esecuzione della funzione
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
    // <--- MODIFICATO QUI: Non fare 'return' per res.status().json()
    res.status(200).json({ message: 'Email sent successfully!' });

  } catch (error) {
    console.error('Errore generale nel server API:', error);
    const tempFile = (error as any)?.file;
    if (tempFile && tempFile.filepath) {
      fs.unlink(tempFile.filepath, (unlinkErr) => {
        if (unlinkErr) console.error('Errore durante l\'eliminazione del file temporaneo in caso di errore:', unlinkErr);
      });
    }
    // <--- MODIFICATO QUI: Non fare 'return' per res.status().json()
    res.status(500).json({ message: 'Error sending email', error: (error as Error).message });
  }
};

app.post('/api/send-email', sendEmailHandler);

app.listen(port, () => {
  console.log(`Server API listening on port ${port}`);
});