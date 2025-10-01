import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

const app = express();
const port = 8000;

app.use(cors());
app.use(bodyParser.json());

app.get('/api', (req, res) => {
  res.json({ message: 'Hello from the backend!' });
});

app.get('/api/greet', (req, res) => {
  res.json({ message: 'This is a small response.' });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
