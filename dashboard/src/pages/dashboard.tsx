import React, { useState, useEffect, useMemo } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Plot from "react-plotly.js";
import { stringify } from "query-string";

import {
  Title,
  useList,
  ListContextProvider,
  DataTable,
  fetchUtils,
} from "react-admin";

import { API_BASE_URL } from "../utils/common";

// Type definitions
interface Driver {
  id: number;
  full_name: string;
  nationality: string;
  number_of_wins: number;
}

interface ConstructorData {
  constructor: string;
  year: number;
  total_points: number;
}

interface CircuitData {
  circuit_name: string;
  country: string;
  race_count: number;
}

interface NationalityData {
  nationality: string;
  driver_count: number;
}

interface SeasonData {
  year: number;
  total_races: number;
  unique_drivers: number;
}

interface ApiResponse<T> {
  status: number;
  headers: Headers;
  body: string;
  json: T;
}

interface FetchOptions {
  method?: string;
  headers?: Headers;
  [key: string]: any;
}

// Helper function for API calls with better error handling
const httpClient = async <T = any>(url: string, options: FetchOptions = {}): Promise<ApiResponse<T>> => {
  try {
    const { status, headers, body, json } = await fetchUtils.fetchJson(url, options);
    return { status, headers, body, json };
  } catch (error: any) {
    const message = error?.message || 'Failed to load data. Please try again.';
    throw new Error(message);
  }
};

