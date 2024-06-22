require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const redis= require('redis');
// const {nanoid} = await import('nanoid');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const bodyParser = require('body-parser');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());

app.use(express.json());

app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

//Redis connection
const client = redis.createClient({
  password:  process.env.REDIS_PASSWORD,
  socket:{
    host: process.env.REDIS_HOST,
    port: 19121
  }

});

(async () => {
  try {
    await client.connect();
    console.log('Redis client connected');
  } catch (err) {
    console.error('Error connecting to Redis', err);
  }
})();


const limiter = rateLimit({
  windowMs: 15*60*1000,
  max: 100
});

app.use(limiter);

const cache = new Map();
//post url for short
app.post("/api/shorturl", async (req, res) => {
  let url;
  
  // Check if the request is JSON or form-encoded
  if (req.is('json')) {
    url = req.body.url;
  } else if (req.is('urlencoded')) {
    url = req.body.url;
  } else {
    return res.status(400).json({ error: "Unsupported content type" });
  }


  
  if (!url || !validator.isURL(url)) {
    return res.status(400).json({ error: "invalid url" });
  }

  const id = generateShortCode();
  await client.set(id, url);

  // const shortUrl = `${req.protocol}://${req.get('host')}/api/shorturl/${id}`;
  const short_url = id;
  const original_url = url;
  res.json({ original_url, short_url });
});

app.get("/api/shorturl/:id", async (req, res) => {
  const { id } = req.params;

  if (cache.has(id)) {
    return res.redirect(cache.get(id));
  }

  const url = await client.get(id);

  

  if (url) {
    cache.set(id, url);
    setTimeout(() => cache.delete(id), 5 * 60 * 1000);
    // res.json({url});
    res.redirect(url);
  } else {
    res.status(404).send('Not found')
  }
});

// Function to generate a unique short code
function generateShortCode() {
  // Implement your own logic here (e.g., base62 encoding, random string generation)
  // Example: Generating a random 6-character code
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let shortCode = '';
  for (let i = 0; i < 6; i++) {
    shortCode += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return shortCode;
}




app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
