import { FormEvent, MouseEvent, TouchEvent, useEffect, useMemo, useState } from "react";
import {
  getForecast,
  getCurrentWeather,
  WeatherApiError,
  WeatherQuery,
} from "./api/weatherApi";

type WeatherResponse = {
  coord: {
    lon: number;
    lat: number;
  };
  name: string;
  dt: number;
  weather: Array<{ description: string; icon: string }>;
  main: {
    temp: number;
    temp_min: number;
    temp_max: number;
    feels_like: number;
    humidity: number;
    pressure: number;
  };
  wind: {
    speed: number;
  };
  sys: {
    sunrise: number;
    sunset: number;
  };
  visibility: number;
};

type ForecastResponse = {
  list: Array<{
    dt: number;
    main: {
      temp_min: number;
      temp_max: number;
    };
    weather: Array<{
      icon: string;
      description: string;
    }>;
  }>;
};

type ForecastDay = {
  dateKey: string;
  min: number;
  max: number;
  icon: string;
  description: string;
};

type CityItem = {
  id: string;
  label: string;
  query: WeatherQuery;
  weather?: WeatherResponse;
  loading?: boolean;
  error?: string;
  isCurrentLocation?: boolean;
};

const SAVED_CITIES_KEY = "weather_saved_cities";
const SWIPE_THRESHOLD = 60;

function normalizeError(error: unknown): string {
  if (error instanceof WeatherApiError) {
    if (error.status === 404) {
      return "找不到该城市，请检查输入后重试。";
    }
    return error.message || "天气查询失败，请稍后再试。";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "天气查询失败，请稍后再试。";
}

function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  return date.toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
}

function createCityId(query: WeatherQuery): string {
  if ("city" in query && typeof query.city === "string") {
    return `city:${query.city.trim().toLowerCase()}`;
  }
  return `coord:${query.lat.toFixed(4)},${query.lon.toFixed(4)}`;
}

function getWeatherIconUrl(iconCode?: string): string {
  if (!iconCode) {
    return "";
  }
  return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
}

function buildFiveDayTrend(data: ForecastResponse): ForecastDay[] {
  const dayMap = new Map<string, ForecastDay>();
  for (const item of data.list) {
    const dateKey = new Date(item.dt * 1000).toISOString().slice(0, 10);
    const existing = dayMap.get(dateKey);
    const icon = item.weather[0]?.icon ?? "01d";
    const description = item.weather[0]?.description ?? "";
    if (!existing) {
      dayMap.set(dateKey, {
        dateKey,
        min: item.main.temp_min,
        max: item.main.temp_max,
        icon,
        description,
      });
      continue;
    }
    existing.min = Math.min(existing.min, item.main.temp_min);
    existing.max = Math.max(existing.max, item.main.temp_max);
    if (item.dt % 86400 > 39600 && item.dt % 86400 < 54000) {
      existing.icon = icon;
      existing.description = description;
    }
  }
  return Array.from(dayMap.values()).slice(0, 5);
}

