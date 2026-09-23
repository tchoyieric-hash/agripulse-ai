import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Configuration de Multer pour recevoir l'image en mémoire
const upload = multer({
  storage: multer.memoryStorage()
});

// Initialisation de Supabase
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Route de test
app.get('/', (req: Request, res: Response) => {
  res.json({ status: 'AgriPulse AI Backend est opérationnel 🚀' });
});

// Route principale de diagnostic avec upload d'image
app.post('/api/diagnostics', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const { culture, disease, confidence } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, error: 'Aucune image fournie' });
    }

    // 1. Envoyer l'image vers le bucket Supabase 'plant-images'
    const fileName = `${Date.now()}-${file.originalname}`;
    const { error: uploadError } = await supabase.storage
      .from('plant-images')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (uploadError) throw uploadError;

    // 2. Récupérer l'URL publique de l'image
    const { data: { publicUrl } } = supabase.storage
      .from('plant-images')
      .getPublicUrl(fileName);

    // 3. Insérer les données dans la table 'diagnostics'
    const { data: insertData, error: insertError } = await supabase
      .from('diagnostics')
      .insert([{ culture, disease, confidence: parseFloat(confidence), image_url: publicUrl }]);

    if (insertError) throw insertError;

    res.status(201).json({
      success: true,
      message: 'Diagnostic et image enregistrés avec succès',
      imageUrl: publicUrl,
      data: insertData
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Serveur AgriPulse AI en écoute sur le port ${port}`);
});
 
