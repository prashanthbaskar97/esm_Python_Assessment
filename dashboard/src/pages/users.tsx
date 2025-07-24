import React, { useState, useEffect } from "react";
import {
  DataTable,
  List,
  Show,
  SimpleShowLayout,
  TextField,
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
  SelectInput,
  usePermissions,
  useGetIdentity,
} from "react-admin";
import { Box, Alert, Typography, Paper } from "@mui/material";

// Type definitions
interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
}

interface ApiError {
  body?: {
    detail?: string;
  };
  message?: string;
}

// Access Control Component
const AdminOnlyMessage = () => (
  <Paper sx={{ p: 3, m: 2, bgcolor: 'error.light', color: 'error.contrastText' }}>
    <Typography variant="h6" gutterBottom>
      🔒 Admin Access Required
    </Typography>
    <Typography>
      You need administrator privileges to manage users. Only admins can create, edit, or delete user accounts.
    </Typography>
    <Typography variant="body2" sx={{ mt: 1 }}>
      Current permissions allow you to view users but not modify them.
    </Typography>
  </Paper>
);

// Enhanced User List Component with Role-Based Access
export const UserList = () => {
  const { permissions } = usePermissions();
  const { identity } = useGetIdentity();
  const isAdmin = permissions === 'admin';

  return (
    <List>
      <Alert severity="info" sx={{ mb: 2 }}>
        ℹ️ User Management - View and manage system users
        {!isAdmin && (
          <Typography variant="body2" sx={{ mt: 1, color: 'warning.main' }}>
            ⚠️ You have read-only access. Administrator privileges required for modifications.
          </Typography>
        )}
      </Alert>
      
      {!isAdmin && <AdminOnlyMessage />}
      
      <DataTable>
        <DataTable.Col source="id" />
        <DataTable.Col source="username" label="Username" />
        <DataTable.Col source="email" label="Email" />
        <DataTable.Col source="full_name" label="Full Name" />
        <DataTable.Col source="role" label="Role" />
        <DataTable.Col source="created_at" label="Created" />
        {isAdmin && (
          <DataTable.Col label="Actions">
            <EditButton />
            <DeleteWithConfirmButton 
              confirmTitle="Delete User"
              confirmContent="Are you sure you want to delete this user? This action cannot be undone."
            />
          </DataTable.Col>
        )}
      </DataTable>
    </List>
  );
};

// User Show Component with Role Information
export const UserShow = () => {
  const { permissions } = usePermissions();
  const isAdmin = permissions === 'admin';

  return (
    <Show>
      <SimpleShowLayout>
        <TextField source="id" />
        <TextField source="username" label="Username" />
        <TextField source="email" label="Email Address" />
        <TextField source="full_name" label="Full Name" />
        <TextField source="role" label="Role" />
        <TextField source="created_at" label="Account Created" />
        
        {!isAdmin && (
          <Box sx={{ mt: 2 }}>
            <Alert severity="warning">
              🔒 You are viewing this user in read-only mode. Administrator privileges required for modifications.
            </Alert>
          </Box>
        )}
      </SimpleShowLayout>
    </Show>
  );
};

