import { useState, useEffect, useCallback } from 'react';
import Background from './components/Background';
import LoadingBar from './components/LoadingBar';
import Hero from './components/Hero';
import StatusCards from './components/StatusCards';
import Timeline from './components/Timeline';
import Stats from './components/Stats';
import Heatmap from './components/Heatmap';
import Footer from './components/Footer';

const REFRESH_INTERVAL = 30000;

export default function App() {
  const [data, setData] = useState(null);
  const [events, setEvents] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [showStars, setShowStars] = useState(true);

  const loadData = useCallback(async (isAutoRefresh = false) => {
    if (!isAutoRefresh) setIsRefreshing(true);
    try {
      const timestamp = Date.now();
      const [dataRes, eventsRes] = await Promise.all([
        fetch(`./data.json?t=${timestamp}`),
        fetch(`./events.json?t=${timestamp}`),
      ]);
      if (dataRes.ok) {
        const newData = await dataRes.json();
        setData(newData);
      }
      if (eventsRes.ok) {
        const newEvents = await eventsRes.json();
        setEvents(newEvents);
      }
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      if (!isAutoRefresh) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const inlineData = window.__INITIAL_DATA__;
    if (inlineData) {
      setData(inlineData.data || null);
      setEvents(inlineData.events || []);
      setLastUpdate(new Date(inlineData.lastUpdate || Date.now()));
    } else {
      loadData();
    }

    const timer = setInterval(() => loadData(true), REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [loadData]);

  const handleRefresh = () => loadData(false);

  return (
    <div className="min-h-screen relative">
      <LoadingBar isLoading={isRefreshing} />
      <Background showStars={showStars} />

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
        <Hero
          data={data}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          lastUpdate={lastUpdate}
        />

        {data && (
          <div className="space-y-10 md:space-y-12">
            <StatusCards data={data} events={events} />
            <Timeline events={events} />
            <Stats events={events} data={data} />
            <Heatmap events={events} />
          </div>
        )}

        {!data && (
          <div className="flex items-center justify-center py-20">
            <div className="text-text-secondary text-center">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p>加载数据中...</p>
            </div>
          </div>
        )}

        <Footer />
      </main>
    </div>
  );
}
