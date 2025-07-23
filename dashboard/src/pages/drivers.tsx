import {
  DataTable,
  DateField,
  List,
  Show,
  SimpleShowLayout,
  TextField,
  UrlField,
  Create,
  Edit,
  SimpleForm,
  TextInput,
  EditButton,
  DeleteButton,
  required,
  useNotify,
  useRedirect,
  SaveButton,
  Toolbar,
  DeleteWithConfirmButton,
  ToolbarProps,
} from "react-admin";
import { Box, Alert } from "@mui/material";
import { useState } from "react";

// Type definitions for error handling
interface ApiError {
  body?: {
    detail?: string;
  };
  message?: string;
}

// Enhanced List with better error handling
export const DriverList = () => (
  <List>
    <DataTable>
      <DataTable.Col source="id" />
      <DataTable.Col source="driver_ref" label="Reference" />
      <DataTable.Col source="number" label="Number" />
      <DataTable.Col source="code" label="Code" />
      <DataTable.Col source="forename" label="First Name" />
      <DataTable.Col source="surname" label="Last Name" />
      <DataTable.Col source="dob" label="Date of Birth">
        <DateField source="dob" />
      </DataTable.Col>
      <DataTable.Col source="nationality" />
      <DataTable.Col source="url" label="Website">
        <UrlField source="url" />
      </DataTable.Col>
      {/* Enhanced Actions column with better UX */}
      <DataTable.Col label="Actions">
        <EditButton />
        <DeleteWithConfirmButton 
          confirmTitle="Delete Driver"
          confirmContent="Are you sure you want to delete this driver? This action cannot be undone."
        />
      </DataTable.Col>
    </DataTable>
  </List>
);

// Enhanced Show component with better layout
export const DriverShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" />
      <TextField source="driver_ref" label="Reference" />
      <TextField source="number" label="Racing Number" />
      <TextField source="code" label="Driver Code" />
      <TextField source="forename" label="First Name" />
      <TextField source="surname" label="Last Name" />
      <DateField source="dob" label="Date of Birth" />
      <TextField source="nationality" />
      <UrlField source="url" label="Official Website" />
    </SimpleShowLayout>
  </Show>
);

// Custom toolbar with enhanced save functionality
const DriverFormToolbar = (props: ToolbarProps) => {
  const notify = useNotify();
  
  return (
    <Toolbar {...props}>
      <SaveButton 
        alwaysEnable 
        transform={(data: any) => {
          // Client-side validation before sending
          const errors: string[] = [];
          
          if (!data.driver_ref?.trim()) {
            errors.push("Driver reference is required");
          }
          if (!data.forename?.trim()) {
            errors.push("First name is required");
          }
          if (!data.surname?.trim()) {
            errors.push("Last name is required");
          }
          if (!data.nationality?.trim()) {
            errors.push("Nationality is required");
          }
          if (!data.dob) {
            errors.push("Date of birth is required");
          }
          
          if (errors.length > 0) {
            notify(`Validation errors: ${errors.join(', ')}`, { type: 'error' });
            throw new Error('Validation failed');
          }
          
          return data;
        }}
      />
    </Toolbar>
  );
};

