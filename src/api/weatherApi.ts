const DEFAULT_BASE_URL = "https://api.openweathermap.org/data/2.5";
const API_BASE_URL =
  import.meta.env.VITE_OPENWEATHER_BASE_URL ?? DEFAULT_BASE_URL;
const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;

type CityQuery = {
  city: string;
  lat?: never;
  lon?: never;
};

type CoordsQuery = {
  city?: never;
  lat: number;
  lon: number;
};

export type WeatherQuery = CityQuery | CoordsQuery;

export class WeatherApiError extends Error {
  public readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "WeatherApiError";
    this.status = status;
  }
}

function buildQueryParams(query: WeatherQuery): URLSearchParams {
  const params = new URLSearchParams({
    appid: API_KEY ?? "",
    units: "metric",
  });

  if ("city" in query && query.city) {
    params.set("q", query.city);
    return params;
  }

  params.set("lat", String(query.lat));
  params.set("lon", String(query.lon));
  return params;
}

async function requestWeather<T>(
  endpoint: "weather" | "forecast",
  query: WeatherQuery,
): Promise<T> {
  if (!API_KEY) {
    throw new WeatherApiError(
      "Missing OpenWeatherMap API key. Please set VITE_OPENWEATHER_API_KEY in your environment.",
    );
  }

  const params = buildQueryParams(query);
  const url = `${API_BASE_URL}/${endpoint}?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new WeatherApiError(
      "Network error while requesting weather data. Please check your connection.",
    );
  }

  if (!response.ok) {
    let message = `Weather API request failed with status ${response.status}.`;

    try {
      const errorData = (await response.json()) as { message?: string };
      if (errorData.message) {
        message = errorData.message;
      }
    } catch {
      // Ignore JSON parse errors and use fallback message.
    }

    throw new WeatherApiError(message, response.status);
  }

  return (await response.json()) as T;
}

export async function getCurrentWeather<T = unknown>(
  query: WeatherQuery,
): Promise<T> {
  return requestWeather<T>("weather", query);
}

export async function getForecast<T = unknown>(
  query: WeatherQuery,
): Promise<T> {
  return requestWeather<T>("forecast", query);
}
