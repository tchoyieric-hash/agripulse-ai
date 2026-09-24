import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Configuration de Multer avec limites de sécurité
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo max
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Format de fichier non autorisé (jpeg, png, webp uniquement)'));
    }
    cb(null, true);
  },
});

// Initialisation de Supabase avec la clé secrète (jamais exposée côté client)
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || '';
const supabase = createClient(supabaseUrl, supabaseSecretKey);

// Middleware simple de protection par clé API
function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const key = req.header('x-api-key');
  if (!key || key !== process.env.API_KEY) {
    return res.status(401).json({ success: false, error: 'Clé API invalide ou manquante' });
  }
  next();
}

// Route de test
app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'AgriPulse AI Backend est opérationnel 🚀' });
});

// Route principale de diagnostic avec upload d'image
app.post(
  '/api/diagnostics',
  requireApiKey,
  upload.single('image'),
  async (req: Request, res: Response) => {
    try {
      const { culture, disease, confidence } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ success: false, error: 'Aucune image fournie' });
      }
      if (!culture || !disease || confidence === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Champs requis manquants : culture, disease, confidence',
        });
      }

      const parsedConfidence = parseFloat(confidence);
      if (isNaN(parsedConfidence) || parsedConfidence < 0 || parsedConfidence > 1) {
        return res.status(400).json({
          success: false,
          error: 'confidence doit être un nombre entre 0 et 1',
        });
      }

      // 1. Envoyer l'image vers le bucket Supabase 'plant-images'
      const fileName = `${Date.now()}-${file.originalname}`;
      const { error: uploadError } = await supabase.storage
        .from('plant-images')
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // 2. Récupérer l'URL publique de l'image
      const { data: { publicUrl } } = supabase.storage
        .from('plant-images')
        .getPublicUrl(fileName);

      // 3. Insérer les données dans la table 'diagnostics'
      const { data: insertData, error: insertError } = await supabase
        .from('diagnostics')
        .insert([{ culture, disease, confidence: parsedConfidence, image_url: publicUrl }]);

      if (insertError) throw insertError;

      res.status(201).json({
        success: true,
        message: 'Diagnostic et image enregistrés avec succès',
        imageUrl: publicUrl,
        data: insertData,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// Gestion d'erreur Multer (fichier trop gros, mauvais format)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
  _next();
});

app.listen(port, () => {
  console.log(`Serveur AgriPulse AI en écoute sur le port ${port}`);
});
