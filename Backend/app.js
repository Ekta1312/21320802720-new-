const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const moment = require('moment');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const API_BASE_URL = 'http://20.244.56.144/train';

const companies = [];

app.use(bodyParser.json());

app.post('/register', async (req, res) => {
  try {
    const { companyName, ownerName, rollNo, ownerEmail, accessCode } = req.body;

    const response = await axios.post(`${API_BASE_URL}/register`, {
        companyName:"Ekta_Bansal",
        ownerName: "Ekta",
        rollNo:"21320802720",
        ownerEmail:"ektaaggarwal.bansal@gmail.com",
        accessCode: "sAzlpa",
    });

    const { clientID, clientSecret } = response.data;

    companies.push({
      companyName,
      clientID,
      clientSecret,
    });

    res.status(200).json({
      companyName,
      clientID,
      clientSecret,
    });
  } catch (error) {
    console.error('Company registration failed:', error.message);
    res.status(500).json({ error: 'Company registration failed' });
  }
});

app.post('/authenticate', async (req, res) => {
  try {
    const { companyName, clientID, clientSecret } = req.body;

    const company = companies.find(
      (c) => c.companyName === companyName && c.clientID === clientID && c.clientSecret === clientSecret
    );

    if (!company) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const authResponse = await axios.post(`${API_BASE_URL}/auth`, {
      companyName,
      clientID,
      ownerName ,
      ownerEmail,
      rollNo, 
      clientSecret,
    });

    const { access_token } = authResponse.data;

    company.accessToken = access_token;

    res.status(200).json({ access_token });
  } catch (error) {
    console.error('Authentication failed:', error.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.get('/trains', async (req, res) => {
  try {
    const { companyName, clientID } = req.query;

    const company = companies.find((c) => c.companyName === companyName && c.clientID === clientID);

    if (!company || !company.accessToken) {
      return res.status(401).json({ error: 'Invalid credentials or access token not available' });
    }
    const trainsResponse = await axios.get(`${API_BASE_URL}/trains`, {
      headers: {
        Authorization: `Bearer ${company.accessToken}`,
      },
    });

    const trains = trainsResponse.data;
    const filteredTrains = filterAndSortTrains(trains);

    res.status(200).json(filteredTrains);
  } catch (error) {
    console.error('Fetching train schedules failed:', error.message);
    res.status(500).json({ error: 'Fetching train schedules failed' });
  }
});

const filterAndSortTrains = (trains) => {
  const now = moment();
  const twelveHoursLater = moment().add(12, 'hours');

  //  next 12 hours
  const filteredTrains = trains.filter((train) => {
    const departureTime = moment(train.departureTime, 'HH:mm:ss');
    return departureTime.isAfter(now) && departureTime.isBefore(twelveHoursLater);
  });

  
  filteredTrains.sort((a, b) => {
    if (a.price.sleeper !== b.price.sleeper) {
      return a.price.sleeper - b.price.sleeper;
    }
    if (a.seatsAvailable.sleeper !== b.seatsAvailable.sleeper) {
      return b.seatsAvailable.sleeper - a.seatsAvailable.sleeper;
    }
    const aDepartureTime = moment(a.departureTime, 'HH:mm:ss').add(a.delayedBy, 'minutes');
    const bDepartureTime = moment(b.departureTime, 'HH:mm:ss').add(b.delayedBy, 'minutes');
    return aDepartureTime - bDepartureTime;
  });

  return filteredTrains;
};

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});