// Component to show top drivers by wins with loading and error states
const TopDriversByWins: React.FC = () => {
  const [data, setData] = useState<Driver[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Memoize the URL and options to prevent unnecessary re-renders
  const apiUrl = useMemo(() => {
    const query = { range: "[0, 9]" };
    return `${API_BASE_URL}/dashboard/top_drivers_by_wins?${stringify(query)}`;
  }, []);
  
  const options = useMemo(() => ({
    method: "GET",
    headers: new Headers({
      Accept: "application/json",
    }),
  }), []);
  
  useEffect(() => {
    let mounted = true; // Prevent state updates if component unmounts
    
    const fetchData = async () => {
      if (!mounted) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const response = await httpClient<Driver[]>(apiUrl, options);
        if (mounted) {
          setData(response.json);
        }
      } catch (err: any) {
        if (mounted) {
          setError(`Failed to load top drivers: ${err.message}`);
          console.error('Top drivers API error:', err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    
    fetchData();
    
    return () => {
      mounted = false;
    };
  }, [apiUrl, options]);
  
  // Always call hooks in the same order
  const listContext = useList({ data: data || [] });
  
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={200}>
        <CircularProgress size={40} />
      </Box>
    );
  }
  
  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }
  
  if (!data || data.length === 0) {
    return <Alert severity="info">No driver data available.</Alert>;
  }
  
  return (
    <ListContextProvider value={listContext}>
      <DataTable resource="drivers" sx={{ boxShadow: 1 }} bulkActionButtons={false}>
        <DataTable.Col source="id" />
        <DataTable.Col source="full_name" />
        <DataTable.Col source="nationality" />
        <DataTable.Col source="number_of_wins" />
      </DataTable>
    </ListContextProvider>
  );
};

// Constructor Championship Chart
const ConstructorChampionshipChart: React.FC = () => {
  const [chartData, setChartData] = useState<ConstructorData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    let mounted = true;
    
    const fetchData = async () => {
      if (!mounted) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const url = `${API_BASE_URL}/dashboard/constructor_championships`;
        const response = await httpClient<ConstructorData[]>(url, {
          method: "GET",
          headers: new Headers({ Accept: "application/json" }),
        });
        
        if (mounted) {
          setChartData(response.json);
        }
      } catch (error: any) {
        if (mounted) {
          setError(`Failed to load constructor data: ${error.message}`);
          console.error("Constructor championship error:", error);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    
    fetchData();
    
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={300}>
        <CircularProgress size={50} />
        <Typography variant="body2" sx={{ ml: 2 }}>Loading championship data...</Typography>
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!chartData.length) {
    return <Alert severity="info">No constructor championship data available.</Alert>;
  }

  // Group data by constructor name for plotting
  const constructorMap: Record<string, { x: number[]; y: number[] }> = {};
  chartData.forEach((item) => {
    if (!constructorMap[item.constructor]) {
      constructorMap[item.constructor] = { x: [], y: [] };
    }
    constructorMap[item.constructor].x.push(item.year);
    constructorMap[item.constructor].y.push(item.total_points);
  });

  // Only show competitive teams (over 200 points max) and limit to top 6
  const plotData = Object.keys(constructorMap)
    .filter(name => Math.max(...constructorMap[name].y) > 200)
    .slice(0, 6)
    .map((constructor) => ({
      x: constructorMap[constructor].x,
      y: constructorMap[constructor].y,
      type: "scatter" as const,
      mode: "lines+markers" as const,
      name: constructor,
      line: { width: 3 },
    }));

  return (
    <Plot
      data={plotData}
      layout={{
        title: "Constructor Points Over Time",
        xaxis: { title: "Year" },
        yaxis: { title: "Championship Points" },
        height: 380,
        margin: { t: 50, r: 30, b: 50, l: 50 },
      }}
      style={{ width: "100%" }}
      config={{ displayModeBar: false }}
    />
  );
};

// Circuit Chart
const CircuitChart: React.FC = () => {
  const [circuits, setCircuits] = useState<CircuitData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const fetchData = async () => {
      if (!mounted) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const response = await httpClient<CircuitData[]>(`${API_BASE_URL}/dashboard/circuits_race_count`, {
          headers: new Headers({ Accept: "application/json" }),
        });
        
        if (mounted) {
          setCircuits(response.json);
        }
      } catch (err: any) {
        if (mounted) {
          setError(`Failed to load circuit data: ${err.message}`);
          console.error('Circuit data error:', err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    
    fetchData();
    
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={300}>
        <CircularProgress />
        <Typography variant="body2" sx={{ ml: 2 }}>Loading circuit data...</Typography>
      </Box>
    );
  }

  if (error) return <Alert severity="error">{error}</Alert>;
  if (circuits.length === 0) return <Alert severity="info">No circuit data available.</Alert>;

  const barData = {
    x: circuits.map(c => c.race_count),
    y: circuits.map(c => `${c.circuit_name} (${c.country})`),
    type: "bar" as const,
    orientation: "h" as const,
    marker: { color: "#dc004e" },
  };

  return (
    <Plot
      data={[barData]}
      layout={{
        title: "Most Used Racing Circuits",
        xaxis: { title: "Races Held" },
        height: 520,
        margin: { t: 50, r: 20, b: 50, l: 180 },
      }}
      style={{ width: "100%" }}
      config={{ displayModeBar: false }}
    />
  );
};

// Nationality Chart
const NationalityChart: React.FC = () => {
  const [nationalities, setNationalities] = useState<NationalityData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const loadNationalityData = async () => {
      if (!mounted) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const response = await httpClient<NationalityData[]>(`${API_BASE_URL}/dashboard/driver_nationality_stats`);
        if (mounted) {
          setNationalities(response.json);
        }
      } catch (err: any) {
        if (mounted) {
          setError(`Failed to load nationality data: ${err.message}`);
          console.error('Nationality data error:', err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    
    loadNationalityData();
    
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={300}>
        <CircularProgress />
        <Typography variant="body2" sx={{ ml: 2 }}>Loading nationality stats...</Typography>
      </Box>
    );
  }

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!nationalities.length) return <Alert severity="info">No nationality data available.</Alert>;

  const pieData = {
    labels: nationalities.map(n => n.nationality),
    values: nationalities.map(n => n.driver_count),
    type: "pie" as const,
    textinfo: "label+percent" as const,
  };

  return (
    <Plot
      data={[pieData]}
      layout={{
        title: "Drivers by Nationality",
        height: 420,
        showlegend: false,
      }}
      style={{ width: "100%" }}
      config={{ displayModeBar: false }}
    />
  );
};

// Season Chart
const SeasonChart: React.FC = () => {
  const [seasons, setSeasons] = useState<SeasonData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const fetchData = async () => {
      if (!mounted) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const response = await httpClient<SeasonData[]>(`${API_BASE_URL}/dashboard/season_results_overview`);
        if (mounted) {
          setSeasons(response.json);
        }
      } catch (err: any) {
        if (mounted) {
          setError(`Failed to load season data: ${err.message}`);
          console.error('Season data error:', err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    
    fetchData();
    
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={300}>
        <CircularProgress />
        <Typography variant="body2" sx={{ ml: 2 }}>Loading season data...</Typography>
      </Box>
    );
  }

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!seasons.length) return <Alert severity="info">No season data available.</Alert>;

  const raceData = {
    x: seasons.map(s => s.year),
    y: seasons.map(s => s.total_races),
    type: "scatter" as const,
    fill: "tozeroy" as const,
    name: "Races",
    line: { color: "#1976d2" },
  };

  const driverData = {
    x: seasons.map(s => s.year),
    y: seasons.map(s => s.unique_drivers),
    type: "scatter" as const,
    fill: "tozeroy" as const,
    name: "Drivers",
    line: { color: "#ff9800" },
    yaxis: "y2" as const,
  };

  return (
    <Plot
      data={[raceData, driverData]}
      layout={{
        title: "Season Stats: Races & Drivers",
        xaxis: { title: "Year" },
        yaxis: { title: "Races" },
        yaxis2: {
          title: "Drivers",
          side: "right",
          overlaying: "y",
        },
        height: 520,
        margin: { t: 50, r: 50, b: 50, l: 50 },
      }}
      style={{ width: "100%" }}
      config={{ displayModeBar: false }}
    />
  );
};

// Main dashboard component
export const Dashboard: React.FC = () => (
  <Box sx={{ m: 2 }}>
    <Title title="F1 Dashboard" />
    
    {/* Header card */}
    <Card sx={{ mb: 3, bgcolor: "#1976d2" }}>
      <CardContent>
        <Typography variant="h4" sx={{ color: "white", textAlign: "center" }}>
          F1 Racing Analytics
        </Typography>
        <Typography variant="subtitle1" sx={{ color: "white", textAlign: "center", mt: 1 }}>
          Championship insights and statistics
        </Typography>
      </CardContent>
    </Card>

    {/* Main dashboard grid */}
    <Grid container spacing={2}>
      {/* Top drivers table */}
      <Grid item xs={12} lg={6}>
        <Card sx={{ height: 500 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Championship Winners
            </Typography>
            <Box sx={{ height: 380, overflow: "auto" }}>
              <TopDriversByWins />
            </Box>
            <Typography variant="caption" sx={{ color: "text.secondary", mt: 1, display: "block" }}>
              Shows drivers ranked by total race wins. Only includes races where the driver finished in 1st position.
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Nationality pie chart */}
      <Grid item xs={12} lg={6}>
        <Card sx={{ height: 500 }}>
          <CardContent>
            <NationalityChart />
            <Typography variant="caption" sx={{ color: "text.secondary", mt: 1, display: "block", textAlign: "center" }}>
              Distribution of F1 drivers by country. Shows only nationalities with 3 or more drivers in the database.
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Constructor timeline */}
      <Grid item xs={12}>
        <Card sx={{ height: 500 }}>
          <CardContent>
            <ConstructorChampionshipChart />
            <Typography variant="caption" sx={{ color: "text.secondary", mt: 1, display: "block", textAlign: "center" }}>
              Championship points earned by each constructor team per season (2005 onwards). Only shows competitive teams with 50+ points.
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Circuit usage chart */}
      <Grid item xs={12} lg={6}>
        <Card sx={{ height: 640 }}>
          <CardContent>
            <CircuitChart />
            <Typography variant="caption" sx={{ color: "text.secondary", mt: 1, display: "block" }}>
              Racing circuits ranked by total number of F1 races hosted throughout history. Shows the 15 most popular venues.
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Season overview */}
      <Grid item xs={12} lg={6}>
        <Card sx={{ height: 640 }}>
          <CardContent>
            <SeasonChart />
            <Typography variant="caption" sx={{ color: "text.secondary", mt: 1, display: "block" }}>
              Evolution of F1 seasons from 2000 onwards. Blue area shows races per season, orange shows unique drivers participating.
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  </Box>
);