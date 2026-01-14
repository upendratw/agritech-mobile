// services/weather.js

const WEATHER_API_KEY = "37be4671c2a8483e832181009261001"; // 🔐 keep safe later
//const BASE_URL = "https://api.weatherapi.com/v1";

/**
 * Fetch 14-day weather forecast
 * @param {number} lat
 * @param {number} lon
 */
export async function get14DayForecast(lat, lon) {
  const url = `https://api.weatherapi.com/v1/forecast.json?key=${WEATHER_API_KEY}&q=${lat},${lon}&days=14&aqi=no&alerts=no`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Weather API failed");
  }

  return await res.json();
}