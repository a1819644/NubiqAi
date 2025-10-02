require('dotenv').config(); // Load .env
import express from 'express';
import cors from 'cors';

import bodyParser from 'body-parser';
import * as admin from 'firebase-admin';
import { GoogleGenAI } from "@google/genai";

// Initialize Firebase Admin SDK
try {
  const serviceAccount = require('./serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin SDK initialized successfully.');
} catch (error) {
  console.warn('Firebase Admin SDK initialization failed. This is expected if serviceAccountKey.json is missing.');
}

const app = express();
const port = 8000;

app.use(cors());
app.use(bodyParser.json());

// Safely initialize Gemini client
let ai: GoogleGenAI | undefined;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    console.log('Gemini API client initialized successfully.');
  } else {
    console.warn('GEMINI_API_KEY not found in .env file. Gemini features will be unavailable.');
  }
} catch (error) {
  console.error("Failed to initialize Gemini API client:", error);
}

// Basic routes
app.get('/api', (req, res) => {
  res.json({ message: 'Hello from the backend!' });
});

app.get('/api/greet', (req, res) => {
  res.json({ message: 'This is a small response.' });
});

app.get('/api/random-todo', async (req, res) => {
  try {
    const response = await fetch('https://jsonplaceholder.typicode.com/todos/1');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching todo:', error);
    res.status(500).json({ message: 'Failed to fetch data' });
  }
});

app.get('/api/firestore-test', async (req, res) => {
  if (!admin.apps.length) return res.status(500).json({ message: 'Firebase not initialized.' });
  try {
    const db = admin.firestore();
    const docRef = db.collection('test-collection').doc('test-doc');
    await docRef.set({ message: 'Hello from the server!', timestamp: admin.firestore.FieldValue.serverTimestamp() });
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ message: 'Test document not found after writing.' });
    res.json({ message: 'Successfully wrote and read from Firestore!', data: doc.data() });
  } catch (error) {
    console.error('Error with Firestore:', error);
    res.status(500).json({ message: 'Failed to interact with Firestore.' });
  }
});

// Gemini AI route

//  to do : we need to handle the response from Gemini properly and add the model thinking reason temprature
app.post('/api/ask-ai', async (req, res) => {
  if (!ai) return res.status(500).json({ error: "Gemini client not initialized" });

  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const response: any = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [prompt],
    });

    // Log everything Gemini returns
    console.log("Full Gemini response:", JSON.stringify(response, null, 2));

    // Temporarily just return the raw response to see the structure
    res.json({ success: true, rawResponse: response });
  } catch (error: any) {
    console.error('Error calling Gemini API:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