export default function App() {
  const [cityInput, setCityInput] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [detailCityId, setDetailCityId] = useState<string | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [mouseStartX, setMouseStartX] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [cities, setCities] = useState<CityItem[]>([]);
  const [favoriteCities, setFavoriteCities] = useState<string[]>([]);
  const [forecastByCity, setForecastByCity] = useState<Record<string, ForecastDay[]>>({});
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState("");

  const detailCity = useMemo(
    () => cities.find((item) => item.id === detailCityId),
    [cities, detailCityId],
  );
  const isDetailPage = Boolean(detailCityId && detailCity?.weather);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_CITIES_KEY);
      const parsed = saved ? (JSON.parse(saved) as string[]) : [];
      const initialCities: CityItem[] = Array.isArray(parsed)
        ? parsed
            .filter((item) => typeof item === "string" && item.trim().length > 0)
            .map((cityName) => {
              const trimmed = cityName.trim();
              return {
                id: createCityId({ city: trimmed }),
                label: trimmed,
                query: { city: trimmed },
              };
            })
        : [];

      if (initialCities.length > 0) {
        setFavoriteCities(initialCities.map((item) => item.label));
      }
    } catch {
      setFavoriteCities([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const hasCurrentLocation = cities.some((item) => item.isCurrentLocation);
    if (!hasCurrentLocation) {
      void locateCurrentCity();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities.length]);

  useEffect(() => {
    const fetchDetailForecast = async () => {
      if (!detailCityId) {
        return;
      }
      if (forecastByCity[detailCityId]) {
        return;
      }
      const city = cities.find((item) => item.id === detailCityId);
      if (!city) {
        return;
      }

      setForecastLoading(true);
      setForecastError("");
      try {
        const forecast = await getForecast<ForecastResponse>(city.query);
        setForecastByCity((prev) => ({
          ...prev,
          [detailCityId]: buildFiveDayTrend(forecast),
        }));
      } catch (error) {
        setForecastError(normalizeError(error));
      } finally {
        setForecastLoading(false);
      }
    };
    void fetchDetailForecast();
  }, [cities, detailCityId, forecastByCity]);

  const changeSlideByDelta = (delta: number) => {
    if (Math.abs(delta) < SWIPE_THRESHOLD) {
      return;
    }
    if (delta < 0 && currentIndex < cities.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
    if (delta > 0 && currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const setCityLoading = (cityId: string, loading: boolean) => {
    setCities((prev) =>
      prev.map((item) =>
        item.id === cityId ? { ...item, loading, error: loading ? "" : item.error } : item,
      ),
    );
  };

  const fetchCityWeather = async (cityId: string, query: WeatherQuery) => {
    setCityLoading(cityId, true);
    try {
      const weather = await getCurrentWeather<WeatherResponse>(query);
      setCities((prev) =>
        prev.map((item) =>
          item.id === cityId
            ? {
                ...item,
                label: weather.name,
                weather,
                loading: false,
                error: "",
              }
            : item,
        ),
      );
    } catch (error) {
      const message = normalizeError(error);
      setCities((prev) =>
        prev.map((item) =>
          item.id === cityId
            ? {
                ...item,
                loading: false,
                error: message,
              }
            : item,
        ),
      );
    }
  };

  const persistFavoriteCities = (nextFavorites: string[]) => {
    localStorage.setItem(SAVED_CITIES_KEY, JSON.stringify(nextFavorites));
  };

  const addFavoriteCity = (cityName: string) => {
    const normalized = cityName.trim();
    if (!normalized) {
      return;
    }
    setFavoriteCities((prev) => {
      if (prev.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
        return prev;
      }
      const nextFavorites = [...prev, normalized];
      persistFavoriteCities(nextFavorites);
      return nextFavorites;
    });
  };

  const removeFavoriteCity = (cityName: string) => {
    setFavoriteCities((prev) => {
      const nextFavorites = prev.filter((item) => item.toLowerCase() !== cityName.toLowerCase());
      persistFavoriteCities(nextFavorites);
      return nextFavorites;
    });
  };

  const isFavoriteCity = (city?: CityItem) => {
    if (!city || city.isCurrentLocation || !("city" in city.query)) {
      return false;
    }
    const cityName = city.weather?.name ?? city.label;
    return favoriteCities.some((item) => item.toLowerCase() === cityName.toLowerCase());
  };

  const locateCurrentCity = async () => {
    if (!navigator.geolocation) {
      setErrorMessage("当前浏览器不支持定位功能。");
      return;
    }

    setErrorMessage("");

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const query: WeatherQuery = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      };
      const cityId = createCityId(query);

      setCities((prev) => {
        if (prev.some((item) => item.id === cityId)) {
          return prev;
        }
        return [
          {
            id: cityId,
            label: "当前位置",
            query,
            isCurrentLocation: true,
            loading: true,
          },
          ...prev,
        ];
      });
      setCurrentIndex(0);
      await fetchCityWeather(cityId, query);
    } catch (error) {
      if (error instanceof GeolocationPositionError) {
        if (error.code === error.PERMISSION_DENIED) {
          setErrorMessage("你已拒绝定位权限，请允许后重试。");
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setErrorMessage("暂时无法获取当前位置，请稍后再试。");
        } else if (error.code === error.TIMEOUT) {
          setErrorMessage("定位超时，请检查网络或稍后重试。");
        } else {
          setErrorMessage("定位失败，请稍后再试。");
        }
      } else {
        setErrorMessage(normalizeError(error));
      }
    }
  };

  const handleAddCity = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = cityInput.trim();
    if (!trimmed) {
      setErrorMessage("请输入城市名称。");
      return;
    }
    const query: WeatherQuery = { city: trimmed };
    const cityId = createCityId(query);
    if (cities.some((item) => item.id === cityId)) {
      setErrorMessage("该城市已添加。");
      return;
    }

    const nextItem: CityItem = { id: cityId, label: trimmed, query, loading: true };
    const nextCities = [...cities, nextItem];
    setCities(nextCities);
    setCurrentIndex(nextCities.length - 1);
    setCityInput("");
    setShowAddForm(false);
    setErrorMessage("");
    await fetchCityWeather(cityId, query);
  };

  const handleDeleteCity = (cityId: string) => {
    const nextCities = cities.filter((item) => item.id !== cityId);
    setCities(nextCities);
    setCurrentIndex((prev) => Math.max(0, Math.min(prev, nextCities.length - 1)));
    if (detailCityId === cityId) {
      setDetailCityId(null);
    }
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    setTouchStartX(event.changedTouches[0].clientX);
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null) {
      return;
    }
    const delta = event.changedTouches[0].clientX - touchStartX;
    changeSlideByDelta(delta);
    setTouchStartX(null);
  };

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    setMouseStartX(event.clientX);
  };

  const handleMouseUp = (event: MouseEvent<HTMLDivElement>) => {
    if (mouseStartX === null) {
      return;
    }
    const delta = event.clientX - mouseStartX;
    changeSlideByDelta(delta);
    setMouseStartX(null);
  };

  const handleQuickQueryFavorite = async (cityName: string) => {
    const normalized = cityName.trim();
    if (!normalized) {
      return;
    }
    const existingIndex = cities.findIndex(
      (item) =>
        "city" in item.query &&
        typeof item.query.city === "string" &&
        item.query.city.toLowerCase() === normalized.toLowerCase(),
    );
    if (existingIndex >= 0) {
      const city = cities[existingIndex];
      setCurrentIndex(existingIndex);
      await fetchCityWeather(city.id, city.query);
      return;
    }

    const query: WeatherQuery = { city: normalized };
    const cityId = createCityId(query);
    const nextItem: CityItem = { id: cityId, label: normalized, query, loading: true };
    setCities((prev) => {
      setCurrentIndex(prev.length);
      return [...prev, nextItem];
    });
    await fetchCityWeather(cityId, query);
  };

  return (
    <main className="page">
      <section className={`phone-shell ${isDetailPage ? "detail-page-shell" : ""}`}>
        {!isDetailPage ? (
          <>
        <header className="top-bar">
          <h1>天气</h1>
          <button className="add-btn" type="button" onClick={() => setShowAddForm((v) => !v)}>
            +
          </button>
        </header>

        {showAddForm && (
          <form className="add-form" onSubmit={handleAddCity}>
            <input
              className="input"
              type="text"
              value={cityInput}
              onChange={(event) => setCityInput(event.target.value)}
              placeholder="输入城市名称"
            />
            <button className="btn" type="submit">
              添加
            </button>
          </form>
        )}

        {errorMessage && <p className="error global-error">{errorMessage}</p>}

        <section className="favorite-panel">
          <p className="favorite-title">收藏城市</p>
          {favoriteCities.length === 0 ? (
            <p className="hint">查询城市后可点击“收藏”以便快速查询</p>
          ) : (
            <div className="favorite-list">
              {favoriteCities.map((cityName) => (
                <div key={cityName} className="favorite-chip">
                  <button
                    type="button"
                    className="favorite-chip-city"
                    onClick={() => {
                      void handleQuickQueryFavorite(cityName);
                    }}
                  >
                    {cityName}
                  </button>
                  <button
                    type="button"
                    className="favorite-chip-delete"
                    onClick={() => removeFavoriteCity(cityName)}
                    aria-label={`删除收藏 ${cityName}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <div
          className="carousel-wrap"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setMouseStartX(null)}
        >
          <div
            className="carousel"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {cities.map((city) => (
              <article
                key={city.id}
                className="city-screen"
                onClick={() => setDetailCityId(city.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    setDetailCityId(city.id);
                  }
                }}
              >
                <p className="city-title">
                  {city.isCurrentLocation ? "📍 " : ""}
                  {city.weather?.name ?? city.label}
                </p>
                {city.loading && (
                  <div className="loading">
                    <span className="spinner" />
                    <span>正在更新天气...</span>
                  </div>
                )}
                {!city.loading && city.error && <p className="error">{city.error}</p>}
                {!city.loading && !city.error && city.weather && (
                  <div className="hero-weather">
                    <img
                      className="weather-icon"
                      src={getWeatherIconUrl(city.weather.weather[0]?.icon)}
                      alt={city.weather.weather[0]?.description ?? "天气图标"}
                    />
                    <p className="hero-temp">{Math.round(city.weather.main.temp)}°</p>
                    <p>{city.weather.weather[0]?.description ?? "暂无数据"}</p>
                    <p>
                      最高 {Math.round(city.weather.main.temp_max)}° · 最低{" "}
                      {Math.round(city.weather.main.temp_min)}°
                    </p>
                    <p>湿度 {city.weather.main.humidity}% · 风速 {city.weather.wind.speed} m/s</p>
                    <p className="hint">点击查看城市详情</p>
                  </div>
                )}
                {!city.isCurrentLocation && (
                  <div className="city-actions">
                    <button
                      className="collect-chip"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (isFavoriteCity(city)) {
                          removeFavoriteCity(city.weather?.name ?? city.label);
                          return;
                        }
                        addFavoriteCity(city.weather?.name ?? city.label);
                      }}
                    >
                      {isFavoriteCity(city) ? "已收藏" : "收藏城市"}
                    </button>
                    <button
                      className="delete-chip"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteCity(city.id);
                      }}
                    >
                      删除城市
                    </button>
                  </div>
                )}
              </article>
            ))}
            {cities.length === 0 && (
              <article className="city-screen empty-screen">
                <p>正在获取定位城市天气...</p>
                <p className="hint">如未出现，请允许定位权限或右上角添加城市</p>
              </article>
            )}
          </div>
        </div>

        {cities.length > 1 && (
          <div className="dots">
            {cities.map((city, idx) => (
              <button
                key={city.id}
                type="button"
                className={`dot ${idx === currentIndex ? "active" : ""}`}
                onClick={() => setCurrentIndex(idx)}
                aria-label={`切换到${city.label}`}
              />
            ))}
          </div>
        )}
          </>
        ) : (
          detailCity?.weather && (
            <section className="detail-page">
              <header className="detail-nav">
                <button className="back-btn" type="button" onClick={() => setDetailCityId(null)}>
                  返回
                </button>
                <p className="detail-nav-title">{detailCity.weather.name}</p>
              </header>

              <article className="detail-hero">
                <img
                  className="detail-hero-icon"
                  src={getWeatherIconUrl(detailCity.weather.weather[0]?.icon)}
                  alt={detailCity.weather.weather[0]?.description ?? "天气图标"}
                />
                <p className="detail-hero-temp">{Math.round(detailCity.weather.main.temp)}°C</p>
                <p className="detail-desc">{detailCity.weather.weather[0]?.description}</p>
                <p className="detail-range">
                  最高 {Math.round(detailCity.weather.main.temp_max)}° · 最低{" "}
                  {Math.round(detailCity.weather.main.temp_min)}°
                </p>
              </article>

              <div className="detail-grid">
                <p>体感温度：{Math.round(detailCity.weather.main.feels_like)}°C</p>
                <p>湿度：{detailCity.weather.main.humidity}%</p>
                <p>气压：{detailCity.weather.main.pressure} hPa</p>
                <p>风速：{detailCity.weather.wind.speed} m/s</p>
                <p>能见度：{Math.round(detailCity.weather.visibility / 1000)} km</p>
                <p>更新时间：{formatTime(detailCity.weather.dt)}</p>
                <p>日出：{formatTime(detailCity.weather.sys.sunrise)}</p>
                <p>日落：{formatTime(detailCity.weather.sys.sunset)}</p>
              </div>

              <section className="forecast-section">
                <h3>未来 5 天趋势</h3>
                {forecastLoading && <p>正在加载预报...</p>}
                {!forecastLoading && forecastError && <p className="error">{forecastError}</p>}
                {!forecastLoading && !forecastError && (
                  <div className="forecast-row">
                    {(forecastByCity[detailCity.id] ?? []).map((day) => (
                      <article key={day.dateKey} className="forecast-card">
                        <p className="forecast-date">{formatDateLabel(day.dateKey)}</p>
                        <img src={getWeatherIconUrl(day.icon)} alt={day.description} />
                        <p className="forecast-temp">
                          {Math.round(day.max)}° / {Math.round(day.min)}°
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </section>
          )
        )}
      </section>
    </main>
  );
}