// Custom toolbar for user forms with admin check
const UserFormToolbar = (props: ToolbarProps) => {
  const notify = useNotify();
  const { permissions } = usePermissions();
  const isAdmin = permissions === 'admin';
  
  if (!isAdmin) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">
          🚫 Administrator access required to save user changes.
        </Alert>
      </Box>
    );
  }
  
  return (
    <Toolbar {...props}>
      <SaveButton 
        alwaysEnable 
        transform={(data: any) => {
          // Client-side validation
          const errors: string[] = [];
          
          if (!data.username?.trim()) {
            errors.push("Username is required");
          }
          if (!data.email?.trim()) {
            errors.push("Email is required");
          }
          if (!data.full_name?.trim()) {
            errors.push("Full name is required");
          }
          if (!data.role) {
            errors.push("Role selection is required");
          }
          
          // Basic email validation
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (data.email && !emailRegex.test(data.email)) {
            errors.push("Please enter a valid email address");
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

// Admin-Only User Create Component
export const UserCreate = () => {
  const notify = useNotify();
  const redirect = useRedirect();
  const { permissions } = usePermissions();
  const isAdmin = permissions === 'admin';
  
  // Redirect non-admins
  useEffect(() => {
    if (permissions && !isAdmin) {
      notify('Administrator access required to create users', { type: 'error' });
      redirect('list', 'users');
    }
  }, [permissions, isAdmin, notify, redirect]);

  const handleSuccess = () => {
    notify('User created successfully!', { type: 'success' });
    redirect('list', 'users');
  };

  const handleError = (error: ApiError) => {
    console.error('Create user error:', error);
    
    let message = 'Failed to create user';
    
    if (error?.body?.detail) {
      if (error.body.detail.includes('Admin access required')) {
        message = 'Administrator privileges required to create users.';
      } else if (error.body.detail.includes('already exists')) {
        message = 'Username or email already exists. Please choose different credentials.';
      } else {
        message = error.body.detail;
      }
    } else if (error?.message) {
      message = error.message;
    }
    
    notify(message, { type: 'error' });
  };

  if (!isAdmin) {
    return <AdminOnlyMessage />;
  }

  return (
    <Create 
      mutationOptions={{
        onSuccess: handleSuccess,
        onError: handleError,
      }}
    >
      <SimpleForm toolbar={<UserFormToolbar />}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 600 }}>
          
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              🔧 Administrator - Create New User
            </Typography>
            Create a new user account. All fields marked with * are required.
          </Alert>
          
          <TextInput 
            source="username" 
            label="Username *" 
            validate={[required()]}
            helperText="Unique username for login (e.g., 'john_doe', 'admin2')"
            fullWidth
          />
          
          <TextInput 
            source="email" 
            label="Email Address *"
            type="email"
            validate={[required()]}
            helperText="Valid email address for the user"
            fullWidth
          />
          
          <TextInput 
            source="full_name" 
            label="Full Name *"
            validate={[required()]}
            helperText="User's complete name (e.g., 'John Doe')"
            fullWidth
          />
          
          <SelectInput 
            source="role" 
            label="User Role *"
            choices={[
              { id: 'admin', name: 'Administrator - Full system access' },
              { id: 'user', name: 'Standard User - Normal access' },
              { id: 'viewer', name: 'Read-Only Viewer - Limited access' },
            ]}
            validate={[required()]}
            helperText="Select appropriate access level for this user"
            fullWidth
          />
          
          <TextInput 
            source="password" 
            label="Password *"
            type="password"
            validate={[required()]}
            helperText="Secure password for the user account"
            fullWidth
          />
          
        </Box>
      </SimpleForm>
    </Create>
  );
};

// Admin-Only User Edit Component
export const UserEdit = () => {
  const notify = useNotify();
  const redirect = useRedirect();
  const { permissions } = usePermissions();
  const isAdmin = permissions === 'admin';
  
  // Redirect non-admins
  useEffect(() => {
    if (permissions && !isAdmin) {
      notify('Administrator access required to edit users', { type: 'error' });
      redirect('list', 'users');
    }
  }, [permissions, isAdmin, notify, redirect]);
  
  const handleSuccess = () => {
    notify('User updated successfully!', { type: 'success' });
    redirect('show', 'users');
  };

  const handleError = (error: ApiError) => {
    console.error('Update user error:', error);
    
    let message = 'Failed to update user';
    
    if (error?.body?.detail) {
      if (error.body.detail.includes('Admin access required')) {
        message = 'Administrator privileges required to modify users.';
      } else if (error.body.detail.includes('already exists')) {
        message = 'Username or email is already taken by another user.';
      } else {
        message = error.body.detail;
      }
    } else if (error?.message) {
      message = error.message;
    }
    
    notify(message, { type: 'error', multiLine: true });
  };

  if (!isAdmin) {
    return <AdminOnlyMessage />;
  }

  return (
    <Edit 
      mutationOptions={{
        onSuccess: handleSuccess,
        onError: handleError,
      }}
    >
      <SimpleForm toolbar={<UserFormToolbar />}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 600 }}>
          
          <TextInput 
            disabled 
            source="id" 
            label="User ID"
            helperText="Unique system identifier (cannot be changed)"
            fullWidth
          />
          
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              ⚠️ Administrator - Edit User
            </Typography>
            Be careful when editing user information. Changes affect login credentials and access levels.
          </Alert>
          
          <TextInput 
            source="username" 
            label="Username *"
            validate={[required()]}
            helperText="Username for login"
            fullWidth
          />
          
          <TextInput 
            source="email" 
            label="Email Address *"
            type="email"
            validate={[required()]}
            helperText="User's email address"
            fullWidth
          />
          
          <TextInput 
            source="full_name" 
            label="Full Name *"
            validate={[required()]}
            helperText="Complete name of the user"
            fullWidth
          />
          
          <SelectInput 
            source="role" 
            label="User Role *"
            choices={[
              { id: 'admin', name: 'Administrator - Full system access' },
              { id: 'user', name: 'Standard User - Normal access' },
              { id: 'viewer', name: 'Read-Only Viewer - Limited access' },
            ]}
            validate={[required()]}
            helperText="User's access level and permissions"
            fullWidth
          />
          
          <TextInput 
            source="password" 
            label="New Password (optional)"
            type="password"
            helperText="Leave empty to keep current password"
            fullWidth
          />
          
        </Box>
      </SimpleForm>
    </Edit>
  );
};