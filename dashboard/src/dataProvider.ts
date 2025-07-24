import simpleRestProvider from "ra-data-simple-rest";
import { fetchUtils } from 'react-admin';
import { API_BASE_URL } from "./utils/common";

// Custom HTTP client that adds authentication headers
const httpClient = (url: string, options: any = {}) => {
  if (!options.headers) {
    options.headers = new Headers({ Accept: 'application/json' });
  }
  
  // Get token from 'auth' key (matching authProvider.ts)
  const authData = localStorage.getItem('auth');
  if (authData) {
    try {
      const auth = JSON.parse(authData);
      if (auth.token) {
        // Add Bearer token for API authentication
        options.headers.set('Authorization', `Bearer ${auth.token}`);
      }
    } catch (e) {
      console.warn('Failed to parse auth data:', e);
    }
  }
  
  return fetchUtils.fetchJson(url, options);
};

// Create the base data provider
const baseDataProvider = simpleRestProvider(API_BASE_URL, httpClient);

// Custom data provider with enhanced error handling and auth-specific messages
export const dataProvider = {
  ...baseDataProvider,
  
  // Override create method to add better error handling for user creation
  create: async (resource: string, params: any) => {
    console.log(`Creating ${resource}:`, params.data);
    
    try {
      const result = await baseDataProvider.create(resource, params);
      console.log(`Successfully created ${resource}:`, result);
      return result;
    } catch (error: any) {
      console.error(`Failed to create ${resource}:`, error);
      
      // Enhanced error handling for user creation
      if (resource === 'users') {
        if (error.status === 403) {
          throw new Error('Administrator access required to create users. Please login as an admin.');
        } else if (error.status === 401) {
          throw new Error('Authentication required. Please login to create users.');
        } else if (error.status === 409) {
          throw new Error('Username or email already exists. Please choose different credentials.');
        } else if (error.status === 422) {
          throw new Error('Validation error: Please check all required fields are filled correctly.');
        } else if (error.status === 500) {
          throw new Error('Server error: Please try again or contact support.');
        }
      }
      
      throw error;
    }
  },
  
  // Override update method for better error handling
  update: async (resource: string, params: any) => {
    console.log(`Updating ${resource} ${params.id}:`, params.data);
    
    try {
      const result = await baseDataProvider.update(resource, params);
      console.log(`Successfully updated ${resource}:`, result);
      return result;
    } catch (error: any) {
      console.error(`Failed to update ${resource}:`, error);
      
      if (resource === 'users') {
        if (error.status === 403) {
          throw new Error('Administrator access required to modify users.');
        } else if (error.status === 401) {
          throw new Error('Authentication required. Please login to modify users.');
        } else if (error.status === 409) {
          throw new Error('Username or email already exists for another user.');
        } else if (error.status === 404) {
          throw new Error('User not found.');
        }
      }
      
      throw error;
    }
  },
  
  // Override delete method for better error handling
  delete: async (resource: string, params: any) => {
    console.log(`Deleting ${resource} ${params.id}`);
    
    try {
      const result = await baseDataProvider.delete(resource, params);
      console.log(`Successfully deleted ${resource}:`, result);
      return result;
    } catch (error: any) {
      console.error(`Failed to delete ${resource}:`, error);
      
      if (resource === 'users') {
        if (error.status === 403) {
          throw new Error('Administrator access required to delete users.');
        } else if (error.status === 401) {
          throw new Error('Authentication required. Please login to delete users.');
        } else if (error.status === 400) {
          // Handle specific business rules
          if (error.body?.detail?.includes('Cannot delete')) {
            throw new Error(error.body.detail);
          }
          throw new Error('Cannot delete this user.');
        }
      }
      
      throw error;
    }
  },
  
  // Add debugging to getList for troubleshooting
  getList: async (resource: string, params: any) => {
    console.log(`Getting ${resource} list with params:`, params);
    
    try {
      const result = await baseDataProvider.getList(resource, params);
      console.log(`Successfully retrieved ${result.data.length} ${resource}(s)`);
      return result;
    } catch (error: any) {
      console.error(`Failed to get ${resource} list:`, error);
      
      if (resource === 'users') {
        if (error.status === 401) {
          throw new Error('Authentication required to view users. Please login.');
        } else if (error.status === 403) {
          throw new Error('Access denied. You do not have permission to view users.');
        }
      }
      
      throw error;
    }
  },
  
  // Override getOne for authentication handling
  getOne: async (resource: string, params: any) => {
    console.log(`Getting ${resource} ${params.id}`);
    
    try {
      const result = await baseDataProvider.getOne(resource, params);
      console.log(`Successfully retrieved ${resource}:`, result);
      return result;
    } catch (error: any) {
      console.error(`Failed to get ${resource}:`, error);
      
      if (resource === 'users') {
        if (error.status === 401) {
          throw new Error('Authentication required to view user details.');
        } else if (error.status === 403) {
          throw new Error('Access denied. You do not have permission to view this user.');
        }
      }
      
      throw error;
    }
  }
};