// Enhanced Create form with validation and better UX
export const DriverCreate = () => {
  const notify = useNotify();
  const redirect = useRedirect();
  
  const handleSuccess = () => {
    notify('Driver created successfully!', { type: 'success' });
    redirect('list', 'drivers');
  };

  const handleError = (error: ApiError) => {
    console.error('Create driver error:', error);
    
    // Enhanced error message handling
    let message = 'Failed to create driver';
    
    if (error?.body?.detail) {
      message = error.body.detail;
    } else if (error?.message) {
      message = error.message;
    }
    
    notify(message, { type: 'error' });
  };

  return (
    <Create 
      mutationOptions={{
        onSuccess: handleSuccess,
        onError: handleError,
      }}
    >
      <SimpleForm toolbar={<DriverFormToolbar />}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 600 }}>
          
          {/* Help text for users */}
          <Alert severity="info" sx={{ mb: 2 }}>
            Fill in the driver information below. Fields marked with * are required.
          </Alert>
          
          <TextInput 
            source="driver_ref" 
            label="Driver Reference *" 
            validate={[required()]}
            helperText="Unique identifier for the driver (e.g., 'hamilton', 'verstappen')"
            fullWidth
          />
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextInput 
              source="number" 
              label="Racing Number"
              helperText="Driver's racing number (if any)"
              sx={{ flex: 1 }}
            />
            <TextInput 
              source="code" 
              label="Driver Code"
              helperText="3-letter code (e.g., 'HAM', 'VER')"
              inputProps={{ maxLength: 3 }}
              sx={{ flex: 1 }}
            />
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextInput 
              source="forename" 
              label="First Name *"
              validate={[required()]}
              sx={{ flex: 1 }}
            />
            <TextInput 
              source="surname" 
              label="Last Name *"
              validate={[required()]}
              sx={{ flex: 1 }}
            />
          </Box>
          
          <TextInput 
            source="dob" 
            label="Date of Birth *"
            type="date"
            validate={[required()]}
            helperText="Format: YYYY-MM-DD"
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          
          <TextInput 
            source="nationality" 
            label="Nationality *"
            validate={[required()]}
            helperText="Driver's nationality (e.g., 'British', 'Dutch')"
            fullWidth
          />
          
          <TextInput 
            source="url" 
            label="Official Website"
            type="url"
            helperText="Driver's official website or profile URL"
            fullWidth
          />
          
        </Box>
      </SimpleForm>
    </Create>
  );
};

// Enhanced Edit form with pre-filled validation
export const DriverEdit = () => {
  const notify = useNotify();
  const redirect = useRedirect();
  
  const handleSuccess = () => {
    notify('Driver updated successfully!', { type: 'success' });
    redirect('show', 'drivers');
  };

  const handleError = (error: ApiError) => {
    console.error('Update driver error:', error);
    
    // Enhanced error message handling for update conflicts
    let message = 'Failed to update driver';
    
    if (error?.body?.detail) {
      if (error.body.detail.includes('already exists') || error.body.detail.includes('already in use')) {
        message = `Update failed: ${error.body.detail}`;
      } else {
        message = error.body.detail;
      }
    } else if (error?.message) {
      message = error.message;
    }
    
    notify(message, { type: 'error', multiLine: true });
  };

  return (
    <Edit 
      mutationOptions={{
        onSuccess: handleSuccess,
        onError: handleError,
      }}
    >
      <SimpleForm toolbar={<DriverFormToolbar />}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 600 }}>
          
          {/* Show ID for reference but disabled */}
          <TextInput 
            disabled 
            source="id" 
            label="Driver ID"
            helperText="Unique database identifier (cannot be changed)"
            fullWidth
          />
          
          <Alert severity="warning" sx={{ mb: 2 }}>
            Be careful when editing driver information. Changes will affect all historical data.
          </Alert>
          
          <TextInput 
            source="driver_ref" 
            label="Driver Reference *"
            validate={[required()]}
            helperText="Unique identifier for the driver"
            fullWidth
          />
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextInput 
              source="number" 
              label="Racing Number"
              helperText="Driver's racing number"
              sx={{ flex: 1 }}
            />
            <TextInput 
              source="code" 
              label="Driver Code"
              helperText="3-letter code"
              inputProps={{ maxLength: 3 }}
              sx={{ flex: 1 }}
            />
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextInput 
              source="forename" 
              label="First Name *"
              validate={[required()]}
              sx={{ flex: 1 }}
            />
            <TextInput 
              source="surname" 
              label="Last Name *"
              validate={[required()]}
              sx={{ flex: 1 }}
            />
          </Box>
          
          <TextInput 
            source="dob" 
            label="Date of Birth *"
            type="date"
            validate={[required()]}
            helperText="Format: YYYY-MM-DD"
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          
          <TextInput 
            source="nationality" 
            label="Nationality *"
            validate={[required()]}
            helperText="Driver's nationality"
            fullWidth
          />
          
          <TextInput 
            source="url" 
            label="Official Website"
            type="url"
            helperText="Driver's official website or profile URL"
            fullWidth
          />
          
        </Box>
      </SimpleForm>
    </Edit>
  );
};