const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const moment = require('moment');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const API_BASE_URL = 'http://20.244.56.144/train';

//Array company data aur access token store krne k lie
const companies = [];

app.use(bodyParser.json());

// API endpoint- register kia company ko
app.post('/register', async (req, res) => {
  try {
    const { companyName, ownerName, rollNo, ownerEmail, accessCode } = req.body;

    // Post req gayi server se main API ko
    const response = await axios.post(`${API_BASE_URL}/register`, {
      companyName,
      ownerName,
      rollNo,
      ownerEmail,
      accessCode,
    });

    const { clientID, clientSecret } = response.data;

    // save krlia company array mein
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

// API endpoint auth k lie
app.post('/authenticate', async (req, res) => {
  try {
    const { companyName, clientID, clientSecret } = req.body;

    // Find the company in the database
    const company = companies.find(
      (c) => c.companyName === companyName && c.clientID === clientID && c.clientSecret === clientSecret
    );

    if (!company) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // vaid credentials pe post req krdi 
    const authResponse = await axios.post(`${API_BASE_URL}/auth`, {
      companyName,
      clientID,
      ownerName ,
      ownerEmail,
      rollNo, 
      clientSecret,
    });

    const { access_token } = authResponse.data;

    // Save the access token in the company's record
    company.accessToken = access_token;

    res.status(200).json({ access_token });
  } catch (error) {
    console.error('Authentication failed:', error.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// API endpoint to fetch train schedules from John Doe Railway API
app.get('/trains', async (req, res) => {
  try {
    const { companyName, clientID } = req.query;

    // Find the company in the database
    const company = companies.find((c) => c.companyName === companyName && c.clientID === clientID);

    if (!company || !company.accessToken) {
      return res.status(401).json({ error: 'Invalid credentials or access token not available' });
    }

    // Make a GET request to John Doe Railway API to fetch train schedules
    const trainsResponse = await axios.get(`${API_BASE_URL}/trains`, {
      headers: {
        Authorization: `Bearer ${company.accessToken}`,
      },
    });

    // Process and sort the train schedules
    const trains = trainsResponse.data;
    const filteredTrains = filterAndSortTrains(trains);

    res.status(200).json(filteredTrains);
  } catch (error) {
    console.error('Fetching train schedules failed:', error.message);
    res.status(500).json({ error: 'Fetching train schedules failed' });
  }
});

// Function to filter and sort train schedules
const filterAndSortTrains = (trains) => {
  const now = moment();
  const twelveHoursLater = moment().add(12, 'hours');

  // Filter trains departing in the next 12 hours
  const filteredTrains = trains.filter((train) => {
    const departureTime = moment(train.departureTime, 'HH:mm:ss');
    return departureTime.isAfter(now) && departureTime.isBefore(twelveHoursLater);
  });

  // Sort the filtered trains based on price (ascending), tickets availability (descending), and departure time (after considering delays)
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