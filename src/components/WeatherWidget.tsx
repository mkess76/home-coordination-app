import { useState } from 'react';
import axios from 'axios';
import tailwindcss from 'tailwindcss';

interface WeatherData {
  location: string;
  currentTemperature: number;
  condition: string;
  forecast: {
    date: string,
    temperature: number,
    condition: string,
  }[];
}

const WeatherWidget = (props: { location: string }) => {
  const [data, setData] = useState<WeatherData>();

  useEffect(() => {
    axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${props.location}&appid=YOUR_API_KEY`)
      .then(response => setData(response.data));
  }, [props.location]);

  return (
    <div className="container mx-auto">
      <h1 className="text-4xl font-bold text-gray-800">{data?.location}</h1>
      {data && (
        <>
          <p className="text-2xl font-semibold text-gray-700">Current temperature: {data.currentTemperature}°C</p>
          <p className="text-lg font-medium text-gray-500">{data.condition}</p>
          <h2 className="text-xl font-bold text-gray-800 mb-4">Five-day forecast:</h2>
          <div className="flex flex-col space-y-4">
            {data.forecast.map(({ date, temperature, condition }) => (
              <div key={date} className="flex flex-row items-center justify-between px-6 py-3 text-gray-700 bg-gray-200 rounded">
                <span>{date}</span>
                <span>{temperature}°C</span>
                <span>{condition}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default WeatherWidget;

