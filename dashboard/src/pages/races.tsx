import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import {
  DataTable,
  DateField,
  List,
  NumberField,
  ReferenceField,
  Show,
  TabbedShowLayout,
  UrlField,
  TextField,
  ListContextProvider,
  useList,
  Loading,
} from "react-admin";
import { Alert, CircularProgress, Box } from "@mui/material";

// Enhanced Race List with disabled checkboxes and better UX
export const RaceList = () => (
  <List>
    <DataTable bulkActionButtons={false}>
      <DataTable.Col source="id" />
      <DataTable.NumberCol source="year" />
      <DataTable.NumberCol source="round" />
      <DataTable.Col source="circuit_id">
        <ReferenceField source="circuit_id" reference="circuits" />
      </DataTable.Col>
      <DataTable.Col source="name" />
      <DataTable.Col source="date">
        <DateField source="date" />
      </DataTable.Col>
      <DataTable.Col source="time" />
      <DataTable.Col source="url">
        <UrlField source="url" />
      </DataTable.Col>
      <DataTable.Col source="fp1_date" />
      <DataTable.Col source="fp1_time" />
      <DataTable.Col source="fp2_date" />
      <DataTable.Col source="fp2_time" />
      <DataTable.Col source="fp3_date" />
      <DataTable.Col source="fp3_time" />
      <DataTable.Col source="quali_date" />
      <DataTable.Col source="quali_time" />
      <DataTable.Col source="sprint_date" />
      <DataTable.Col source="sprint_time" />
    </DataTable>
  </List>
);

// Enhanced Race Show with comprehensive error handling
export const RaceShow = () => {
  const { id } = useParams();
  const [raceInfo, setRaceInfo] = useState<any>(null);
  const [circuit, setCircuit] = useState<any>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [constructors, setConstructors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRaceDetails = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await axios.get(`http://localhost:9000/races/${id}/details`);
        const data = response.data;
        
        console.log("Race Details:", data);
        setRaceInfo(data);
        setCircuit(data.circuit);
        setDrivers(data.drivers || []);
        setConstructors(data.constructors || []);
        
      } catch (err: any) {
        console.error("Error fetching race details:", err);
        
        // Enhanced error message handling
        let errorMessage = "Failed to load race details.";
        
        if (err?.response?.status === 404) {
          errorMessage = "Race not found. It may have been deleted or the ID is incorrect.";
        } else if (err?.response?.status >= 500) {
          errorMessage = "Server error occurred. Please try again later.";
        } else if (err?.response?.data?.detail) {
          errorMessage = err.response.data.detail;
        } else if (err?.message) {
          errorMessage = `Connection error: ${err.message}`;
        }
        
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchRaceDetails();
    }
  }, [id]);

  // Create list contexts for React Admin DataTable components
  const driversListContext = useList({ data: drivers || [] });
  const constructorsListContext = useList({ data: constructors || [] });

  // Loading state
  if (loading) {
    return (
      <Show>
        <Box 
          display="flex" 
          justifyContent="center" 
          alignItems="center" 
          minHeight={400}
          flexDirection="column"
          gap={2}
        >
          <CircularProgress size={50} />
          <span>Loading race details...</span>
        </Box>
      </Show>
    );
  }

  // Error state
  if (error) {
    return (
      <Show>
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      </Show>
    );
  }

  return (
    <Show>
      <TabbedShowLayout>
        {/* Summary Tab */}
        <TabbedShowLayout.Tab label="summary">
          {raceInfo ? (
            <div>
              <TextField source="name" record={raceInfo} />
              <NumberField source="year" record={raceInfo} />
              <NumberField source="round" record={raceInfo} />
              <DateField source="date" record={raceInfo} />
              <TextField source="time" record={raceInfo} />
              <UrlField source="url" record={raceInfo} />
            </div>
          ) : (
            <Alert severity="info">No race summary available.</Alert>
          )}
        </TabbedShowLayout.Tab>

        {/* Circuit Tab */}
        <TabbedShowLayout.Tab label="circuit">
          {circuit ? (
            <div>
              <TextField source="name" record={circuit} />
              <TextField source="location" record={circuit} />
              <TextField source="country" record={circuit} />
              <UrlField source="url" record={circuit} />
            </div>
          ) : (
            <Alert severity="info">No circuit information available.</Alert>
          )}
        </TabbedShowLayout.Tab>

        {/* Drivers Tab */}
        <TabbedShowLayout.Tab label="drivers">
          {drivers && drivers.length > 0 ? (
            <ListContextProvider value={driversListContext}>
              <DataTable resource="drivers" bulkActionButtons={false}>
                <DataTable.Col source="id" />
                <DataTable.Col source="forename" />
                <DataTable.Col source="surname" />
                <DataTable.Col source="nationality" />
                <DataTable.Col source="code" />
                <DataTable.Col source="number" />
              </DataTable>
            </ListContextProvider>
          ) : (
            <Alert severity="info">No driver data available for this race.</Alert>
          )}
        </TabbedShowLayout.Tab>

        {/* Constructors Tab */}
        <TabbedShowLayout.Tab label="constructors">
          {constructors && constructors.length > 0 ? (
            <ListContextProvider value={constructorsListContext}>
              <DataTable resource="constructors" bulkActionButtons={false}>
                <DataTable.Col source="id" />
                <DataTable.Col source="name" />
                <DataTable.Col source="nationality" />
                <DataTable.Col source="constructor_ref" />
              </DataTable>
            </ListContextProvider>
          ) : (
            <Alert severity="info">No constructor data available for this race.</Alert>
          )}
        </TabbedShowLayout.Tab>
      </TabbedShowLayout>
    </Show>
  );
};